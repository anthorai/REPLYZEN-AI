-- Multi-Email Account System Migration
-- Adds is_active field and constraints for account switching

-- Add is_active column to email_accounts
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON public.email_accounts(user_id);

-- Create index on is_active for faster active account lookups
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_active ON public.email_accounts(user_id, is_active);

-- Function to ensure only one active account per user
CREATE OR REPLACE FUNCTION public.ensure_single_active_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If setting this account to active, deactivate all others for this user
  IF NEW.is_active = true THEN
    UPDATE public.email_accounts 
    SET is_active = false 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND is_active = true;
  END IF;
  
  -- If this is the first account for a user, make it active
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

-- Trigger to enforce single active account
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
  -- If deleting an active account, set another account as active
  IF OLD.is_active = true THEN
    -- Find another account to make active
    SELECT id INTO remaining_account
    FROM public.email_accounts
    WHERE user_id = OLD.user_id
    AND id != OLD.id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If there's another account, make it active
    IF remaining_account IS NOT NULL THEN
      UPDATE public.email_accounts
      SET is_active = true
      WHERE id = remaining_account;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger to handle account deletion
DROP TRIGGER IF EXISTS handle_account_deletion ON public.email_accounts;
CREATE TRIGGER handle_account_deletion
  BEFORE DELETE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_one_active_on_delete();

-- Add plan column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

-- Create index on plan for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON public.profiles(plan);
