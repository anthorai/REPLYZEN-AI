// =========================================================
// REPLIFY AI - Billing Provider Detection
// Section 11: Payment Provider Routing Logic
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";
import { getPaymentProvider, detectCountryFromIP } from "../_shared/billing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

Deno.serve(async (req) => {
  const logger = createLogger("billing-provider", req);
  
  // Handle CORS
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return createErrorResponse(req, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  try {
    // Get user session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(req, "Missing authorization header", 401, "UNAUTHORIZED");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return createErrorResponse(req, "Invalid or expired session", 401, "UNAUTHORIZED");
    }

    // Get user profile to check billing country
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("billing_country")
      .eq("user_id", user.id)
      .single();

    let countryCode = "US"; // Default
    
    if (profile && profile.billing_country) {
      // Use billing country from profile if available
      countryCode = profile.billing_country;
    } else {
      // Otherwise, detect from IP
      const forwardedFor = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
      const ip = forwardedFor.split(",")[0].trim();
      
      countryCode = await detectCountryFromIP(ip);
      logger.info("Detected country from IP", { ip, countryCode });
    }

    // Determine payment provider based on country
    const provider = getPaymentProvider(countryCode);

    logger.info("Payment provider determined", { 
      userId: user.id, 
      countryCode, 
      provider 
    });

    return createCORSResponse(req, JSON.stringify({ 
      provider,
      countryCode
    }), 200);

  } catch (error) {
    logger.error("Billing provider detection error", error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});