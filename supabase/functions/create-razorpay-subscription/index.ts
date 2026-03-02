// =========================================================
// REPLIFY AI - Create Razorpay Subscription (India)
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";
import { getPaymentProvider, RAZORPAY_PLAN_PRICING, type PlanType } from "../_shared/billing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const rateLimitMiddleware = createRateLimitMiddleware({ requestsPerMinute: 10, requestsPerHour: 100 });

Deno.serve(async (req) => {
  const logger = createLogger("create-razorpay-subscription", req);
  
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limiting
    const { allowed, headers } = await rateLimitMiddleware(req);
    if (!allowed) {
      logAbuseAttempt("create-razorpay-subscription", "/functions/create-razorpay-subscription", req.headers.get("user-agent"));
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

    // Verify this is an Indian user
    const country = profile.billing_country || "IN";
    const provider = getPaymentProvider(country);
    
    if (provider !== "razorpay") {
      return createErrorResponse(req, "Razorpay is only available for Indian users", 400, "INVALID_PROVIDER");
    }

    // Get pricing
    const pricing = RAZORPAY_PLAN_PRICING[planType];
    const amount = billingCycle === "yearly" ? pricing.yearly : pricing.monthly;

    // Create or get Razorpay customer
    let customerId = profile.provider_customer_id;
    
    if (!customerId) {
      const customerResponse = await fetch("https://api.razorpay.com/v1/customers", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: profile.display_name || profile.email,
          email: profile.email,
          notes: {
            user_id: user.id,
            replify_user: true
          }
        })
      });

      if (!customerResponse.ok) {
        const errorData = await customerResponse.json();
        logger.error("Failed to create Razorpay customer", new Error(JSON.stringify(errorData)));
        return createErrorResponse(req, "Failed to create customer", 500, "CUSTOMER_ERROR");
      }

      const customer = await customerResponse.json();
      customerId = customer.id;

      // Update profile with customer ID
      await supabase
        .from("profiles")
        .update({ 
          provider_customer_id: customerId,
          payment_provider: "razorpay",
          billing_country: country
        })
        .eq("user_id", user.id);
    }

    // Create subscription
    const planId = billingCycle === "yearly" 
      ? Deno.env.get(`RAZORPAY_PLAN_${planType.toUpperCase()}_YEARLY`)
      : Deno.env.get(`RAZORPAY_PLAN_${planType.toUpperCase()}_MONTHLY`);

    if (!planId) {
      return createErrorResponse(req, "Plan configuration error", 500, "CONFIG_ERROR");
    }

    const subscriptionResponse = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        plan_id: planId,
        customer_id: customerId,
        total_count: billingCycle === "yearly" ? 1 : 12,
        quantity: 1,
        customer_notify: 1,
        notes: {
          user_id: user.id,
          plan_type: planType,
          billing_cycle: billingCycle
        }
      })
    });

    if (!subscriptionResponse.ok) {
      const errorData = await subscriptionResponse.json();
      logger.error("Failed to create Razorpay subscription", new Error(JSON.stringify(errorData)));
      return createErrorResponse(req, "Failed to create subscription", 500, "SUBSCRIPTION_ERROR");
    }

    const subscription = await subscriptionResponse.json();

    // Update profile with subscription ID
    await supabase
      .from("profiles")
      .update({ 
        provider_subscription_id: subscription.id
      })
      .eq("user_id", user.id);

    logger.info("Razorpay subscription created", { 
      subscriptionId: subscription.id, 
      planType, 
      billingCycle 
    });

    return createCORSResponse(
      req,
      JSON.stringify({
        subscriptionId: subscription.id,
        shortUrl: subscription.short_url,
        status: subscription.status,
        amount: amount,
        currency: pricing.currency
      }),
      200,
      { "Content-Type": "application/json", ...headers }
    );

  } catch (error) {
    logger.error("Create Razorpay subscription failed", error as Error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});
