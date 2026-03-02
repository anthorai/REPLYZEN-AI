// =========================================================
// REPLIFY AI - Rate Limiting Unit Tests
// Section 14: Test Coverage
// =========================================================

import { describe, it, expect, beforeEach } from "vitest";

// Simple in-memory rate limiter for testing
class TestRateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();
  
  constructor(
    private requestsPerMinute: number = 100,
    private requestsPerHour: number = 500
  ) {}

  async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowEnd = now + 60000; // 1 minute window for simplicity
    
    const entry = this.store.get(identifier);
    
    if (!entry || entry.resetTime < now) {
      this.store.set(identifier, { count: 1, resetTime: windowEnd });
      return { allowed: true, remaining: this.requestsPerMinute - 1 };
    }
    
    if (entry.count >= this.requestsPerMinute) {
      return { allowed: false, remaining: 0 };
    }
    
    entry.count++;
    return { allowed: true, remaining: this.requestsPerMinute - entry.count };
  }

  reset(): void {
    this.store.clear();
  }
}

describe("Rate Limiting", () => {
  let limiter: TestRateLimiter;

  beforeEach(() => {
    limiter = new TestRateLimiter(5, 100); // 5 per minute for testing
  });

  it("should allow requests under the limit", async () => {
    const result = await limiter.checkLimit("user:123");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("should track requests separately for different identifiers", async () => {
    await limiter.checkLimit("user:123");
    await limiter.checkLimit("user:123");
    
    const result = await limiter.checkLimit("user:456");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("should deny requests over the limit", async () => {
    // Make 5 requests (at limit)
    for (let i = 0; i < 5; i++) {
      await limiter.checkLimit("user:123");
    }
    
    // 6th request should be denied
    const result = await limiter.checkLimit("user:123");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should decrement remaining correctly", async () => {
    const r1 = await limiter.checkLimit("user:123");
    expect(r1.remaining).toBe(4);
    
    const r2 = await limiter.checkLimit("user:123");
    expect(r2.remaining).toBe(3);
    
    const r3 = await limiter.checkLimit("user:123");
    expect(r3.remaining).toBe(2);
  });

  it("should handle concurrent requests", async () => {
    const promises = Array(5).fill(null).map(() => limiter.checkLimit("user:123"));
    const results = await Promise.all(promises);
    
    const allowedCount = results.filter(r => r.allowed).length;
    expect(allowedCount).toBe(5);
    
    // Next request should be denied
    const nextResult = await limiter.checkLimit("user:123");
    expect(nextResult.allowed).toBe(false);
  });
});
