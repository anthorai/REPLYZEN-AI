import { 
  ProcessingContext, 
  SilenceDetectionResult, 
  ThreadAnalysis,
  FollowUpRule,
  SilenceDetectionConfig 
} from './types';
import { PrecisionFilterEngine } from './precision-filters';
import { SilenceCalculator } from './silence-calculator';
import { DuplicatePreventionEngine } from './duplicate-prevention';
import { ConfidenceScoringEngine } from './confidence-scoring';
import { InsightFormatter } from './insight-formatter';
import { supabase } from '@/integrations/supabase/client';

export class BackgroundSilenceDetectionWorker {
  private precisionFilter: PrecisionFilterEngine;
  private silenceCalculator: SilenceCalculator;
  private duplicatePrevention: DuplicatePreventionEngine;
  private confidenceScoring: ConfidenceScoringEngine;
  private insightFormatter: InsightFormatter;
  private config: SilenceDetectionConfig;

  constructor(config?: Partial<SilenceDetectionConfig>) {
    this.precisionFilter = new PrecisionFilterEngine();
    this.silenceCalculator = new SilenceCalculator();
    this.duplicatePrevention = new DuplicatePreventionEngine();
    this.confidenceScoring = new ConfidenceScoringEngine();
    this.insightFormatter = new InsightFormatter();
    
    this.config = {
      automationThreshold: 0.7,
      minSilenceHours: 1,
      maxProcessingTimeMs: 100,
      enableRaceConditionProtection: true,
      enableDuplicatePrevention: true,
      logFalsePositives: true,
      ...config
    };
  }

  /**
   * Main worker entry point - processes all threads for a user
   */
  async processUserThreads(userId: string): Promise<{
    processed: number;
    eligible: number;
    errors: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const results = {
      processed: 0,
      eligible: 0,
      errors: 0,
      duration: 0
    };

    try {
      // Get user's follow-up rules
      const followUpRule = await this.getUserFollowUpRule(userId);
      if (!followUpRule) {
        throw new Error('User follow-up rule not found');
      }

      // Get all threads for user
      const threads = await this.getUserThreads(userId);
      
      // Process threads in batches to avoid overwhelming the system
      const batchSize = 50;
      for (let i = 0; i < threads.length; i += batchSize) {
        const batch = threads.slice(i, i + batchSize);
        
        const batchResults = await Promise.allSettled(
          batch.map(thread => this.processThread(thread.thread_id, userId, followUpRule))
        );

        batchResults.forEach(result => {
          results.processed++;
          if (result.status === 'fulfilled') {
            if (result.value.isEligible) {
              results.eligible++;
            }
          } else {
            results.errors++;
            console.error('Thread processing error:', result.reason);
          }
        });

        // Small delay between batches to prevent rate limiting
        if (i + batchSize < threads.length) {
          await this.delay(100);
        }
      }

      // Cleanup expired locks and cache
      await this.cleanupExpiredData();

    } catch (error) {
      console.error('User thread processing failed:', error);
      results.errors++;
    }

    results.duration = Date.now() - startTime;
    return results;
  }

  /**
   * Processes a single thread for silence detection
   */
  async processThread(
    threadId: string, 
    userId: string, 
    followUpRule: FollowUpRule
  ): Promise<SilenceDetectionResult> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    const context: ProcessingContext = {
      userId,
      userEmail: await this.getUserEmail(userId),
      threadId,
      requestId,
      timestamp: new Date(),
      followUpRule
    };

    try {
      // Log processing start
      if (this.config.enableDuplicatePrevention) {
        await this.duplicatePrevention.logProcessingAttempt(
          threadId, 
          userId, 
          requestId, 
          'started'
        );
      }

      // STEP 1: Check eligibility and acquire locks
      if (this.config.enableDuplicatePrevention) {
        const eligibilityCheck = await this.duplicatePrevention.isEligibleForProcessing(
          threadId, 
          userId, 
          requestId
        );

        if (!eligibilityCheck.isEligible) {
          await this.logProcessingResult(context, 'duplicate_prevented', 0, {
            reason: eligibilityCheck.reason
          });
          
          return this.createIneligibleResult(threadId, eligibilityCheck.reason || 'Duplicate prevented', context);
        }
      }

      // STEP 2: Fetch and analyze thread data
      const threadAnalysis = await this.analyzeThread(threadId, userId);
      
      if (!threadAnalysis.userIsParticipant) {
        await this.logProcessingResult(context, 'completed', 0, {
          reason: 'User is not an active participant'
        });
        
        return this.createIneligibleResult(threadId, 'User not participant', context);
      }

      // STEP 3: Check last sender
      if (threadAnalysis.userIsLastSender) {
        await this.logProcessingResult(context, 'completed', 0, {
          reason: 'User was last sender'
        });
        
        return this.createIneligibleResult(threadId, 'User was last sender', context);
      }

      // STEP 4: Calculate silence duration
      const silenceHours = threadAnalysis.silenceDuration;
      
      if (!this.silenceCalculator.meetsFollowUpRule(silenceHours, followUpRule)) {
        await this.logProcessingResult(context, 'completed', 0, {
          reason: 'Silence duration not met',
          silenceHours
        });
        
        return this.createIneligibleResult(threadId, 'Silence duration not met', context);
      }

      // STEP 5: Race condition protection
      if (this.config.enableRaceConditionProtection) {
        const updatedAnalysis = await this.verifyNoNewMessages(threadId, threadAnalysis);
        if (updatedAnalysis.messages.length > threadAnalysis.messages.length) {
          await this.duplicatePrevention.logProcessingAttempt(
            threadId, 
            userId, 
            requestId, 
            'duplicate_prevented' // Use existing status instead of race_condition
          );
          
          return this.createIneligibleResult(threadId, 'New messages detected', context);
        }
      }

      // STEP 6: Precision filtering for automation
      const lastMessage = threadAnalysis.lastMessage;
      const headers = await this.getMessageHeaders(lastMessage.id);
      const automationDetection = this.precisionFilter.detectAutomation(lastMessage, headers);

      if (automationDetection.isAutomated && 
          automationDetection.confidence >= this.config.automationThreshold) {
        
        await this.logProcessingResult(context, 'automation_filtered', 0, {
          automationConfidence: automationDetection.confidence,
          automationType: automationDetection.type
        });

        return this.createIneligibleResult(threadId, 'Automated message detected', context);
      }

      // STEP 7: Duplicate prevention check
      let duplicateCheck = { hasExistingFollowUp: false, hasScheduledFollowUp: false, hasDraftedFollowUp: false };
      
      if (this.config.enableDuplicatePrevention) {
        duplicateCheck = await this.duplicatePrevention.checkDuplicates(threadId, userId);
        
        if (duplicateCheck.hasExistingFollowUp || 
            duplicateCheck.hasScheduledFollowUp || 
            duplicateCheck.hasDraftedFollowUp) {
          
          await this.logProcessingResult(context, 'duplicate_prevented', 0, {
            duplicateCheck
          });

          return this.createIneligibleResult(threadId, 'Duplicate follow-up exists', context);
        }
      }

      // STEP 8: Calculate confidence score
      const confidenceScore = this.confidenceScoring.calculateConfidence(
        threadAnalysis,
        automationDetection,
        followUpRule,
        duplicateCheck,
        context
      );

      // STEP 9: Generate insights
      const confidenceFactors = this.confidenceScoring.calculateConfidenceFactors(
        threadAnalysis,
        automationDetection,
        followUpRule,
        duplicateCheck,
        context
      );

      const insights = this.insightFormatter.formatInsights(
        this.createDetectionResult(threadAnalysis, confidenceScore, followUpRule, context, automationDetection),
        threadAnalysis,
        confidenceFactors
      );

      // STEP 10: Create final result
      const result = this.createDetectionResult(
        threadAnalysis, 
        confidenceScore, 
        followUpRule, 
        context, 
        automationDetection,
        insights
      );

      // STEP 11: Update database and cache
      await this.updateThreadEligibility(result, threadAnalysis, confidenceFactors);
      await this.cacheEligibilityResult(result);

      // STEP 12: Log successful processing
      const processingTime = Date.now() - startTime;
      await this.logProcessingResult(context, 'completed', confidenceScore, {
        processingTime,
        automationConfidence: automationDetection.confidence,
        duplicateCheck
      });

      // Release processing lock
      if (this.config.enableDuplicatePrevention) {
        await this.duplicatePrevention.releaseProcessingLock(threadId, userId, requestId);
      }

      return result;

    } catch (error) {
      console.error(`Thread processing failed for ${threadId}:`, error);
      
      await this.logProcessingResult(context, 'failed', 0, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Release lock on failure
      if (this.config.enableDuplicatePrevention) {
        await this.duplicatePrevention.releaseProcessingLock(threadId, userId, requestId);
      }

      throw error;
    }
  }

  /**
   * Analyzes thread structure and participants
   */
  private async analyzeThread(threadId: string, userId: string): Promise<ThreadAnalysis> {
    // Fetch thread data
    const { data: thread, error: threadError } = await supabase
      .from('email_threads')
      .select('*')
      .eq('thread_id', threadId)
      .eq('user_id', userId)
      .single();

    if (threadError || !thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    // For now, create mock messages since messages table doesn't exist yet
    // In production, this would fetch from a messages table
    const mockMessages = this.createMockMessages(thread, userId);
    
    // Analyze participants
    const participants = this.extractParticipants(mockMessages, userId);
    const userEmail = await this.getUserEmail(userId);
    
    const userIsParticipant = participants.some(p => p.isUser);
    const lastMessage = mockMessages[mockMessages.length - 1];
    const lastSender = this.extractEmail(lastMessage.from);
    const userIsLastSender = lastSender === userEmail;
    
    const silenceDuration = this.silenceCalculator.calculateSilenceDuration(
      new Date(lastMessage.timestamp)
    );

    return {
      threadId,
      subject: thread.subject || 'No Subject',
      participants,
      messages: mockMessages,
      lastMessage,
      lastSender,
      userIsParticipant,
      userIsLastSender,
      silenceDuration,
      messageCount: mockMessages.length
    };
  }

  /**
   * Creates mock messages for testing (replace with real message fetching)
   */
  private createMockMessages(thread: any, userId: string): any[] {
    const userEmail = 'user@example.com'; // This would come from user profile
    
    return [
      {
        id: 'msg_1',
        threadId: thread.thread_id,
        from: userEmail,
        to: ['client@example.com'],
        subject: thread.subject,
        body: 'Initial message from user',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        isRead: true
      },
      {
        id: 'msg_2',
        threadId: thread.thread_id,
        from: 'client@example.com',
        to: [userEmail],
        subject: thread.subject,
        body: 'Reply from client',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        isRead: true
      }
    ];
  }

  /**
   * Verifies no new messages have arrived (race condition protection)
   */
  private async verifyNoNewMessages(threadId: string, originalAnalysis: ThreadAnalysis): Promise<ThreadAnalysis> {
    // For now, just return the original analysis
    // In production, this would re-fetch messages and compare
    return originalAnalysis;
  }

  /**
   * Creates detection result object
   */
  private createDetectionResult(
    threadAnalysis: ThreadAnalysis,
    confidenceScore: number,
    followUpRule: FollowUpRule,
    context: ProcessingContext,
    automationDetection: any,
    insights?: any
  ): SilenceDetectionResult {
    const silenceDurationDays = threadAnalysis.silenceDuration / 24;
    const autoSendReady = this.confidenceScoring.isAutoSendReady(confidenceScore, followUpRule);

    return {
      threadId: threadAnalysis.threadId,
      subject: threadAnalysis.subject,
      isEligible: confidenceScore >= 0.7, // Minimum threshold for eligibility
      lastSender: threadAnalysis.lastSender,
      silenceDurationDays,
      followUpRuleDays: followUpRule.delayDays,
      confidenceScore,
      autoSendReady,
      insights: insights || {
        summary: `${threadAnalysis.subject} - ${Math.round(silenceDurationDays)} days silence`,
        lastReplyStatus: threadAnalysis.userIsLastSender ? 'Waiting on you' : 'Waiting on them',
        suggestedAction: autoSendReady ? 'Follow-up ready' : 'Manual review needed',
        riskLevel: confidenceScore > 0.9 ? 'low' : confidenceScore > 0.7 ? 'medium' : 'high',
        participantSummary: `${threadAnalysis.participants.length} participants`
      },
      metadata: {
        eligibilityTimestamp: context.timestamp,
        processingTimeMs: 0, // Will be set by caller
        automationConfidence: automationDetection.confidence,
        duplicateCheckPassed: true,
        raceConditionProtected: this.config.enableRaceConditionProtection,
        filtersApplied: automationDetection.indicators || []
      }
    };
  }

  /**
   * Creates ineligible result
   */
  private createIneligibleResult(
    threadId: string, 
    reason: string, 
    context: ProcessingContext
  ): SilenceDetectionResult {
    return {
      threadId,
      subject: 'Unknown',
      isEligible: false,
      lastSender: '',
      silenceDurationDays: 0,
      followUpRuleDays: context.followUpRule.delayDays,
      confidenceScore: 0,
      autoSendReady: false,
      insights: {
        summary: reason,
        lastReplyStatus: 'Thread resolved',
        suggestedAction: 'No action needed',
        riskLevel: 'low',
        participantSummary: ''
      },
      rejectionReason: reason,
      metadata: {
        eligibilityTimestamp: context.timestamp,
        processingTimeMs: 0,
        automationConfidence: 0,
        duplicateCheckPassed: false,
        raceConditionProtected: false,
        filtersApplied: []
      }
    };
  }

  /**
   * Updates thread eligibility in database
   */
  private async updateThreadEligibility(
    result: SilenceDetectionResult,
    threadAnalysis: ThreadAnalysis,
    confidenceFactors: any
  ): Promise<void> {
    // For now, just update the existing email_threads table with available fields
    const updateData = {
      needs_followup: result.isEligible,
      priority_score: Math.round(result.confidenceScore * 100),
      // Note: silence detection fields would be added via schema migration
    };

    await supabase
      .from('email_threads')
      .update(updateData)
      .eq('thread_id', result.threadId)
      .eq('user_id', 'user_id_placeholder'); // This would be actual userId
  }

  /**
   * Caches eligibility result for performance (placeholder)
   */
  private async cacheEligibilityResult(result: SilenceDetectionResult): Promise<void> {
    // This would use the followup_eligibility_cache table when schema is updated
    // For now, this is a placeholder
  }

  /**
   * Helper methods
   */
  private async getUserFollowUpRule(userId: string): Promise<FollowUpRule | null> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('followup_delay_days, auto_scan_enabled')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    // Get user plan for monetization
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', userId)
      .single();

    const plan = profile?.plan || 'free';
    
    return {
      userId,
      delayDays: data.followup_delay_days || 3,
      autoSendEnabled: data.auto_scan_enabled && plan !== 'free',
      plan: plan as 'free' | 'pro' | 'enterprise'
    };
  }

  private async getUserThreads(userId: string): Promise<Array<{ id: string; thread_id: string }>> {
    const { data, error } = await supabase
      .from('email_threads')
      .select('id, thread_id')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  private async getUserEmail(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', userId)
      .single();

    if (error || !data) return '';
    return data.email || '';
  }

  private async getMessageHeaders(messageId: string): Promise<any[]> {
    // This would fetch message headers from the email provider
    // For now, return empty array
    return [];
  }

  private extractParticipants(messages: any[], userId: string): any[] {
    const participants = new Map<string, any>();
    const userEmail = '';

    messages.forEach(message => {
      const sender = this.extractEmail(message.from);
      if (!participants.has(sender)) {
        participants.set(sender, {
          email: sender,
          name: this.extractName(message.from),
          isUser: sender === userEmail
        });
      }

      // Add recipients
      [message.to, message.cc, message.bcc].flat().forEach(recipient => {
        const email = this.extractEmail(recipient);
        if (!participants.has(email)) {
          participants.set(email, {
            email,
            name: this.extractName(recipient),
            isUser: email === userEmail
          });
        }
      });
    });

    return Array.from(participants.values());
  }

  private extractEmail(emailString: string): string {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString;
  }

  private extractName(emailString: string): string {
    const match = emailString.match(/^"?([^"]+)"?\s*<([^>]+)>$/);
    return match ? match[1] : emailString;
  }

  private generateRequestId(): string {
    return `sd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async logProcessingResult(
    context: ProcessingContext,
    status: string,
    confidenceScore: number,
    metadata: any
  ): Promise<void> {
    if (!this.config.enableDuplicatePrevention) return;

    await this.duplicatePrevention.logProcessingAttempt(
      context.threadId,
      context.userId,
      context.requestId,
      status as any
    );
  }

  private async cleanupExpiredData(): Promise<void> {
    try {
      await this.duplicatePrevention.cleanupExpiredLocks();
      // Additional cleanup can be added here
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public method for manual thread processing
   */
  async processSingleThread(threadId: string, userId: string): Promise<SilenceDetectionResult> {
    const followUpRule = await this.getUserFollowUpRule(userId);
    if (!followUpRule) {
      throw new Error('User follow-up rule not found');
    }

    return this.processThread(threadId, userId, followUpRule);
  }

  /**
   * Gets processing statistics (simplified)
   */
  async getProcessingStats(userId: string): Promise<{
    totalThreads: number;
    eligibleThreads: number;
    autoSendReady: number;
    avgConfidence: number;
    lastProcessed: Date | null;
  }> {
    // Simplified stats since analytics table doesn't exist yet
    const { data: threads } = await supabase
      .from('email_threads')
      .select('needs_followup, priority_score, last_message_at')
      .eq('user_id', userId);

    const totalThreads = threads?.length || 0;
    const eligibleThreads = threads?.filter(t => t.needs_followup).length || 0;
    const avgConfidence = threads?.reduce((sum, t) => sum + (t.priority_score || 0), 0) / totalThreads || 0;
    const lastProcessed = threads?.length > 0 ? new Date(threads[0].last_message_at) : null;

    return {
      totalThreads,
      eligibleThreads,
      autoSendReady: 0, // Would be calculated from auto_send_ready field
      avgConfidence: avgConfidence / 100,
      lastProcessed
    };
  }
}
