// =========================================================
// REPLIFY AI - Create Paddle Subscription (International)
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";
import { getPaymentProvider, PLAN_PRICING, type PlanType } from "../_shared/billing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const rateLimitMiddleware = createRateLimitMiddleware({ requestsPerMinute: 10, requestsPerHour: 100 });

Deno.serve(async (req) => {
  const logger = createLogger("create-paddle-subscription", req);
  
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limiting
    const { allowed, headers } = await rateLimitMiddleware(req);
    if (!allowed) {
      logAbuseAttempt("create-paddle-subscription", "/functions/create-paddle-subscription", req.headers.get("user-agent"));
      return createErrorResponse(req, "Rate limit exceeded", 429, "RATE_LIMITED");
    }

    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return createErrorResponse(req, "Unauthorized", 401, "UNAUTHORIZED");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.security("Invalid authentication");
      return createErrorResponse(req, "Invalid authentication", 401, "UNAUTHORIZED");
    }

    logger.setUserId(user.id);

    // Parse request body
    const { planType, billingCycle = "monthly" }: { planType: PlanType; billingCycle?: "monthly" | "yearly" } = await req.json();

    if (!planType || !["pro", "business"].includes(planType)) {
      return createErrorResponse(req, "Invalid plan type", 400, "INVALID_PLAN");
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, billing_country, display_name")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return createErrorResponse(req, "Profile not found", 404, "NOT_FOUND");
    }

    // Verify this is an international user
    const country = profile.billing_country || "US";
    const provider = getPaymentProvider(country);
    
    if (provider !== "paddle") {
      return createErrorResponse(req, "Paddle is only available for international users", 400, "INVALID_PROVIDER");
    }

    // Get pricing
    const pricing = PLAN_PRICING[planType];
    const amount = billingCycle === "yearly" ? pricing.yearly : pricing.monthly;

    // Get the correct price ID based on plan type and billing cycle
    const priceId = billingCycle === "yearly" 
      ? Deno.env.get(`PADDLE_PRICE_${planType.toUpperCase()}_YEARLY`)
      : Deno.env.get(`PADDLE_PRICE_${planType.toUpperCase()}_MONTHLY`);

    if (!priceId) {
      return createErrorResponse(req, "Price configuration error", 500, "CONFIG_ERROR");
    }

    // Create Paddle subscription
    // Note: Paddle Classic doesn't have a direct API for creating subscriptions like Razorpay
    // This is a simplified implementation that would typically redirect to Paddle's hosted checkout
    // In practice, you'd likely generate a checkout URL using Paddle's JS SDK on the frontend
    
    // For now, we'll simulate creating a checkout session
    const checkoutData = {
      items: [{
        price_id: priceId,
        quantity: 1
      }],
      customer: {
        email: profile.email,
        name: profile.display_name || profile.email
      },
      custom_data: {
        user_id: user.id,
        plan_type: planType,
        billing_cycle: billingCycle
      },
      success_url: `${Deno.env.get("FRONTEND_URL")}/billing/success`,
      cancel_url: `${Deno.env.get("FRONTEND_URL")}/pricing`
    };

    logger.info("Paddle checkout session prepared", { 
      userId: user.id, 
      planType, 
      billingCycle,
      priceId
    });

    return createCORSResponse(
      req,
      JSON.stringify({
        checkoutUrl: `https://buy.paddle.com/checkout/${priceId}`,
        checkoutData,
        amount: amount,
        currency: pricing.currency
      }),
      200
    );

  } catch (error) {
    logger.error("Create Paddle subscription failed", error as Error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});