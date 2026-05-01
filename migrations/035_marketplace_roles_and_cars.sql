-- =============================================================================
-- Migration 035: Multi-Service Marketplace — Cars + Polymorphic Bookings + Role Widening
-- =============================================================================
-- This migration is ADDITIVE and BACKWARD COMPATIBLE.
-- Existing tours, bookings, and guide/tourist records continue to work unchanged.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Widen the profiles.role to accept "seller" and "buyer" alongside the
--    legacy "guide" and "tourist" values.
--    (No explicit CHECK constraint existed on role — just a default value.)
--    Update the column default so NEW signups get the new terminology.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'buyer';

-- Update the roles array default too
ALTER TABLE public.profiles
  ALTER COLUMN roles SET DEFAULT ARRAY['buyer'::text];

-- ---------------------------------------------------------------------------
-- 2. Update the handle_new_user trigger to use seller/buyer terminology.
--    Still accepts the old guide/tourist values from registration metadata
--    for backward compatibility with existing registration flows.
-- ---------------------------------------------------------------------------

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

  -- Accept both old ('guide') and new ('seller') terminology
  IF v_requested_role = 'guide' OR v_requested_role = 'seller' THEN
    v_primary_role := 'seller';
    v_roles        := ARRAY['seller', 'buyer'];
    v_onboarding   := FALSE;
    v_approval     := NULL;  -- set to 'pending' when onboarding form is submitted
  ELSE
    -- tourist, buyer, or anything else → buyer
    v_primary_role := 'buyer';
    v_roles        := ARRAY['buyer'];
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
      -- Promotion logic: never demote an existing seller/guide. Accept both naming conventions.
      role = CASE
        WHEN public.profiles.role IN ('guide', 'seller') THEN public.profiles.role
        WHEN v_primary_role IN ('guide', 'seller') THEN 'seller'
        ELSE public.profiles.role
      END,
      roles = CASE
        WHEN 'guide' = ANY(public.profiles.roles) OR 'seller' = ANY(public.profiles.roles)
          THEN public.profiles.roles
        WHEN v_primary_role IN ('guide', 'seller')
          THEN ARRAY['seller', 'buyer']
        ELSE public.profiles.roles
      END,
      onboarding_completed = CASE
        WHEN v_primary_role IN ('guide', 'seller') AND public.profiles.onboarding_completed IS NOT TRUE
          THEN FALSE
        ELSE public.profiles.onboarding_completed
      END,
      guide_approval_status = COALESCE(
        public.profiles.guide_approval_status,
        EXCLUDED.guide_approval_status
      );

    IF v_primary_role IN ('guide', 'seller') THEN
      -- Provision seller-side records. Safe to call on re-signup due to upsert.
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

-- ---------------------------------------------------------------------------
-- 3. Polymorphic bookings columns
--    Adds resource_type / resource_id / resource_schedule_id to bookings.
--    Existing rows default to resource_type='tour' and get backfilled.
-- ---------------------------------------------------------------------------

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'tour'
    CHECK (resource_type IN ('tour', 'car')),
  ADD COLUMN IF NOT EXISTS resource_id uuid,
  ADD COLUMN IF NOT EXISTS resource_schedule_id uuid;

-- Backfill existing tour bookings
UPDATE public.bookings b
SET
  resource_type = 'tour',
  resource_id = ts.tour_id,
  resource_schedule_id = b.schedule_id
FROM public.tour_schedules ts
WHERE ts.id = b.schedule_id
  AND b.resource_schedule_id IS NULL;

-- Index for fast lookups by resource
CREATE INDEX IF NOT EXISTS idx_bookings_resource_type_id
  ON public.bookings(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_bookings_resource_schedule_id
  ON public.bookings(resource_schedule_id);

-- ---------------------------------------------------------------------------
-- 4. Cars table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cars (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  seller_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             text        NOT NULL,
  description       text,
  city              text,
  city_slug         text        NOT NULL DEFAULT '',
  country           text,
  price_per_day     numeric,
  make              text,
  model             text,
  year              integer,
  seats             integer     NOT NULL DEFAULT 4 CHECK (seats >= 1),
  transmission      text        DEFAULT 'automatic'
                                  CHECK (transmission IN ('automatic', 'manual')),
  fuel_type         text        DEFAULT 'petrol'
                                  CHECK (fuel_type IN ('petrol', 'diesel', 'electric', 'hybrid')),
  images            text[]      DEFAULT '{}',
  features          text[]      DEFAULT '{}',
  status            text        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'published')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cars_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 5. Car schedules (mirrors tour_schedules structure)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.car_schedules (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  car_id         uuid        NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  start_time     timestamptz NOT NULL,
  end_time       timestamptz NOT NULL,
  capacity       integer     NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  booked_count   integer     NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  price_override numeric,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT car_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT car_schedules_time_order CHECK (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- 6. Indexes for cars and car_schedules
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cars_seller_id
  ON public.cars(seller_id);

CREATE INDEX IF NOT EXISTS idx_cars_status
  ON public.cars(status);

CREATE INDEX IF NOT EXISTS idx_cars_city_slug
  ON public.cars(city_slug)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_car_schedules_car_id
  ON public.car_schedules(car_id);

CREATE INDEX IF NOT EXISTS idx_car_schedules_start_time
  ON public.car_schedules(start_time);

CREATE INDEX IF NOT EXISTS idx_car_schedules_availability
  ON public.car_schedules(car_id, start_time)
  WHERE booked_count < capacity;

-- ---------------------------------------------------------------------------
-- 7. RLS policies for cars
-- ---------------------------------------------------------------------------

ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published cars" ON public.cars;
CREATE POLICY "Public can view published cars"
  ON public.cars FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Sellers can view own cars" ON public.cars;
CREATE POLICY "Sellers can view own cars"
  ON public.cars FOR SELECT
  USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can manage own cars" ON public.cars;
CREATE POLICY "Sellers can manage own cars"
  ON public.cars FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Admins have full access to cars" ON public.cars;
CREATE POLICY "Admins have full access to cars"
  ON public.cars FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 8. RLS policies for car_schedules
-- ---------------------------------------------------------------------------

ALTER TABLE public.car_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view car schedules" ON public.car_schedules;
CREATE POLICY "Public can view car schedules"
  ON public.car_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cars
      WHERE id = car_id AND status = 'published'
    )
  );

DROP POLICY IF EXISTS "Sellers can view own car schedules" ON public.car_schedules;
CREATE POLICY "Sellers can view own car schedules"
  ON public.car_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cars
      WHERE id = car_id AND seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can manage own car schedules" ON public.car_schedules;
CREATE POLICY "Sellers can manage own car schedules"
  ON public.car_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cars
      WHERE id = car_id AND seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cars
      WHERE id = car_id AND seller_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Updated_at trigger for cars
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_cars_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cars_updated_at ON public.cars;
CREATE TRIGGER trg_cars_updated_at
  BEFORE UPDATE ON public.cars
  FOR EACH ROW EXECUTE FUNCTION public.set_cars_updated_at();
