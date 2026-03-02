// =========================================================
// REPLIFY AI - Razorpay Webhook Handler (HARDENED)
// Section 11: Razorpay Webhook Security & Processing
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { 
  verifyRazorpaySignature, 
  isEventProcessed, 
  logBillingEvent, 
  updateSubscriptionState,
  PaymentProvider
} from "../_shared/billing.ts";

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  const logger = createLogger("razorpay-webhook", req);
  
  // Handle CORS
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  const signature = req.headers.get("X-Razorpay-Signature");
  
  if (!signature) {
    logger.security("Missing Razorpay signature", { 
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent")
    });
    return createErrorResponse(req, "Missing signature", 400, "MISSING_SIGNATURE");
  }

  if (!RAZORPAY_WEBHOOK_SECRET) {
    logger.error("RAZORPAY_WEBHOOK_SECRET not configured");
    return createErrorResponse(req, "Webhook secret not configured", 500, "CONFIG_ERROR");
  }

  try {
    // Get raw body
    const rawBody = await req.text();
    
    // Verify webhook signature
    const isValidSignature = await verifyRazorpaySignature(
      rawBody, 
      signature, 
      RAZORPAY_WEBHOOK_SECRET
    );
    
    if (!isValidSignature) {
      logger.security("Invalid Razorpay signature", {
        error: "Signature verification failed",
        ip: req.headers.get("x-forwarded-for")
      });
      return createErrorResponse(req, "Invalid signature", 400, "INVALID_SIGNATURE");
    }

    // Parse webhook payload
    const payload = JSON.parse(rawBody);
    const { event, payload: eventPayload } = payload;
    
    logger.info("Valid Razorpay webhook received", { 
      eventType: event, 
      eventId: payload.entity_id 
    });

    // Extract user ID from payload metadata
    let userId: string | undefined;
    
    // Look for user_id in various possible locations in the payload
    if (eventPayload.subscription && eventPayload.subscription.notes) {
      userId = eventPayload.subscription.notes.user_id;
    } else if (eventPayload.payment && eventPayload.payment.notes) {
      userId = eventPayload.payment.notes.user_id;
    } else if (eventPayload.order && eventPayload.order.notes) {
      userId = eventPayload.order.notes.user_id;
    } else if (eventPayload.subscription_issued && eventPayload.subscription_issued.notes) {
      userId = eventPayload.subscription_issued.notes.user_id;
    }

    if (!userId) {
      logger.error("No user_id found in webhook payload", undefined, { 
        eventType: event,
        payload: payload
      });
      return createCORSResponse(req, JSON.stringify({ received: true, error: "No user_id in payload" }), 200);
    }

    // Idempotency check
    const eventId = payload.entity_id || payload.id;
    if (eventId) {
      const isProcessed = await isEventProcessed(supabase, eventId);
      if (isProcessed) {
        logger.info("Duplicate webhook event, skipping", { eventId });
        return createCORSResponse(req, JSON.stringify({ received: true, duplicate: true }), 200);
      }
    }

    // Log webhook event
    await logBillingEvent(supabase, {
      user_id: userId,
      provider: "razorpay" as PaymentProvider,
      event_type: event,
      event_id: eventId || "",
      raw_payload: payload,
      processed: false,
      processed_at: null
    });

    // Process event based on type
    switch (event) {
      case "subscription.activated":
      case "subscription.activated.upi":
      case "subscription.activated.eft":
      case "subscription.activated.card":
      case "subscription.activated.netbanking":
      case "subscription.activated.wallet":
      case "subscription.charged":
      case "subscription.issued":
        await handleSubscriptionActivated(userId, eventPayload, logger);
        break;
        
      case "subscription.cancelled":
        await handleSubscriptionCancelled(userId, eventPayload, logger);
        break;
        
      case "payment.failed":
        await handlePaymentFailed(userId, eventPayload, logger);
        break;
        
      case "subscription.paused":
        await handleSubscriptionPaused(userId, eventPayload, logger);
        break;
        
      case "subscription.resumed":
        await handleSubscriptionResumed(userId, eventPayload, logger);
        break;
        
      case "subscription.expired":
        await handleSubscriptionExpired(userId, eventPayload, logger);
        break;
        
      default:
        logger.info("Unhandled Razorpay event type", { eventType: event });
        break;
    }

    // Mark event as processed
    if (eventId) {
      await supabase
        .from("billing_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq("event_id", eventId);
    }

    return createCORSResponse(req, JSON.stringify({ received: true }), 200);

  } catch (error) {
    logger.error("Razorpay webhook processing error", error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});

async function handleSubscriptionActivated(userId: string, payload: any, logger: any) {
  try {
    const subscription = payload.subscription || payload.subscription_issued;
    
    if (!subscription) {
      logger.error("No subscription data in activated event", { userId });
      return;
    }

    // Determine plan type from subscription
    let planType: "free" | "pro" | "business" = "free";
    if (subscription.plan_id) {
      // You can map plan IDs to plan types here based on your Razorpay plan configuration
      if (subscription.plan_id.includes("pro")) {
        planType = "pro";
      } else if (subscription.plan_id.includes("business") || subscription.plan_id.includes("enterprise")) {
        planType = "business";
      }
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "razorpay",
      "subscription.activated",
      {
        planType,
        periodEnd: new Date(subscription.current_end_time * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        providerCustomerId: subscription.customer_id,
        providerSubscriptionId: subscription.id
      }
    );

    logger.info("Subscription activated", { 
      userId, 
      planType, 
      subscriptionId: subscription.id 
    });
  } catch (error) {
    logger.error("Error handling subscription activation", error, { userId });
    throw error;
  }
}

async function handleSubscriptionCancelled(userId: string, payload: any, logger: any) {
  try {
    const subscription = payload.subscription;
    
    if (!subscription) {
      logger.error("No subscription data in cancelled event", { userId });
      return;
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "razorpay",
      "subscription.cancelled",
      {
        cancelAtPeriodEnd: true
      }
    );

    logger.info("Subscription cancelled", { 
      userId, 
      subscriptionId: subscription.id 
    });
  } catch (error) {
    logger.error("Error handling subscription cancellation", error, { userId });
    throw error;
  }
}

async function handlePaymentFailed(userId: string, payload: any, logger: any) {
  try {
    const payment = payload.payment;
    
    if (!payment) {
      logger.error("No payment data in failed event", { userId });
      return;
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "razorpay",
      "payment.failed",
      {}
    );

    logger.warn("Payment failed", { 
      userId, 
      paymentId: payment.id,
      orderId: payment.order_id
    });
  } catch (error) {
    logger.error("Error handling payment failure", error, { userId });
    throw error;
  }
}

async function handleSubscriptionPaused(userId: string, payload: any, logger: any) {
  try {
    const subscription = payload.subscription;
    
    if (!subscription) {
      logger.error("No subscription data in paused event", { userId });
      return;
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "razorpay",
      "subscription.paused",
      {
        cancelAtPeriodEnd: true
      }
    );

    logger.info("Subscription paused", { 
      userId, 
      subscriptionId: subscription.id 
    });
  } catch (error) {
    logger.error("Error handling subscription pause", error, { userId });
    throw error;
  }
}

async function handleSubscriptionResumed(userId: string, payload: any, logger: any) {
  try {
    const subscription = payload.subscription;
    
    if (!subscription) {
      logger.error("No subscription data in resumed event", { userId });
      return;
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "razorpay",
      "subscription.resumed",
      {
        cancelAtPeriodEnd: false
      }
    );

    logger.info("Subscription resumed", { 
      userId, 
      subscriptionId: subscription.id 
    });
  } catch (error) {
    logger.error("Error handling subscription resume", error, { userId });
    throw error;
  }
}

async function handleSubscriptionExpired(userId: string, payload: any, logger: any) {
  try {
    const subscription = payload.subscription;
    
    if (!subscription) {
      logger.error("No subscription data in expired event", { userId });
      return;
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "razorpay",
      "subscription.expired",
      {
        planType: "free"
      }
    );

    logger.info("Subscription expired", { 
      userId, 
      subscriptionId: subscription.id 
    });
  } catch (error) {
    logger.error("Error handling subscription expiration", error, { userId });
    throw error;
  }
}