// =========================================================
// REPLIFY AI - Fetch Emails (OPTIMIZED)
// Section 9: Performance Optimization
// Section 10: Reply Detection Engine
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { TokenEncryption } from "../_shared/encryption.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create client outside handler for connection reuse
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Pre-initialize rate limiter
const rateLimitMiddleware = createRateLimitMiddleware({ requestsPerMinute: 30, requestsPerHour: 300 });

// Cache config outside handler
const CONFIG = {
  maxResults: 20,
  maxConcurrency: 5, // Limit concurrent Gmail API calls
  timeoutMs: 25000, // 25 second timeout
} as const;

interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailMessage[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{ mimeType: string; body: { data?: string } }>;
    body?: { data?: string };
  };
  internalDate: string;
}

Deno.serve(async (req) => {
  const logger = createLogger("fetch-emails", req);
  
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  // Declare headers outside try block so it's available in catch
  let headers: Record<string, string> = {};

  try {
    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(req);
    headers = rateLimitResult.headers;
    if (!rateLimitResult.allowed) {
      logAbuseAttempt("fetch-emails", "/functions/fetch-emails", req.headers.get("user-agent"));
      return createErrorResponse(req, "Rate limit exceeded", 429, "RATE_LIMITED", headers);
    }

    // Verify JWT - Gateway validates with verify_jwt = true, we just extract user ID
    const authHeader = req.headers.get("authorization");
    console.log("[fetch-emails] Auth header present:", !!authHeader);
    console.log("[fetch-emails] Function version: 2.0 - JWT decoded from payload");
    
    if (!authHeader) {
      return createErrorResponse(req, "Unauthorized - Missing Authorization header", 401, "UNAUTHORIZED", headers);
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("[fetch-emails] Token length:", token.length);
    console.log("[fetch-emails] Token preview:", token.substring(0, 50) + "...");
    
    // Decode JWT payload to extract user ID
    // Note: With verify_jwt = true in config.toml, the gateway already validates the JWT
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log("[fetch-emails] JWT issuer:", payload.iss);
      console.log("[fetch-emails] JWT sub:", payload.sub);
      console.log("[fetch-emails] JWT exp:", payload.exp);
      console.log("[fetch-emails] JWT ref:", payload.ref);
      
      userId = payload.sub;
      if (!userId) {
        throw new Error("JWT missing sub claim");
      }
    } catch (e) {
      console.error("[fetch-emails] Failed to decode JWT:", e);
      return createErrorResponse(req, "Invalid JWT format", 401, "UNAUTHORIZED", headers);
    }
    
    console.log("[fetch-emails] User authenticated:", userId);

    logger.setUserId(userId);

    // Parse query params
    const url = new URL(req.url);
    const pageToken = url.searchParams.get("pageToken") || undefined;
    const maxResults = Math.min(parseInt(url.searchParams.get("maxResults") || "20"), 50);

    // Get email account
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (accountError || !account) {
      return createErrorResponse(req, "No email account connected", 404, "NO_ACCOUNT", headers);
    }

    // Decrypt token
    let accessToken: string;
    try {
      accessToken = await TokenEncryption.decryptToken(account.access_token, account.access_token_iv);
    } catch (decryptError) {
      logger.error("Token decryption failed", decryptError as Error);
      return createErrorResponse(req, "Authentication error", 500, "TOKEN_ERROR", headers);
    }

    // Check token expiry and refresh if needed
    if (new Date(account.token_expiry) <= new Date()) {
      const refreshed = await refreshToken(account);
      if (!refreshed) {
        return createErrorResponse(req, "Token expired, please reconnect", 401, "TOKEN_EXPIRED", headers);
      }
      accessToken = refreshed;
    }

    // Fetch threads with pagination
    const threads = await fetchThreads(accessToken, maxResults, pageToken, logger);

    // Process and store threads with controlled concurrency
    const processedThreads = await processBatch(
      threads.threads,
      CONFIG.maxConcurrency,
      async (thread) => {
        try {
          const processed = await processThread(thread, userId, account.id, account.email_address, logger);
          return processed;
        } catch (threadError) {
          logger?.error(`Failed to process thread ${thread.id}`, threadError as Error);
          return null;
        }
      }
    );

    // Filter out null results from failed thread processing
    const validThreads = processedThreads.filter(Boolean);

    logger.info("Emails fetched", { count: validThreads.length, hasMore: !!threads.nextPageToken });

    return createCORSResponse(
      req,
      JSON.stringify({
        threads: validThreads,
        nextPageToken: threads.nextPageToken,
        resultSizeEstimate: threads.resultSizeEstimate,
        threadsProcessed: validThreads.length
      }),
      200,
      headers
    );

  } catch (error) {
    const err = error as Error;
    console.error("FETCH EMAILS CRASH:", err);
    logger.error("Fetch emails failed", err);
    
    // Return real error message for debugging
    return createCORSResponse(
      req,
      JSON.stringify({
        error: err?.message || "Unknown server crash",
        stack: err?.stack || null,
        errorCode: "INTERNAL_ERROR"
      }),
      500
    );
  }
});

// Batch processor for controlled concurrency
async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

async function fetchThreads(
  accessToken: string,
  maxResults: number,
  pageToken?: string,
  logger?: any
): Promise<{ threads: GmailThread[]; nextPageToken?: string; resultSizeEstimate?: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeoutMs);

  try {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
    url.searchParams.append("maxResults", String(Math.min(maxResults, CONFIG.maxResults)));
    url.searchParams.append("q", "in:sent newer_than:30d");
    if (pageToken) url.searchParams.append("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gmail API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    const threadList = data.threads || [];

    // Fetch full thread details with controlled concurrency
    const threads = await processBatch(
      threadList,
      CONFIG.maxConcurrency,
      async (t: { id: string }) => {
        try {
          const detailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}`,
            { 
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: controller.signal,
            }
          );

          if (!detailResponse.ok) {
            logger?.warn(`Failed to fetch thread ${t.id}`);
            return null;
          }

          return await detailResponse.json();
        } catch (e) {
          logger?.warn(`Error fetching thread ${t.id}:`, e);
          return null;
        }
      }
    );

    return {
      threads: threads.filter(Boolean),
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function processThread(
  thread: GmailThread, 
  userId: string, 
  accountId: string,
  userEmail: string,
  logger?: any
) {
  const lastMessage = thread.messages[thread.messages.length - 1];
  const headers = lastMessage?.payload?.headers || [];

  const subject = headers.find(h => h.name === "Subject")?.value || "No Subject";
  const from = headers.find(h => h.name === "From")?.value || "";
  const to = headers.find(h => h.name === "To")?.value || "";
  const date = headers.find(h => h.name === "Date")?.value;

  const lastMessageDate = lastMessage?.internalDate
    ? new Date(parseInt(lastMessage.internalDate))
    : date ? new Date(date) : new Date();

  // ========================================
  // REPLY DETECTION ENGINE
  // ========================================
  let replyDetected = false;
  let followupDisabled = false;

  try {
    // 1. Get last message sender
    const lastFrom = lastMessage?.payload?.headers?.find(
      (h: { name: string; value: string }) => h.name === "From"
    )?.value || "";

    // 2. Determine if last message is from user
    const isFromUser = lastFrom.toLowerCase().includes(userEmail.toLowerCase());

    // 3. If NOT from user → possible reply, check if we sent follow-up before
    if (!isFromUser) {
      // Get the internal thread ID from email_threads table
      const { data: existingThreadLookup } = await supabase
        .from("email_threads")
        .select("id")
        .eq("thread_id", thread.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingThreadLookup) {
        // Check if we previously sent a follow-up
        const { data: sentFollowup } = await supabase
          .from("followup_logs")
          .select("created_at")
          .eq("thread_id", existingThreadLookup.id)
          .eq("action", "sent")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // If we sent a follow-up, compare timestamps
        if (sentFollowup) {
          const lastFollowupDate = new Date(sentFollowup.created_at);

          // If last message is AFTER our follow-up → this is a reply
          if (lastMessageDate > lastFollowupDate) {
            // 4. Check idempotency - already marked as replied?
            const { data: existingReply } = await supabase
              .from("followup_logs")
              .select("id")
              .eq("thread_id", existingThreadLookup.id)
              .eq("action", "replied")
              .maybeSingle();

            if (!existingReply) {
              // 5. Mark thread as replied
              console.log("[fetch-emails] Reply detected for thread:", thread.id);
              logger?.info("Reply detected", { threadId: thread.id });

              // Insert replied log
              await supabase
                .from("followup_logs")
                .insert({
                  user_id: userId,
                  thread_id: existingThreadLookup.id,
                  action: "replied",
                  details: { 
                    detected_at: new Date().toISOString(),
                    last_message_date: lastMessageDate.toISOString(),
                    last_followup_date: lastFollowupDate.toISOString()
                  }
                });

              replyDetected = true;
              followupDisabled = true;

              // 6. Update analytics
              await supabase.rpc("aggregate_weekly_analytics", { user_uuid: userId });
            } else {
              // Already marked, just set flags
              replyDetected = true;
              followupDisabled = true;
            }
          }
        }
      }
    }
  } catch (replyDetectionError) {
    // Never crash if reply detection fails
    console.error("[fetch-emails] Reply detection error (non-fatal):", replyDetectionError);
    logger?.error("Reply detection failed (non-fatal)", replyDetectionError as Error);
  }

  // Check if thread exists in DB
  const { data: existingThread } = await supabase
    .from("email_threads")
    .select("id")
    .eq("thread_id", thread.id)
    .eq("user_id", userId)
    .maybeSingle();

  const threadData: any = {
    user_id: userId,
    thread_id: thread.id,
    subject,
    last_message_at: lastMessageDate.toISOString(),
    last_message_from: from,
    last_user_message_at: lastMessageDate.toISOString(),
    needs_followup: replyDetected ? false : false,
    priority_score: 0,
    priority: replyDetected ? "None" : "Low",
    reply_detected: replyDetected,
    reply_detected_at: replyDetected ? new Date().toISOString() : undefined,
    followup_disabled: followupDisabled
  };

  if (existingThread) {
    await supabase
      .from("email_threads")
      .update(threadData)
      .eq("id", existingThread.id);

    return { ...threadData, id: existingThread.id };
  } else {
    const { data: newThread } = await supabase
      .from("email_threads")
      .insert(threadData)
      .select()
      .single();

    return { ...threadData, id: newThread?.id };
  }
}

async function refreshToken(account: any): Promise<string | null> {
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

    if (!response.ok) return null;

    const data = await response.json();
    const encrypted = await TokenEncryption.encryptToken(data.access_token);

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
  } catch {
    return null;
  }
}
