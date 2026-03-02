export type AutoSendDecision = 'SAFE_TO_SEND' | 'CANCELLED' | 'RETRY_LATER' | 'MANUAL_REVIEW_REQUIRED';

export type CancellationReason = 
  | 'user_already_replied'
  | 'silence_window_invalid'
  | 'spam_risk_high'
  | 'daily_limit_reached'
  | 'plan_limit_reached'
  | 'sensitive_conversation'
  | 'recipient_opted_out'
  | 'technical_error'
  | 'rate_limit_exceeded'
  | 'content_quality_low'
  | 'legal_risk_detected';

export type SpamRiskFactor = 
  | 'high_frequency'
  | 'repetitive_content'
  | 'short_generic_message'
  | 'multiple_recipients'
  | 'unusual_timing'
  | 'spam_keywords'
  | 'low_engagement_history'
  | 'new_recipient_pattern';

export type SentimentRisk = 
  | 'legal_dispute'
  | 'refund_escalation'
  | 'angry_sentiment'
  | 'do_not_contact'
  | 'complaint_escalation'
  | 'dissatisfaction'
  | 'threatening_language';

export interface ThreadState {
  threadId: string;
  lastMessageTimestamp: Date;
  lastSender: string;
  lastMessageId: string;
  messageCount: number;
  recipientEmail: string;
  subject: string;
  isRead: boolean;
  hasAttachments: boolean;
}

export interface AutoSendRequest {
  threadId: string;
  followUpId: string;
  userId: string;
  generatedMessage: string;
  originalSilenceDuration: number;
  userFollowUpRule: number;
  plan: 'free' | 'pro' | 'enterprise';
  dailySendLimit: number;
  idempotencyKey: string;
  priority: 'low' | 'medium' | 'high';
  scheduledAt: Date;
}

export interface PreSendValidation {
  currentThreadState: ThreadState;
  recalculatedSilenceDuration: number;
  lastSenderCheck: {
    isUserLastSender: boolean;
    lastSenderEmail: string;
  };
  spamRiskAnalysis: SpamRiskAnalysis;
  dailyLimitCheck: DailyLimitCheck;
  sentimentGuard: SentimentGuard;
  planEligibility: PlanEligibility;
}

export interface SpamRiskAnalysis {
  overallScore: number; // 0-100
  riskFactors: Array<{
    factor: SpamRiskFactor;
    score: number;
    details: string;
  }>;
  threshold: number;
  isHighRisk: boolean;
  recommendations: string[];
}

export interface DailyLimitCheck {
  currentCount: number;
  limit: number;
  remaining: number;
  isLimitReached: boolean;
  resetTime: Date;
  usagePattern: {
    last24Hours: number;
    last7Days: number;
    averagePerDay: number;
  };
}

export interface SentimentGuard {
  hasRisks: boolean;
  detectedRisks: Array<{
    type: SentimentRisk;
    confidence: number;
    evidence: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  overallRiskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface PlanEligibility {
  isEligible: boolean;
  plan: 'free' | 'pro' | 'enterprise';
  autoSendEnabled: boolean;
  dailyLimit: number;
  features: string[];
  upgradePrompt?: string;
  restrictions: string[];
}

export interface AutoSendResult {
  threadId: string;
  followUpId: string;
  userId: string;
  decision: AutoSendDecision;
  decisionTimestamp: Date;
  validation: PreSendValidation;
  cancellationReason?: CancellationReason;
  userInsight: string;
  sentAt?: Date;
  emailProviderId?: string;
  processingTimeMs: number;
  idempotencyKey: string;
  retryCount: number;
  nextRetryAt?: Date;
}

export interface AutoSendAttempt {
  id: string;
  threadId: string;
  followUpId: string;
  userId: string;
  decision: AutoSendDecision;
  cancellationReason?: CancellationReason;
  validationSnapshot: PreSendValidation;
  generatedMessage: string;
  userInsight: string;
  sentAt?: Date;
  emailProviderId?: string;
  processingTimeMs: number;
  idempotencyKey: string;
  retryCount: number;
  nextRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoSendConfig {
  spamRiskThreshold: number;
  maxRetryAttempts: number;
  retryDelayMs: number;
  processingTimeoutMs: number;
  queuePriority: 'low' | 'medium' | 'high';
  enableSentimentGuard: boolean;
  enableAdvancedSpamDetection: boolean;
  auditLogRetention: number; // days
  batchSize: number;
  rateLimitPerSecond: number;
}

export interface QueueJob {
  id: string;
  type: 'auto_send';
  data: AutoSendRequest;
  priority: number;
  attempts: number;
  maxAttempts: number;
  nextRunAt: Date;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

export interface AuditLog {
  id: string;
  threadId: string;
  followUpId: string;
  userId: string;
  eventType: 'pre_send_validation' | 'send_attempt' | 'send_success' | 'send_failed' | 'cancellation';
  decision: AutoSendDecision;
  cancellationReason?: CancellationReason;
  validationSnapshot?: PreSendValidation;
  processingTimeMs: number;
  errorMessage?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface UserAutoSendStats {
  userId: string;
  plan: 'free' | 'pro' | 'enterprise';
  totalAttempts: number;
  successfulSends: number;
  cancelledAttempts: number;
  averageProcessingTime: number;
  spamRiskAverage: number;
  dailyUsage: Array<{
    date: string;
    sent: number;
    cancelled: number;
  }>;
  topCancellationReasons: Array<{
    reason: CancellationReason;
    count: number;
  }>;
  lastActivity: Date;
}

export interface SystemMetrics {
  totalProcessed: number;
  successRate: number;
  averageProcessingTime: number;
  spamRiskAverage: number;
  cancellationRate: number;
  retryRate: number;
  queueDepth: number;
  errorRate: number;
  planDistribution: Record<string, number>;
  topRiskFactors: Array<{
    factor: SpamRiskFactor;
    count: number;
  }>;
}

export interface EmailProviderResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'gmail' | 'outlook' | 'sendgrid' | 'aws_ses';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RetryStrategy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
}

export interface RateLimit {
  key: string;
  limit: number;
  windowMs: number;
  currentCount: number;
  resetTime: Date;
  isExceeded: boolean;
}

// Error types
export class AutoSendError extends Error {
  constructor(
    message: string,
    public code: string,
    public threadId?: string,
    public userId?: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'AutoSendError';
  }
}

export class SpamRiskError extends AutoSendError {
  constructor(
    message: string,
    public riskScore: number,
    public riskFactors: SpamRiskFactor[],
    threadId?: string,
    userId?: string
  ) {
    super(message, 'SPAM_RISK_HIGH', threadId, userId, false);
    this.name = 'SpamRiskError';
  }
}

export class DailyLimitError extends AutoSendError {
  constructor(
    message: string,
    public currentCount: number,
    public limit: number,
    public resetTime: Date,
    threadId?: string,
    userId?: string
  ) {
    super(message, 'DAILY_LIMIT_REACHED', threadId, userId, false);
    this.name = 'DailyLimitError';
  }
}

export class IdempotencyError extends AutoSendError {
  constructor(
    message: string,
    public idempotencyKey: string,
    threadId?: string,
    userId?: string
  ) {
    super(message, 'IDEMPOTENCY_DUPLICATE', threadId, userId, false);
    this.name = 'IdempotencyError';
  }
}
