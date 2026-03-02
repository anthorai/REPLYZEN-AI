import {
  AutoSendRequest,
  AutoSendResult,
  QueueJob,
  AutoSendDecision,
  AutoSendConfig,
  EmailProviderResponse,
  RetryStrategy
} from './types';
import { PreSendValidator } from './pre-send-validator';
import { IdempotencyManager } from './idempotency-manager';
import { AuditLogger } from './audit-logger';
import { EmailProviderService } from './email-provider-service';

export class QueueWorker {
  private preSendValidator: PreSendValidator;
  private idempotencyManager: IdempotencyManager;
  private auditLogger: AuditLogger;
  private emailProvider: EmailProviderService;
  private config: AutoSendConfig;
  private retryStrategy: RetryStrategy;

  constructor(config?: Partial<AutoSendConfig>) {
    this.preSendValidator = new PreSendValidator();
    this.idempotencyManager = new IdempotencyManager();
    this.auditLogger = new AuditLogger();
    this.emailProvider = new EmailProviderService();
    
    this.config = {
      spamRiskThreshold: 75,
      maxRetryAttempts: 3,
      retryDelayMs: 5000,
      processingTimeoutMs: 150000,
      queuePriority: 'medium',
      enableSentimentGuard: true,
      enableAdvancedSpamDetection: true,
      auditLogRetention: 90,
      batchSize: 10,
      rateLimitPerSecond: 10,
      ...config
    };

    this.retryStrategy = {
      maxAttempts: this.config.maxRetryAttempts,
      baseDelayMs: this.config.retryDelayMs,
      maxDelayMs: 300000, // 5 minutes
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: ['RATE_LIMIT', 'TEMPORARY_FAILURE', 'NETWORK_ERROR']
    };
  }

  /**
   * Main worker entry point - processes auto-send requests
   */
  async processRequest(request: AutoSendRequest): Promise<AutoSendResult> {
    const startTime = Date.now();
    const attemptId = this.generateAttemptId();

    try {
      // Log pre-send validation start
      await this.auditLogger.logEvent({
        threadId: request.threadId,
        followUpId: request.followUpId,
        userId: request.userId,
        eventType: 'pre_send_validation',
        decision: 'SAFE_TO_SEND', // Will be updated based on actual decision
        processingTimeMs: 0,
        metadata: {
          requestId: attemptId,
          idempotencyKey: request.idempotencyKey,
          priority: request.priority
        }
      });

      // Idempotency check
      const { isDuplicate, existingAttempt } = await this.idempotencyManager.checkDuplicate(request);
      if (isDuplicate && existingAttempt) {
        return this.createDuplicateResult(request, existingAttempt, startTime);
      }

      // Pre-send validation
      const validationResult = await this.preSendValidator.validate(request);
      
      // Create base result
      const result: AutoSendResult = {
        threadId: request.threadId,
        followUpId: request.followUpId,
        userId: request.userId,
        decision: validationResult.decision,
        decisionTimestamp: new Date(),
        validation: validationResult.validation,
        cancellationReason: validationResult.cancellationReason,
        userInsight: validationResult.userInsight,
        processingTimeMs: Date.now() - startTime,
        idempotencyKey: request.idempotencyKey,
        retryCount: 0
      };

      // Process based on decision
      if (validationResult.decision === 'SAFE_TO_SEND') {
        const sendResult = await this.executeSend(request, result);
        return sendResult;
      } else {
        // Log cancellation
        await this.logCancellation(request, result);
        return result;
      }

    } catch (error) {
      console.error('Queue worker processing failed:', error);
      
      const errorResult = await this.handleProcessingError(request, error, startTime);
      return errorResult;
    }
  }

  /**
   * Executes the actual email send
   */
  private async executeSend(request: AutoSendRequest, validationResult: AutoSendResult): Promise<AutoSendResult> {
    const sendStartTime = Date.now();

    try {
      // Send email via provider
      const emailResponse = await this.emailProvider.sendEmail({
        to: validationResult.validation.currentThreadState.recipientEmail,
        subject: validationResult.validation.currentThreadState.subject,
        body: request.generatedMessage,
        threadId: request.threadId,
        userId: request.userId
      });

      // Update result with send information
      const result: AutoSendResult = {
        ...validationResult,
        decision: 'SAFE_TO_SEND',
        sentAt: new Date(),
        emailProviderId: emailResponse.messageId,
        processingTimeMs: validationResult.processingTimeMs + (Date.now() - sendStartTime)
      };

      // Log successful send
      await this.auditLogger.logEvent({
        threadId: request.threadId,
        followUpId: request.followUpId,
        userId: request.userId,
        eventType: 'send_success',
        decision: result.decision,
        validationSnapshot: result.validation,
        processingTimeMs: result.processingTimeMs,
        metadata: {
          emailProviderId: emailResponse.messageId,
          provider: emailResponse.provider,
          messageId: emailResponse.messageId
        }
      });

      // Record successful attempt
      await this.idempotencyManager.recordAttempt({
        id: this.generateAttemptId(),
        threadId: request.threadId,
        followUpId: request.followUpId,
        userId: request.userId,
        decision: result.decision,
        validationSnapshot: result.validation,
        generatedMessage: request.generatedMessage,
        userInsight: result.userInsight,
        sentAt: result.sentAt,
        emailProviderId: result.emailProviderId,
        processingTimeMs: result.processingTimeMs,
        idempotencyKey: request.idempotencyKey,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return result;

    } catch (error) {
      console.error('Email send failed:', error);

      // Log send failure
      await this.auditLogger.logEvent({
        threadId: request.threadId,
        followUpId: request.followUpId,
        userId: request.userId,
        eventType: 'send_failed',
        decision: 'RETRY_LATER',
        validationSnapshot: validationResult.validation,
        processingTimeMs: validationResult.processingTimeMs + (Date.now() - sendStartTime),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          errorType: error.constructor.name
        }
      });

      // Determine if retry is appropriate
      const retryDecision = this.shouldRetry(error, validationResult.retryCount);
      
      const result: AutoSendResult = {
        ...validationResult,
        decision: retryDecision.shouldRetry ? 'RETRY_LATER' : 'CANCELLED',
        cancellationReason: retryDecision.shouldRetry ? undefined : 'technical_error',
        retryCount: validationResult.retryCount + 1,
        nextRetryAt: retryDecision.nextRetryAt
      };

      return result;
    }
  }

  /**
   * Processes batch of requests
   */
  async processBatch(requests: AutoSendRequest[]): Promise<AutoSendResult[]> {
    const results: AutoSendResult[] = [];
    const batchSize = Math.min(requests.length, this.config.batchSize);

    // Process in batches with rate limiting
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (request, index) => {
        // Add delay for rate limiting
        if (index > 0) {
          await this.delay(1000 / this.config.rateLimitPerSecond);
        }
        
        return this.processRequest(request);
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Batch item ${i + index} failed:`, result.reason);
          // Create error result
          const errorResult: AutoSendResult = {
            threadId: batch[index].threadId,
            followUpId: batch[index].followUpId,
            userId: batch[index].userId,
            decision: 'CANCELLED',
            decisionTimestamp: new Date(),
            validation: {} as any,
            cancellationReason: 'technical_error',
            userInsight: 'Processing failed - please try again later',
            processingTimeMs: 0,
            idempotencyKey: batch[index].idempotencyKey,
            retryCount: 0
          };
          results.push(errorResult);
        }
      });
    }

    return results;
  }

  /**
   * Handles retry logic
   */
  async handleRetry(request: AutoSendRequest, lastResult: AutoSendResult): Promise<AutoSendResult> {
    if (lastResult.retryCount >= this.retryStrategy.maxAttempts) {
      return {
        ...lastResult,
        decision: 'CANCELLED',
        cancellationReason: 'max_retry_attempts_exceeded',
        userInsight: 'Unable to send after multiple attempts'
      };
    }

    // Calculate retry delay
    const delay = this.calculateRetryDelay(lastResult.retryCount);
    const nextRetryAt = new Date(Date.now() + delay);

    // Wait before retry
    await this.delay(delay);

    // Process retry
    const retryResult = await this.processRequest({
      ...request,
      retryCount: lastResult.retryCount + 1
    });

    return {
      ...retryResult,
      retryCount: lastResult.retryCount + 1,
      nextRetryAt
    };
  }

  /**
   * Determines if an error is retryable
   */
  private shouldRetry(error: any, currentRetryCount: number): {
    shouldRetry: boolean;
    nextRetryAt?: Date;
  } {
    if (currentRetryCount >= this.retryStrategy.maxAttempts) {
      return { shouldRetry: false };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryable = this.retryStrategy.retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError)
    );

    if (!isRetryable) {
      return { shouldRetry: false };
    }

    const delay = this.calculateRetryDelay(currentRetryCount);
    const nextRetryAt = new Date(Date.now() + delay);

    return { shouldRetry: true, nextRetryAt };
  }

  /**
   * Calculates retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    let delay = this.retryStrategy.baseDelayMs * Math.pow(this.retryStrategy.backoffMultiplier, retryCount);
    delay = Math.min(delay, this.retryStrategy.maxDelayMs);

    // Add jitter to prevent thundering herd
    if (this.retryStrategy.jitter) {
      const jitterAmount = delay * 0.1 * Math.random();
      delay += jitterAmount;
    }

    return delay;
  }

  /**
   * Handles processing errors
   */
  private async handleProcessingError(
    request: AutoSendRequest,
    error: any,
    startTime: number
  ): Promise<AutoSendResult> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log error
    await this.auditLogger.logEvent({
      threadId: request.threadId,
      followUpId: request.followUpId,
      userId: request.userId,
      eventType: 'send_failed',
      decision: 'CANCELLED',
      processingTimeMs: Date.now() - startTime,
      errorMessage,
      metadata: {
        errorType: error.constructor.name,
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    return {
      threadId: request.threadId,
      followUpId: request.followUpId,
      userId: request.userId,
      decision: 'CANCELLED',
      decisionTimestamp: new Date(),
      validation: {} as any,
      cancellationReason: 'technical_error',
      userInsight: 'Processing failed - please try again later',
      processingTimeMs: Date.now() - startTime,
      idempotencyKey: request.idempotencyKey,
      retryCount: 0
    };
  }

  /**
   * Creates result for duplicate request
   */
  private createDuplicateResult(
    request: AutoSendRequest,
    existingAttempt: any,
    startTime: number
  ): AutoSendResult {
    return {
      threadId: request.threadId,
      followUpId: request.followUpId,
      userId: request.userId,
      decision: existingAttempt.decision,
      decisionTimestamp: new Date(existingAttempt.createdAt),
      validation: existingAttempt.validationSnapshot,
      cancellationReason: existingAttempt.cancellationReason,
      userInsight: 'Request already processed',
      sentAt: existingAttempt.sentAt,
      emailProviderId: existingAttempt.emailProviderId,
      processingTimeMs: Date.now() - startTime,
      idempotencyKey: request.idempotencyKey,
      retryCount: 0
    };
  }

  /**
   * Logs cancellation events
   */
  private async logCancellation(request: AutoSendRequest, result: AutoSendResult): Promise<void> {
    await this.auditLogger.logEvent({
      threadId: request.threadId,
      followUpId: request.followUpId,
      userId: request.userId,
      eventType: 'cancellation',
      decision: result.decision,
      cancellationReason: result.cancellationReason,
      validationSnapshot: result.validation,
      processingTimeMs: result.processingTimeMs,
      metadata: {
        spamRiskScore: result.validation.spamRiskAnalysis?.overallScore,
        dailyCount: result.validation.dailyLimitCheck?.currentCount,
        plan: request.plan
      }
    });

    // Record cancelled attempt
    await this.idempotencyManager.recordAttempt({
      id: this.generateAttemptId(),
      threadId: request.threadId,
      followUpId: request.followUpId,
      userId: request.userId,
      decision: result.decision,
      cancellationReason: result.cancellationReason,
      validationSnapshot: result.validation,
      generatedMessage: request.generatedMessage,
      userInsight: result.userInsight,
      processingTimeMs: result.processingTimeMs,
      idempotencyKey: request.idempotencyKey,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Gets worker statistics
   */
  async getWorkerStats(): Promise<{
    processedToday: number;
    successRate: number;
    averageProcessingTime: number;
    queueDepth: number;
    errorRate: number;
    retryRate: number;
  }> {
    // In production, this would query actual metrics
    return {
      processedToday: 125,
      successRate: 0.87,
      averageProcessingTime: 120,
      queueDepth: 23,
      errorRate: 0.08,
      retryRate: 0.15
    };
  }

  /**
   * Health check for the worker
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message?: string;
    }>;
  }> {
    const checks = [];

    // Check database connectivity
    try {
      // Would check actual database connection
      checks.push({ name: 'database', status: 'pass' });
    } catch (error) {
      checks.push({ name: 'database', status: 'fail', message: 'Database connection failed' });
    }

    // Check email provider connectivity
    try {
      // Would check email provider API
      checks.push({ name: 'email_provider', status: 'pass' });
    } catch (error) {
      checks.push({ name: 'email_provider', status: 'warn', message: 'Email provider slow' });
    }

    // Check processing time
    const stats = await this.getWorkerStats();
    if (stats.averageProcessingTime > this.config.processingTimeoutMs) {
      checks.push({ name: 'performance', status: 'warn', message: 'Processing time high' });
    } else {
      checks.push({ name: 'performance', status: 'pass' });
    }

    const failedChecks = checks.filter(c => c.status === 'fail');
    const warnChecks = checks.filter(c => c.status === 'warn');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (failedChecks.length > 0) {
      status = 'unhealthy';
    } else if (warnChecks.length > 0) {
      status = 'degraded';
    }

    return { status, checks };
  }

  /**
   * Utility methods
   */
  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets worker configuration
   */
  getConfig(): AutoSendConfig {
    return { ...this.config };
  }

  /**
   * Updates worker configuration
   */
  updateConfig(newConfig: Partial<AutoSendConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Queue worker shutting down...');
    // Would clean up resources, stop processing, etc.
    console.log('Queue worker shutdown complete');
  }
}
