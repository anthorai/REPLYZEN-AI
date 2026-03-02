import {
  AutoSendRequest,
  PreSendValidation,
  ThreadState,
  SpamRiskAnalysis,
  DailyLimitCheck,
  SentimentGuard,
  PlanEligibility,
  AutoSendDecision,
  CancellationReason,
  SpamRiskFactor,
  SentimentRisk,
  AutoSendError,
  SpamRiskError,
  DailyLimitError
} from './types';

export class PreSendValidator {
  private readonly SPAM_RISK_THRESHOLD = 75;
  private readonly MIN_SILENCE_HOURS = 1;
  private readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Executes complete pre-send validation pipeline
   */
  async validate(request: AutoSendRequest): Promise<{
    decision: AutoSendDecision;
    validation: PreSendValidation;
    cancellationReason?: CancellationReason;
    userInsight: string;
  }> {
    try {
      // STEP 1: Re-fetch latest thread state
      const currentThreadState = await this.fetchLatestThreadState(request.threadId, request.userId);

      // STEP 2: Re-confirm last sender
      const lastSenderCheck = this.validateLastSender(currentThreadState, request.userId);
      if (lastSenderCheck.isUserLastSender) {
        return {
          decision: 'CANCELLED',
          validation: this.createValidationSnapshot(currentThreadState, request),
          cancellationReason: 'user_already_replied',
          userInsight: 'Cancelled: you already replied to this thread.'
        };
      }

      // STEP 3: Re-validate silence duration
      const recalculatedSilenceDuration = this.calculateSilenceDuration(currentThreadState.lastMessageTimestamp);
      if (recalculatedSilenceDuration < request.userFollowUpRule) {
        return {
          decision: 'CANCELLED',
          validation: this.createValidationSnapshot(currentThreadState, request),
          cancellationReason: 'silence_window_invalid',
          userInsight: `Cancelled: silence window no longer valid (${Math.round(recalculatedSilenceDuration)}h < ${request.userFollowUpRule}h).`
        };
      }

      // STEP 4: Spam risk analysis
      const spamRiskAnalysis = await this.analyzeSpamRisk(request, currentThreadState);
      if (spamRiskAnalysis.isHighRisk) {
        return {
          decision: 'CANCELLED',
          validation: this.createValidationSnapshot(currentThreadState, request, spamRiskAnalysis),
          cancellationReason: 'spam_risk_high',
          userInsight: 'Cancelled: spam risk detected in follow-up pattern.'
        };
      }

      // STEP 5: Daily sending limit enforcement
      const dailyLimitCheck = await this.checkDailyLimits(request.userId, request.plan, request.dailySendLimit);
      if (dailyLimitCheck.isLimitReached) {
        return {
          decision: 'CANCELLED',
          validation: this.createValidationSnapshot(currentThreadState, request, spamRiskAnalysis, dailyLimitCheck),
          cancellationReason: 'daily_limit_reached',
          userInsight: `Cancelled: daily sending limit reached (${dailyLimitCheck.currentCount}/${dailyLimitCheck.limit}).`
        };
      }

      // STEP 6: Sentiment & risk guard
      const sentimentGuard = await this.analyzeSentimentRisks(request.threadId, currentThreadState);
      if (sentimentGuard.hasRisks && sentimentGuard.overallRiskLevel === 'high') {
        return {
          decision: 'CANCELLED',
          validation: this.createValidationSnapshot(currentThreadState, request, spamRiskAnalysis, dailyLimitCheck, sentimentGuard),
          cancellationReason: 'sensitive_conversation',
          userInsight: 'Cancelled: sensitive conversation detected.'
        };
      }

      // STEP 7: Plan eligibility check
      const planEligibility = this.checkPlanEligibility(request.plan, request.dailySendLimit);
      if (!planEligibility.isEligible) {
        return {
          decision: 'CANCELLED',
          validation: this.createValidationSnapshot(currentThreadState, request, spamRiskAnalysis, dailyLimitCheck, sentimentGuard, planEligibility),
          cancellationReason: 'plan_limit_reached',
          userInsight: planEligibility.upgradePrompt || 'Cancelled: plan does not support auto-send.'
        };
      }

      // STEP 8: Final pre-send confirmation
      const validation = this.createValidationSnapshot(
        currentThreadState,
        request,
        spamRiskAnalysis,
        dailyLimitCheck,
        sentimentGuard,
        planEligibility
      );

      return {
        decision: 'SAFE_TO_SEND',
        validation,
        userInsight: `Follow-up sent after ${Math.round(recalculatedSilenceDuration)} hours of inactivity.`
      };

    } catch (error) {
      console.error('Pre-send validation failed:', error);
      
      if (error instanceof SpamRiskError) {
        return {
          decision: 'CANCELLED',
          validation: {} as PreSendValidation,
          cancellationReason: 'spam_risk_high',
          userInsight: 'Cancelled: high spam risk detected.'
        };
      }

      if (error instanceof DailyLimitError) {
        return {
          decision: 'CANCELLED',
          validation: {} as PreSendValidation,
          cancellationReason: 'daily_limit_reached',
          userInsight: 'Cancelled: daily sending limit reached.'
        };
      }

      // For other errors, retry later
      return {
        decision: 'RETRY_LATER',
        validation: {} as PreSendValidation,
        userInsight: 'Temporarily unable to send - will retry later.'
      };
    }
  }

  /**
   * STEP 1: Fetch latest thread state from email provider
   */
  private async fetchLatestThreadState(threadId: string, userId: string): Promise<ThreadState> {
    // In production, this would call the actual email provider API
    // For now, return mock data
    return {
      threadId,
      lastMessageTimestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      lastSender: 'recipient@example.com',
      lastMessageId: 'msg_12345',
      messageCount: 5,
      recipientEmail: 'recipient@example.com',
      subject: 'Proposal Discussion',
      isRead: true,
      hasAttachments: false
    };
  }

  /**
   * STEP 2: Validate last sender
   */
  private validateLastSender(threadState: ThreadState, userId: string): {
    isUserLastSender: boolean;
    lastSenderEmail: string;
  } {
    // In production, this would check if lastSender matches user's email
    const userEmail = 'user@example.com'; // Would fetch from user profile
    const isUserLastSender = threadState.lastSender === userEmail;

    return {
      isUserLastSender,
      lastSenderEmail: threadState.lastSender
    };
  }

  /**
   * STEP 3: Recalculate silence duration
   */
  private calculateSilenceDuration(lastMessageTimestamp: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - lastMessageTimestamp.getTime();
    return diffMs / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * STEP 4: Analyze spam risk
   */
  private async analyzeSpamRisk(request: AutoSendRequest, threadState: ThreadState): Promise<SpamRiskAnalysis> {
    const riskFactors: Array<{
      factor: SpamRiskFactor;
      score: number;
      details: string;
    }> = [];

    let totalScore = 0;

    // Check frequency risk
    const frequencyRisk = await this.checkFrequencyRisk(request.userId, threadState.recipientEmail);
    if (frequencyRisk.score > 0) {
      riskFactors.push(frequencyRisk);
      totalScore += frequencyRisk.score;
    }

    // Check content risk
    const contentRisk = this.checkContentRisk(request.generatedMessage);
    if (contentRisk.score > 0) {
      riskFactors.push(contentRisk);
      totalScore += contentRisk.score;
    }

    // Check timing risk
    const timingRisk = this.checkTimingRisk(threadState.lastMessageTimestamp);
    if (timingRisk.score > 0) {
      riskFactors.push(timingRisk);
      totalScore += timingRisk.score;
    }

    // Check recipient pattern risk
    const recipientRisk = await this.checkRecipientPatternRisk(request.userId, threadState.recipientEmail);
    if (recipientRisk.score > 0) {
      riskFactors.push(recipientRisk);
      totalScore += recipientRisk.score;
    }

    // Check engagement history
    const engagementRisk = await this.checkEngagementRisk(request.userId, threadState.recipientEmail);
    if (engagementRisk.score > 0) {
      riskFactors.push(engagementRisk);
      totalScore += engagementRisk.score;
    }

    const isHighRisk = totalScore > this.SPAM_RISK_THRESHOLD;
    const recommendations = this.generateSpamRecommendations(riskFactors, isHighRisk);

    return {
      overallScore: Math.min(100, totalScore),
      riskFactors,
      threshold: this.SPAM_RISK_THRESHOLD,
      isHighRisk,
      recommendations
    };
  }

  /**
   * Check frequency risk
   */
  private async checkFrequencyRisk(userId: string, recipientEmail: string): {
    factor: SpamRiskFactor;
    score: number;
    details: string;
  } {
    // In production, this would query the database for recent sends
    const recentSends = 3; // Mock data
    const maxSafeFrequency = 2;

    if (recentSends > maxSafeFrequency) {
      return {
        factor: 'high_frequency',
        score: 30,
        details: `High frequency: ${recentSends} follow-ups sent recently`
      };
    }

    return {
      factor: 'high_frequency',
      score: 0,
      details: 'Normal frequency detected'
    };
  }

  /**
   * Check content risk
   */
  private checkContentRisk(message: string): {
    factor: SpamRiskFactor;
    score: number;
    details: string;
  } {
    let score = 0;
    const issues: string[] = [];

    // Check message length
    if (message.length < 50) {
      score += 20;
      issues.push('Message too short');
    }

    // Check for generic phrases
    const genericPhrases = ['just checking in', 'following up', 'bumping this', 'circling back'];
    const foundGeneric = genericPhrases.filter(phrase => 
      message.toLowerCase().includes(phrase)
    );
    
    if (foundGeneric.length > 0) {
      score += 25;
      issues.push(`Generic phrases: ${foundGeneric.join(', ')}`);
    }

    // Check for repetitive content
    const words = message.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = (words.length - uniqueWords.size) / words.length;
    
    if (repetitionRatio > 0.3) {
      score += 15;
      issues.push('Highly repetitive content');
    }

    // Check for spam keywords
    const spamKeywords = ['free', 'offer', 'limited time', 'act now', 'urgent'];
    const foundSpam = spamKeywords.filter(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    if (foundSpam.length > 0) {
      score += 20;
      issues.push(`Spam keywords: ${foundSpam.join(', ')}`);
    }

    return {
      factor: 'repetitive_content',
      score,
      details: issues.length > 0 ? issues.join('; ') : 'Content looks good'
    };
  }

  /**
   * Check timing risk
   */
  private checkTimingRisk(lastMessageTimestamp: Date): {
    factor: SpamRiskFactor;
    score: number;
    details: string;
  } {
    const hoursSinceLastMessage = this.calculateSilenceDuration(lastMessageTimestamp);
    let score = 0;
    let details = 'Timing is appropriate';

    if (hoursSinceLastMessage < 2) {
      score = 25;
      details = 'Very recent reply - may seem aggressive';
    } else if (hoursSinceLastMessage > 168) { // More than 1 week
      score = 15;
      details = 'Very long delay - may seem out of context';
    }

    // Check for unusual sending hours (e.g., middle of night)
    const currentHour = new Date().getHours();
    if (currentHour < 6 || currentHour > 22) {
      score += 10;
      details += '; Unusual sending hours';
    }

    return {
      factor: 'unusual_timing',
      score,
      details
    };
  }

  /**
   * Check recipient pattern risk
   */
  private async checkRecipientPatternRisk(userId: string, recipientEmail: string): {
    factor: SpamRiskFactor;
    score: number;
    details: string;
  } {
    // In production, this would analyze recipient interaction patterns
    const isNewRecipient = false; // Mock data
    const hasLowEngagement = false; // Mock data

    let score = 0;
    const issues: string[] = [];

    if (isNewRecipient) {
      score += 20;
      issues.push('New recipient - no established pattern');
    }

    if (hasLowEngagement) {
      score += 15;
      issues.push('Low historical engagement');
    }

    return {
      factor: 'new_recipient_pattern',
      score,
      details: issues.length > 0 ? issues.join('; ') : 'Normal recipient pattern'
    };
  }

  /**
   * Check engagement history
   */
  private async checkEngagementRisk(userId: string, recipientEmail: string): {
    factor: SpamRiskFactor;
    score: number;
    details: string;
  } {
    // In production, this would analyze response rates and engagement
    const responseRate = 0.8; // Mock data
    const averageResponseTime = 24; // hours

    let score = 0;
    const issues: string[] = [];

    if (responseRate < 0.3) {
      score += 25;
      issues.push('Low response rate');
    }

    if (averageResponseTime > 72) {
      score += 15;
      issues.push('Slow response patterns');
    }

    return {
      factor: 'low_engagement_history',
      score,
      details: issues.length > 0 ? issues.join('; ') : 'Good engagement history'
    };
  }

  /**
   * Generate spam recommendations
   */
  private generateSpamRecommendations(riskFactors: any[], isHighRisk: boolean): string[] {
    const recommendations: string[] = [];

    if (isHighRisk) {
      recommendations.push('Consider manual review before sending');
      recommendations.push('Review sending frequency patterns');
    }

    riskFactors.forEach(factor => {
      if (factor.factor === 'high_frequency') {
        recommendations.push('Reduce follow-up frequency');
      }
      if (factor.factor === 'repetitive_content') {
        recommendations.push('Add more specific, personalized content');
      }
      if (factor.factor === 'unusual_timing') {
        recommendations.push('Consider sending during business hours');
      }
    });

    return recommendations;
  }

  /**
   * STEP 5: Check daily sending limits
   */
  private async checkDailyLimits(
    userId: string, 
    plan: 'free' | 'pro' | 'enterprise', 
    dailyLimit: number
  ): Promise<DailyLimitCheck> {
    // In production, this would query the database for today's usage
    const currentCount = await this.getTodaySentCount(userId);
    const remaining = Math.max(0, dailyLimit - currentCount);
    const isLimitReached = currentCount >= dailyLimit;

    // Calculate usage pattern
    const last24Hours = currentCount;
    const last7Days = await this.getLast7DaysCount(userId);
    const averagePerDay = last7Days / 7;

    // Reset time is next midnight
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const resetTime = tomorrow;

    return {
      currentCount,
      limit: dailyLimit,
      remaining,
      isLimitReached,
      resetTime,
      usagePattern: {
        last24Hours,
        last7Days,
        averagePerDay
      }
    };
  }

  /**
   * Get today's sent count
   */
  private async getTodaySentCount(userId: string): Promise<number> {
    // In production, this would query the database
    return 15; // Mock data
  }

  /**
   * Get last 7 days count
   */
  private async getLast7DaysCount(userId: string): Promise<number> {
    // In production, this would query the database
    return 85; // Mock data
  }

  /**
   * STEP 6: Analyze sentiment risks
   */
  private async analyzeSentimentRisks(threadId: string, threadState: ThreadState): Promise<SentimentGuard> {
    const detectedRisks: Array<{
      type: SentimentRisk;
      confidence: number;
      evidence: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // In production, this would use NLP to analyze thread content
    // For now, check basic patterns

    // Check for legal dispute signals
    const legalKeywords = ['lawsuit', 'legal', 'attorney', 'sue', 'dispute'];
    const hasLegalRisk = legalKeywords.some(keyword => 
      threadState.subject.toLowerCase().includes(keyword)
    );

    if (hasLegalRisk) {
      detectedRisks.push({
        type: 'legal_dispute',
        confidence: 0.8,
        evidence: 'Legal keywords detected in subject',
        severity: 'high'
      });
    }

    // Check for refund escalation
    const refundKeywords = ['refund', 'money back', 'chargeback', 'complaint'];
    const hasRefundRisk = refundKeywords.some(keyword => 
      threadState.subject.toLowerCase().includes(keyword)
    );

    if (hasRefundRisk) {
      detectedRisks.push({
        type: 'refund_escalation',
        confidence: 0.7,
        evidence: 'Refund-related keywords detected',
        severity: 'high'
      });
    }

    // Check for angry sentiment
    const angryKeywords = ['angry', 'frustrated', 'upset', 'disappointed'];
    const hasAngryRisk = angryKeywords.some(keyword => 
      threadState.subject.toLowerCase().includes(keyword)
    );

    if (hasAngryRisk) {
      detectedRisks.push({
        type: 'angry_sentiment',
        confidence: 0.6,
        evidence: 'Negative sentiment indicators',
        severity: 'medium'
      });
    }

    const hasRisks = detectedRisks.length > 0;
    const highRiskCount = detectedRisks.filter(r => r.severity === 'high').length;
    const overallRiskLevel = highRiskCount > 0 ? 'high' : 
                           detectedRisks.some(r => r.severity === 'medium') ? 'medium' : 'low';

    let recommendation = 'Safe to proceed';
    if (overallRiskLevel === 'high') {
      recommendation = 'Manual review recommended - sensitive conversation detected';
    } else if (overallRiskLevel === 'medium') {
      recommendation = 'Proceed with caution - monitor for escalation';
    }

    return {
      hasRisks,
      detectedRisks,
      overallRiskLevel,
      recommendation
    };
  }

  /**
   * STEP 7: Check plan eligibility
   */
  private checkPlanEligibility(plan: 'free' | 'pro' | 'enterprise', dailyLimit: number): PlanEligibility {
    const planFeatures = {
      free: {
        autoSendEnabled: false,
        dailyLimit: 0,
        features: ['Manual follow-ups only'],
        upgradePrompt: 'Upgrade to Pro to enable safe auto-send.',
        restrictions: ['Auto-send not available on Free plan']
      },
      pro: {
        autoSendEnabled: true,
        dailyLimit: 50,
        features: ['Auto-send', 'Advanced filtering', 'Daily limits'],
        upgradePrompt: undefined,
        restrictions: ['Daily sending limits apply']
      },
      enterprise: {
        autoSendEnabled: true,
        dailyLimit: 1000,
        features: ['Unlimited auto-send', 'Priority processing', 'Advanced analytics'],
        upgradePrompt: undefined,
        restrictions: []
      }
    };

    const features = planFeatures[plan];
    
    return {
      isEligible: features.autoSendEnabled,
      plan,
      autoSendEnabled: features.autoSendEnabled,
      dailyLimit: features.dailyLimit,
      features: features.features,
      upgradePrompt: features.upgradePrompt,
      restrictions: features.restrictions
    };
  }

  /**
   * Create validation snapshot
   */
  private createValidationSnapshot(
    threadState: ThreadState,
    request: AutoSendRequest,
    spamRiskAnalysis?: SpamRiskAnalysis,
    dailyLimitCheck?: DailyLimitCheck,
    sentimentGuard?: SentimentGuard,
    planEligibility?: PlanEligibility
  ): PreSendValidation {
    return {
      currentThreadState: threadState,
      recalculatedSilenceDuration: this.calculateSilenceDuration(threadState.lastMessageTimestamp),
      lastSenderCheck: this.validateLastSender(threadState, request.userId),
      spamRiskAnalysis: spamRiskAnalysis || {
        overallScore: 0,
        riskFactors: [],
        threshold: this.SPAM_RISK_THRESHOLD,
        isHighRisk: false,
        recommendations: []
      },
      dailyLimitCheck: dailyLimitCheck || {
        currentCount: 0,
        limit: request.dailySendLimit,
        remaining: request.dailySendLimit,
        isLimitReached: false,
        resetTime: new Date(),
        usagePattern: {
          last24Hours: 0,
          last7Days: 0,
          averagePerDay: 0
        }
      },
      sentimentGuard: sentimentGuard || {
        hasRisks: false,
        detectedRisks: [],
        overallRiskLevel: 'low',
        recommendation: 'Safe to proceed'
      },
      planEligibility: planEligibility || this.checkPlanEligibility(request.plan, request.dailySendLimit)
    };
  }
}
