// =========================================================
// REPLIFY AI - BILLING SYSTEM SHARED MODULE
// Unified subscription state management
// =========================================================

export type PaymentProvider = "razorpay" | "paddle";
export type SubscriptionStatus = "free" | "active" | "past_due" | "inactive" | "cancelled";
export type PlanType = "free" | "pro" | "business";

export interface BillingProfile {
  user_id: string;
  payment_provider: PaymentProvider | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  plan_type: PlanType;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_period_until: string | null;
  billing_country: string | null;
}

export interface BillingEvent {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  event_type: string;
  event_id: string;
  raw_payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  created_at: string;
}

// Country to provider mapping
export function getPaymentProvider(countryCode: string): PaymentProvider {
  const normalizedCode = countryCode.toUpperCase().trim();
  
  // India uses Razorpay
  if (normalizedCode === "IN") {
    return "razorpay";
  }
  
  // All other countries use Paddle
  return "paddle";
}

// Detect country from IP (server-side only)
export async function detectCountryFromIP(ip: string): Promise<string> {
  try {
    // Using ipapi.co for geolocation (free tier available)
    const response = await fetch(`https://ipapi.co/${ip}/country_code/`);
    if (response.ok) {
      const countryCode = await response.text();
      return countryCode.trim();
    }
  } catch (error) {
    console.error("IP geolocation failed:", error);
  }
  
  // Default to US if detection fails
  return "US";
}

// Unified plan pricing
export const PLAN_PRICING: Record<PlanType, { monthly: number; yearly: number; currency: string }> = {
  free: { monthly: 0, yearly: 0, currency: "USD" },
  pro: { monthly: 29, yearly: 290, currency: "USD" },
  business: { monthly: 99, yearly: 990, currency: "USD" }
};

// Razorpay pricing (in INR)
export const RAZORPAY_PLAN_PRICING: Record<PlanType, { monthly: number; yearly: number; currency: string }> = {
  free: { monthly: 0, yearly: 0, currency: "INR" },
  pro: { monthly: 2900, yearly: 29000, currency: "INR" },
  business: { monthly: 9900, yearly: 99000, currency: "INR" }
};

// Plan limits (consistent across providers)
export const PLAN_LIMITS: Record<PlanType, { followups: number; accounts: number; autoSend: boolean }> = {
  free: { followups: 30, accounts: 1, autoSend: false },
  pro: { followups: 2000, accounts: 2, autoSend: true },
  business: { followups: -1, accounts: 5, autoSend: true } // -1 = unlimited
};

// Check if user has access to a feature
export function hasPlanAccess(
  profile: BillingProfile,
  requiredPlan: PlanType
): boolean {
  // Free plan always accessible
  if (requiredPlan === "free") {
    return true;
  }

  // Must be active
  if (profile.subscription_status !== "active") {
    return false;
  }

  // Check if period has expired
  if (profile.current_period_end && new Date(profile.current_period_end) < new Date()) {
    return false;
  }

  // Check plan level
  const planHierarchy: Record<PlanType, number> = {
    free: 0,
    pro: 1,
    business: 2
  };

  return planHierarchy[profile.plan_type] >= planHierarchy[requiredPlan];
}

// Check if auto-send is allowed
export function canAutoSend(profile: BillingProfile): boolean {
  if (profile.subscription_status !== "active") {
    return false;
  }

  if (profile.plan_type === "free") {
    return false;
  }

  // Check grace period
  if (profile.grace_period_until && new Date(profile.grace_period_until) < new Date()) {
    return false;
  }

  return PLAN_LIMITS[profile.plan_type].autoSend;
}

// Get followup limit for user
export function getFollowupLimit(profile: BillingProfile): number {
  return PLAN_LIMITS[profile.plan_type].followups;
}

// Get account limit for user
export function getAccountLimit(profile: BillingProfile): number {
  return PLAN_LIMITS[profile.plan_type].accounts;
}

// Check if user is in grace period
export function isInGracePeriod(profile: BillingProfile): boolean {
  if (!profile.grace_period_until) {
    return false;
  }
  return new Date(profile.grace_period_until) > new Date();
}

// Format subscription status for display
export function formatSubscriptionStatus(status: SubscriptionStatus): string {
  const statusMap: Record<SubscriptionStatus, string> = {
    free: "Free Plan",
    active: "Active",
    past_due: "Payment Overdue",
    inactive: "Expired",
    cancelled: "Cancelled"
  };
  return statusMap[status] || status;
}

// Get subscription status color
export function getSubscriptionStatusColor(status: SubscriptionStatus): string {
  const colorMap: Record<SubscriptionStatus, string> = {
    free: "text-muted-foreground",
    active: "text-green-600",
    past_due: "text-amber-600",
    inactive: "text-red-600",
    cancelled: "text-gray-600"
  };
  return colorMap[status] || "text-muted-foreground";
}

// Calculate days until expiration
export function getDaysUntilExpiration(profile: BillingProfile): number | null {
  if (!profile.current_period_end) {
    return null;
  }
  
  const endDate = new Date(profile.current_period_end);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
}

// Validate webhook signature (Razorpay)
export async function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Create HMAC hash using Web Crypto API (compatible with Deno)
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(secret);
    const dataBuffer = encoder.encode(body);
    
    // Import the key for HMAC operations
    const key = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    // Sign the data
    const signatureArrayBuffer = await crypto.subtle.sign("HMAC", key, dataBuffer);
    
    // Convert to hex string
    const expectedSignature = Array.from(new Uint8Array(signatureArrayBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    
    // Compare signatures safely
    return timingSafeEqual(signature, expectedSignature);
  } catch (error) {
    console.error("Razorpay signature verification error:", error);
    return false;
  }
}

// Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// Validate webhook signature (Paddle)
export async function verifyPaddleSignature(
  payload: string,
  signature: string,
  signingSecret: string
): Promise<boolean> {
  try {
    // Paddle uses a signature format like: timestamp:payload-hexDigest
    // We need to reconstruct the string to sign and verify against the signature
    
    // Create HMAC hash using Web Crypto API (compatible with Deno)
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(signingSecret);
    const dataBuffer = encoder.encode(payload);
    
    // Import the key for HMAC operations
    const key = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    // Sign the data
    const signatureArrayBuffer = await crypto.subtle.sign("HMAC", key, dataBuffer);
    
    // Convert to hex string
    const expectedSignature = Array.from(new Uint8Array(signatureArrayBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    
    // Compare signatures safely
    return timingSafeEqual(signature, expectedSignature);
  } catch (error) {
    console.error("Paddle signature verification failed:", error);
    return false;
  }
}

// Idempotency check for billing events
export async function isEventProcessed(
  supabase: any,
  eventId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("billing_events")
    .select("id")
    .eq("event_id", eventId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is 'Row not found'
    console.error('Error checking if event is processed:', error);
    return false;
  }
  
  return !!data;
}

// Log billing event
export async function logBillingEvent(
  supabase: any,
  event: Omit<BillingEvent, "id" | "created_at">
): Promise<void> {
  await supabase.from("billing_events").insert({
    user_id: event.user_id,
    provider: event.provider,
    event_type: event.event_type,
    event_id: event.event_id,
    raw_payload: event.raw_payload,
    processed: event.processed,
    processed_at: event.processed_at
  });
}

// Update subscription state (unified)
export async function updateSubscriptionState(
  supabase: any,
  userId: string,
  provider: PaymentProvider,
  eventType: string,
  updates: {
    planType?: PlanType;
    periodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    providerCustomerId?: string;
    providerSubscriptionId?: string;
  }
): Promise<void> {
  // Call the database function for atomic update
  await supabase.rpc("update_subscription_state", {
    p_user_id: userId,
    p_provider: provider,
    p_event_type: eventType,
    p_plan_type: updates.planType,
    p_period_end: updates.periodEnd,
    p_cancel_at_period_end: updates.cancelAtPeriodEnd || false
  });

  // Update additional provider-specific fields
  const profileUpdates: Record<string, unknown> = {};
  
  if (updates.providerCustomerId) {
    profileUpdates.provider_customer_id = updates.providerCustomerId;
  }
  if (updates.providerSubscriptionId) {
    profileUpdates.provider_subscription_id = updates.providerSubscriptionId;
  }
  
  if (Object.keys(profileUpdates).length > 0) {
    await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("user_id", userId);
  }
}

// Get billing provider for user
export async function getUserBillingProvider(
  supabase: any,
  userId: string
): Promise<PaymentProvider | null> {
  const { data } = await supabase
    .from("profiles")
    .select("payment_provider, billing_country")
    .eq("user_id", userId)
    .single();
  
  if (data?.payment_provider) {
    return data.payment_provider as PaymentProvider;
  }
  
  if (data?.billing_country) {
    return getPaymentProvider(data.billing_country);
  }
  
  return null;
}
