-- Migration 011b: Fix profile trigger to handle tourists and guides separately
-- Description: Conditionally inserts fields based on role and handles errors gracefully

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

  IF user_role = 'tourist' THEN
    -- Tourist: Only basic fields (no phone, city, languages, bio)
    INSERT INTO public.profiles (
      id, 
      email, 
      full_name, 
      role
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
      'tourist'
    )
    ON CONFLICT (id) DO NOTHING;

  ELSIF user_role = 'guide' THEN
    -- Guide: All fields including phone, city, languages, bio
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
      'guide',
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

    -- Create guide-specific records with error handling
    BEGIN
      -- Create free plan for guide
      INSERT INTO public.guide_plans (guide_id, plan_type)
      VALUES (NEW.id, 'free')
      ON CONFLICT (guide_id) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create guide_plans for user %: %', NEW.id, SQLERRM;
    END;

    BEGIN
      -- Create credit balance for guide (starts at 0)
      INSERT INTO public.guide_credits (guide_id, balance)
      VALUES (NEW.id, 0)
      ON CONFLICT (guide_id) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create guide_credits for user %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-creates profile with role-specific fields, guide_plans, and guide_credits';
