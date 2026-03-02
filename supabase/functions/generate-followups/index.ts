// =========================================================
// REPLIFY AI - Generate Followups (OPTIMIZED)
// Section 8: AI Prompt Sanitization
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { InputSanitizer } from "../_shared/sanitization.ts";
import { PlanEnforcer } from "../_shared/plan-rules.ts";
import { TokenEncryption } from "../_shared/encryption.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// Create client outside handler for connection reuse
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const rateLimitMiddleware = createRateLimitMiddleware({ requestsPerMinute: 20, requestsPerHour: 200 });

// Config for batch processing
const CONFIG = {
  maxBatchSize: 10,
  openaiTimeoutMs: 15000, // 15 second timeout for OpenAI
  dbTimeoutMs: 10000, // 10 second timeout for DB operations
} as const;

Deno.serve(async (req) => {
  const logger = createLogger("generate-followups", req);
  
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  // Declare headers outside try block so it's available in catch
  let headers: Record<string, string> = {};

  try {
    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(req);
    headers = rateLimitResult.headers;
    if (!rateLimitResult.allowed) {
      logAbuseAttempt("generate-followups", "/functions/generate-followups", req.headers.get("user-agent"));
      return createErrorResponse(req, "Rate limit exceeded", 429, "RATE_LIMITED", headers);
    }

    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return createErrorResponse(req, "Unauthorized", 401, "UNAUTHORIZED", headers);
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Decode JWT payload to extract user ID
    // Note: With verify_jwt = true in config.toml, the gateway already validates the JWT
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
      if (!userId) {
        throw new Error("JWT missing sub claim");
      }
    } catch (e) {
      console.error("[generate-followups] Failed to decode JWT:", e);
      return createErrorResponse(req, "Invalid JWT format", 401, "UNAUTHORIZED", headers);
    }

    logger.setUserId(userId);

    // Get user profile and settings
    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabase.from("profiles").select("plan").eq("user_id", userId).single(),
      supabase.from("user_settings").select("tone_preference").eq("user_id", userId).single()
    ]);

    // Check plan limits
    const planCheck = await PlanEnforcer.checkFollowupLimit(
      supabase,
      userId,
      profile?.plan || "free"
    );

    if (!planCheck.allowed) {
      return createErrorResponse(req, planCheck.reason || "Plan limit reached", 403, "PLAN_LIMIT");
    }

    // Parse request body
    const { threadId, accountId } = await req.json();

    if (!threadId || !accountId) {
      return createErrorResponse(req, "Missing threadId or accountId", 400, "MISSING_PARAMS");
    }

    // Get email account
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", userId)
      .single();

    if (accountError || !account) {
      return createErrorResponse(req, "Account not found", 404, "NOT_FOUND");
    }

    // Decrypt token
    let accessToken: string;
    try {
      accessToken = await TokenEncryption.decryptToken(account.access_token, account.access_token_iv);
    } catch (decryptError) {
      logger.error("Token decryption failed", decryptError as Error);
      return createErrorResponse(req, "Authentication error", 500, "TOKEN_ERROR");
    }

    // Fetch thread from Gmail
    const threadResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!threadResponse.ok) {
      return createErrorResponse(req, "Failed to fetch thread", 500, "GMAIL_ERROR");
    }

    const thread = await threadResponse.json();

    // Extract thread info
    const subject = thread.messages[0]?.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "No Subject";
    const lastMessage = thread.messages[thread.messages.length - 1];
    const lastMessageDate = lastMessage?.internalDate 
      ? new Date(parseInt(lastMessage.internalDate))
      : new Date();
    const daysSince = Math.floor((Date.now() - lastMessageDate.getTime()) / (1000 * 60 * 60 * 24));

    // Sanitize and create prompt
    const { prompt, wasSanitized, threats } = InputSanitizer.createSafePrompt({
      subject,
      days: daysSince,
      tone: settings?.tone_preference || "professional",
      lastMessage: lastMessage?.snippet
    });

    if (wasSanitized) {
      logger.warn("Input was sanitized", { threats, threadId });
    }

    // Call OpenAI with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.openaiTimeoutMs);

    let openaiResponse;
    try {
      openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful email assistant for Replify AI." },
            { role: "user", content: prompt }
          ],
          max_tokens: 150,
          temperature: 0.7
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        logger.error("OpenAI API timeout", error);
        return createErrorResponse(req, "AI generation timed out", 504, "AI_TIMEOUT");
      }
      throw error;
    }

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      logger.error("OpenAI API error", new Error(JSON.stringify(errorData)), { error: errorData });
      return createErrorResponse(req, "AI generation failed", 500, "AI_ERROR");
    }

    const aiData = await openaiResponse.json();
    const generatedText = aiData.choices[0]?.message?.content?.trim();

    if (!generatedText) {
      return createErrorResponse(req, "No content generated", 500, "EMPTY_RESPONSE");
    }

    // Store in email_threads if not exists
    const { data: existingThread } = await supabase
      .from("email_threads")
      .select("id")
      .eq("thread_id", threadId)
      .eq("user_id", userId)
      .single();

    let dbThreadId: string;

    if (existingThread) {
      dbThreadId = existingThread.id;
      await supabase
        .from("email_threads")
        .update({
          subject,
          last_message_at: lastMessageDate.toISOString(),
          needs_followup: true
        })
        .eq("id", dbThreadId);
    } else {
      const { data: newThread, error: threadError } = await supabase
        .from("email_threads")
        .insert({
          user_id: userId,
          thread_id: threadId,
          subject,
          last_message_at: lastMessageDate.toISOString(),
          needs_followup: true
        })
        .select()
        .single();

      if (threadError) {
        throw threadError;
      }
      dbThreadId = newThread.id;
    }

    // Store suggestion
    const { data: suggestion, error: suggestionError } = await supabase
      .from("followup_suggestions")
      .insert({
        thread_id: dbThreadId,
        user_id: userId,
        generated_text: generatedText,
        tone: settings?.tone_preference || "professional",
        priority: daysSince > 7 ? "High" : daysSince > 3 ? "Medium" : "Low",
        status: "pending"
      })
      .select()
      .single();

    if (suggestionError) {
      throw suggestionError;
    }

    // Log generation
    await supabase.from("followup_logs").insert({
      user_id: userId,
      suggestion_id: suggestion.id,
      thread_id: dbThreadId,
      action: "generated",
      details: { tone: settings?.tone_preference, wasSanitized, threats }
    });

    logger.info("Followup generated", { suggestionId: suggestion.id, threadId });

    return createCORSResponse(
      req,
      JSON.stringify({
        id: suggestion.id,
        text: generatedText,
        tone: settings?.tone_preference || "professional",
        priority: daysSince > 7 ? "High" : daysSince > 3 ? "Medium" : "Low",
        threadId: dbThreadId
      }),
      200,
      { "Content-Type": "application/json", ...headers }
    );

  } catch (error) {
    logger.error("Generate followups failed", error as Error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});
