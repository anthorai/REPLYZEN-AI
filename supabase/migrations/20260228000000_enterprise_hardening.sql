-- =========================================================
-- REPLIFY AI - ENTERPRISE PRODUCTION HARDENING MIGRATION
-- Section 1: Database Hardening
-- Created: 2026-02-28
-- =========================================================

-- =========================================================
-- 1A. followup_logs Table (Secure Audit Trail)
-- =========================================================

CREATE TABLE public.followup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_id UUID REFERENCES public.followup_suggestions(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.email_threads(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('sent','edited','snoozed','deleted','replied','generated','auto_sent','failed')),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.followup_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: User can only SELECT/INSERT their own logs
CREATE POLICY "Users can view their own followup logs" 
  ON public.followup_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own followup logs" 
  ON public.followup_logs 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_followup_logs_user_id ON public.followup_logs(user_id);
CREATE INDEX idx_followup_logs_created_at ON public.followup_logs(created_at);
CREATE INDEX idx_followup_logs_user_created_desc ON public.followup_logs(user_id, created_at DESC);
CREATE INDEX idx_followup_logs_action ON public.followup_logs(action);
CREATE INDEX idx_followup_logs_suggestion_id ON public.followup_logs(suggestion_id);

-- =========================================================
-- 1B. weekly_analytics Table
-- =========================================================

CREATE TABLE public.weekly_analytics (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  open_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  reply_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  generated_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_start)
);

-- Enable Row Level Security
ALTER TABLE public.weekly_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies: User can only read own analytics
CREATE POLICY "Users can view their own weekly analytics" 
  ON public.weekly_analytics 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_weekly_analytics_user_id ON public.weekly_analytics(user_id);
CREATE INDEX idx_weekly_analytics_week_start ON public.weekly_analytics(week_start);

-- =========================================================
-- 1C. Aggregate Weekly Analytics Function
-- =========================================================

CREATE OR REPLACE FUNCTION public.aggregate_weekly_analytics(user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  week_start_date DATE;
  v_sent_count INTEGER;
  v_reply_count INTEGER;
  v_generated_count INTEGER;
  v_failed_count INTEGER;
  v_reply_rate NUMERIC(5,2);
BEGIN
  -- Calculate the start of the current week (Sunday)
  week_start_date := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  
  -- Count sent followups for this week
  SELECT COUNT(*) INTO v_sent_count
  FROM public.followup_logs
  WHERE user_id = user_uuid
    AND action IN ('sent', 'auto_sent')
    AND created_at >= week_start_date
    AND created_at < week_start_date + INTERVAL '7 days';
  
  -- Count replies received for this week
  SELECT COUNT(*) INTO v_reply_count
  FROM public.followup_logs
  WHERE user_id = user_uuid
    AND action = 'replied'
    AND created_at >= week_start_date
    AND created_at < week_start_date + INTERVAL '7 days';
  
  -- Count generated suggestions for this week
  SELECT COUNT(*) INTO v_generated_count
  FROM public.followup_logs
  WHERE user_id = user_uuid
    AND action = 'generated'
    AND created_at >= week_start_date
    AND created_at < week_start_date + INTERVAL '7 days';
  
  -- Count failed attempts for this week
  SELECT COUNT(*) INTO v_failed_count
  FROM public.followup_logs
  WHERE user_id = user_uuid
    AND action = 'failed'
    AND created_at >= week_start_date
    AND created_at < week_start_date + INTERVAL '7 days';
  
  -- Calculate reply rate safely (avoid divide-by-zero)
  IF v_sent_count > 0 THEN
    v_reply_rate := ROUND((v_reply_count::NUMERIC / v_sent_count::NUMERIC) * 100, 2);
  ELSE
    v_reply_rate := 0;
  END IF;
  
  -- Upsert into weekly_analytics (idempotent)
  INSERT INTO public.weekly_analytics (
    user_id, 
    week_start, 
    sent_count, 
    reply_count, 
    reply_rate,
    generated_count,
    failed_count,
    updated_at
  ) VALUES (
    user_uuid, 
    week_start_date, 
    v_sent_count, 
    v_reply_count, 
    v_reply_rate,
    v_generated_count,
    v_failed_count,
    NOW()
  )
  ON CONFLICT (user_id, week_start) 
  DO UPDATE SET
    sent_count = EXCLUDED.sent_count,
    reply_count = EXCLUDED.reply_count,
    reply_rate = EXCLUDED.reply_rate,
    generated_count = EXCLUDED.generated_count,
    failed_count = EXCLUDED.failed_count,
    updated_at = NOW();
    
END;
$$;

-- =========================================================
-- 1D. Additional Performance Indexes on Existing Tables
-- =========================================================

-- Email threads indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_email_threads_user_needs_followup 
  ON public.email_threads(user_id, needs_followup) 
  WHERE needs_followup = true;

CREATE INDEX IF NOT EXISTS idx_email_threads_user_priority 
  ON public.email_threads(user_id, priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_email_threads_last_message 
  ON public.email_threads(user_id, last_message_at DESC);

-- Followup suggestions indexes
CREATE INDEX IF NOT EXISTS idx_followup_suggestions_user_status 
  ON public.followup_suggestions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_followup_suggestions_user_pending 
  ON public.followup_suggestions(user_id, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_followup_suggestions_generated_at 
  ON public.followup_suggestions(user_id, generated_at DESC);

-- Email accounts index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_provider 
  ON public.email_accounts(user_id, provider);

-- =========================================================
-- 1E. Webhook Events Table (for Stripe Idempotency)
-- =========================================================

CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS (only service role can access)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage webhook events" 
  ON public.webhook_events 
  FOR ALL 
  USING (auth.role() = 'service_role');

CREATE INDEX idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at);

-- =========================================================
-- 1F. OAuth State Table (for secure state validation)
-- =========================================================

CREATE TABLE public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'gmail',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own oauth states" 
  ON public.oauth_states 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own oauth states" 
  ON public.oauth_states 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own oauth states" 
  ON public.oauth_states 
  FOR DELETE 
  USING (auth.uid() = user_id);

CREATE INDEX idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX idx_oauth_states_expires ON public.oauth_states(expires_at);

-- Cleanup function for expired oauth states
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.oauth_states
  WHERE expires_at < NOW();
END;
$$;

-- =========================================================
-- 1G. Reply Detection Tracking
-- =========================================================

-- Add reply tracking columns to email_threads
ALTER TABLE public.email_threads 
  ADD COLUMN IF NOT EXISTS reply_detected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_detected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS followup_disabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_email_threads_reply_detected 
  ON public.email_threads(user_id, reply_detected) 
  WHERE reply_detected = true;

-- =========================================================
-- 1H. Token Encryption Metadata
-- =========================================================

-- Add encryption metadata columns to email_accounts
ALTER TABLE public.email_accounts 
  ADD COLUMN IF NOT EXISTS access_token_iv TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_iv TEXT,
  ADD COLUMN IF NOT EXISTS encryption_version INTEGER NOT NULL DEFAULT 1;

-- =========================================================
-- 1I. Daily Digest Tracking
-- =========================================================

CREATE TABLE public.daily_digest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_date DATE NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, digest_date)
);

ALTER TABLE public.daily_digest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own digest logs" 
  ON public.daily_digest_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE INDEX idx_daily_digest_logs_user_date ON public.daily_digest_logs(user_id, digest_date);

-- =========================================================
-- 1J. Rate Limiting Tracking (for edge function coordination)
-- =========================================================

CREATE TABLE public.rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- No RLS - managed by service role only
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage rate limit logs" 
  ON public.rate_limit_logs 
  FOR ALL 
  USING (auth.role() = 'service_role');

CREATE INDEX idx_rate_limit_logs_identifier ON public.rate_limit_logs(identifier, window_end);
CREATE INDEX idx_rate_limit_logs_window ON public.rate_limit_logs(window_end);

-- Cleanup old rate limit logs
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limit_logs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_logs
  WHERE window_end < NOW() - INTERVAL '24 hours';
END;
$$;

-- =========================================================
-- Migration Complete
-- =========================================================
