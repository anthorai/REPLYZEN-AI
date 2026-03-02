// =========================================================
// REPLIFY AI - Input Sanitization Module
// Section 8: AI Prompt Sanitization
// =========================================================

// HTML tag stripping regex
const HTML_TAG_REGEX = /<[^>]*>/g;

// Script tag and content removal
const SCRIPT_REGEX = /<script[^>]*>[\s\S]*?<\/script>/gi;

// Event handler attributes
const EVENT_HANDLER_REGEX = /\s*on\w+\s*=\s*["'][^"']*["']/gi;

// Angle bracket content (potential injection)
const ANGLE_BRACKET_REGEX = /[<>]/g;

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /((\%27)|(\'))union/i,
  /exec(\s|\+)+(s|x)p\w+/i,
  /UNION\s+SELECT/i,
  /INSERT\s+INTO/i,
  /DELETE\s+FROM/i,
  /DROP\s+TABLE/i
];

export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  threatsDetected: string[];
}

export class InputSanitizer {
  static sanitizeForPrompt(input: string): SanitizationResult {
    if (!input || typeof input !== "string") {
      return { sanitized: "", wasModified: false, threatsDetected: [] };
    }

    const threatsDetected: string[] = [];
    let sanitized = input;
    let wasModified = false;

    // Check for script tags
    if (SCRIPT_REGEX.test(sanitized)) {
      threatsDetected.push("script_tag");
      sanitized = sanitized.replace(SCRIPT_REGEX, "");
      wasModified = true;
    }

    // Check for event handlers
    if (EVENT_HANDLER_REGEX.test(sanitized)) {
      threatsDetected.push("event_handler");
      sanitized = sanitized.replace(EVENT_HANDLER_REGEX, "");
      wasModified = true;
    }

    // Strip remaining HTML tags
    if (HTML_TAG_REGEX.test(sanitized)) {
      threatsDetected.push("html_tag");
      sanitized = sanitized.replace(HTML_TAG_REGEX, "");
      wasModified = true;
    }

    // Remove angle brackets
    if (ANGLE_BRACKET_REGEX.test(sanitized)) {
      threatsDetected.push("angle_bracket");
      sanitized = sanitized.replace(ANGLE_BRACKET_REGEX, "");
      wasModified = true;
    }

    // Check for SQL injection patterns
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        threatsDetected.push("sql_injection_pattern");
        // Remove the matched pattern
        sanitized = sanitized.replace(pattern, "");
        wasModified = true;
      }
    }

    // Normalize whitespace
    const normalized = sanitized.replace(/\s+/g, " ").trim();
    if (normalized !== sanitized) {
      wasModified = true;
      sanitized = normalized;
    }

    // Limit length to prevent prompt overflow attacks
    const MAX_LENGTH = 10000;
    if (sanitized.length > MAX_LENGTH) {
      threatsDetected.push("length_exceeded");
      sanitized = sanitized.substring(0, MAX_LENGTH);
      wasModified = true;
    }

    return { sanitized, wasModified, threatsDetected };
  }

  static sanitizeEmailSubject(subject: string): SanitizationResult {
    return this.sanitizeForPrompt(subject);
  }

  static sanitizeEmailBody(body: string): SanitizationResult {
    return this.sanitizeForPrompt(body);
  }

  static sanitizeThreadContext(context: {
    subject: string;
    lastMessage?: string;
    recipientName?: string;
  }): { subject: string; lastMessage: string; recipientName: string; threats: string[] } {
    const subjectResult = this.sanitizeEmailSubject(context.subject);
    const messageResult = context.lastMessage 
      ? this.sanitizeEmailBody(context.lastMessage)
      : { sanitized: "", wasModified: false, threatsDetected: [] };
    const recipientResult = context.recipientName
      ? this.sanitizeForPrompt(context.recipientName)
      : { sanitized: "", wasModified: false, threatsDetected: [] };

    const allThreats = [
      ...subjectResult.threatsDetected,
      ...messageResult.threatsDetected,
      ...recipientResult.threatsDetected
    ];

    return {
      subject: subjectResult.sanitized,
      lastMessage: messageResult.sanitized,
      recipientName: recipientResult.sanitized,
      threats: [...new Set(allThreats)]
    };
  }

  static createSafePrompt(params: {
    subject: string;
    days: number;
    tone: string;
    lastMessage?: string;
    recipientName?: string;
  }): { prompt: string; wasSanitized: boolean; threats: string[] } {
    const sanitized = this.sanitizeThreadContext({
      subject: params.subject,
      lastMessage: params.lastMessage,
      recipientName: params.recipientName
    });

    const hasThreats = sanitized.threats.length > 0;

    const prompt = `You are an email writing assistant for Replify AI. Write a short, natural follow-up email.

CONTEXT:
- Subject: "${sanitized.subject}"
- Last sent by user: ${params.days} days ago
- Recipient hasn't replied
- Tone: ${params.tone}
${sanitized.recipientName ? `- Recipient: ${sanitized.recipientName}` : ""}
${sanitized.lastMessage ? `- Previous message excerpt: "${sanitized.lastMessage.substring(0, 200)}"` : ""}

REQUIREMENTS:
1. Keep it brief (2-3 sentences max)
2. Be polite but direct
3. Reference the original subject naturally
4. Don't be pushy or apologetic
5. End with a clear question or call to action

Write only the email body text. No subject line, no signatures.`;

    return {
      prompt,
      wasSanitized: hasThreats,
      threats: sanitized.threats
    };
  }
}

// Escape special regex characters
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate UUID format
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
