import { ThreadAnalysis, FollowUpRule, ProcessingContext } from './types';

export class SilenceCalculator {
  /**
   * Calculates silence duration in hours between last message and current time
   */
  calculateSilenceDuration(lastMessageTimestamp: Date, currentTime: Date = new Date()): number {
    const diffMs = currentTime.getTime() - lastMessageTimestamp.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60)); // Convert to hours
  }

  /**
   * Converts hours to days for display
   */
  hoursToDays(hours: number): number {
    return Math.round(hours * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Checks if silence duration meets the follow-up rule
   */
  meetsFollowUpRule(silenceHours: number, followUpRule: FollowUpRule): boolean {
    const ruleHours = followUpRule.delayDays * 24;
    return silenceHours >= ruleHours;
  }

  /**
   * Calculates silence score based on duration and rule
   * Higher score means more appropriate for follow-up
   */
  calculateSilenceScore(silenceHours: number, followUpRule: FollowUpRule): number {
    const ruleHours = followUpRule.delayDays * 24;
    
    if (silenceHours < ruleHours) {
      return 0; // Not eligible yet
    }

    // Score increases with time but caps at reasonable maximum
    const excessHours = silenceHours - ruleHours;
    const maxScore = 100;
    const saturationPoint = ruleHours * 2; // Score caps at 2x the rule time
    
    const score = Math.min(maxScore, (excessHours / saturationPoint) * maxScore);
    return Math.round(score * 100) / 100;
  }

  /**
   * Determines if silence is suspicious (too long might mean thread is dead)
   */
  isSilenceSuspicious(silenceHours: number, followUpRule: FollowUpRule): boolean {
    const ruleHours = followUpRule.delayDays * 24;
    const suspiciousThreshold = ruleHours * 10; // 10x the rule time
    
    return silenceHours > suspiciousThreshold;
  }

  /**
   * Gets human-readable silence duration
   */
  formatSilenceDuration(hours: number): string {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    if (hours < 24) {
      return `${Math.round(hours)} hour${Math.round(hours) !== 1 ? 's' : ''}`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    
    if (remainingHours === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    
    return `${days} day${days !== 1 ? 's' : ''}, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
  }

  /**
   * Analyzes thread silence patterns
   */
  analyzeSilencePattern(threadAnalysis: ThreadAnalysis, followUpRule: FollowUpRule): {
    currentSilence: number;
    averageResponseTime: number;
    responsePattern: 'fast' | 'normal' | 'slow' | 'irregular';
    isPatternNormal: boolean;
  } {
    const { messages, participants } = threadAnalysis;
    
    // Calculate current silence
    const lastMessage = messages[messages.length - 1];
    const currentSilence = this.calculateSilenceDuration(lastMessage.timestamp);
    
    // Calculate average response times between participants
    const responseTimes: number[] = [];
    
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];
      
      // Only count responses between different people
      if (this.extractEmail(current.from) !== this.extractEmail(previous.from)) {
        const responseTime = this.calculateSilenceDuration(previous.timestamp, current.timestamp);
        responseTimes.push(responseTime);
      }
    }
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    
    // Determine response pattern
    let responsePattern: 'fast' | 'normal' | 'slow' | 'irregular' = 'normal';
    
    if (responseTimes.length >= 2) {
      const variance = this.calculateVariance(responseTimes);
      const coefficientOfVariation = Math.sqrt(variance) / averageResponseTime;
      
      if (coefficientOfVariation > 1.5) {
        responsePattern = 'irregular';
      } else if (averageResponseTime < 2) {
        responsePattern = 'fast';
      } else if (averageResponseTime > 48) {
        responsePattern = 'slow';
      }
    }
    
    // Check if current silence is normal for this thread
    const ruleHours = followUpRule.delayDays * 24;
    const isPatternNormal = currentSilence <= Math.max(averageResponseTime * 2, ruleHours);
    
    return {
      currentSilence,
      averageResponseTime,
      responsePattern,
      isPatternNormal
    };
  }

  /**
   * Predicts optimal follow-up timing based on thread history
   */
  predictOptimalTiming(threadAnalysis: ThreadAnalysis): {
    recommendedDelayHours: number;
    confidence: number;
    reasoning: string;
  } {
    const { messages, participants } = threadAnalysis;
    
    if (messages.length < 2) {
      return {
        recommendedDelayHours: 72, // Default 3 days
        confidence: 0.3,
        reasoning: 'Insufficient message history'
      };
    }
    
    // Calculate response times between different participants
    const responseTimes: number[] = [];
    
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];
      
      if (this.extractEmail(current.from) !== this.extractEmail(previous.from)) {
        const responseTime = this.calculateSilenceDuration(previous.timestamp, current.timestamp);
        responseTimes.push(responseTime);
      }
    }
    
    if (responseTimes.length === 0) {
      return {
        recommendedDelayHours: 72,
        confidence: 0.3,
        reasoning: 'No cross-participant responses found'
      };
    }
    
    // Use median to avoid outliers
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const medianResponseTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
    
    // Add buffer time (25% extra) to avoid appearing impatient
    const recommendedDelayHours = medianResponseTime * 1.25;
    
    // Calculate confidence based on consistency
    const variance = this.calculateVariance(responseTimes);
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / medianResponseTime;
    
    let confidence = 0.5; // Base confidence
    
    if (coefficientOfVariation < 0.5) {
      confidence = 0.9; // Very consistent
    } else if (coefficientOfVariation < 1.0) {
      confidence = 0.7; // Moderately consistent
    } else if (coefficientOfVariation < 1.5) {
      confidence = 0.5; // Somewhat consistent
    } else {
      confidence = 0.3; // Very inconsistent
    }
    
    // Adjust confidence based on sample size
    if (responseTimes.length >= 5) {
      confidence = Math.min(1.0, confidence + 0.1);
    } else if (responseTimes.length < 3) {
      confidence = Math.max(0.2, confidence - 0.2);
    }
    
    let reasoning = `Based on ${responseTimes.length} response times`;
    
    if (coefficientOfVariation < 0.5) {
      reasoning += ' with very consistent patterns';
    } else if (coefficientOfVariation > 1.5) {
      reasoning += ' with irregular patterns';
    }
    
    return {
      recommendedDelayHours: Math.round(recommendedDelayHours * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      reasoning
    };
  }

  private extractEmail(emailString: string): string {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Validates silence calculation for edge cases
   */
  validateSilenceCalculation(silenceHours: number, context: ProcessingContext): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let isValid = true;

    // Check for future timestamps
    if (silenceHours < 0) {
      warnings.push('Negative silence duration detected - possible clock skew');
      isValid = false;
    }

    // Check for extremely long silence
    if (silenceHours > 8760) { // 1 year
      warnings.push('Silence duration exceeds 1 year - thread may be obsolete');
    }

    // Check for suspiciously short silence
    if (silenceHours < 0.1) { // 6 minutes
      warnings.push('Very short silence duration - possible processing error');
    }

    return { isValid, warnings };
  }
}
