// =========================================================
// REPLIFY AI - Billing API Client
// Frontend billing integration
// =========================================================

import { getSupabaseClient } from "@/integrations/supabase/client";

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

export interface CheckoutRequest {
  planType: "pro" | "business";
  billingCycle?: "monthly" | "yearly";
}

export interface CheckoutResponse {
  provider: "razorpay" | "paddle";
  checkout_url: string;
  subscription_id?: string;
}

export interface BillingStatus {
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

export interface CancelSubscriptionResponse {
  success: boolean;
  message: string;
  subscriptionId?: string;
}

/**
 * Create a checkout session for plan upgrade
 */
export async function createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${FUNCTIONS_URL}/create-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create checkout");
  }

  return response.json();
}

/**
 * Get current billing status
 */
export async function getBillingStatus(): Promise<BillingStatus> {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${FUNCTIONS_URL}/billing-status`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${session.access_token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get billing status");
  }

  return response.json();
}

/**
 * Cancel active subscription
 */
export async function cancelSubscription(): Promise<CancelSubscriptionResponse> {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${FUNCTIONS_URL}/cancel-subscription`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to cancel subscription");
  }

  return response.json();
}

/**
 * Redirect to payment provider checkout
 */
export function redirectToCheckout(checkoutUrl: string): void {
  window.location.href = checkoutUrl;
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return formatter.format(amount);
}

/**
 * Format date for display
 */
export function formatBillingDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

/**
 * Check if user can upgrade
 */
export function canUpgrade(currentPlan: string): boolean {
  return currentPlan === "free";
}

/**
 * Check if user can manage subscription
 */
export function canManageSubscription(status: string): boolean {
  return ["active", "past_due"].includes(status);
}
