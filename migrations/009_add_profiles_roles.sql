-- Migration: Add roles array to profiles for multi-role support
-- Description: Allows users to be both guide and tourist

DO $$ 
BEGIN
  -- Add roles array if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'roles') THEN
    ALTER TABLE public.profiles ADD COLUMN roles text[] DEFAULT ARRAY['tourist']::text[];
  END IF;
END $$;

-- Migrate existing role data to roles array
UPDATE public.profiles 
SET roles = ARRAY[role]::text[] 
WHERE roles = ARRAY['tourist']::text[] OR roles IS NULL;

COMMENT ON COLUMN public.profiles.roles IS 'User roles array - can be both guide and tourist';
-- Note: Keep the old 'role' column for backward compatibility. Remove it in a future migration after app code is updated.