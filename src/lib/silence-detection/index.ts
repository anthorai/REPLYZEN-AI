// Silence Detection Engine - Production-grade follow-up eligibility system
// 
// This module provides a comprehensive silence detection system for Replyzen
// that determines whether an email thread is eligible for follow-up with 95%+ precision.
//
// Key Features:
// - Precision filtering to exclude automated emails
// - Confidence scoring with multiple factors
// - Duplicate prevention and race condition protection
// - Monetization integration for upgrade triggers
// - Structured insight output for cognitive load reduction

export { BackgroundSilenceDetectionWorker } from './background-worker-fixed';
export { PrecisionFilterEngine } from './precision-filters';
export { SilenceCalculator } from './silence-calculator';
export { DuplicatePreventionEngine } from './duplicate-prevention';
export { ConfidenceScoringEngine } from './confidence-scoring';
export { InsightFormatter } from './insight-formatter';
export { IdempotencyGuard } from './idempotency-guard';
export { MonetizationIntegration } from './monetization-integration';

export type {
  ThreadParticipant,
  Message,
  ThreadAnalysis,
  SilenceDetectionResult,
  ThreadInsight,
  DetectionMetadata,
  AutomationDetection,
  FollowUpRule,
  DuplicateCheck,
  ProcessingContext,
  SilenceDetectionConfig,
  EmailHeader,
  PrecisionFilter,
  ConfidenceFactors,
  EligibilityCriteria,
  MonetizationFlags
} from './types';

// Convenience factory for creating the complete silence detection system
export function createSilenceDetectionSystem(config?: Partial<SilenceDetectionConfig>) {
  return {
    worker: new BackgroundSilenceDetectionWorker(config),
    precisionFilter: new PrecisionFilterEngine(),
    silenceCalculator: new SilenceCalculator(),
    duplicatePrevention: new DuplicatePreventionEngine(),
    confidenceScoring: new ConfidenceScoringEngine(),
    insightFormatter: new InsightFormatter(),
    idempotencyGuard: new IdempotencyGuard(),
    monetization: new MonetizationIntegration()
  };
}

// Main export for easy usage
export default createSilenceDetectionSystem;
