import { 
  ThreadAnalysis, 
  AutomationDetection, 
  ConfidenceFactors, 
  FollowUpRule,
  ProcessingContext,
  DuplicateCheck 
} from './types';

export class ConfidenceScoringEngine {
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.85; // 85% minimum for auto-send
  private readonly MAX_CONFIDENCE = 100;

  /**
   * Calculates overall confidence score for follow-up eligibility
   */
  calculateConfidence(
    threadAnalysis: ThreadAnalysis,
    automationDetection: AutomationDetection,
    followUpRule: FollowUpRule,
    duplicateCheck: DuplicateCheck,
    context: ProcessingContext
  ): number {
    const factors = this.calculateConfidenceFactors(
      threadAnalysis,
      automationDetection,
      followUpRule,
      duplicateCheck,
      context
    );

    const weights = this.getFactorWeights();
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [factor, value] of Object.entries(factors)) {
      const weight = weights[factor as keyof typeof weights];
      weightedSum += value * weight;
      totalWeight += weight;
    }

    const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return Math.round(rawScore * this.MAX_CONFIDENCE) / 100;
  }

  /**
   * Calculates individual confidence factors
   */
  calculateConfidenceFactors(
    threadAnalysis: ThreadAnalysis,
    automationDetection: AutomationDetection,
    followUpRule: FollowUpRule,
    duplicateCheck: DuplicateCheck,
    context: ProcessingContext
  ): ConfidenceFactors {
    return {
      participantReciprocity: this.calculateParticipantReciprocity(threadAnalysis),
      silenceDurationScore: this.calculateSilenceDurationScore(threadAnalysis, followUpRule),
      automationRisk: this.calculateAutomationRisk(automationDetection),
      threadRecency: this.calculateThreadRecency(threadAnalysis),
      messageQuality: this.calculateMessageQuality(threadAnalysis),
      duplicateRisk: this.calculateDuplicateRisk(duplicateCheck)
    };
  }

  /**
   * Weight factors for confidence calculation
   */
  private getFactorWeights(): Record<keyof ConfidenceFactors, number> {
    return {
      participantReciprocity: 0.25,    // 25% - Back-and-forth conversation
      silenceDurationScore: 0.30,      // 30% - Appropriate silence duration
      automationRisk: 0.20,             // 20% - Not automated
      threadRecency: 0.10,             // 10% - Recent activity
      messageQuality: 0.10,            // 10% - Substantial content
      duplicateRisk: 0.05              // 5% - No duplicates
    };
  }

  /**
   * Calculates participant reciprocity score
   * Higher score for balanced back-and-forth conversations
   */
  private calculateParticipantReciprocity(threadAnalysis: ThreadAnalysis): number {
    const { messages, participants } = threadAnalysis;
    
    if (messages.length < 2) return 0.3; // Low confidence for very short threads
    
    const userParticipants = participants.filter(p => p.isUser);
    const otherParticipants = participants.filter(p => !p.isUser);
    
    if (userParticipants.length === 0 || otherParticipants.length === 0) {
      return 0.1; // Very low confidence for non-reciprocal threads
    }

    // Count messages from each participant type
    let userMessages = 0;
    let otherMessages = 0;
    
    for (const message of messages) {
      const senderEmail = this.extractEmail(message.from);
      const isUserMessage = userParticipants.some(p => p.email === senderEmail);
      
      if (isUserMessage) {
        userMessages++;
      } else {
        otherMessages++;
      }
    }

    // Calculate balance ratio
    const totalMessages = userMessages + otherMessages;
    const userRatio = userMessages / totalMessages;
    const otherRatio = otherMessages / totalMessages;
    
    // Perfect balance is 0.5/0.5
    const balanceScore = 1 - Math.abs(userRatio - 0.5) * 2;
    
    // Bonus for multiple exchanges
    const exchangeBonus = Math.min(messages.length / 10, 0.3);
    
    return Math.min(1, balanceScore + exchangeBonus);
  }

  /**
   * Calculates silence duration appropriateness score
   */
  private calculateSilenceDurationScore(threadAnalysis: ThreadAnalysis, followUpRule: FollowUpRule): number {
    const { silenceDuration } = threadAnalysis;
    const ruleHours = followUpRule.delayDays * 24;
    
    if (silenceDuration < ruleHours) {
      return 0; // Not eligible yet
    }

    // Optimal range: 1x to 3x the rule duration
    const optimalMin = ruleHours;
    const optimalMax = ruleHours * 3;
    
    if (silenceDuration >= optimalMin && silenceDuration <= optimalMax) {
      return 1.0; // Perfect timing
    }

    // Still good but less optimal: 3x to 7x the rule duration
    if (silenceDuration <= optimalMax * 2) {
      const excessRatio = (silenceDuration - optimalMax) / optimalMax;
      return 1.0 - (excessRatio * 0.3); // Gradual decrease
    }

    // Too long: score decreases rapidly
    const excessiveRatio = (silenceDuration - optimalMax * 2) / (optimalMax * 2);
    return Math.max(0.1, 0.7 - (excessiveRatio * 0.7));
  }

  /**
   * Calculates automation risk score (lower is better)
   */
  private calculateAutomationRisk(automationDetection: AutomationDetection): number {
    if (automationDetection.isAutomated) {
      // High automation confidence = very low score
      return Math.max(0, 1 - automationDetection.confidence);
    }

    // Not automated, but consider the confidence of that determination
    return 0.8 + (automationDetection.confidence * 0.2);
  }

  /**
   * Calculates thread recency score
   * Higher score for more recent threads
   */
  private calculateThreadRecency(threadAnalysis: ThreadAnalysis): number {
    const { lastMessage } = threadAnalysis;
    const now = new Date();
    const hoursSinceLastMessage = (now.getTime() - lastMessage.timestamp.getTime()) / (1000 * 60 * 60);
    
    // Very recent (under 1 week): high score
    if (hoursSinceLastMessage < 168) { // 7 days
      return 1.0;
    }

    // Recent (1-4 weeks): moderate score
    if (hoursSinceLastMessage < 672) { // 28 days
      const weeksOld = hoursSinceLastMessage / 168;
      return 1.0 - (weeksOld - 1) * 0.2;
    }

    // Old (1-3 months): low score
    if (hoursSinceLastMessage < 2160) { // 90 days
      const monthsOld = hoursSinceLastMessage / 720;
      return 0.6 - (monthsOld - 1) * 0.2;
    }

    // Very old (3+ months): very low score
    return 0.2;
  }

  /**
   * Calculates message quality score
   * Higher score for substantial, personalized content
   */
  private calculateMessageQuality(threadAnalysis: ThreadAnalysis): number {
    const { messages } = threadAnalysis;
    
    if (messages.length === 0) return 0;

    let totalQualityScore = 0;
    
    for (const message of messages) {
      const messageScore = this.calculateIndividualMessageQuality(message);
      totalQualityScore += messageScore;
    }

    return Math.min(1, totalQualityScore / messages.length);
  }

  /**
   * Calculates quality score for individual message
   */
  private calculateIndividualMessageQuality(message: any): number {
    let score = 0.5; // Base score

    // Length factor (substantial content)
    const bodyLength = message.body?.length || 0;
    if (bodyLength > 500) {
      score += 0.2;
    } else if (bodyLength > 100) {
      score += 0.1;
    }

    // Personalization indicators
    const personalizationKeywords = [
      'you', 'your', 'we', 'our', 'i think', 'i believe',
      'regarding', 'about', 'concerning', 'thank you', 'thanks'
    ];
    
    const content = (message.body + ' ' + message.subject).toLowerCase();
    const personalizationCount = personalizationKeywords.filter(keyword => 
      content.includes(keyword)
    ).length;
    
    score += Math.min(0.3, personalizationCount * 0.05);

    // Negative indicators (template-like content)
    const templateIndicators = [
      'click here', 'unsubscribe', 'promotional', 'offer expires',
      'limited time', 'act now', 'buy now'
    ];
    
    const templateCount = templateIndicators.filter(indicator => 
      content.includes(indicator)
    ).length;
    
    score -= Math.min(0.4, templateCount * 0.1);

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculates duplicate risk score
   */
  private calculateDuplicateRisk(duplicateCheck: DuplicateCheck): number {
    if (duplicateCheck.hasExistingFollowUp) {
      return 0; // Highest risk - already sent
    }

    if (duplicateCheck.hasScheduledFollowUp) {
      return 0.1; // High risk - already scheduled
    }

    if (duplicateCheck.hasDraftedFollowUp) {
      return 0.3; // Medium risk - user has draft
    }

    return 1.0; // No duplicate risk
  }

  /**
   * Determines if confidence meets threshold for auto-send
   */
  isAutoSendReady(confidenceScore: number, followUpRule: FollowUpRule): boolean {
    if (!followUpRule.autoSendEnabled) {
      return false;
    }

    return confidenceScore >= this.MIN_CONFIDENCE_THRESHOLD;
  }

  /**
   * Gets confidence level category
   */
  getConfidenceLevel(confidenceScore: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    if (confidenceScore < 0.3) return 'very_low';
    if (confidenceScore < 0.5) return 'low';
    if (confidenceScore < 0.7) return 'medium';
    if (confidenceScore < 0.85) return 'high';
    return 'very_high';
  }

  /**
   * Generates confidence explanation
   */
  generateConfidenceExplanation(
    confidenceScore: number,
    factors: ConfidenceFactors
  ): string {
    const explanations: string[] = [];
    
    if (factors.participantReciprocity > 0.8) {
      explanations.push('Strong back-and-forth conversation');
    } else if (factors.participantReciprocity < 0.4) {
      explanations.push('Limited conversation balance');
    }

    if (factors.silenceDurationScore > 0.8) {
      explanations.push('Optimal follow-up timing');
    } else if (factors.silenceDurationScore < 0.3) {
      explanations.push('Silence duration may be too short');
    }

    if (factors.automationRisk > 0.8) {
      explanations.push('Appears to be genuine conversation');
    } else if (factors.automationRisk < 0.4) {
      explanations.push('May be automated message');
    }

    if (factors.threadRecency > 0.8) {
      explanations.push('Recent thread activity');
    } else if (factors.threadRecency < 0.4) {
      explanations.push('Thread is quite old');
    }

    if (factors.messageQuality > 0.7) {
      explanations.push('High-quality message content');
    } else if (factors.messageQuality < 0.4) {
      explanations.push('Low-quality or template content');
    }

    if (factors.duplicateRisk < 0.5) {
      explanations.push('Potential duplicate follow-up');
    }

    return explanations.join('; ');
  }

  /**
   * Calculates confidence trend over time
   */
  calculateConfidenceTrend(
    historicalScores: Array<{ timestamp: Date; score: number }>
  ): 'improving' | 'declining' | 'stable' {
    if (historicalScores.length < 2) return 'stable';

    const sorted = [...historicalScores].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const recent = sorted.slice(-3); // Last 3 scores
    const older = sorted.slice(-6, -3); // 3 scores before that

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, item) => sum + item.score, 0) / recent.length;
    const olderAvg = older.reduce((sum, item) => sum + item.score, 0) / older.length;

    const difference = recentAvg - olderAvg;
    const threshold = 0.05; // 5% threshold

    if (difference > threshold) return 'improving';
    if (difference < -threshold) return 'declining';
    return 'stable';
  }

  private extractEmail(emailString: string): string {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString;
  }

  /**
   * Validates confidence score calculation
   */
  validateConfidenceScore(confidenceScore: number): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let isValid = true;

    if (confidenceScore < 0 || confidenceScore > 1) {
      warnings.push('Confidence score out of valid range [0,1]');
      isValid = false;
    }

    if (isNaN(confidenceScore)) {
      warnings.push('Confidence score is NaN');
      isValid = false;
    }

    if (!isFinite(confidenceScore)) {
      warnings.push('Confidence score is infinite');
      isValid = false;
    }

    return { isValid, warnings };
  }
}
