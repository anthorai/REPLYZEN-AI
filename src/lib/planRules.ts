export const PLAN_RULES = {
  free: {
    followups: 30,
    emailAccounts: 1,
    autoSend: false,
    customTiming: false,
    advancedAnalytics: false,
    weeklyReports: false,
    brandingRemoval: false
  },
  pro: {
    followups: 2000,
    emailAccounts: 2,
    autoSend: true,
    customTiming: true,
    advancedAnalytics: true,
    weeklyReports: true,
    brandingRemoval: true
  },
  business: {
    followups: Infinity,
    emailAccounts: 5,
    autoSend: true,
    customTiming: true,
    advancedAnalytics: true,
    weeklyReports: true,
    brandingRemoval: true
  }
} as const;

export type PlanType = keyof typeof PLAN_RULES;
export type FeatureKey = keyof typeof PLAN_RULES.free;