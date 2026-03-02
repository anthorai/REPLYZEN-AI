// =========================================================
// REPLIFY AI - Send Followup (HARDENED)
// Section 10: Reply Detection Engine
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { TokenEncryption } from "../_shared/encryption.ts";
import { PlanEnforcer } from "../_shared/plan-rules.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const rateLimitMiddleware = createRateLimitMiddleware({ requestsPerMinute: 30, requestsPerHour: 300 });

Deno.serve(async (req) => {
  const logger = createLogger("send-followup", req);
  
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  // Declare headers outside try block so it's available in catch
  let headers: Record<string, string> = {};

  try {
    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(req);
    headers = rateLimitResult.headers;
    if (!rateLimitResult.allowed) {
      logAbuseAttempt("send-followup", "/functions/send-followup", req.headers.get("user-agent"));
      return createErrorResponse(req, "Rate limit exceeded", 429, "RATE_LIMITED", headers);
    }

    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return createErrorResponse(req, "Unauthorized", 401, "UNAUTHORIZED", headers);
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Decode JWT payload to extract user ID
    // Note: With verify_jwt = true in config.toml, the gateway already validates the JWT
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
      if (!userId) {
        throw new Error("JWT missing sub claim");
      }
    } catch (e) {
      console.error("[send-followup] Failed to decode JWT:", e);
      return createErrorResponse(req, "Invalid JWT format", 401, "UNAUTHORIZED", headers);
    }

    logger.setUserId(userId);

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .single();

    // Check plan limits
    const planCheck = await PlanEnforcer.checkFollowupLimit(
      supabase,
      userId,
      profile?.plan || "free"
    );

    if (!planCheck.allowed) {
      return createErrorResponse(req, planCheck.reason || "Plan limit reached", 403, "PLAN_LIMIT", headers);
    }

    // Parse request body
    const { suggestionId, editedText } = await req.json();

    if (!suggestionId) {
      return createErrorResponse(req, "Missing suggestionId", 400, "MISSING_PARAMS");
    }

    // Get suggestion with thread info
    const { data: suggestion, error: suggestionError } = await supabase
      .from("followup_suggestions")
      .select(`
        *,
        email_threads:thread_id (
          thread_id,
          user_id
        )
      `)
      .eq("id", suggestionId)
      .eq("user_id", userId)
      .single();

    if (suggestionError || !suggestion) {
      return createErrorResponse(req, "Suggestion not found", 404, "NOT_FOUND");
    }

    if (suggestion.status === "sent") {
      return createErrorResponse(req, "Followup already sent", 400, "ALREADY_SENT");
    }

    // Get email account
    const { data: account } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!account) {
      return createErrorResponse(req, "No email account connected", 400, "NO_ACCOUNT", headers);
    }

    // Decrypt token
    let accessToken: string;
    try {
      accessToken = await TokenEncryption.decryptToken(account.access_token, account.access_token_iv);
    } catch (decryptError) {
      logger.error("Token decryption failed", decryptError as Error);
      return createErrorResponse(req, "Authentication error", 500, "TOKEN_ERROR");
    }

    // Fetch thread from Gmail to get recipient
    const threadResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${suggestion.email_threads.thread_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!threadResponse.ok) {
      return createErrorResponse(req, "Failed to fetch thread", 500, "GMAIL_ERROR");
    }

    const thread = await threadResponse.json();
    const firstMessage = thread.messages[0];
    const subject = firstMessage?.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "";
    const to = firstMessage?.payload?.headers?.find((h: any) => h.name === "To")?.value || "";

    // Build email
    const emailBody = editedText || suggestion.generated_text;
    const email = [
      `To: ${to}`,
      `Subject: Re: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      emailBody
    ].join("\n");

    const encodedEmail = btoa(email).replace(/\+/g, "-").replace(/\//g, "_");

    // Send via Gmail API
    const sendResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          raw: encodedEmail,
          threadId: suggestion.email_threads.thread_id
        })
      }
    );

    if (!sendResponse.ok) {
      const errorData = await sendResponse.json();
      logger.error("Failed to send email", new Error(JSON.stringify(errorData)));
      
      // Log failure
      await supabase.from("followup_logs").insert({
        user_id: userId,
        suggestion_id: suggestionId,
        thread_id: suggestion.thread_id,
        action: "failed",
        details: { error: errorData }
      });

      return createErrorResponse(req, "Failed to send email", 500, "SEND_ERROR", headers);
    }

    const sentMessage = await sendResponse.json();

    // Update suggestion status
    await supabase
      .from("followup_suggestions")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        ...(editedText && { generated_text: editedText })
      })
      .eq("id", suggestionId);

    // Log send
    await supabase.from("followup_logs").insert({
      user_id: userId,
      suggestion_id: suggestionId,
      thread_id: suggestion.thread_id,
      action: editedText ? "edited" : "sent",
      details: { edited: !!editedText, gmailMessageId: sentMessage.id }
    });

    // Update analytics
    await supabase.rpc("aggregate_weekly_analytics", { user_uuid: userId });

    logger.info("Followup sent", { suggestionId, edited: !!editedText });

    return createCORSResponse(
      req,
      JSON.stringify({ success: true, messageId: sentMessage.id }),
      200,
      { "Content-Type": "application/json", ...headers }
    );

  } catch (error) {
    logger.error("Send followup failed", error as Error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});
