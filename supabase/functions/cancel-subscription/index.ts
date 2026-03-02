// =========================================================
// REPLIFY AI - Cancel Subscription Endpoint
// Section 11: Subscription Cancellation
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { getUserBillingProvider } from "../_shared/billing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Payment gateway clients
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
const PADDLE_VENDOR_ID = Deno.env.get("PADDLE_VENDOR_ID")!;
const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  const logger = createLogger("cancel-subscription", req);
  
  // Handle CORS
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return createErrorResponse(req, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  try {
    // Get user session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(req, "Missing authorization header", 401, "UNAUTHORIZED");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return createErrorResponse(req, "Invalid or expired session", 401, "UNAUTHORIZED");
    }

    // Get user profile with billing information
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`
        payment_provider,
        provider_subscription_id,
        provider_customer_id
      `)
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      logger.error("Error fetching user profile", profileError);
      return createErrorResponse(req, "Failed to fetch user profile", 500, "FETCH_ERROR");
    }

    if (!profile || !profile.provider_subscription_id) {
      logger.error("No active subscription found for user", new Error("No subscription"), { userId: user.id });
      return createErrorResponse(req, "No active subscription found", 400, "NO_SUBSCRIPTION");
    }

    // Cancel subscription at the payment provider
    let cancellationResult;
    
    if (profile.payment_provider === "razorpay") {
      cancellationResult = await cancelRazorpaySubscription(
        profile.provider_subscription_id,
        logger
      );
    } else if (profile.payment_provider === "paddle") {
      cancellationResult = await cancelPaddleSubscription(
        profile.provider_subscription_id,
        logger
      );
    } else {
      logger.error("Unknown payment provider", new Error("Invalid provider"), { 
        userId: user.id, 
        provider: profile.payment_provider 
      });
      return createErrorResponse(req, "Unknown payment provider", 500, "INVALID_PROVIDER");
    }

    if (!cancellationResult.success) {
      logger.error("Failed to cancel subscription at provider", new Error(cancellationResult.error), { 
        userId: user.id, 
        provider: profile.payment_provider,
        error: cancellationResult.error
      });
      return createErrorResponse(req, "Failed to cancel subscription", 500, "CANCEL_FAILED");
    }

    // Update local subscription state
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        cancel_at_period_end: true,
        subscription_status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (updateError) {
      logger.error("Failed to update local subscription state", updateError, { userId: user.id });
      return createErrorResponse(req, "Failed to update subscription status", 500, "UPDATE_ERROR");
    }

    logger.info("Subscription cancelled successfully", { 
      userId: user.id, 
      provider: profile.payment_provider,
      subscriptionId: profile.provider_subscription_id
    });

    return createCORSResponse(req, JSON.stringify({ 
      success: true,
      message: "Subscription cancelled successfully",
      subscriptionId: profile.provider_subscription_id
    }), 200);

  } catch (error) {
    logger.error("Subscription cancellation error", error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});

async function cancelRazorpaySubscription(subscriptionId: string, logger: any): Promise<{success: boolean, error?: string}> {
  try {
    // Construct basic auth header
    const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    
    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error("Razorpay cancellation failed", new Error(JSON.stringify(errorData)), { 
        subscriptionId, 
        error: errorData 
      });
      return { success: false, error: JSON.stringify(errorData) };
    }

    return { success: true };
  } catch (error) {
    logger.error("Error cancelling Razorpay subscription", error, { subscriptionId });
    return { success: false, error: error.message };
  }
}

async function cancelPaddleSubscription(subscriptionId: string, logger: any): Promise<{success: boolean, error?: string}> {
  try {
    // Note: Paddle Classic API doesn't have a direct subscription cancellation endpoint
    // In practice, you'd likely use Paddle's update subscription endpoint to set it to cancel at period end
    // This is a simplified implementation
    
    const response = await fetch(`https://vendors.paddle.com/api/2.0/subscription/users_cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        vendor_id: PADDLE_VENDOR_ID,
        vendor_auth_code: PADDLE_API_KEY,
        subscription_id: subscriptionId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error("Paddle cancellation failed", new Error(JSON.stringify(errorData)), { 
        subscriptionId, 
        error: errorData 
      });
      return { success: false, error: JSON.stringify(errorData) };
    }

    return { success: true };
  } catch (error) {
    logger.error("Error cancelling Paddle subscription", error, { subscriptionId });
    return { success: false, error: error.message };
  }
}