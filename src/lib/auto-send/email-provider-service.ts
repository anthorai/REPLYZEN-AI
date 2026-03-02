import { EmailProviderResponse } from './types';

export interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  threadId: string;
  userId: string;
  replyToMessageId?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

export class EmailProviderService {
  private readonly providers = ['gmail', 'outlook', 'sendgrid', 'aws_ses'] as const;
  private readonly rateLimits = new Map<string, {
    limit: number;
    windowMs: number;
    currentCount: number;
    resetTime: Date;
  }>();

  /**
   * Sends email via appropriate provider
   */
  async sendEmail(request: EmailRequest): Promise<EmailProviderResponse> {
    const startTime = Date.now();
    
    try {
      // Check rate limits
      await this.checkRateLimit(request.userId);
      
      // Select provider based on user preference or availability
      const provider = await this.selectProvider(request.userId);
      
      // Send email
      const response = await this.sendViaProvider(provider, request);
      
      // Update rate limit
      this.updateRateLimit(request.userId);
      
      // Log success
      console.log(`Email sent successfully via ${provider}`, {
        messageId: response.messageId,
        to: request.to,
        processingTime: Date.now() - startTime
      });
      
      return response;
      
    } catch (error) {
      console.error('Email send failed:', error);
      
      // Return error response
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'unknown',
        timestamp: new Date()
      };
    }
  }

  /**
   * Sends email via specific provider
   */
  private async sendViaProvider(
    provider: string,
    request: EmailRequest
  ): Promise<EmailProviderResponse> {
    switch (provider) {
      case 'gmail':
        return this.sendViaGmail(request);
      case 'outlook':
        return this.sendViaOutlook(request);
      case 'sendgrid':
        return this.sendViaSendGrid(request);
      case 'aws_ses':
        return this.sendViaAWSSes(request);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Sends email via Gmail API
   */
  private async sendViaGmail(request: EmailRequest): Promise<EmailProviderResponse> {
    try {
      // In production, this would use Gmail API
      console.log('Sending via Gmail API', { to: request.to, subject: request.subject });
      
      // Mock implementation
      await this.delay(1000); // Simulate API call
      
      return {
        success: true,
        messageId: `gmail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        provider: 'gmail',
        timestamp: new Date(),
        metadata: {
          api: 'gmail',
          quota: 'remaining'
        }
      };
    } catch (error) {
      throw new Error(`Gmail API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sends email via Outlook API
   */
  private async sendViaOutlook(request: EmailRequest): Promise<EmailProviderResponse> {
    try {
      // In production, this would use Microsoft Graph API
      console.log('Sending via Outlook API', { to: request.to, subject: request.subject });
      
      // Mock implementation
      await this.delay(1200); // Simulate API call
      
      return {
        success: true,
        messageId: `outlook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        provider: 'outlook',
        timestamp: new Date(),
        metadata: {
          api: 'microsoft_graph',
          quota: 'remaining'
        }
      };
    } catch (error) {
      throw new Error(`Outlook API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sends email via SendGrid
   */
  private async sendViaSendGrid(request: EmailRequest): Promise<EmailProviderResponse> {
    try {
      // In production, this would use SendGrid API
      console.log('Sending via SendGrid API', { to: request.to, subject: request.subject });
      
      // Mock implementation
      await this.delay(800); // Simulate API call
      
      return {
        success: true,
        messageId: `sendgrid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        provider: 'sendgrid',
        timestamp: new Date(),
        metadata: {
          api: 'sendgrid',
          category: 'followup'
        }
      };
    } catch (error) {
      throw new Error(`SendGrid API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sends email via AWS SES
   */
  private async sendViaAWSSes(request: EmailRequest): Promise<EmailProviderResponse> {
    try {
      // In production, this would use AWS SES API
      console.log('Sending via AWS SES', { to: request.to, subject: request.subject });
      
      // Mock implementation
      await this.delay(600); // Simulate API call
      
      return {
        success: true,
        messageId: `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        provider: 'aws_ses',
        timestamp: new Date(),
        metadata: {
          api: 'aws_ses',
          region: 'us-east-1'
        }
      };
    } catch (error) {
      throw new Error(`AWS SES error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Selects best provider for the user
   */
  private async selectProvider(userId: string): Promise<string> {
    // In production, this would check user's email provider preference
    // and provider availability/health status
    
    // For now, return a mock selection
    const providerHealth = await this.checkProviderHealth();
    const availableProviders = this.providers.filter(p => providerHealth[p].healthy);
    
    if (availableProviders.length === 0) {
      throw new Error('No healthy email providers available');
    }
    
    // Select the first available provider (in production, would use user preference)
    return availableProviders[0];
  }

  /**
   * Checks health of all providers
   */
  private async checkProviderHealth(): Promise<Record<string, { healthy: boolean; latency?: number; error?: string }>> {
    const health: Record<string, { healthy: boolean; latency?: number; error?: string }> = {};
    
    for (const provider of this.providers) {
      try {
        const startTime = Date.now();
        
        // In production, this would ping the provider's health endpoint
        await this.delay(100); // Mock health check
        const latency = Date.now() - startTime;
        
        health[provider] = {
          healthy: latency < 5000, // Consider unhealthy if latency > 5s
          latency
        };
      } catch (error) {
        health[provider] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    return health;
  }

  /**
   * Checks rate limit for user
   */
  private async checkRateLimit(userId: string): Promise<void> {
    const rateLimit = this.rateLimits.get(userId);
    
    if (!rateLimit) {
      // Initialize rate limit for user
      this.rateLimits.set(userId, {
        limit: 100, // 100 emails per hour
        windowMs: 60 * 60 * 1000, // 1 hour
        currentCount: 0,
        resetTime: new Date(Date.now() + 60 * 60 * 1000)
      });
      return;
    }
    
    const now = new Date();
    
    // Reset window if expired
    if (now > rateLimit.resetTime) {
      rateLimit.currentCount = 0;
      rateLimit.resetTime = new Date(now.getTime() + rateLimit.windowMs);
    }
    
    // Check limit
    if (rateLimit.currentCount >= rateLimit.limit) {
      throw new Error(`Rate limit exceeded. Limit: ${rateLimit.limit}, Current: ${rateLimit.currentCount}, Reset at: ${rateLimit.resetTime.toISOString()}`);
    }
  }

  /**
   * Updates rate limit after successful send
   */
  private updateRateLimit(userId: string): void {
    const rateLimit = this.rateLimits.get(userId);
    if (rateLimit) {
      rateLimit.currentCount++;
    }
  }

  /**
   * Gets provider statistics
   */
  async getProviderStats(): Promise<{
    providers: Array<{
      name: string;
      healthy: boolean;
      latency?: number;
      error?: string;
      lastUsed?: Date;
      usageCount: number;
    }>;
    totalSends: number;
    averageLatency: number;
  }> {
    const health = await this.checkProviderHealth();
    
    const providers = this.providers.map(provider => ({
      name: provider,
      ...health[provider],
      lastUsed: new Date(), // Would track actual last usage
      usageCount: Math.floor(Math.random() * 100) // Mock data
    }));
    
    const totalSends = providers.reduce((sum, p) => sum + p.usageCount, 0);
    const averageLatency = providers
      .filter(p => p.latency !== undefined)
      .reduce((sum, p) => sum + (p.latency || 0), 0) / 
      providers.filter(p => p.latency !== undefined).length;
    
    return {
      providers,
      totalSends,
      averageLatency
    };
  }

  /**
   * Validates email request
   */
  validateEmailRequest(request: EmailRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!request.to) {
      errors.push('Recipient email is required');
    }
    
    if (!request.subject) {
      errors.push('Subject is required');
    }
    
    if (!request.body) {
      errors.push('Email body is required');
    }
    
    if (request.body.length > 50000) {
      errors.push('Email body too long (max 50,000 characters)');
    }
    
    if (!request.threadId) {
      errors.push('Thread ID is required');
    }
    
    if (!request.userId) {
      errors.push('User ID is required');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (request.to && !emailRegex.test(request.to)) {
      errors.push('Invalid recipient email format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets delivery status for a message
   */
  async getDeliveryStatus(messageId: string, provider: string): Promise<{
    delivered: boolean;
    opened?: boolean;
    clicked?: boolean;
    bounced?: boolean;
    error?: string;
    timestamp: Date;
  }> {
    try {
      // In production, this would query the provider's delivery status API
      console.log(`Getting delivery status for ${messageId} from ${provider}`);
      
      // Mock implementation
      return {
        delivered: true,
        opened: Math.random() > 0.3,
        clicked: Math.random() > 0.7,
        bounced: false,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Failed to get delivery status:', error);
      throw error;
    }
  }

  /**
   * Tracks email engagement
   */
  async trackEngagement(messageId: string, provider: string): Promise<{
    opens: number;
    clicks: number;
    lastActivity?: Date;
    engagementRate: number;
  }> {
    try {
      // In production, this would query engagement analytics
      console.log(`Tracking engagement for ${messageId} from ${provider}`);
      
      // Mock implementation
      const opens = Math.floor(Math.random() * 5);
      const clicks = Math.floor(Math.random() * 2);
      
      return {
        opens,
        clicks,
        lastActivity: new Date(),
        engagementRate: opens > 0 ? clicks / opens : 0
      };
    } catch (error) {
      console.error('Failed to track engagement:', error);
      throw error;
    }
  }

  /**
   * Handles provider fallback
   */
  async handleProviderFallback(
    originalProvider: string,
    request: EmailRequest,
    error: Error
  ): Promise<EmailProviderResponse> {
    console.log(`Provider ${originalProvider} failed, attempting fallback`, error.message);
    
    // Try alternative providers
    const alternativeProviders = this.providers.filter(p => p !== originalProvider);
    
    for (const provider of alternativeProviders) {
      try {
        console.log(`Trying fallback provider: ${provider}`);
        return await this.sendViaProvider(provider, request);
      } catch (fallbackError) {
        console.error(`Fallback provider ${provider} also failed:`, fallbackError);
        continue;
      }
    }
    
    // All providers failed
    return {
      success: false,
      error: `All providers failed. Original error: ${error.message}`,
      provider: 'fallback_failed',
      timestamp: new Date()
    };
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets provider configuration
   */
  getProviderConfig(provider: string): {
    name: string;
    rateLimit: {
      limit: number;
      windowMs: number;
    };
    features: string[];
    supported: boolean;
  } {
    const configs: Record<string, any> = {
      gmail: {
        name: 'Gmail',
        rateLimit: { limit: 100, windowMs: 60 * 60 * 1000 },
        features: ['threads', 'drafts', 'labels'],
        supported: true
      },
      outlook: {
        name: 'Outlook',
        rateLimit: { limit: 100, windowMs: 60 * 60 * 1000 },
        features: ['threads', 'drafts', 'categories'],
        supported: true
      },
      sendgrid: {
        name: 'SendGrid',
        rateLimit: { limit: 1000, windowMs: 60 * 60 * 1000 },
        features: ['templates', 'analytics', 'webhooks'],
        supported: true
      },
      aws_ses: {
        name: 'AWS SES',
        rateLimit: { limit: 10000, windowMs: 60 * 60 * 1000 },
        features: ['high-volume', 'analytics', 'dedicated IPs'],
        supported: true
      }
    };
    
    return configs[provider] || {
      name: provider,
      rateLimit: { limit: 0, windowMs: 0 },
      features: [],
      supported: false
    };
  }
}
