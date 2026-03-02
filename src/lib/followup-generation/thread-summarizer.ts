import { ExtractedMessage, ThreadSummary } from './types';

export class ThreadSummarizer {
  private readonly actionKeywords = [
    'review', 'approve', 'sign', 'confirm', 'schedule', 'call', 'meet',
    'discuss', 'decide', 'provide', 'send', 'share', 'deliver', 'complete',
    'submit', 'apply', 'register', 'join', 'attend', 'participate', 'respond'
  ];

  private readonly deadlineKeywords = [
    'deadline', 'due date', 'by', 'before', 'end of', 'close of',
    'asap', 'urgent', 'immediately', 'promptly', 'as soon as possible',
    'today', 'tomorrow', 'this week', 'next week', 'by end of day',
    'by friday', 'by monday', 'within', 'no later than'
  ];

  private readonly topicIndicators = [
    'proposal', 'contract', 'agreement', 'invoice', 'payment', 'quote',
    'estimate', 'budget', 'pricing', 'cost', 'meeting', 'call', 'interview',
    'application', 'onboarding', 'setup', 'configuration', 'integration',
    'project', 'initiative', 'partnership', 'collaboration', 'support',
    'issue', 'problem', 'bug', 'feature', 'request', 'feedback', 'review'
  ];

  /**
   * Generates a structured summary of the thread
   */
  generateSummary(messages: ExtractedMessage[]): ThreadSummary {
    if (messages.length === 0) {
      return this.createEmptySummary();
    }

    const topic = this.extractTopic(messages);
    const pendingAction = this.extractPendingAction(messages);
    const waitingOn = this.determineWaitingOn(messages);
    const deadlines = this.extractDeadlines(messages);
    const keyPoints = this.extractKeyPoints(messages);
    const context = this.buildContextString(topic, pendingAction, waitingOn, deadlines);

    return {
      topic,
      pendingAction,
      waitingOn,
      deadlines,
      keyPoints,
      context
    };
  }

  /**
   * Extracts the main topic of conversation
   */
  private extractTopic(messages: ExtractedMessage[]): string {
    const allText = messages.map(msg => msg.body).join(' ').toLowerCase();
    
    // Score each topic indicator based on frequency and context
    const topicScores = new Map<string, number>();
    
    for (const indicator of this.topicIndicators) {
      const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
      const matches = allText.match(regex);
      if (matches) {
        // Weight by frequency and position (more recent = higher weight)
        let score = matches.length;
        
        // Boost score if mentioned in recent messages
        const recentMessages = messages.slice(-2);
        for (const msg of recentMessages) {
          if (msg.body.toLowerCase().includes(indicator)) {
            score += 2;
          }
        }
        
        topicScores.set(indicator, score);
      }
    }

    // Get the highest scoring topic
    if (topicScores.size === 0) {
      return this.extractTopicFromSubject(messages);
    }

    const sortedTopics = Array.from(topicScores.entries())
      .sort((a, b) => b[1] - a[1]);
    
    const primaryTopic = sortedTopics[0][0];
    
    // Create a more descriptive topic name
    return this.formatTopicName(primaryTopic, messages);
  }

  /**
   * Extracts topic from subject line if no clear topic in content
   */
  private extractTopicFromSubject(messages: ExtractedMessage[]): string {
    // This would use actual subject from the original message
    // For now, return a generic topic
    return 'General discussion';
  }

  /**
   * Formats topic name to be more descriptive
   */
  private formatTopicName(topic: string, messages: ExtractedMessage[]): string {
    const topicMappings: Record<string, string> = {
      'proposal': 'Proposal discussion',
      'contract': 'Contract review',
      'agreement': 'Agreement terms',
      'invoice': 'Invoice/payment',
      'payment': 'Payment processing',
      'quote': 'Quote/pricing',
      'estimate': 'Cost estimate',
      'budget': 'Budget planning',
      'meeting': 'Meeting scheduling',
      'call': 'Phone call arrangement',
      'interview': 'Interview process',
      'application': 'Application review',
      'onboarding': 'Onboarding process',
      'setup': 'Setup/configuration',
      'project': 'Project discussion',
      'partnership': 'Partnership opportunity',
      'support': 'Support request',
      'issue': 'Issue resolution'
    };

    return topicMappings[topic] || topic.charAt(0).toUpperCase() + topic.slice(1);
  }

  /**
   * Extracts the pending action from messages
   */
  private extractPendingAction(messages: ExtractedMessage[]): string {
    const lastMessage = messages[messages.length - 1];
    const lastMessageText = lastMessage.body.toLowerCase();
    
    // Look for explicit action requests
    for (const action of this.actionKeywords) {
      const regex = new RegExp(`\\b(please )?${action}\\b`, 'i');
      const match = lastMessageText.match(regex);
      if (match) {
        return this.formatActionDescription(action, lastMessage);
      }
    }

    // Look for questions (indicates response needed)
    if (lastMessageText.includes('?')) {
      return 'Response to questions';
    }

    // Look for attachments or documents mentioned
    const attachmentKeywords = ['attached', 'attachment', 'document', 'file', 'review'];
    for (const keyword of attachmentKeywords) {
      if (lastMessageText.includes(keyword)) {
        return 'Document review';
      }
    }

    // Default based on conversation flow
    return this.inferActionFromContext(messages);
  }

  /**
   * Formats action description based on context
   */
  private formatActionDescription(action: string, message: ExtractedMessage): string {
    const actionMappings: Record<string, string> = {
      'review': 'Review and provide feedback',
      'approve': 'Review and approve',
      'sign': 'Review and sign',
      'confirm': 'Confirm receipt/agreement',
      'schedule': 'Schedule meeting/call',
      'call': 'Arrange phone call',
      'meet': 'Schedule in-person meeting',
      'discuss': 'Schedule discussion',
      'decide': 'Make decision',
      'provide': 'Provide information/document',
      'send': 'Send requested information',
      'share': 'Share relevant details',
      'deliver': 'Deliver item/service',
      'complete': 'Complete task/form',
      'submit': 'Submit application/form',
      'apply': 'Complete application',
      'register': 'Complete registration',
      'join': 'Join meeting/event',
      'attend': 'Attend meeting/event',
      'participate': 'Participate in discussion',
      'respond': 'Provide response'
    };

    return actionMappings[action] || `Action: ${action}`;
  }

  /**
   * Infers action from conversation context
   */
  private inferActionFromContext(messages: ExtractedMessage[]): string {
    const lastUserMessage = messages.filter(m => m.isFromUser).pop();
    const lastRecipientMessage = messages.filter(m => !m.isFromUser).pop();
    
    if (lastRecipientMessage && lastUserMessage) {
      // If user sent something after recipient, they might be waiting for response
      if (new Date(lastUserMessage.timestamp) > new Date(lastRecipientMessage.timestamp)) {
        return 'Awaiting response';
      }
    }

    return 'Follow-up required';
  }

  /**
   * Determines who is waiting on whom
   */
  private determineWaitingOn(messages: ExtractedMessage[]): 'user' | 'recipient' | 'mutual' {
    const lastMessage = messages[messages.length - 1];
    
    // If last message is from user, user is waiting on recipient
    if (lastMessage.isFromUser) {
      return 'recipient';
    }

    // If last message has questions, user might need to respond
    if (lastMessage.body.includes('?')) {
      return 'user';
    }

    // Check for explicit waiting indicators
    const waitingIndicators = [
      'waiting for', 'awaiting', 'looking forward to', 'let me know',
      'please advise', 'keep me posted', 'update me'
    ];

    const lastMessageText = lastMessage.body.toLowerCase();
    for (const indicator of waitingIndicators) {
      if (lastMessageText.includes(indicator)) {
        return lastMessage.isFromUser ? 'recipient' : 'user';
      }
    }

    // Default: mutual waiting
    return 'mutual';
  }

  /**
   * Extracts deadlines mentioned in messages
   */
  private extractDeadlines(messages: ExtractedMessage[]): string[] {
    const deadlines: string[] = [];
    const allText = messages.map(msg => msg.body).join(' ');
    
    // Look for specific date patterns
    const datePatterns = [
      /\b(by|before|on) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      /\b(by|before|on) (january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2}\b/gi,
      /\b(by|before|on) \d{1,2}\/\d{1,2}\b/g,
      /\b(by|before|on) \d{1,2}-\d{1,2}\b/g,
      /\b(this|next) (week|month)\b/gi,
      /\b(end of) (today|tomorrow|week|month)\b/gi,
      /\bby (end of day|eod|cob|close of business)\b/gi
    ];

    for (const pattern of datePatterns) {
      const matches = allText.match(pattern);
      if (matches) {
        deadlines.push(...matches);
      }
    }

    // Look for urgency indicators
    const urgencyPatterns = [
      /\basap\b/gi,
      /\burgent\b/gi,
      /\bimmediately\b/gi,
      /\bpromptly\b/gi,
      /\bas soon as possible\b/gi
    ];

    for (const pattern of urgencyPatterns) {
      const matches = allText.match(pattern);
      if (matches) {
        deadlines.push(...matches.map(m => `Urgent: ${m}`));
      }
    }

    return [...new Set(deadlines)]; // Remove duplicates
  }

  /**
   * Extracts key points from the conversation
   */
  private extractKeyPoints(messages: ExtractedMessage[]): string[] {
    const keyPoints: string[] = [];
    
    // Extract from the last 3 messages
    const recentMessages = messages.slice(-3);
    
    for (const message of recentMessages) {
      const sentences = message.body.split(/[.!?]+/).filter(s => s.trim().length > 20);
      
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        
        // Skip if it's a question or too generic
        if (trimmed.includes('?') || this.isGenericPhrase(trimmed)) {
          continue;
        }
        
        // Look for sentences with important keywords
        const hasImportantKeyword = this.topicIndicators.some(keyword => 
          trimmed.toLowerCase().includes(keyword)
        ) || this.actionKeywords.some(keyword => 
          trimmed.toLowerCase().includes(keyword)
        );
        
        if (hasImportantKeyword) {
          keyPoints.push(this.truncateSentence(trimmed, 100));
        }
      }
    }
    
    // Remove duplicates and limit to top 5 points
    return [...new Set(keyPoints)].slice(0, 5);
  }

  /**
   * Checks if a phrase is too generic
   */
  private isGenericPhrase(phrase: string): boolean {
    const genericPhrases = [
      'thank you', 'thanks', 'appreciate', 'looking forward to',
      'best regards', 'sincerely', 'have a great day', 'take care',
      'let me know', 'feel free', 'don\'t hesitate', 'please let me know'
    ];
    
    const lowerPhrase = phrase.toLowerCase();
    return genericPhrases.some(generic => lowerPhrase.includes(generic));
  }

  /**
   * Truncates sentence to specified length
   */
  private truncateSentence(sentence: string, maxLength: number): string {
    if (sentence.length <= maxLength) {
      return sentence;
    }
    
    return sentence.substring(0, maxLength - 3) + '...';
  }

  /**
   * Builds context string for AI prompt
   */
  private buildContextString(
    topic: string,
    pendingAction: string,
    waitingOn: string,
    deadlines: string[]
  ): string {
    const parts = [topic];
    
    if (pendingAction) {
      parts.push(`Action needed: ${pendingAction}`);
    }
    
    if (waitingOn !== 'mutual') {
      parts.push(`Waiting on: ${waitingOn}`);
    }
    
    if (deadlines.length > 0) {
      parts.push(`Deadlines: ${deadlines.join(', ')}`);
    }
    
    return parts.join('. ');
  }

  /**
   * Creates empty summary for threads with no messages
   */
  private createEmptySummary(): ThreadSummary {
    return {
      topic: 'No content',
      pendingAction: 'No action identified',
      waitingOn: 'mutual',
      deadlines: [],
      keyPoints: [],
      context: 'No conversation content available for summary'
    };
  }

  /**
   * Validates summary quality
   */
  validateSummary(summary: ThreadSummary): {
    isValid: boolean;
    score: number; // 0-100
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check topic quality
    if (summary.topic === 'No content' || summary.topic === 'General discussion') {
      issues.push('Topic too generic');
      score -= 30;
      suggestions.push('Review messages for more specific topic identification');
    }

    // Check action clarity
    if (!summary.pendingAction || summary.pendingAction === 'Follow-up required') {
      issues.push('Pending action unclear');
      score -= 25;
      suggestions.push('Look for explicit action requests or questions');
    }

    // Check waiting status
    if (summary.waitingOn === 'mutual') {
      suggestions.push('Consider if one party is clearly waiting on the other');
      score -= 10;
    }

    // Check for key points
    if (summary.keyPoints.length === 0) {
      issues.push('No key points identified');
      score -= 20;
      suggestions.push('Extract specific details or decisions from conversation');
    }

    // Check context length
    if (summary.context.length > 300) {
      issues.push('Summary too long');
      score -= 15;
      suggestions.push('Condense to 3-5 lines maximum');
    }

    if (summary.context.length < 50) {
      issues.push('Summary too brief');
      score -= 10;
      suggestions.push('Add more relevant context');
    }

    return {
      isValid: issues.length === 0,
      score: Math.max(0, score),
      issues,
      suggestions
    };
  }

  /**
   * Gets summary statistics for debugging
   */
  getSummaryStats(summary: ThreadSummary): {
    topicLength: number;
    contextLength: number;
    keyPointsCount: number;
    deadlinesCount: number;
    hasAction: boolean;
    hasDeadlines: boolean;
    waitingComplexity: 'simple' | 'moderate' | 'complex';
  } {
    return {
      topicLength: summary.topic.length,
      contextLength: summary.context.length,
      keyPointsCount: summary.keyPoints.length,
      deadlinesCount: summary.deadlines.length,
      hasAction: summary.pendingAction !== 'No action identified',
      hasDeadlines: summary.deadlines.length > 0,
      waitingComplexity: summary.waitingOn === 'mutual' ? 'complex' : 
                        summary.waitingOn === 'user' ? 'moderate' : 'simple'
    };
  }
}
