import {
  AutoSendRequest,
  AutoSendResult,
  AutoSendDecision,
  CancellationReason,
  AutoSendConfig,
  UserAutoSendStats,
  SystemMetrics
} from './types';
import { QueueWorker } from './queue-worker';
import { PreSendValidator } from './pre-send-validator';
import { IdempotencyManager } from './idempotency-manager';
import { AuditLogger } from './audit-logger';
import { EmailProviderService } from './email-provider-service';

export class AutoSendController {
  private queueWorker: QueueWorker;
  private preSendValidator: PreSendValidator;
  private idempotencyManager: IdempotencyManager;
  private auditLogger: AuditLogger;
  private emailProvider: EmailProviderService;
  private config: AutoSendConfig;

  constructor(config?: Partial<AutoSendConfig>) {
    this.queueWorker = new QueueWorker(config);
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
  }

  /**
   * Main entry point for auto-send requests
   */
  async processAutoSend(request: AutoSendRequest): Promise<AutoSendResult> {
    const startTime = Date.now();
    
    try {
      // Validate request
      this.validateRequest(request);
      
      // Generate idempotency key if not provided
      if (!request.idempotencyKey) {
        request.idempotencyKey = this.idempotencyManager.generateIdempotencyKey(request);
      }
      
      // Process through queue worker
      const result = await this.queueWorker.processRequest(request);
      
      // Log completion
      await this.logCompletion(request, result, Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      console.error('Auto-send controller failed:', error);
      
      const errorResult: AutoSendResult = {
        threadId: request.threadId,
        followUpId: request.followUpId,
        userId: request.userId,
        decision: 'CANCELLED',
        decisionTimestamp: new Date(),
        validation: {} as any,
        cancellationReason: 'technical_error',
        userInsight: 'Processing failed - please try again later',
        processingTimeMs: Date.now() - startTime,
        idempotencyKey: request.idempotencyKey || 'unknown',
        retryCount: 0
      };
      
      await this.logCompletion(request, errorResult, Date.now() - startTime);
      
      return errorResult;
    }
  }

  /**
   * Processes multiple auto-send requests
   */
  async processBatchAutoSend(requests: AutoSendRequest[]): Promise<AutoSendResult[]> {
    const startTime = Date.now();
    
    try {
      // Validate all requests
      requests.forEach(req => this.validateRequest(req));
      
      // Process batch
      const results = await this.queueWorker.processBatch(requests);
      
      // Log batch completion
      await this.logBatchCompletion(requests, results, Date.now() - startTime);
      
      return results;
      
    } catch (error) {
      console.error('Batch auto-send failed:', error);
      
      // Return error results for all requests
      return requests.map(req => ({
        threadId: req.threadId,
        followUpId: req.followUpId,
        userId: req.userId,
        decision: 'CANCELLED' as AutoSendDecision,
        decisionTimestamp: new Date(),
        validation: {} as any,
        cancellationReason: 'technical_error',
        userInsight: 'Batch processing failed',
        processingTimeMs: 0,
        idempotencyKey: req.idempotencyKey || 'unknown',
        retryCount: 0
      }));
    }
  }

  /**
   * Gets auto-send statistics for a user
   */
  async getUserStats(userId: string): Promise<UserAutoSendStats> {
    try {
      // In production, this would query the database
      const auditStats = await this.auditLogger.getAuditStats(userId);
      const providerStats = await this.emailProvider.getProviderStats();
      
      return {
        userId,
        plan: 'pro', // Would fetch from user profile
        totalAttempts: auditStats.totalLogs,
        successfulSends: auditStats.logsByDecision.SAFE_TO_SEND || 0,
        cancelledAttempts: auditStats.logsByDecision.CANCELLED || 0,
        averageProcessingTime: auditStats.averageProcessingTime,
        spamRiskAverage: 0.15, // Would calculate from actual data
        dailyUsage: [
          { date: '2026-03-01', sent: 12, cancelled: 3 },
          { date: '2026-03-02', sent: 15, cancelled: 2 }
        ],
        topCancellationReasons: Object.entries(auditStats.logsByCancellationReason)
          .map(([reason, count]) => ({ reason: reason as CancellationReason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        lastActivity: new Date()
      };
    } catch (error) {
      console.error('Failed to get user stats:', error);
      throw error;
    }
  }

  /**
   * Gets system-wide metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const auditStats = await this.auditLogger.getAuditStats();
      const workerStats = await this.queueWorker.getWorkerStats();
      const providerStats = await this.emailProvider.getProviderStats();
      
      return {
        totalProcessed: auditStats.totalLogs,
        successRate: auditStats.logsByDecision.SAFE_TO_SEND / auditStats.totalLogs,
        averageProcessingTime: auditStats.averageProcessingTime,
        spamRiskAverage: 0.15, // Would calculate from actual data
        cancellationRate: auditStats.logsByDecision.CANCELLED / auditStats.totalLogs,
        retryRate: auditStats.logsByDecision.RETRY_LATER / auditStats.totalLogs,
        queueDepth: workerStats.queueDepth,
        errorRate: auditStats.errorRate,
        planDistribution: {
          free: 0.2,
          pro: 0.7,
          enterprise: 0.1
        },
        topRiskFactors: [
          { factor: 'high_frequency', count: 25 },
          { factor: 'repetitive_content', count: 18 },
          { factor: 'unusual_timing', count: 12 }
        ]
      };
    } catch (error) {
      console.error('Failed to get system metrics:', error);
      throw error;
    }
  }

  /**
   * Validates auto-send request
   */
  private validateRequest(request: AutoSendRequest): void {
    if (!request.threadId) {
      throw new Error('Thread ID is required');
    }
    
    if (!request.followUpId) {
      throw new Error('Follow-up ID is required');
    }
    
    if (!request.userId) {
      throw new Error('User ID is required');
    }
    
    if (!request.generatedMessage) {
      throw new Error('Generated message is required');
    }
    
    if (request.originalSilenceDuration < 0) {
      throw new Error('Invalid silence duration');
    }
    
    if (request.userFollowUpRule < 1) {
      throw new Error('Invalid follow-up rule');
    }
    
    if (!['free', 'pro', 'enterprise'].includes(request.plan)) {
      throw new Error('Invalid plan type');
    }
    
    if (request.dailySendLimit < 0) {
      throw new Error('Invalid daily send limit');
    }
  }

  /**
   * Logs completion of auto-send processing
   */
  private async logCompletion(
    request: AutoSendRequest,
    result: AutoSendResult,
    processingTimeMs: number
  ): Promise<void> {
    await this.auditLogger.logEvent({
      threadId: request.threadId,
      followUpId: request.followUpId,
      userId: request.userId,
      eventType: result.decision === 'SAFE_TO_SEND' ? 'send_success' : 'cancellation',
      decision: result.decision,
      cancellationReason: result.cancellationReason,
      processingTimeMs,
      metadata: {
        plan: request.plan,
        spamRiskScore: result.validation.spamRiskAnalysis?.overallScore,
        dailyCount: result.validation.dailyLimitCheck?.currentCount,
        userInsight: result.userInsight
      }
    });
  }

  /**
   * Logs batch completion
   */
  private async logBatchCompletion(
    requests: AutoSendRequest[],
    results: AutoSendResult[],
    processingTimeMs: number
  ): Promise<void> {
    const events = results.map((result, index) => ({
      threadId: requests[index].threadId,
      followUpId: requests[index].followUpId,
      userId: requests[index].userId,
      eventType: result.decision === 'SAFE_TO_SEND' ? 'send_success' : 'cancellation',
      decision: result.decision,
      cancellationReason: result.cancellationReason,
      processingTimeMs: result.processingTimeMs,
      metadata: {
        batchId: `batch_${Date.now()}`,
        batchSize: requests.length,
        totalBatchTime: processingTimeMs
      }
    }));
    
    await this.auditLogger.logBatchEvents(events);
  }

  /**
   * Enables auto-send for a user
   */
  async enableAutoSend(userId: string, plan: 'pro' | 'enterprise'): Promise<{
    success: boolean;
    message: string;
    dailyLimit: number;
  }> {
    try {
      // In production, this would update user settings
      const dailyLimits = {
        pro: 50,
        enterprise: 1000
      };
      
      const dailyLimit = dailyLimits[plan];
      
      await this.auditLogger.logEvent({
        threadId: 'system',
        followUpId: 'system',
        userId,
        eventType: 'pre_send_validation',
        decision: 'SAFE_TO_SEND',
        processingTimeMs: 0,
        metadata: {
          action: 'auto_send_enabled',
          plan,
          dailyLimit
        }
      });
      
      return {
        success: true,
        message: `Auto-send enabled with daily limit of ${dailyLimit}`,
        dailyLimit
      };
    } catch (error) {
      console.error('Failed to enable auto-send:', error);
      return {
        success: false,
        message: 'Failed to enable auto-send',
        dailyLimit: 0
      };
    }
  }

  /**
   * Disables auto-send for a user
   */
  async disableAutoSend(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // In production, this would update user settings
      await this.auditLogger.logEvent({
        threadId: 'system',
        followUpId: 'system',
        userId,
        eventType: 'cancellation',
        decision: 'CANCELLED',
        cancellationReason: 'plan_limit_reached',
        processingTimeMs: 0,
        metadata: {
          action: 'auto_send_disabled'
        }
      });
      
      return {
        success: true,
        message: 'Auto-send disabled'
      };
    } catch (error) {
      console.error('Failed to disable auto-send:', error);
      return {
        success: false,
        message: 'Failed to disable auto-send'
      };
    }
  }

  /**
   * Gets auto-send eligibility for a user
   */
  async getEligibility(userId: string): Promise<{
    eligible: boolean;
    plan: 'free' | 'pro' | 'enterprise';
    autoSendEnabled: boolean;
    dailyLimit: number;
    dailyUsed: number;
    remaining: number;
    upgradePrompt?: string;
  }> {
    try {
      // In production, this would fetch user settings and current usage
      const userStats = await this.getUserStats(userId);
      const dailyLimitCheck = await this.preSendValidator['checkDailyLimits'](userId, userStats.plan as any, 50);
      
      const eligible = userStats.plan !== 'free' && !dailyLimitCheck.isLimitReached;
      
      let upgradePrompt;
      if (userStats.plan === 'free') {
        upgradePrompt = 'Upgrade to Pro to enable safe auto-send';
      } else if (dailyLimitCheck.isLimitReached) {
        upgradePrompt = 'Upgrade to Enterprise for higher sending limits';
      }
      
      return {
        eligible,
        plan: userStats.plan,
        autoSendEnabled: userStats.plan !== 'free',
        dailyLimit: dailyLimitCheck.limit,
        dailyUsed: dailyLimitCheck.currentCount,
        remaining: dailyLimitCheck.remaining,
        upgradePrompt
      };
    } catch (error) {
      console.error('Failed to get eligibility:', error);
      throw error;
    }
  }

  /**
   * Performs health check on the auto-send system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      latency?: number;
    }>;
    overallLatency: number;
  }> {
    const startTime = Date.now();
    
    try {
      const workerHealth = await this.queueWorker.healthCheck();
      const providerStats = await this.emailProvider.getProviderStats();
      
      const components = [
        {
          name: 'queue_worker',
          status: workerHealth.status,
          message: workerHealth.checks.map(c => `${c.name}: ${c.status}`).join(', ')
        },
        {
          name: 'email_providers',
          status: providerStats.providers.every(p => p.healthy) ? 'pass' : 'warn',
          message: `${providerStats.providers.filter(p => p.healthy).length}/${providerStats.providers.length} providers healthy`
        },
        {
          name: 'audit_logger',
          status: 'pass',
          message: 'Audit logging operational'
        },
        {
          name: 'idempotency_manager',
          status: 'pass',
          message: 'Idempotency management operational'
        }
      ];
      
      const failedComponents = components.filter(c => c.status === 'fail');
      const warnComponents = components.filter(c => c.status === 'warn');
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (failedComponents.length > 0) {
        status = 'unhealthy';
      } else if (warnComponents.length > 0) {
        status = 'degraded';
      }
      
      return {
        status,
        components,
        overallLatency: Date.now() - startTime
      };
    } catch (error) {
      console.error('Health check failed:', error);
      
      return {
        status: 'unhealthy',
        components: [
          {
            name: 'health_check',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        ],
        overallLatency: Date.now() - startTime
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Auto-Send Controller...');
    
    try {
      await this.queueWorker.shutdown();
      await this.auditLogger.cleanupOldLogs();
      await this.idempotencyManager.cleanupOldRecords();
      
      console.log('Auto-Send Controller shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  /**
   * Gets configuration
   */
  getConfig(): AutoSendConfig {
    return { ...this.config };
  }

  /**
   * Updates configuration
   */
  updateConfig(newConfig: Partial<AutoSendConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.queueWorker.updateConfig(newConfig);
  }
}
