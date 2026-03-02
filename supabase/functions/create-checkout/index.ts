// =========================================================
// REPLIFY AI - Create Checkout (Unified Payment Flow)
// Section 12: Provider-Agnostic Checkout Initiation
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";
import { 
  getPaymentProvider, 
  detectCountryFromIP, 
  PLAN_PRICING, 
  RAZORPAY_PLAN_PRICING,
  type PlanType 
} from "../_shared/billing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const rateLimitMiddleware = createRateLimitMiddleware({ requestsPerMinute: 10, requestsPerHour: 100 });

interface CheckoutRequest {
  planType: PlanType;
  billingCycle?: "monthly" | "yearly";
}

interface CheckoutResponse {
  provider: "razorpay" | "paddle";
  checkout_url: string;
  subscription_id?: string;
}

Deno.serve(async (req) => {
  const logger = createLogger("create-checkout", req);
  const requestId = crypto.randomUUID();
  
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limiting
    const { allowed, headers } = await rateLimitMiddleware(req);
    if (!allowed) {
      logAbuseAttempt("create-checkout", "/functions/create-checkout", req.headers.get("user-agent"));
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
    logger.info("Checkout initiated", { requestId, userId: user.id });

    // Parse request body
    const body: CheckoutRequest = await req.json();
    const { planType, billingCycle = "monthly" } = body;

    // Validate plan type
    if (!planType || !["pro", "business"].includes(planType)) {
      return createErrorResponse(req, "Invalid plan type. Must be 'pro' or 'business'", 400, "INVALID_PLAN", headers);
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, billing_country, display_name, payment_provider, provider_customer_id, subscription_status, plan_type")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      logger.error("Profile not found", profileError as Error, { requestId, userId: user.id });
      return createErrorResponse(req, "Profile not found", 404, "NOT_FOUND", headers);
    }

    // Check if user already has an active subscription
    if (profile.subscription_status === "active" && profile.plan_type !== "free") {
      return createErrorResponse(req, "You already have an active subscription", 400, "ALREADY_SUBSCRIBED", headers);
    }

    // Detect country and provider
    let country = profile.billing_country;
    
    if (!country) {
      // Try to detect from IP
      const forwardedFor = req.headers.get("x-forwarded-for");
      const clientIP = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
      
      if (clientIP && clientIP !== "unknown") {
        country = await detectCountryFromIP(clientIP);
        logger.info("Country detected from IP", { requestId, country, clientIP });
      } else {
        country = "US"; // Default to US
      }
    }

    const provider = getPaymentProvider(country);
    logger.info("Payment provider selected", { requestId, provider, country });

    // Store selected provider in profile
    await supabase
      .from("profiles")
      .update({ 
        payment_provider: provider,
        billing_country: country,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    let checkoutResponse: CheckoutResponse;

    // Route to appropriate provider
    if (provider === "razorpay") {
      checkoutResponse = await createRazorpayCheckout(user.id, profile, planType, billingCycle, logger, requestId);
    } else {
      checkoutResponse = await createPaddleCheckout(user.id, profile, planType, billingCycle, logger, requestId);
    }

    logger.info("Checkout session created", { 
      requestId, 
      provider: checkoutResponse.provider, 
      userId: user.id,
      planType 
    });

    return createCORSResponse(
      req,
      JSON.stringify(checkoutResponse),
      200,
      { "Content-Type": "application/json", "X-Request-ID": requestId, ...headers }
    );

  } catch (error) {
    const err = error as Error;
    logger.error("Create checkout failed", err, { requestId });
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR", { "X-Request-ID": requestId });
  }
});

async function createRazorpayCheckout(
  userId: string,
  profile: any,
  planType: PlanType,
  billingCycle: "monthly" | "yearly",
  logger: any,
  requestId: string
): Promise<CheckoutResponse> {
  const pricing = RAZORPAY_PLAN_PRICING[planType];

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
          user_id: userId,
          replify_user: true,
          request_id: requestId
        }
      })
    });

    if (!customerResponse.ok) {
      const errorData = await customerResponse.json();
      logger.error("Failed to create Razorpay customer", new Error(JSON.stringify(errorData)), { requestId });
      throw new Error("Failed to create customer");
    }

    const customer = await customerResponse.json();
    customerId = customer.id;

    // Update profile with customer ID
    await supabase
      .from("profiles")
      .update({ 
        provider_customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);
  }

  // Get plan ID from environment
  const planId = billingCycle === "yearly" 
    ? Deno.env.get(`RAZORPAY_PLAN_${planType.toUpperCase()}_YEARLY`)
    : Deno.env.get(`RAZORPAY_PLAN_${planType.toUpperCase()}_MONTHLY`);

  if (!planId) {
    throw new Error(`Razorpay plan ID not configured for ${planType} ${billingCycle}`);
  }

  // Create subscription
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
        user_id: userId,
        plan_type: planType,
        billing_cycle: billingCycle,
        request_id: requestId
      }
    })
  });

  if (!subscriptionResponse.ok) {
    const errorData = await subscriptionResponse.json();
    logger.error("Failed to create Razorpay subscription", new Error(JSON.stringify(errorData)), { requestId });
    throw new Error("Failed to create subscription");
  }

  const subscription = await subscriptionResponse.json();

  // Store subscription ID
  await supabase
    .from("profiles")
    .update({ 
      provider_subscription_id: subscription.id,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  return {
    provider: "razorpay",
    checkout_url: subscription.short_url,
    subscription_id: subscription.id
  };
}

async function createPaddleCheckout(
  userId: string,
  profile: any,
  planType: PlanType,
  billingCycle: "monthly" | "yearly",
  logger: any,
  requestId: string
): Promise<CheckoutResponse> {
  const pricing = PLAN_PRICING[planType];

  // Get Paddle price ID
  const priceId = billingCycle === "yearly" 
    ? Deno.env.get(`PADDLE_PRICE_${planType.toUpperCase()}_YEARLY`)
    : Deno.env.get(`PADDLE_PRICE_${planType.toUpperCase()}_MONTHLY`);

  if (!priceId) {
    throw new Error(`Paddle price ID not configured for ${planType} ${billingCycle}`);
  }

  // Create Paddle checkout session via API
  const checkoutResponse = await fetch("https://api.paddle.com/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PADDLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      items: [{
        price_id: priceId,
        quantity: 1
      }],
      customer: {
        email: profile.email,
        name: profile.display_name || profile.email
      },
      custom_data: {
        user_id: userId,
        plan_type: planType,
        billing_cycle: billingCycle,
        request_id: requestId
      },
      success_url: `${Deno.env.get("FRONTEND_URL")}/billing/success?provider=paddle`,
      cancel_url: `${Deno.env.get("FRONTEND_URL")}/pricing`
    })
  });

  if (!checkoutResponse.ok) {
    const errorData = await checkoutResponse.json();
    logger.error("Failed to create Paddle checkout", new Error(JSON.stringify(errorData)), { requestId });
    
    // Fallback to Paddle hosted checkout URL
    return {
      provider: "paddle",
      checkout_url: `https://buy.paddle.com/checkout/${priceId}?customer_email=${encodeURIComponent(profile.email)}&passthrough=${encodeURIComponent(JSON.stringify({ user_id: userId, plan_type: planType }))}`
    };
  }

  const checkoutData = await checkoutResponse.json();

  return {
    provider: "paddle",
    checkout_url: checkoutData.data?.url || `https://buy.paddle.com/checkout/${priceId}`,
    subscription_id: checkoutData.data?.id
  };
}
