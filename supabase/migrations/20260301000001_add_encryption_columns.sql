-- =========================================================
-- MIGRATION: Add Encryption Columns to email_accounts
-- Fix for: Could not find the 'access_token_iv' column
-- =========================================================

-- Add encryption columns to email_accounts if they don't exist
ALTER TABLE public.email_accounts 
  ADD COLUMN IF NOT EXISTS access_token_iv TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_iv TEXT,
  ADD COLUMN IF NOT EXISTS encryption_version INTEGER NOT NULL DEFAULT 0;

-- Add updated_at column if it doesn't exist
ALTER TABLE public.email_accounts 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create index for encryption version queries
CREATE INDEX IF NOT EXISTS idx_email_accounts_encryption_version 
  ON public.email_accounts(encryption_version);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_email_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_email_accounts_updated_at ON public.email_accounts;
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_accounts_updated_at();

-- Verify columns were added
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'email_accounts'
  AND column_name IN ('access_token_iv', 'refresh_token_iv', 'encryption_version');
  
  IF col_count = 3 THEN
    RAISE NOTICE '✅ Encryption columns added successfully';
  ELSE
    RAISE WARNING '⚠️ Some columns may be missing. Found: %', col_count;
  END IF;
END $$;
