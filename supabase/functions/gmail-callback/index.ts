// =========================================================
// REPLIFY AI - Gmail Callback (HARDENED - NO SILENT FAILURES)
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";
import { TokenEncryption } from "../_shared/encryption.ts";

const FRONTEND_URL = "http://localhost:8080";

Deno.serve(async (req) => {
  console.log("[gmail-callback] ========== REQUEST START ==========");
  console.log("[gmail-callback] Method:", req.method);
  console.log("[gmail-callback] URL:", req.url);

  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      console.log("[gmail-callback] Handling CORS preflight");
      return corsPreflightResponse();
    }

    // ============================================
    // STEP 1: Parse Query Parameters
    // ============================================
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    console.log("[gmail-callback] Params:", {
      hasCode: !!code,
      hasState: !!state,
      error,
      errorDescription,
    });

    // Handle OAuth errors from Google
    if (error) {
      const errorMsg = `Google OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`;
      console.error("[gmail-callback] GOOGLE ERROR:", errorMsg);
      return redirectWithError(errorMsg);
    }

    if (!code) {
      console.error("[gmail-callback] MISSING CODE");
      return redirectWithError("Missing authorization code from Google");
    }

    if (!state) {
      console.error("[gmail-callback] MISSING STATE");
      return redirectWithError("Missing OAuth state parameter");
    }

    // ============================================
    // STEP 2: Validate Environment Variables
    // ============================================
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
    const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET");
    const GMAIL_REDIRECT_URI = Deno.env.get("GMAIL_REDIRECT_URI");

    console.log("[gmail-callback] Env check:", {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
      hasClientId: !!GMAIL_CLIENT_ID,
      hasClientSecret: !!GMAIL_CLIENT_SECRET,
      hasRedirectUri: !!GMAIL_REDIRECT_URI,
    });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[gmail-callback] MISSING SUPABASE CONFIG");
      return redirectWithError("Server configuration error");
    }

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
      console.error("[gmail-callback] MISSING GOOGLE CREDENTIALS");
      return redirectWithError("Missing Google OAuth credentials");
    }

    // ============================================
    // STEP 3: Validate State and Get User ID
    // ============================================
    console.log("[gmail-callback] Validating state...", state);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: stateRecord, error: stateError } = await supabase
      .from("oauth_states")
      .select("user_id, expires_at")
      .eq("state", state)
      .single();
    
    if (stateError || !stateRecord) {
      console.error("[gmail-callback] INVALID STATE:", stateError);
      return redirectWithError("Invalid or expired OAuth state. Please try again.");
    }
    
    // Check if state is expired
    if (new Date(stateRecord.expires_at) < new Date()) {
      console.error("[gmail-callback] STATE EXPIRED");
      await supabase.from("oauth_states").delete().eq("state", state);
      return redirectWithError("OAuth session expired. Please try again.");
    }
    
    const userId = stateRecord.user_id;
    console.log("[gmail-callback] ✅ State valid for user:", userId);

    // ============================================
    // STEP 4: Exchange Code for Tokens
    // ============================================
    console.log("[gmail-callback] Exchanging code for tokens...");
    
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        redirect_uri: GMAIL_REDIRECT_URI || "",
        grant_type: "authorization_code",
      }),
    });

    console.log("[gmail-callback] Token exchange status:", tokenRes.status);

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("[gmail-callback] TOKEN EXCHANGE FAILED:", tokenData);
      return redirectWithError(
        `Token exchange failed: ${tokenData.error || "Unknown error"}`,
        JSON.stringify(tokenData)
      );
    }

    if (!tokenData.access_token) {
      console.error("[gmail-callback] NO ACCESS TOKEN IN RESPONSE:", tokenData);
      return redirectWithError("No access token received from Google");
    }

    console.log("[gmail-callback] ✅ Token exchange success");
    console.log("[gmail-callback] Has refresh token:", !!tokenData.refresh_token);

    // ============================================
    // STEP 4: Get User Info from Google
    // ============================================
    console.log("[gmail-callback] Fetching user info...");
    
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      const errorText = await userInfoRes.text();
      console.error("[gmail-callback] USER INFO FAILED:", errorText);
      return redirectWithError("Failed to get user info from Google");
    }

    const userInfo = await userInfoRes.json();
    console.log("[gmail-callback] ✅ User info received:", userInfo.email);

    if (!userInfo.email) {
      console.error("[gmail-callback] NO EMAIL IN USER INFO");
      return redirectWithError("Google did not return email address");
    }

    // ============================================
    // STEP 5: Encrypt Tokens
    // ============================================
    console.log("[gmail-callback] Encrypting tokens...");
    
    let accessEncrypted: { encrypted: string; iv: string };
    let refreshEncrypted: { encrypted: string; iv: string } | null = null;
    
    try {
      accessEncrypted = await TokenEncryption.encryptToken(tokenData.access_token);
      
      if (tokenData.refresh_token) {
        refreshEncrypted = await TokenEncryption.encryptToken(tokenData.refresh_token);
      }
    } catch (encryptError) {
      console.error("[gmail-callback] ENCRYPTION FAILED:", encryptError);
      return redirectWithError("Failed to encrypt tokens");
    }

    console.log("[gmail-callback] ✅ Tokens encrypted");

    // ============================================
    // STEP 6: Store in Database
    // ============================================
    console.log("[gmail-callback] Storing in database...");
    
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + (tokenData.expires_in || 3600));

    // Check for existing account for this user
    const { data: existingAccount } = await supabase
      .from("email_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("email_address", userInfo.email)
      .single();

    let dbResult;
    
    if (existingAccount) {
      console.log("[gmail-callback] Updating existing account:", existingAccount.id);
      
      const updateData: Record<string, any> = {
        access_token: accessEncrypted.encrypted,
        access_token_iv: accessEncrypted.iv,
        token_expiry: expiryDate.toISOString(),
        encryption_version: 1,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      
      if (refreshEncrypted) {
        updateData.refresh_token = refreshEncrypted.encrypted;
        updateData.refresh_token_iv = refreshEncrypted.iv;
      }
      
      dbResult = await supabase
        .from("email_accounts")
        .update(updateData)
        .eq("id", existingAccount.id);
    } else {
      console.log("[gmail-callback] Inserting new account");
      
      dbResult = await supabase.from("email_accounts").insert({
        user_id: userId,
        email_address: userInfo.email,
        provider: "gmail",
        access_token: accessEncrypted.encrypted,
        access_token_iv: accessEncrypted.iv,
        refresh_token: refreshEncrypted?.encrypted || null,
        refresh_token_iv: refreshEncrypted?.iv || null,
        token_expiry: expiryDate.toISOString(),
        encryption_version: 1,
        is_active: true,
      });
    }

    if (dbResult.error) {
      console.error("[gmail-callback] DATABASE ERROR:", dbResult.error);
      return redirectWithError("Failed to save account to database", dbResult.error.message);
    }

    console.log("[gmail-callback] ✅ Account stored successfully");
    
    // Clean up used state
    await supabase.from("oauth_states").delete().eq("state", state);
    console.log("[gmail-callback] ✅ State cleaned up");
    
    console.log("[gmail-callback] ========== REQUEST END (SUCCESS) ==========");

    // ============================================
    // STEP 7: Redirect to Frontend with Success
    // ============================================
    return redirectWithSuccess(userInfo.email);

  } catch (err) {
    // ============================================
    // NEVER SWALLOW ERRORS
    // ============================================
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const errorStack = err instanceof Error ? err.stack : "";
    
    console.error("[gmail-callback] ========== FATAL ERROR ==========");
    console.error("[gmail-callback] Error:", errorMessage);
    console.error("[gmail-callback] Stack:", errorStack);
    console.error("[gmail-callback] ========== REQUEST END (ERROR) ==========");
    
    return redirectWithError(`OAuth callback crashed: ${errorMessage}`);
  }
});

// Helper functions - Use Response.redirect to avoid sandbox issues
function redirectWithSuccess(email: string) {
  const redirectUrl = `${FRONTEND_URL}/dashboard?gmail_connected=true&email=${encodeURIComponent(email)}`;
  console.log("[gmail-callback] Redirecting to:", redirectUrl);
  
  return Response.redirect(redirectUrl, 302);
}

function redirectWithError(message: string, details?: string) {
  const params = new URLSearchParams({
    gmail_error: "true",
    message: message,
  });
  
  if (details) {
    params.set("details", details.substring(0, 500));
  }
  
  const redirectUrl = `${FRONTEND_URL}/dashboard?${params.toString()}`;
  console.log("[gmail-callback] Redirecting to error:", redirectUrl);
  
  return Response.redirect(redirectUrl, 302);
}
