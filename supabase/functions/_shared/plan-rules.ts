// =========================================================
// REPLIFY AI - Plan Rules & Enforcement Module
// Section 8: Plan Enforcement
// =========================================================

export interface PlanLimits {
  followups: number;
  emailAccounts: number;
  autoSend: boolean;
}

export const PLAN_RULES: Record<string, PlanLimits> = {
  free: {
    followups: 30,
    emailAccounts: 1,
    autoSend: false
  },
  pro: {
    followups: 2000,
    emailAccounts: 2,
    autoSend: true
  },
  business: {
    followups: Infinity,
    emailAccounts: 5,
    autoSend: true
  }
};

export interface UsageStats {
  sentThisMonth: number;
  accountsConnected: number;
}

export interface PlanCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
}

export class PlanEnforcer {
  static getPlanLimits(plan: string): PlanLimits {
    return PLAN_RULES[plan.toLowerCase()] || PLAN_RULES.free;
  }

  static async checkFollowupLimit(
    supabase: any,
    userId: string,
    plan: string
  ): Promise<PlanCheckResult> {
    const limits = this.getPlanLimits(plan);
    
    // Get current month's sent count
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("followup_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action", "sent")
      .gte("created_at", startOfMonth.toISOString());

    if (error) {
      throw new Error(`Failed to check usage: ${error.message}`);
    }

    const currentUsage = count || 0;
    const allowed = limits.followups === Infinity || currentUsage < limits.followups;

    return {
      allowed,
      reason: allowed ? undefined : `Monthly limit of ${limits.followups} followups reached`,
      currentUsage,
      limit: limits.followups
    };
  }

  static async checkEmailAccountLimit(
    supabase: any,
    userId: string,
    plan: string
  ): Promise<PlanCheckResult> {
    const limits = this.getPlanLimits(plan);

    const { count, error } = await supabase
      .from("email_accounts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to check account count: ${error.message}`);
    }

    const currentUsage = count || 0;
    const allowed = currentUsage < limits.emailAccounts;

    return {
      allowed,
      reason: allowed ? undefined : `Account limit of ${limits.emailAccounts} reached for ${plan} plan`,
      currentUsage,
      limit: limits.emailAccounts
    };
  }

  static canAutoSend(plan: string): boolean {
    const limits = this.getPlanLimits(plan);
    return limits.autoSend;
  }

  static async getFullUsageStats(
    supabase: any,
    userId: string,
    plan: string
  ): Promise<{
    limits: PlanLimits;
    followups: PlanCheckResult;
    accounts: PlanCheckResult;
  }> {
    const [followups, accounts] = await Promise.all([
      this.checkFollowupLimit(supabase, userId, plan),
      this.checkEmailAccountLimit(supabase, userId, plan)
    ]);

    return {
      limits: this.getPlanLimits(plan),
      followups,
      accounts
    };
  }
}
