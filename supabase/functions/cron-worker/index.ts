// =========================================================
// REPLIFY AI - Cron Worker (HARDENED)
// Section 2: Automation System - Batch Processing
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { TokenEncryption } from "../_shared/encryption.ts";
import { PlanEnforcer } from "../_shared/plan-rules.ts";
import { InputSanitizer } from "../_shared/sanitization.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;

const BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const BATCH_TIMEOUT_MS = 25000;

interface Account {
  id: string;
  user_id: string;
  email_address: string;
  access_token: string;
  access_token_iv: string;
  refresh_token: string;
  refresh_token_iv: string;
  token_expiry: string;
  encryption_version: number;
}

interface UserProfile {
  user_id: string;
  plan: string;
  plan_status: string;
}

interface UserSettings {
  user_id: string;
  followup_delay_days: number;
  tone_preference: string;
  auto_scan_enabled: boolean;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Rate limiter for cron worker
const rateLimitMiddleware = createRateLimitMiddleware({
  requestsPerMinute: 100,
  requestsPerHour: 1000
});

Deno.serve(async (req) => {
  const logger = createLogger("cron-worker", req);
  const executionId = logger.getRequestId();
  
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;
  
  logger.info("Cron worker started", { executionId, batchSize: BATCH_SIZE });

  try {
    // Check rate limit
    const { allowed, headers } = await rateLimitMiddleware(req);
    if (!allowed) {
      logAbuseAttempt("cron-worker", "/functions/cron-worker", req.headers.get("user-agent"));
      return createErrorResponse(req, "Rate limit exceeded", 429, "RATE_LIMITED", headers);
    }

    // Get all active email accounts with pagination
    const { data: accounts, error: accountsError } = await supabase
      .from("email_accounts")
      .select("*")
      .order("created_at", { ascending: true });

    if (accountsError) {
      logger.error("Failed to fetch accounts", accountsError);
      return createErrorResponse(req, "Failed to fetch accounts", 500, "FETCH_ERROR");
    }

    if (!accounts || accounts.length === 0) {
      logger.info("No accounts to process");
      return createCORSResponse(req, JSON.stringify({ processed: 0, executionId }), 200);
    }

    logger.info(`Processing ${accounts.length} accounts`, { executionId });

    // Process in batches
    const results = {
      total: accounts.length,
      processed: 0,
      successful: 0,
      failed: 0,
      followupsGenerated: 0,
      followupsSent: 0,
      errors: [] as string[]
    };

    // Split into batches
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const batch = accounts.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(accounts.length / BATCH_SIZE);

      logger.info(`Processing batch ${batchNumber}/${totalBatches}`, {
        batchSize: batch.length,
        executionId
      });

      // Process batch with timeout
      const batchPromise = Promise.all(
        batch.map(account => processAccountWithRetry(account, logger, executionId))
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Batch timeout")), BATCH_TIMEOUT_MS);
      });

      try {
        const batchResults = await Promise.race([batchPromise, timeoutPromise]);
        
        for (const result of batchResults) {
          results.processed++;
          if (result.success) {
            results.successful++;
            results.followupsGenerated += result.followupsGenerated || 0;
            results.followupsSent += result.followupsSent || 0;
          } else {
            results.failed++;
            results.errors.push(`${result.accountId}: ${result.error}`);
          }
        }
      } catch (timeoutError) {
        logger.error(`Batch ${batchNumber} timed out`, timeoutError as Error);
        results.failed += batch.length;
        results.errors.push(`Batch ${batchNumber}: Timeout after ${BATCH_TIMEOUT_MS}ms`);
      }
    }

    logger.info("Cron worker completed", {
      executionId,
      ...results,
      executionTimeMs: logger.getExecutionTime()
    });

    return createCORSResponse(
      req,
      JSON.stringify({
        executionId,
        ...results,
        executionTimeMs: logger.getExecutionTime()
      }),
      200
    );

  } catch (error) {
    logger.error("Cron worker failed", error as Error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});

async function processAccountWithRetry(
  account: Account,
  logger: any,
  executionId: string,
  attempt = 1
): Promise<{ success: boolean; accountId: string; followupsGenerated?: number; followupsSent?: number; error?: string }> {
  try {
    return await processAccount(account, logger, executionId);
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      logger.warn(`Retrying account ${account.id}, attempt ${attempt + 1}`, {
        error: (error as Error).message
      });
      await delay(1000 * attempt); // Exponential backoff
      return processAccountWithRetry(account, logger, executionId, attempt + 1);
    }
    
    return {
      success: false,
      accountId: account.id,
      error: (error as Error).message
    };
  }
}

async function processAccount(
  account: Account,
  logger: any,
  executionId: string
): Promise<{ success: boolean; accountId: string; followupsGenerated?: number; followupsSent?: number; error?: string }> {
  const accountLogger = logger;
  accountLogger.info(`Processing account`, { accountId: account.id, userId: account.user_id, executionId });

  try {
    // Get user profile and settings
    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabase.from("profiles").select("plan, plan_status").eq("user_id", account.user_id).single(),
      supabase.from("user_settings").select("*").eq("user_id", account.user_id).single()
    ]);

    if (!profile || profile.plan_status === "cancelled") {
      accountLogger.info("Skipping inactive user", { userId: account.user_id });
      return { success: true, accountId: account.id, followupsGenerated: 0, followupsSent: 0 };
    }

    if (!settings?.auto_scan_enabled) {
      accountLogger.info("Auto-scan disabled for user", { userId: account.user_id });
      return { success: true, accountId: account.id, followupsGenerated: 0, followupsSent: 0 };
    }

    // Check plan limits
    const planCheck = await PlanEnforcer.checkFollowupLimit(supabase, account.user_id, profile.plan);
    if (!planCheck.allowed) {
      accountLogger.info("Plan limit reached", { userId: account.user_id, plan: profile.plan });
      return { success: true, accountId: account.id, followupsGenerated: 0, followupsSent: 0 };
    }

    // Decrypt tokens
    let accessToken: string;
    try {
      accessToken = await TokenEncryption.decryptToken(account.access_token, account.access_token_iv);
    } catch (decryptError) {
      accountLogger.error("Failed to decrypt token", decryptError as Error);
      return { success: false, accountId: account.id, error: "Token decryption failed" };
    }

    // Refresh token if expired
    if (new Date(account.token_expiry) <= new Date()) {
      const refreshed = await refreshGmailToken(account, logger);
      if (!refreshed) {
        return { success: false, accountId: account.id, error: "Token refresh failed" };
      }
      accessToken = refreshed;
    }

    // Fetch threads with pagination
    const threads = await fetchGmailThreads(accessToken, account.email_address, logger);
    
    let followupsGenerated = 0;
    let followupsSent = 0;

    for (const thread of threads) {
      // Check for silence
      const silenceResult = await detectSilence(thread, settings.followup_delay_days);
      if (!silenceResult.needsFollowup) continue;

      // Check if already has pending followup
      const { data: existing } = await supabase
        .from("followup_suggestions")
        .select("id")
        .eq("thread_id", thread.id)
        .eq("status", "pending")
        .single();

      if (existing) continue;

      // Generate AI followup
      const generated = await generateFollowup(
        thread,
        settings.tone_preference,
        account.user_id,
        logger
      );

      if (generated) {
        followupsGenerated++;

        // Log generation
        await supabase.from("followup_logs").insert({
          user_id: account.user_id,
          suggestion_id: generated.id,
          thread_id: thread.id,
          action: "generated",
          details: { executionId, tone: settings.tone_preference }
        });

        // Auto-send if enabled and plan allows
        if (settings.auto_scan_enabled && PlanEnforcer.canAutoSend(profile.plan)) {
          const sent = await sendFollowupEmail(
            generated.id,
            accessToken,
            thread,
            generated.text,
            account.user_id,
            logger
          );

          if (sent) {
            followupsSent++;
            
            // Log send
            await supabase.from("followup_logs").insert({
              user_id: account.user_id,
              suggestion_id: generated.id,
              thread_id: thread.id,
              action: "auto_sent",
              details: { executionId }
            });

            // Update suggestion status
            await supabase
              .from("followup_suggestions")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", generated.id);
          }
        }
      }
    }

    // Update analytics
    await supabase.rpc("aggregate_weekly_analytics", { user_uuid: account.user_id });

    return {
      success: true,
      accountId: account.id,
      followupsGenerated,
      followupsSent
    };

  } catch (error) {
    accountLogger.error(`Account processing failed`, error as Error, { accountId: account.id });
    return { success: false, accountId: account.id, error: (error as Error).message };
  }
}

async function refreshGmailToken(account: Account, logger: any): Promise<string | null> {
  try {
    const refreshToken = await TokenEncryption.decryptToken(
      account.refresh_token,
      account.refresh_token_iv
    );

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
        client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Encrypt new token
    const encrypted = await TokenEncryption.encryptToken(data.access_token);
    
    // Update database
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + data.expires_in);

    await supabase
      .from("email_accounts")
      .update({
        access_token: encrypted.encrypted,
        access_token_iv: encrypted.iv,
        token_expiry: expiryDate.toISOString()
      })
      .eq("id", account.id);

    return data.access_token;
  } catch (error) {
    logger.error("Token refresh failed", error as Error);
    return null;
  }
}

async function fetchGmailThreads(
  accessToken: string,
  emailAddress: string,
  logger: any,
  pageToken?: string
): Promise<any[]> {
  const threads: any[] = [];
  let nextPageToken = pageToken;
  let pageCount = 0;
  const maxPages = 5;

  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
    url.searchParams.append("maxResults", "20");
    url.searchParams.append("q", "in:sent newer_than:30d");
    if (nextPageToken) url.searchParams.append("pageToken", nextPageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.threads) {
      // Fetch full thread details
      for (const thread of data.threads) {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (detailResponse.ok) {
          const detail = await detailResponse.json();
          threads.push({
            id: thread.id,
            ...detail
          });
        }
      }
    }

    nextPageToken = data.nextPageToken;
    pageCount++;
  } while (nextPageToken && pageCount < maxPages);

  return threads;
}

async function detectSilence(thread: any, delayDays: number): Promise<{ needsFollowup: boolean; daysSince: number }> {
  if (!thread.messages || thread.messages.length === 0) {
    return { needsFollowup: false, daysSince: 0 };
  }

  const lastMessage = thread.messages[thread.messages.length - 1];
  const headers = lastMessage.payload?.headers || [];
  const fromHeader = headers.find((h: any) => h.name === "From")?.value || "";
  const dateHeader = headers.find((h: any) => h.name === "Date")?.value;

  // Check if last message is from user (not a reply)
  const isFromUser = !fromHeader.includes("<"); // Simplified check
  
  if (!isFromUser) {
    return { needsFollowup: false, daysSince: 0 };
  }

  const lastDate = new Date(dateHeader);
  const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    needsFollowup: daysSince >= delayDays,
    daysSince
  };
}

async function generateFollowup(
  thread: any,
  tone: string,
  userId: string,
  logger: any
): Promise<{ id: string; text: string } | null> {
  try {
    const subject = thread.messages[0]?.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "No Subject";
    const lastMessage = thread.messages[thread.messages.length - 1];
    const daysSince = 3; // Simplified

    // Sanitize and create prompt
    const { prompt, wasSanitized, threats } = InputSanitizer.createSafePrompt({
      subject,
      days: daysSince,
      tone,
      lastMessage: lastMessage?.snippet
    });

    if (wasSanitized) {
      logger.warn("Input was sanitized", { threats, threadId: thread.id });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful email assistant." },
          { role: "user", content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content?.trim();

    if (!generatedText) {
      return null;
    }

    // Store suggestion
    const { data: suggestion, error } = await supabase
      .from("followup_suggestions")
      .insert({
        thread_id: thread.id,
        user_id: userId,
        generated_text: generatedText,
        tone,
        priority: daysSince > 7 ? "High" : "Medium",
        status: "pending"
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { id: suggestion.id, text: generatedText };
  } catch (error) {
    logger.error("Failed to generate followup", error as Error);
    return null;
  }
}

async function sendFollowupEmail(
  suggestionId: string,
  accessToken: string,
  thread: any,
  body: string,
  userId: string,
  logger: any
): Promise<boolean> {
  try {
    const subject = thread.messages[0]?.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "";
    const to = thread.messages[0]?.payload?.headers?.find((h: any) => h.name === "To")?.value || "";

    const email = [
      `To: ${to}`,
      `Subject: Re: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body
    ].join("\n");

    const encodedEmail = btoa(email).replace(/\+/g, "-").replace(/\//g, "_");

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw: encodedEmail, threadId: thread.id })
    });

    return response.ok;
  } catch (error) {
    logger.error("Failed to send followup", error as Error);
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
