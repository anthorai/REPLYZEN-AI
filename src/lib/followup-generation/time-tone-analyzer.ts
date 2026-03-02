import { TimeDelayCategory, TonePreference, ToneProfile } from './types';
import { ConversationType, RelationshipStage } from './types';

export class TimeToneAnalyzer {
  private readonly timeDelayThresholds = {
    light_nudge: { min: 1, max: 2 },      // 1-2 days
    gentle_followup: { min: 3, max: 5 },   // 3-5 days
    stronger_clarity: { min: 6, max: 10 }, // 6-10 days
    re_engagement: { min: 11, max: Infinity } // 10+ days
  };

  private readonly toneProfiles: Record<TonePreference, ToneProfile> = {
    professional: {
      greeting: 'Dear {name},',
      sentenceStructure: 'medium',
      formalityLevel: 8,
      emotionalSoftness: 3,
      directness: 6,
      callToActionStyle: 'clear',
      commonPhrases: [
        'I hope this message finds you well',
        'I wanted to follow up regarding',
        'Please let me know if you have any questions',
        'I look forward to hearing from you',
        'Thank you for your time and consideration'
      ],
      avoidPhrases: [
        'hey', 'what\'s up', 'gonna', 'wanna', 'cool', 'awesome',
        'just checking in', 'bumping this', 'circling back'
      ]
    },
    friendly: {
      greeting: 'Hi {name},',
      sentenceStructure: 'varied',
      formalityLevel: 4,
      emotionalSoftness: 7,
      directness: 5,
      callToActionStyle: 'soft',
      commonPhrases: [
        'Hope you\'re having a great week',
        'Just wanted to check in',
        'Looking forward to connecting',
        'Feel free to reach out',
        'Best wishes'
      ],
      avoidPhrases: [
        'respectfully', 'herewith', 'herein', 'aforementioned',
        'pursuant to', 'heretofore'
      ]
    },
    assertive: {
      greeting: '{name},',
      sentenceStructure: 'short',
      formalityLevel: 6,
      emotionalSoftness: 2,
      directness: 9,
      callToActionStyle: 'urgent',
      commonPhrases: [
        'I need to confirm',
        'It\'s important that we',
        'Please respond by',
        'This requires your attention',
        'Next steps are clear'
      ],
      avoidPhrases: [
        'if you don\'t mind', 'when you have a moment', 'perhaps',
        'maybe', 'might', 'could you possibly'
      ]
    },
    polite: {
      greeting: 'Hello {name},',
      sentenceStructure: 'medium',
      formalityLevel: 7,
      emotionalSoftness: 8,
      directness: 4,
      callToActionStyle: 'optional',
      commonPhrases: [
        'I hope you don\'t mind me reaching out',
        'If you have a moment',
        'I would appreciate your thoughts',
        'Thank you for your consideration',
        'No rush on this'
      ],
      avoidPhrases: [
        'immediately', 'urgent', 'asap', 'right away',
        'must', 'require', 'demand'
      ]
    },
    direct: {
      greeting: '{name},',
      sentenceStructure: 'short',
      formalityLevel: 5,
      emotionalSoftness: 3,
      directness: 10,
      callToActionStyle: 'clear',
      commonPhrases: [
        'Following up on',
        'Need your input on',
        'Decision required',
        'Action needed',
        'Response requested'
      ],
      avoidPhrases: [
        'I was wondering', 'perhaps we could', 'maybe you might',
        'if you wouldn\'t mind', 'would it be possible'
      ]
    },
    concise: {
      greeting: '{name},',
      sentenceStructure: 'short',
      formalityLevel: 5,
      emotionalSoftness: 4,
      directness: 8,
      callToActionStyle: 'clear',
      commonPhrases: [
        'Quick follow-up',
        'Status update',
        'Next steps',
        'Decision needed',
        'Your thoughts?'
      ],
      avoidPhrases: [
        'I hope this email finds you well', 'I am writing to',
        'I wanted to reach out', 'in order to',
        'due to the fact that'
      ]
    }
  };

  /**
   * Analyzes time delay and determines category
   */
  analyzeTimeDelay(lastMessageTimestamp: Date): {
    daysSinceLastMessage: number;
    category: TimeDelayCategory;
    urgencyLevel: number; // 0-10
    recommendedApproach: string;
  } {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastMessageTimestamp.getTime());
    const daysSinceLastMessage = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let category: TimeDelayCategory;
    let urgencyLevel: number;
    let recommendedApproach: string;

    if (daysSinceLastMessage <= this.timeDelayThresholds.light_nudge.max) {
      category = 'light_nudge';
      urgencyLevel = 2;
      recommendedApproach = 'Very gentle reminder, minimal pressure';
    } else if (daysSinceLastMessage <= this.timeDelayThresholds.gentle_followup.max) {
      category = 'gentle_followup';
      urgencyLevel = 4;
      recommendedApproach = 'Standard follow-up with clear purpose';
    } else if (daysSinceLastMessage <= this.timeDelayThresholds.stronger_clarity.max) {
      category = 'stronger_clarity';
      urgencyLevel = 7;
      recommendedApproach = 'More direct with clear call-to-action';
    } else {
      category = 're_engagement';
      urgencyLevel = 9;
      recommendedApproach = 'Re-engagement with value reminder';
    }

    return {
      daysSinceLastMessage,
      category,
      urgencyLevel,
      recommendedApproach
    };
  }

  /**
   * Adapts tone based on time delay and context
   */
  adaptToneForDelay(
    baseTone: TonePreference,
    timeCategory: TimeDelayCategory,
    conversationType: ConversationType,
    relationshipStage: RelationshipStage
  ): ToneProfile {
    let baseProfile = { ...this.toneProfiles[baseTone] };

    // Adjust tone based on time delay
    switch (timeCategory) {
      case 'light_nudge':
        // Keep tone gentle for light nudges
        baseProfile.emotionalSoftness = Math.min(10, baseProfile.emotionalSoftness + 2);
        baseProfile.directness = Math.max(1, baseProfile.directness - 2);
        break;

      case 'gentle_followup':
        // Standard tone adjustments
        break;

      case 'stronger_clarity':
        // Increase directness for longer delays
        baseProfile.directness = Math.min(10, baseProfile.directness + 3);
        baseProfile.emotionalSoftness = Math.max(1, baseProfile.emotionalSoftness - 2);
        baseProfile.callToActionStyle = 'clear';
        break;

      case 're_engagement':
        // Much more direct for very long delays
        baseProfile.directness = Math.min(10, baseProfile.directness + 4);
        baseProfile.emotionalSoftness = Math.max(1, baseProfile.emotionalSoftness - 3);
        baseProfile.callToActionStyle = 'urgent';
        break;
    }

    // Adjust based on conversation type
    baseProfile = this.adjustForConversationType(baseProfile, conversationType);

    // Adjust based on relationship stage
    baseProfile = this.adjustForRelationshipStage(baseProfile, relationshipStage);

    return baseProfile;
  }

  /**
   * Adjusts tone profile based on conversation type
   */
  private adjustForConversationType(profile: ToneProfile, conversationType: ConversationType): ToneProfile {
    const adjusted = { ...profile };

    switch (conversationType) {
      case 'proposal':
      case 'sales_pitch':
        adjusted.formalityLevel = Math.min(10, adjusted.formalityLevel + 1);
        adjusted.emotionalSoftness = Math.max(1, adjusted.emotionalSoftness - 1);
        break;

      case 'interview':
        adjusted.formalityLevel = Math.min(10, adjusted.formalityLevel + 2);
        adjusted.emotionalSoftness = Math.max(1, adjusted.emotionalSoftness - 1);
        adjusted.directness = Math.max(3, adjusted.directness - 1);
        break;

      case 'invoice_payment':
        adjusted.directness = Math.min(10, adjusted.directness + 2);
        adjusted.emotionalSoftness = Math.max(1, adjusted.emotionalSoftness - 2);
        adjusted.callToActionStyle = 'clear';
        break;

      case 'client_onboarding':
        adjusted.emotionalSoftness = Math.min(10, adjusted.emotionalSoftness + 2);
        adjusted.directness = Math.max(3, adjusted.directness - 1);
        break;

      case 'support_resolution':
        adjusted.emotionalSoftness = Math.min(10, adjusted.emotionalSoftness + 1);
        adjusted.directness = Math.max(3, adjusted.directness - 1);
        break;

      case 'partnership':
        adjusted.formalityLevel = Math.min(10, adjusted.formalityLevel + 1);
        adjusted.emotionalSoftness = Math.max(2, adjusted.emotionalSoftness);
        break;

      case 'meeting_scheduling':
        adjusted.directness = Math.min(10, adjusted.directness + 1);
        adjusted.callToActionStyle = 'clear';
        break;

      default:
        break;
    }

    return adjusted;
  }

  /**
   * Adjusts tone profile based on relationship stage
   */
  private adjustForRelationshipStage(profile: ToneProfile, relationshipStage: RelationshipStage): ToneProfile {
    const adjusted = { ...profile };

    switch (relationshipStage) {
      case 'cold_lead':
        adjusted.formalityLevel = Math.min(10, adjusted.formalityLevel + 2);
        adjusted.emotionalSoftness = Math.min(10, adjusted.emotionalSoftness + 2);
        adjusted.directness = Math.max(2, adjusted.directness - 2);
        adjusted.callToActionStyle = 'soft';
        break;

      case 'warm_lead':
        adjusted.formalityLevel = Math.max(3, adjusted.formalityLevel - 1);
        adjusted.emotionalSoftness = Math.min(10, adjusted.emotionalSoftness + 1);
        break;

      case 'active_client':
        adjusted.formalityLevel = Math.max(4, adjusted.formalityLevel - 2);
        adjusted.emotionalSoftness = Math.max(3, adjusted.emotionalSoftness - 1);
        adjusted.directness = Math.min(10, adjusted.directness + 1);
        break;

      case 'past_client':
        adjusted.emotionalSoftness = Math.min(10, adjusted.emotionalSoftness + 1);
        adjusted.formalityLevel = Math.max(4, adjusted.formalityLevel - 1);
        break;

      case 'recruiter':
        adjusted.formalityLevel = Math.min(10, adjusted.formalityLevel + 1);
        adjusted.emotionalSoftness = Math.max(2, adjusted.emotionalSoftness);
        adjusted.directness = Math.max(4, adjusted.directness - 1);
        break;

      case 'vendor':
        adjusted.formalityLevel = Math.max(5, adjusted.formalityLevel - 1);
        adjusted.directness = Math.min(10, adjusted.directness + 1);
        adjusted.callToActionStyle = 'clear';
        break;

      case 'internal_team':
        adjusted.formalityLevel = Math.max(2, adjusted.formalityLevel - 3);
        adjusted.emotionalSoftness = Math.min(10, adjusted.emotionalSoftness + 1);
        adjusted.directness = Math.min(10, adjusted.directness + 2);
        break;

      default:
        break;
    }

    return adjusted;
  }

  /**
   * Generates tone-specific instructions for AI
   */
  generateToneInstructions(profile: ToneProfile): string {
    const instructions = [];

    instructions.push(`Tone: ${this.getToneDescription(profile)}`);
    instructions.push(`Formality: ${profile.formalityLevel}/10`);
    instructions.push(`Directness: ${profile.directness}/10`);
    instructions.push(`Emotional softness: ${profile.emotionalSoftness}/10`);

    // Sentence structure guidance
    switch (profile.sentenceStructure) {
      case 'short':
        instructions.push('Use short, concise sentences');
        break;
      case 'medium':
        instructions.push('Use medium-length sentences with variety');
        break;
      case 'long':
        instructions.push('Use longer, more detailed sentences');
        break;
      case 'varied':
        instructions.push('Vary sentence length for natural flow');
        break;
    }

    // Call-to-action guidance
    switch (profile.callToActionStyle) {
      case 'soft':
        instructions.push('Use soft, optional call-to-action');
        break;
      case 'clear':
        instructions.push('Use clear, direct call-to-action');
        break;
      case 'urgent':
        instructions.push('Use urgent but professional call-to-action');
        break;
      case 'optional':
        instructions.push('Make call-to-action optional and low-pressure');
        break;
    }

    // Include common phrases
    if (profile.commonPhrases.length > 0) {
      instructions.push(`Consider using phrases like: ${profile.commonPhrases.slice(0, 3).join(', ')}`);
    }

    // Avoid phrases
    if (profile.avoidPhrases.length > 0) {
      instructions.push(`Avoid phrases like: ${profile.avoidPhrases.slice(0, 3).join(', ')}`);
    }

    return instructions.join('. ');
  }

  /**
   * Gets human-readable tone description
   */
  private getToneDescription(profile: ToneProfile): string {
    const descriptions = [];

    if (profile.formalityLevel >= 7) {
      descriptions.push('formal');
    } else if (profile.formalityLevel <= 3) {
      descriptions.push('casual');
    } else {
      descriptions.push('semi-formal');
    }

    if (profile.emotionalSoftness >= 7) {
      descriptions.push('warm');
    } else if (profile.emotionalSoftness <= 3) {
      descriptions.push('direct');
    } else {
      descriptions.push('balanced');
    }

    if (profile.directness >= 8) {
      descriptions.push('straightforward');
    } else if (profile.directness <= 3) {
      descriptions.push('gentle');
    } else {
      descriptions.push('moderate');
    }

    return descriptions.join(', ');
  }

  /**
   * Validates time delay analysis
   */
  validateTimeDelay(daysSinceLastMessage: number): {
    isValid: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (daysSinceLastMessage < 0) {
      warnings.push('Negative time delay detected');
      recommendations.push('Check timestamp calculations');
    }

    if (daysSinceLastMessage > 365) {
      warnings.push('Very long time delay (over 1 year)');
      recommendations.push('Consider if follow-up is still appropriate');
    }

    if (daysSinceLastMessage > 30 && daysSinceLastMessage < 60) {
      recommendations.push('Consider re-engagement approach with value reminder');
    }

    if (daysSinceLastMessage > 180) {
      recommendations.push('May need to restart conversation with new context');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      recommendations
    };
  }

  /**
   * Gets optimal follow-up timing based on context
   */
  getOptimalTiming(
    conversationType: ConversationType,
    relationshipStage: RelationshipStage,
    historicalResponseTime?: number // in hours
  ): {
    recommendedDelayDays: number;
    reasoning: string;
    confidence: number;
  } {
    let recommendedDelayDays = 3; // Default
    let reasoning = '';
    let confidence = 0.7;

    // Base recommendations by conversation type
    switch (conversationType) {
      case 'proposal':
        recommendedDelayDays = 2;
        reasoning = 'Proposals typically require timely follow-up';
        confidence = 0.8;
        break;

      case 'sales_pitch':
        recommendedDelayDays = 3;
        reasoning = 'Sales follow-ups benefit from giving prospect time to consider';
        confidence = 0.7;
        break;

      case 'meeting_scheduling':
        recommendedDelayDays = 1;
        reasoning = 'Meeting scheduling requires quick follow-up';
        confidence = 0.9;
        break;

      case 'interview':
        recommendedDelayDays = 2;
        reasoning = 'Interview follow-ups should be timely but not pushy';
        confidence = 0.8;
        break;

      case 'invoice_payment':
        recommendedDelayDays = 7;
        reasoning = 'Payment follow-ups allow reasonable processing time';
        confidence = 0.9;
        break;

      case 'support_resolution':
        recommendedDelayDays = 1;
        reasoning = 'Support issues require prompt attention';
        confidence = 0.9;
        break;

      case 'partnership':
        recommendedDelayDays = 4;
        reasoning = 'Partnership discussions allow thoughtful consideration';
        confidence = 0.7;
        break;

      case 'client_onboarding':
        recommendedDelayDays = 2;
        reasoning = 'Onboarding benefits from regular check-ins';
        confidence = 0.8;
        break;

      default:
        recommendedDelayDays = 3;
        reasoning = 'Standard follow-up timing';
        confidence = 0.6;
    }

    // Adjust based on relationship stage
    switch (relationshipStage) {
      case 'cold_lead':
        recommendedDelayDays += 1;
        reasoning += '. Cold leads require more patience';
        break;

      case 'active_client':
        recommendedDelayDays = Math.max(1, recommendedDelayDays - 1);
        reasoning += '. Active clients expect quicker responses';
        confidence += 0.1;
        break;

      case 'internal_team':
        recommendedDelayDays = Math.max(1, recommendedDelayDays - 2);
        reasoning += '. Internal communication can be more direct';
        confidence += 0.1;
        break;
    }

    // Adjust based on historical response time
    if (historicalResponseTime) {
      const historicalDays = historicalResponseTime / 24;
      if (historicalDays > 0 && historicalDays < 14) {
        recommendedDelayDays = Math.round((recommendedDelayDays + historicalDays) / 2);
        reasoning += `. Adjusted based on typical response time of ${Math.round(historicalDays)} days`;
        confidence = Math.min(1, confidence + 0.2);
      }
    }

    return {
      recommendedDelayDays: Math.max(1, Math.min(14, recommendedDelayDays)),
      reasoning,
      confidence: Math.min(1, confidence)
    };
  }

  /**
   * Gets tone compatibility score
   */
  getToneCompatibilityScore(
    tone: TonePreference,
    conversationType: ConversationType,
    relationshipStage: RelationshipStage
  ): number {
    let score = 0.5; // Base score

    // Conversation type compatibility
    const typeCompatibility: Record<ConversationType, Record<TonePreference, number>> = {
      proposal: { professional: 0.9, friendly: 0.7, assertive: 0.6, polite: 0.8, direct: 0.7, concise: 0.8 },
      sales_pitch: { professional: 0.7, friendly: 0.9, assertive: 0.8, polite: 0.6, direct: 0.8, concise: 0.7 },
      meeting_scheduling: { professional: 0.7, friendly: 0.8, assertive: 0.9, polite: 0.6, direct: 0.9, concise: 0.9 },
      interview: { professional: 0.9, friendly: 0.6, assertive: 0.5, polite: 0.8, direct: 0.6, concise: 0.7 },
      invoice_payment: { professional: 0.8, friendly: 0.5, assertive: 0.9, polite: 0.7, direct: 0.9, concise: 0.8 },
      partnership: { professional: 0.8, friendly: 0.8, assertive: 0.7, polite: 0.8, direct: 0.7, concise: 0.6 },
      client_onboarding: { professional: 0.7, friendly: 0.9, assertive: 0.6, polite: 0.8, direct: 0.7, concise: 0.8 },
      support_resolution: { professional: 0.7, friendly: 0.8, assertive: 0.7, polite: 0.9, direct: 0.8, concise: 0.8 },
      followup_reminder: { professional: 0.6, friendly: 0.7, assertive: 0.8, polite: 0.7, direct: 0.9, concise: 0.9 },
      general_conversation: { professional: 0.5, friendly: 0.8, assertive: 0.6, polite: 0.7, direct: 0.6, concise: 0.7 }
    };

    score = typeCompatibility[conversationType]?.[tone] || 0.5;

    // Relationship stage compatibility
    const stageMultiplier: Record<RelationshipStage, number> = {
      cold_lead: { professional: 1.2, friendly: 1.1, assertive: 0.7, polite: 1.2, direct: 0.8, concise: 0.9 }[tone] || 1,
      warm_lead: { professional: 1.0, friendly: 1.2, assertive: 0.9, polite: 1.1, direct: 0.9, concise: 1.0 }[tone] || 1,
      active_client: { professional: 0.9, friendly: 1.1, assertive: 1.1, polite: 0.9, direct: 1.2, concise: 1.1 }[tone] || 1,
      past_client: { professional: 0.9, friendly: 1.2, assertive: 0.8, polite: 1.1, direct: 0.8, concise: 0.9 }[tone] || 1,
      recruiter: { professional: 1.2, friendly: 0.8, assertive: 0.7, polite: 1.1, direct: 0.8, concise: 0.9 }[tone] || 1,
      vendor: { professional: 0.9, friendly: 0.7, assertive: 1.1, polite: 0.8, direct: 1.2, concise: 1.1 }[tone] || 1,
      internal_team: { professional: 0.7, friendly: 1.1, assertive: 1.2, polite: 0.7, direct: 1.3, concise: 1.2 }[tone] || 1
    };

    score *= stageMultiplier[relationshipStage] || 1;

    return Math.min(1, Math.max(0, score));
  }
}
