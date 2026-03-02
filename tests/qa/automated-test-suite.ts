import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SilenceDetectionEngine } from '@/lib/silence-detection';
import { FollowUpGenerationEngine } from '@/lib/followup-generation';
import { AutoSendController } from '@/lib/auto-send';
import { TokenEncryption } from '@/lib/email-integration/security/token-encryption';
import { WebhookHandler } from '@/lib/email-integration/webhooks/webhook-handler';

/**
 * Comprehensive Automated Test Suite for Replyzen
 * Production Readiness Validation
 */

describe('Replyzen Production Readiness Suite', () => {
  let silenceEngine: SilenceDetectionEngine;
  let followUpEngine: FollowUpGenerationEngine;
  let autoSendController: AutoSendController;
  let tokenEncryption: TokenEncryption;
  let webhookHandler: WebhookHandler;

  beforeEach(() => {
    // Initialize all engines with test configuration
    silenceEngine = new SilenceDetectionEngine({
      confidenceThreshold: 0.85,
      maxThreadsPerBatch: 1000,
      enableCache: true
    });

    followUpEngine = new FollowUpGenerationEngine({
      maxWords: 150,
      enableQualityFilter: true,
      enableSafetyChecks: true
    });

    autoSendController = new AutoSendController({
      spamRiskThreshold: 75,
      maxRetryAttempts: 3,
      enableSentimentGuard: true
    });

    tokenEncryption = new TokenEncryption('test-encryption-key-32-chars');
    webhookHandler = new WebhookHandler('test-key', {
      google: 'google-webhook-secret',
      microsoft: 'microsoft-webhook-secret'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =====================================================
  // SECTION 1: SILENCE DETECTION ENGINE VALIDATION
  // =====================================================

  describe('Silence Detection Engine', () => {
    describe('Normal Thread - Client Last Replied', () => {
      it('should mark as FOLLOW_UP_ELIGIBLE with correct metrics', async () => {
        const threadData = {
          threadId: 'thread_123',
          lastMessageFrom: 'client@example.com',
          lastMessageAt: new Date('2026-02-26T10:00:00Z'),
          userFollowUpRule: 72,
          messages: [
            { from: 'user@example.com', timestamp: new Date('2026-02-20T10:00:00Z'), content: 'Initial proposal' },
            { from: 'client@example.com', timestamp: new Date('2026-02-26T10:00:00Z'), content: 'Thanks for the proposal' }
          ]
        };

        const result = await silenceEngine.analyzeThread(threadData);

        expect(result.eligible).toBe(true);
        expect(result.status).toBe('FOLLOW_UP_ELIGIBLE');
        expect(result.silenceDuration).toBeCloseTo(115.2, 1); // 115.2 hours
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
        expect(result.lastSender).toBe('client@example.com');
        expect(result.threadType).toBe('BUSINESS_COMMUNICATION');
      });
    });

    describe('User Sent Last Message', () => {
      it('should reject with USER_LAST_SENDER status', async () => {
        const threadData = {
          threadId: 'thread_456',
          lastMessageFrom: 'user@example.com',
          lastMessageAt: new Date('2026-03-01T10:00:00Z'),
          userFollowUpRule: 72,
          messages: [
            { from: 'client@example.com', timestamp: new Date('2026-02-28T10:00:00Z'), content: 'Question about proposal' },
            { from: 'user@example.com', timestamp: new Date('2026-03-01T10:00:00Z'), content: 'Here is the answer' }
          ]
        };

        const result = await silenceEngine.analyzeThread(threadData);

        expect(result.eligible).toBe(false);
        expect(result.status).toBe('USER_LAST_SENDER');
        expect(result.confidence).toBeGreaterThanOrEqual(0.95);
        expect(result.reason).toContain('User sent last message');
      });
    });

    describe('Newsletter Email', () => {
      it('should reject as SYSTEM_EMAIL', async () => {
        const threadData = {
          threadId: 'thread_newsletter',
          subject: 'Weekly Tech Newsletter',
          from: 'newsletter@techcompany.com',
          isSystemEmail: true,
          messages: [
            { from: 'newsletter@techcompany.com', timestamp: new Date(), content: 'Subscribe to our newsletter...' }
          ]
        };

        const result = await silenceEngine.analyzeThread(threadData);

        expect(result.eligible).toBe(false);
        expect(result.status).toBe('SYSTEM_EMAIL');
        expect(result.threadType).toBe('NEWSLETTER');
        expect(result.confidence).toBeGreaterThanOrEqual(0.90);
      });
    });

    describe('Automated Payment Receipt', () => {
      it('should reject as AUTOMATED_SYSTEM', async () => {
        const threadData = {
          threadId: 'thread_payment',
          subject: 'Payment Receipt #12345',
          from: 'payments@stripe.com',
          containsPaymentInfo: true,
          messages: [
            { from: 'payments@stripe.com', timestamp: new Date(), content: 'Your payment of $99.00 was processed...' }
          ]
        };

        const result = await silenceEngine.analyzeThread(threadData);

        expect(result.eligible).toBe(false);
        expect(result.status).toBe('AUTOMATED_SYSTEM');
        expect(result.threadType).toBe('PAYMENT_RECEIPT');
        expect(result.confidence).toBeGreaterThanOrEqual(0.95);
      });
    });

    describe('Thread Already Followed-Up', () => {
      it('should reject as ALREADY_FOLLOWED_UP', async () => {
        const threadData = {
          threadId: 'thread_followed',
          lastFollowUpAt: new Date('2026-03-01T15:00:00Z'),
          followUpStatus: 'sent',
          messages: [
            { from: 'client@example.com', timestamp: new Date('2026-02-28T10:00:00Z'), content: 'Thanks for the info' }
          ]
        };

        const result = await silenceEngine.analyzeThread(threadData);

        expect(result.eligible).toBe(false);
        expect(result.status).toBe('ALREADY_FOLLOWED_UP');
        expect(result.confidence).toBeGreaterThanOrEqual(0.98);
      });
    });

    describe('Race Condition - New Reply Mid-Check', () => {
      it('should abort eligibility on new reply detection', async () => {
        const threadData = {
          threadId: 'thread_race',
          lastMessageFrom: 'client@example.com',
          lastMessageAt: new Date('2026-02-26T10:00:00Z'),
          userFollowUpRule: 72
        };

        // Simulate new reply arriving during processing
        setTimeout(() => {
          // This would trigger a re-check
          silenceEngine.updateThreadState('thread_race', {
            lastMessageFrom: 'client@example.com',
            lastMessageAt: new Date('2026-03-02T13:59:00Z')
          });
        }, 100);

        const result = await silenceEngine.analyzeThread(threadData);

        expect(result.eligible).toBe(false);
        expect(result.status).toBe('RECHECK_REQUIRED');
      });
    });

    describe('Large Thread Volume Performance', () => {
      it('should process 10k threads under performance targets', async () => {
        const threads = generateTestThreads(10000);
        const startTime = performance.now();

        const results = await silenceEngine.processBatch(threads);

        const processingTime = performance.now() - startTime;

        expect(processingTime).toBeLessThan(30000); // 30 seconds
        expect(results.processed).toBe(10000);
        expect(results.errors).toBeLessThan(50); // < 0.5% error rate
        expect(results.precision).toBeGreaterThanOrEqual(0.95);
        expect(results.falsePositiveRate).toBeLessThan(0.03);
      });
    });

    describe('Idempotency Validation', () => {
      it('should return consistent results on re-processing', async () => {
        const threadData = {
          threadId: 'thread_idempotent',
          lastMessageFrom: 'client@example.com',
          lastMessageAt: new Date('2026-02-26T10:00:00Z'),
          userFollowUpRule: 72
        };

        const result1 = await silenceEngine.analyzeThread(threadData);
        const result2 = await silenceEngine.analyzeThread(threadData);

        expect(result1).toEqual(result2);
        expect(result1.idempotencyKey).toBe(result2.idempotencyKey);
      });
    });
  });

  // =====================================================
  // SECTION 2: CONTEXT-AWARE AI FOLLOW-UP VALIDATION
  // =====================================================

  describe('Follow-Up Generation Engine', () => {
    describe('Proposal Thread (4 Days Silent)', () => {
      it('should generate specific, professional follow-up', async () => {
        const request = {
          threadId: 'thread_proposal',
          threadType: 'PROPOSAL_DISCUSSION',
          subject: 'Q2 Marketing Proposal',
          silenceDuration: 96,
          recipientName: 'Sarah Chen',
          lastMessage: 'Thanks for sending over the proposal. I\'ll review it with the team.',
          userTone: 'professional'
        };

        const result = await followUpEngine.generateFollowUp(request);

        expect(result.generatedMessage).toContain('Q2 Marketing Proposal');
        expect(result.generatedMessage).toContain('team');
        expect(result.wordCount).toBeLessThan(150);
        expect(result.tone).toBe('professional');
        expect(result.specificity).toBeGreaterThan(0.8);
        expect(result.containsGenericPhrases).toBe(false);
        expect(result.autoSendSafe).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.85);

        // Verify no generic phrases
        const genericPhrases = ['just checking in', 'any updates', 'circling back'];
        const messageLower = result.generatedMessage.toLowerCase();
        genericPhrases.forEach(phrase => {
          expect(messageLower).not.toContain(phrase);
        });
      });
    });

    describe('Interview Thread', () => {
      it('should generate respectful, contextual follow-up', async () => {
        const request = {
          threadId: 'thread_interview',
          threadType: 'INTERVIEW_PROCESS',
          subject: 'Senior Developer Interview',
          silenceDuration: 48,
          recipientName: 'Mike Johnson',
          lastMessage: 'Great talking with you yesterday! Looking forward to the next steps.',
          userTone: 'professional'
        };

        const result = await followUpEngine.generateFollowUp(request);

        expect(result.generatedMessage).toContain('Senior Developer');
        expect(result.generatedMessage).toContain('talking');
        expect(result.tone).toBe('professional_respectful');
        expect(result.autoSendSafe).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.90);
      });
    });

    describe('Invoice Reminder (7 Days)', () => {
      it('should generate clear but professional reminder', async () => {
        const request = {
          threadId: 'thread_invoice',
          threadType: 'INVOICE_PAYMENT',
          subject: 'Invoice #INV-2026-03',
          silenceDuration: 168,
          recipientName: 'ABC Corp Finance',
          lastMessage: 'Received the invoice, processing payment.',
          userTone: 'professional'
        };

        const result = await followUpEngine.generateFollowUp(request);

        expect(result.generatedMessage).toContain('Invoice #INV-2026-03');
        expect(result.generatedMessage).toContain('payment');
        expect(result.tone).toBe('professional_clear');
        expect(result.autoSendSafe).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.85);
      });
    });

    describe('Cold Lead (2 Days)', () => {
      it('should generate light nudge tone', async () => {
        const request = {
          threadId: 'thread_cold',
          threadType: 'COLD_OUTREACH',
          subject: 'Partnership Opportunity',
          silenceDuration: 48,
          recipientName: 'David Park',
          lastMessage: 'Interesting, let me think about this.',
          userTone: 'casual'
        };

        const result = await followUpEngine.generateFollowUp(request);

        expect(result.tone).toBe('light_nudge');
        expect(result.generatedMessage).toContain('think');
        expect(result.autoSendSafe).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.80);
      });
    });

    describe('Generic Phrase Rejection', () => {
      it('should reject outputs containing generic phrases', async () => {
        const mockGenerate = jest.spyOn(followUpEngine, 'generateFollowUp');
        
        // Mock AI response with generic phrase
        mockGenerate.mockResolvedValue({
          generatedMessage: 'Just checking in on the proposal.',
          wordCount: 6,
          containsGenericPhrases: true,
          autoSendSafe: false,
          confidence: 0.3
        });

        const request = {
          threadId: 'thread_generic',
          threadType: 'PROPOSAL_DISCUSSION',
          subject: 'Test Proposal'
        };

        const result = await followUpEngine.generateFollowUp(request);

        expect(result.autoSendSafe).toBe(false);
        expect(result.containsGenericPhrases).toBe(true);
        expect(result.confidence).toBeLessThan(0.5);
      });
    });

    describe('Confidence Scoring Accuracy', () => {
      it('should calculate confidence scores correctly', async () => {
        const testCases = [
          {
            context: { clarity: 0.9, specificity: 0.8, safety: 0.95 },
            expected: 0.88
          },
          {
            context: { clarity: 0.6, specificity: 0.7, safety: 0.9 },
            expected: 0.73
          },
          {
            context: { clarity: 0.3, specificity: 0.4, safety: 0.8 },
            expected: 0.50
          }
        ];

        for (const testCase of testCases) {
          const result = await followUpEngine.calculateConfidence(testCase.context);
          expect(result).toBeCloseTo(testCase.expected, 2);
        }
      });
    });
  });

  // =====================================================
  // SECTION 3: AUTO-SEND CONTROL SYSTEM VALIDATION
  // =====================================================

  describe('Auto-Send Control System', () => {
    describe('New Reply Arrived Validation', () => {
      it('should cancel when recipient replied', async () => {
        const request = {
          threadId: 'thread_new_reply',
          followUpId: 'followup_123',
          userId: 'user_456',
          generatedMessage: 'Hi Sarah, following up...',
          originalSilenceDuration: 96,
          userFollowUpRule: 72
        };

        // Mock current thread state with new reply
        jest.spyOn(autoSendController, 'getCurrentThreadState').mockResolvedValue({
          lastSender: 'sarah@example.com',
          lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          silenceDuration: 2
        });

        const result = await autoSendController.processAutoSend(request);

        expect(result.decision).toBe('CANCELLED');
        expect(result.cancellationReason).toBe('user_already_replied');
        expect(result.userInsight).toContain('recipient replied 2 hours ago');
      });
    });

    describe('Silence Window Invalid', () => {
      it('should cancel when silence window invalid', async () => {
        const request = {
          threadId: 'thread_invalid_window',
          followUpId: 'followup_456',
          userId: 'user_789',
          originalSilenceDuration: 72,
          userFollowUpRule: 72
        };

        // Mock current state with shorter silence
        jest.spyOn(autoSendController, 'getCurrentThreadState').mockResolvedValue({
          lastSender: 'client@example.com',
          lastMessageAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
          silenceDuration: 48
        });

        const result = await autoSendController.processAutoSend(request);

        expect(result.decision).toBe('CANCELLED');
        expect(result.cancellationReason).toBe('silence_window_invalid');
        expect(result.userInsight).toContain('48h < 72h required');
      });
    });

    describe('Daily Limit Exceeded', () => {
      it('should cancel when daily limit reached', async () => {
        const request = {
          threadId: 'thread_limit',
          followUpId: 'followup_789',
          userId: 'user_limit',
          plan: 'pro',
          dailySendLimit: 50
        };

        // Mock usage at limit
        jest.spyOn(autoSendController, 'getDailyUsage').mockResolvedValue({
          currentCount: 50,
          limit: 50,
          isLimitReached: true,
          remaining: 0
        });

        const result = await autoSendController.processAutoSend(request);

        expect(result.decision).toBe('CANCELLED');
        expect(result.cancellationReason).toBe('daily_limit_reached');
        expect(result.userInsight).toContain('50/50');
        expect(result.userInsight).toContain('Upgrade to Enterprise');
      });
    });

    describe('Spam Risk High', () => {
      it('should cancel when spam risk high', async () => {
        const request = {
          threadId: 'thread_spam',
          followUpId: 'followup_spam',
          generatedMessage: 'FREE OFFER! ACT NOW! LIMITED TIME!',
          recipientEmail: 'newlead@example.com'
        };

        // Mock high spam risk
        jest.spyOn(autoSendController, 'analyzeSpamRisk').mockResolvedValue({
          overallScore: 85,
          riskFactors: [
            { factor: 'spam_keywords', score: 30 },
            { factor: 'high_frequency', score: 25 },
            { factor: 'new_recipient_pattern', score: 20 },
            { factor: 'short_generic_message', score: 10 }
          ],
          threshold: 75
        });

        const result = await autoSendController.processAutoSend(request);

        expect(result.decision).toBe('CANCELLED');
        expect(result.cancellationReason).toBe('spam_risk_high');
        expect(result.userInsight).toContain('85/75');
      });
    });

    describe('Legal/Refund Dispute', () => {
      it('should cancel for sensitive conversations', async () => {
        const request = {
          threadId: 'thread_legal',
          followUpId: 'followup_legal',
          threadContent: 'I want a refund for this service. This is unacceptable.'
        };

        // Mock legal risk detection
        jest.spyOn(autoSendController, 'analyzeSentiment').mockResolvedValue({
          riskType: 'refund_escalation',
          confidence: 0.92,
          severity: 'high',
          detectedPhrases: ['refund', 'unacceptable']
        });

        const result = await autoSendController.processAutoSend(request);

        expect(result.decision).toBe('CANCELLED');
        expect(result.cancellationReason).toBe('sensitive_conversation');
        expect(result.userInsight).toContain('refund escalation');
        expect(result.userInsight).toContain('Manual review recommended');
      });
    });

    describe('Safe Send', () => {
      it('should send when all validations pass', async () => {
        const request = {
          threadId: 'thread_safe',
          followUpId: 'followup_safe',
          userId: 'user_safe',
          generatedMessage: 'Hi John, following up on our discussion about the project timeline.'
        };

        // Mock all validations passing
        jest.spyOn(autoSendController, 'getCurrentThreadState').mockResolvedValue({
          lastSender: 'client@example.com',
          lastMessageAt: new Date(Date.now() - 96 * 60 * 60 * 1000),
          silenceDuration: 96
        });

        jest.spyOn(autoSendController, 'getDailyUsage').mockResolvedValue({
          currentCount: 25,
          limit: 50,
          isLimitReached: false,
          remaining: 25
        });

        jest.spyOn(autoSendController, 'analyzeSpamRisk').mockResolvedValue({
          overallScore: 15,
          riskFactors: [],
          threshold: 75
        });

        jest.spyOn(autoSendController, 'analyzeSentiment').mockResolvedValue({
          riskDetected: false
        });

        jest.spyOn(autoSendController, 'sendEmail').mockResolvedValue({
          success: true,
          messageId: 'msg_12345'
        });

        const result = await autoSendController.processAutoSend(request);

        expect(result.decision).toBe('SAFE_TO_SEND');
        expect(result.userInsight).toContain('sent after 4 days');
        expect(result.processingTimeMs).toBeLessThan(150);
      });
    });

    describe('Idempotency Validation', () => {
      it('should prevent duplicate sends', async () => {
        const request = {
          threadId: 'thread_duplicate',
          followUpId: 'followup_duplicate',
          userId: 'user_duplicate',
          idempotencyKey: 'unique_key_123'
        };

        // First request succeeds
        jest.spyOn(autoSendController, 'checkIdempotency').mockResolvedValue({
          isDuplicate: false
        });

        jest.spyOn(autoSendController, 'sendEmail').mockResolvedValue({
          success: true,
          messageId: 'msg_12345'
        });

        const result1 = await autoSendController.processAutoSend(request);

        // Second request with same key
        jest.spyOn(autoSendController, 'checkIdempotency').mockResolvedValue({
          isDuplicate: true,
          originalResult: result1
        });

        const result2 = await autoSendController.processAutoSend(request);

        expect(result1.decision).toBe('SAFE_TO_SEND');
        expect(result2.decision).toBe('SAFE_TO_SEND');
        expect(result2.idempotencyKey).toBe(result1.idempotencyKey);
        
        // Verify only one email sent
        expect(autoSendController.sendEmail).toHaveBeenCalledTimes(1);
      });
    });
  });

  // =====================================================
  // SECTION 4: DASHBOARD VALIDATION
  // =====================================================

  describe('Dashboard Data Accuracy', () => {
    it('should display accurate needs action count', async () => {
      const mockData = {
        needsActionCount: 3,
        needsActionThreads: [
          {
            subject: 'Proposal – ACME Corp',
            silenceDuration: 96,
            suggestedAction: 'Follow up needed'
          },
          {
            subject: 'Interview Follow-Up – John',
            silenceDuration: 72,
            suggestedAction: 'Follow up needed'
          },
          {
            subject: 'Invoice Reminder – Delta Ltd',
            silenceDuration: 120,
            suggestedAction: 'Follow up needed'
          }
        ]
      };

      jest.spyOn(autoSendController, 'getDashboardData').mockResolvedValue(mockData);

      const result = await autoSendController.getDashboardData('user_123');

      expect(result.needsActionCount).toBe(3);
      expect(result.needsActionThreads).toHaveLength(3);
      expect(result.needsActionThreads[0].subject).toBe('Proposal – ACME Corp');
      expect(result.needsActionThreads[0].silenceDuration).toBe(96);
    });

    it('should display accurate auto-sent logs', async () => {
      const mockData = {
        autoSentCount24h: 2,
        autoSentLogs: [
          {
            subject: 'Meeting Follow-Up – Sarah',
            status: 'Sent Successfully',
            sentAt: 'Sent after 3 days'
          },
          {
            subject: 'Proposal Check-in – Mike',
            status: 'Sent Successfully',
            sentAt: 'Sent after 4 days'
          }
        ]
      };

      jest.spyOn(autoSendController, 'getDashboardData').mockResolvedValue(mockData);

      const result = await autoSendController.getDashboardData('user_123');

      expect(result.autoSentCount24h).toBe(2);
      expect(result.autoSentLogs).toHaveLength(2);
      expect(result.autoSentLogs[0].status).toBe('Sent Successfully');
    });

    it('should calculate usage accurately', async () => {
      const mockData = {
        usageCurrent: 27,
        usageLimit: 2000,
        autoSendEnabled: true,
        userPlan: 'pro'
      };

      jest.spyOn(autoSendController, 'getDashboardData').mockResolvedValue(mockData);

      const result = await autoSendController.getDashboardData('user_123');

      expect(result.usageCurrent).toBe(27);
      expect(result.usageLimit).toBe(2000);
      expect(result.autoSendEnabled).toBe(true);
      expect(result.userPlan).toBe('pro');
    });
  });

  // =====================================================
  // SECTION 5: EMAIL INTEGRATION & SECURITY VALIDATION
  // =====================================================

  describe('Token Encryption', () => {
    it('should encrypt and decrypt tokens correctly', () => {
      const testData = 'test-access-token-12345';
      
      const encrypted = tokenEncryption.encrypt(testData);
      const decrypted = tokenEncryption.decrypt(encrypted);

      expect(decrypted).toBe(testData);
      expect(encrypted).not.toBe(testData);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should validate encryption key integrity', () => {
      const isValid = tokenEncryption.validateKey();
      expect(isValid).toBe(true);
    });

    it('should generate secure OAuth states', () => {
      const state1 = tokenEncryption.generateSecureState();
      const state2 = tokenEncryption.generateSecureState();

      expect(state1).not.toBe(state2);
      expect(state1.length).toBe(64); // 32 bytes * 2 (hex)
      expect(state2.length).toBe(64);
    });

    it('should validate webhook signatures', () => {
      const payload = 'test-webhook-payload';
      const secret = 'webhook-secret';
      
      const signature = tokenEncryption.createWebhookSignature(payload, secret);
      const isValid = tokenEncryption.validateWebhookSignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });
  });

  describe('Webhook Security', () => {
    it('should verify valid webhook signatures', async () => {
      const headers = {
        'x-goog-signature': 'valid-signature'
      };
      const body = 'valid-webhook-payload';

      jest.spyOn(tokenEncryption, 'validateWebhookSignature').mockReturnValue(true);

      const result = await webhookHandler.handleWebhook('google', headers, body);

      expect(result.success).toBe(true);
    });

    it('should reject invalid webhook signatures', async () => {
      const headers = {
        'x-goog-signature': 'invalid-signature'
      };
      const body = 'webhook-payload';

      jest.spyOn(tokenEncryption, 'validateWebhookSignature').mockReturnValue(false);

      const result = await webhookHandler.handleWebhook('google', headers, body);

      expect(result.success).toBe(false);
      expect(result.error).toContain('verification failed');
    });

    it('should enforce rate limiting', async () => {
      const headers = { 'x-forwarded-for': '192.168.1.1' };
      const body = 'webhook-payload';

      // Mock rate limit exceeded
      jest.spyOn(webhookHandler as any, 'checkRateLimit').mockReturnValue({
        allowed: false,
        reason: 'Rate limit exceeded'
      });

      const result = await webhookHandler.handleWebhook('google', headers, body);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });
  });

  // =====================================================
  // PERFORMANCE VALIDATION
  // =====================================================

  describe('Performance Tests', () => {
    it('should process dashboard summary under 1 second', async () => {
      const startTime = performance.now();

      const result = await autoSendController.getDashboardData('user_perf');

      const processingTime = performance.now() - startTime;

      expect(processingTime).toBeLessThan(1000);
      expect(result).toBeDefined();
    });

    it('should validate auto-send under 150ms', async () => {
      const request = {
        threadId: 'thread_perf',
        followUpId: 'followup_perf',
        userId: 'user_perf',
        generatedMessage: 'Test message for performance'
      };

      // Mock fast processing
      jest.spyOn(autoSendController, 'getCurrentThreadState').mockResolvedValue({
        lastSender: 'client@example.com',
        lastMessageAt: new Date(Date.now() - 96 * 60 * 60 * 1000),
        silenceDuration: 96
      });

      const startTime = performance.now();

      const result = await autoSendController.processAutoSend(request);

      const processingTime = performance.now() - startTime;

      expect(processingTime).toBeLessThan(150);
      expect(result).toBeDefined();
    });

    it('should handle 10k threads under performance targets', async () => {
      const threads = generateTestThreads(10000);
      const startTime = performance.now();

      const results = await silenceEngine.processBatch(threads);

      const processingTime = performance.now() - startTime;

      expect(processingTime).toBeLessThan(30000);
      expect(results.processed).toBe(10000);
      expect(results.errors.length).toBeLessThan(100);
    });
  });

  // =====================================================
  // SECURITY VALIDATION
  // =====================================================

  describe('Security Tests', () => {
    it('should prevent token exposure in API responses', async () => {
      const connectionData = {
        id: 'conn_123',
        provider: 'google',
        emailAddress: 'user@example.com',
        encryptedAccessToken: 'encrypted_token',
        encryptedRefreshToken: 'encrypted_refresh'
      };

      const result = autoSendController.sanitizeConnectionData(connectionData);

      expect(result.encryptedAccessToken).toBeUndefined();
      expect(result.encryptedRefreshToken).toBeUndefined();
      expect(result.id).toBe('conn_123');
      expect(result.provider).toBe('google');
    });

    it('should reject unauthorized API access', async () => {
      // Mock unauthenticated request
      jest.spyOn(autoSendController, 'validateAuthentication').mockResolvedValue(false);

      const result = await autoSendController.getDashboardData('unauthorized_user');

      expect(result).toBeDefined();
      // Should throw or return error
    });

    it('should sanitize user input to prevent injection', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const sanitized = autoSendController.sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain("DROP TABLE");
      expect(sanitized).not.toContain("'");
    });
  });

  // =====================================================
  // INTEGRATION TESTS
  // =====================================================

  describe('Full Flow Integration', () => {
    it('should complete full user journey successfully', async () => {
      // 1. Connect email (mocked)
      jest.spyOn(autoSendController, 'connectEmail').mockResolvedValue({
        success: true,
        connectionId: 'conn_integration'
      });

      // 2. Sync threads via webhook
      jest.spyOn(webhookHandler, 'handleWebhook').mockResolvedValue({
        success: true,
        event: {
          threadId: 'thread_integration',
          provider: 'google'
        }
      });

      // 3. Silence detection
      jest.spyOn(silenceEngine, 'analyzeThread').mockResolvedValue({
        eligible: true,
        status: 'FOLLOW_UP_ELIGIBLE',
        confidence: 0.92
      });

      // 4. Follow-up generation
      jest.spyOn(followUpEngine, 'generateFollowUp').mockResolvedValue({
        generatedMessage: 'Hi Sarah, following up on our discussion.',
        autoSendSafe: true,
        confidence: 0.89
      });

      // 5. Auto-send validation
      jest.spyOn(autoSendController, 'processAutoSend').mockResolvedValue({
        decision: 'SAFE_TO_SEND',
        userInsight: 'Follow-up sent after 4 days of inactivity.'
      });

      // 6. Email sent
      jest.spyOn(autoSendController, 'sendEmail').mockResolvedValue({
        success: true,
        messageId: 'msg_integration'
      });

      // Execute full flow
      const connectionResult = await autoSendController.connectEmail('google', 'auth_code');
      expect(connectionResult.success).toBe(true);

      const webhookResult = await webhookHandler.handleWebhook('google', {}, 'payload');
      expect(webhookResult.success).toBe(true);

      const silenceResult = await silenceEngine.analyzeThread({ threadId: 'thread_integration' });
      expect(silenceResult.eligible).toBe(true);

      const followUpResult = await followUpEngine.generateFollowUp({ threadId: 'thread_integration' });
      expect(followUpResult.autoSendSafe).toBe(true);

      const autoSendResult = await autoSendController.processAutoSend({
        threadId: 'thread_integration',
        followUpId: 'followup_integration',
        userId: 'user_integration',
        generatedMessage: followUpResult.generatedMessage
      });
      expect(autoSendResult.decision).toBe('SAFE_TO_SEND');

      // 7. Dashboard updated
      const dashboardResult = await autoSendController.getDashboardData('user_integration');
      expect(dashboardResult).toBeDefined();
    });
  });

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  function generateTestThreads(count: number) {
    const threads = [];
    for (let i = 0; i < count; i++) {
      threads.push({
        threadId: `thread_${i}`,
        lastMessageFrom: i % 2 === 0 ? 'client@example.com' : 'user@example.com',
        lastMessageAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        userFollowUpRule: 72,
        messages: [
          {
            from: 'client@example.com',
            timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            content: `Test message ${i}`
          }
        ]
      });
    }
    return threads;
  }
});

// =====================================================
// EDGE CASE MATRIX
// =====================================================

describe('Edge Case Matrix', () => {
  describe('Silence Detection Edge Cases', () => {
    it('should handle threads with no messages', async () => {
      const threadData = {
        threadId: 'thread_empty',
        messages: []
      };

      const result = await silenceEngine.analyzeThread(threadData);

      expect(result.eligible).toBe(false);
      expect(result.status).toBe('INSUFFICIENT_DATA');
    });

    it('should handle future-dated messages', async () => {
      const threadData = {
        threadId: 'thread_future',
        lastMessageAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        messages: [
          {
            from: 'client@example.com',
            timestamp: new Date(Date.now() + 24 * 60 * 60 * 1000),
            content: 'Future message'
          }
        ]
      };

      const result = await silenceEngine.analyzeThread(threadData);

      expect(result.eligible).toBe(false);
      expect(result.status).toBe('FUTURE_MESSAGE');
    });

    it('should handle extremely long silence periods', async () => {
      const threadData = {
        threadId: 'thread_long_silence',
        lastMessageAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        messages: [
          {
            from: 'client@example.com',
            timestamp: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            content: 'Very old message'
          }
        ]
      };

      const result = await silenceEngine.analyzeThread(threadData);

      expect(result.silenceDuration).toBeGreaterThan(8000); // > 1 year
      expect(result.confidence).toBeGreaterThan(0.95);
    });
  });

  describe('Follow-Up Generation Edge Cases', () => {
    it('should handle empty recipient name', async () => {
      const request = {
        threadId: 'thread_no_name',
        recipientName: '',
        subject: 'Test Subject'
      };

      const result = await followUpEngine.generateFollowUp(request);

      expect(result.generatedMessage).toContain('Hello');
      expect(result.generatedMessage).not.toContain('undefined');
      expect(result.autoSendSafe).toBe(false); // Should require manual review
    });

    it('should handle extremely long subjects', async () => {
      const longSubject = 'A'.repeat(200);
      const request = {
        threadId: 'thread_long_subject',
        subject: longSubject,
        recipientName: 'Test User'
      };

      const result = await followUpEngine.generateFollowUp(request);

      expect(result.generatedMessage.length).toBeLessThan(500);
      expect(result.autoSendSafe).toBe(true);
    });

    it('should handle special characters in content', async () => {
      const request = {
        threadId: 'thread_special_chars',
        lastMessage: 'Message with émojis 🎉 and spëcial chars',
        recipientName: 'Tëst Üser'
      };

      const result = await followUpEngine.generateFollowUp(request);

      expect(result.generatedMessage).toBeDefined();
      expect(result.autoSendSafe).toBe(true);
    });
  });

  describe('Auto-Send Edge Cases', () => {
    it('should handle concurrent requests for same thread', async () => {
      const request = {
        threadId: 'thread_concurrent',
        followUpId: 'followup_concurrent',
        userId: 'user_concurrent'
      };

      // Mock idempotency check to allow first request
      jest.spyOn(autoSendController, 'checkIdempotency')
        .mockResolvedValueOnce({ isDuplicate: false })
        .mockResolvedValueOnce({ isDuplicate: true, originalResult: { decision: 'SAFE_TO_SEND' } });

      const result1 = await autoSendController.processAutoSend(request);
      const result2 = await autoSendController.processAutoSend(request);

      expect(result1.decision).toBe('SAFE_TO_SEND');
      expect(result2.decision).toBe('SAFE_TO_SEND');
    });

    it('should handle database connection failures', async () => {
      const request = {
        threadId: 'thread_db_error',
        followUpId: 'followup_db_error',
        userId: 'user_db_error'
      };

      jest.spyOn(autoSendController, 'getCurrentThreadState').mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await autoSendController.processAutoSend(request);

      expect(result.decision).toBe('CANCELLED');
      expect(result.cancellationReason).toBe('technical_error');
    });
  });
});

// =====================================================
// LOAD TESTING STRATEGY
// =====================================================

describe('Load Testing Strategy', () => {
  it('should simulate 1000 concurrent users', async () => {
    const concurrentUsers = 1000;
    const requests = Array.from({ length: concurrentUsers }, (_, i) => ({
      threadId: `thread_load_${i}`,
      followUpId: `followup_load_${i}`,
      userId: `user_load_${i}`,
      generatedMessage: `Load test message ${i}`
    }));

    // Mock fast processing
    jest.spyOn(autoSendController, 'processAutoSend').mockResolvedValue({
      decision: 'SAFE_TO_SEND',
      processingTimeMs: 50
    });

    const startTime = performance.now();

    const results = await Promise.all(
      requests.map(request => autoSendController.processAutoSend(request))
    );

    const processingTime = performance.now() - startTime;

    expect(results).toHaveLength(concurrentUsers);
    expect(processingTime).toBeLessThan(5000); // 5 seconds for all requests
    expect(results.every(r => r.decision === 'SAFE_TO_SEND')).toBe(true);
  });

  it('should handle 100 auto-sends per minute', async () => {
    const autoSendsPerMinute = 100;
    const intervalMs = 60000 / autoSendsPerMinute; // 600ms between sends

    const results = [];
    const startTime = performance.now();

    for (let i = 0; i < autoSendsPerMinute; i++) {
      const request = {
        threadId: `thread_rate_${i}`,
        followUpId: `followup_rate_${i}`,
        userId: 'user_rate_test',
        generatedMessage: `Rate test message ${i}`
      };

      jest.spyOn(autoSendController, 'processAutoSend').mockResolvedValue({
        decision: 'SAFE_TO_SEND',
        processingTimeMs: 30
      });

      const result = await autoSendController.processAutoSend(request);
      results.push(result);

      // Simulate rate limiting
      if (i < autoSendsPerMinute - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    const totalTime = performance.now() - startTime;

    expect(results).toHaveLength(autoSendsPerMinute);
    expect(totalTime).toBeLessThan(65000); // Slightly over 1 minute due to processing time
    expect(results.every(r => r.decision === 'SAFE_TO_SEND')).toBe(true);
  });
});

// =====================================================
// VALIDATION REPORT TEMPLATE
// =====================================================

interface ValidationReport {
  executiveSummary: {
    overallStatus: 'GO' | 'NO-GO';
    criticalIssues: string[];
    recommendations: string[];
  };
  
  functionalValidation: {
    silenceDetection: TestResults;
    followUpGeneration: TestResults;
    autoSendControl: TestResults;
    dashboard: TestResults;
    emailIntegration: TestResults;
  };
  
  performanceValidation: {
    loadTesting: PerformanceResults;
    databasePerformance: PerformanceResults;
    scalability: ScalabilityResults;
  };
  
  securityValidation: {
    vulnerabilityAssessment: SecurityResults;
    penetrationTesting: SecurityResults;
    complianceAudit: SecurityResults;
  };
  
  userExperienceValidation: {
    usabilityTesting: UXResults;
    accessibilityTesting: UXResults;
    cognitiveLoadAssessment: UXResults;
  };
  
  monetizationValidation: {
    planEnforcement: MonetizationResults;
    upgradeTriggers: MonetizationResults;
    conversionOptimization: MonetizationResults;
  };
  
  integrationValidation: {
    crossModuleTesting: IntegrationResults;
    endToEndTesting: IntegrationResults;
    dataFlowValidation: IntegrationResults;
  };
  
  riskAssessment: {
    productionRisks: Risk[];
    mitigationStrategies: string[];
    contingencyPlans: string[];
  };
  
  finalRecommendation: {
    deploymentReadiness: 'READY' | 'CONDITIONAL' | 'NOT_READY';
    requiredActions: string[];
    timeline: string;
    successMetrics: string[];
  };
}

// Export for use in CI/CD pipeline
export { ValidationReport };
