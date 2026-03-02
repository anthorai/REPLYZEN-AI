// =========================================================
// REPLIFY AI - Daily Digest (HARDENED)
// Section 11: Daily Digest Feature
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const rateLimitMiddleware = createRateLimitMiddleware({ requestsPerMinute: 50, requestsPerHour: 500 });

Deno.serve(async (req) => {
  const logger = createLogger("daily-digest", req);
  const executionId = logger.getRequestId();
  
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;
  
  logger.info("Daily digest started", { executionId });

  try {
    // Rate limiting
    const { allowed } = await rateLimitMiddleware(req);
    if (!allowed) {
      logAbuseAttempt("daily-digest", "/functions/daily-digest", req.headers.get("user-agent"));
      return createErrorResponse(req, "Rate limit exceeded", 429, "RATE_LIMITED");
    }

    // Get all users with daily digest enabled
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id, daily_digest")
      .eq("daily_digest", true);

    if (settingsError) {
      logger.error("Failed to fetch settings", settingsError);
      return createErrorResponse(req, "Failed to fetch settings", 500, "FETCH_ERROR");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0
    };

    // Process in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < (settings?.length || 0); i += BATCH_SIZE) {
      const batch = settings!.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (setting) => {
          try {
            results.processed++;

            // Check if already sent today
            const { data: existingLog } = await supabase
              .from("daily_digest_logs")
              .select("id")
              .eq("user_id", setting.user_id)
              .eq("digest_date", todayStr)
              .eq("email_sent", true)
              .single();

            if (existingLog) {
              results.skipped++;
              return;
            }

            // Get user profile
            const { data: profile } = await supabase
              .from("profiles")
              .select("email, display_name")
              .eq("user_id", setting.user_id)
              .single();

            if (!profile?.email) {
              results.skipped++;
              return;
            }

            // Aggregate today's stats
            const { data: logs } = await supabase
              .from("followup_logs")
              .select("action")
              .eq("user_id", setting.user_id)
              .gte("created_at", today.toISOString());

            const sentCount = logs?.filter(l => l.action === "sent" || l.action === "auto_sent").length || 0;
            const replyCount = logs?.filter(l => l.action === "replied").length || 0;
            const generatedCount = logs?.filter(l => l.action === "generated").length || 0;

            // Calculate reply rate
            const replyRate = sentCount > 0 ? Math.round((replyCount / sentCount) * 100) : 0;

            // Send email
            const emailSent = await sendDigestEmail(
              profile.email,
              profile.display_name || "Replify AI User",
              { sentCount, replyCount, generatedCount, replyRate }
            );

            // Log result
            await supabase.from("daily_digest_logs").insert({
              user_id: setting.user_id,
              digest_date: todayStr,
              sent_count: sentCount,
              reply_count: replyCount,
              email_sent: emailSent,
              email_sent_at: emailSent ? new Date().toISOString() : null
            });

            if (emailSent) {
              results.sent++;
              logger.info("Digest sent", { userId: setting.user_id, email: profile.email });
            } else {
              results.failed++;
            }

          } catch (userError) {
            logger.error(`Failed to process user ${setting.user_id}`, userError as Error);
            results.failed++;
          }
        })
      );
    }

    logger.info("Daily digest completed", { executionId, ...results });

    return createCORSResponse(
      req,
      JSON.stringify({
        executionId,
        ...results,
        executionTimeMs: logger.getExecutionTime()
      }),
      200
    );

  } catch (error) {
    logger.error("Daily digest failed", error as Error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});

async function sendDigestEmail(
  to: string,
  name: string,
  stats: { sentCount: number; replyCount: number; generatedCount: number; replyRate: number }
): Promise<boolean> {
  try {
    const subject = `Your Replify AI Daily Digest - ${stats.sentCount} follow-ups sent`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Replify AI Daily Digest</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat { text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-number { font-size: 32px; font-weight: bold; color: #667eea; }
    .stat-label { font-size: 14px; color: #6b7280; margin-top: 5px; }
    .cta { text-align: center; margin-top: 30px; }
    .cta a { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Replify AI</h1>
      <p>Your Daily Digest</p>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>Here's what happened with your follow-ups today:</p>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-number">${stats.sentCount}</div>
          <div class="stat-label">Follow-ups Sent</div>
        </div>
        <div class="stat">
          <div class="stat-number">${stats.replyCount}</div>
          <div class="stat-label">Replies Received</div>
        </div>
        <div class="stat">
          <div class="stat-number">${stats.replyRate}%</div>
          <div class="stat-label">Reply Rate</div>
        </div>
      </div>
      
      <div class="cta">
        <a href="${Deno.env.get("FRONTEND_URL")}/dashboard">View Dashboard</a>
      </div>
      
      <div class="footer">
        <p>You're receiving this because you have daily digest enabled.</p>
        <p><a href="${Deno.env.get("FRONTEND_URL")}/settings">Manage preferences</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Hi ${name},

Your Replify AI Daily Digest:

- Follow-ups Sent: ${stats.sentCount}
- Replies Received: ${stats.replyCount}
- Reply Rate: ${stats.replyRate}%

View your dashboard: ${Deno.env.get("FRONTEND_URL")}/dashboard

Manage preferences: ${Deno.env.get("FRONTEND_URL")}/settings`;

    // Use Brevo if available, otherwise log for now
    if (Deno.env.get("BREVO_API_KEY")) {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": Deno.env.get("BREVO_API_KEY")!
        },
        body: JSON.stringify({
          sender: { email: "noreply@zzyraai.com", name: "ZzyraAI" },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text
        })
      });

      return response.ok;
    }

    // Log for development
    console.log(`[DIGEST EMAIL] To: ${to}, Subject: ${subject}`);
    console.log(text);
    return true;

  } catch (error) {
    console.error("Failed to send digest email:", error);
    return false;
  }
}
