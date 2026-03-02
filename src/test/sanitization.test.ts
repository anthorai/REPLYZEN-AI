// =========================================================
// REPLIFY AI - Input Sanitization Unit Tests
// Section 14: Test Coverage
// =========================================================

import { describe, it, expect } from "vitest";

// Sanitization functions (mirroring the edge function implementation)
function sanitizeForPrompt(input: string): { sanitized: string; wasModified: boolean; threatsDetected: string[] } {
  if (!input || typeof input !== "string") {
    return { sanitized: "", wasModified: false, threatsDetected: [] };
  }

  const threatsDetected: string[] = [];
  let sanitized = input;
  let wasModified = false;

  // Check for script tags
  const SCRIPT_REGEX = /<script[^>]*>[\s\S]*?<\/script>/gi;
  if (SCRIPT_REGEX.test(sanitized)) {
    threatsDetected.push("script_tag");
    sanitized = sanitized.replace(SCRIPT_REGEX, "");
    wasModified = true;
  }

  // Strip HTML tags
  const HTML_TAG_REGEX = /<[^>]*>/g;
  if (HTML_TAG_REGEX.test(sanitized)) {
    threatsDetected.push("html_tag");
    sanitized = sanitized.replace(HTML_TAG_REGEX, "");
    wasModified = true;
  }

  // Remove angle brackets
  const ANGLE_BRACKET_REGEX = /[<>]/g;
  if (ANGLE_BRACKET_REGEX.test(sanitized)) {
    threatsDetected.push("angle_bracket");
    sanitized = sanitized.replace(ANGLE_BRACKET_REGEX, "");
    wasModified = true;
  }

  // Normalize whitespace
  const normalized = sanitized.replace(/\s+/g, " ").trim();
  if (normalized !== sanitized) {
    wasModified = true;
    sanitized = normalized;
  }

  // Limit length
  const MAX_LENGTH = 10000;
  if (sanitized.length > MAX_LENGTH) {
    threatsDetected.push("length_exceeded");
    sanitized = sanitized.substring(0, MAX_LENGTH);
    wasModified = true;
  }

  return { sanitized, wasModified, threatsDetected };
}

describe("Input Sanitization", () => {
  describe("sanitizeForPrompt", () => {
    it("should return empty string for empty input", () => {
      const result = sanitizeForPrompt("");
      expect(result.sanitized).toBe("");
      expect(result.wasModified).toBe(false);
    });

    it("should return empty string for null input", () => {
      const result = sanitizeForPrompt(null as any);
      expect(result.sanitized).toBe("");
    });

    it("should strip script tags", () => {
      const input = 'Hello <script>alert("xss")</script> World';
      const result = sanitizeForPrompt(input);
      expect(result.sanitized).toBe("Hello World");
      expect(result.threatsDetected).toContain("script_tag");
      expect(result.wasModified).toBe(true);
    });

    it("should strip HTML tags", () => {
      const input = "<p>Hello</p> <b>World</b>";
      const result = sanitizeForPrompt(input);
      expect(result.sanitized).toBe("Hello World");
      expect(result.threatsDetected).toContain("html_tag");
    });

    it("should remove angle brackets", () => {
      const input = "Hello <user@example.com> World";
      const result = sanitizeForPrompt(input);
      expect(result.sanitized).toBe("Hello World");
      expect(result.threatsDetected.length).toBeGreaterThan(0);
    });

    it("should normalize whitespace", () => {
      const input = "Hello    World\n\n\tTest";
      const result = sanitizeForPrompt(input);
      expect(result.sanitized).toBe("Hello World Test");
      expect(result.wasModified).toBe(true);
    });

    it("should trim whitespace", () => {
      const input = "   Hello World   ";
      const result = sanitizeForPrompt(input);
      expect(result.sanitized).toBe("Hello World");
    });

    it("should handle clean input without modification", () => {
      const input = "Hello World, this is a normal email subject!";
      const result = sanitizeForPrompt(input);
      expect(result.sanitized).toBe(input);
      expect(result.wasModified).toBe(false);
      expect(result.threatsDetected).toHaveLength(0);
    });

    it("should truncate long input", () => {
      const input = "a".repeat(15000);
      const result = sanitizeForPrompt(input);
      expect(result.sanitized.length).toBe(10000);
      expect(result.threatsDetected).toContain("length_exceeded");
    });

    it("should handle multiple threats", () => {
      const input = '<script>alert(1)</script><p>Hello</p> <user@test.com>';
      const result = sanitizeForPrompt(input);
      expect(result.threatsDetected).toContain("script_tag");
      expect(result.threatsDetected).toContain("html_tag");
    });

    it("should handle complex injection attempt", () => {
      const input = 'Normal text <img src=x onerror=alert(1)> more text';
      const result = sanitizeForPrompt(input);
      expect(result.sanitized).toBe("Normal text more text");
      expect(result.threatsDetected.length).toBeGreaterThan(0);
    });
  });
});
