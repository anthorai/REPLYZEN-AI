export type PlanId = "free" | "pro" | "business";

export const PLAN_LIMITS: Record<PlanId, { followups: number; accounts: number }> = {
  free: { followups: 30, accounts: 1 },
  pro: { followups: 2000, accounts: 2 },
  business: { followups: Infinity, accounts: 5 },
};

export const PLAN_FEATURES: Record<
  PlanId,
  { title: string; price: number; features: string[]; cta: string; badge?: string }
> = {
  free: {
    title: "Free",
    price: 0,
    features: [
      "30 follow-ups/month",
      "1 email account",
      "AI-generated drafts",
      "Manual send",
      "Daily digest",
      "Basic stats",
    ],
    cta: "Start Free",
  },
  pro: {
    title: "Pro",
    price: 29,
    features: [
      "2000 follow-ups/month",
      "Auto-send",
      "Custom timing (1–10 days)",
      "Advanced analytics",
      "Weekly reports",
      "2 Email accounts",
      "No branding",
    ],
    cta: "Upgrade to Pro",
    badge: "Most Popular",
  },
  business: {
    title: "Business",
    price: 99,
    features: [
      "Unlimited follow-ups",
      "5 email accounts",
      "Auto-send",
      "Custom timing (1–10 days)",
      "Advanced analytics",
      "Weekly reports",
      "No branding",
    ],
    cta: "Upgrade to Business",
  },
};

export function getPlanLimits(plan: string) {
  const id = (plan || "free").toLowerCase() as PlanId;
  return PLAN_LIMITS[id] ?? PLAN_LIMITS.free;
}