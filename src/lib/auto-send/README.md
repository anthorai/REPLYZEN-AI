# Auto-Send Control System

**Highest-risk layer. Safety-first architecture.**

This system controls whether an AI-generated follow-up is actually sent. It implements comprehensive validation, spam risk analysis, and compliance logging to ensure safe automated email sending.

## Core Safety Philosophy

**Trust > Speed**
**Safety > Automation**
**Manual Review > Risk**

## Architecture Overview

### 7-Step Pre-Send Validation Pipeline

#### STEP 1 — Re-Fetch Latest Thread State
- Pulls latest thread data from email provider
- Gets latest message timestamp and sender
- Prevents stale data issues

#### STEP 2 — Re-Confirm Last Sender
- If last_sender == user: CANCEL SEND
- Prevents sending after recipient reply
- User already replied → no follow-up needed

#### STEP 3 — Re-Validate Silence Duration
- Recalculates silence_duration = current_time - last_message_timestamp
- If silence_duration < user_follow_up_rule: CANCEL SEND
- Ensures timing is still appropriate

#### STEP 4 — Spam Risk Analysis
- Multi-factor risk scoring (0-100)
- Frequency, content, timing, recipient pattern analysis
- If spam_risk_score > threshold: CANCEL SEND

#### STEP 5 — Daily Sending Limit Enforcement
- Free Plan: auto-send disabled
- Pro Plan: enforce daily_send_limit (default 50/day)
- If daily_sent_count >= limit: CANCEL SEND

#### STEP 6 — Sentiment & Risk Guard
- Detects legal disputes, refund escalations, angry sentiment
- "Do not contact" language detection
- High-risk conversations → CANCEL SEND

#### STEP 7 — Final Pre-Send Confirmation
- All checks pass → SAFE_TO_SEND
- Proceed with email provider API
- Immediate send event logging

## Key Components

### PreSendValidator
Executes the complete 7-step validation pipeline:
```typescript
const result = await validator.validate({
  threadId: 'thread_123',
  userId: 'user_456',
  generatedMessage: 'Hi Sarah, following up...',
  // ... other required fields
});
```

### IdempotencyManager
Prevents duplicate sends:
```typescript
const idempotencyKey = manager.generateIdempotencyKey(request);
const { isDuplicate } = await manager.checkDuplicate(request);
```

### QueueWorker
Processes auto-send requests with retry logic:
```typescript
const result = await worker.processRequest(request);
```

### AuditLogger
Comprehensive audit trail for compliance:
```typescript
await logger.logEvent({
  threadId: 'thread_123',
  eventType: 'send_success',
  decision: 'SAFE_TO_SEND',
  // ... other fields
});
```

### EmailProviderService
Multi-provider email sending with fallback:
```typescript
const response = await emailProvider.sendEmail({
  to: 'recipient@example.com',
  subject: 'Following up',
  body: 'Hi Sarah...',
  threadId: 'thread_123',
  userId: 'user_456'
});
```

## Spam Risk Analysis

### Risk Factors (0-100 points each)
- **High Frequency**: Too many follow-ups recently
- **Repetitive Content**: Generic or duplicate messages
- **Short Generic Message**: < 50 characters
- **Multiple Recipients**: Bulk sending patterns
- **Unusual Timing**: Off-hours or very recent replies
- **Spam Keywords**: "free", "offer", "urgent", etc.
- **Low Engagement History**: Poor response rates
- **New Recipient Pattern**: No established relationship

### Risk Scoring Formula
```
overall_score = Σ(risk_factor_scores)
threshold = 75

if overall_score > threshold:
    → CANCEL SEND
    → Reason: High spam risk
```

## Daily Limits & Monetization

### Plan-Based Limits
- **Free Plan**: auto-send disabled
- **Pro Plan**: 50/day default
- **Enterprise Plan**: 1000/day

### Upgrade Triggers
```typescript
if (plan === 'free') {
  return "Upgrade to Pro to enable safe auto-send";
}

if (dailyCount >= limit) {
  return "Upgrade to Enterprise for higher sending limits";
}
```

## Idempotency Strategy

### Key Generation
```typescript
idempotency_key = thread_id + follow_up_sequence + timestamp_bucket
```

### Duplicate Detection
- Check database for existing key
- 24-hour idempotency window
- Abort on duplicate detection

### Conflict Prevention
- Recent thread attempts check
- High-frequency user detection
- Rate limiting enforcement

## Queue Processing

### Worker Configuration
```typescript
const config = {
  maxRetryAttempts: 3,
  retryDelayMs: 5000,
  processingTimeoutMs: 150000,
  batchSize: 10,
  rateLimitPerSecond: 10
};
```

### Retry Logic
- Exponential backoff with jitter
- Retryable error classification
- Max attempt enforcement
- Next retry scheduling

## Audit & Compliance

### Event Types Logged
- `pre_send_validation`
- `send_attempt`
- `send_success`
- `send_failed`
- `cancellation`

### Data Stored
```typescript
{
  threadId,
  followUpId,
  userId,
  decision,
  cancellationReason,
  validationSnapshot,
  processingTimeMs,
  timestamp,
  metadata
}
```

### Compliance Reporting
- Daily/monthly activity reports
- Cancellation reason breakdown
- Spam risk trend analysis
- Plan usage statistics

## Safety Rules

### Auto-Send Cancellation Rules
1. **User replied** → CANCEL
2. **Silence window invalid** → CANCEL
3. **Spam risk high** → CANCEL
4. **Daily limit reached** → CANCEL
5. **Plan doesn't support** → CANCEL
6. **Sensitive conversation** → CANCEL
7. **Technical error** → RETRY or CANCEL

### User Insights
```typescript
// Sent
"Follow-up sent after 4 days of inactivity."

// Cancelled
"Cancelled: recipient replied 2 hours ago."
"Cancelled: daily sending limit reached."
"Cancelled: silence window no longer valid."
"Cancelled: spam risk detected."
```

## Performance Targets

- **Processing time**: < 150ms per thread
- **Queue depth**: < 100 jobs
- **Success rate**: > 85%
- **Error rate**: < 5%
- **Retry rate**: < 15%

## Monitoring & Alerting

### Key Metrics
- Total processed per hour
- Success/failure rates
- Average processing time
- Spam risk distribution
- Cancellation reasons
- Queue depth

### Health Checks
- Database connectivity
- Email provider health
- Queue processing status
- Rate limit compliance

## Error Handling

### Retryable Errors
- `RATE_LIMIT`
- `TEMPORARY_FAILURE`
- `NETWORK_ERROR`

### Non-Retryable Errors
- `SPAM_RISK_HIGH`
- `DAILY_LIMIT_REACHED`
- `PLAN_LIMIT_REACHED`
- `IDEMPOTENCY_DUPLICATE`

### Fallback Strategy
- Alternative email providers
- Manual review escalation
- User notification system

## Database Schema

### Core Tables
- `auto_send_attempts` - Main attempt tracking
- `auto_send_safety_log` - Compliance logging
- `daily_send_limits` - Usage tracking
- `spam_risk_cache` - Performance optimization
- `sentiment_risk_log` - Risk monitoring
- `auto_send_metrics` - Analytics
- `auto_send_queue` - Job processing
- `rate_limits` - Rate limiting

### Indexes for Performance
- Thread/user lookups
- Decision/date queries
- Idempotency key searches
- Retry scheduling

## Security Considerations

### Data Protection
- User data isolation via RLS
- Sensitive content encryption
- Audit log retention policies
- GDPR compliance measures

### Access Control
- User-based permissions
- Plan-based feature gating
- Admin override capabilities
- Audit trail integrity

## Usage Examples

### Basic Auto-Send
```typescript
import { createAutoSendSystem } from '@/lib/auto-send';

const autoSend = createAutoSendSystem();

const result = await autoSend.controller.processAutoSend({
  threadId: 'thread_123',
  followUpId: 'followup_456',
  userId: 'user_789',
  generatedMessage: 'Hi Sarah, following up...',
  originalSilenceDuration: 96, // hours
  userFollowUpRule: 72, // hours
  plan: 'pro',
  dailySendLimit: 50,
  idempotencyKey: 'auto_key_123',
  priority: 'medium',
  scheduledAt: new Date()
});
```

### Batch Processing
```typescript
const results = await autoSend.controller.processBatchAutoSend([
  request1,
  request2,
  request3
]);
```

### User Statistics
```typescript
const stats = await autoSend.controller.getUserStats('user_789');
console.log(`Success rate: ${stats.successfulSends / stats.totalAttempts}`);
```

### Health Monitoring
```typescript
const health = await autoSend.controller.healthCheck();
if (health.status === 'unhealthy') {
  // Alert administrators
}
```

## Integration Points

### Follow-Up Generation Engine
- Receives generated follow-ups
- Validates before sending
- Returns send status

### Email Providers
- Gmail API integration
- Outlook/Graph API
- SendGrid for bulk sending
- AWS SES for enterprise

### User Settings
- Plan configuration
- Daily limit preferences
- Auto-send enable/disable

### Analytics System
- Performance metrics
- User behavior tracking
- Conversion rate analysis

## Future Enhancements

### Advanced Features
- Machine learning risk assessment
- Predictive engagement scoring
- Dynamic limit adjustment
- Real-time content analysis

### Performance Optimizations
- Distributed queue processing
- Database sharding
- Caching layers
- Edge processing

### Compliance Enhancements
- Advanced sentiment analysis
- Legal content detection
- Automated compliance reporting
- Audit trail verification

## Support & Troubleshooting

### Common Issues
1. **High spam risk scores** - Review content quality
2. **Daily limit reached** - Check plan limits
3. **Idempotency conflicts** - Verify key generation
4. **Queue processing delays** - Monitor worker health
5. **Email provider failures** - Check provider status

### Debug Information
- Full audit trail available
- Validation snapshots stored
- Error logs with context
- Performance metrics tracked

### Escalation Process
1. Check health status
2. Review recent audit logs
3. Verify rate limit compliance
4. Check email provider status
5. Escalate to engineering team

---

**Remember: This is the highest-risk layer. Every safety check exists for a reason. Never bypass validation for convenience. Trust is our most valuable asset.**
