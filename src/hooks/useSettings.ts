import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserSettings {
  id: string;
  user_id: string;
  followup_delay_days: number;
  tone_preference: string;
  auto_scan_enabled: boolean;
  daily_digest: boolean;
  weekly_report: boolean;
}

export function useSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserSettings | null> => {
      const { data, error } = await getSupabaseClient()
        .from("user_settings")
        .select("*")
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<UserSettings, "id" | "user_id">>) => {
      const { error } = await getSupabaseClient()
        .from("user_settings")
        .update(updates)
        .eq("user_id", user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
