// =========================================================
// REPLIFY AI - Gmail Connect (HARDENED - NO SILENT FAILURES)
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, jsonError, corsPreflightResponse } from "../_shared/http.ts";

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  console.log("[gmail-connect] ========== REQUEST START ==========");
  console.log("[gmail-connect] Method:", req.method);
  console.log("[gmail-connect] URL:", req.url);
  console.log("[gmail-connect] Origin:", req.headers.get("origin"));

  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      console.log("[gmail-connect] Handling CORS preflight");
      return corsPreflightResponse();
    }

    // Only accept POST
    if (req.method !== "POST") {
      console.error("[gmail-connect] Invalid method:", req.method);
      return jsonError("Method not allowed. Use POST.", 405, corsHeaders);
    }

    // ============================================
    // STEP 1: Validate Authorization Header
    // ============================================
    const authHeader = req.headers.get("Authorization");
    console.log("[gmail-connect] Auth header present:", !!authHeader);

    if (!authHeader) {
      console.error("[gmail-connect] MISSING AUTH HEADER");
      return jsonError("Missing Authorization header", 401, corsHeaders);
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token || token.length < 10) {
      console.error("[gmail-connect] INVALID TOKEN FORMAT");
      return jsonError("Invalid token format", 401, corsHeaders);
    }

    console.log("[gmail-connect] Token extracted (length):", token.length);

    // ============================================
    // STEP 2: Validate Environment Variables
    // ============================================
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("ANON_KEY");
    const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
    const GMAIL_REDIRECT_URI = Deno.env.get("GMAIL_REDIRECT_URI");

    console.log("[gmail-connect] Env vars check:", {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnonKey: !!SUPABASE_ANON_KEY,
      hasClientId: !!GMAIL_CLIENT_ID,
      hasRedirectUri: !!GMAIL_REDIRECT_URI,
    });

    if (!SUPABASE_URL) {
      console.error("[gmail-connect] MISSING SUPABASE_URL");
      return jsonError("Server config error: Missing SUPABASE_URL", 500, corsHeaders);
    }

    if (!SUPABASE_ANON_KEY) {
      console.error("[gmail-connect] MISSING ANON_KEY");
      return jsonError("Server config error: Missing ANON_KEY", 500, corsHeaders);
    }

    if (!GMAIL_CLIENT_ID) {
      console.error("[gmail-connect] MISSING GMAIL_CLIENT_ID");
      return jsonError("Server config error: Missing GMAIL_CLIENT_ID", 500, corsHeaders);
    }

    if (!GMAIL_REDIRECT_URI) {
      console.error("[gmail-connect] MISSING GMAIL_REDIRECT_URI");
      return jsonError("Server config error: Missing GMAIL_REDIRECT_URI", 500, corsHeaders);
    }

    // ============================================
    // STEP 3: Validate JWT and Get User
    // ============================================
    console.log("[gmail-connect] Creating Supabase client...");
    
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    console.log("[gmail-connect] Calling auth.getUser()...");
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("[gmail-connect] JWT VALIDATION FAILED:", authError.message);
      return jsonError(`Invalid JWT: ${authError.message}`, 401, corsHeaders);
    }

    if (!user) {
      console.error("[gmail-connect] NO USER RETURNED");
      return jsonError("User not found for this token", 401, corsHeaders);
    }

    console.log("[gmail-connect] ✅ User authenticated:", user.id);

    // ============================================
    // STEP 4: Generate and Store OAuth State
    // ============================================
    const state = crypto.randomUUID();
    console.log("[gmail-connect] Generated state:", state);
    
    // Store state with user_id and expiration in database
    console.log("[gmail-connect] Storing state in oauth_states...");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    
    const { error: stateError } = await supabase
      .from("oauth_states")
      .insert({
        user_id: user.id,
        state: state,
        expires_at: expiresAt,
      });
    
    if (stateError) {
      console.error("[gmail-connect] FAILED TO STORE STATE:", stateError);
      return jsonError(`Failed to store OAuth state: ${stateError.message}`, 500, corsHeaders);
    }
    
    console.log("[gmail-connect] ✅ State stored successfully");

    // ============================================
    // STEP 5: Build OAuth URL
    // ============================================
    const scope = "openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send";
    
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${GMAIL_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(GMAIL_REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${state}`;

    console.log("[gmail-connect] ✅ Auth URL built successfully");
    console.log("[gmail-connect] Redirect URI:", GMAIL_REDIRECT_URI);
    console.log("[gmail-connect] ========== REQUEST END (SUCCESS) ==========");

    return jsonResponse({
      success: true,
      authUrl,
      url: authUrl,
      state,
    }, 200, corsHeaders);

  } catch (err) {
    // ============================================
    // NEVER SWALLOW ERRORS
    // ============================================
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const errorStack = err instanceof Error ? err.stack : "";
    
    console.error("[gmail-connect] ========== FATAL ERROR ==========");
    console.error("[gmail-connect] Error:", errorMessage);
    console.error("[gmail-connect] Stack:", errorStack);
    console.error("[gmail-connect] ========== REQUEST END (ERROR) ==========");
    
    return jsonError(`Server crash in gmail-connect: ${errorMessage}`, 500, corsHeaders);
  }
});
