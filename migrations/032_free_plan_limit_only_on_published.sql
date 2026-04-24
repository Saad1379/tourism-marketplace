-- Free-plan tour cap should only apply to *published* tours.
--
-- Before: enforce_free_plan_tour_limits() counted every tour for the guide on
-- INSERT, so a free-plan guide with one draft couldn't even start a second
-- draft. That made iteration impossible (e.g. stashing a draft while building
-- a better one).
--
-- After: the trigger fires on INSERT OR UPDATE and only blocks when the NEW
-- row is being published — either inserted with status='published' or
-- transitioning draft -> published via UPDATE. Drafts are always free.
-- max_capacity cap is still enforced, since it's a per-row plan invariant.

CREATE OR REPLACE FUNCTION public.enforce_free_plan_tour_limits() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_plan        text;
  v_count       integer;
  v_max_tours   integer;
  v_max_cap     integer;
  v_is_publish  boolean;
BEGIN
  -- Figure out whether this write transitions the row into a published state.
  IF TG_OP = 'INSERT' THEN
    v_is_publish := NEW.status = 'published';
  ELSIF TG_OP = 'UPDATE' THEN
    v_is_publish := NEW.status = 'published' AND COALESCE(OLD.status, '') <> 'published';
  ELSE
    v_is_publish := FALSE;
  END IF;

  SELECT plan_type INTO v_plan
  FROM public.guide_plans
  WHERE guide_id = NEW.guide_id;

  IF v_plan IS DISTINCT FROM 'pro' THEN
    SELECT max_tours, max_tourist_capacity
      INTO v_max_tours, v_max_cap
    FROM public.plan_settings
    WHERE plan_type = 'free';

    IF v_max_tours IS NULL THEN v_max_tours := 1; END IF;
    IF v_max_cap   IS NULL THEN v_max_cap   := 7; END IF;

    -- Per-tour capacity limit applies to drafts too so guides can't build a
    -- tour they could never publish. Only check when the value is being set
    -- (INSERT) or changed (UPDATE).
    IF NEW.max_capacity IS NOT NULL AND NEW.max_capacity > v_max_cap THEN
      IF TG_OP = 'INSERT' OR NEW.max_capacity IS DISTINCT FROM OLD.max_capacity THEN
        RAISE EXCEPTION 'Free plan limit: max % adults per tour', v_max_cap;
      END IF;
    END IF;

    IF v_is_publish THEN
      SELECT COUNT(*) INTO v_count
      FROM public.tours
      WHERE guide_id = NEW.guide_id
        AND status = 'published'
        AND id <> NEW.id;

      IF v_count >= v_max_tours THEN
        RAISE EXCEPTION 'Free plan limit reached: only % published tour(s) allowed', v_max_tours;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger to fire on UPDATE too (previously INSERT-only).
DROP TRIGGER IF EXISTS free_plan_tour_limit_trigger ON public.tours;

CREATE TRIGGER free_plan_tour_limit_trigger
  BEFORE INSERT OR UPDATE ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_free_plan_tour_limits();
