-- handle_new_user now honors `requested_role` from auth user metadata so the
-- profile is created with the correct role at signup time — not later via the
-- /auth/callback route (which is fragile and, after the NextAuth refactor,
-- doesn't end in a signed-in client session).
--
-- Signup metadata is set by the register page:
--   supabase.auth.signUp({ options: { data: { requested_role: 'guide' | 'tourist', ... } } })
--
-- For guides we also:
--   - mark onboarding_completed = false so the /become-guide wizard opens
--   - leave guide_approval_status NULL — it moves to 'pending' only when the
--     onboarding form is actually submitted (app/become-guide/page.tsx). If we
--     set it here, the login page's "under review" guard would kick in before
--     the user has a chance to submit.
--   - provision guide_plans (free) and guide_credits (0 balance) rows so the
--     app's RLS-driven reads don't 404 on first visit

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_requested_role text;
  v_primary_role   text;
  v_roles          text[];
  v_onboarding     boolean;
  v_approval       text;
BEGIN
  v_requested_role := NEW.raw_user_meta_data ->> 'requested_role';

  IF v_requested_role = 'guide' THEN
    v_primary_role := 'guide';
    v_roles        := ARRAY['guide', 'tourist'];
    v_onboarding   := FALSE;
    v_approval     := NULL;  -- set to 'pending' when onboarding form is submitted
  ELSE
    v_primary_role := 'tourist';
    v_roles        := ARRAY['tourist'];
    v_onboarding   := TRUE;
    v_approval     := NULL;
  END IF;

  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      avatar_url,
      role,
      roles,
      onboarding_completed,
      guide_approval_status
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
      COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NULL),
      v_primary_role,
      v_roles,
      v_onboarding,
      v_approval
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      -- Only upgrade tourist -> guide, never demote. Keeps re-signup/OAuth
      -- merges from clobbering an existing verified guide.
      role = CASE
        WHEN public.profiles.role = 'guide' THEN 'guide'
        WHEN v_primary_role = 'guide' THEN 'guide'
        ELSE public.profiles.role
      END,
      roles = CASE
        WHEN 'guide' = ANY(public.profiles.roles) THEN public.profiles.roles
        WHEN v_primary_role = 'guide' THEN ARRAY['guide', 'tourist']
        ELSE public.profiles.roles
      END,
      onboarding_completed = CASE
        WHEN v_primary_role = 'guide' AND public.profiles.onboarding_completed IS NOT TRUE THEN FALSE
        ELSE public.profiles.onboarding_completed
      END,
      guide_approval_status = COALESCE(public.profiles.guide_approval_status, EXCLUDED.guide_approval_status);

    IF v_primary_role = 'guide' THEN
      -- Provision guide-side records. Safe to call on re-signup due to upsert.
      INSERT INTO public.guide_plans (guide_id, plan_type)
        VALUES (NEW.id, 'free')
        ON CONFLICT (guide_id) DO NOTHING;
      INSERT INTO public.guide_credits (guide_id, balance)
        VALUES (NEW.id, 0)
        ON CONFLICT (guide_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Profile trigger failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
