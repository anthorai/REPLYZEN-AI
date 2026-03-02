# Context-Aware AI Follow-Up Generation Engine

A production-grade follow-up generation system that creates human-level, context-aware, specific follow-ups that feel written manually.

## Overview

This is NOT a template engine. This is NOT a "just checking in" generator.

The engine generates human-level, specific follow-ups that:
- Understand conversation context
- Identify intent (proposal, meeting, invoice, interview, etc.)
- Detect relationship stage
- Adapt to time delay
- Respect tone preference
- Produce concise, specific, human-like follow-ups
- Avoid generic phrases

**Specific > Generic**
**Contextual > Template**
**Human > Robotic**

## Core Architecture

### 1. Message Extraction Pipeline

**Step 1 — Extract Relevant Messages**
- Extracts last 3 relevant human messages
- Excludes signatures and quoted chains
- Removes automated text and HTML noise
- Validates message quality

### 2. Thread Summarization

**Step 2 — Generate Thread Summary**
- Creates 3-5 line structured summary
- Identifies topic, pending action, waiting status
- Extracts deadlines and key points
- Builds context for AI generation

### 3. Conversation Classification

**Step 3 — Classify Conversation Type**
- Rule-based classification with confidence scoring
- Types: proposal, sales_pitch, meeting_scheduling, interview, invoice_payment, partnership, client_onboarding, support_resolution, followup_reminder, general_conversation
- Relationship stages: cold_lead, warm_lead, active_client, past_client, recruiter, vendor, internal_team

### 4. Time Delay Analysis

**Step 4 — Measure Time Delay**
- Calculates days since last message
- Categorizes: light_nudge (1-2 days), gentle_followup (3-5 days), stronger_clarity (6-10 days), re_engagement (10+ days)
- Adapts tone strength based on delay

### 5. Tone Adaptation

**Step 5 — Apply Tone Preference**
- Professional, Friendly, Assertive, Polite, Direct, Concise
- Influences greeting, sentence structure, call-to-action
- Adjusts based on conversation type and relationship stage

### 6. AI Prompt Building

**Step 6 — Structured AI Input**
- Sends structured JSON-style context to AI
- Includes conversation type, relationship stage, time delay
- Provides thread summary and last messages
- Specific instructions and constraints

### 7. Quality Filtering

**Step 7 — Anti-Generic Filter**
- Rejects generic phrases: "just checking in", "bumping this up"
- Detects negative sentiment and urgent language
- Validates specificity and human likeness
- Determines auto-send safety

### 8. Confidence Scoring

**Step 8 — Confidence Calculation**
- Context clarity (25%)
- Classification certainty (20%)
- Time delay clarity (15%)
- Output specificity (20%)
- Safety compliance (15%)
- Human likeness (5%)

## Usage

### Basic Usage

```typescript
import { createFollowUpGenerationSystem } from '@/lib/followup-generation';

const followUpSystem = createFollowUpGenerationSystem();

// Generate a follow-up
const result = await followUpSystem.engine.generateFollowUp({
  threadId: 'thread_123',
  userId: 'user_456',
  context: {
    conversationType: 'proposal',
    relationshipStage: 'warm_lead',
    timeSinceLastMessage: 4,
    timeDelayCategory: 'gentle_followup',
    tonePreference: 'professional',
    threadSummary: 'Proposal discussion for ACME Corp project',
    lastUserMessage: 'Sent proposal last Thursday',
    lastRecipientMessage: 'Received proposal, will review',
    participantNames: { user: 'John', recipient: 'Sarah' }
  },
  tonePreference: 'professional',
  maxWords: 120,
  includeCallToAction: true,
  priority: 'medium'
});
```

### Batch Generation

```typescript
// Process multiple threads
const batchResult = await followUpSystem.engine.generateBatch({
  userId: 'user_456',
  threadIds: ['thread_1', 'thread_2', 'thread_3'],
  tonePreference: 'professional',
  priority: 'medium',
  batchSize: 10,
  enableAutoSend: true
});
```

### Regeneration with Feedback

```typescript
// Regenerate with feedback
const regenerated = await followUpSystem.engine.regenerateFollowUp(
  originalResult,
  'Make it more specific about the proposal details'
);
```

## Output Examples

### Bad Output (REJECTED)
```
"Just checking in to see if you had a chance to review."
```

### Good Output (ACCEPTED)
```
"Hi Sarah, I wanted to gently follow up regarding the proposal shared last Thursday. Please let me know if you'd like any clarification or if we can schedule a quick call to discuss next steps."
```

## Quality Standards

### Must Include:
- ✅ Specific context reference
- ✅ Human-like tone
- ✅ Clear call-to-action
- ✅ Appropriate length (under 120 words)
- ✅ No generic phrases

### Must Avoid:
- ❌ "Just checking in"
- ❌ "Bumping this up"
- ❌ "Following up on the below"
- ❌ "Any updates?"
- ❌ "Kind reminder"

## Confidence Scoring

### Auto-Send Requirements:
- **Minimum confidence**: 85%
- **No safety issues**: No generic phrases, negative sentiment, or urgent language
- **Quality thresholds**: Specificity >70%, Contextuality >75%, Human likeness >80%

### Confidence Factors:
- **Context clarity**: Thread summary quality and message content
- **Classification certainty**: Confidence in conversation type and relationship stage
- **Time delay clarity**: Appropriateness of timing for follow-up
- **Output specificity**: How specific and contextual the generated text is
- **Safety compliance**: Absence of flagged content
- **Human likeness**: Natural language patterns

## Database Schema

The system includes comprehensive database tables:

- **followup_generations**: Main generation results with metadata
- **conversation_context_cache**: Performance optimization for context
- **generation_prompts**: Prompt templates and optimization
- **generation_feedback**: User feedback for continuous improvement
- **regeneration_attempts**: Track regeneration history
- **auto_send_safety_log**: Compliance and safety tracking
- **generation_performance_metrics**: Analytics and reporting

## Performance Targets

- **Generation time**: < 2 seconds per follow-up
- **Quality threshold**: 70% minimum for manual send, 85% for auto-send
- **Specificity score**: >70% for acceptable quality
- **Human likeness**: >80% for natural feel
- **Batch processing**: 50+ threads per batch

## Safety Features

### Auto-Send Protection:
- Generic phrase detection
- Negative sentiment filtering
- Urgent language blocking
- Legal risk identification
- Confidence threshold enforcement

### Compliance Logging:
- Every auto-send logged with safety checks
- Performance metrics tracking
- User feedback collection
- Error monitoring and alerting

## Monetization Integration

### Free Plan:
- Manual generation only
- Limited regenerations (3 per thread)
- Basic quality filtering

### Pro Plan:
- Auto-generate + auto-send
- Tone customization
- Advanced classification
- Re-engagement sequences
- Unlimited regenerations

### Enterprise Plan:
- All Pro features
- API access
- Priority processing
- Advanced analytics
- Custom prompt templates

## Monitoring & Analytics

### Key Metrics:
- **Generation success rate**: % of successful generations
- **Auto-send rate**: % of generations auto-sent
- **Quality distribution**: Breakdown by quality scores
- **Conversion rate**: % leading to responses
- **User satisfaction**: Feedback ratings

### Quality Trends:
- Conversation type performance
- Relationship stage effectiveness
- Time delay optimization
- Tone preference success rates

## Error Handling

### Generation Errors:
- Invalid context data
- AI service failures
- Quality threshold failures
- Safety check failures

### Recovery Strategies:
- Automatic regeneration with adjusted prompts
- Fallback to manual review
- Error logging and alerting
- User notification system

## Future Enhancements

### Planned Features:
- Machine learning for pattern recognition
- Sentiment analysis integration
- Multi-language support
- Custom tone training
- Advanced personalization

### Optimization Areas:
- Prompt template optimization
- Context caching improvements
- Batch processing efficiency
- Real-time quality feedback

## Support

For issues or questions about the follow-up generation engine:

1. Check generation logs for error details
2. Review quality metrics and safety checks
3. Validate context data completeness
4. Monitor confidence scores and thresholds
5. Test with sample conversation data

## Architecture Benefits

### Production-Ready:
- Comprehensive error handling
- Performance optimization
- Safety compliance
- Scalable design

### User Experience:
- Human-like output quality
- Contextual relevance
- Tone adaptation
- Reliable auto-send

### Business Impact:
- Increased user retention
- Higher engagement rates
- Reduced manual effort
- Improved conversion rates
