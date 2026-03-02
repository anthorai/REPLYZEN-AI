-- =========================================================
-- REPLIFY AI - Reply Detection Engine Migration
-- Adds index for efficient reply detection queries
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

-- Verify 'replied' action is in the CHECK constraint
-- Note: The CHECK constraint in 20260228000000_enterprise_hardening.sql already includes 'replied'
-- If you need to add it manually, run:
-- ALTER TABLE public.followup_logs DROP CONSTRAINT IF EXISTS followup_logs_action_check;
-- ALTER TABLE public.followup_logs ADD CONSTRAINT followup_logs_action_check 
--   CHECK (action IN ('sent','edited','snoozed','deleted','replied','generated','auto_sent','failed'));

-- =========================================================
-- Migration Complete
-- =========================================================
