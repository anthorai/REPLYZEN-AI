import { 
  GenerationRequest, 
  GenerationResult, 
  ConversationContext, 
  FollowUpGenerationConfig,
  BatchGenerationRequest,
  BatchGenerationResult
} from './types';
import { MessageExtractor } from './message-extractor';
import { ThreadSummarizer } from './thread-summarizer';
import { ConversationClassifier } from './conversation-classifier';
import { TimeToneAnalyzer } from './time-tone-analyzer';
import { PromptBuilder } from './prompt-builder';
import { QualityFilter } from './quality-filter';
import { ConfidenceScorer } from './confidence-scorer';
import { supabase } from '@/integrations/supabase/client';

export class FollowUpGenerationEngine {
  private messageExtractor: MessageExtractor;
  private threadSummarizer: ThreadSummarizer;
  private conversationClassifier: ConversationClassifier;
  private timeToneAnalyzer: TimeToneAnalyzer;
  private promptBuilder: PromptBuilder;
  private qualityFilter: QualityFilter;
  private confidenceScorer: ConfidenceScorer;
  private config: FollowUpGenerationConfig;

  constructor(config?: Partial<FollowUpGenerationConfig>) {
    this.messageExtractor = new MessageExtractor();
    this.threadSummarizer = new ThreadSummarizer();
    this.conversationClassifier = new ConversationClassifier();
    this.timeToneAnalyzer = new TimeToneAnalyzer();
    this.promptBuilder = new PromptBuilder();
    this.qualityFilter = new QualityFilter();
    this.confidenceScorer = new ConfidenceScorer();

    this.config = {
      maxWords: 120,
      maxSentences: 8,
      minQualityScore: 70,
      autoSendThreshold: 85,
      regenerationLimit: 3,
      enablePersonalization: true,
      enableContextMemory: true,
      defaultTone: 'professional',
      modelConfig: {
        temperature: 0.7,
        maxTokens: 200,
        topP: 0.9,
        presencePenalty: 0.3,
        frequencyPenalty: 0.3
      },
      ...config
    };
  }

  /**
   * Main entry point for generating a follow-up
   */
  async generateFollowUp(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now();
    const generationId = this.generateGenerationId();

    try {
      // Step 1: Extract and clean messages
      const extractedMessages = this.messageExtractor.extractRelevantMessages(
        request.context.lastUserMessage ? [this.createMockMessage(request.context.lastUserMessage, true)] : [],
        'user@example.com' // Would use actual user email
      );

      // Step 2: Generate thread summary
      const threadSummary = this.threadSummarizer.generateSummary(extractedMessages);

      // Step 3: Classify conversation
      const classification = this.conversationClassifier.classifyConversation(
        extractedMessages,
        'user@example.com'
      );

      // Step 4: Analyze time delay and tone
      const timeAnalysis = this.timeToneAnalyzer.analyzeTimeDelay(new Date(Date.now() - request.context.timeSinceLastMessage * 24 * 60 * 60 * 1000));
      const adaptedTone = this.timeToneAnalyzer.adaptToneForDelay(
        request.tonePreference,
        timeAnalysis.category,
        request.context.conversationType,
        request.context.relationshipStage
      );

      // Step 5: Build AI prompt
      const promptContext = this.buildPromptContext(request, threadSummary, classification, timeAnalysis);
      const prompt = this.promptBuilder.buildPrompt(promptContext);

      // Step 6: Generate follow-up text (mock AI call)
      const generatedText = await this.callAIModel(prompt);

      // Step 7: Quality filtering
      const qualityResult = this.qualityFilter.filterQuality(generatedText, request.context);

      // Step 8: Confidence scoring
      const confidenceResult = this.confidenceScorer.calculateConfidence(
        request.context,
        classification,
        qualityResult.qualityMetrics,
        qualityResult.safetyChecks
      );

      // Step 9: Create result
      const result: GenerationResult = {
        id: generationId,
        threadId: request.threadId,
        userId: request.userId,
        generatedText,
        confidenceScore: confidenceResult.overallScore,
        context: request.context,
        qualityMetrics: qualityResult.qualityMetrics,
        safetyChecks: qualityResult.safetyChecks,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          modelUsed: 'gpt-4',
          promptTokens: prompt.length / 4, // Rough estimate
          completionTokens: generatedText.length / 4,
          totalTokens: (prompt.length + generatedText.length) / 4,
          regenerationCount: 0,
          riskFactors: confidenceResult.riskFactors
        },
        autoSendReady: confidenceResult.autoSendReady,
        createdAt: new Date()
      };

      // Step 10: Store result
      await this.storeGenerationResult(result);

      return result;

    } catch (error) {
      console.error('Follow-up generation failed:', error);
      throw new Error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Regenerates a follow-up with feedback
   */
  async regenerateFollowUp(
    originalResult: GenerationResult,
    feedback: string
  ): Promise<GenerationResult> {
    if (originalResult.metadata.regenerationCount >= this.config.regenerationLimit) {
      throw new Error('Regeneration limit exceeded');
    }

    const startTime = Date.now();
    const regenerationId = this.generateGenerationId();

    try {
      // Build regeneration prompt
      const promptContext = this.buildPromptContextFromResult(originalResult);
      const regenerationPrompt = this.promptBuilder.buildRegenerationPrompt(
        promptContext,
        originalResult.generatedText,
        feedback
      );

      // Generate new text
      const newGeneratedText = await this.callAIModel(regenerationPrompt);

      // Quality filtering
      const qualityResult = this.qualityFilter.filterQuality(newGeneratedText, originalResult.context);

      // Confidence scoring
      const confidenceResult = this.confidenceScorer.calculateConfidence(
        originalResult.context,
        {} as any, // Would use original classification
        qualityResult.qualityMetrics,
        qualityResult.safetyChecks
      );

      // Create regenerated result
      const regeneratedResult: GenerationResult = {
        id: regenerationId,
        threadId: originalResult.threadId,
        userId: originalResult.userId,
        generatedText: newGeneratedText,
        confidenceScore: confidenceResult.overallScore,
        context: originalResult.context,
        qualityMetrics: qualityResult.qualityMetrics,
        safetyChecks: qualityResult.safetyChecks,
        metadata: {
          ...originalResult.metadata,
          processingTimeMs: Date.now() - startTime,
          regenerationCount: originalResult.metadata.regenerationCount + 1,
          lastRegeneratedAt: new Date(),
          riskFactors: confidenceResult.riskFactors
        },
        autoSendReady: confidenceResult.autoSendReady,
        createdAt: new Date()
      };

      // Store regeneration
      await this.storeRegeneration(originalResult.id, regeneratedResult, feedback);

      return regeneratedResult;

    } catch (error) {
      console.error('Regeneration failed:', error);
      throw new Error(`Regeneration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch generation for multiple threads
   */
  async generateBatch(request: BatchGenerationRequest): Promise<BatchGenerationResult> {
    const startTime = Date.now();
    const requestId = this.generateBatchId();
    const results: GenerationResult[] = [];
    const errors: Array<{ threadId: string; error: string }> = [];

    // Process in batches
    for (let i = 0; i < request.threadIds.length; i += request.batchSize) {
      const batch = request.threadIds.slice(i, i + request.batchSize);

      const batchPromises = batch.map(async (threadId) => {
        try {
          // Would fetch thread context from database
          const mockContext = this.createMockContext(threadId, request.userId);
          const generationRequest: GenerationRequest = {
            threadId,
            userId: request.userId,
            context: mockContext,
            tonePreference: request.tonePreference || this.config.defaultTone,
            maxWords: this.config.maxWords,
            includeCallToAction: true,
            priority: request.priority
          };

          const result = await this.generateFollowUp(generationRequest);
          
          // Auto-send if enabled and safe
          if (request.enableAutoSend && result.autoSendReady) {
            await this.autoSendFollowUp(result);
          }

          return result;

        } catch (error) {
          errors.push({
            threadId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      });

      // Small delay between batches to prevent rate limiting
      if (i + request.batchSize < request.threadIds.length) {
        await this.delay(100);
      }
    }

    const batchResult: BatchGenerationResult = {
      requestId,
      userId: request.userId,
      totalProcessed: request.threadIds.length,
      successful: results.length,
      failed: errors.length,
      autoSendSafe: results.filter(r => r.autoSendReady).length,
      results,
      errors,
      processingTimeMs: Date.now() - startTime,
      createdAt: new Date()
    };

    // Store batch result
    await this.storeBatchResult(batchResult);

    return batchResult;
  }

  /**
   * Gets generation statistics for a user
   */
  async getGenerationStats(userId: string): Promise<{
    totalGenerated: number;
    autoSent: number;
    manualSent: number;
    averageQuality: number;
    averageConfidence: number;
    conversionRate: number;
    topConversationTypes: Array<{ type: string; count: number }>;
    recentActivity: GenerationResult[];
  }> {
    try {
      // Would query from database
      const mockStats = {
        totalGenerated: 45,
        autoSent: 23,
        manualSent: 12,
        averageQuality: 82.5,
        averageConfidence: 87.3,
        conversionRate: 0.68,
        topConversationTypes: [
          { type: 'proposal', count: 15 },
          { type: 'meeting_scheduling', count: 12 },
          { type: 'sales_pitch', count: 8 }
        ],
        recentActivity: []
      };

      return mockStats;

    } catch (error) {
      console.error('Error getting generation stats:', error);
      throw new Error('Failed to retrieve generation statistics');
    }
  }

  /**
   * Validates generation request
   */
  validateRequest(request: GenerationRequest): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request.threadId) {
      errors.push('Thread ID is required');
    }

    if (!request.userId) {
      errors.push('User ID is required');
    }

    if (!request.context) {
      errors.push('Context is required');
    }

    if (request.maxWords < 10 || request.maxWords > 200) {
      warnings.push('Unusual word count limit');
    }

    if (request.context.timeSinceLastMessage < 0) {
      errors.push('Invalid time delay');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Private helper methods

  private createMockMessage(text: string, isFromUser: boolean): any {
    return {
      id: 'mock_msg',
      threadId: 'mock_thread',
      from: isFromUser ? 'user@example.com' : 'recipient@example.com',
      to: [isFromUser ? 'recipient@example.com' : 'user@example.com'],
      subject: 'Mock Subject',
      body: text,
      timestamp: new Date(),
      isRead: true
    };
  }

  private createMockContext(threadId: string, userId: string): ConversationContext {
    return {
      conversationType: 'proposal',
      relationshipStage: 'warm_lead',
      timeSinceLastMessage: 4,
      timeDelayCategory: 'gentle_followup',
      tonePreference: 'professional',
      threadSummary: 'Mock summary about proposal discussion',
      lastUserMessage: 'Mock user message',
      lastRecipientMessage: 'Mock recipient message',
      participantNames: {
        user: 'User',
        recipient: 'Recipient'
      }
    };
  }

  private buildPromptContext(
    request: GenerationRequest,
    threadSummary: any,
    classification: any,
    timeAnalysis: any
  ): any {
    return {
      conversationType: request.context.conversationType,
      relationshipStage: request.context.relationshipStage,
      timeDelayCategory: timeAnalysis.category,
      timeSinceLastMessage: request.context.timeSinceLastMessage,
      tonePreference: request.tonePreference,
      threadSummary: typeof threadSummary === 'string' ? threadSummary : threadSummary.context || '',
      lastUserMessage: request.context.lastUserMessage,
      lastRecipientMessage: request.context.lastRecipientMessage,
      maxWords: request.maxWords,
      includeCallToAction: request.includeCallToAction
    };
  }

  private buildPromptContextFromResult(result: GenerationResult): any {
    return {
      conversationType: result.context.conversationType,
      relationshipStage: result.context.relationshipStage,
      timeDelayCategory: result.context.timeDelayCategory,
      timeSinceLastMessage: result.context.timeSinceLastMessage,
      tonePreference: result.context.tonePreference,
      threadSummary: typeof result.context.threadSummary === 'string' 
        ? result.context.threadSummary 
        : result.context.threadSummary.context || '',
      lastUserMessage: result.context.lastUserMessage,
      lastRecipientMessage: result.context.lastRecipientMessage,
      maxWords: this.config.maxWords,
      includeCallToAction: true
    };
  }

  private async callAIModel(prompt: string): Promise<string> {
    // Mock AI call - in production would call actual AI service
    await this.delay(1000); // Simulate API call
    
    return `Hi [Name], I wanted to gently follow up regarding the proposal shared last Thursday. Please let me know if you'd like any clarification or if we can schedule a quick call to discuss next steps.`;
  }

  private async storeGenerationResult(result: GenerationResult): Promise<void> {
    try {
      await supabase
        .from('followup_generations')
        .insert({
          generation_request_id: result.id,
          thread_id: result.threadId,
          user_id: result.userId,
          generated_text: result.generatedText,
          confidence_score: result.confidenceScore,
          conversation_type: result.context.conversationType,
          relationship_stage: result.context.relationshipStage,
          time_delay_category: result.context.timeDelayCategory,
          tone_preference: result.context.tonePreference,
          time_since_last_message: result.context.timeSinceLastMessage,
          quality_metrics: result.qualityMetrics,
          safety_checks: result.safetyChecks,
          auto_send_ready: result.autoSendReady,
          generation_metadata: result.metadata,
          status: 'generated',
          created_at: result.createdAt
        });
    } catch (error) {
      console.error('Error storing generation result:', error);
      // Don't throw - storage failure shouldn't stop the generation
    }
  }

  private async storeRegeneration(
    originalId: string,
    regeneratedResult: GenerationResult,
    feedback: string
  ): Promise<void> {
    try {
      await supabase
        .from('regeneration_attempts')
        .insert({
          original_generation_id: originalId,
          regeneration_number: regeneratedResult.metadata.regenerationCount,
          reason_for_regeneration: feedback,
          new_generated_text: regeneratedResult.generatedText,
          new_confidence_score: regeneratedResult.confidenceScore,
          new_quality_metrics: regeneratedResult.qualityMetrics,
          new_safety_checks: regeneratedResult.safetyChecks,
          created_at: new Date()
        });
    } catch (error) {
      console.error('Error storing regeneration:', error);
    }
  }

  private async storeBatchResult(batchResult: BatchGenerationResult): Promise<void> {
    try {
      // Store batch metadata - would implement batch tracking table
      console.log('Batch result stored:', batchResult.requestId);
    } catch (error) {
      console.error('Error storing batch result:', error);
    }
  }

  private async autoSendFollowUp(result: GenerationResult): Promise<void> {
    try {
      // Log auto-send for safety compliance
      await supabase
        .from('auto_send_safety_log')
        .insert({
          generation_id: result.id,
          user_id: result.userId,
          thread_id: result.threadId,
          safety_check_passed: result.safetyChecks.autoSendSafe,
          confidence_score: result.confidenceScore,
          safety_flags: result.safetyChecks,
          auto_send_allowed: result.autoSendReady,
          sent_at: new Date(),
          created_at: new Date()
        });

      // Would actually send the email here
      console.log('Auto-sent follow-up:', result.id);

    } catch (error) {
      console.error('Error auto-sending follow-up:', error);
    }
  }

  private generateGenerationId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets engine configuration
   */
  getConfig(): FollowUpGenerationConfig {
    return { ...this.config };
  }

  /**
   * Updates engine configuration
   */
  updateConfig(newConfig: Partial<FollowUpGenerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
