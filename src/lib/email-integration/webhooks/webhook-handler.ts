import { 
  WebhookEvent, 
  WebhookVerificationResult, 
  EmailProvider,
  WebhookValidationError,
  EmailSyncResult
} from '../types';
import { TokenEncryption } from '../security/token-encryption';
import { getSupabaseClient } from '@/integrations/supabase/client';

export class WebhookHandler {
  private tokenEncryption: TokenEncryption;
  private webhookSecrets: Record<EmailProvider, string>;
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  constructor(encryptionKey: string, webhookSecrets: Record<EmailProvider, string>) {
    this.tokenEncryption = new TokenEncryption(encryptionKey);
    this.webhookSecrets = webhookSecrets;
  }

  /**
   * Handles incoming webhook from email provider
   */
  async handleWebhook(
    provider: EmailProvider,
    headers: Record<string, string>,
    body: string
  ): Promise<{
    success: boolean;
    event?: WebhookEvent;
    error?: string;
  }> {
    try {
      // Rate limiting
      const rateLimitResult = this.checkRateLimit(provider, headers);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: `Rate limit exceeded: ${rateLimitResult.reason}`
        };
      }

      // Verify webhook signature
      const verification = await this.verifyWebhookSignature(provider, headers, body);
      if (!verification.isValid) {
        return {
          success: false,
          error: verification.error || 'Webhook verification failed'
        };
      }

      // Parse webhook event
      const event = this.parseWebhookEvent(provider, headers, body);
      if (!event) {
        return {
          success: false,
          error: 'Failed to parse webhook event'
        };
      }

      // Get user connection
      const connection = await this.getConnectionBySubscription(verification.userId!, provider);
      if (!connection) {
        return {
          success: false,
          error: 'Connection not found for webhook subscription'
        };
      }

      // Process the event
      const syncResult = await this.processWebhookEvent(event, connection);

      // Log the webhook event
      await this.logWebhookEvent(provider, event, syncResult);

      return {
        success: true,
        event
      };

    } catch (error) {
      console.error('Webhook handling failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verifies webhook signature
   */
  private async verifyWebhookSignature(
    provider: EmailProvider,
    headers: Record<string, string>,
    body: string
  ): Promise<WebhookVerificationResult> {
    try {
      const secret = this.webhookSecrets[provider];
      if (!secret) {
        return {
          isValid: false,
          provider,
          error: 'Webhook secret not configured for provider'
        };
      }

      let isValid = false;
      let userId: string | undefined;

      if (provider === 'google') {
        // Gmail webhook verification
        const signature = headers['x-goog-signature'];
        if (!signature) {
          return {
            isValid: false,
            provider,
            error: 'Missing Google webhook signature'
          };
        }

        isValid = this.tokenEncryption.validateWebhookSignature(body, signature, secret);

        // Extract user ID from Google webhook
        const webhookData = JSON.parse(body);
        userId = await this.getUserIdFromGoogleWebhook(webhookData);

      } else if (provider === 'microsoft') {
        // Microsoft Graph webhook verification
        const validationToken = headers['validationtoken'];
        if (validationToken) {
          // Initial webhook validation
          isValid = validationToken === secret;
        } else {
          // Event notification validation
          const signature = headers['aeg-signature'];
          if (!signature) {
            return {
              isValid: false,
              provider,
              error: 'Missing Microsoft webhook signature'
            };
          }

          isValid = this.tokenEncryption.validateWebhookSignature(body, signature, secret);

          // Extract user ID from Microsoft webhook
          const webhookData = JSON.parse(body);
          userId = await this.getUserIdFromMicrosoftWebhook(webhookData);
        }
      }

      if (!isValid) {
        return {
          isValid: false,
          provider,
          error: 'Invalid webhook signature'
        };
      }

      if (!userId) {
        return {
          isValid: false,
          provider,
          error: 'Unable to extract user ID from webhook'
        };
      }

      return {
        isValid: true,
        provider,
        userId
      };

    } catch (error) {
      throw new WebhookValidationError(
        `Webhook verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider
      );
    }
  }

  /**
   * Parses webhook event from provider-specific format
   */
  private parseWebhookEvent(
    provider: EmailProvider,
    headers: Record<string, string>,
    body: string
  ): WebhookEvent | null {
    try {
      const webhookData = JSON.parse(body);

      if (provider === 'google') {
        return this.parseGoogleWebhookEvent(webhookData);
      } else if (provider === 'microsoft') {
        return this.parseMicrosoftWebhookEvent(webhookData);
      }

      return null;

    } catch (error) {
      console.error('Failed to parse webhook event:', error);
      return null;
    }
  }

  /**
   * Parses Google Gmail webhook event
   */
  private parseGoogleWebhookEvent(webhookData: any): WebhookEvent | null {
    const messageData = webhookData.message?.data;
    if (!messageData) {
      return null;
    }

    // Decode base64 data
    const decodedData = Buffer.from(messageData, 'base64').toString('utf8');
    const notification = JSON.parse(decodedData);

    return {
      provider: 'google',
      eventType: notification.eventType || 'messageAdded',
      messageId: notification.messageId,
      threadId: notification.threadId,
      historyId: notification.historyId,
      timestamp: new Date(notification.eventTime || Date.now()),
      payload: notification
    };
  }

  /**
   * Parses Microsoft Graph webhook event
   */
  private parseMicrosoftWebhookEvent(webhookData: any): WebhookEvent | null {
    const value = webhookData.value?.[0];
    if (!value) {
      return null;
    }

    return {
      provider: 'microsoft',
      eventType: value.changeType || 'created',
      messageId: value.resourceData?.id,
      threadId: value.resourceData?.threadId,
      timestamp: new Date(value.resourceData?.lastModifiedDateTime || Date.now()),
      payload: value
    };
  }

  /**
   * Processes webhook event and syncs email data
   */
  private async processWebhookEvent(
    event: WebhookEvent,
    connection: any
  ): Promise<EmailSyncResult> {
    const startTime = Date.now();

    try {
      // Decrypt access token
      const tokens = this.tokenEncryption.decryptTokens(
        connection.encrypted_access_token,
        connection.encrypted_refresh_token
      );

      // Fetch thread data from provider
      const threadData = await this.fetchThreadData(event, tokens.accessToken, event.provider);

      // Update thread in database
      const threadsUpdated = await this.updateThreadInDatabase(threadData, connection.user_id);

      // Trigger silence detection engine
      await this.triggerSilenceDetection(threadData, connection.user_id);

      return {
        success: true,
        threadsUpdated,
        newThreads: 1,
        processingTimeMs: Date.now() - startTime
      };

    } catch (error) {
      console.error('Webhook event processing failed:', error);
      
      return {
        success: false,
        threadsUpdated: 0,
        newThreads: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Fetches thread data from email provider
   */
  private async fetchThreadData(
    event: WebhookEvent,
    accessToken: string,
    provider: EmailProvider
  ): Promise<any> {
    if (provider === 'google') {
      return this.fetchGmailThread(event.threadId, accessToken);
    } else if (provider === 'microsoft') {
      return this.fetchOutlookThread(event.threadId, accessToken);
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  /**
   * Fetches Gmail thread data
   */
  private async fetchGmailThread(threadId: string, accessToken: string): Promise<any> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetches Outlook thread data
   */
  private async fetchOutlookThread(threadId: string, accessToken: string): Promise<any> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${threadId}?$expand=thread`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Updates thread data in database
   */
  private async updateThreadInDatabase(threadData: any, userId: string): Promise<number> {
    // Extract relevant thread information
    const threadInfo = this.extractThreadInfo(threadData);

    // Upsert thread in database
    const { data, error } = await supabase
      .from('email_threads')
      .upsert({
        thread_id: threadInfo.threadId,
        user_id: userId,
        subject: threadInfo.subject,
        last_message_from: threadInfo.lastMessageFrom,
        last_message_at: threadInfo.lastMessageAt,
        needs_followup: this.calculateNeedsFollowup(threadInfo),
        updated_at: new Date()
      })
      .select('id');

    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Extracts thread information from provider data
   */
  private extractThreadInfo(threadData: any): {
    threadId: string;
    subject: string;
    lastMessageFrom: string;
    lastMessageAt: Date;
    messageCount: number;
  } {
    // Implementation would vary by provider
    // This is a simplified version
    return {
      threadId: threadData.id || threadData.threadId,
      subject: threadData.subject || 'No Subject',
      lastMessageFrom: threadData.lastMessageFrom || 'unknown',
      lastMessageAt: new Date(threadData.lastMessageAt || Date.now()),
      messageCount: threadData.messages?.length || 1
    };
  }

  /**
   * Calculates if thread needs follow-up
   */
  private calculateNeedsFollowup(threadInfo: any): boolean {
    // Simple logic - would be more sophisticated in production
    const hoursSinceLastMessage = (Date.now() - new Date(threadInfo.lastMessageAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastMessage > 72; // 3 days
  }

  /**
   * Triggers silence detection engine
   */
  private async triggerSilenceDetection(threadData: any, userId: string): Promise<void> {
    // This would call the silence detection engine
    console.log(`Triggering silence detection for user ${userId}, thread ${threadData.id}`);
  }

  /**
   * Gets user ID from Google webhook
   */
  private async getUserIdFromGoogleWebhook(webhookData: any): Promise<string | null> {
    // Implementation would extract user ID from webhook subscription
    return webhookData.userId || null;
  }

  /**
   * Gets user ID from Microsoft webhook
   */
  private async getUserIdFromMicrosoftWebhook(webhookData: any): Promise<string | null> {
    // Implementation would extract user ID from webhook subscription
    return webhookData.userId || null;
  }

  /**
   * Gets connection by webhook subscription
   */
  private async getConnectionBySubscription(userId: string, provider: EmailProvider): Promise<any> {
    const { data, error } = await supabase
      .from('email_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('connection_status', 'ACTIVE')
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  /**
   * Rate limiting for webhooks
   */
  private checkRateLimit(
    provider: EmailProvider,
    headers: Record<string, string>
  ): { allowed: boolean; reason?: string } {
    const key = `${provider}:${headers['x-forwarded-for'] || 'unknown'}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100; // 100 requests per minute

    const current = this.rateLimitMap.get(key);
    
    if (!current || now > current.resetTime) {
      // Reset or initialize
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return { allowed: true };
    }

    if (current.count >= maxRequests) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${current.count}/${maxRequests} requests per minute`
      };
    }

    current.count++;
    return { allowed: true };
  }

  /**
   * Logs webhook event for audit
   */
  private async logWebhookEvent(
    provider: EmailProvider,
    event: WebhookEvent,
    syncResult: EmailSyncResult
  ): Promise<void> {
    try {
      await supabase
        .from('webhook_event_logs')
        .insert({
          provider,
          event_type: event.eventType,
          message_id: event.messageId,
          thread_id: event.threadId,
          success: syncResult.success,
          threads_updated: syncResult.threadsUpdated,
          processing_time_ms: syncResult.processingTimeMs,
          error: syncResult.error,
          created_at: new Date()
        });
    } catch (logError) {
      console.error('Failed to log webhook event:', logError);
    }
  }

  /**
   * Creates webhook subscription for user
   */
  async createWebhookSubscription(
    userId: string,
    provider: EmailProvider,
    accessToken: string
  ): Promise<string | null> {
    try {
      let subscriptionId: string | null = null;

      if (provider === 'google') {
        subscriptionId = await this.createGmailWebhookSubscription(accessToken);
      } else if (provider === 'microsoft') {
        subscriptionId = await this.createOutlookWebhookSubscription(accessToken);
      }

      if (subscriptionId) {
        // Store subscription in database
        await supabase
          .from('webhook_subscriptions')
          .insert({
            user_id: userId,
            provider,
            subscription_id: subscriptionId,
            webhook_url: process.env.WEBHOOK_BASE_URL,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            is_active: true,
            created_at: new Date()
          });
      }

      return subscriptionId;

    } catch (error) {
      console.error('Failed to create webhook subscription:', error);
      return null;
    }
  }

  /**
   * Creates Gmail webhook subscription
   */
  private async createGmailWebhookSubscription(accessToken: string): Promise<string | null> {
    const response = await fetch('https://www.googleapis.com/gmail/api/v1/users/me/watch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topicName: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/replyzen-emails`,
        labelIds: ['INBOX']
      })
    });

    if (!response.ok) {
      throw new Error(`Gmail watch failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.historyId || null;
  }

  /**
   * Creates Outlook webhook subscription
   */
  private async createOutlookWebhookSubscription(accessToken: string): Promise<string | null> {
    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changeType: 'created,updated',
        notificationUrl: process.env.WEBHOOK_BASE_URL,
        resource: '/me/messages',
        expirationDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        clientState: this.tokenEncryption.generateSecureState()
      })
    });

    if (!response.ok) {
      throw new Error(`Outlook subscription failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.id || null;
  }

  /**
   * Cleans up expired rate limit entries
   */
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, value] of this.rateLimitMap.entries()) {
      if (now > value.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  /**
   * Gets webhook statistics
   */
  async getWebhookStats(userId?: string): Promise<{
    totalEvents: number;
    successRate: number;
    averageProcessingTime: number;
    eventsByProvider: Record<EmailProvider, number>;
  }> {
    try {
      let query = supabase
        .from('webhook_event_logs')
        .select('*');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error || !data) {
        return {
          totalEvents: 0,
          successRate: 0,
          averageProcessingTime: 0,
          eventsByProvider: { google: 0, microsoft: 0 }
        };
      }

      const totalEvents = data.length;
      const successfulEvents = data.filter(log => log.success).length;
      const successRate = totalEvents > 0 ? successfulEvents / totalEvents : 0;
      const averageProcessingTime = totalEvents > 0 
        ? data.reduce((sum, log) => sum + (log.processing_time_ms || 0), 0) / totalEvents 
        : 0;

      const eventsByProvider = data.reduce((acc, log) => {
        acc[log.provider as EmailProvider] = (acc[log.provider as EmailProvider] || 0) + 1;
        return acc;
      }, {} as Record<EmailProvider, number>);

      return {
        totalEvents,
        successRate,
        averageProcessingTime,
        eventsByProvider
      };

    } catch (error) {
      console.error('Failed to get webhook stats:', error);
      return {
        totalEvents: 0,
        successRate: 0,
        averageProcessingTime: 0,
        eventsByProvider: { google: 0, microsoft: 0 }
      };
    }
  }
}
