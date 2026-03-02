-- =========================================================
-- REPLIFY AI - Reply Detection Engine Indexes
-- Run this in Supabase Dashboard SQL Editor
-- =========================================================

-- Add index on thread_id for followup_logs to optimize reply detection
CREATE INDEX IF NOT EXISTS idx_followup_thread 
ON public.followup_logs(thread_id);

-- Add index on action + thread_id for efficient "sent" lookup
CREATE INDEX IF NOT EXISTS idx_followup_thread_action 
ON public.followup_logs(thread_id, action);

-- Add index on created_at for timestamp comparisons
CREATE INDEX IF NOT EXISTS idx_followup_thread_created 
ON public.followup_logs(thread_id, created_at DESC);

-- Verify the indexes were created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'followup_logs' 
AND schemaname = 'public';
