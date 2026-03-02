import { AuditLog, AutoSendDecision, CancellationReason } from './types';

export class AuditLogger {
  private readonly LOG_RETENTION_DAYS = 90;

  /**
   * Logs an auto-send event
   */
  async logEvent(event: {
    threadId: string;
    followUpId: string;
    userId: string;
    eventType: 'pre_send_validation' | 'send_attempt' | 'send_success' | 'send_failed' | 'cancellation';
    decision: AutoSendDecision;
    cancellationReason?: CancellationReason;
    validationSnapshot?: any;
    processingTimeMs: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: this.generateLogId(),
        threadId: event.threadId,
        followUpId: event.followUpId,
        userId: event.userId,
        eventType: event.eventType,
        decision: event.decision,
        cancellationReason: event.cancellationReason,
        validationSnapshot: event.validationSnapshot,
        processingTimeMs: event.processingTimeMs,
        errorMessage: event.errorMessage,
        metadata: event.metadata || {},
        timestamp: new Date()
      };

      // In production, this would store to database
      console.log('AUDIT LOG:', JSON.stringify(auditLog, null, 2));

      // Store to database (mock implementation)
      await this.storeAuditLog(auditLog);

    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - logging failure shouldn't block the main process
    }
  }

  /**
   * Logs a batch of events
   */
  async logBatchEvents(events: Array<{
    threadId: string;
    followUpId: string;
    userId: string;
    eventType: 'pre_send_validation' | 'send_attempt' | 'send_success' | 'send_failed' | 'cancellation';
    decision: AutoSendDecision;
    cancellationReason?: CancellationReason;
    validationSnapshot?: any;
    processingTimeMs: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }>): Promise<void> {
    const promises = events.map(event => this.logEvent(event));
    await Promise.allSettled(promises);
  }

  /**
   * Retrieves audit logs for a specific thread
   */
  async getThreadAuditLogs(threadId: string, userId: string): Promise<AuditLog[]> {
    try {
      // In production, this would query the database
      console.log(`Retrieving audit logs for thread ${threadId}, user ${userId}`);
      
      // Mock implementation
      return [];
    } catch (error) {
      console.error('Failed to retrieve thread audit logs:', error);
      return [];
    }
  }

  /**
   * Retrieves audit logs for a user
   */
  async getUserAuditLogs(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      eventType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AuditLog[]> {
    try {
      // In production, this would query the database with filters
      console.log(`Retrieving audit logs for user ${userId}`, options);
      
      // Mock implementation
      return [];
    } catch (error) {
      console.error('Failed to retrieve user audit logs:', error);
      return [];
    }
  }

  /**
   * Generates audit report
   */
  async generateAuditReport(options: {
    userId?: string;
    startDate: Date;
    endDate: Date;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<{
    summary: {
      totalEvents: number;
      successRate: number;
      cancellationRate: number;
      averageProcessingTime: number;
      topCancellationReasons: Array<{ reason: CancellationReason; count: number }>;
    };
    timeline: Array<{
      date: string;
      events: number;
      successes: number;
      cancellations: number;
      avgProcessingTime: number;
    }>;
    details: AuditLog[];
  }> {
    try {
      // In production, this would aggregate data from the database
      console.log('Generating audit report', options);
      
      // Mock implementation
      return {
        summary: {
          totalEvents: 100,
          successRate: 0.85,
          cancellationRate: 0.15,
          averageProcessingTime: 120,
          topCancellationReasons: [
            { reason: 'user_already_replied', count: 8 },
            { reason: 'spam_risk_high', count: 5 },
            { reason: 'daily_limit_reached', count: 3 }
          ]
        },
        timeline: [
          {
            date: '2026-03-01',
            events: 25,
            successes: 22,
            cancellations: 3,
            avgProcessingTime: 115
          },
          {
            date: '2026-03-02',
            events: 30,
            successes: 26,
            cancellations: 4,
            avgProcessingTime: 125
          }
        ],
        details: []
      };
    } catch (error) {
      console.error('Failed to generate audit report:', error);
      throw error;
    }
  }

  /**
   * Exports audit logs
   */
  async exportAuditLogs(options: {
    userId?: string;
    startDate: Date;
    endDate: Date;
    format: 'json' | 'csv';
  }): Promise<{
    data: string;
    filename: string;
    mimeType: string;
  }> {
    try {
      const logs = await this.getUserAuditLogs(options.userId || 'all', {
        startDate: options.startDate,
        endDate: options.endDate
      });

      let data: string;
      let filename: string;
      let mimeType: string;

      if (options.format === 'csv') {
        data = this.convertToCSV(logs);
        filename = `audit_logs_${options.startDate.toISOString().split('T')[0]}_to_${options.endDate.toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        data = JSON.stringify(logs, null, 2);
        filename = `audit_logs_${options.startDate.toISOString().split('T')[0]}_to_${options.endDate.toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      return { data, filename, mimeType };
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw error;
    }
  }

  /**
   * Cleans up old audit logs
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - (this.LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000));
      
      // In production, this would delete old records from database
      console.log(`Cleaning up audit logs older than ${cutoffDate.toISOString()}`);
      
      // Mock implementation
      const deletedCount = 0;
      console.log(`Deleted ${deletedCount} old audit log entries`);
      
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
      return 0;
    }
  }

  /**
   * Gets audit statistics
   */
  async getAuditStats(userId?: string): Promise<{
    totalLogs: number;
    logsByType: Record<string, number>;
    logsByDecision: Record<AutoSendDecision, number>;
    logsByCancellationReason: Record<CancellationReason, number>;
    averageProcessingTime: number;
    errorRate: number;
    recentActivity: {
      last24Hours: number;
      last7Days: number;
      last30Days: number;
    };
  }> {
    try {
      // In production, this would aggregate from database
      console.log(`Getting audit statistics for ${userId || 'all users'}`);
      
      // Mock implementation
      return {
        totalLogs: 500,
        logsByType: {
          pre_send_validation: 500,
          send_attempt: 425,
          send_success: 361,
          send_failed: 32,
          cancellation: 64
        },
        logsByDecision: {
          SAFE_TO_SEND: 361,
          CANCELLED: 64,
          RETRY_LATER: 32,
          MANUAL_REVIEW_REQUIRED: 43
        },
        logsByCancellationReason: {
          user_already_replied: 25,
          spam_risk_high: 15,
          daily_limit_reached: 10,
          silence_window_invalid: 8,
          sensitive_conversation: 6
        },
        averageProcessingTime: 120,
        errorRate: 0.064,
        recentActivity: {
          last24Hours: 45,
          last7Days: 280,
          last30Days: 450
        }
      };
    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      throw error;
    }
  }

  /**
   * Searches audit logs
   */
  async searchAuditLogs(query: {
    userId?: string;
    threadId?: string;
    eventType?: string;
    decision?: AutoSendDecision;
    cancellationReason?: CancellationReason;
    dateRange?: { start: Date; end: Date };
    textSearch?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: AuditLog[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      // In production, this would implement full-text search
      console.log('Searching audit logs with query:', query);
      
      // Mock implementation
      return {
        logs: [],
        totalCount: 0,
        hasMore: false
      };
    } catch (error) {
      console.error('Failed to search audit logs:', error);
      throw error;
    }
  }

  /**
   * Stores audit log to database
   */
  private async storeAuditLog(log: AuditLog): Promise<void> {
    // In production, this would use the actual database
    // For now, just log to console
    console.log('STORING AUDIT LOG:', log.id);
  }

  /**
   * Converts audit logs to CSV format
   */
  private convertToCSV(logs: AuditLog[]): string {
    const headers = [
      'id',
      'threadId',
      'followUpId',
      'userId',
      'eventType',
      'decision',
      'cancellationReason',
      'processingTimeMs',
      'errorMessage',
      'timestamp'
    ];

    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.id,
        log.threadId,
        log.followUpId,
        log.userId,
        log.eventType,
        log.decision,
        log.cancellationReason || '',
        log.processingTimeMs.toString(),
        log.errorMessage || '',
        log.timestamp.toISOString()
      ];
      
      // Escape CSV values
      const escapedRow = row.map(value => 
        value.includes(',') || value.includes('"') || value.includes('\n')
          ? `"${value.replace(/"/g, '""')}"`
          : value
      );
      
      csvRows.push(escapedRow.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Generates unique log ID
   */
  private generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validates audit log data
   */
  validateAuditLog(log: Partial<AuditLog>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!log.threadId) {
      errors.push('Thread ID is required');
    }

    if (!log.followUpId) {
      errors.push('Follow-up ID is required');
    }

    if (!log.userId) {
      errors.push('User ID is required');
    }

    if (!log.eventType) {
      errors.push('Event type is required');
    }

    if (!log.decision) {
      errors.push('Decision is required');
    }

    if (log.processingTimeMs !== undefined && (log.processingTimeMs < 0 || log.processingTimeMs > 300000)) {
      errors.push('Processing time must be between 0 and 300000ms');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets compliance report for audit trail
   */
  async getComplianceReport(options: {
    startDate: Date;
    endDate: Date;
    userId?: string;
  }): Promise<{
      totalAttempts: number;
      successfulSends: number;
      cancelledAttempts: number;
      complianceScore: number; // 0-100
      violations: Array<{
        type: 'spam_risk' | 'rate_limit' | 'sentiment_risk' | 'technical_error';
        count: number;
        severity: 'low' | 'medium' | 'high';
        examples: string[];
      }>;
      recommendations: string[];
    }> {
    try {
      // In production, this would analyze audit logs for compliance
      console.log('Generating compliance report', options);
      
      // Mock implementation
      return {
        totalAttempts: 100,
        successfulSends: 85,
        cancelledAttempts: 15,
        complianceScore: 92,
        violations: [
          {
            type: 'spam_risk',
            count: 5,
            severity: 'medium',
            examples: ['High frequency detected', 'Generic content flagged']
          },
          {
            type: 'rate_limit',
            count: 3,
            severity: 'low',
            examples: ['Daily limit reached']
          }
        ],
        recommendations: [
          'Review high-frequency sending patterns',
          'Improve content personalization',
          'Monitor rate limit compliance'
        ]
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Archives old audit logs to cold storage
   */
  async archiveOldLogs(): Promise<{
    archivedCount: number;
    archiveLocation: string;
    archiveDate: Date;
  }> {
    try {
      const cutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)); // 30 days
      
      // In production, this would move old logs to cold storage
      console.log(`Archiving audit logs older than ${cutoffDate.toISOString()}`);
      
      const archiveLocation = `s3://audit-logs-archive/${cutoffDate.toISOString().split('T')[0]}`;
      
      return {
        archivedCount: 0,
        archiveLocation,
        archiveDate: new Date()
      };
    } catch (error) {
      console.error('Failed to archive old audit logs:', error);
      throw error;
    }
  }
}
