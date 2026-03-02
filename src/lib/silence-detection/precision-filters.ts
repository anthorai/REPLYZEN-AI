import { Message, EmailHeader, AutomationDetection, PrecisionFilter } from './types';

export class PrecisionFilterEngine {
  private filters: PrecisionFilter[] = [
    {
      name: 'no-reply-address',
      check: this.checkNoReplyAddress.bind(this),
      weight: 0.9,
      description: 'Detects no-reply email addresses'
    },
    {
      name: 'list-unsubscribe-header',
      check: this.checkListUnsubscribeHeader.bind(this),
      weight: 0.95,
      description: 'Detects List-Unsubscribe header'
    },
    {
      name: 'precedence-bulk',
      check: this.checkPrecedenceBulk.bind(this),
      weight: 0.9,
      description: 'Detects Precedence: bulk header'
    },
    {
      name: 'auto-submitted',
      check: this.checkAutoSubmitted.bind(this),
      weight: 0.85,
      description: 'Detects Auto-Submitted header'
    },
    {
      name: 'newsletter-keywords',
      check: this.checkNewsletterKeywords.bind(this),
      weight: 0.7,
      description: 'Detects newsletter keywords in content'
    },
    {
      name: 'marketing-patterns',
      check: this.checkMarketingPatterns.bind(this),
      weight: 0.8,
      description: 'Detects marketing email patterns'
    },
    {
      name: 'transactional-alerts',
      check: this.checkTransactionalAlerts.bind(this),
      weight: 0.85,
      description: 'Detects transactional alerts'
    },
    {
      name: 'mailing-list',
      check: this.checkMailingList.bind(this),
      weight: 0.9,
      description: 'Detects mailing list indicators'
    },
    {
      name: 'otp-messages',
      check: this.checkOTPMessages.bind(this),
      weight: 0.95,
      description: 'Detects OTP and verification codes'
    },
    {
      name: 'system-generated',
      check: this.checkSystemGenerated.bind(this),
      weight: 0.8,
      description: 'Detects system-generated emails'
    }
  ];

  private noReplyPatterns = [
    /no-?reply@/i,
    /noreply@/i,
    /donotreply@/i,
    /do-not-reply@/i,
    /notifications@/i,
    /updates@/i,
    /alerts@/i,
    /mailer@/i,
    /bounce@/i,
    /support@/i
  ];

  private newsletterKeywords = [
    'unsubscribe',
    'view in browser',
    'email preferences',
    'newsletter',
    'weekly digest',
    'monthly update',
    'promotional',
    'marketing',
    'advertisement',
    'sponsored',
    'click here to unsubscribe',
    'manage your subscriptions',
    'update your preferences'
  ];

  private transactionalKeywords = [
    'receipt',
    'invoice',
    'payment confirmation',
    'order confirmation',
    'shipping confirmation',
    'delivery notification',
    'booking confirmation',
    'reservation confirmed',
    'appointment reminder',
    'payment received',
    'transaction completed',
    'order status',
    'tracking number'
  ];

  private otpPatterns = [
    /verification code/i,
    /one-time password/i,
    /otp/i,
    /security code/i,
    /authentication code/i,
    /\b\d{4,8}\b.*code/i,
    /passcode/i,
    /login verification/i
  ];

  private systemPatterns = [
    /automated message/i,
    /do not reply/i,
    /this is an automated/i,
    /system notification/i,
    /generated message/i,
    /auto-generated/i,
    /please do not respond/i
  ];

  detectAutomation(message: Message, headers: EmailHeader[] = []): AutomationDetection {
    const indicators: string[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const filter of this.filters) {
      totalWeight += filter.weight;
      if (filter.check(message, headers)) {
        matchedWeight += filter.weight;
        indicators.push(filter.name);
      }
    }

    const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    const isAutomated = confidence >= 0.7; // 70% threshold for automation

    return {
      isAutomated,
      confidence,
      indicators,
      type: this.classifyAutomationType(indicators, message)
    };
  }

  private checkNoReplyAddress(message: Message, headers: EmailHeader[]): boolean {
    const fromEmail = this.extractEmail(message.from);
    return this.noReplyPatterns.some(pattern => pattern.test(fromEmail));
  }

  private checkListUnsubscribeHeader(message: Message, headers: EmailHeader[]): boolean {
    return headers.some(header => 
      header.name.toLowerCase() === 'list-unsubscribe' ||
      header.name.toLowerCase() === 'list-unsubscribe-post'
    );
  }

  private checkPrecedenceBulk(message: Message, headers: EmailHeader[]): boolean {
    return headers.some(header => 
      header.name.toLowerCase() === 'precedence' && 
      header.value.toLowerCase().includes('bulk')
    );
  }

  private checkAutoSubmitted(message: Message, headers: EmailHeader[]): boolean {
    return headers.some(header => 
      header.name.toLowerCase() === 'auto-submitted' &&
      header.value.toLowerCase() !== 'no'
    );
  }

  private checkNewsletterKeywords(message: Message, headers: EmailHeader[]): boolean {
    const content = `${message.subject} ${message.body}`.toLowerCase();
    return this.newsletterKeywords.some(keyword => content.includes(keyword));
  }

  private checkMarketingPatterns(message: Message, headers: EmailHeader[]): boolean {
    const content = `${message.subject} ${message.body}`.toLowerCase();
    const marketingPatterns = [
      /buy now/i,
      /limited time/i,
      /special offer/i,
      /discount/i,
      /promotion/i,
      /sale/i,
      /deal/i,
      /offer expires/i,
      /act now/i,
      /don't miss/i
    ];
    
    return marketingPatterns.some(pattern => pattern.test(content));
  }

  private checkTransactionalAlerts(message: Message, headers: EmailHeader[]): boolean {
    const content = `${message.subject} ${message.body}`.toLowerCase();
    return this.transactionalKeywords.some(keyword => content.includes(keyword));
  }

  private checkMailingList(message: Message, headers: EmailHeader[]): boolean {
    const listHeaders = [
      'list-id',
      'list-post',
      'list-help',
      'list-owner',
      'list-archive'
    ];
    
    return headers.some(header => 
      listHeaders.includes(header.name.toLowerCase())
    );
  }

  private checkOTPMessages(message: Message, headers: EmailHeader[]): boolean {
    const content = `${message.subject} ${message.body}`;
    return this.otpPatterns.some(pattern => pattern.test(content));
  }

  private checkSystemGenerated(message: Message, headers: EmailHeader[]): boolean {
    const content = `${message.subject} ${message.body}`;
    return this.systemPatterns.some(pattern => pattern.test(content));
  }

  private extractEmail(emailString: string): string {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString;
  }

  private classifyAutomationType(indicators: string[], message: Message): AutomationDetection['type'] {
    if (indicators.includes('newsletter-keywords') || indicators.includes('list-unsubscribe-header')) {
      return 'newsletter';
    }
    
    if (indicators.includes('marketing-patterns')) {
      return 'marketing';
    }
    
    if (indicators.includes('transactional-alerts')) {
      return 'transactional';
    }
    
    if (indicators.includes('otp-messages')) {
      return 'transactional';
    }
    
    if (indicators.includes('mailing-list')) {
      return 'newsletter';
    }
    
    if (indicators.includes('system-generated') || indicators.includes('no-reply-address')) {
      return 'support';
    }
    
    return 'unknown';
  }

  getFilterStats(): { name: string; weight: number; description: string }[] {
    return this.filters.map(filter => ({
      name: filter.name,
      weight: filter.weight,
      description: filter.description
    }));
  }

  addCustomFilter(filter: PrecisionFilter): void {
    this.filters.push(filter);
  }

  removeFilter(filterName: string): boolean {
    const index = this.filters.findIndex(f => f.name === filterName);
    if (index !== -1) {
      this.filters.splice(index, 1);
      return true;
    }
    return false;
  }
}
