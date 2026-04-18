-- Update deduct_credits_on_booking to put credits on hold (3 per adult)
CREATE OR REPLACE FUNCTION public.deduct_credits_on_booking(p_booking_id uuid)
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

  -- 3 credits per adult
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

-- Create new function to finalize credits on attendance
CREATE OR REPLACE FUNCTION public.finalize_credits_on_attendance(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guide_id uuid;
  v_credits_charged integer;
BEGIN
  SELECT b.credits_charged, t.guide_id
    INTO v_credits_charged, v_guide_id
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.schedule_id
  JOIN public.tours t ON t.id = ts.tour_id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_credits_charged IS NULL OR v_credits_charged <= 0 THEN
    RETURN;
  END IF;

  -- Check if already finalized
  IF EXISTS (
    SELECT 1
    FROM public.credit_transactions
    WHERE reference_id = p_booking_id
      AND type = 'attendance_fee'
  ) THEN
    RETURN;
  END IF;

  -- Record attendance confirmation (credits already deducted during hold)
  INSERT INTO public.credit_transactions (guide_id, type, amount, description, reference_id)
  VALUES (
    v_guide_id,
    'attendance_fee',
    0,
    format('Attendance confirmed - %s credits finalized', v_credits_charged),
    p_booking_id
  );
END;
$$;

-- Update refund function to use 3 credits per adult
CREATE OR REPLACE FUNCTION public.refund_credits_on_cancellation(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guide_id uuid;
  v_credits_charged integer;
  v_start_time timestamptz;
  v_balance numeric;
BEGIN
  SELECT b.credits_charged, ts.start_time, t.guide_id
    INTO v_credits_charged, v_start_time, v_guide_id
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

  -- Only refund if cancelled more than 24 hours before tour
  IF NOW() > v_start_time - INTERVAL '24 hours' THEN
    RETURN;
  END IF;

  IF v_credits_charged IS NULL OR v_credits_charged <= 0 THEN
    RETURN;
  END IF;

  -- Check if already refunded
  IF EXISTS (
    SELECT 1
    FROM public.credit_transactions
    WHERE reference_id = p_booking_id
      AND type = 'refund'
  ) THEN
    RETURN;
  END IF;

  -- Check if credits were actually charged
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
    VALUES (v_guide_id, v_credits_charged);
  ELSE
    UPDATE public.guide_credits
      SET balance = balance + v_credits_charged,
          updated_at = NOW()
    WHERE guide_id = v_guide_id;
  END IF;

  INSERT INTO public.credit_transactions (guide_id, type, amount, description, reference_id)
  VALUES (
    v_guide_id,
    'refund',
    v_credits_charged,
    'Booking cancellation refund',
    p_booking_id
  );
END;
$$;
