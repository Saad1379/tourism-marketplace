-- Force update deduct_credits_on_booking to use 3 credits per adult
DROP FUNCTION IF EXISTS public.deduct_credits_on_booking(uuid);

CREATE FUNCTION public.deduct_credits_on_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guide_id uuid;
  v_adults integer;
  v_fee integer;
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

  -- 3 credits per adult (not 2)
  v_fee := COALESCE(v_adults, 0) * 3;
  IF v_fee <= 0 THEN
    RETURN;
  END IF;

  -- Check if already processed
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

  -- Only hold credits if guide has sufficient balance
  IF v_balance >= v_fee THEN
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
      'Credits on hold for booking',
      p_booking_id
    );
  ELSE
    -- Still allow booking but don't charge credits
    UPDATE public.bookings
      SET credits_charged = 0
    WHERE id = p_booking_id;
  END IF;

  PERFORM public.check_credit_balance(v_guide_id);
END;
$$;
