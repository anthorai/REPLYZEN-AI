-- =========================================================
-- REPLIFY AI - DUAL PAYMENT GATEWAY BILLING SYSTEM
-- Razorpay (India) + Paddle (International)
-- =========================================================

-- =========================================================
-- 1. EXTENDED USER BILLING PROFILE
-- =========================================================

-- Add billing columns to existing profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS payment_provider TEXT CHECK (payment_provider IN ('razorpay', 'paddle')),
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'free' 
    CHECK (subscription_status IN ('free', 'active', 'past_due', 'inactive', 'cancelled')),
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'free' 
    CHECK (plan_type IN ('free', 'pro', 'business')),
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS billing_country TEXT,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_failed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS subscription_cancelled_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient billing queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_type ON public.profiles(plan_type);
CREATE INDEX IF NOT EXISTS idx_profiles_payment_provider ON public.profiles(payment_provider);
CREATE INDEX IF NOT EXISTS idx_profiles_grace_period ON public.profiles(grace_period_until) 
  WHERE grace_period_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_current_period_end ON public.profiles(current_period_end);
CREATE INDEX IF NOT EXISTS idx_profiles_provider_subscription ON public.profiles(provider_subscription_id) 
  WHERE provider_subscription_id IS NOT NULL;

-- =========================================================
-- 2. BILLING EVENTS TABLE (Audit Trail)
-- =========================================================

CREATE TABLE public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'paddle')),
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only service role can insert billing events
CREATE POLICY "Service role can insert billing events" 
  ON public.billing_events 
  FOR INSERT 
  TO service_role
  WITH CHECK (true);

-- Only service role and admins can read billing events
CREATE POLICY "Service role can read billing events" 
  ON public.billing_events 
  FOR SELECT 
  TO service_role
  USING (true);

-- Users cannot access billing events directly (security)
CREATE POLICY "Users cannot access billing events" 
  ON public.billing_events 
  FOR ALL 
  TO authenticated
  USING (false);

-- Indexes for billing events
CREATE INDEX idx_billing_events_user_id ON public.billing_events(user_id);
CREATE INDEX idx_billing_events_created_at ON public.billing_events(created_at DESC);
CREATE INDEX idx_billing_events_provider ON public.billing_events(provider);
CREATE INDEX idx_billing_events_event_id ON public.billing_events(event_id);
CREATE INDEX idx_billing_events_unprocessed ON public.billing_events(processed) 
  WHERE processed = false;

-- =========================================================
-- 3. SUBSCRIPTION HISTORY TABLE
-- =========================================================

CREATE TABLE public.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'paddle')),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'pro', 'business')),
  event_type TEXT NOT NULL,
  amount DECIMAL(10, 2),
  currency TEXT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription history" 
  ON public.subscription_history 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscription history" 
  ON public.subscription_history 
  FOR ALL 
  TO service_role
  USING (true);

CREATE INDEX idx_subscription_history_user_id ON public.subscription_history(user_id);
CREATE INDEX idx_subscription_history_created_at ON public.subscription_history(created_at DESC);

-- =========================================================
-- 4. PAYMENT METHODS TABLE
-- =========================================================

CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'paddle')),
  provider_payment_method_id TEXT NOT NULL,
  type TEXT,
  last_four TEXT,
  brand TEXT,
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own payment methods" 
  ON public.payment_methods 
  FOR ALL 
  USING (auth.uid() = user_id);

CREATE INDEX idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX idx_payment_methods_provider ON public.payment_methods(provider);

-- =========================================================
-- 5. UNIFIED SUBSCRIPTION STATE FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION public.update_subscription_state(
  p_user_id UUID,
  p_provider TEXT,
  p_event_type TEXT,
  p_plan_type TEXT DEFAULT NULL,
  p_period_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_cancel_at_period_end BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_new_status TEXT;
  v_grace_period TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get current status
  SELECT subscription_status INTO v_current_status
  FROM public.profiles
  WHERE user_id = p_user_id;

  -- Determine new status based on event type
  CASE p_event_type
    WHEN 'subscription.activated', 'subscription_created', 'subscription.charged', 'transaction_completed' THEN
      v_new_status := 'active';
      v_grace_period := NULL;
    WHEN 'payment.failed', 'subscription_payment_failed' THEN
      v_new_status := 'past_due';
      v_grace_period := NOW() + INTERVAL '5 days';
    WHEN 'subscription.cancelled', 'subscription_cancelled' THEN
      IF p_cancel_at_period_end THEN
        v_new_status := v_current_status; -- Keep current until period ends
      ELSE
        v_new_status := 'cancelled';
        v_grace_period := NULL;
      END IF;
    WHEN 'subscription.expired', 'subscription.past_due.grace_expired' THEN
      v_new_status := 'inactive';
      v_grace_period := NULL;
    ELSE
      -- Unknown event, log but don't change
      RETURN;
  END CASE;

  -- Update profile
  UPDATE public.profiles
  SET 
    subscription_status = COALESCE(v_new_status, subscription_status),
    plan_type = COALESCE(p_plan_type, plan_type),
    payment_provider = COALESCE(p_provider, payment_provider),
    current_period_end = COALESCE(p_period_end, current_period_end),
    cancel_at_period_end = p_cancel_at_period_end,
    grace_period_until = v_grace_period,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log to history
  INSERT INTO public.subscription_history (
    user_id,
    provider,
    plan_type,
    event_type,
    period_start,
    period_end
  ) VALUES (
    p_user_id,
    p_provider,
    COALESCE(p_plan_type, 'free'),
    p_event_type,
    NOW(),
    p_period_end
  );

END;
$$;

-- =========================================================
-- 6. GRACE PERIOD CHECK FUNCTION (for cron job)
-- =========================================================

CREATE OR REPLACE FUNCTION public.check_grace_periods()
RETURNS TABLE (
  user_id UUID,
  old_status TEXT,
  new_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.profiles
  SET 
    subscription_status = 'inactive',
    plan_type = 'free',
    grace_period_until = NULL,
    cancel_at_period_end = false,
    updated_at = NOW()
  WHERE 
    subscription_status = 'past_due'
    AND grace_period_until < NOW()
  RETURNING 
    public.profiles.user_id,
    'past_due'::TEXT as old_status,
    'inactive'::TEXT as new_status;
END;
$$;

-- =========================================================
-- 7. GET BILLING PROVIDER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_billing_provider(p_country_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF UPPER(p_country_code) = 'IN' THEN
    RETURN 'razorpay';
  ELSE
    RETURN 'paddle';
  END IF;
END;
$$;

-- =========================================================
-- 8. CHECK SUBSCRIPTION ACCESS FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION public.check_subscription_access(
  p_user_id UUID,
  p_required_plan TEXT DEFAULT 'pro'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_plan TEXT;
  v_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT 
    subscription_status,
    plan_type,
    current_period_end
  INTO v_status, v_plan, v_period_end
  FROM public.profiles
  WHERE user_id = p_user_id;

  -- Free plan check
  IF p_required_plan = 'free' THEN
    RETURN true;
  END IF;

  -- Must be active
  IF v_status != 'active' THEN
    RETURN false;
  END IF;

  -- Check plan level
  IF p_required_plan = 'pro' AND v_plan IN ('pro', 'business') THEN
    RETURN true;
  END IF;

  IF p_required_plan = 'business' AND v_plan = 'business' THEN
    RETURN true;
  END IF;

  -- Check period hasn't expired
  IF v_period_end IS NOT NULL AND v_period_end < NOW() THEN
    RETURN false;
  END IF;

  RETURN false;
END;
$$;

-- =========================================================
-- 9. ADMIN METRICS FUNCTIONS
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_billing_metrics()
RETURNS TABLE (
  metric_name TEXT,
  metric_value NUMERIC,
  provider TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Total MRR
  RETURN QUERY
  SELECT 
    'total_mrr'::TEXT as metric_name,
    COUNT(*)::NUMERIC * 29.99 as metric_value,
    'all'::TEXT as provider
  FROM public.profiles
  WHERE subscription_status = 'active' AND plan_type IN ('pro', 'business');

  -- Active subscriptions by provider
  RETURN QUERY
  SELECT 
    'active_subscriptions'::TEXT as metric_name,
    COUNT(*)::NUMERIC as metric_value,
    COALESCE(payment_provider, 'none')::TEXT as provider
  FROM public.profiles
  WHERE subscription_status = 'active'
  GROUP BY payment_provider;

  -- Failed payments
  RETURN QUERY
  SELECT 
    'failed_payments'::TEXT as metric_name,
    SUM(payment_failed_count)::NUMERIC as metric_value,
    COALESCE(payment_provider, 'none')::TEXT as provider
  FROM public.profiles
  GROUP BY payment_provider;

  -- Past due users
  RETURN QUERY
  SELECT 
    'past_due_users'::TEXT as metric_name,
    COUNT(*)::NUMERIC as metric_value,
    COALESCE(payment_provider, 'none')::TEXT as provider
  FROM public.profiles
  WHERE subscription_status = 'past_due'
  GROUP BY payment_provider;

  -- Grace period users
  RETURN QUERY
  SELECT 
    'grace_period_users'::TEXT as metric_name,
    COUNT(*)::NUMERIC as metric_value,
    COALESCE(payment_provider, 'none')::TEXT as provider
  FROM public.profiles
  WHERE grace_period_until IS NOT NULL AND grace_period_until > NOW()
  GROUP BY payment_provider;

  -- Free users
  RETURN QUERY
  SELECT 
    'free_users'::TEXT as metric_name,
    COUNT(*)::NUMERIC as metric_value,
    'all'::TEXT as provider
  FROM public.profiles
  WHERE subscription_status = 'free';

END;
$$;

-- =========================================================
-- 10. TRIGGER TO AUTO-DOWNGRADE EXPIRED SUBSCRIPTIONS
-- =========================================================

CREATE OR REPLACE FUNCTION public.auto_downgrade_expired_subscriptions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If subscription has expired and not in grace period
  IF NEW.current_period_end < NOW() 
     AND NEW.subscription_status = 'active'
     AND (NEW.grace_period_until IS NULL OR NEW.grace_period_until < NOW())
     AND NOT NEW.cancel_at_period_end THEN
    
    NEW.subscription_status := 'inactive';
    NEW.plan_type := 'free';
    
    -- Log the downgrade
    INSERT INTO public.subscription_history (
      user_id,
      provider,
      plan_type,
      event_type,
      period_end
    ) VALUES (
      NEW.user_id,
      COALESCE(NEW.payment_provider, 'unknown'),
      'free',
      'subscription.expired.auto_downgrade',
      NEW.current_period_end
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_downgrade_expired
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_downgrade_expired_subscriptions();

-- =========================================================
-- Migration Complete
-- =========================================================
