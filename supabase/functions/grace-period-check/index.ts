import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

console.log("Grace period check function initialized");

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return createErrorResponse(req, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  try {
    console.log("Starting grace period check...");
    
    const { data: usersInGracePeriod, error } = await supabase
      .from('profiles')
      .select('id, email, subscription_status, grace_period_end')
      .lt('grace_period_end', new Date().toISOString())
      .in('subscription_status', ['grace_period'])
      .is('deleted_at', null);

    if (error) {
      console.error("Error fetching users in grace period:", error);
      return createErrorResponse(req, "Failed to fetch users in grace period", 500, "FETCH_ERROR");
    }

    console.log(`Found ${usersInGracePeriod?.length || 0} users whose grace period has ended`);

    if (usersInGracePeriod && usersInGracePeriod.length > 0) {
      for (const user of usersInGracePeriod) {
        // Update user's subscription status to inactive
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'inactive',
            grace_period_end: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`Error updating user ${user.id}:`, updateError);
        } else {
          console.log(`Successfully updated user ${user.id} subscription status to inactive`);
          
          // Send email notification about subscription deactivation
          await sendDeactivationNotification(user.email);
        }
      }
    }

    return createCORSResponse(
      req,
      JSON.stringify({
        message: `Grace period check completed. Processed ${usersInGracePeriod?.length || 0} users.`,
        timestamp: new Date().toISOString(),
      }),
      200
    );
  } catch (error) {
    console.error("Unexpected error in grace period check:", error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});

async function sendDeactivationNotification(email: string) {
  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      return;
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        "sender": {
          "name": "ReplyNudge AI",
          "email": "noreply@zzyraai.com"
        },
        "to": [
          {
            "email": email
          }
        ],
        "subject": "Your Subscription Has Been Deactivated",
        "htmlContent": `
          <html>
            <body>
              <h2>Your Subscription Has Been Deactivated</h2>
              <p>Hello,</p>
              <p>Your subscription to ReplyNudge AI has been deactivated as your grace period has ended.</p>
              <p>If you'd like to continue using our services, please visit our pricing page to subscribe again.</p>
              <p><a href="https://zzyraai.com/pricing">Subscribe Now</a></p>
              <p>Thank you for using ReplyNudge AI.</p>
            </body>
          </html>
        `
      })
    });

    if (!response.ok) {
      console.error("Error sending deactivation notification:", await response.text());
    } else {
      console.log(`Deactivation notification sent to ${email}`);
    }
  } catch (error) {
    console.error("Error in sending deactivation notification:", error);
  }
}