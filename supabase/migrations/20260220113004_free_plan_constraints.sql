-- Free plan constraints enforced via BEFORE INSERT triggers

CREATE OR REPLACE FUNCTION public.enforce_free_plan_tour_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_count integer;
BEGIN
  SELECT plan_type
    INTO v_plan
  FROM public.guide_plans
  WHERE guide_id = NEW.guide_id;

  IF v_plan IS DISTINCT FROM 'pro' THEN
    SELECT COUNT(*)
      INTO v_count
    FROM public.tours
    WHERE guide_id = NEW.guide_id;

    IF v_count >= 1 THEN
      RAISE EXCEPTION 'Free plan limit reached: only 1 tour allowed';
    END IF;

    IF NEW.max_capacity IS NOT NULL AND NEW.max_capacity > 7 THEN
      RAISE EXCEPTION 'Free plan limit: max 7 adults per tour';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_free_plan_schedule_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_guide_id uuid;
  v_count integer;
BEGIN
  IF NEW.start_time IS NULL THEN
    RAISE EXCEPTION 'start_time is required';
  END IF;

  SELECT guide_id
    INTO v_guide_id
  FROM public.tours
  WHERE id = NEW.tour_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tour not found';
  END IF;

  SELECT plan_type
    INTO v_plan
  FROM public.guide_plans
  WHERE guide_id = v_guide_id;

  IF v_plan IS DISTINCT FROM 'pro' THEN
    SELECT COUNT(*)
      INTO v_count
    FROM public.tour_schedules ts
    JOIN public.tours t ON t.id = ts.tour_id
    WHERE t.guide_id = v_guide_id
      AND date_trunc('week', ts.start_time) = date_trunc('week', NEW.start_time);

    IF v_count >= 2 THEN
      RAISE EXCEPTION 'Free plan limit reached: max 2 schedules per week';
    END IF;

    IF NEW.capacity IS NOT NULL AND NEW.capacity > 7 THEN
      RAISE EXCEPTION 'Free plan limit: max 7 adults per schedule';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS free_plan_tour_limit_trigger ON public.tours;
CREATE TRIGGER free_plan_tour_limit_trigger
BEFORE INSERT ON public.tours
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_plan_tour_limits();

DROP TRIGGER IF EXISTS free_plan_schedule_limit_trigger ON public.tour_schedules;
CREATE TRIGGER free_plan_schedule_limit_trigger
BEFORE INSERT ON public.tour_schedules
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_plan_schedule_limits();
