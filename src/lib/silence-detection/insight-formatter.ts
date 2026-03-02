import { 
  ThreadInsight, 
  SilenceDetectionResult, 
  ThreadAnalysis,
  ConfidenceFactors 
} from './types';

export class InsightFormatter {
  /**
   * Formats silence detection result into human-readable insights
   */
  formatInsights(
    result: SilenceDetectionResult,
    threadAnalysis: ThreadAnalysis,
    confidenceFactors?: ConfidenceFactors
  ): ThreadInsight {
    const summary = this.generateSummary(result, threadAnalysis);
    const lastReplyStatus = this.determineLastReplyStatus(threadAnalysis);
    const suggestedAction = this.generateSuggestedAction(result, threadAnalysis);
    const riskLevel = this.assessRiskLevel(result, confidenceFactors);
    const participantSummary = this.generateParticipantSummary(threadAnalysis);

    return {
      summary,
      lastReplyStatus,
      suggestedAction,
      riskLevel,
      participantSummary
    };
  }

  /**
   * Generates a concise summary of the thread situation
   */
  private generateSummary(result: SilenceDetectionResult, threadAnalysis: ThreadAnalysis): string {
    const { subject, silenceDurationDays, lastSender } = result;
    const { participants } = threadAnalysis;

    const otherParticipants = participants.filter(p => !p.isUser);
    const participantCount = otherParticipants.length;
    
    let summary = `${subject}`;
    
    // Add participant context
    if (participantCount === 1) {
      summary += ` with ${otherParticipants[0].name || otherParticipants[0].email}`;
    } else if (participantCount > 1) {
      summary += ` with ${participantCount} participants`;
    }

    // Add silence context
    if (silenceDurationDays < 1) {
      summary += ` has been quiet for ${Math.round(silenceDurationDays * 24)} hours`;
    } else if (silenceDurationDays === 1) {
      summary += ` has been quiet for 1 day`;
    } else {
      summary += ` has been quiet for ${Math.round(silenceDurationDays)} days`;
    }

    // Add last sender context
    const senderName = this.extractName(lastSender);
    summary += `. Last reply from ${senderName}`;

    return summary;
  }

  /**
   * Determines the status of the last reply
   */
  private determineLastReplyStatus(threadAnalysis: ThreadAnalysis): 'Waiting on them' | 'Waiting on you' | 'Thread resolved' {
    const { userIsLastSender, messages } = threadAnalysis;

    if (messages.length === 0) {
      return 'Thread resolved';
    }

    if (userIsLastSender) {
      return 'Waiting on them';
    }

    // Check if thread appears resolved based on content
    const lastMessage = messages[messages.length - 1];
    if (this.isResolvingMessage(lastMessage)) {
      return 'Thread resolved';
    }

    return 'Waiting on you';
  }

  /**
   * Generates suggested action based on analysis
   */
  private generateSuggestedAction(
    result: SilenceDetectionResult, 
    threadAnalysis: ThreadAnalysis
  ): 'Follow-up ready' | 'Wait longer' | 'No action needed' {
    if (!result.isEligible) {
      return 'No action needed';
    }

    const { silenceDurationDays, followUpRuleDays } = result;
    const ratio = silenceDurationDays / followUpRuleDays;

    if (ratio < 1.5) {
      return 'Follow-up ready';
    } else if (ratio < 3) {
      return 'Follow-up ready';
    } else {
      // Very long silence might indicate thread is dead
      return 'Wait longer';
    }
  }

  /**
   * Assesses risk level of follow-up
   */
  private assessRiskLevel(
    result: SilenceDetectionResult,
    confidenceFactors?: ConfidenceFactors
  ): 'low' | 'medium' | 'high' {
    if (!result.isEligible) {
      return 'low';
    }

    const { confidenceScore, silenceDurationDays } = result;

    // High confidence = low risk
    if (confidenceScore >= 0.9) {
      return 'low';
    }

    // Medium confidence = medium risk
    if (confidenceScore >= 0.75) {
      return 'medium';
    }

    // Low confidence or very long silence = high risk
    if (confidenceScore < 0.75 || silenceDurationDays > 14) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Generates participant summary
   */
  private generateParticipantSummary(threadAnalysis: ThreadAnalysis): string {
    const { participants, messages } = threadAnalysis;
    
    const userParticipants = participants.filter(p => p.isUser);
    const otherParticipants = participants.filter(p => !p.isUser);

    if (otherParticipants.length === 0) {
      return 'Internal thread';
    }

    if (otherParticipants.length === 1) {
      const participant = otherParticipants[0];
      const name = participant.name || participant.email;
      return `Conversation with ${name}`;
    }

    // Count messages per participant
    const messageCounts = new Map<string, number>();
    
    for (const message of messages) {
      const senderEmail = this.extractEmail(message.from);
      messageCounts.set(senderEmail, (messageCounts.get(senderEmail) || 0) + 1);
    }

    // Find most active non-user participant
    let mostActive = '';
    let maxCount = 0;
    
    for (const participant of otherParticipants) {
      const count = messageCounts.get(participant.email) || 0;
      if (count > maxCount) {
        maxCount = count;
        mostActive = participant.name || participant.email;
      }
    }

    return `Group conversation (${otherParticipants.length} people)`;
  }

  /**
   * Formats the complete result for display
   */
  formatCompleteResult(result: SilenceDetectionResult): string {
    const lines = [
      `Thread: ${result.subject}`,
      `Last reply status: ${result.insights.lastReplyStatus}`,
      `Silence duration: ${this.formatDuration(result.silenceDurationDays)}`,
      `Follow-up rule: ${result.followUpRuleDays} days`,
      `Suggested action: ${result.insights.suggestedAction}`,
      `Confidence score: ${Math.round(result.confidenceScore * 100)}%`
    ];

    if (result.rejectionReason) {
      lines.push(`Note: ${result.rejectionReason}`);
    }

    if (result.insights.riskLevel !== 'low') {
      lines.push(`Risk level: ${result.insights.riskLevel}`);
    }

    return lines.join('\n');
  }

  /**
   * Formats duration in human-readable format
   */
  private formatDuration(days: number): string {
    if (days < 1) {
      const hours = Math.round(days * 24);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }

    if (days === 1) {
      return '1 day';
    }

    if (days < 7) {
      return `${Math.round(days)} days`;
    }

    const weeks = Math.floor(days / 7);
    const remainingDays = Math.round(days % 7);

    if (remainingDays === 0) {
      return `${weeks} week${weeks !== 1 ? 's' : ''}`;
    }

    return `${weeks} week${weeks !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
  }

  /**
   * Generates detailed analysis report
   */
  generateDetailedReport(
    result: SilenceDetectionResult,
    threadAnalysis: ThreadAnalysis,
    confidenceFactors?: ConfidenceFactors
  ): {
    summary: string;
    timeline: Array<{ time: string; event: string; sender: string }>;
    riskFactors: string[];
    recommendations: string[];
  } {
    const summary = this.formatCompleteResult(result);
    const timeline = this.generateTimeline(threadAnalysis);
    const riskFactors = this.identifyRiskFactors(result, confidenceFactors);
    const recommendations = this.generateRecommendations(result, threadAnalysis);

    return {
      summary,
      timeline,
      riskFactors,
      recommendations
    };
  }

  /**
   * Generates message timeline
   */
  private generateTimeline(threadAnalysis: ThreadAnalysis): Array<{ time: string; event: string; sender: string }> {
    const { messages } = threadAnalysis;
    const timeline = [];

    for (let i = 0; i < Math.min(messages.length, 5); i++) {
      const message = messages[i];
      const sender = this.extractName(message.from);
      const time = this.formatRelativeTime(message.timestamp);
      const preview = this.truncateText(message.subject || message.body, 50);

      timeline.push({
        time,
        event: preview,
        sender
      });
    }

    return timeline;
  }

  /**
   * Identifies risk factors for follow-up
   */
  private identifyRiskFactors(
    result: SilenceDetectionResult,
    confidenceFactors?: ConfidenceFactors
  ): string[] {
    const factors: string[] = [];

    if (result.confidenceScore < 0.8) {
      factors.push('Low confidence score');
    }

    if (result.silenceDurationDays > 14) {
      factors.push('Very long silence period');
    }

    if (confidenceFactors) {
      if (confidenceFactors.participantReciprocity < 0.5) {
        factors.push('Unbalanced conversation');
      }

      if (confidenceFactors.automationRisk < 0.6) {
        factors.push('Possible automated message');
      }

      if (confidenceFactors.messageQuality < 0.5) {
        factors.push('Low message quality');
      }
    }

    if (result.insights.riskLevel === 'high') {
      factors.push('High overall risk assessment');
    }

    return factors;
  }

  /**
   * Generates actionable recommendations
   */
  private generateRecommendations(
    result: SilenceDetectionResult,
    threadAnalysis: ThreadAnalysis
  ): string[] {
    const recommendations: string[] = [];

    if (!result.isEligible) {
      if (result.rejectionReason?.includes('automated')) {
        recommendations.push('This appears to be an automated email - no follow-up needed');
      } else if (result.rejectionReason?.includes('duplicate')) {
        recommendations.push('Follow-up already exists - check existing drafts or sent items');
      } else {
        recommendations.push('Thread not eligible for follow-up at this time');
      }
      return recommendations;
    }

    if (result.autoSendReady) {
      recommendations.push('High confidence - suitable for automatic follow-up');
    } else {
      recommendations.push('Manual review recommended before follow-up');
    }

    if (result.silenceDurationDays > 7) {
      recommendations.push('Consider if topic is still relevant after long silence');
    }

    if (threadAnalysis.participants.length > 3) {
      recommendations.push('Group conversation - ensure follow-up is relevant to all participants');
    }

    if (result.confidenceScore > 0.9) {
      recommendations.push('Strong candidate for follow-up - high confidence score');
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private extractName(emailString: string): string {
    const match = emailString.match(/^"?([^"]+)"?\s*<([^>]+)>$/);
    if (match) {
      return match[1] || match[2];
    }
    
    const emailMatch = emailString.match(/<([^>]+)>/);
    return emailMatch ? emailMatch[1] : emailString;
  }

  private extractEmail(emailString: string): string {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString;
  }

  private isResolvingMessage(message: any): boolean {
    const content = (message.subject + ' ' + message.body).toLowerCase();
    const resolvingKeywords = [
      'resolved', 'closed', 'completed', 'finished', 'done',
      'thank you', 'thanks', 'appreciate', 'got it', 'understood'
    ];
    
    return resolvingKeywords.some(keyword => content.includes(keyword));
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private formatRelativeTime(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const minutes = Math.round(diffHours * 60);
      return `${minutes}m ago`;
    }

    if (diffHours < 24) {
      return `${Math.round(diffHours)}h ago`;
    }

    const days = Math.floor(diffHours / 24);
    if (days < 7) {
      return `${days}d ago`;
    }

    return timestamp.toLocaleDateString();
  }

  /**
   * Formats insights for different output channels
   */
  formatForEmail(result: SilenceDetectionResult): string {
    const insights = result.insights;
    
    return `
📧 Follow-up Opportunity

Thread: ${result.subject}
Status: ${insights.lastReplyStatus}
Silence: ${this.formatDuration(result.silenceDurationDays)}
Confidence: ${Math.round(result.confidenceScore * 100)}%
Risk: ${insights.riskLevel}

${insights.summary}

Recommended action: ${insights.suggestedAction}

---
This insight was generated by Replyzen's silence detection engine.
    `.trim();
  }

  formatForSlack(result: SilenceDetectionResult): string {
    const emoji = result.autoSendReady ? '🟢' : '🟡';
    const confidence = Math.round(result.confidenceScore * 100);
    
    return `${emoji} *Follow-up Ready*  
📝 *${result.subject}*  
⏰ *${this.formatDuration(result.silenceDurationDays)}* silent  
📊 *${confidence}%* confidence  
🎯 *${result.insights.suggestedAction}*`;
  }

  formatForDashboard(result: SilenceDetectionResult): {
    title: string;
    subtitle: string;
    metrics: Array<{ label: string; value: string; color: string }>;
    status: 'success' | 'warning' | 'error';
  } {
    const confidence = Math.round(result.confidenceScore * 100);
    
    return {
      title: result.subject,
      subtitle: result.insights.participantSummary,
      metrics: [
        { label: 'Silence', value: this.formatDuration(result.silenceDurationDays), color: 'blue' },
        { label: 'Confidence', value: `${confidence}%`, color: confidence > 85 ? 'green' : confidence > 70 ? 'yellow' : 'red' },
        { label: 'Risk', value: result.insights.riskLevel, color: result.insights.riskLevel === 'low' ? 'green' : result.insights.riskLevel === 'medium' ? 'yellow' : 'red' }
      ],
      status: result.autoSendReady ? 'success' : result.confidenceScore > 0.7 ? 'warning' : 'error'
    };
  }
}
