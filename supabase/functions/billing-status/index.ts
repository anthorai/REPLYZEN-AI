// =========================================================
// REPLIFY AI - Billing Status
// Section 13: Subscription Status Query
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";
import { getDaysUntilExpiration, formatSubscriptionStatus, PLAN_LIMITS } from "../_shared/billing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const rateLimitMiddleware = createRateLimitMiddleware({ requestsPerMinute: 60, requestsPerHour: 1000 });

interface BillingStatusResponse {
  subscription_status: string;
  plan_type: string;
  is_active: boolean;
  current_period_end: string | null;
  days_until_expiration: number | null;
  cancel_at_period_end: boolean;
  payment_provider: string | null;
  limits: {
    followups: number;
    accounts: number;
    auto_send: boolean;
  };
}

Deno.serve(async (req) => {
  const logger = createLogger("billing-status", req);
  const requestId = crypto.randomUUID();
  
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limiting
    const { allowed, headers } = await rateLimitMiddleware(req);
    if (!allowed) {
      logAbuseAttempt("billing-status", "/functions/billing-status", req.headers.get("user-agent"));
      return createErrorResponse(req, "Rate limit exceeded", 429, "RATE_LIMITED", headers);
    }

    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return createErrorResponse(req, "Unauthorized", 401, "UNAUTHORIZED", headers);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.security("Invalid authentication", { requestId });
      return createErrorResponse(req, "Invalid authentication", 401, "UNAUTHORIZED", headers);
    }

    logger.setUserId(user.id);

    // Get user profile with billing info
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_status, plan_type, current_period_end, cancel_at_period_end, payment_provider, grace_period_until")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      logger.error("Profile not found", profileError as Error, { requestId, userId: user.id });
      return createErrorResponse(req, "Profile not found", 404, "NOT_FOUND", headers);
    }

    // Calculate days until expiration
    const daysUntilExpiration = getDaysUntilExpiration({
      current_period_end: profile.current_period_end,
      subscription_status: profile.subscription_status
    } as any);

    // Check if subscription is truly active
    let isActive = profile.subscription_status === "active";
    
    if (isActive && profile.current_period_end) {
      const endDate = new Date(profile.current_period_end);
      if (endDate < new Date()) {
        isActive = false;
      }
    }

    // Check grace period
    if (!isActive && profile.grace_period_until) {
      const graceEnd = new Date(profile.grace_period_until);
      if (graceEnd > new Date()) {
        isActive = true; // Still active during grace period
      }
    }

    const response: BillingStatusResponse = {
      subscription_status: profile.subscription_status || "free",
      plan_type: profile.plan_type || "free",
      is_active: isActive,
      current_period_end: profile.current_period_end,
      days_until_expiration: daysUntilExpiration,
      cancel_at_period_end: profile.cancel_at_period_end || false,
      payment_provider: profile.payment_provider,
      limits: {
        followups: PLAN_LIMITS[profile.plan_type || "free"].followups,
        accounts: PLAN_LIMITS[profile.plan_type || "free"].accounts,
        auto_send: PLAN_LIMITS[profile.plan_type || "free"].autoSend
      }
    };

    logger.info("Billing status retrieved", { requestId, userId: user.id, status: response.subscription_status });

    return createCORSResponse(
      req,
      JSON.stringify(response),
      200,
      { "Content-Type": "application/json", "X-Request-ID": requestId, ...headers }
    );

  } catch (error) {
    const err = error as Error;
    logger.error("Billing status query failed", err, { requestId });
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR", { "X-Request-ID": requestId });
  }
});
