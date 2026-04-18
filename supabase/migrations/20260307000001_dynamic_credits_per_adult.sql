-- Create cities table for per-city booking fee management
-- Admin can add/edit/delete cities and set credits_per_adult per city.
-- The deduct_credits_on_booking function reads the fee from this table.

CREATE TABLE IF NOT EXISTS public.cities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  slug text NOT NULL UNIQUE,
  credits_per_adult integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.cities IS 'Admin-managed list of cities with per-city booking fee (credits per adult).';
COMMENT ON COLUMN public.cities.slug IS 'Lowercase identifier matching tours.city column value.';
COMMENT ON COLUMN public.cities.credits_per_adult IS '1 credit = €1. Fee charged to guide per adult attendee in this city.';

-- Seed with the previously hardcoded cities
INSERT INTO public.cities (name, country, slug, credits_per_adult) VALUES
  ('Paris',      'France',         'paris',      3),
  ('Rome',       'Italy',          'rome',        3),
  ('Barcelona',  'Spain',          'barcelona',   3),
  ('London',     'United Kingdom', 'london',      3),
  ('Berlin',     'Germany',        'berlin',      3),
  ('Lisbon',     'Portugal',       'lisbon',      3),
  ('Amsterdam',  'Netherlands',    'amsterdam',   3),
  ('Prague',     'Czech Republic', 'prague',      3)
ON CONFLICT (slug) DO NOTHING;

-- RLS: public read for active cities (guides need this to populate dropdowns)
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cities_public_read"
  ON public.cities FOR SELECT
  USING (is_active = true);

CREATE POLICY "cities_service_role_all"
  ON public.cities FOR ALL
  USING (true)
  WITH CHECK (true);

-- Update deduct_credits_on_booking to read fee from cities table
CREATE OR REPLACE FUNCTION public.deduct_credits_on_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guide_id uuid;
  v_adults integer;
  v_city text;
  v_fee integer;
  v_balance numeric;
  v_credits_per_adult integer;
BEGIN
  SELECT b.adults, t.guide_id, t.city
    INTO v_adults, v_guide_id, v_city
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.schedule_id
  JOIN public.tours t ON t.id = ts.tour_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Look up per-city fee; fall back to 3 if city not configured
  SELECT credits_per_adult
    INTO v_credits_per_adult
  FROM public.cities
  WHERE slug = v_city AND is_active = true
  LIMIT 1;

  IF v_credits_per_adult IS NULL THEN
    v_credits_per_adult := 3;
  END IF;

  v_fee := COALESCE(v_adults, 0) * v_credits_per_adult;
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
      format('Credits on hold for booking (%s credits/adult in %s)', v_credits_per_adult, v_city),
      p_booking_id
    );
  ELSE
    UPDATE public.bookings
      SET credits_charged = 0
    WHERE id = p_booking_id;
  END IF;

  PERFORM public.check_credit_balance(v_guide_id);
END;
$$;
