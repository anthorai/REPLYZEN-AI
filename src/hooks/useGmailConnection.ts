import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useCallback, useRef } from "react";

export interface GmailAccount {
  id: string;
  email_address: string;
  provider: string;
  token_expiry: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GmailConnectionState {
  accounts: GmailAccount[];
  activeAccount: GmailAccount | null;
  count: number;
  limit: number;
  canAddMore: boolean;
}

// Optimized with stale-while-revalidate and caching
export function useGmailConnection() {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ["gmail-connection", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<GmailConnectionState> => {
      // Parallel fetch for better performance
      const [{ data: accounts, error }, { data: profile }] = await Promise.all([
        supabase
          .from("email_accounts")
          .select("id, email_address, provider, token_expiry, is_active, created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", user!.id)
          .single(),
      ]);

      if (error) throw error;

      const plan = (profile?.plan || "free").toLowerCase();
      const limits: Record<string, number> = {
        free: 1,
        pro: 2,
        business: 5,
      };
      const limit = limits[plan] || 1;

      const activeAccount = accounts?.find((a) => a.is_active) || accounts?.[0] || null;

      return {
        accounts: accounts || [],
        activeAccount,
        count: accounts?.length || 0,
        limit,
        canAddMore: (accounts?.length || 0) < limit,
      };
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useConnectGmail() {
  const queryClient = useQueryClient();
  const supabase = getSupabaseClient();

  const mutation = useMutation({
    mutationFn: async () => {
      // Check current account limit
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.user) {
        throw new Error("No authenticated session");
      }

      const [{ data: accounts }, { data: profile }] = await Promise.all([
        supabase
          .from("email_accounts")
          .select("id")
          .eq("user_id", currentSession.user.id),
        supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", currentSession.user.id)
          .single(),
      ]);

      const plan = (profile?.plan || "free").toLowerCase();
      const limits: Record<string, number> = {
        free: 1,
        pro: 2,
        business: 5,
      };
      const limit = limits[plan] || 1;
      const accountsUsed = accounts?.length || 0;

      if (accountsUsed >= limit) {
        throw new Error("Account limit reached");
      }

      // Initiate OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        throw error;
      }

      // Wait for session after OAuth redirect
      let attempts = 0;
      let sessionData;
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        sessionData = await supabase.auth.getSession();
        if (sessionData.data.session?.user) {
          break;
        }
        attempts++;
      }

      const user = sessionData?.data?.session?.user;
      if (!user) {
        throw new Error("No authenticated session after OAuth");
      }

      // Get user's Google credentials
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) {
        throw new Error("No provider token received");
      }

      // Insert account into database
      const { error: insertError } = await supabase
        .from("email_accounts")
        .insert({
          user_id: user.id,
          email_address: session.user.email,
          provider: "google",
          token_expiry: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
          is_active: accountsUsed === 0,
        });

      if (insertError) {
        throw insertError;
      }

      return data;
    },
    retry: false,
    onSuccess: (data) => {
      console.log("[useConnectGmail] Gmail account connected successfully");
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
    },
    onError: (error: any) => {
      console.error("[useConnectGmail] ========== MUTATION ERROR ==========");
      console.error("[useConnectGmail] Error:", error?.message);
      console.error("[useConnectGmail] ========== END ERROR ==========");
      
      toast({
        title: "❌ Gmail Connection Failed",
        description: error?.message || "Unknown error occurred",
        variant: "destructive",
        duration: 8000,
      });
      
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
    },
  });

  return {
    ...mutation,
    mutate: () => {
      void mutation.mutateAsync();
    },
    mutateAsync: mutation.mutateAsync,
  };
}

export function useSwitchAccount() {
  const queryClient = useQueryClient();
  const supabase = getSupabaseClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke("switch-account", {
        body: { accountId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
  });
}

export function useDisconnectAccount() {
  const queryClient = useQueryClient();
  const supabase = getSupabaseClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke("disconnect-account", {
        body: { accountId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
  });
}

// Optimized fetch emails with request cancellation support
export function useFetchEmails() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const supabase = getSupabaseClient();

  return useMutation({
    mutationFn: async () => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // First, try to get the current session
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !currentSession) {
        await supabase.auth.signOut();
        window.location.href = "/login";
        throw new Error("No active session. Please sign in again.");
      }

      // Check if token is expired or about to expire (within 5 minutes)
      const now = Math.floor(Date.now() / 1000);
      const tokenExp = currentSession.expires_at || 0;
      const isExpired = tokenExp < now;
      const isAboutToExpire = tokenExp < (now + 300); // 5 minutes buffer

      let accessToken = currentSession.access_token;

      // If expired or about to expire, try to refresh
      if (isExpired || isAboutToExpire) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData?.session?.access_token) {
          await supabase.auth.signOut();
          window.location.href = "/login";
          throw new Error("Session expired. Please sign in again.");
        }
        
        accessToken = refreshData.session.access_token;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-emails`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          signal: abortControllerRef.current.signal,
        }
      );

      const raw = await response.text();

      if (!response.ok) {
        throw new Error(raw);
      }

      const data = JSON.parse(raw);

      toast({
        title: "Sync Complete",
        description: `Processed ${data.threadsProcessed || 0} email threads`,
      });

      return data as { threadsProcessed: number; totalThreads: number };
    },
    onSettled: () => {
      abortControllerRef.current = null;
    },
  });
}

// Optimized generate followups with cleanup
export function useGenerateFollowups() {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const supabase = getSupabaseClient();

  return useMutation({
    mutationFn: async () => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Ensure we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      
      if (sessionError || !session) {
        throw new Error("Please sign in to generate followups");
      }

      const { data, error } = await supabase.functions.invoke("generate-followups", {
        signal: abortControllerRef.current.signal,
      });

      if (error) {
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          throw new Error("Authentication failed. Please sign in again.");
        }
        if (error.message?.includes('403') || error.message?.includes('Plan limit')) {
          throw new Error("Plan limit reached. Upgrade to continue.");
        }
        throw error;
      }
      
      if (data?.error) {
        if (data.status === 403 || data.message?.includes("Plan limit")) {
          throw new Error(data.message || "Plan limit reached. Upgrade to continue.");
        }
        throw new Error(data.error);
      }

      toast({
        title: "Scan Complete",
        description: `Found ${data.detected || 0} threads needing follow-up, generated ${data.generated || 0} drafts`,
      });

      return data as {
        threadsAnalyzed: number;
        detected: number;
        generated: number;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
    onSettled: () => {
      abortControllerRef.current = null;
    },
  });
}
