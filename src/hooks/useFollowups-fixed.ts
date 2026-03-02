import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { useCallback } from "react";

export interface FollowUpWithThread {
  id: string;
  generated_text: string;
  tone: string;
  priority: string;
  status: string;
  generated_at: string;
  sent_at: string | null;
  thread_id: string;
  user_id: string;
  thread: {
    id: string;
    subject: string | null;
    last_message_from: string | null;
    last_user_message_at: string | null;
    thread_id: string;
    priority: string;
  } | null;
}

// Optimized query with comprehensive error handling
export function useFollowups() {
  return useQuery({
    queryKey: ["followups"],
    queryFn: async (): Promise<FollowUpWithThread[]> => {
      console.log('[useFollowups] Fetching followups...');
      const supabase = getSupabaseClient();
      
      try {
        // First, check if user is authenticated
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[useFollowups] Session error:', sessionError);
          throw new Error(`Authentication error: ${sessionError.message}`);
        }
        
        if (!session) {
          console.log('[useFollowups] No session found');
          throw new Error('You must be signed in to view follow-ups');
        }

        console.log('[useFollowups] Session valid, fetching followups...');
        
        const { data, error } = await supabase
          .from("followup_suggestions")
          .select(`
            id,
            generated_text,
            tone,
            priority,
            status,
            generated_at,
            sent_at,
            thread_id,
            user_id,
            email_threads:thread_id (
              id,
              subject,
              last_message_from,
              last_user_message_at,
              thread_id,
              priority
            )
          `)
          .eq("status", "pending")
          .eq("user_id", session.user.id)
          .order("generated_at", { ascending: false })
          .limit(100);

        if (error) {
          console.error('[useFollowups] Database error:', error);
          
          // Handle specific database errors
          if (error.code === 'PGRST116') {
            throw new Error('Database schema error. Please contact support.');
          }
          
          if (error.code === 'PGRST301') {
            throw new Error('Permission denied. You may not have access to this data.');
          }
          
          if (error.code === 'PGRST204') {
            console.log('[useFollowups] No followups found');
            return [];
          }
          
          throw new Error(`Database error: ${error.message}`);
        }

        console.log('[useFollowups] Raw data received:', data?.length || 0, 'items');

        const processedData = (data || []).map((item: any) => {
          console.log('[useFollowups] Processing item:', item.id);
          return {
            ...item,
            thread: item.email_threads || null,
          };
        });

        console.log('[useFollowups] Processed data:', processedData.length, 'followups');
        return processedData;

      } catch (err: any) {
        console.error('[useFollowups] Unexpected error:', err);
        
        // Handle network errors
        if (err.message?.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your connection and try again.');
        }
        
        // Handle timeout errors
        if (err.message?.includes('timeout')) {
          throw new Error('Request timed out. Please try again.');
        }
        
        // Re-throw the error if it's already formatted
        if (err.message?.includes('Authentication error') || 
            err.message?.includes('Database error') ||
            err.message?.includes('Permission denied')) {
          throw err;
        }
        
        // Generic error
        throw new Error('Failed to load follow-ups. Please try again.');
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      console.log(`[useFollowups] Retry attempt ${failureCount}:`, error?.message);
      
      // Don't retry on authentication errors
      if (error?.message?.includes('Authentication error')) {
        return false;
      }
      
      // Don't retry on permission errors
      if (error?.message?.includes('Permission denied')) {
        return false;
      }
      
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// Optimized send mutation with optimistic updates
export function useSendFollowup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      suggestionId,
      editedText,
    }: {
      suggestionId: string;
      editedText?: string;
    }) => {
      const supabase = getSupabaseClient();
      console.log('[useSendFollowup] Sending follow-up:', suggestionId);
      
      try {
        const { data, error } = await supabase.functions.invoke("send-followup", {
          body: { suggestion_id: suggestionId, edited_text: editedText },
        });
        
        if (error) {
          console.error('[useSendFollowup] Function error:', error);
          throw error;
        }
        
        if (data?.error) {
          console.error('[useSendFollowup] Application error:', data);
          
          // Check if it's a plan limit error
          if (data.status === 403 || data.message?.includes("Plan limit")) {
            throw new Error(data.message || "Plan limit reached. Upgrade to continue.");
          }
          
          throw new Error(data.error);
        }
        
        console.log('[useSendFollowup] Send successful:', data);
        return data;
        
      } catch (err: any) {
        console.error('[useSendFollowup] Unexpected error:', err);
        
        // Handle network errors
        if (err.message?.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your connection and try again.');
        }
        
        // Handle timeout errors
        if (err.message?.includes('timeout')) {
          throw new Error('Request timed out. Please try again.');
        }
        
        throw err;
      }
    },
    onMutate: async ({ suggestionId }) => {
      console.log('[useSendFollowup] Optimistic update for:', suggestionId);
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["followups"] });
      
      // Snapshot previous value
      const previousFollowups = queryClient.getQueryData<FollowUpWithThread[]>(["followups"]);
      
      // Optimistically update
      queryClient.setQueryData<FollowUpWithThread[]>(["followups"], (old) => {
        if (!old) return old;
        return old.filter((f) => f.id !== suggestionId);
      });
      
      return { previousFollowups };
    },
    onError: (err, variables, context) => {
      console.error('[useSendFollowup] Error in mutation:', err);
      
      // Rollback on error
      if (context?.previousFollowups) {
        queryClient.setQueryData(["followups"], context.previousFollowups);
      }
    },
    onSuccess: () => {
      console.log('[useSendFollowup] Mutation successful');
    },
    onSettled: () => {
      console.log('[useSendFollowup] Mutation settled');
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
  });
}

// Hook for prefetching followups (for faster navigation)
export function usePrefetchFollowups() {
  const queryClient = useQueryClient();
  
  return useCallback(() => {
    console.log('[usePrefetchFollowups] Prefetching followups...');
    const supabase = getSupabaseClient();
    
    queryClient.prefetchQuery({
      queryKey: ["followups"],
      queryFn: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            return [];
          }
          
          const { data } = await supabase
            .from("followup_suggestions")
            .select(`
              id,
              generated_text,
              tone,
              priority,
              status,
              generated_at,
              sent_at,
              thread_id,
              email_threads:thread_id (
                id,
                subject,
                last_message_from,
                last_user_message_at
              )
            `)
            .eq("status", "pending")
            .eq("user_id", session.user.id)
            .order("generated_at", { ascending: false })
            .limit(50);
            
          return (data || []).map((item: any) => ({
            ...item,
            thread: item.email_threads || null,
          }));
        } catch (err) {
          console.error('[usePrefetchFollowups] Error:', err);
          return [];
        }
      },
      staleTime: 60 * 1000,
    });
  }, [queryClient]);
}
