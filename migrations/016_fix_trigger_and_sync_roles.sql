-- Migration 016: Robust & Simple Auth Trigger
-- Description: 
-- 1. Syncs schema for multi-role support
-- 2. Implements a minimalist, high-reliability trigger to prevent 500 errors
-- 3. Ensures confirmation emails are never blocked by profile creation issues

-- 1. Ensure columns exist and have correct types
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{tourist}',
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT TRUE;

-- 2. Create the most robust version of the trigger (Minimalist Approach)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We use a dedicated BEGIN block for the INSERT to catch errors locally
  BEGIN
    INSERT INTO public.profiles (
      id, 
      email, 
      full_name, 
      avatar_url,
      role,
      roles,
      onboarding_completed
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
      COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NULL),
      'tourist',         -- Always default identity
      ARRAY['tourist'],  -- Always default identity
      TRUE               -- Default to completed (callback will toggle for guides)
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url;
  EXCEPTION WHEN OTHERS THEN
    -- If profile creation fails, we LOG it but don't CRASH the signup.
    -- This guarantees the confirmation email is sent by Supabase.
    RAISE WARNING 'Profile trigger failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 3. Reset the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
