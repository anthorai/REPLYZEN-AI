import { ConversationType, RelationshipStage, ClassificationResult, ExtractedMessage } from './types';

export class ConversationClassifier {
  private readonly conversationPatterns: Record<ConversationType, {
    keywords: string[];
    patterns: RegExp[];
    context: string[];
    weight: number;
  }> = {
    proposal: {
      keywords: [
        'proposal', 'proposed', 'proposing', 'submit proposal', 'proposal draft',
        'proposal for', 'business proposal', 'project proposal', 'service proposal'
      ],
      patterns: [
        /\b(proposal|proposed|proposing)\b/gi,
        /\b(submit|send|share|provide).{0,20}proposal\b/gi,
        /\bproposal.{0,30}(for|regarding|concerning)\b/gi
      ],
      context: ['business', 'project', 'service', 'partnership', 'collaboration'],
      weight: 1.0
    },
    sales_pitch: {
      keywords: [
        'sales', 'pitch', 'presentation', 'demo', 'product', 'service',
        'solution', 'offering', 'package', 'pricing', 'cost', 'investment'
      ],
      patterns: [
        /\b(sales|pitch|presentation|demo)\b/gi,
        /\b(product|service|solution|offering)\b/gi,
        /\b(pricing|cost|investment|package)\b/gi
      ],
      context: ['customer', 'client', 'prospect', 'lead', 'opportunity'],
      weight: 1.0
    },
    meeting_scheduling: {
      keywords: [
        'meeting', 'schedule', 'call', 'appointment', 'zoom', 'teams',
        'google meet', 'calendar', 'availability', 'time slot', 'discuss'
      ],
      patterns: [
        /\b(meeting|call|appointment|zoom|teams)\b/gi,
        /\b(schedule|reschedule|availability|time slot)\b/gi,
        /\b(discuss|talk|review|go over)\b/gi
      ],
      context: ['calendar', 'availability', 'timing', 'coordination'],
      weight: 1.0
    },
    interview: {
      keywords: [
        'interview', 'candidate', 'position', 'role', 'job', 'hiring',
        'recruiter', 'application', 'resume', 'cv', 'screening', 'technical'
      ],
      patterns: [
        /\b(interview|candidate|position|role)\b/gi,
        /\b(hiring|recruiter|application|resume|cv)\b/gi,
        /\b(screening|technical|phone|video)\b/gi
      ],
      context: ['employment', 'career', 'opportunity', 'team'],
      weight: 1.0
    },
    invoice_payment: {
      keywords: [
        'invoice', 'payment', 'bill', 'billing', 'charge', 'fee',
        'receipt', 'transaction', 'pay', 'paid', 'unpaid', 'overdue'
      ],
      patterns: [
        /\b(invoice|payment|bill|billing|charge|fee)\b/gi,
        /\b(receipt|transaction|pay|paid|unpaid|overdue)\b/gi,
        /\b(#{1,3}\s*\d{1,6})\b/g // Invoice numbers
      ],
      context: ['finance', 'accounting', 'business', 'service'],
      weight: 1.0
    },
    partnership: {
      keywords: [
        'partnership', 'partner', 'collaborate', 'collaboration', 'joint',
        'venture', 'alliance', 'cooperation', 'synergy', 'strategic'
      ],
      patterns: [
        /\b(partnership|partner|collaborate|collaboration)\b/gi,
        /\b(joint|venture|alliance|cooperation|synergy)\b/gi,
        /\b(strategic|business|technical)\b.{0,20}(partnership|partner)\b/gi
      ],
      context: ['business', 'growth', 'opportunity', 'mutual benefit'],
      weight: 1.0
    },
    client_onboarding: {
      keywords: [
        'onboarding', 'onboard', 'setup', 'configure', 'implementation',
        'integration', 'training', 'getting started', 'welcome', 'introduction'
      ],
      patterns: [
        /\b(onboarding|onboard|setup|configure|implementation)\b/gi,
        /\b(integration|training|getting started|welcome|introduction)\b/gi,
        /\b(step|guide|tutorial|walkthrough)\b/gi
      ],
      context: ['new client', 'customer', 'user', 'account', 'service'],
      weight: 1.0
    },
    support_resolution: {
      keywords: [
        'support', 'help', 'issue', 'problem', 'troubleshoot', 'fix',
        'resolve', 'resolution', 'ticket', 'case', 'bug', 'error'
      ],
      patterns: [
        /\b(support|help|issue|problem|troubleshoot|fix)\b/gi,
        /\b(resolve|resolution|ticket|case|bug|error)\b/gi,
        /\b(#{1,3}\s*\d{4,8})\b/gi // Ticket numbers
      ],
      context: ['customer', 'technical', 'service', 'assistance'],
      weight: 1.0
    },
    followup_reminder: {
      keywords: [
        'follow up', 'followup', 'checking in', 'reminder', 'update',
        'status', 'progress', 'next steps', 'moving forward'
      ],
      patterns: [
        /\b(follow.?up|checking in|reminder|update)\b/gi,
        /\b(status|progress|next steps|moving forward)\b/gi,
        /\b(just|wanted to|circling back|touching base)\b/gi
      ],
      context: ['continuation', 'progress', 'status', 'next action'],
      weight: 0.8
    },
    general_conversation: {
      keywords: [],
      patterns: [],
      context: [],
      weight: 0.1
    }
  };

  private readonly relationshipPatterns: Record<RelationshipStage, {
    indicators: string[];
    emailPatterns: RegExp[];
    context: string[];
    messageCount: [number, number]; // [min, max]
  }> = {
    cold_lead: {
      indicators: [
        'introduction', 'reaching out', 'first time', 'new opportunity',
        'found you', 'came across', 'interested in', 'exploring', 'potential'
      ],
      emailPatterns: [
        /^info@/i, /^hello@/i, /^contact@/i,
        /\.com$/i, /\.net$/i, /\.org$/i
      ],
      context: ['prospect', 'lead', 'opportunity', 'outreach'],
      messageCount: [1, 3]
    },
    warm_lead: {
      indicators: [
        'following up', 'interested', 'considering', 'evaluating',
        'proposal', 'demo', 'meeting', 'discussion', 'next steps'
      ],
      emailPatterns: [
        /^[a-z]+@[a-z]+/i // More personal email patterns
      ],
      context: ['engaged', 'responsive', 'interested', 'evaluating'],
      messageCount: [3, 10]
    },
    active_client: {
      indicators: [
        'project', 'ongoing', 'current', 'active', 'working with',
        'collaboration', 'partnership', 'service', 'delivery', 'implementation'
      ],
      emailPatterns: [
        /@company\./i, /@business\./i, /@corp\./i
      ],
      context: ['client', 'customer', 'partner', 'active'],
      messageCount: [5, 100]
    },
    past_client: {
      indicators: [
        'previously', 'past', 'former', 'completed', 'finished',
        'thank you for', 'appreciate working with', 'wrap up', 'conclude'
      ],
      emailPatterns: [
        /@gmail\.com/i, /@yahoo\.com/i, /@outlook\.com/i
      ],
      context: ['completed', 'finished', 'concluded', 'historical'],
      messageCount: [10, 1000]
    },
    recruiter: {
      indicators: [
        'recruiter', 'recruiting', 'hiring', 'position', 'role',
        'candidate', 'interview', 'job', 'career', 'opportunity'
      ],
      emailPatterns: [
        /@linkedin\.com/i, /recruiter@/i, /talent@/i, /careers@/i
      ],
      context: ['employment', 'hiring', 'recruitment', 'career'],
      messageCount: [2, 20]
    },
    vendor: {
      indicators: [
        'vendor', 'supplier', 'provider', 'service', 'product',
        'invoice', 'billing', 'payment', 'contract', 'agreement'
      ],
      emailPatterns: [
        /@vendor\./i, /@supplier\./i, /billing@/i, /support@/i, /sales@/i
      ],
      context: ['business', 'service', 'commercial', 'transaction'],
      messageCount: [3, 50]
    },
    internal_team: {
      indicators: [
        'team', 'internal', 'colleague', 'coworker', 'staff',
        'department', 'project', 'update', 'meeting', 'collaboration'
      ],
      emailPatterns: [
        /@company\.com$/i, /@internal\./i, /@team\./i
      ],
      context: ['internal', 'team', 'colleague', 'organization'],
      messageCount: [5, 1000]
    }
  };

  /**
   * Classifies conversation type and relationship stage
   */
  classifyConversation(messages: ExtractedMessage[], userEmail: string): ClassificationResult {
    const conversationType = this.classifyConversationType(messages);
    const relationshipStage = this.classifyRelationshipStage(messages, userEmail);
    
    // Calculate overall confidence
    const confidence = (conversationType.confidence + relationshipStage.confidence) / 2;
    
    return {
      conversationType: conversationType.type,
      relationshipStage: relationshipStage.type,
      confidence,
      reasoning: `${conversationType.reasoning}. ${relationshipStage.reasoning}`,
      alternativeTypes: this.getAlternativeTypes(conversationType, relationshipStage)
    };
  }

  /**
   * Classifies the type of conversation
   */
  private classifyConversationType(messages: ExtractedMessage[]): {
    type: ConversationType;
    confidence: number;
    reasoning: string;
  } {
    const allText = messages.map(msg => msg.body).join(' ').toLowerCase();
    const scores = new Map<ConversationType, number>();

    // Score each conversation type
    for (const [type, config] of Object.entries(this.conversationPatterns)) {
      let score = 0;
      const matches: string[] = [];

      // Keyword matching
      for (const keyword of config.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const keywordMatches = allText.match(regex);
        if (keywordMatches) {
          score += keywordMatches.length * config.weight;
          matches.push(...keywordMatches);
        }
      }

      // Pattern matching
      for (const pattern of config.patterns) {
        const patternMatches = allText.match(pattern);
        if (patternMatches) {
          score += patternMatches.length * config.weight * 1.5; // Patterns weight more
          matches.push(...patternMatches);
        }
      }

      // Context matching
      for (const context of config.context) {
        if (allText.includes(context)) {
          score += config.weight * 0.5;
          matches.push(context);
        }
      }

      scores.set(type as ConversationType, score);
    }

    // Find the best match
    const sortedScores = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]);

    const topType = sortedScores[0];
    const topScore = topType[1];
    const topTypeKey = topType[0] as ConversationType;

    // Calculate confidence based on score gap
    const secondScore = sortedScores[1]?.[1] || 0;
    const scoreGap = topScore - secondScore;
    const maxPossibleScore = 10; // Approximate max score
    const confidence = Math.min(1, (topScore / maxPossibleScore) + (scoreGap / maxPossibleScore));

    const reasoning = this.generateReasoning(topTypeKey, topScore, messages);

    return {
      type: topTypeKey,
      confidence,
      reasoning
    };
  }

  /**
   * Classifies the relationship stage
   */
  private classifyRelationshipStage(messages: ExtractedMessage[], userEmail: string): {
    type: RelationshipStage;
    confidence: number;
    reasoning: string;
  } {
    const allText = messages.map(msg => msg.body).join(' ').toLowerCase();
    const recipientEmails = this.extractRecipientEmails(messages, userEmail);
    const messageCount = messages.length;

    const scores = new Map<RelationshipStage, number>();

    // Score each relationship stage
    for (const [stage, config] of Object.entries(this.relationshipPatterns)) {
      let score = 0;

      // Indicator matching
      for (const indicator of config.indicators) {
        if (allText.includes(indicator)) {
          score += 1;
        }
      }

      // Email pattern matching
      for (const pattern of config.emailPatterns) {
        for (const email of recipientEmails) {
          if (pattern.test(email)) {
            score += 0.5;
          }
        }
      }

      // Context matching
      for (const context of config.context) {
        if (allText.includes(context)) {
          score += 0.3;
        }
      }

      // Message count appropriateness
      if (messageCount >= config.messageCount[0] && messageCount <= config.messageCount[1]) {
        score += 0.5;
      }

      scores.set(stage as RelationshipStage, score);
    }

    // Find the best match
    const sortedScores = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]);

    const topStage = sortedScores[0];
    const topScore = topStage[1];
    const topStageKey = topStage[0] as RelationshipStage;

    // Calculate confidence
    const maxPossibleScore = 5;
    const confidence = Math.min(1, topScore / maxPossibleScore);

    const reasoning = this.generateRelationshipReasoning(topStageKey, messageCount, recipientEmails);

    return {
      type: topStageKey,
      confidence,
      reasoning
    };
  }

  /**
   * Extracts recipient email addresses
   */
  private extractRecipientEmails(messages: ExtractedMessage[], userEmail: string): string[] {
    const emails = new Set<string>();
    
    for (const message of messages) {
      if (!message.isFromUser) {
        const emailMatch = message.from.match(/<([^>]+)>/);
        if (emailMatch) {
          emails.add(emailMatch[1].toLowerCase());
        }
      }
    }

    return Array.from(emails);
  }

  /**
   * Generates reasoning for conversation type classification
   */
  private generateReasoning(type: ConversationType, score: number, messages: ExtractedMessage[]): string {
    const config = this.conversationPatterns[type];
    const lastMessage = messages[messages.length - 1].body.toLowerCase();
    
    let reasoning = `Identified as ${type.replace('_', ' ')}`;

    // Add specific evidence
    const evidence: string[] = [];
    
    for (const keyword of config.keywords) {
      if (lastMessage.includes(keyword)) {
        evidence.push(keyword);
      }
    }

    if (evidence.length > 0) {
      reasoning += ` based on keywords: ${evidence.join(', ')}`;
    }

    if (score > 5) {
      reasoning += ' with high confidence';
    } else if (score > 2) {
      reasoning += ' with moderate confidence';
    } else {
      reasoning += ' with low confidence';
    }

    return reasoning;
  }

  /**
   * Generates reasoning for relationship stage classification
   */
  private generateRelationshipReasoning(stage: RelationshipStage, messageCount: number, emails: string[]): string {
    const config = this.relationshipPatterns[stage];
    
    let reasoning = `Relationship identified as ${stage.replace('_', ' ')}`;
    
    if (messageCount >= config.messageCount[0] && messageCount <= config.messageCount[1]) {
      reasoning += ` (message count: ${messageCount})`;
    }

    if (emails.length > 0) {
      reasoning += ` based on communication patterns`;
    }

    return reasoning;
  }

  /**
   * Gets alternative classification types
   */
  private getAlternativeTypes(
    conversationType: { type: ConversationType; confidence: number },
    relationshipStage: { type: RelationshipStage; confidence: number }
  ): Array<{ type: ConversationType; confidence: number }> {
    // For now, return empty array - could be expanded to provide alternatives
    return [];
  }

  /**
   * Validates classification result
   */
  validateClassification(result: ClassificationResult): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (result.confidence < 0.3) {
      issues.push('Very low confidence in classification');
      suggestions.push('Consider manual review or more context');
    }

    if (result.conversationType === 'general_conversation') {
      suggestions.push('Review if conversation fits a more specific category');
    }

    if (result.relationshipStage === 'cold_lead' && result.confidence < 0.5) {
      suggestions.push('Verify if this is truly a cold lead or existing contact');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Gets classification statistics
   */
  getClassificationStats(messages: ExtractedMessage[]): {
    messageCount: number;
    uniqueParticipants: number;
    averageMessageLength: number;
    totalWords: number;
    hasQuestions: boolean;
    hasAttachments: boolean;
    timeSpan: number; // in hours
  } {
    const messageCount = messages.length;
    const participants = new Set(messages.map(m => m.from));
    const totalLength = messages.reduce((sum, m) => sum + m.body.length, 0);
    const averageLength = totalLength / messageCount;
    const totalWords = messages.reduce((sum, m) => sum + m.body.split(/\s+/).length, 0);
    const hasQuestions = messages.some(m => m.body.includes('?'));
    const hasAttachments = messages.some(m => 
      m.body.toLowerCase().includes('attach') || 
      m.body.toLowerCase().includes('file')
    );

    const timestamps = messages.map(m => new Date(m.timestamp).getTime());
    const timeSpan = timestamps.length > 1 
      ? (Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60)
      : 0;

    return {
      messageCount,
      uniqueParticipants: participants.size,
      averageMessageLength: averageLength,
      totalWords,
      hasQuestions,
      hasAttachments,
      timeSpan
    };
  }

  /**
   * Batch classification for multiple threads
   */
  classifyBatch(threadMessages: Array<{ threadId: string; messages: ExtractedMessage[]; userEmail: string }>): Array<{
    threadId: string;
    classification: ClassificationResult;
    stats: ReturnType<typeof this.getClassificationStats>;
  }> {
    return threadMessages.map(({ threadId, messages, userEmail }) => ({
      threadId,
      classification: this.classifyConversation(messages, userEmail),
      stats: this.getClassificationStats(messages)
    }));
  }
}
