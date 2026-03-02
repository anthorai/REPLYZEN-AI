// =========================================================
// REPLIFY AI - Paddle Webhook Handler (HARDENED)
// Section 11: Paddle Webhook Security & Processing
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { 
  verifyPaddleSignature, 
  isEventProcessed, 
  logBillingEvent, 
  updateSubscriptionState,
  PaymentProvider
} from "../_shared/billing.ts";

const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY")!;
const PADDLE_WEBHOOK_SECRET = Deno.env.get("PADDLE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  const logger = createLogger("paddle-webhook", req);
  
  // Handle CORS
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  // Paddle uses a signature header for verification
  const signature = req.headers.get("Paddle-Signature");
  
  if (!signature) {
    logger.security("Missing Paddle signature", { 
      ip: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent")
    });
    return createErrorResponse(req, "Missing signature", 400, "MISSING_SIGNATURE");
  }

  if (!PADDLE_WEBHOOK_SECRET) {
    logger.error("PADDLE_WEBHOOK_SECRET not configured");
    return createErrorResponse(req, "Webhook secret not configured", 500, "CONFIG_ERROR");
  }

  try {
    // Get raw body
    const rawBody = await req.text();
    
    // Verify webhook signature
    const isValidSignature = await verifyPaddleSignature(
      rawBody, 
      signature, 
      PADDLE_WEBHOOK_SECRET
    );
    
    if (!isValidSignature) {
      logger.security("Invalid Paddle signature", {
        error: "Signature verification failed",
        ip: req.headers.get("x-forwarded-for")
      });
      return createErrorResponse(req, "Invalid signature", 400, "INVALID_SIGNATURE");
    }

    // Parse webhook payload
    const payload = JSON.parse(rawBody);
    const { event_type, occurred_at, data } = payload;
    
    logger.info("Valid Paddle webhook received", { 
      eventType: event_type, 
      eventId: data.id 
    });

    // Extract user ID from custom data
    let userId: string | undefined;
    
    // Look for user_id in custom_data (Paddle's way of passing custom data)
    if (data.custom_data && data.custom_data.user_id) {
      userId = data.custom_data.user_id;
    } else if (data.meta && data.meta.user_id) {
      // Some Paddle events put custom data in meta field
      userId = data.meta.user_id;
    }

    if (!userId) {
      logger.error("No user_id found in webhook payload", undefined, { 
        eventType: event_type,
        payload: payload
      });
      return createCORSResponse(req, JSON.stringify({ received: true, error: "No user_id in payload" }), 200);
    }

    // Idempotency check
    const eventId = data.id;
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
      provider: "paddle" as PaymentProvider,
      event_type: event_type,
      event_id: eventId || "",
      raw_payload: payload,
      processed: false,
      processed_at: null
    });

    // Process event based on type
    switch (event_type) {
      case "subscription.created":
      case "subscription.activated":
        await handleSubscriptionCreated(userId, data, logger);
        break;
        
      case "subscription.updated":
        await handleSubscriptionUpdated(userId, data, logger);
        break;
        
      case "subscription.cancelled":
        await handleSubscriptionCancelled(userId, data, logger);
        break;
        
      case "transaction.completed":
        await handleTransactionCompleted(userId, data, logger);
        break;
        
      case "transaction.paid":
        await handleTransactionPaid(userId, data, logger);
        break;
        
      case "subscription.payment_failed":
        await handlePaymentFailed(userId, data, logger);
        break;
        
      case "subscription.past_due":
        await handleSubscriptionPastDue(userId, data, logger);
        break;
        
      default:
        logger.info("Unhandled Paddle event type", { eventType: event_type });
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
    logger.error("Paddle webhook processing error", error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});

async function handleSubscriptionCreated(userId: string, data: any, logger: any) {
  try {
    const subscription = data.new || data;

    if (!subscription) {
      logger.error("No subscription data in created event", { userId });
      return;
    }

    // Determine plan type from subscription
    let planType: "free" | "pro" | "business" = "free";
    if (subscription.pricing_plan && subscription.pricing_plan.id) {
      // Map Paddle plan IDs to plan types based on your configuration
      if (subscription.pricing_plan.id.includes("pro")) {
        planType = "pro";
      } else if (subscription.pricing_plan.id.includes("business") || subscription.pricing_plan.id.includes("enterprise")) {
        planType = "business";
      }
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "paddle",
      "subscription.created",
      {
        planType,
        periodEnd: new Date(subscription.next_billed_at || subscription.current_period_end).toISOString(),
        cancelAtPeriodEnd: subscription.status === "canceled",
        providerCustomerId: subscription.customer_id,
        providerSubscriptionId: subscription.id
      }
    );

    logger.info("Subscription created", { 
      userId, 
      planType, 
      subscriptionId: subscription.id 
    });
  } catch (error) {
    logger.error("Error handling subscription creation", error, { userId });
    throw error;
  }
}

async function handleSubscriptionUpdated(userId: string, data: any, logger: any) {
  try {
    const subscription = data.new || data;
    
    if (!subscription) {
      logger.error("No subscription data in updated event", { userId });
      return;
    }

    // Determine plan type from subscription
    let planType: "free" | "pro" | "business" = "free";
    if (subscription.pricing_plan && subscription.pricing_plan.id) {
      // Map Paddle plan IDs to plan types based on your configuration
      if (subscription.pricing_plan.id.includes("pro")) {
        planType = "pro";
      } else if (subscription.pricing_plan.id.includes("business") || subscription.pricing_plan.id.includes("enterprise")) {
        planType = "business";
      }
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "paddle",
      "subscription.updated",
      {
        planType,
        periodEnd: new Date(subscription.next_billed_at || subscription.current_period_end).toISOString(),
        cancelAtPeriodEnd: subscription.status === "canceled",
        providerCustomerId: subscription.customer_id,
        providerSubscriptionId: subscription.id
      }
    );

    logger.info("Subscription updated", { 
      userId, 
      planType, 
      subscriptionId: subscription.id 
    });
  } catch (error) {
    logger.error("Error handling subscription update", error, { userId });
    throw error;
  }
}

async function handleSubscriptionCancelled(userId: string, data: any, logger: any) {
  try {
    const subscription = data.new || data;
    
    if (!subscription) {
      logger.error("No subscription data in cancelled event", { userId });
      return;
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "paddle",
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

async function handleTransactionCompleted(userId: string, data: any, logger: any) {
  try {
    const transaction = data.new || data;
    
    if (!transaction) {
      logger.error("No transaction data in completed event", { userId });
      return;
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "paddle",
      "transaction.completed",
      {}
    );

    logger.info("Transaction completed", { 
      userId, 
      transactionId: transaction.id 
    });
  } catch (error) {
    logger.error("Error handling transaction completion", error, { userId });
    throw error;
  }
}

async function handleTransactionPaid(userId: string, data: any, logger: any) {
  try {
    const transaction = data.new || data;
    
    if (!transaction) {
      logger.error("No transaction data in paid event", { userId });
      return;
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "paddle",
      "transaction.paid",
      {}
    );

    logger.info("Transaction paid", { 
      userId, 
      transactionId: transaction.id 
    });
  } catch (error) {
    logger.error("Error handling transaction payment", error, { userId });
    throw error;
  }
}

async function handlePaymentFailed(userId: string, data: any, logger: any) {
  try {
    const transaction = data.new || data;
    
    if (!transaction) {
      logger.error("No transaction data in failed event", { userId });
      return;
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "paddle",
      "subscription.payment_failed",
      {}
    );

    logger.warn("Payment failed", { 
      userId, 
      transactionId: transaction.id,
      reason: transaction.status_details?.reason || "Unknown"
    });
  } catch (error) {
    logger.error("Error handling payment failure", error, { userId });
    throw error;
  }
}

async function handleSubscriptionPastDue(userId: string, data: any, logger: any) {
  try {
    const subscription = data.new || data;
    
    if (!subscription) {
      logger.error("No subscription data in past_due event", { userId });
      return;
    }

    // Update subscription state
    await updateSubscriptionState(
      supabase,
      userId,
      "paddle",
      "subscription.past_due",
      {}
    );

    logger.warn("Subscription past due", { 
      userId, 
      subscriptionId: subscription.id 
    });
  } catch (error) {
    logger.error("Error handling subscription past due", error, { userId });
    throw error;
  }
}