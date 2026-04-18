-- Revenue system functions (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.check_credit_balance(p_guide_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT balance
    INTO v_balance
  FROM public.guide_credits
  WHERE guide_id = p_guide_id;

  IF v_balance IS NULL THEN
    RETURN;
  END IF;

  IF v_balance <= 30 THEN
    INSERT INTO public.notifications (user_id, title, body, read)
    VALUES (
      p_guide_id,
      'Low credit balance',
      'Your credit balance is running low. Top up to keep bookings flowing.',
      false
    );
  END IF;

  IF v_balance <= 15 THEN
    UPDATE public.guide_credits
      SET balance = balance + 50,
          updated_at = NOW()
    WHERE guide_id = p_guide_id;

    INSERT INTO public.credit_transactions (guide_id, type, amount, description, reference_id)
    VALUES (
      p_guide_id,
      'auto_topup',
      50,
      'Automatic top-up (low balance)',
      gen_random_uuid()
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_credits_for_purchase(
  p_guide_id uuid,
  p_credits integer,
  p_description text,
  p_reference_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'Credits must be positive';
  END IF;

  SELECT balance
    INTO v_balance
  FROM public.guide_credits
  WHERE guide_id = p_guide_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.guide_credits (guide_id, balance)
    VALUES (p_guide_id, p_credits);
  ELSE
    UPDATE public.guide_credits
      SET balance = balance + p_credits,
          updated_at = NOW()
    WHERE guide_id = p_guide_id;
  END IF;

  INSERT INTO public.credit_transactions (guide_id, type, amount, description, reference_id)
  VALUES (
    p_guide_id,
    'purchase',
    p_credits,
    p_description,
    NULLIF(p_reference_id, '')::uuid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_credits_on_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guide_id uuid;
  v_adults integer;
  v_fee integer;
  v_plan text;
  v_balance numeric;
BEGIN
  SELECT b.adults, t.guide_id
    INTO v_adults, v_guide_id
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.schedule_id
  JOIN public.tours t ON t.id = ts.tour_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT plan_type
    INTO v_plan
  FROM public.guide_plans
  WHERE guide_id = v_guide_id;

  IF v_plan IS DISTINCT FROM 'pro' THEN
    RETURN;
  END IF;

  v_fee := COALESCE(v_adults, 0) * 2;
  IF v_fee <= 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.credit_transactions
    WHERE reference_id = p_booking_id
      AND type = 'spend'
  ) THEN
    RETURN;
  END IF;

  SELECT balance
    INTO v_balance
  FROM public.guide_credits
  WHERE guide_id = v_guide_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.guide_credits (guide_id, balance)
    VALUES (v_guide_id, 0);
    v_balance := 0;
  END IF;

  IF v_balance < v_fee THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  UPDATE public.guide_credits
    SET balance = balance - v_fee,
        updated_at = NOW()
  WHERE guide_id = v_guide_id;

  UPDATE public.bookings
    SET credits_charged = v_fee
  WHERE id = p_booking_id;

  INSERT INTO public.credit_transactions (guide_id, type, amount, description, reference_id)
  VALUES (
    v_guide_id,
    'spend',
    -v_fee,
    'Booking platform fee',
    p_booking_id
  );

  PERFORM public.check_credit_balance(v_guide_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits_on_cancellation(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guide_id uuid;
  v_adults integer;
  v_fee integer;
  v_plan text;
  v_start_time timestamptz;
  v_balance numeric;
BEGIN
  SELECT b.adults, ts.start_time, t.guide_id
    INTO v_adults, v_start_time, v_guide_id
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.schedule_id
  JOIN public.tours t ON t.id = ts.tour_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_start_time IS NULL THEN
    RETURN;
  END IF;

  IF NOW() > v_start_time - INTERVAL '24 hours' THEN
    RETURN;
  END IF;

  SELECT plan_type
    INTO v_plan
  FROM public.guide_plans
  WHERE guide_id = v_guide_id;

  IF v_plan IS DISTINCT FROM 'pro' THEN
    RETURN;
  END IF;

  v_fee := COALESCE(v_adults, 0) * 2;
  IF v_fee <= 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.credit_transactions
    WHERE reference_id = p_booking_id
      AND type = 'refund'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions
    WHERE reference_id = p_booking_id
      AND type = 'spend'
  ) THEN
    RETURN;
  END IF;

  SELECT balance
    INTO v_balance
  FROM public.guide_credits
  WHERE guide_id = v_guide_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.guide_credits (guide_id, balance)
    VALUES (v_guide_id, v_fee);
  ELSE
    UPDATE public.guide_credits
      SET balance = balance + v_fee,
          updated_at = NOW()
    WHERE guide_id = v_guide_id;
  END IF;

  INSERT INTO public.credit_transactions (guide_id, type, amount, description, reference_id)
  VALUES (
    v_guide_id,
    'refund',
    v_fee,
    'Booking cancellation refund',
    p_booking_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_tour_boost(p_tour_id uuid, p_credits integer, p_days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guide_id uuid;
  v_plan text;
  v_balance numeric;
  v_expires_at timestamptz;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 OR p_days IS NULL OR p_days <= 0 THEN
    RAISE EXCEPTION 'Invalid boost parameters';
  END IF;

  SELECT guide_id
    INTO v_guide_id
  FROM public.tours
  WHERE id = p_tour_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tour not found';
  END IF;

  SELECT plan_type
    INTO v_plan
  FROM public.guide_plans
  WHERE guide_id = v_guide_id;

  IF v_plan IS DISTINCT FROM 'pro' THEN
    RAISE EXCEPTION 'Only Pro guides can boost tours';
  END IF;

  SELECT balance
    INTO v_balance
  FROM public.guide_credits
  WHERE guide_id = v_guide_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_credits THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  UPDATE public.guide_credits
    SET balance = balance - p_credits,
        updated_at = NOW()
  WHERE guide_id = v_guide_id;

  v_expires_at := NOW() + (p_days || ' days')::interval;

  INSERT INTO public.credit_transactions (guide_id, type, amount, description, reference_id)
  VALUES (
    v_guide_id,
    'spend',
    -p_credits,
    'Tour boost purchase',
    p_tour_id
  );

  INSERT INTO public.tour_boosts (tour_id, guide_id, boost_type, credits_spent, expires_at, is_active)
  VALUES (
    p_tour_id,
    v_guide_id,
    'featured_listing',
    p_credits,
    v_expires_at,
    true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_credit_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits_for_purchase(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits_on_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits_on_cancellation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_tour_boost(uuid, integer, integer) TO authenticated;
