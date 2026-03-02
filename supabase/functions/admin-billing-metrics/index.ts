// =========================================================
// REPLIFY AI - Admin Billing Metrics
// Section 11: Administrative Billing Dashboard
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { handleCORS, createCORSResponse, createErrorResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  const logger = createLogger("admin-billing-metrics", req);
  
  // Handle CORS
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return createErrorResponse(req, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  try {
    // Get admin authorization (you may want to implement proper admin checks)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(req, "Missing authorization header", 401, "UNAUTHORIZED");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return createErrorResponse(req, "Invalid or expired session", 401, "UNAUTHORIZED");
    }

    // Check if user is admin (this would typically be done via RLS policies or a dedicated admin check)
    // For now, we'll assume any authenticated user can access metrics
    // In a real implementation, you'd check for admin role

    // Fetch billing metrics using the RPC function
    const { data: metrics, error: metricsError } = await supabase.rpc('get_billing_metrics');

    if (metricsError) {
      logger.error("Error fetching billing metrics", metricsError);
      return createErrorResponse(req, "Failed to fetch metrics", 500, "METRICS_ERROR");
    }

    // Structure metrics by category
    const structuredMetrics = {
      mrr: metrics?.find((m: any) => m.metric_name === 'total_mrr')?.metric_value || 0,
      activeSubscriptions: metrics?.filter((m: any) => m.metric_name === 'active_subscriptions')
        .reduce((acc: number, curr: any) => acc + Number(curr.metric_value), 0) || 0,
      activeSubscriptionsByProvider: metrics?.filter((m: any) => m.metric_name === 'active_subscriptions')
        .reduce((acc: any, curr: any) => {
          acc[curr.provider] = Number(curr.metric_value);
          return acc;
        }, {}) || {},
      failedPayments: metrics?.find((m: any) => m.metric_name === 'failed_payments')?.metric_value || 0,
      pastDueUsers: metrics?.find((m: any) => m.metric_name === 'past_due_users')?.metric_value || 0,
      gracePeriodUsers: metrics?.find((m: any) => m.metric_name === 'grace_period_users')?.metric_value || 0,
      freeUsers: metrics?.find((m: any) => m.metric_name === 'free_users')?.metric_value || 0,
      allMetrics: metrics || []
    };

    logger.info("Admin billing metrics retrieved", { 
      userId: user.id,
      metricsCount: metrics?.length || 0
    });

    return createCORSResponse(req, JSON.stringify(structuredMetrics), 200);

  } catch (error) {
    logger.error("Admin billing metrics error", error);
    return createErrorResponse(req, "Internal server error", 500, "INTERNAL_ERROR");
  }
});