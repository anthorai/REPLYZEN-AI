// Auto-Send Control System for Replyzen
//
// This is the highest-risk layer in the follow-up generation system.
// Safety > Automation. Trust > Speed.
//
// The system controls whether an AI-generated follow-up is actually sent
// with comprehensive validation, spam risk analysis, and compliance logging.

export { AutoSendController } from './auto-send-controller';
export { QueueWorker } from './queue-worker';
export { PreSendValidator } from './pre-send-validator';
export { IdempotencyManager } from './idempotency-manager';
export { AuditLogger } from './audit-logger';
export { EmailProviderService } from './email-provider-service';

export type {
  // Core decision types
  AutoSendDecision,
  CancellationReason,
  SpamRiskFactor,
  SentimentRisk,
  
  // Request and response types
  AutoSendRequest,
  AutoSendResult,
  ThreadState,
  PreSendValidation,
  SpamRiskAnalysis,
  DailyLimitCheck,
  SentimentGuard,
  PlanEligibility,
  AutoSendAttempt,
  
  // Configuration and queue types
  AutoSendConfig,
  QueueJob,
  RetryStrategy,
  RateLimit,
  EmailProviderResponse,
  EmailRequest,
  
  // Analytics and monitoring types
  UserAutoSendStats,
  SystemMetrics,
  AuditLog,
  
  // Error types
  AutoSendError,
  SpamRiskError,
  DailyLimitError,
  IdempotencyError
} from './types';

// Convenience factory for creating the complete auto-send system
export function createAutoSendSystem(config?: Partial<AutoSendConfig>) {
  return {
    controller: new AutoSendController(config),
    queueWorker: new QueueWorker(config),
    preSendValidator: new PreSendValidator(),
    idempotencyManager: new IdempotencyManager(),
    auditLogger: new AuditLogger(),
    emailProvider: new EmailProviderService()
  };
}

// Main export for easy usage
export default createAutoSendSystem;
