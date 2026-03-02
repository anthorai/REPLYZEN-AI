// Context-Aware AI Follow-Up Generation Engine
// 
// This module provides a production-grade follow-up generation system that creates
// human-level, context-aware, specific follow-ups that feel written manually.
//
// Key Features:
// - Message extraction and cleaning pipeline
// - Thread summarization for context
// - Conversation classification (proposal, meeting, interview, etc.)
// - Relationship stage detection (cold lead, active client, etc.)
// - Time delay analysis and tone adaptation
// - Structured AI prompt building
// - Anti-generic filtering and quality checks
// - Confidence scoring with multiple factors
// - Auto-send safety integration
// - Comprehensive logging and analytics

export { FollowUpGenerationEngine } from './followup-engine';
export { MessageExtractor } from './message-extractor';
export { ThreadSummarizer } from './thread-summarizer';
export { ConversationClassifier } from './conversation-classifier';
export { TimeToneAnalyzer } from './time-tone-analyzer';
export { PromptBuilder } from './prompt-builder';
export { QualityFilter } from './quality-filter';
export { ConfidenceScorer } from './confidence-scorer';

export type {
  // Core types
  ConversationType,
  RelationshipStage,
  TonePreference,
  TimeDelayCategory,
  
  // Message and thread types
  Message,
  ExtractedMessage,
  ThreadSummary,
  
  // Context and generation types
  ConversationContext,
  GenerationRequest,
  GenerationResult,
  BatchGenerationRequest,
  BatchGenerationResult,
  
  // Quality and safety types
  QualityMetrics,
  SafetyChecks,
  ClassificationResult,
  
  // Configuration types
  FollowUpGenerationConfig,
  PromptContext,
  ToneProfile,
  AntiGenericFilter,
  
  // Analytics types
  GenerationStats,
  FeedbackData,
  ContextMemory,
  
  // Error types
  GenerationError,
  QualityError,
  SafetyError
} from './types';

// Convenience factory for creating the complete follow-up generation system
export function createFollowUpGenerationSystem(config?: Partial<FollowUpGenerationConfig>) {
  return {
    engine: new FollowUpGenerationEngine(config),
    messageExtractor: new MessageExtractor(),
    threadSummarizer: new ThreadSummarizer(),
    conversationClassifier: new ConversationClassifier(),
    timeToneAnalyzer: new TimeToneAnalyzer(),
    promptBuilder: new PromptBuilder(),
    qualityFilter: new QualityFilter(),
    confidenceScorer: new ConfidenceScorer()
  };
}

// Main export for easy usage
export default createFollowUpGenerationSystem;
