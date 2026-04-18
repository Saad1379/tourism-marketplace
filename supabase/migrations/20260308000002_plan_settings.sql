-- Plan settings table — admin-configurable limits for each plan type.
-- Currently supports 'free' plan. Pro plan has no limits (triggers skip it).

CREATE TABLE IF NOT EXISTS public.plan_settings (
  plan_type           text PRIMARY KEY,
  max_tours           integer NOT NULL DEFAULT 1  CHECK (max_tours >= 0),
  max_schedules_per_week integer NOT NULL DEFAULT 2 CHECK (max_schedules_per_week >= 0),
  max_tourist_capacity integer NOT NULL DEFAULT 7  CHECK (max_tourist_capacity >= 1),
  updated_at          timestamptz DEFAULT now()
);

-- Seed free plan defaults (matching what was previously hardcoded)
INSERT INTO public.plan_settings (plan_type, max_tours, max_schedules_per_week, max_tourist_capacity)
VALUES ('free', 1, 2, 7)
ON CONFLICT (plan_type) DO NOTHING;

-- RLS: admins read/write; service role bypasses
ALTER TABLE public.plan_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_settings_admin_read"
  ON public.plan_settings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "plan_settings_service_role_all"
  ON public.plan_settings FOR ALL
  USING (true) WITH CHECK (true);

-- ─── Updated trigger: enforce_free_plan_tour_limits ─────────────────────────
-- Reads max_tours and max_tourist_capacity from plan_settings instead of hardcoded values.

CREATE OR REPLACE FUNCTION public.enforce_free_plan_tour_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan        text;
  v_count       integer;
  v_max_tours   integer;
  v_max_cap     integer;
BEGIN
  SELECT plan_type INTO v_plan
  FROM public.guide_plans
  WHERE guide_id = NEW.guide_id;

  IF v_plan IS DISTINCT FROM 'pro' THEN
    -- Load configurable limits (fall back to original defaults if row missing)
    SELECT max_tours, max_tourist_capacity
      INTO v_max_tours, v_max_cap
    FROM public.plan_settings
    WHERE plan_type = 'free';

    IF v_max_tours IS NULL THEN v_max_tours := 1; END IF;
    IF v_max_cap   IS NULL THEN v_max_cap   := 7; END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.tours
    WHERE guide_id = NEW.guide_id;

    IF v_count >= v_max_tours THEN
      RAISE EXCEPTION 'Free plan limit reached: only % tour(s) allowed', v_max_tours;
    END IF;

    IF NEW.max_capacity IS NOT NULL AND NEW.max_capacity > v_max_cap THEN
      RAISE EXCEPTION 'Free plan limit: max % adults per tour', v_max_cap;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Updated trigger: enforce_free_plan_schedule_limits ─────────────────────
-- Reads max_schedules_per_week and max_tourist_capacity from plan_settings.

CREATE OR REPLACE FUNCTION public.enforce_free_plan_schedule_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan          text;
  v_guide_id      uuid;
  v_count         integer;
  v_max_schedules integer;
  v_max_cap       integer;
BEGIN
  IF NEW.start_time IS NULL THEN
    RAISE EXCEPTION 'start_time is required';
  END IF;

  SELECT guide_id INTO v_guide_id
  FROM public.tours
  WHERE id = NEW.tour_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tour not found';
  END IF;

  SELECT plan_type INTO v_plan
  FROM public.guide_plans
  WHERE guide_id = v_guide_id;

  IF v_plan IS DISTINCT FROM 'pro' THEN
    -- Load configurable limits
    SELECT max_schedules_per_week, max_tourist_capacity
      INTO v_max_schedules, v_max_cap
    FROM public.plan_settings
    WHERE plan_type = 'free';

    IF v_max_schedules IS NULL THEN v_max_schedules := 2; END IF;
    IF v_max_cap       IS NULL THEN v_max_cap       := 7; END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.tour_schedules ts
    JOIN public.tours t ON t.id = ts.tour_id
    WHERE t.guide_id = v_guide_id
      AND date_trunc('week', ts.start_time) = date_trunc('week', NEW.start_time);

    IF v_count >= v_max_schedules THEN
      RAISE EXCEPTION 'Free plan limit reached: max % schedules per week', v_max_schedules;
    END IF;

    IF NEW.capacity IS NOT NULL AND NEW.capacity > v_max_cap THEN
      RAISE EXCEPTION 'Free plan limit: max % adults per schedule', v_max_cap;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers are already attached — just replacing the functions is enough.
-- Re-declare them to be safe:
DROP TRIGGER IF EXISTS free_plan_tour_limit_trigger ON public.tours;
CREATE TRIGGER free_plan_tour_limit_trigger
BEFORE INSERT ON public.tours
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_plan_tour_limits();

DROP TRIGGER IF EXISTS free_plan_schedule_limit_trigger ON public.tour_schedules;
CREATE TRIGGER free_plan_schedule_limit_trigger
BEFORE INSERT ON public.tour_schedules
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_plan_schedule_limits();
