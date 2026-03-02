// =========================================================
// REPLIFY AI - Switch Account (HARDENED)
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const rateLimitMiddleware = createRateLimitMiddleware({ requestsPerMinute: 30, requestsPerHour: 300 });

Deno.serve(async (req) => {
  const logger = createLogger("switch-account", req);
  
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limiting
    const { allowed } = await rateLimitMiddleware(req);
    if (!allowed) {
      logAbuseAttempt("switch-account", "/functions/switch-account", req.headers.get("user-agent"));
      return createErrorResponse(req, "Rate limit exceeded", 429, "RATE_LIMITED");
    }

    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return createErrorResponse(req, "Unauthorized", 401, "UNAUTHORIZED");
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
      console.error("[switch-account] Failed to decode JWT:", e);
      return createErrorResponse(req, "Invalid JWT format", 401, "UNAUTHORIZED");
    }

    logger.setUserId(userId);

    // Parse request body
    const { accountId } = await req.json();

    if (!accountId) {
      return createErrorResponse(req, "Missing accountId", 400, "MISSING_PARAMS");
    }

    // Verify account belongs to user
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("id, email_address, is_active")
      .eq("id", accountId)
      .eq("user_id", userId)
      .single();

    if (accountError || !account) {
      return createErrorResponse(req, "Account not found", 404, "NOT_FOUND");
    }

    // Set all accounts to inactive
    await supabase
      .from("email_accounts")
      .update({ is_active: false })
      .eq("user_id", userId);

    // Set selected account to active
    const { error: updateError } = await supabase
      .from("email_accounts")
      .update({ is_active: true })
      .eq("id", accountId)
      .eq("user_id", userId);

    if (updateError) {
      logger.error("Failed to switch account", updateError);
      return createErrorResponse(req, "Failed to switch account", 500, "UPDATE_ERROR");
    }

    logger.info("Account switched", { accountId, email: account.email_address });

    return createCORSResponse(
      req,
      JSON.stringify({ success: true, account: { id: accountId, email: account.email_address } }),
      200,
      { "Content-Type": "application/json" }
    );

  } catch (error) {
    logger.error("Switch account failed", error as Error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});
