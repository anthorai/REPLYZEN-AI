import { SafetyChecks, QualityMetrics, GenerationResult } from './types';

export class QualityFilter {
  private readonly genericPhrases = [
    'just checking in',
    'checking in',
    'bumping this up',
    'bumping this',
    'following up on the below',
    'following up on',
    'any updates',
    'any update',
    'kind reminder',
    'gentle reminder',
    'circling back',
    'touching base',
    'wanted to follow up',
    'just wanted to follow up',
    'hope you\'re doing well',
    'hope this email finds you well',
    'let me know if you have any questions',
    'please let me know',
    'looking forward to hearing from you',
    'look forward to hearing from you',
    'best regards',
    'regards',
    'sincerely',
    'thank you for your time',
    'thanks for your time',
    'appreciate your time',
    'no rush',
    'no worries',
    'don\'t hesitate',
    'feel free',
    'if you need anything',
    'should you have any questions'
  ];

  private readonly forbiddenPatterns = [
    /\b(just checking|checking in|bumping|circling back|touching base)\b/gi,
    /\b(following up|followup|follow up)\s+(on|below|the below)\b/gi,
    /\b(any updates?|kind reminder|gentle reminder)\b/gi,
    /\b(hope you\'re doing well|hope this email finds you well)\b/gi,
    /\b(looking forward to hearing|look forward to hearing)\b/gi,
    /\b(no rush|no worries|don\'t hesitate|feel free)\b/gi,
    /\b(should you have|if you need|please let me know)\b/gi,
    /\b(thank you for your time|thanks for your time)\b/gi,
    /\b(appreciate your time|appreciate you taking the time)\b/gi
  ];

  private readonly qualityThresholds = {
    minSpecificity: 70,
    minContextuality: 75,
    minHumanLikeness: 80,
    minAppropriateness: 70,
    maxGenericPhrases: 1,
    maxWordCount: 150,
    minWordCount: 15,
    maxSentenceLength: 25
  };

  /**
   * Filters generated follow-up for quality and safety
   */
  filterQuality(generatedText: string, context?: any): {
    passed: boolean;
    safetyChecks: SafetyChecks;
    qualityMetrics: QualityMetrics;
    issues: string[];
    suggestions: string[];
  } {
    const safetyChecks = this.performSafetyChecks(generatedText);
    const qualityMetrics = this.calculateQualityMetrics(generatedText, context);
    const issues = this.identifyIssues(safetyChecks, qualityMetrics);
    const suggestions = this.generateSuggestions(safetyChecks, qualityMetrics, issues);

    const passed = this.determinePassStatus(safetyChecks, qualityMetrics);

    return {
      passed,
      safetyChecks,
      qualityMetrics,
      issues,
      suggestions
    };
  }

  /**
   * Performs safety checks on generated text
   */
  private performSafetyChecks(text: string): SafetyChecks {
    const genericPhrasesFound = this.detectGenericPhrases(text);
    const negativeSentiment = this.detectNegativeSentiment(text);
    const urgentLanguage = this.detectUrgentLanguage(text);
    const legalRisk = this.detectLegalRisk(text);
    const flaggedWords = this.detectFlaggedWords(text);

    const containsGenericPhrases = genericPhrasesFound.length > 0;
    const autoSendSafe = !containsGenericPhrases && 
                        !negativeSentiment && 
                        !urgentLanguage && 
                        !legalRisk &&
                        flaggedWords.length === 0;

    let recommendedAction: 'send' | 'review' | 'regenerate' | 'manual_only' = 'send';

    if (containsGenericPhrases && genericPhrasesFound.length > 2) {
      recommendedAction = 'regenerate';
    } else if (containsGenericPhrases) {
      recommendedAction = 'review';
    } else if (negativeSentiment || urgentLanguage || legalRisk) {
      recommendedAction = 'manual_only';
    } else if (flaggedWords.length > 0) {
      recommendedAction = 'review';
    }

    return {
      containsGenericPhrases,
      genericPhrasesFound,
      negativeSentiment,
      urgentLanguage,
      legalRisk,
      autoSendSafe,
      flaggedWords,
      recommendedAction
    };
  }

  /**
   * Detects generic phrases in text
   */
  private detectGenericPhrases(text: string): string[] {
    const found: string[] = [];
    const lowerText = text.toLowerCase();

    for (const phrase of this.genericPhrases) {
      if (lowerText.includes(phrase)) {
        found.push(phrase);
      }
    }

    // Check for patterns
    for (const pattern of this.forbiddenPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        found.push(...matches.map(m => m.toLowerCase()));
      }
    }

    return [...new Set(found)]; // Remove duplicates
  }

  /**
   * Detects negative sentiment in text
   */
  private detectNegativeSentiment(text: string): boolean {
    const negativePatterns = [
      /\b(unhappy|disappointed|frustrated|angry|upset|annoyed)\b/gi,
      /\b(problem|issue|trouble|difficulty|concern|complaint)\b/gi,
      /\b(failed|failure|mistake|error|wrong|incorrect)\b/gi,
      /\b(cancel|terminate|end|stop|discontinue)\b/gi,
      /\b(dissatisfied|unsatisfied|poor|bad|terrible)\b/gi
    ];

    return negativePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Detects urgent or demanding language
   */
  private detectUrgentLanguage(text: string): boolean {
    const urgentPatterns = [
      /\b(urgent|immediately|asap|right away|now|emergency)\b/gi,
      /\b(must|require|demand|need|immediate)\b/gi,
      /\b(critical|crucial|vital|essential|non-negotiable)\b/gi,
      /\b(final|last chance|deadline|overdue)\b/gi,
      /\b(!{2,})/g // Multiple exclamation marks
    ];

    return urgentPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Detects potential legal risk language
   */
  private detectLegalRisk(text: string): boolean {
    const legalPatterns = [
      /\b(lawsuit|legal|attorney|lawyer|court|sue|litigation)\b/gi,
      /\b(contract|agreement|breach|violation|dispute)\b/gi,
      /\b(refund|compensation|damages|liability|responsibility)\b/gi,
      /\b(guarantee|warranty|promise|commitment|binding)\b/gi,
      /\b(terminate|cancel|penalty|fine|consequence)\b/gi
    ];

    return legalPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Detects flagged words that might indicate issues
   */
  private detectFlaggedWords(text: string): string[] {
    const flaggedWords = [
      'free', 'discount', 'promotion', 'offer', 'deal',
      'spam', 'scam', 'fake', 'fraud', 'hoax',
      'unsubscribe', 'opt-out', 'marketing', 'advertisement'
    ];

    const lowerText = text.toLowerCase();
    return flaggedWords.filter(word => lowerText.includes(word));
  }

  /**
   * Calculates quality metrics for generated text
   */
  private calculateQualityMetrics(text: string, context?: any): QualityMetrics {
    const specificityScore = this.calculateSpecificityScore(text, context);
    const contextualityScore = this.calculateContextualityScore(text, context);
    const humanLikenessScore = this.calculateHumanLikenessScore(text);
    const concisenessScore = this.calculateConcisenessScore(text);
    const appropriatenessScore = this.calculateAppropriatenessScore(text, context);

    const wordCount = text.split(/\s+/).length;
    const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;

    const overallQuality = (
      specificityScore * 0.25 +
      contextualityScore * 0.25 +
      humanLikenessScore * 0.2 +
      concisenessScore * 0.15 +
      appropriatenessScore * 0.15
    );

    return {
      specificityScore,
      contextualityScore,
      humanLikenessScore,
      concisenessScore,
      appropriatenessScore,
      overallQuality,
      wordCount,
      sentenceCount,
      avgSentenceLength
    };
  }

  /**
   * Calculates specificity score (how specific and contextual the message is)
   */
  private calculateSpecificityScore(text: string, context?: any): number {
    let score = 50; // Base score

    // Check for specific details
    const specificIndicators = [
      /\b(proposal|contract|invoice|meeting|call|interview)\b/gi,
      /\b(\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}|monday|tuesday|wednesday|thursday|friday)\b/gi,
      /\b(\$|€|£|price|cost|budget|amount)\b/gi,
      /\b(project|initiative|deadline|timeline|next steps)\b/gi
    ];

    specificIndicators.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length * 10;
      }
    });

    // Penalize generic phrases
    const genericCount = this.detectGenericPhrases(text).length;
    score -= genericCount * 15;

    // Check for context references
    if (context?.threadSummary) {
      const summaryWords = context.threadSummary.toLowerCase().split(/\s+/);
      const textWords = text.toLowerCase().split(/\s+/);
      const overlap = summaryWords.filter(word => 
        textWords.includes(word) && word.length > 3
      ).length;
      score += Math.min(20, overlap * 5);
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculates contextuality score (how well it relates to the conversation)
   */
  private calculateContextualityScore(text: string, context?: any): number {
    let score = 40; // Base score

    if (!context) return score;

    // Check conversation type relevance
    const typeKeywords: Record<string, string[]> = {
      proposal: ['proposal', 'propose', 'offer', 'terms', 'conditions'],
      sales_pitch: ['product', 'service', 'solution', 'benefits', 'features'],
      meeting_scheduling: ['meeting', 'call', 'schedule', 'time', 'availability'],
      interview: ['interview', 'position', 'role', 'candidate', 'hiring'],
      invoice_payment: ['invoice', 'payment', 'bill', 'due', 'amount'],
      partnership: ['partnership', 'partner', 'collaborate', 'opportunity'],
      client_onboarding: ['onboard', 'setup', 'getting started', 'welcome'],
      support_resolution: ['support', 'help', 'issue', 'resolve', 'fix']
    };

    const keywords = typeKeywords[context.conversationType] || [];
    const keywordMatches = keywords.filter(keyword => 
      text.toLowerCase().includes(keyword)
    ).length;
    score += keywordMatches * 15;

    // Check relationship stage appropriateness
    if (context.relationshipStage === 'cold_lead') {
      const coldIndicators = ['introduction', 'reaching out', 'opportunity', 'potential'];
      const coldMatches = coldIndicators.filter(indicator => 
        text.toLowerCase().includes(indicator)
      ).length;
      score += coldMatches * 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculates human likeness score
   */
  private calculateHumanLikenessScore(text: string): number {
    let score = 60; // Base score

    // Natural language indicators
    const naturalIndicators = [
      /\b(I think|I believe|I feel|I hope)\b/gi,
      /\b(perhaps|maybe|might|could|probably)\b/gi,
      /\b(looks like|seems like|sounds like)\b/gi
    ];

    naturalIndicators.forEach(pattern => {
      if (pattern.test(text)) {
        score += 5;
      }
    });

    // Penalize robotic patterns
    const roboticPatterns = [
      /\b(the aforementioned|herein|herewith|pursuant to)\b/gi,
      /\b(furthermore|moreover|in addition|additionally)\b/gi,
      /\b(please be advised|kindly note)\b/gi
    ];

    roboticPatterns.forEach(pattern => {
      if (pattern.test(text)) {
        score -= 10;
      }
    });

    // Sentence variety
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
    const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const variance = this.calculateVariance(sentenceLengths);

    if (avgLength > 5 && avgLength < 20 && variance > 2) {
      score += 10; // Good sentence variety
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculates conciseness score
   */
  private calculateConcisenessScore(text: string): number {
    const wordCount = text.split(/\s+/).length;
    let score = 100;

    // Penalize for being too long
    if (wordCount > 120) score -= 20;
    else if (wordCount > 100) score -= 10;
    else if (wordCount > 80) score -= 5;

    // Penalize for being too short
    if (wordCount < 15) score -= 30;
    else if (wordCount < 20) score -= 15;
    else if (wordCount < 25) score -= 5;

    // Reward optimal length
    if (wordCount >= 30 && wordCount <= 70) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculates appropriateness score
   */
  private calculateAppropriatenessScore(text: string, context?: any): number {
    let score = 80; // Base score

    // Check tone appropriateness
    if (context?.tonePreference) {
      const toneScore = this.calculateToneAppropriateness(text, context.tonePreference);
      score = (score + toneScore) / 2;
    }

    // Check for inappropriate content
    const inappropriatePatterns = [
      /\b(stupid|idiotic|dumb|ridiculous|absurd)\b/gi,
      /\b(hate|despiseloat abhor)\b/gi,
      /\b(incompetent|useless|worthless)\b/gi
    ];

    inappropriatePatterns.forEach(pattern => {
      if (pattern.test(text)) {
        score -= 20;
      }
    });

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculates tone appropriateness
   */
  private calculateToneAppropriateness(text: string, tone: string): number {
    const toneIndicators: Record<string, { include: string[]; exclude: string[] }> = {
      professional: {
        include: ['regards', 'sincerely', 'best regards', 'thank you'],
        exclude: ['hey', 'what\'s up', 'gonna', 'wanna', 'cool']
      },
      friendly: {
        include: ['hope', 'great', 'wonderful', 'looking forward'],
        exclude: ['herein', 'pursuant', 'aforementioned']
      },
      assertive: {
        include: ['need', 'require', 'must', 'important'],
        exclude: ['maybe', 'perhaps', 'might', 'could']
      },
      polite: {
        include: ['please', 'thank you', 'appreciate', 'kindly'],
        exclude: ['demand', 'immediately', 'urgent']
      },
      direct: {
        include: ['following up', 'next steps', 'action needed'],
        exclude: ['perhaps', 'maybe', 'if you don\'t mind']
      },
      concise: {
        include: ['quick', 'brief', 'summary', 'key points'],
        exclude: ['furthermore', 'moreover', 'in addition']
      }
    };

    const indicators = toneIndicators[tone];
    if (!indicators) return 70;

    let score = 70;
    const lowerText = text.toLowerCase();

    indicators.include.forEach(word => {
      if (lowerText.includes(word)) score += 5;
    });

    indicators.exclude.forEach(word => {
      if (lowerText.includes(word)) score -= 10;
    });

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Identifies issues based on safety checks and quality metrics
   */
  private identifyIssues(safetyChecks: SafetyChecks, qualityMetrics: QualityMetrics): string[] {
    const issues: string[] = [];

    if (safetyChecks.containsGenericPhrases) {
      issues.push(`Contains generic phrases: ${safetyChecks.genericPhrasesFound.join(', ')}`);
    }

    if (safetyChecks.negativeSentiment) {
      issues.push('Contains negative sentiment');
    }

    if (safetyChecks.urgentLanguage) {
      issues.push('Contains urgent or demanding language');
    }

    if (safetyChecks.legalRisk) {
      issues.push('Contains potential legal risk language');
    }

    if (qualityMetrics.specificityScore < this.qualityThresholds.minSpecificity) {
      issues.push('Low specificity - message is too generic');
    }

    if (qualityMetrics.contextualityScore < this.qualityThresholds.minContextuality) {
      issues.push('Low contextuality - doesn\'t reference conversation');
    }

    if (qualityMetrics.humanLikenessScore < this.qualityThresholds.minHumanLikeness) {
      issues.push('Low human likeness - sounds robotic');
    }

    if (qualityMetrics.wordCount > this.qualityThresholds.maxWordCount) {
      issues.push('Message too long');
    }

    if (qualityMetrics.wordCount < this.qualityThresholds.minWordCount) {
      issues.push('Message too short');
    }

    if (qualityMetrics.avgSentenceLength > this.qualityThresholds.maxSentenceLength) {
      issues.push('Sentences too long - hard to read');
    }

    return issues;
  }

  /**
   * Generates suggestions for improvement
   */
  private generateSuggestions(
    safetyChecks: SafetyChecks,
    qualityMetrics: QualityMetrics,
    issues: string[]
  ): string[] {
    const suggestions: string[] = [];

    if (safetyChecks.containsGenericPhrases) {
      suggestions.push('Replace generic phrases with specific context references');
    }

    if (qualityMetrics.specificityScore < this.qualityThresholds.minSpecificity) {
      suggestions.push('Add specific details from the conversation');
    }

    if (qualityMetrics.contextualityScore < this.qualityThresholds.minContextuality) {
      suggestions.push('Reference specific topics discussed in the thread');
    }

    if (qualityMetrics.humanLikenessScore < this.qualityThresholds.minHumanLikeness) {
      suggestions.push('Use more natural language and sentence variety');
    }

    if (qualityMetrics.wordCount > this.qualityThresholds.maxWordCount) {
      suggestions.push('Shorten the message to be more concise');
    }

    if (qualityMetrics.wordCount < this.qualityThresholds.minWordCount) {
      suggestions.push('Add more relevant content to reach minimum length');
    }

    if (qualityMetrics.avgSentenceLength > this.qualityThresholds.maxSentenceLength) {
      suggestions.push('Break up long sentences for better readability');
    }

    if (safetyChecks.negativeSentiment) {
      suggestions.push('Remove negative language and use more positive framing');
    }

    if (safetyChecks.urgentLanguage) {
      suggestions.push('Reduce urgency and use more moderate language');
    }

    return suggestions;
  }

  /**
   * Determines if the content passes quality checks
   */
  private determinePassStatus(safetyChecks: SafetyChecks, qualityMetrics: QualityMetrics): boolean {
    // Must pass all safety checks for auto-send
    if (!safetyChecks.autoSendSafe) {
      return false;
    }

    // Must meet minimum quality thresholds
    if (qualityMetrics.specificityScore < this.qualityThresholds.minSpecificity) {
      return false;
    }

    if (qualityMetrics.contextualityScore < this.qualityThresholds.minContextuality) {
      return false;
    }

    if (qualityMetrics.humanLikenessScore < this.qualityThresholds.minHumanLikeness) {
      return false;
    }

    if (qualityMetrics.appropriatenessScore < this.qualityThresholds.minAppropriateness) {
      return false;
    }

    // Must not have too many generic phrases
    if (safetyChecks.genericPhrasesFound.length > this.qualityThresholds.maxGenericPhrases) {
      return false;
    }

    return true;
  }

  /**
   * Calculates variance for human likeness scoring
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Gets quality filter statistics
   */
  getFilterStats(results: GenerationResult[]): {
    totalProcessed: number;
    passedQuality: number;
    failedQuality: number;
    averageQuality: number;
    commonIssues: Array<{ issue: string; count: number }>;
    autoSendSafeRate: number;
  } {
    const totalProcessed = results.length;
    const passedQuality = results.filter(r => 
      r.safetyChecks.autoSendSafe && r.qualityMetrics.overallQuality >= 70
    ).length;
    const failedQuality = totalProcessed - passedQuality;
    
    const averageQuality = results.reduce((sum, r) => 
      sum + r.qualityMetrics.overallQuality, 0
    ) / totalProcessed;

    // Count common issues
    const issueCounts = new Map<string, number>();
    results.forEach(result => {
      if (result.safetyChecks.containsGenericPhrases) {
        result.safetyChecks.genericPhrasesFound.forEach(phrase => {
          issueCounts.set(phrase, (issueCounts.get(phrase) || 0) + 1);
        });
      }
    });

    const commonIssues = Array.from(issueCounts.entries())
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const autoSendSafeRate = results.filter(r => r.safetyChecks.autoSendSafe).length / totalProcessed;

    return {
      totalProcessed,
      passedQuality,
      failedQuality,
      averageQuality,
      commonIssues,
      autoSendSafeRate
    };
  }
}
