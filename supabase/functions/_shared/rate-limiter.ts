// =========================================================
// REPLIFY AI - Rate Limiting Module
// Section 6: Rate Limiting System
// =========================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
  windowEnd: number;
}

// In-memory store for development (Redis-compatible design for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.windowEnd < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { requestsPerMinute: 100, requestsPerHour: 500 }) {
    this.config = config;
  }

  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const minuteWindow = 60 * 1000;
    const hourWindow = 60 * 60 * 1000;

    const minuteKey = `${identifier}:minute`;
    const hourKey = `${identifier}:hour`;

    // Check minute limit
    const minuteEntry = rateLimitStore.get(minuteKey);
    if (minuteEntry && minuteEntry.windowEnd > now) {
      if (minuteEntry.count >= this.config.requestsPerMinute) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: minuteEntry.windowEnd,
          retryAfter: Math.ceil((minuteEntry.windowEnd - now) / 1000)
        };
      }
      minuteEntry.count++;
    } else {
      rateLimitStore.set(minuteKey, {
        count: 1,
        windowStart: now,
        windowEnd: now + minuteWindow
      });
    }

    // Check hour limit
    const hourEntry = rateLimitStore.get(hourKey);
    if (hourEntry && hourEntry.windowEnd > now) {
      if (hourEntry.count >= this.config.requestsPerHour) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: hourEntry.windowEnd,
          retryAfter: Math.ceil((hourEntry.windowEnd - now) / 1000)
        };
      }
      hourEntry.count++;
    } else {
      rateLimitStore.set(hourKey, {
        count: 1,
        windowStart: now,
        windowEnd: now + hourWindow
      });
    }

    const currentMinute = rateLimitStore.get(minuteKey)!;
    const currentHour = rateLimitStore.get(hourKey)!;

    return {
      allowed: true,
      remaining: Math.min(
        this.config.requestsPerMinute - currentMinute.count,
        this.config.requestsPerHour - currentHour.count
      ),
      resetTime: Math.min(currentMinute.windowEnd, currentHour.windowEnd)
    };
  }

  getClientIdentifier(req: Request, userId?: string): string {
    // Prioritize user_id if available, fallback to IP
    if (userId) {
      return `user:${userId}`;
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    return `ip:${ip}`;
  }
}

// Factory function for creating rate limit middleware
export function createRateLimitMiddleware(config?: RateLimitConfig) {
  const limiter = new RateLimiter(config);

  return async function rateLimitMiddleware(
    req: Request,
    userId?: string
  ): Promise<{ allowed: boolean; result: RateLimitResult; headers: Record<string, string> }> {
    const identifier = limiter.getClientIdentifier(req, userId);
    const result = await limiter.checkLimit(identifier);

    const headers: Record<string, string> = {
      "X-RateLimit-Limit": String(config?.requestsPerMinute || 100),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000))
    };

    if (!result.allowed && result.retryAfter) {
      headers["Retry-After"] = String(result.retryAfter);
    }

    return { allowed: result.allowed, result, headers };
  };
}

// Abuse logging helper
export function logAbuseAttempt(
  identifier: string,
  endpoint: string,
  userAgent?: string | null
): void {
  console.warn(JSON.stringify({
    type: "rate_limit_abuse",
    identifier,
    endpoint,
    userAgent: userAgent || "unknown",
    timestamp: new Date().toISOString(),
    severity: "warning"
  }));
}
