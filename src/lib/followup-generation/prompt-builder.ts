import { PromptContext, ConversationType, RelationshipStage, TonePreference, TimeDelayCategory } from './types';

export class PromptBuilder {
  private readonly systemPrompts: Record<string, string> = {
    default: `You are a professional follow-up message generator. Create concise, specific, human-sounding follow-up emails that feel written by a real person.

Key principles:
- Reference specific context from the conversation
- Avoid generic phrases like "just checking in"
- Keep under 120 words
- Include a clear but soft call-to-action
- Sound natural, not robotic or desperate
- Match the specified tone perfectly
- Be specific about what you're following up on

Focus on being helpful and moving the conversation forward naturally.`,

    proposal: `You are generating a follow-up for a business proposal. Focus on:

- The specific proposal details
- Next steps for review or approval
- Value proposition reminder
- Clear call-to-action for decision
- Professional but approachable tone

Avoid being pushy about the sale. Focus on helping them make an informed decision.`,

    sales_pitch: `You are following up on a sales presentation or pitch. Focus on:

- Specific product/service discussed
- Key benefits relevant to their needs
- Next steps for evaluation
- Clear but not pushy call-to-action
- Confident but not aggressive tone

Show enthusiasm for helping them solve their problem.`,

    meeting_scheduling: `You are following up on meeting scheduling. Focus on:

- Specific meeting purpose discussed
- Proposed time options or availability
- Clear next steps for scheduling
- Efficient and professional tone
- Making it easy to coordinate

Be direct about scheduling logistics.`,

    interview: `You are following up on an interview process. Focus on:

- Specific interview stage discussed
- Next steps in the process
- Timeline expectations
- Professional and respectful tone
- Clear communication about process

Maintain professionalism while being approachable.`,

    invoice_payment: `You are following up on an invoice or payment. Focus on:

- Specific invoice details (number, amount)
- Due date and any late fees
- Clear payment instructions
- Professional but firm tone
- Easy payment process information

Be direct about payment expectations while maintaining relationship.`,

    partnership: `You are following up on a partnership discussion. Focus on:

- Specific partnership opportunity discussed
- Mutual benefits and value
- Next steps for exploration
- Collaborative and enthusiastic tone
- Long-term relationship building

Show genuine interest in mutual success.`,

    client_onboarding: `You are following up on client onboarding. Focus on:

- Specific onboarding steps discussed
- Support and resources available
- Timeline for completion
- Helpful and encouraging tone
- Making them feel supported

Focus on their success and comfort with the process.`,

    support_resolution: `You are following up on a support issue. Focus on:

- Specific issue or problem discussed
- Resolution steps taken or needed
- Current status and next steps
- Helpful and reassuring tone
- Clear communication about timeline

Show commitment to solving their problem.`,

    followup_reminder: `You are providing a gentle reminder follow-up. Focus on:

- Specific item needing attention
- Why it matters to them
- Clear but gentle call-to-action
- Respectful of their time
- Moving conversation forward

Be helpful without being pushy.`
  };

  /**
   * Builds the complete AI prompt with structured context
   */
  buildPrompt(context: PromptContext): string {
    const systemPrompt = this.getSystemPrompt(context.conversationType);
    const contextSection = this.buildContextSection(context);
    const instructionSection = this.buildInstructionSection(context);
    const constraintsSection = this.buildConstraintsSection(context);

    return `${systemPrompt}

${contextSection}

${instructionSection}

${constraintsSection}`;
  }

  /**
   * Gets the appropriate system prompt for conversation type
   */
  private getSystemPrompt(conversationType: ConversationType): string {
    return this.systemPrompts[conversationType] || this.systemPrompts.default;
  }

  /**
   * Builds the context section of the prompt
   */
  private buildContextSection(context: PromptContext): string {
    return `CONTEXT:
Conversation Type: ${this.formatConversationType(context.conversationType)}
Relationship Stage: ${this.formatRelationshipStage(context.relationshipStage)}
Time Since Last Message: ${context.timeSinceLastMessage} days (${context.timeDelayCategory})
Tone Preference: ${this.formatTonePreference(context.tonePreference)}

Thread Summary:
${context.threadSummary}

Last User Message:
${context.lastUserMessage}

Last Recipient Message:
${context.lastRecipientMessage}`;
  }

  /**
   * Builds the instruction section of the prompt
   */
  private buildInstructionSection(context: PromptContext): string {
    const instructions = [
      'Generate a concise, specific, human-sounding follow-up.',
      'Avoid generic phrases like "just checking in", "bumping this", or "following up on the below".',
      'Reference specific context from the conversation.',
      `Keep under ${context.maxWords} words.`,
      'Include a clear but soft call-to-action.',
      'Sound like a real person wrote this, not an AI.'
    ];

    if (context.includeCallToAction) {
      instructions.push('End with a specific next step or question.');
    }

    if (context.customInstructions) {
      instructions.push(`Additional: ${context.customInstructions}`);
    }

    return `INSTRUCTION:
${instructions.join('. ')}.`;
  }

  /**
   * Builds the constraints section of the prompt
   */
  private buildConstraintsSection(context: PromptContext): string {
    const constraints = [
      'DO NOT use these phrases: "just checking in", "bumping this up", "following up on the below", "any updates?", "kind reminder"',
      'DO NOT sound desperate, pushy, or demanding',
      'DO NOT repeat the entire conversation summary',
      'DO NOT over-explain or be verbose',
      'DO NOT use excessive exclamation points or emojis',
      'DO NOT apologize for following up'
    ];

    // Add tone-specific constraints
    const toneConstraints = this.getToneConstraints(context.tonePreference);
    constraints.push(...toneConstraints);

    // Add time-delay specific constraints
    const timeConstraints = this.getTimeDelayConstraints(context.timeDelayCategory);
    constraints.push(...timeConstraints);

    return `CONSTRAINTS:
${constraints.join('. ')}.`;
  }

  /**
   * Gets tone-specific constraints
   */
  private getToneConstraints(tone: TonePreference): string[] {
    const constraints: Record<TonePreference, string[]> = {
      professional: [
        'Use formal language and proper grammar',
        'Avoid slang, contractions, or overly casual expressions',
        'Maintain respectful and courteous tone'
      ],
      friendly: [
        'Use warm, approachable language',
        'Can include light, appropriate personal touches',
        'Balance friendliness with professionalism'
      ],
      assertive: [
        'Be direct and confident',
        'Use clear, unambiguous language',
        'Maintain professional respect while being direct'
      ],
      polite: [
        'Use courteous and respectful language',
        'Include polite expressions and softeners',
        'Avoid overly direct or demanding language'
      ],
      direct: [
        'Be straightforward and to the point',
        'Use clear, concise language',
        'Avoid unnecessary pleasantries'
      ],
      concise: [
        'Keep sentences short and focused',
        'Eliminate unnecessary words',
        'Focus only on essential information'
      ]
    };

    return constraints[tone] || [];
  }

  /**
   * Gets time-delay specific constraints
   */
  private getTimeDelayConstraints(category: TimeDelayCategory): string[] {
    const constraints: Record<TimeDelayCategory, string[]> = {
      light_nudge: [
        'Keep message very brief and light',
        'Low pressure, gentle reminder only',
        'Assume they may have just missed the message'
      ],
      gentle_followup: [
        'Standard follow-up with clear purpose',
        'Moderate pressure with clear value',
        'Assume they may need a reminder'
      ],
      stronger_clarity: [
        'Be more direct about next steps',
        'Include clear call-to-action',
        'Assume they may need stronger prompting'
      ],
      re_engagement: [
        'Re-establish value and context',
        'Include fresh perspective or new information',
        'Assume they may have lost interest or focus'
      ]
    };

    return constraints[category] || [];
  }

  /**
   * Formats conversation type for display
   */
  private formatConversationType(type: ConversationType): string {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  /**
   * Formats relationship stage for display
   */
  private formatRelationshipStage(stage: RelationshipStage): string {
    return stage.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  /**
   * Formats tone preference for display
   */
  private formatTonePreference(tone: TonePreference): string {
    return tone.charAt(0).toUpperCase() + tone.slice(1);
  }

  /**
   * Builds a simplified prompt for quick generation
   */
  buildSimplePrompt(context: PromptContext): string {
    return `Generate a ${context.tonePreference} follow-up for a ${context.conversationType} conversation.

Context: ${context.threadSummary}

Last message was ${context.timeSinceLastMessage} days ago.

${context.lastUserMessage}

${context.lastRecipientMessage}

Requirements:
- Under ${context.maxWords} words
- Specific and contextual
- No generic phrases
- Clear call-to-action
- Human-sounding tone`;
  }

  /**
   * Builds a prompt for regeneration with feedback
   */
  buildRegenerationPrompt(
    originalContext: PromptContext,
    previousOutput: string,
    feedback: string
  ): string {
    const basePrompt = this.buildPrompt(originalContext);
    
    return `${basePrompt}

PREVIOUS ATTEMPT:
${previousOutput}

FEEDBACK:
${feedback}

IMPROVEMENT INSTRUCTION:
Based on the feedback, regenerate the follow-up addressing the specific issues mentioned. Focus on the areas that need improvement while maintaining all other requirements.`;
  }

  /**
   * Builds a prompt for quality evaluation
   */
  buildQualityPrompt(generatedText: string, context: PromptContext): string {
    return `Evaluate the quality of this follow-up message:

Generated Message:
${generatedText}

Context:
- Conversation Type: ${context.conversationType}
- Relationship Stage: ${context.relationshipStage}
- Time Delay: ${context.timeSinceLastMessage} days
- Tone: ${context.tonePreference}

Rate the message on these criteria (1-10):
1. Specificity: How specific and contextual is the message?
2. Human Likeness: How natural and human-like does it sound?
3. Tone Appropriateness: How well does it match the required tone?
4. Call-to-Action Clarity: How clear is the next step?
5. Overall Quality: Overall effectiveness of the follow-up

Also identify:
- Generic phrases used (if any)
- Areas for improvement
- Whether it's safe for auto-send

Provide a detailed evaluation with specific scores and reasoning.`;
  }

  /**
   * Builds a batch prompt for multiple follow-ups
   */
  buildBatchPrompt(contexts: PromptContext[]): string {
    const contextList = contexts.map((ctx, index) => 
      `FOLLOW-UP ${index + 1}:
${this.buildContextSection(ctx)}`
    ).join('\n\n');

    return `${this.systemPrompts.default}

${contextList}

INSTRUCTION:
Generate ${contexts.length} follow-up messages, one for each context above.
Each message should:
- Be specific to its context
- Match the specified tone
- Stay under the word limit
- Include appropriate call-to-action
- Sound human-written

Format your response as:
Follow-up 1: [message]
Follow-up 2: [message]
...etc`;
  }

  /**
   * Validates prompt completeness
   */
  validatePrompt(context: PromptContext): {
    isValid: boolean;
    missingFields: string[];
    warnings: string[];
  } {
    const missingFields: string[] = [];
    const warnings: string[] = [];

    if (!context.conversationType) missingFields.push('conversationType');
    if (!context.relationshipStage) missingFields.push('relationshipStage');
    if (!context.threadSummary) missingFields.push('threadSummary');
    if (!context.lastUserMessage) missingFields.push('lastUserMessage');
    if (!context.lastRecipientMessage) missingFields.push('lastRecipientMessage');
    if (!context.tonePreference) missingFields.push('tonePreference');

    if (context.timeSinceLastMessage < 0) {
      warnings.push('Invalid time delay (negative value)');
    }

    if (context.maxWords < 20 || context.maxWords > 200) {
      warnings.push('Unusual word count limit - consider adjusting');
    }

    if (context.threadSummary.length > 500) {
      warnings.push('Thread summary is very long - may impact AI focus');
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
      warnings
    };
  }

  /**
   * Gets prompt statistics for debugging
   */
  getPromptStats(context: PromptContext): {
    totalLength: number;
    contextLength: number;
    instructionCount: number;
    constraintCount: number;
    complexityScore: number;
  } {
    const prompt = this.buildPrompt(context);
    const contextSection = this.buildContextSection(context);
    const instructionSection = this.buildInstructionSection(context);
    const constraintsSection = this.buildConstraintsSection(context);

    return {
      totalLength: prompt.length,
      contextLength: contextSection.length,
      instructionCount: instructionSection.split('.').length,
      constraintCount: constraintsSection.split('.').length,
      complexityScore: this.calculateComplexityScore(context)
    };
  }

  /**
   * Calculates prompt complexity score
   */
  private calculateComplexityScore(context: PromptContext): number {
    let score = 0;

    // Base complexity
    score += 1;

    // Context complexity
    score += context.threadSummary.split('.').length * 0.1;
    score += context.lastUserMessage.length / 100 * 0.1;
    score += context.lastRecipientMessage.length / 100 * 0.1;

    // Time delay complexity
    if (context.timeSinceLastMessage > 10) score += 0.5;
    if (context.timeSinceLastMessage > 30) score += 0.5;

    // Custom instructions
    if (context.customInstructions) score += 0.3;

    return Math.min(5, score); // Cap at 5
  }
}
