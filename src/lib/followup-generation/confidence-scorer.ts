import { 
  GenerationResult, 
  QualityMetrics, 
  SafetyChecks, 
  ConversationContext,
  ClassificationResult 
} from './types';

export class ConfidenceScorer {
  private readonly weights = {
    contextClarity: 0.25,
    classificationCertainty: 0.20,
    timeDelayClarity: 0.15,
    outputSpecificity: 0.20,
    safetyCompliance: 0.15,
    humanLikeness: 0.05
  };

  private readonly thresholds = {
    excellent: 90,
    good: 75,
    acceptable: 60,
    poor: 40,
    veryPoor: 20
  };

  /**
   * Calculates comprehensive confidence score for follow-up generation
   */
  calculateConfidence(
    context: ConversationContext,
    classification: ClassificationResult,
    qualityMetrics: QualityMetrics,
    safetyChecks: SafetyChecks
  ): {
    overallScore: number;
    componentScores: ComponentScores;
    grade: ConfidenceGrade;
    autoSendReady: boolean;
    recommendations: string[];
    riskFactors: string[];
  } {
    const componentScores = this.calculateComponentScores(
      context,
      classification,
      qualityMetrics,
      safetyChecks
    );

    const overallScore = this.calculateWeightedScore(componentScores);
    const grade = this.determineGrade(overallScore);
    const autoSendReady = this.isAutoSendReady(overallScore, safetyChecks);
    const recommendations = this.generateRecommendations(componentScores, safetyChecks);
    const riskFactors = this.identifyRiskFactors(componentScores, safetyChecks);

    return {
      overallScore,
      componentScores,
      grade,
      autoSendReady,
      recommendations,
      riskFactors
    };
  }

  /**
   * Calculates individual component scores
   */
  private calculateComponentScores(
    context: ConversationContext,
    classification: ClassificationResult,
    qualityMetrics: QualityMetrics,
    safetyChecks: SafetyChecks
  ): ComponentScores {
    return {
      contextClarity: this.scoreContextClarity(context),
      classificationCertainty: this.scoreClassificationCertainty(classification),
      timeDelayClarity: this.scoreTimeDelayClarity(context),
      outputSpecificity: this.scoreOutputSpecificity(qualityMetrics),
      safetyCompliance: this.scoreSafetyCompliance(safetyChecks),
      humanLikeness: this.scoreHumanLikeness(qualityMetrics)
    };
  }

  /**
   * Scores context clarity (0-100)
   */
  private scoreContextClarity(context: ConversationContext): number {
    let score = 50; // Base score

    // Thread summary quality
    if (context.threadSummary) {
      const summaryText = typeof context.threadSummary === 'string' 
        ? context.threadSummary 
        : context.threadSummary.context || '';
      
      const summaryLength = summaryText.length;
      if (summaryLength > 50 && summaryLength < 300) {
        score += 20;
      } else if (summaryLength >= 300 && summaryLength < 500) {
        score += 10;
      }

      // Check for specific elements in summary
      const summaryElements = ['action', 'deadline', 'decision', 'next steps'];
      const foundElements = summaryElements.filter(element => 
        summaryText.toLowerCase().includes(element)
      ).length;
      score += Math.min(20, foundElements * 5);
    }

    // Message content quality
    if (context.lastUserMessage && context.lastRecipientMessage) {
      const userMessageLength = context.lastUserMessage.length;
      const recipientMessageLength = context.lastRecipientMessage.length;

      // Good message length indicates substantive conversation
      if (userMessageLength > 100 && userMessageLength < 1000) {
        score += 10;
      }
      if (recipientMessageLength > 100 && recipientMessageLength < 1000) {
        score += 10;
      }

      // Check for questions (indicates clear communication)
      if (context.lastRecipientMessage.includes('?')) {
        score += 10;
      }
    }

    // Conversation type and relationship stage clarity
    if (context.conversationType && context.relationshipStage) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Scores classification certainty (0-100)
   */
  private scoreClassificationCertainty(classification: ClassificationResult): number {
    let score = classification.confidence * 100;

    // Bonus for high confidence in both conversation type and relationship
    if (classification.confidence > 0.8) {
      score += 10;
    }

    // Penalty for low confidence
    if (classification.confidence < 0.5) {
      score -= 20;
    }

    // Check reasoning quality
    if (classification.reasoning) {
      const reasoningLength = classification.reasoning.length;
      if (reasoningLength > 50 && reasoningLength < 200) {
        score += 5;
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Scores time delay clarity (0-100)
   */
  private scoreTimeDelayClarity(context: ConversationContext): number {
    let score = 70; // Base score for having time data

    const daysSince = context.timeSinceLastMessage;

    // Optimal range for follow-up (3-10 days)
    if (daysSince >= 3 && daysSince <= 10) {
      score += 20;
    } else if (daysSince >= 1 && daysSince <= 14) {
      score += 10;
    } else if (daysSince > 30) {
      score -= 20; // Too long, may be stale
    } else if (daysSince < 1) {
      score -= 30; // Too soon, may be pushy
    }

    // Time delay category appropriateness
    const categoryScores: Record<string, number> = {
      light_nudge: 85,
      gentle_followup: 95,
      stronger_clarity: 80,
      re_engagement: 60
    };

    if (context.timeDelayCategory) {
      score = (score + categoryScores[context.timeDelayCategory]) / 2;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Scores output specificity (0-100)
   */
  private scoreOutputSpecificity(qualityMetrics: QualityMetrics): number {
    return qualityMetrics.specificityScore;
  }

  /**
   * Scores safety compliance (0-100)
   */
  private scoreSafetyCompliance(safetyChecks: SafetyChecks): number {
    let score = 100;

    if (safetyChecks.containsGenericPhrases) {
      score -= safetyChecks.genericPhrasesFound.length * 15;
    }

    if (safetyChecks.negativeSentiment) {
      score -= 30;
    }

    if (safetyChecks.urgentLanguage) {
      score -= 25;
    }

    if (safetyChecks.legalRisk) {
      score -= 40;
    }

    if (safetyChecks.flaggedWords.length > 0) {
      score -= safetyChecks.flaggedWords.length * 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Scores human likeness (0-100)
   */
  private scoreHumanLikeness(qualityMetrics: QualityMetrics): number {
    return qualityMetrics.humanLikenessScore;
  }

  /**
   * Calculates weighted overall score
   */
  private calculateWeightedScore(components: ComponentScores): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [component, score] of Object.entries(components)) {
      const weight = this.weights[component as keyof typeof this.weights];
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Determines confidence grade
   */
  private determineGrade(score: number): ConfidenceGrade {
    if (score >= this.thresholds.excellent) return 'excellent';
    if (score >= this.thresholds.good) return 'good';
    if (score >= this.thresholds.acceptable) return 'acceptable';
    if (score >= this.thresholds.poor) return 'poor';
    return 'veryPoor';
  }

  /**
   * Determines if auto-send is ready
   */
  private isAutoSendReady(score: number, safetyChecks: SafetyChecks): boolean {
    // Must have high confidence
    if (score < this.thresholds.good) {
      return false;
    }

    // Must pass all safety checks
    if (!safetyChecks.autoSendSafe) {
      return false;
    }

    // Must have good specificity
    if (score < 80) {
      return false;
    }

    return true;
  }

  /**
   * Generates improvement recommendations
   */
  private generateRecommendations(
    components: ComponentScores,
    safetyChecks: SafetyChecks
  ): string[] {
    const recommendations: string[] = [];

    // Context recommendations
    if (components.contextClarity < 70) {
      recommendations.push('Improve thread summary with more specific details');
    }

    // Classification recommendations
    if (components.classificationCertainty < 70) {
      recommendations.push('Review conversation classification for accuracy');
    }

    // Time delay recommendations
    if (components.timeDelayClarity < 70) {
      recommendations.push('Consider if timing is appropriate for follow-up');
    }

    // Specificity recommendations
    if (components.outputSpecificity < 70) {
      recommendations.push('Add more specific context to the follow-up');
    }

    // Safety recommendations
    if (components.safetyCompliance < 80) {
      if (safetyChecks.containsGenericPhrases) {
        recommendations.push('Remove generic phrases and add specific content');
      }
      if (safetyChecks.negativeSentiment) {
        recommendations.push('Use more positive and professional language');
      }
      if (safetyChecks.urgentLanguage) {
        recommendations.push('Reduce urgency and use moderate tone');
      }
    }

    // Human likeness recommendations
    if (components.humanLikeness < 70) {
      recommendations.push('Make language more natural and less robotic');
    }

    return recommendations;
  }

  /**
   * Identifies risk factors
   */
  private identifyRiskFactors(
    components: ComponentScores,
    safetyChecks: SafetyChecks
  ): string[] {
    const riskFactors: string[] = [];

    // Low component scores
    if (components.contextClarity < 50) {
      riskFactors.push('Unclear conversation context');
    }

    if (components.classificationCertainty < 50) {
      riskFactors.push('Uncertain conversation classification');
    }

    if (components.timeDelayClarity < 50) {
      riskFactors.push('Inappropriate timing for follow-up');
    }

    if (components.outputSpecificity < 50) {
      riskFactors.push('Generic or vague follow-up content');
    }

    // Safety issues
    if (safetyChecks.containsGenericPhrases) {
      riskFactors.push('Generic phrases detected');
    }

    if (safetyChecks.negativeSentiment) {
      riskFactors.push('Negative sentiment detected');
    }

    if (safetyChecks.urgentLanguage) {
      riskFactors.push('Urgent or demanding language');
    }

    if (safetyChecks.legalRisk) {
      riskFactors.push('Potential legal risk language');
    }

    return riskFactors;
  }

  /**
   * Calculates confidence trend over time
   */
  calculateConfidenceTrend(
    historicalScores: Array<{ timestamp: Date; score: number }>
  ): {
    trend: 'improving' | 'declining' | 'stable';
    changeRate: number;
    confidence: number;
  } {
    if (historicalScores.length < 2) {
      return {
        trend: 'stable',
        changeRate: 0,
        confidence: 0
      };
    }

    const sorted = [...historicalScores].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Calculate trend using linear regression
    const n = sorted.length;
    const x = sorted.map((_, i) => i);
    const y = sorted.map(s => s.score);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    let trend: 'improving' | 'declining' | 'stable';
    if (slope > 0.5) {
      trend = 'improving';
    } else if (slope < -0.5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    // Calculate confidence in trend
    const avgY = sumY / n;
    const variance = y.reduce((sum, val) => sum + Math.pow(val - avgY, 2), 0) / n;
    const confidence = variance > 0 ? Math.max(0, 1 - variance / 100) : 1;

    return {
      trend,
      changeRate: slope,
      confidence
    };
  }

  /**
   * Gets confidence statistics
   */
  getConfidenceStats(results: GenerationResult[]): {
    totalProcessed: number;
    averageConfidence: number;
    confidenceDistribution: Record<ConfidenceGrade, number>;
    autoSendRate: number;
    topRiskFactors: Array<{ factor: string; count: number }>;
  } {
    const totalProcessed = results.length;
    const averageConfidence = results.reduce((sum, r) => sum + r.confidenceScore, 0) / totalProcessed;

    const confidenceDistribution: Record<ConfidenceGrade, number> = {
      excellent: 0,
      good: 0,
      acceptable: 0,
      poor: 0,
      veryPoor: 0
    };

    const riskFactorCounts = new Map<string, number>();

    results.forEach(result => {
      // Count confidence grades
      const grade = this.determineGrade(result.confidenceScore);
      confidenceDistribution[grade]++;

      // Count risk factors
      if (result.metadata?.riskFactors) {
        result.metadata.riskFactors.forEach(factor => {
          riskFactorCounts.set(factor, (riskFactorCounts.get(factor) || 0) + 1);
        });
      }
    });

    const autoSendRate = results.filter(r => r.autoSendReady).length / totalProcessed;

    const topRiskFactors = Array.from(riskFactorCounts.entries())
      .map(([factor, count]) => ({ factor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalProcessed,
      averageConfidence,
      confidenceDistribution,
      autoSendRate,
      topRiskFactors
    };
  }

  /**
   * Validates confidence score calculation
   */
  validateConfidenceScore(score: number): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (typeof score !== 'number') {
      errors.push('Score must be a number');
    }

    if (isNaN(score)) {
      errors.push('Score cannot be NaN');
    }

    if (!isFinite(score)) {
      errors.push('Score must be finite');
    }

    if (score < 0 || score > 100) {
      errors.push('Score must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Supporting types
interface ComponentScores {
  contextClarity: number;
  classificationCertainty: number;
  timeDelayClarity: number;
  outputSpecificity: number;
  safetyCompliance: number;
  humanLikeness: number;
}

type ConfidenceGrade = 'excellent' | 'good' | 'acceptable' | 'poor' | 'veryPoor';
