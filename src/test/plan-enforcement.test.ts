// =========================================================
// REPLIFY AI - Plan Enforcement Unit Tests
// Section 14: Test Coverage
// =========================================================

import { describe, it, expect } from "vitest";

// Plan rules configuration
const PLAN_RULES = {
  free: { followups: 30, emailAccounts: 1, autoSend: false },
  pro: { followups: 2000, emailAccounts: 2, autoSend: true },
  business: { followups: Infinity, emailAccounts: 5, autoSend: true }
};

// Mock plan enforcer
class MockPlanEnforcer {
  static getPlanLimits(plan: string) {
    return PLAN_RULES[plan as keyof typeof PLAN_RULES] || PLAN_RULES.free;
  }

  static canAutoSend(plan: string): boolean {
    return this.getPlanLimits(plan).autoSend;
  }

  static checkFollowupLimit(currentUsage: number, plan: string): { allowed: boolean; remaining: number } {
    const limits = this.getPlanLimits(plan);
    const allowed = limits.followups === Infinity || currentUsage < limits.followups;
    const remaining = limits.followups === Infinity ? Infinity : Math.max(0, limits.followups - currentUsage);
    return { allowed, remaining };
  }

  static checkAccountLimit(currentAccounts: number, plan: string): { allowed: boolean; remaining: number } {
    const limits = this.getPlanLimits(plan);
    const allowed = currentAccounts < limits.emailAccounts;
    const remaining = Math.max(0, limits.emailAccounts - currentAccounts);
    return { allowed, remaining };
  }
}

describe("Plan Enforcement", () => {
  describe("getPlanLimits", () => {
    it("should return free plan limits", () => {
      const limits = MockPlanEnforcer.getPlanLimits("free");
      expect(limits.followups).toBe(30);
      expect(limits.emailAccounts).toBe(1);
      expect(limits.autoSend).toBe(false);
    });

    it("should return pro plan limits", () => {
      const limits = MockPlanEnforcer.getPlanLimits("pro");
      expect(limits.followups).toBe(2000);
      expect(limits.emailAccounts).toBe(2);
      expect(limits.autoSend).toBe(true);
    });

    it("should return business plan limits", () => {
      const limits = MockPlanEnforcer.getPlanLimits("business");
      expect(limits.followups).toBe(Infinity);
      expect(limits.emailAccounts).toBe(5);
      expect(limits.autoSend).toBe(true);
    });

    it("should default to free plan for unknown plans", () => {
      const limits = MockPlanEnforcer.getPlanLimits("unknown");
      expect(limits.followups).toBe(30);
      expect(limits.emailAccounts).toBe(1);
    });
  });

  describe("canAutoSend", () => {
    it("should not allow auto-send for free plan", () => {
      expect(MockPlanEnforcer.canAutoSend("free")).toBe(false);
    });

    it("should allow auto-send for pro plan", () => {
      expect(MockPlanEnforcer.canAutoSend("pro")).toBe(true);
    });

    it("should allow auto-send for business plan", () => {
      expect(MockPlanEnforcer.canAutoSend("business")).toBe(true);
    });
  });

  describe("checkFollowupLimit", () => {
    it("should allow followups when under limit", () => {
      const result = MockPlanEnforcer.checkFollowupLimit(10, "free");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(20);
    });

    it("should deny followups when at limit", () => {
      const result = MockPlanEnforcer.checkFollowupLimit(30, "free");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should always allow for business plan", () => {
      const result = MockPlanEnforcer.checkFollowupLimit(100000, "business");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });
  });

  describe("checkAccountLimit", () => {
    it("should allow account when under limit", () => {
      const result = MockPlanEnforcer.checkAccountLimit(0, "free");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it("should deny account when at limit", () => {
      const result = MockPlanEnforcer.checkAccountLimit(1, "free");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should allow multiple accounts for pro plan", () => {
      const result = MockPlanEnforcer.checkAccountLimit(1, "pro");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });
});
