-- Migration 011: Update profile trigger to properly handle guide signups
-- Description: Adds missing profile fields and auto-creates guide_plans + guide_credits

-- Step 1: Add missing columns to profiles table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE public.profiles ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'city') THEN
    ALTER TABLE public.profiles ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'languages') THEN
    ALTER TABLE public.profiles ADD COLUMN languages text[];
  END IF;
END $$;

-- Step 2: Update the trigger function to handle all fields and create guide records
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get role from metadata
  user_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'tourist');

  -- Create profile with all fields
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role,
    phone,
    city,
    languages,
    bio
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    user_role,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'city', NULL),
    CASE 
      WHEN NEW.raw_user_meta_data -> 'languages' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data -> 'languages'))
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data ->> 'bio', NULL)
  )
  ON CONFLICT (id) DO NOTHING;

  -- If user is a guide, create guide_plans and guide_credits
  IF user_role = 'guide' THEN
    -- Create free plan for guide
    INSERT INTO public.guide_plans (guide_id, plan_type)
    VALUES (NEW.id, 'free')
    ON CONFLICT (guide_id) DO NOTHING;

    -- Create credit balance for guide
    INSERT INTO public.guide_credits (guide_id, balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (guide_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 3: Ensure trigger exists (recreate if needed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-creates profile, guide_plans, and guide_credits on user signup';
