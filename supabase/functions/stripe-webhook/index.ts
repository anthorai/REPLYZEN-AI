// =========================================================
// REPLIFY AI - Stripe Webhook Handler (HARDENED)
// Section 3: Stripe Security Hardening
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  const logger = createLogger("stripe-webhook", req);
  
  // Handle CORS
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  const signature = req.headers.get("stripe-signature");
  
  if (!signature) {
    logger.security("Missing Stripe signature", { 
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent")
    });
    return createErrorResponse(req, "Missing signature", 400, "MISSING_SIGNATURE");
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    logger.error("STRIPE_WEBHOOK_SECRET not configured");
    return createErrorResponse(req, "Webhook secret not configured", 500, "CONFIG_ERROR");
  }

  try {
    // Get raw body
    const rawBody = await req.text();
    
    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.security("Invalid Stripe signature", {
        error: err.message,
        ip: req.headers.get("x-forwarded-for")
      });
      return createErrorResponse(req, `Invalid signature: ${err.message}`, 400, "INVALID_SIGNATURE");
    }

    logger.info("Webhook received", { eventType: event.type, eventId: event.id });

    // Idempotency check
    const { data: existingEvent } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("event_id", event.id)
      .single();

    if (existingEvent) {
      logger.info("Duplicate webhook event, skipping", { eventId: event.id });
      return createCORSResponse(req, JSON.stringify({ received: true, duplicate: true }), 200);
    }

    // Store webhook event
    await supabase.from("webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
      payload: event,
      processed_at: new Date().toISOString()
    });

    // Process event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, logger);
        break;
      }
      
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice, logger);
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, logger);
        break;
      }
      
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription, logger);
        break;
      }
      
      default: {
        logger.info("Unhandled event type", { eventType: event.type });
      }
    }

    return createCORSResponse(req, JSON.stringify({ received: true }), 200);

  } catch (error) {
    logger.error("Webhook processing error", error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, logger: any) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const userId = session.metadata?.user_id;

  if (!userId) {
    logger.error("No user_id in session metadata", null, { sessionId: session.id });
    return;
  }

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  
  // Determine plan from price ID
  let plan = "free";
  if (priceId === Deno.env.get("STRIPE_PRICE_PRO")) plan = "pro";
  else if (priceId === Deno.env.get("STRIPE_PRICE_BUSINESS")) plan = "business";

  // Update user profile
  const { error } = await supabase
    .from("profiles")
    .update({
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan_status: "active",
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  if (error) {
    logger.error("Failed to update user plan", null, { userId, error });
    throw error;
  }

  logger.info("Plan upgraded", { userId, plan, subscriptionId });
}

async function handlePaymentFailed(invoice: Stripe.Invoice, logger: any) {
  const customerId = invoice.customer as string;
  
  // Find user by customer ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile) {
    logger.warn("No profile found for customer", { customerId });
    return;
  }

  // Update plan status
  await supabase
    .from("profiles")
    .update({
      plan_status: "past_due",
      updated_at: new Date().toISOString()
    })
    .eq("user_id", profile.user_id);

  logger.warn("Payment failed, plan set to past_due", { 
    userId: profile.user_id, 
    customerId 
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, logger: any) {
  const customerId = subscription.customer as string;
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile) {
    logger.warn("No profile found for customer", { customerId });
    return;
  }

  // Downgrade to free and disable auto-send
  await supabase
    .from("profiles")
    .update({
      plan: "free",
      plan_status: "cancelled",
      stripe_subscription_id: null,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", profile.user_id);

  // Disable auto-send in settings
  await supabase
    .from("user_settings")
    .update({ auto_scan_enabled: false })
    .eq("user_id", profile.user_id);

  logger.info("Subscription cancelled, downgraded to free", { 
    userId: profile.user_id 
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, logger: any) {
  const customerId = subscription.customer as string;
  const status = subscription.status;
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!profile) return;

  // Update plan status based on subscription status
  let planStatus = "active";
  if (status === "past_due") planStatus = "past_due";
  else if (status === "canceled") planStatus = "cancelled";
  else if (status === "unpaid") planStatus = "unpaid";

  await supabase
    .from("profiles")
    .update({
      plan_status: planStatus,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", profile.user_id);

  logger.info("Subscription status updated", { 
    userId: profile.user_id, 
    status: planStatus 
  });
}
