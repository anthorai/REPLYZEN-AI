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

// Optimized query with stale-while-revalidate pattern
export function useFollowups() {
  return useQuery({
    queryKey: ["followups"],
    queryFn: async (): Promise<FollowUpWithThread[]> => {
      const supabase = getSupabaseClient();
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
        .order("generated_at", { ascending: false })
        .limit(100); // Add pagination limit

      if (error) throw error;

      return (data || []).map((item: any) => ({
        ...item,
        thread: item.email_threads || null,
      }));
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
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
      const { data, error } = await supabase.functions.invoke("send-followup", {
        body: { suggestion_id: suggestionId, edited_text: editedText },
      });
      if (error) throw error;
      if (data?.error) {
        // Check if it's a plan limit error
        if (data.status === 403 || data.message?.includes("Plan limit")) {
          throw new Error(data.message || "Plan limit reached. Upgrade to continue.");
        }
        throw new Error(data.error);
      }
      return data;
    },
    onMutate: async ({ suggestionId }) => {
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
      // Rollback on error
      if (context?.previousFollowups) {
        queryClient.setQueryData(["followups"], context.previousFollowups);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
  });
}

// Hook for prefetching followups (for faster navigation)
export function usePrefetchFollowups() {
  const queryClient = useQueryClient();
  
  return useCallback(() => {
    const supabase = getSupabaseClient();
    queryClient.prefetchQuery({
      queryKey: ["followups"],
      queryFn: async () => {
        const { data } = await supabase
          .from("followup_suggestions")
          .select(`
            id,
            generated_text,
            tone,
            priority,
            status,
            generated_at,
            thread_id,
            email_threads:thread_id (
              id,
              subject,
              last_message_from,
              last_user_message_at
            )
          `)
          .eq("status", "pending")
          .order("generated_at", { ascending: false })
          .limit(50);
        return data || [];
      },
      staleTime: 60 * 1000,
    });
  }, [queryClient]);
}
