-- Fix missing tables - safe to run multiple times

-- Create profiles table if not exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create email_accounts table if not exists
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  access_token TEXT,
  access_token_iv TEXT,
  refresh_token TEXT,
  refresh_token_iv TEXT,
  token_expiry TIMESTAMPTZ,
  encryption_version INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own email accounts" ON public.email_accounts;
CREATE POLICY "Users can view their own email accounts" ON public.email_accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own email accounts" ON public.email_accounts;
CREATE POLICY "Users can insert their own email accounts" ON public.email_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own email accounts" ON public.email_accounts;
CREATE POLICY "Users can update their own email accounts" ON public.email_accounts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own email accounts" ON public.email_accounts;
CREATE POLICY "Users can delete their own email accounts" ON public.email_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON public.email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_active ON public.email_accounts(user_id, is_active);

-- Create email_threads table if not exists
CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_from TEXT,
  last_user_message_at TIMESTAMPTZ,
  needs_followup BOOLEAN NOT NULL DEFAULT false,
  priority_score INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'Low',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, thread_id)
);

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own threads" ON public.email_threads;
CREATE POLICY "Users can view their own threads" ON public.email_threads FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own threads" ON public.email_threads;
CREATE POLICY "Users can insert their own threads" ON public.email_threads FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own threads" ON public.email_threads;
CREATE POLICY "Users can update their own threads" ON public.email_threads FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own threads" ON public.email_threads;
CREATE POLICY "Users can delete their own threads" ON public.email_threads FOR DELETE USING (auth.uid() = user_id);

-- Create followup_suggestions table if not exists
CREATE TABLE IF NOT EXISTS public.followup_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_text TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'professional',
  priority TEXT NOT NULL DEFAULT 'Low',
  status TEXT NOT NULL DEFAULT 'pending',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE public.followup_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own suggestions" ON public.followup_suggestions;
CREATE POLICY "Users can view their own suggestions" ON public.followup_suggestions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own suggestions" ON public.followup_suggestions;
CREATE POLICY "Users can insert their own suggestions" ON public.followup_suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own suggestions" ON public.followup_suggestions;
CREATE POLICY "Users can update their own suggestions" ON public.followup_suggestions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own suggestions" ON public.followup_suggestions;
CREATE POLICY "Users can delete their own suggestions" ON public.followup_suggestions FOR DELETE USING (auth.uid() = user_id);

-- Auto-create profile and settings on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to ensure only one active account per user
CREATE OR REPLACE FUNCTION public.ensure_single_active_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.email_accounts 
    SET is_active = false 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND is_active = true;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.email_accounts 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id
  ) THEN
    NEW.is_active := true;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_active_account ON public.email_accounts;
CREATE TRIGGER enforce_single_active_account
  BEFORE INSERT OR UPDATE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_active_account();

-- Function to ensure at least one active account remains when deleting
CREATE OR REPLACE FUNCTION public.ensure_one_active_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_account UUID;
BEGIN
  IF OLD.is_active = true THEN
    SELECT id INTO remaining_account
    FROM public.email_accounts
    WHERE user_id = OLD.user_id
    AND id != OLD.id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF remaining_account IS NOT NULL THEN
      UPDATE public.email_accounts
      SET is_active = true
      WHERE id = remaining_account;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS handle_account_deletion ON public.email_accounts;
CREATE TRIGGER handle_account_deletion
  BEFORE DELETE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_one_active_on_delete();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
