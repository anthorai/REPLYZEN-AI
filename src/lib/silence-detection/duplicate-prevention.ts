import { DuplicateCheck, ProcessingContext } from './types';
import { getSupabaseClient } from '@/integrations/supabase/client';

export class DuplicatePreventionEngine {
  private readonly DUPLICATE_CHECK_WINDOW_HOURS = 24; // Check last 24 hours
  private readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Comprehensive duplicate check for follow-ups
   */
  async checkDuplicates(threadId: string, userId: string): Promise<DuplicateCheck> {
    const checks = await Promise.all([
      this.checkExistingFollowUp(threadId, userId),
      this.checkScheduledFollowUp(threadId, userId),
      this.checkDraftedFollowUp(threadId, userId),
      this.checkRecentProcessingAttempts(threadId, userId)
    ]);

    return {
      hasExistingFollowUp: checks[0].exists,
      hasScheduledFollowUp: checks[1].exists,
      hasDraftedFollowUp: checks[2].exists,
      lastFollowUpAt: checks[0].timestamp,
      scheduledFor: checks[1].timestamp
    };
  }

  /**
   * Checks if a follow-up was already sent for this thread
   */
  private async checkExistingFollowUp(threadId: string, userId: string): Promise<{
    exists: boolean;
    timestamp?: Date;
  }> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('followup_suggestions')
        .select('sent_at, status')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking existing follow-up:', error);
        return { exists: false };
      }

      if (data?.sent_at) {
        return {
          exists: true,
          timestamp: new Date(data.sent_at)
        };
      }

      return { exists: false };
    } catch (error) {
      console.error('Database error checking existing follow-up:', error);
      return { exists: false };
    }
  }

  /**
   * Checks if a follow-up is scheduled for this thread
   */
  private async checkScheduledFollowUp(threadId: string, userId: string): Promise<{
    exists: boolean;
    timestamp?: Date;
  }> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('followup_suggestions')
        .select('created_at, status')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .in('status', ['scheduled', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking scheduled follow-up:', error);
        return { exists: false };
      }

      if (data) {
        return {
          exists: true,
          timestamp: new Date(data.created_at)
        };
      }

      return { exists: false };
    } catch (error) {
      console.error('Database error checking scheduled follow-up:', error);
      return { exists: false };
    }
  }

  /**
   * Checks if a follow-up draft exists for this thread
   */
  private async checkDraftedFollowUp(threadId: string, userId: string): Promise<{
    exists: boolean;
    timestamp?: Date;
  }> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('followup_suggestions')
        .select('created_at, status')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking drafted follow-up:', error);
        return { exists: false };
      }

      if (data) {
        return {
          exists: true,
          timestamp: new Date(data.created_at)
        };
      }

      return { exists: false };
    } catch (error) {
      console.error('Database error checking drafted follow-up:', error);
      return { exists: false };
    }
  }

  /**
   * Checks for recent processing attempts to prevent race conditions
   */
  private async checkRecentProcessingAttempts(threadId: string, userId: string): Promise<{
    exists: boolean;
    timestamp?: Date;
  }> {
    try {
      const cutoffTime = new Date(Date.now() - this.DUPLICATE_CHECK_WINDOW_HOURS * 60 * 60 * 1000);
      
      const { data, error } = await getSupabaseClient()
        .from('silence_detection_log')
        .select('created_at, status')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .gte('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking recent processing attempts:', error);
        return { exists: false };
      }

      if (data) {
        return {
          exists: true,
          timestamp: new Date(data.created_at)
        };
      }

      return { exists: false };
    } catch (error) {
      console.error('Database error checking recent processing attempts:', error);
      return { exists: false };
    }
  }

  /**
   * Logs a processing attempt to prevent duplicates
   */
  async logProcessingAttempt(
    threadId: string,
    userId: string,
    requestId: string,
    status: 'started' | 'completed' | 'failed' | 'duplicate_prevented'
  ): Promise<void> {
    try {
      await getSupabaseClient()
        .from('silence_detection_log')
        .insert({
          thread_id: threadId,
          user_id: userId,
          request_id: requestId,
          status,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging processing attempt:', error);
      // Don't throw - logging failure shouldn't stop the main process
    }
  }

  /**
   * Creates a processing lock to prevent concurrent processing
   */
  async acquireProcessingLock(
    threadId: string,
    userId: string,
    requestId: string,
    ttlMinutes: number = 5
  ): Promise<boolean> {
    try {
      const lockExpiry = new Date(Date.now() + ttlMinutes * 60 * 1000);
      
      const { data, error } = await getSupabaseClient()
        .from('processing_locks')
        .insert({
          thread_id: threadId,
          user_id: userId,
          request_id: requestId,
          expires_at: lockExpiry.toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (error) {
        // Check if it's a duplicate key error (lock already exists)
        if (error.code === '23505') {
          return false;
        }
        console.error('Error acquiring processing lock:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Database error acquiring processing lock:', error);
      return false;
    }
  }

  /**
   * Releases a processing lock
   */
  async releaseProcessingLock(
    threadId: string,
    userId: string,
    requestId: string
  ): Promise<void> {
    try {
      await getSupabaseClient()
        .from('processing_locks')
        .delete()
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .eq('request_id', requestId);
    } catch (error) {
      console.error('Error releasing processing lock:', error);
      // Don't throw - cleanup failure shouldn't stop the main process
    }
  }

  /**
   * Cleans up expired processing locks
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('processing_locks')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('count');

      if (error) {
        console.error('Error cleaning up expired locks:', error);
        return 0;
      }

      return Array.isArray(data) ? data.length : 0;
    } catch (error) {
      console.error('Database error cleaning up expired locks:', error);
      return 0;
    }
  }

  /**
   * Checks if a thread is eligible for processing considering all duplicate prevention rules
   */
  async isEligibleForProcessing(
    threadId: string,
    userId: string,
    requestId: string
  ): Promise<{
    isEligible: boolean;
    reason?: string;
    duplicateCheck: DuplicateCheck;
  }> {
    // Check for existing follow-ups
    const duplicateCheck = await this.checkDuplicates(threadId, userId);

    if (duplicateCheck.hasExistingFollowUp) {
      return {
        isEligible: false,
        reason: 'Follow-up already sent',
        duplicateCheck
      };
    }

    if (duplicateCheck.hasScheduledFollowUp) {
      return {
        isEligible: false,
        reason: 'Follow-up already scheduled',
        duplicateCheck
      };
    }

    if (duplicateCheck.hasDraftedFollowUp) {
      return {
        isEligible: false,
        reason: 'Follow-up already drafted',
        duplicateCheck
      };
    }

    // Try to acquire processing lock
    const lockAcquired = await this.acquireProcessingLock(threadId, userId, requestId);
    
    if (!lockAcquired) {
      return {
        isEligible: false,
        reason: 'Thread is being processed by another request',
        duplicateCheck
      };
    }

    return {
      isEligible: true,
      duplicateCheck
    };
  }

  /**
   * Calculates retry delay based on attempt number
   */
  calculateRetryDelay(attemptNumber: number): number {
    if (attemptNumber <= 0) return 0;
    
    // Exponential backoff: 5min, 15min, 45min
    const baseDelay = 5 * 60 * 1000; // 5 minutes in ms
    const multiplier = Math.pow(3, Math.min(attemptNumber - 1, 2));
    
    return baseDelay * multiplier;
  }

  /**
   * Determines if a retry should be attempted
   */
  shouldRetry(attemptNumber: number, lastError?: Error): boolean {
    if (attemptNumber >= this.MAX_RETRY_ATTEMPTS) {
      return false;
    }

    // Don't retry on certain errors
    const nonRetryableErrors = [
      'permission_denied',
      'authentication_failed',
      'invalid_thread_id'
    ];

    if (lastError && nonRetryableErrors.some(err => lastError.message.includes(err))) {
      return false;
    }

    return true;
  }

  /**
   * Gets statistics about duplicate prevention
   */
  async getDuplicatePreventionStats(userId: string): Promise<{
    totalThreads: number;
    withExistingFollowUps: number;
    withScheduledFollowUps: number;
    withDraftedFollowUps: number;
    recentProcessingAttempts: number;
    activeLocks: number;
  }> {
    try {
      const [
        totalResult,
        existingResult,
        scheduledResult,
        draftedResult,
        recentResult,
        locksResult
      ] = await Promise.all([
        supabase.from('email_threads').select('id').eq('user_id', userId),
        supabase.from('followup_suggestions').select('id').eq('user_id', userId).eq('status', 'sent'),
        supabase.from('followup_suggestions').select('id').eq('user_id', userId).in('status', ['scheduled', 'pending']),
        supabase.from('followup_suggestions').select('id').eq('user_id', userId).eq('status', 'draft'),
        supabase.from('silence_detection_log').select('id').eq('user_id', userId).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('processing_locks').select('id').eq('user_id', userId)
      ]);

      return {
        totalThreads: totalResult.data?.length || 0,
        withExistingFollowUps: existingResult.data?.length || 0,
        withScheduledFollowUps: scheduledResult.data?.length || 0,
        withDraftedFollowUps: draftedResult.data?.length || 0,
        recentProcessingAttempts: recentResult.data?.length || 0,
        activeLocks: locksResult.data?.length || 0
      };
    } catch (error) {
      console.error('Error getting duplicate prevention stats:', error);
      return {
        totalThreads: 0,
        withExistingFollowUps: 0,
        withScheduledFollowUps: 0,
        withDraftedFollowUps: 0,
        recentProcessingAttempts: 0,
        activeLocks: 0
      };
    }
  }
}
