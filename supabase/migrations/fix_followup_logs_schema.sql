-- =========================================================
-- REPLIFY AI - Fix followup_logs Schema
-- Adds missing action column and indexes
-- =========================================================

-- First check if action column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'followup_logs' 
    AND column_name = 'action'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.followup_logs ADD COLUMN action TEXT;
    
    -- Add CHECK constraint for valid actions
    ALTER TABLE public.followup_logs 
    ADD CONSTRAINT followup_logs_action_check 
    CHECK (action IN ('sent','edited','snoozed','deleted','replied','generated','auto_sent','failed'));
    
    -- Make action NOT NULL after adding constraint
    ALTER TABLE public.followup_logs 
    ALTER COLUMN action SET NOT NULL;
    
    RAISE NOTICE 'Added action column to followup_logs';
  ELSE
    RAISE NOTICE 'action column already exists';
  END IF;
END $$;

-- Add details column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'followup_logs' 
    AND column_name = 'details'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.followup_logs ADD COLUMN details JSONB NOT NULL DEFAULT '{}';
    RAISE NOTICE 'Added details column to followup_logs';
  END IF;
END $$;

-- Add thread_id column if missing (for reply detection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'followup_logs' 
    AND column_name = 'thread_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.followup_logs 
    ADD COLUMN thread_id UUID REFERENCES public.email_threads(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added thread_id column to followup_logs';
  END IF;
END $$;

-- Add suggestion_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'followup_logs' 
    AND column_name = 'suggestion_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.followup_logs 
    ADD COLUMN suggestion_id UUID REFERENCES public.followup_suggestions(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added suggestion_id column to followup_logs';
  END IF;
END $$;

-- =========================================================
-- Add Missing Indexes
-- =========================================================

-- Index on action column
CREATE INDEX IF NOT EXISTS idx_followup_logs_action 
ON public.followup_logs(action);

-- Index on thread_id for reply detection
CREATE INDEX IF NOT EXISTS idx_followup_thread 
ON public.followup_logs(thread_id);

-- Composite index for efficient sent lookup
CREATE INDEX IF NOT EXISTS idx_followup_thread_action 
ON public.followup_logs(thread_id, action);

-- Index for timestamp comparisons
CREATE INDEX IF NOT EXISTS idx_followup_thread_created 
ON public.followup_logs(thread_id, created_at DESC);

-- Index on user_id
CREATE INDEX IF NOT EXISTS idx_followup_logs_user_id 
ON public.followup_logs(user_id);

-- Index on created_at
CREATE INDEX IF NOT EXISTS idx_followup_logs_created_at 
ON public.followup_logs(created_at);

-- Composite index for user + created ordering
CREATE INDEX IF NOT EXISTS idx_followup_logs_user_created_desc 
ON public.followup_logs(user_id, created_at DESC);

-- Index on suggestion_id
CREATE INDEX IF NOT EXISTS idx_followup_logs_suggestion_id 
ON public.followup_logs(suggestion_id);

-- =========================================================
-- Verify Schema
-- =========================================================

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'followup_logs' 
AND table_schema = 'public'
ORDER BY ordinal_position;
