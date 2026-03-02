import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PLAN_RULES, PlanType } from "@/lib/planRules";
import { useGmailConnection } from "./useGmailConnection";

export interface SubscriptionData {
  currentPlan: PlanType;
  planDetails: {
    followups: number;
    emailAccounts: number;
    autoSend: boolean;
    customTiming: boolean;
    advancedAnalytics: boolean;
    weeklyReports: boolean;
    brandingRemoval: boolean;
  };
  usage: {
    followupsUsed: number;
    accountsConnected: number;
  };
  limits: {
    followups: number;
    emailAccounts: number;
  };
}

export function useSubscription() {
  const { user } = useAuth();
  const { data: gmailConnection, isLoading: gmailLoading } = useGmailConnection();

  return useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SubscriptionData> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Get user profile to get current plan
      const { data: profile, error: profileError } = await getSupabaseClient()
        .from("profiles")
        .select("plan")
        .eq("user_id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        throw profileError;
      }

      const currentPlan = (profile?.plan || "free").toLowerCase() as PlanType;
      const planDetails = PLAN_RULES[currentPlan];

      // Calculate followups used this month
      const currentMonth = new Date();
      currentMonth.setDate(1); // Start of current month
      
      const { count: followupsUsed, error: followupsError } = await getSupabaseClient()
        .from("followup_suggestions")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .eq("status", "sent")
        .gte("sent_at", currentMonth.toISOString());

      if (followupsError) {
        console.error("Error counting followups:", followupsError);
        throw followupsError;
      }

      // Get number of connected accounts
      const { count: accountsConnected, error: accountsError } = await getSupabaseClient()
        .from("email_accounts")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      if (accountsError) {
        console.error("Error counting accounts:", accountsError);
        throw accountsError;
      }

      return {
        currentPlan,
        planDetails,
        usage: {
          followupsUsed: followupsUsed || 0,
          accountsConnected: accountsConnected || 0,
        },
        limits: {
          followups: planDetails.followups,
          emailAccounts: planDetails.emailAccounts,
        },
      };
    },
  });
}

// Hook to check if user has reached plan limits
export function usePlanLimits() {
  const { data: subscription, isLoading } = useSubscription();
  
  const checkFollowupLimit = () => {
    if (!subscription) return true;
    return subscription.usage.followupsUsed < subscription.limits.followups;
  };

  const checkAccountLimit = () => {
    if (!subscription) return true;
    return subscription.usage.accountsConnected < subscription.limits.emailAccounts;
  };

  return {
    isLoading,
    checkFollowupLimit,
    checkAccountLimit,
    subscription
  };
}