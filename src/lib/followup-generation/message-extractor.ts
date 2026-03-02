import { Message, ExtractedMessage } from './types';

export class MessageExtractor {
  private readonly signaturePatterns = [
    /^--\s*$/m,
    /^Best regards,?$/mi,
    /^Regards,?$/mi,
    /^Sincerely,?$/mi,
    /^Thank you,?$/mi,
    /^Thanks,?$/mi,
    /^Cheers,?$/mi,
    /^Best,?$/mi,
    /^All the best,?$/mi,
    /^Warmly,?$/mi,
    /^Respectfully,?$/mi,
    /^Yours,?$/mi,
    /^Sent from my \w+$/m,
    /^Get \w+ for \w+$/m,
    /^Download \w+$/m,
    /^On .+ wrote:$/m
  ];

  private readonly quotedPatterns = [
    /^>+.*$/gm,
    /^On .+ wrote:$/m,
    /^-----Original Message-----$/m,
    /^From:.*$/m,
    /^To:.*$/m,
    /^Subject:.*$/m,
    /^Date:.*$/m
  ];

  private readonly automatedPatterns = [
    /^This message was sent from a notification-only email address\./m,
    /^Please do not reply to this message\./m,
    /^Auto-generated message\./m,
    /^This is an automated message\./m,
    /^Do not reply to this email\./m,
    /^You received this message because you are subscribed to the Google Groups/m,
    /^To view this discussion on the web visit/m,
    /^Reply to this email to view the comment on the web\./m,
    /^Unsubscribe from this thread\./m
  ];

  private readonly trackingPixelPatterns = [
    /<img[^>]*src=["'][^"']*tracking[^"']*["'][^>]*>/gi,
    /<img[^>]*src=["'][^"']*pixel[^"']*["'][^>]*>/gi,
    /<img[^>]*width=["']1["'][^>]*height=["']1["'][^>]*>/gi
  ];

  private readonly htmlNoisePatterns = [
    /<style[^>]*>.*?<\/style>/gis,
    /<script[^>]*>.*?<\/script>/gis,
    /<!--.*?-->/gs,
    /<meta[^>]*>/gi,
    /<link[^>]*>/gi,
    /<!DOCTYPE[^>]*>/gi
  ];

  /**
   * Extracts the last 3 relevant human messages from a thread
   */
  extractRelevantMessages(messages: Message[], userEmail: string): ExtractedMessage[] {
    // Sort messages by timestamp (newest first)
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Filter and clean messages
    const cleanedMessages = sortedMessages
      .map(msg => this.cleanMessage(msg))
      .filter(msg => this.isRelevantMessage(msg, userEmail))
      .slice(0, 3); // Take last 3 relevant messages

    // Reverse to maintain chronological order (oldest first)
    return cleanedMessages.reverse();
  }

  /**
   * Cleans a single message by removing signatures, quotes, and automated content
   */
  private cleanMessage(message: Message): ExtractedMessage {
    let cleanedBody = message.body;

    // Remove HTML noise
    cleanedBody = this.removeHtmlNoise(cleanedBody);

    // Remove tracking pixels
    cleanedBody = this.removeTrackingPixels(cleanedBody);

    // Remove quoted text
    cleanedBody = this.removeQuotedText(cleanedBody);

    // Remove automated content
    cleanedBody = this.removeAutomatedContent(cleanedBody);

    // Remove signatures
    cleanedBody = this.removeSignatures(cleanedBody);

    // Clean up whitespace
    cleanedBody = this.cleanupWhitespace(cleanedBody);

    return {
      id: message.id,
      from: message.from,
      body: cleanedBody,
      timestamp: message.timestamp,
      isFromUser: this.isUserMessage(message, userEmail)
    };
  }

  /**
   * Removes HTML noise and formatting
   */
  private removeHtmlNoise(content: string): string {
    let cleaned = content;

    // Remove style and script tags
    this.htmlNoisePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // Convert basic HTML to plain text
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    cleaned = cleaned.replace(/<\/p>/gi, '\n\n');
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    return cleaned;
  }

  /**
   * Removes tracking pixels and invisible images
   */
  private removeTrackingPixels(content: string): string {
    let cleaned = content;

    this.trackingPixelPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned;
  }

  /**
   * Removes quoted text and email forwards
   */
  private removeQuotedText(content: string): string {
    let cleaned = content;

    // Find the start of quoted content and remove everything after it
    const quoteStartPatterns = [
      /^On .+ wrote:$/m,
      /^-----Original Message-----$/m,
      /^From:.*$/m
    ];

    for (const pattern of quoteStartPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const index = cleaned.indexOf(match[0]);
        if (index > 0) {
          cleaned = cleaned.substring(0, index).trim();
          break;
        }
      }
    }

    // Remove remaining quote lines
    this.quotedPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned;
  }

  /**
   * Removes automated email content
   */
  private removeAutomatedContent(content: string): string {
    let cleaned = content;

    this.automatedPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned;
  }

  /**
   * Removes email signatures
   */
  private removeSignatures(content: string): string {
    let cleaned = content;

    // Find signature patterns and remove everything after them
    for (const pattern of this.signaturePatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const index = cleaned.indexOf(match[0]);
        if (index > 0) {
          cleaned = cleaned.substring(0, index).trim();
          break;
        }
      }
    }

    return cleaned;
  }

  /**
   * Cleans up whitespace and formatting
   */
  private cleanupWhitespace(content: string): string {
    return content
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines to max 2
      .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
      .replace(/^\s+|\s+$/g, '') // Trim leading/trailing whitespace
      .trim();
  }

  /**
   * Determines if a message is relevant for follow-up generation
   */
  private isRelevantMessage(message: ExtractedMessage, userEmail: string): boolean {
    // Skip empty messages
    if (!message.body || message.body.trim().length < 10) {
      return false;
    }

    // Skip very short messages (likely acknowledgments)
    if (message.body.trim().length < 20) {
      const shortContent = message.body.trim().toLowerCase();
      const skipPhrases = [
        'thanks', 'thank you', 'ok', 'got it', 'received', 
        'acknowledged', 'noted', 'understood', 'will do',
        'sounds good', 'perfect', 'great', 'fine'
      ];
      
      if (skipPhrases.some(phrase => shortContent.includes(phrase))) {
        return false;
      }
    }

    // Skip automated looking messages
    const automatedKeywords = [
      'auto-generated', 'automated message', 'do not reply',
      'notification only', 'system message', 'cron job',
      'scheduled message', 'batch email'
    ];

    if (automatedKeywords.some(keyword => 
      message.body.toLowerCase().includes(keyword)
    )) {
      return false;
    }

    // Skip messages that are mostly quotes
    const quoteLines = message.body.split('\n').filter(line => 
      line.trim().startsWith('>') || line.trim().startsWith('On ')
    ).length;
    
    const totalLines = message.body.split('\n').length;
    if (quoteLines > totalLines * 0.5) {
      return false;
    }

    return true;
  }

  /**
   * Determines if a message is from the user
   */
  private isUserMessage(message: Message, userEmail: string): boolean {
    const senderEmail = this.extractEmail(message.from);
    return senderEmail.toLowerCase() === userEmail.toLowerCase();
  }

  /**
   * Extracts email address from "Name <email@domain.com>" format
   */
  private extractEmail(emailString: string): string {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString;
  }

  /**
   * Extracts the last message from each participant
   */
  extractLastMessagesPerParticipant(messages: Message[], userEmail: string): {
    lastUserMessage: ExtractedMessage | null;
    lastRecipientMessage: ExtractedMessage | null;
  } {
    const relevantMessages = this.extractRelevantMessages(messages, userEmail);
    
    const lastUserMessage = relevantMessages
      .filter(msg => msg.isFromUser)
      .pop() || null;

    const lastRecipientMessage = relevantMessages
      .filter(msg => !msg.isFromUser)
      .pop() || null;

    return {
      lastUserMessage,
      lastRecipientMessage
    };
  }

  /**
   * Gets participant names from messages
   */
  extractParticipantNames(messages: Message[], userEmail: string): {
    user: string;
    recipient: string;
  } {
    const userMessages = messages.filter(msg => 
      this.isUserMessage(msg, userEmail)
    );
    
    const recipientMessages = messages.filter(msg => 
      !this.isUserMessage(msg, userEmail)
    );

    const userName = this.extractName(userMessages[0]?.from || userEmail);
    const recipientName = this.extractName(
      recipientMessages[recipientMessages.length - 1]?.from || 'Unknown'
    );

    return {
      user: userName,
      recipient: recipientName
    };
  }

  /**
   * Extracts name from email string
   */
  private extractName(emailString: string): string {
    const match = emailString.match(/^"?([^"]+)"?\s*<([^>]+)>$/);
    if (match) {
      return match[1].trim();
    }
    
    // If no name, return email without domain
    const emailMatch = emailString.match(/<([^>]+)>/);
    if (emailMatch) {
      const email = emailMatch[1];
      const localPart = email.split('@')[0];
      return localPart.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return emailString;
  }

  /**
   * Validates extracted message quality
   */
  validateExtractedMessage(message: ExtractedMessage): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check content length
    if (message.body.length < 20) {
      issues.push('Message too short for meaningful follow-up');
      suggestions.push('Consider if follow-up is necessary for this brief exchange');
    }

    if (message.body.length > 2000) {
      issues.push('Message very long - may contain irrelevant content');
      suggestions.push('Review if key points can be extracted more precisely');
    }

    // Check for meaningful content
    const sentences = message.body.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) {
      issues.push('Message contains only one sentence');
      suggestions.push('May need more context for effective follow-up');
    }

    // Check for question marks (indicates pending response)
    const hasQuestions = /[?]/.test(message.body);
    if (!hasQuestions && !message.isFromUser) {
      suggestions.push('No questions found - follow-up may need to create clear call-to-action');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Gets message statistics for debugging
   */
  getMessageStats(messages: Message[]): {
    totalMessages: number;
    userMessages: number;
    recipientMessages: number;
    averageLength: number;
    timeSpan: number; // in hours
    lastMessageAge: number; // in hours
  } {
    if (messages.length === 0) {
      return {
        totalMessages: 0,
        userMessages: 0,
        recipientMessages: 0,
        averageLength: 0,
        timeSpan: 0,
        lastMessageAge: 0
      };
    }

    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const userMessages = messages.filter(msg => 
      this.isUserMessage(msg, 'user@example.com') // Would use actual user email
    ).length;

    const recipientMessages = messages.length - userMessages;
    
    const averageLength = messages.reduce((sum, msg) => 
      sum + msg.body.length, 0
    ) / messages.length;

    const timeSpan = sortedMessages.length > 1 
      ? (new Date(sortedMessages[sortedMessages.length - 1].timestamp).getTime() - 
         new Date(sortedMessages[0].timestamp).getTime()) / (1000 * 60 * 60)
      : 0;

    const lastMessageAge = (Date.now() - 
      new Date(sortedMessages[sortedMessages.length - 1].timestamp).getTime()) / (1000 * 60 * 60);

    return {
      totalMessages: messages.length,
      userMessages,
      recipientMessages,
      averageLength,
      timeSpan,
      lastMessageAge
    };
  }
}
