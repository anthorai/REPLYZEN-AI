export interface ThreadParticipant {
  email: string;
  name?: string;
  isUser: boolean;
}

export interface Message {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  timestamp: Date;
  headers?: Record<string, string>;
  isRead: boolean;
}

export interface ThreadAnalysis {
  threadId: string;
  subject: string;
  participants: ThreadParticipant[];
  messages: Message[];
  lastMessage: Message;
  lastSender: string;
  userIsParticipant: boolean;
  userIsLastSender: boolean;
  silenceDuration: number; // in hours
  messageCount: number;
}

export interface SilenceDetectionResult {
  threadId: string;
  subject: string;
  isEligible: boolean;
  lastSender: string;
  silenceDurationDays: number;
  followUpRuleDays: number;
  confidenceScore: number;
  autoSendReady: boolean;
  insights: ThreadInsight;
  rejectionReason?: string;
  metadata: DetectionMetadata;
}

export interface ThreadInsight {
  summary: string;
  lastReplyStatus: 'Waiting on them' | 'Waiting on you' | 'Thread resolved';
  suggestedAction: 'Follow-up ready' | 'Wait longer' | 'No action needed';
  riskLevel: 'low' | 'medium' | 'high';
  participantSummary: string;
}

export interface DetectionMetadata {
  eligibilityTimestamp: Date;
  processingTimeMs: number;
  automationConfidence: number;
  duplicateCheckPassed: boolean;
  raceConditionProtected: boolean;
  filtersApplied: string[];
}

export interface AutomationDetection {
  isAutomated: boolean;
  confidence: number;
  indicators: string[];
  type: 'newsletter' | 'marketing' | 'notification' | 'transactional' | 'support' | 'unknown';
}

export interface FollowUpRule {
  userId: string;
  delayDays: number;
  autoSendEnabled: boolean;
  plan: 'free' | 'pro' | 'enterprise';
  customFilters?: string[];
  excludedDomains?: string[];
}

export interface DuplicateCheck {
  hasExistingFollowUp: boolean;
  hasScheduledFollowUp: boolean;
  hasDraftedFollowUp: boolean;
  lastFollowUpAt?: Date;
  scheduledFor?: Date;
}

export interface ProcessingContext {
  userId: string;
  userEmail: string;
  threadId: string;
  requestId: string;
  timestamp: Date;
  followUpRule: FollowUpRule;
}

export interface SilenceDetectionConfig {
  automationThreshold: number;
  minSilenceHours: number;
  maxProcessingTimeMs: number;
  enableRaceConditionProtection: boolean;
  enableDuplicatePrevention: boolean;
  logFalsePositives: boolean;
}

export interface EmailHeader {
  name: string;
  value: string;
}

export interface PrecisionFilter {
  name: string;
  check: (message: Message, headers: EmailHeader[]) => boolean;
  weight: number;
  description: string;
}

export interface ConfidenceFactors {
  participantReciprocity: number;
  silenceDurationScore: number;
  automationRisk: number;
  threadRecency: number;
  messageQuality: number;
  duplicateRisk: number;
}

export interface EligibilityCriteria {
  userIsParticipant: boolean;
  userIsNotLastSender: boolean;
  silenceDurationMet: boolean;
  notAutomated: boolean;
  noDuplicates: boolean;
  raceConditionClear: boolean;
}

export interface MonetizationFlags {
  autoSendReady: boolean;
  requiresUpgrade: boolean;
  featureGates: string[];
  upgradePrompt: string;
}
