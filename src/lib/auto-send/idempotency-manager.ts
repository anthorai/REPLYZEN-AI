import { AutoSendRequest, AutoSendAttempt, IdempotencyError } from './types';
import { supabase } from '@/integrations/supabase/client';

export class IdempotencyManager {
  private readonly IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Checks if a request has already been processed
   */
  async checkDuplicate(request: AutoSendRequest): Promise<{
    isDuplicate: boolean;
    existingAttempt?: AutoSendAttempt;
  }> {
    try {
      // Check database for existing attempt with same idempotency key
      const { data: existingAttempt, error } = await supabase
        .from('auto_send_attempts')
        .select('*')
        .eq('idempotency_key', request.idempotencyKey)
        .eq('thread_id', request.threadId)
        .eq('user_id', request.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking idempotency:', error);
        // If we can't check, assume it's not a duplicate to avoid blocking
        return { isDuplicate: false };
      }

      if (existingAttempt) {
        // Check if the existing attempt is still within the idempotency window
        const now = new Date();
        const createdAt = new Date(existingAttempt.createdAt);
        const timeDiff = now.getTime() - createdAt.getTime();

        if (timeDiff < this.IDEMPOTENCY_WINDOW_MS) {
          return {
            isDuplicate: true,
            existingAttempt
          };
        }
      }

      return { isDuplicate: false };

    } catch (error) {
      console.error('Idempotency check failed:', error);
      // Fail safe - don't block on idempotency errors
      return { isDuplicate: false };
    }
  }

  /**
   * Generates idempotency key for a request
   */
  generateIdempotencyKey(request: AutoSendRequest): string {
    // Create a unique key based on thread, user, and time bucket
    const timeBucket = this.getTimeBucket(request.scheduledAt);
    const keyComponents = [
      request.threadId,
      request.userId,
      request.followUpId,
      timeBucket
    ];
    
    return this.hashComponents(keyComponents);
  }

  /**
   * Creates time bucket for idempotency (hourly buckets)
   */
  private getTimeBucket(date: Date): string {
    const d = new Date(date);
    d.setMinutes(0, 0, 0); // Round to nearest hour
    return d.toISOString();
  }

  /**
   * Hashes components to create idempotency key
   */
  private hashComponents(components: string[]): string {
    const combined = components.join('|');
    
    // Simple hash function - in production, use a proper hash like SHA-256
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `idemp_${Math.abs(hash)}_${Date.now()}`;
  }

  /**
   * Records a new attempt for idempotency tracking
   */
  async recordAttempt(attempt: AutoSendAttempt): Promise<void> {
    try {
      await supabase
        .from('auto_send_attempts')
        .insert({
          id: attempt.id,
          thread_id: attempt.threadId,
          follow_up_id: attempt.followUpId,
          user_id: attempt.userId,
          decision: attempt.decision,
          cancellation_reason: attempt.cancellationReason,
          validation_snapshot: attempt.validationSnapshot,
          generated_message: attempt.generatedMessage,
          user_insight: attempt.userInsight,
          sent_at: attempt.sentAt,
          email_provider_id: attempt.emailProviderId,
          processing_time_ms: attempt.processingTimeMs,
          idempotency_key: attempt.idempotencyKey,
          retry_count: attempt.retryCount,
          next_retry_at: attempt.nextRetryAt,
          created_at: attempt.createdAt,
          updated_at: attempt.updatedAt
        });
    } catch (error) {
      console.error('Error recording attempt:', error);
      // Don't throw - recording failure shouldn't block the main process
    }
  }

  /**
   * Updates an existing attempt
   */
  async updateAttempt(attemptId: string, updates: Partial<AutoSendAttempt>): Promise<void> {
    try {
      await supabase
        .from('auto_send_attempts')
        .update({
          ...updates,
          updated_at: new Date()
        })
        .eq('id', attemptId);
    } catch (error) {
      console.error('Error updating attempt:', error);
    }
  }

  /**
   * Gets attempt history for a thread
   */
  async getThreadAttempts(threadId: string, userId: string): Promise<AutoSendAttempt[]> {
    try {
      const { data, error } = await supabase
        .from('auto_send_attempts')
        .select('*')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting thread attempts:', error);
      return [];
    }
  }

  /**
   * Cleans up old idempotency records
   */
  async cleanupOldRecords(): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - this.IDEMPOTENCY_WINDOW_MS);
      
      const { data, error } = await supabase
        .from('auto_send_attempts')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('count');

      if (error) throw error;
      
      return Array.isArray(data) ? data.length : 0;
    } catch (error) {
      console.error('Error cleaning up old records:', error);
      return 0;
    }
  }

  /**
   * Validates idempotency key format
   */
  validateIdempotencyKey(key: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!key) {
      errors.push('Idempotency key cannot be empty');
    }

    if (typeof key !== 'string') {
      errors.push('Idempotency key must be a string');
    }

    if (key.length < 10) {
      errors.push('Idempotency key too short');
    }

    if (key.length > 255) {
      errors.push('Idempotency key too long');
    }

    // Check for valid format (starts with idemp_)
    if (!key.startsWith('idemp_')) {
      errors.push('Invalid idempotency key format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets idempotency statistics
   */
  async getIdempotencyStats(userId?: string): Promise<{
    totalRecords: number;
    duplicatePrevented: number;
    averageAge: number;
    cleanupCandidates: number;
  }> {
    try {
      let query = supabase
        .from('auto_send_attempts')
        .select('*');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      const records = data || [];
      const now = new Date();
      const cutoffDate = new Date(Date.now() - this.IDEMPOTENCY_WINDOW_MS);
      
      const totalRecords = records.length;
      const cleanupCandidates = records.filter(r => 
        new Date(r.createdAt) < cutoffDate
      ).length;
      
      const averageAge = records.length > 0 
        ? records.reduce((sum, r) => {
            const age = now.getTime() - new Date(r.createdAt).getTime();
            return sum + age;
          }, 0) / records.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      // Estimate duplicates prevented (would need additional tracking)
      const duplicatePrevented = Math.floor(totalRecords * 0.1); // Rough estimate

      return {
        totalRecords,
        duplicatePrevented,
        averageAge,
        cleanupCandidates
      };
    } catch (error) {
      console.error('Error getting idempotency stats:', error);
      return {
        totalRecords: 0,
        duplicatePrevented: 0,
        averageAge: 0,
        cleanupCandidates: 0
      };
    }
  }

  /**
   * Checks for potential idempotency conflicts
   */
  async checkConflicts(request: AutoSendRequest): Promise<{
    hasConflicts: boolean;
    conflicts: Array<{
      type: 'duplicate_thread' | 'duplicate_user' | 'rate_limit';
      details: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    const conflicts: Array<{
      type: 'duplicate_thread' | 'duplicate_user' | 'rate_limit';
      details: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    try {
      // Check for recent attempts on same thread
      const recentThreadAttempts = await this.getThreadAttempts(request.threadId, request.userId);
      const veryRecentAttempts = recentThreadAttempts.filter(attempt => {
        const timeDiff = Date.now() - new Date(attempt.createdAt).getTime();
        return timeDiff < 60 * 60 * 1000; // Last hour
      });

      if (veryRecentAttempts.length > 0) {
        conflicts.push({
          type: 'duplicate_thread',
          details: `Recent attempt on thread ${request.threadId} in the last hour`,
          severity: 'high'
        });
      }

      // Check for high frequency from same user
      const userAttempts = await this.getUserRecentAttempts(request.userId, 60 * 60 * 1000); // Last hour
      if (userAttempts.length > 10) {
        conflicts.push({
          type: 'rate_limit',
          details: `High frequency: ${userAttempts.length} attempts in last hour`,
          severity: 'medium'
        });
      }

      return {
        hasConflicts: conflicts.length > 0,
        conflicts
      };
    } catch (error) {
      console.error('Error checking conflicts:', error);
      return {
        hasConflicts: false,
        conflicts: []
      };
    }
  }

  /**
   * Gets recent attempts for a user
   */
  private async getUserRecentAttempts(userId: string, timeWindowMs: number): Promise<AutoSendAttempt[]> {
    try {
      const cutoffDate = new Date(Date.now() - timeWindowMs);
      
      const { data, error } = await supabase
        .from('auto_send_attempts')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user recent attempts:', error);
      return [];
    }
  }

  /**
   * Creates idempotency-aware request wrapper
   */
  async withIdempotency<T>(
    request: AutoSendRequest,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check for duplicates
    const { isDuplicate, existingAttempt } = await this.checkDuplicate(request);
    
    if (isDuplicate && existingAttempt) {
      throw new IdempotencyError(
        'Request already processed',
        request.idempotencyKey,
        request.threadId,
        request.userId
      );
    }

    // Execute the operation
    try {
      const result = await operation();
      return result;
    } catch (error) {
      // Don't record attempts that failed due to validation
      // The calling code should handle recording successful attempts
      throw error;
    }
  }

  /**
   * Batch idempotency check for multiple requests
   */
  async checkBatchDuplicates(requests: AutoSendRequest[]): Promise<{
    duplicates: Array<{ request: AutoSendRequest; existingAttempt?: AutoSendAttempt }>;
    nonDuplicates: AutoSendRequest[];
  }> {
    const duplicates: Array<{ request: AutoSendRequest; existingAttempt?: AutoSendAttempt }> = [];
    const nonDuplicates: AutoSendRequest[] = [];

    for (const request of requests) {
      const { isDuplicate, existingAttempt } = await this.checkDuplicate(request);
      
      if (isDuplicate) {
        duplicates.push({ request, existingAttempt });
      } else {
        nonDuplicates.push(request);
      }
    }

    return { duplicates, nonDuplicates };
  }
}
