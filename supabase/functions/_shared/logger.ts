// =========================================================
// REPLIFY AI - Structured Logging Module
// Section 12: Centralized Logging
// =========================================================

export type LogLevel = "debug" | "info" | "warn" | "error" | "security";

export interface LogContext {
  requestId?: string;
  userId?: string;
  functionName: string;
  executionTimeMs?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  metadata?: Record<string, unknown>;
}

// Sensitive fields that should never be logged
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "api_key",
  "authorization",
  "cookie",
  "credit_card",
  "ssn",
  "password_hash"
];

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export class Logger {
  private functionName: string;
  private requestId: string;
  private userId?: string;
  private startTime: number;

  constructor(functionName: string, requestId?: string, userId?: string) {
    this.functionName = functionName;
    this.requestId = requestId || generateRequestId();
    this.userId = userId;
    this.startTime = performance.now();
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        requestId: this.requestId,
        userId: this.userId,
        functionName: this.functionName,
        executionTimeMs: Math.round(performance.now() - this.startTime)
      },
      metadata: metadata ? sanitizeObject(metadata) : undefined
    };

    // Output structured JSON log
    const logOutput = JSON.stringify(entry);

    switch (level) {
      case "debug":
        if (Deno.env.get("LOG_LEVEL") === "debug") {
          console.debug(logOutput);
        }
        break;
      case "info":
        console.log(logOutput);
        break;
      case "warn":
        console.warn(logOutput);
        break;
      case "error":
        console.error(logOutput);
        break;
      case "security":
        // Security logs go to stderr with special marker
        console.error(`[SECURITY] ${logOutput}`);
        break;
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log("debug", message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log("warn", message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const errorMetadata = error ? {
      ...metadata,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack
    } : metadata;
    
    this.log("error", message, errorMetadata);
  }

  security(message: string, metadata?: Record<string, unknown>): void {
    this.log("security", message, metadata);
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  getRequestId(): string {
    return this.requestId;
  }

  getExecutionTime(): number {
    return Math.round(performance.now() - this.startTime);
  }
}

// Factory function for creating loggers
export function createLogger(functionName: string, req?: Request): Logger {
  const requestId = req?.headers.get("x-request-id") || generateRequestId();
  return new Logger(functionName, requestId);
}

// Security event logging
export function logSecurityEvent(
  event: string,
  details: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const logger = new Logger("security");
  logger.security(event, {
    ...details.metadata,
    userId: details.userId,
    ip: details.ip,
    userAgent: details.userAgent
  });
}

// Performance logging
export function logPerformance(
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void {
  const logger = new Logger("performance");
  logger.info(`Performance: ${operation}`, {
    ...metadata,
    durationMs,
    operation
  });
}
