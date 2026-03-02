export type ConversationType = 
  | 'proposal'
  | 'sales_pitch'
  | 'meeting_scheduling'
  | 'interview'
  | 'invoice_payment'
  | 'partnership'
  | 'client_onboarding'
  | 'support_resolution'
  | 'followup_reminder'
  | 'general_conversation';

export type RelationshipStage = 
  | 'cold_lead'
  | 'warm_lead'
  | 'active_client'
  | 'past_client'
  | 'recruiter'
  | 'vendor'
  | 'internal_team';

export type TonePreference = 
  | 'professional'
  | 'friendly'
  | 'assertive'
  | 'polite'
  | 'direct'
  | 'concise';

export type TimeDelayCategory = 
  | 'light_nudge'        // 1-2 days
  | 'gentle_followup'    // 3-5 days
  | 'stronger_clarity'  // 6-10 days
  | 're_engagement';    // 10+ days

export interface Message {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  timestamp: Date;
  isRead: boolean;
  headers?: Record<string, string>;
}

export interface ExtractedMessage {
  id: string;
  from: string;
  body: string;
  timestamp: Date;
  isFromUser: boolean;
}

export interface ThreadSummary {
  topic: string;
  pendingAction: string;
  waitingOn: 'user' | 'recipient' | 'mutual';
  deadlines: string[];
  keyPoints: string[];
  context: string;
}

export interface ConversationContext {
  conversationType: ConversationType;
  relationshipStage: RelationshipStage;
  timeSinceLastMessage: number; // in days
  timeDelayCategory: TimeDelayCategory;
  tonePreference: TonePreference;
  threadSummary: ThreadSummary;
  lastUserMessage: string;
  lastRecipientMessage: string;
  participantNames: {
    user: string;
    recipient: string;
  };
}

export interface GenerationRequest {
  threadId: string;
  userId: string;
  context: ConversationContext;
  tonePreference: TonePreference;
  maxWords: number;
  includeCallToAction: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface GenerationResult {
  id: string;
  threadId: string;
  userId: string;
  generatedText: string;
  confidenceScore: number;
  context: ConversationContext;
  qualityMetrics: QualityMetrics;
  safetyChecks: SafetyChecks;
  metadata: GenerationMetadata;
  autoSendReady: boolean;
  createdAt: Date;
}

export interface QualityMetrics {
  specificityScore: number;      // 0-100
  contextualityScore: number;    // 0-100
  humanLikenessScore: number;   // 0-100
  concisenessScore: number;     // 0-100
  appropriatenessScore: number; // 0-100
  overallQuality: number;       // 0-100
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
}

export interface SafetyChecks {
  containsGenericPhrases: boolean;
  genericPhrasesFound: string[];
  negativeSentiment: boolean;
  urgentLanguage: boolean;
  legalRisk: boolean;
  autoSendSafe: boolean;
  flaggedWords: string[];
  recommendedAction: 'send' | 'review' | 'regenerate' | 'manual_only';
}

export interface GenerationMetadata {
  processingTimeMs: number;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  regenerationCount: number;
  lastRegeneratedAt?: Date;
  feedbackScore?: number;
  userEdited?: boolean;
  sentAt?: Date;
  responseReceived?: boolean;
  conversionAchieved?: boolean;
  riskFactors?: string[];
}

export interface ClassificationResult {
  conversationType: ConversationType;
  relationshipStage: RelationshipStage;
  confidence: number;
  reasoning: string;
  alternativeTypes?: Array<{ type: ConversationType; confidence: number }>;
}

export interface AntiGenericFilter {
  genericPhrases: string[];
  forbiddenPatterns: RegExp[];
  qualityThresholds: {
    minSpecificity: number;
    minContextuality: number;
    minHumanLikeness: number;
    maxGenericPhrases: number;
  };
}

export interface ToneProfile {
  greeting: string;
  sentenceStructure: 'short' | 'medium' | 'long' | 'varied';
  formalityLevel: number; // 0-10
  emotionalSoftness: number; // 0-10
  directness: number; // 0-10
  callToActionStyle: 'soft' | 'clear' | 'urgent' | 'optional';
  commonPhrases: string[];
  avoidPhrases: string[];
}

export interface FollowupGenerationConfig {
  maxWords: number;
  maxSentences: number;
  minQualityScore: number;
  autoSendThreshold: number;
  regenerationLimit: number;
  enablePersonalization: boolean;
  enableContextMemory: boolean;
  defaultTone: TonePreference;
  modelConfig: {
    temperature: number;
    maxTokens: number;
    topP: number;
    presencePenalty: number;
    frequencyPenalty: number;
  };
}

export interface GenerationStats {
  totalGenerated: number;
  autoSent: number;
  manualSent: number;
  regenerated: number;
  averageQuality: number;
  averageConfidence: number;
  conversionRate: number;
  userSatisfactionScore: number;
  topConversationTypes: Array<{ type: ConversationType; count: number }>;
  errorRate: number;
}

export interface FeedbackData {
  generationId: string;
  userId: string;
  rating: number; // 1-5
  feedback: string;
  edited: boolean;
  sent: boolean;
  responseReceived: boolean;
  category: 'quality' | 'tone' | 'context' | 'timing' | 'other';
  timestamp: Date;
}

export interface ContextMemory {
  threadId: string;
  userId: string;
  participantPatterns: {
    typicalResponseTime: number; // hours
    preferredTone: TonePreference;
    communicationStyle: string;
    topics: string[];
  };
  conversationHistory: {
    types: ConversationType[];
    outcomes: Array<{ type: ConversationType; success: boolean }>;
    followupsSent: number;
    responseRate: number;
  };
  updatedAt: Date;
}

export interface BatchGenerationRequest {
  userId: string;
  threadIds: string[];
  tonePreference?: TonePreference;
  priority: 'low' | 'medium' | 'high';
  batchSize: number;
  enableAutoSend: boolean;
  qualityThreshold?: number;
}

export interface BatchGenerationResult {
  requestId: string;
  userId: string;
  totalProcessed: number;
  successful: number;
  failed: number;
  autoSendSafe: number;
  results: GenerationResult[];
  errors: Array<{ threadId: string; error: string }>;
  processingTimeMs: number;
  createdAt: Date;
}

// AI Prompt Builder Types
export interface PromptContext {
  conversationType: ConversationType;
  relationshipStage: RelationshipStage;
  timeDelayCategory: TimeDelayCategory;
  timeSinceLastMessage: number; // in days
  tonePreference: TonePreference;
  threadSummary: string;
  lastUserMessage: string;
  lastRecipientMessage: string;
  maxWords: number;
  includeCallToAction: boolean;
  customInstructions?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  conversationTypes: ConversationType[];
  relationshipStages: RelationshipStage[];
  timeCategories: TimeDelayCategory[];
  tones: TonePreference[];
  template: string;
  variables: string[];
  examples: string[];
}

// Error Types
export class GenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public threadId?: string,
    public userId?: string
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

export class QualityError extends GenerationError {
  constructor(
    message: string,
    public qualityScore: number,
    public metrics: QualityMetrics,
    threadId?: string,
    userId?: string
  ) {
    super(message, 'QUALITY_THRESHOLD', threadId, userId);
    this.name = 'QualityError';
  }
}

export class SafetyError extends GenerationError {
  constructor(
    message: string,
    public safetyChecks: SafetyChecks,
    threadId?: string,
    userId?: string
  ) {
    super(message, 'SAFETY_CHECK', threadId, userId);
    this.name = 'SafetyError';
  }
}
