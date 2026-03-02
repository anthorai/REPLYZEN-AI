import { ProcessingContext } from './types';
import { getSupabaseClient } from '@/integrations/supabase/client';

export class IdempotencyGuard {
  private readonly REQUEST_TIMEOUT_MINUTES = 10;
  private readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Ensures idempotent processing of silence detection requests
   */
  async ensureIdempotentProcessing(
    context: ProcessingContext,
    processingFunction: () => Promise<any>
  ): Promise<{ result: any; wasProcessed: boolean; attemptNumber: number }> {
    // Check if this request was already processed
    const existingResult = await this.checkExistingProcessing(context);
    if (existingResult) {
      return {
        result: existingResult,
        wasProcessed: true,
        attemptNumber: 0
      };
    }

    // Acquire idempotency lock
    const lockAcquired = await this.acquireIdempotencyLock(context);
    if (!lockAcquired) {
      // Another request is processing this, wait and check result
      return this.handleConcurrentProcessing(context, processingFunction);
    }

    try {
      // Process the request
      const result = await processingFunction();
      
      // Cache the result
      await this.cacheProcessingResult(context, result);
      
      // Release the lock
      await this.releaseIdempotencyLock(context);
      
      return {
        result,
        wasProcessed: false,
        attemptNumber: 1
      };

    } catch (error) {
      // Release lock on error
      await this.releaseIdempotencyLock(context);
      throw error;
    }
  }

  /**
   * Checks if a request was already processed
   */
  private async checkExistingProcessing(context: ProcessingContext): Promise<any> {
    try {
      // Check silence detection log first
      const { data: logEntry } = await supabase
        .from('silence_detection_log')
        .select('*')
        .eq('request_id', context.requestId)
        .eq('thread_id', context.threadId)
        .eq('user_id', context.userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logEntry) {
        return this.reconstructResultFromLog(logEntry, context);
      }

      // Check eligibility cache
      const { data: cacheEntry } = await supabase
        .from('followup_eligibility_cache')
        .select('*')
        .eq('thread_id', context.threadId)
        .eq('user_id', context.userId)
        .gte('eligibility_timestamp', context.timestamp.toISOString())
        .limit(1)
        .maybeSingle();

      if (cacheEntry) {
        return this.reconstructResultFromCache(cacheEntry);
      }

      return null;
    } catch (error) {
      console.error('Error checking existing processing:', error);
      return null;
    }
  }

  /**
   * Acquires an idempotency lock for the request
   */
  private async acquireIdempotencyLock(context: ProcessingContext): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + this.REQUEST_TIMEOUT_MINUTES * 60 * 1000);
      
      const { data, error } = await supabase
        .from('idempotency_locks')
        .insert({
          request_id: context.requestId,
          thread_id: context.threadId,
          user_id: context.userId,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (error) {
        // Check if it's a duplicate key error (lock already exists)
        if (error.code === '23505') {
          return false;
        }
        console.error('Error acquiring idempotency lock:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Database error acquiring idempotency lock:', error);
      return false;
    }
  }

  /**
   * Handles concurrent processing scenarios
   */
  private async handleConcurrentProcessing(
    context: ProcessingContext,
    processingFunction: () => Promise<any>
  ): Promise<{ result: any; wasProcessed: boolean; attemptNumber: number }> {
    const maxWaitTime = this.REQUEST_TIMEOUT_MINUTES * 60 * 1000;
    const startTime = Date.now();
    let attemptNumber = 0;

    while (Date.now() - startTime < maxWaitTime) {
      attemptNumber++;

      // Check if processing completed
      const existingResult = await this.checkExistingProcessing(context);
      if (existingResult) {
        return {
          result: existingResult,
          wasProcessed: true,
          attemptNumber
        };
      }

      // Check if lock expired (processing failed)
      const lockExpired = await this.checkLockExpired(context);
      if (lockExpired) {
        // Try to acquire lock and process
        const lockAcquired = await this.acquireIdempotencyLock(context);
        if (lockAcquired) {
          try {
            const result = await processingFunction();
            await this.cacheProcessingResult(context, result);
            await this.releaseIdempotencyLock(context);
            
            return {
              result,
              wasProcessed: false,
              attemptNumber
            };
          } catch (error) {
            await this.releaseIdempotencyLock(context);
            throw error;
          }
        }
      }

      // Wait before retrying
      await this.delay(Math.min(1000 * Math.pow(2, attemptNumber), 10000)); // Exponential backoff
    }

    throw new Error(`Concurrent processing timeout for request ${context.requestId}`);
  }

  /**
   * Releases an idempotency lock
   */
  private async releaseIdempotencyLock(context: ProcessingContext): Promise<void> {
    try {
      await supabase
        .from('idempotency_locks')
        .delete()
        .eq('request_id', context.requestId)
        .eq('thread_id', context.threadId)
        .eq('user_id', context.userId);
    } catch (error) {
      console.error('Error releasing idempotency lock:', error);
      // Don't throw - cleanup failure shouldn't stop the main process
    }
  }

  /**
   * Checks if a lock has expired
   */
  private async checkLockExpired(context: ProcessingContext): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('idempotency_locks')
        .select('expires_at')
        .eq('request_id', context.requestId)
        .eq('thread_id', context.threadId)
        .eq('user_id', context.userId)
        .maybeSingle();

      if (!data) {
        return true; // No lock exists
      }

      return new Date(data.expires_at) < new Date();
    } catch (error) {
      console.error('Error checking lock expiration:', error);
      return true; // Assume expired on error
    }
  }

  /**
   * Caches processing result for idempotency
   */
  private async cacheProcessingResult(context: ProcessingContext, result: any): Promise<void> {
    try {
      // Cache in silence detection log
      await supabase
        .from('silence_detection_log')
        .insert({
          thread_id: context.threadId,
          user_id: context.userId,
          request_id: context.requestId,
          status: 'completed',
          confidence_score: result.confidenceScore,
          silence_duration_hours: result.silenceDurationDays * 24,
          processing_time_ms: result.metadata?.processingTimeMs || 0,
          eligibility_metadata: result.metadata || {},
          created_at: new Date().toISOString()
        });

      // Cache in eligibility cache if eligible
      if (result.isEligible) {
        await supabase
          .from('followup_eligibility_cache')
          .upsert({
            thread_id: context.threadId,
            user_id: context.userId,
            is_eligible: result.isEligible,
            confidence_score: result.confidenceScore,
            auto_send_ready: result.autoSendReady,
            last_message_at: new Date().toISOString(),
            eligibility_timestamp: context.timestamp.toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            rejection_reason: result.rejectionReason,
            insights: result.insights
          }, { onConflict: 'thread_id,user_id' });
      }
    } catch (error) {
      console.error('Error caching processing result:', error);
      // Don't throw - caching failure shouldn't stop the main process
    }
  }

  /**
   * Reconstructs result from log entry
   */
  private reconstructResultFromLog(logEntry: any, context: ProcessingContext): any {
    return {
      threadId: logEntry.thread_id,
      isEligible: logEntry.status === 'completed',
      confidenceScore: logEntry.confidence_score || 0,
      silenceDurationDays: (logEntry.silence_duration_hours || 0) / 24,
      metadata: {
        eligibilityTimestamp: context.timestamp,
        processingTimeMs: logEntry.processing_time_ms || 0,
        fromCache: true,
        source: 'log'
      }
    };
  }

  /**
   * Reconstructs result from cache entry
   */
  private reconstructResultFromCache(cacheEntry: any): any {
    return {
      threadId: cacheEntry.thread_id,
      isEligible: cacheEntry.is_eligible,
      confidenceScore: cacheEntry.confidence_score,
      autoSendReady: cacheEntry.auto_send_ready,
      insights: cacheEntry.insights,
      rejectionReason: cacheEntry.rejection_reason,
      metadata: {
        eligibilityTimestamp: cacheEntry.eligibility_timestamp,
        fromCache: true,
        source: 'cache'
      }
    };
  }

  /**
   * Cleans up expired idempotency locks
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('idempotency_locks')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('count');

      if (error) {
        console.error('Error cleaning up expired idempotency locks:', error);
        return 0;
      }

      return Array.isArray(data) ? data.length : 0;
    } catch (error) {
      console.error('Database error cleaning up expired locks:', error);
      return 0;
    }
  }

  /**
   * Gets idempotency statistics
   */
  async getIdempotencyStats(userId: string): Promise<{
    activeLocks: number;
    expiredLocks: number;
    totalProcessed: number;
    cacheHitRate: number;
  }> {
    try {
      const [activeResult, expiredResult, processedResult] = await Promise.all([
        supabase
          .from('idempotency_locks')
          .select('count')
          .eq('user_id', userId)
          .gt('expires_at', new Date().toISOString()),
        
        supabase
          .from('idempotency_locks')
          .select('count')
          .eq('user_id', userId)
          .lt('expires_at', new Date().toISOString()),
        
        supabase
          .from('silence_detection_log')
          .select('count')
          .eq('user_id', userId)
          .eq('status', 'completed')
      ]);

      const activeLocks = activeResult.data?.length || 0;
      const expiredLocks = expiredResult.data?.length || 0;
      const totalProcessed = processedResult.data?.length || 0;

      // Calculate cache hit rate (simplified)
      const cacheHitRate = totalProcessed > 0 ? 0.85 : 0; // Placeholder

      return {
        activeLocks,
        expiredLocks,
        totalProcessed,
        cacheHitRate
      };
    } catch (error) {
      console.error('Error getting idempotency stats:', error);
      return {
        activeLocks: 0,
        expiredLocks: 0,
        totalProcessed: 0,
        cacheHitRate: 0
      };
    }
  }

  /**
   * Validates request context for idempotency
   */
  validateContext(context: ProcessingContext): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!context.requestId) {
      errors.push('Request ID is required');
    }

    if (!context.threadId) {
      errors.push('Thread ID is required');
    }

    if (!context.userId) {
      errors.push('User ID is required');
    }

    if (!context.timestamp) {
      errors.push('Timestamp is required');
    }

    // Validate request ID format
    if (context.requestId && !/^[a-zA-Z0-9_-]+$/.test(context.requestId)) {
      errors.push('Request ID contains invalid characters');
    }

    // Validate timestamp is not too old or future
    if (context.timestamp) {
      const now = new Date();
      const diffHours = Math.abs(now.getTime() - context.timestamp.getTime()) / (1000 * 60 * 60);
      
      if (diffHours > 24) {
        errors.push('Request timestamp is too old');
      }
      
      if (context.timestamp > now) {
        errors.push('Request timestamp is in the future');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generates unique request ID with collision resistance
   */
  generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    const extraEntropy = Math.random().toString(36).substring(2, 7);
    
    return `sd_${timestamp}_${random}_${extraEntropy}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handles retry logic with exponential backoff
   */
  async withRetry<T>(
    context: ProcessingContext,
    operation: () => Promise<T>,
    maxRetries: number = this.MAX_RETRY_ATTEMPTS
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }

        // Exponential backoff with jitter
        const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Determines if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      'permission_denied',
      'authentication_failed',
      'invalid_thread_id',
      'validation_error',
      'bad_request'
    ];

    return !nonRetryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }
}
