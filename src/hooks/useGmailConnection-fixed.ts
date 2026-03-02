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

// Global connection state to prevent race conditions
let isConnecting = false;
let connectionPromise: Promise<string> | null = null;

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const supabase = getSupabaseClient();

  return useMutation({
    mutationFn: async () => {
      // Prevent multiple simultaneous connection attempts
      if (isConnecting && connectionPromise) {
        console.log("[useConnectGmail] Connection already in progress, returning existing promise");
        return connectionPromise;
      }

      isConnecting = true;
      
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();

      try {
        console.log("[useConnectGmail] ========== MUTATION START ==========");
        
        // Get session
        console.log("[useConnectGmail] Getting session...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("[useConnectGmail] Session error:", sessionError);
          throw new Error(`Authentication error: ${sessionError.message}`);
        }
        
        if (!session?.access_token) {
          console.error("[useConnectGmail] NO ACCESS TOKEN");
          throw new Error("You must be signed in to connect Gmail");
        }
        
        console.log("[useConnectGmail] Session valid");

        // Build URL
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        console.log("[useConnectGmail] VITE_SUPABASE_URL:", supabaseUrl);
        
        if (!supabaseUrl) {
          console.error("[useConnectGmail] MISSING VITE_SUPABASE_URL");
          throw new Error("Configuration error: Supabase URL not set. Check your .env file.");
        }
        
        const functionUrl = `${supabaseUrl}/functions/v1/gmail-connect`;
        console.log("[useConnectGmail] Full URL:", functionUrl);
        
        // Test if URL is valid
        try {
          new URL(functionUrl);
        } catch (e) {
          console.error("[useConnectGmail] INVALID URL:", functionUrl);
          throw new Error(`Invalid Supabase URL: ${supabaseUrl}`);
        }

        // Create connection promise
        connectionPromise = (async () => {
          try {
            console.log("[useConnectGmail] Sending request...");
            console.log("[useConnectGmail] Request details:", {
              url: functionUrl,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token.substring(0, 20)}...`
              }
            });
            
            let response;
            try {
              response = await fetch(functionUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ origin: window.location.origin }),
                signal: abortControllerRef.current?.signal,
              });
            } catch (networkError: any) {
              console.error("[useConnectGmail] NETWORK ERROR DETAILS:");
              console.error("[useConnectGmail] Error name:", networkError.name);
              console.error("[useConnectGmail] Error message:", networkError.message);
              console.error("[useConnectGmail] Error stack:", networkError.stack);
              
              // Check for specific error types
              if (networkError.name === 'AbortError') {
                throw new Error("Request was cancelled. Please try again.");
              }
              
              if (networkError.message.includes("CORS")) {
                throw new Error("CORS error: The server blocked the request. Check function CORS settings.");
              }
              if (networkError.message.includes("Failed to fetch")) {
                throw new Error(`Failed to connect to server at ${functionUrl}. This may be a CORS issue or function is not deployed.`);
              }
              
              throw new Error(`Network error: ${networkError.message}`);
            }

            console.log("[useConnectGmail] Response status:", response.status);

            // Get response text
            const text = await response.text();
            console.log("[useConnectGmail] Raw response:", text);

            // Parse JSON
            let data;
            try {
              data = JSON.parse(text);
            } catch (e) {
              console.error("[useConnectGmail] JSON PARSE ERROR:", e);
              throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
            }

            // Check for HTTP error
            if (!response.ok) {
              console.error("[useConnectGmail] HTTP ERROR:", response.status, data);
              
              // Handle specific error cases
              if (response.status === 429) {
                throw new Error("Too many connection attempts. Please wait a moment and try again.");
              }
              
              if (response.status === 403) {
                throw new Error("Access denied. You may have reached your account limit.");
              }
              
              throw new Error(data.error || `HTTP ${response.status}`);
            }

            // Check for application error
            if (!data.success) {
              console.error("[useConnectGmail] APP ERROR:", data);
              
              // Handle specific application errors
              if (data.error?.includes('limit')) {
                throw new Error(`Account limit reached: ${data.error}`);
              }
              
              if (data.error?.includes('exists')) {
                throw new Error(`Gmail account already connected: ${data.error}`);
              }
              
              throw new Error(data.error || "Application error");
            }

            // Validate authUrl
            if (!data.authUrl && !data.url) {
              console.error("[useConnectGmail] MISSING AUTH URL:", data);
              throw new Error("Server did not return OAuth URL");
            }

            console.log("[useConnectGmail] SUCCESS");
            console.log("[useConnectGmail] ========== MUTATION END ==========");
            
            return data.authUrl || data.url;
          } finally {
            isConnecting = false;
            connectionPromise = null;
            abortControllerRef.current = null;
          }
        })();

        return await connectionPromise;
        
      } catch (error: any) {
        isConnecting = false;
        connectionPromise = null;
        abortControllerRef.current = null;
        
        // Handle AbortError specifically
        if (error.name === 'AbortError' || error.message?.includes('cancelled')) {
          console.log("[useConnectGmail] Request was cancelled");
          throw new Error("Request was cancelled. Please try again.");
        }
        
        // Handle Supabase lock errors
        if (error.message?.includes('Lock broken') || error.message?.includes('steal')) {
          console.log("[useConnectGmail] Database lock conflict detected");
          throw new Error("Another connection attempt is in progress. Please wait a moment and try again.");
        }
        
        throw error;
      }
    },
    onSuccess: (url) => {
      console.log("[useConnectGmail] Redirecting to:", url.substring(0, 50) + "...");
      window.location.href = url;
    },
    onError: (error: any) => {
      console.error("[useConnectGmail] ========== MUTATION ERROR ==========");
      console.error("[useConnectGmail] Error:", error?.message);
      console.error("[useConnectGmail] ========== END ERROR ==========");
      
      // Show toast immediately - don't rely on component
      toast({
        title: " Gmail Connection Failed",
        description: error?.message || "Unknown error occurred",
        variant: "destructive",
        duration: 8000,
      });
      
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
    },
    onSettled: () => {
      // Clean up on both success and error
      isConnecting = false;
      connectionPromise = null;
      abortControllerRef.current = null;
    },
  });
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
      toast({
        title: " Account switched successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({ 
        title: " Failed to switch account", 
        description: error.message, 
        variant: "destructive",
        duration: 5000,
      });
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
      toast({
        title: " Account disconnected",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({ 
        title: " Failed to disconnect account", 
        description: error.message, 
        variant: "destructive",
        duration: 5000,
      });
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

      try {
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
          title: " Sync Complete",
          description: `Processed ${data.threadsProcessed || 0} email threads`,
          duration: 4000,
        });

        return data as { threadsProcessed: number; totalThreads: number };
      } catch (error: any) {
        // Handle AbortError specifically
        if (error.name === 'AbortError') {
          console.log("[useFetchEmails] Request was cancelled");
          return { threadsProcessed: 0, totalThreads: 0 };
        }
        
        throw error;
      }
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

      try {
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
          title: "✅ Scan Complete",
          description: `Found ${data.detected || 0} threads needing follow-up, generated ${data.generated || 0} drafts`,
          duration: 4000,
        });

        return data as {
          threadsAnalyzed: number;
          detected: number;
          generated: number;
        };
      } catch (error: any) {
        // Handle AbortError specifically
        if (error.name === 'AbortError') {
          console.log("[useGenerateFollowups] Request was cancelled");
          return { threadsAnalyzed: 0, detected: 0, generated: 0 };
        }
        
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
    onSettled: () => {
      abortControllerRef.current = null;
    },
  });
}

// Utility function to reset connection state
export const resetConnectionState = () => {
  isConnecting = false;
  connectionPromise = null;
};
