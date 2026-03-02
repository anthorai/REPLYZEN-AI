// =========================================================
// REPLIFY AI - Disconnect Account (HARDENED)
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { createRateLimitMiddleware, logAbuseAttempt } from "../_shared/rate-limiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const rateLimitMiddleware = createRateLimitMiddleware({ requestsPerMinute: 10, requestsPerHour: 50 });

Deno.serve(async (req) => {
  const logger = createLogger("disconnect-account", req);
  
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Rate limiting
    const { allowed } = await rateLimitMiddleware(req);
    if (!allowed) {
      logAbuseAttempt("disconnect-account", "/functions/disconnect-account", req.headers.get("user-agent"));
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
      console.error("[disconnect-account] Failed to decode JWT:", e);
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
      .select("id, email_address")
      .eq("id", accountId)
      .eq("user_id", userId)
      .single();

    if (accountError || !account) {
      return createErrorResponse(req, "Account not found", 404, "NOT_FOUND");
    }

    // Delete account (cascade will clean up related data)
    const { error: deleteError } = await supabase
      .from("email_accounts")
      .delete()
      .eq("id", accountId)
      .eq("user_id", userId);

    if (deleteError) {
      logger.error("Failed to delete account", deleteError);
      return createErrorResponse(req, "Failed to disconnect account", 500, "DELETE_ERROR");
    }

    // Log disconnection
    await supabase.from("followup_logs").insert({
      user_id: userId,
      action: "deleted",
      details: { event: "account_disconnected", email: account.email_address }
    });

    logger.info("Account disconnected", { accountId, email: account.email_address });

    return createCORSResponse(
      req,
      JSON.stringify({ success: true }),
      200,
      { "Content-Type": "application/json" }
    );

  } catch (error) {
    logger.error("Disconnect account failed", error as Error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});
