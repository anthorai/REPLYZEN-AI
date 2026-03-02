export const PLAN_LIMITS = {
  free: {
    followups: 30,
    accounts: 1,
    label: "Free",
    price: "$0/month"
  },
  pro: {
    followups: 2000,
    accounts: 2,
    label: "Pro",
    price: "$29/month"
  },
  business: {
    followups: Infinity,
    accounts: 5,
    label: "Business",
    price: "$99/month"
  }
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;