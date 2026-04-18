


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."_recalc_booked_count_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  sid uuid;
begin
  sid := coalesce(new.schedule_id, old.schedule_id);

  update public.tour_schedules ts
  set booked_count = coalesce((
    select sum(b.total_guests)
    from public.bookings b
    where b.schedule_id = ts.id
      and b.status in ('confirmed','pending')
  ), 0)
  where ts.id = sid;

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."_recalc_booked_count_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activate_tour_boost"("p_tour_id" "uuid", "p_credits" integer, "p_days" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."activate_tour_boost"("p_tour_id" "uuid", "p_credits" integer, "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_credits"("p_guide_id" "uuid", "p_credits" integer, "p_description" "text", "p_reference_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_balance numeric;
  v_is_uuid boolean;
  v_final_description text;
BEGIN
  -- Check if this payment has already been processed 
  -- (supporting both old description-based checks and new reference_id checks)
  IF p_reference_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE (description LIKE '%' || p_reference_id || '%' OR reference_id::text = p_reference_id)
      AND type = 'purchase'
  ) THEN
    RETURN;
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

  -- Regex check to safely determine if p_reference_id is a valid UUID
  v_is_uuid := p_reference_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  -- If it's a real Stripe Webhook UUID passing through, we keep the description perfectly clean.
  -- If it's a local mock stripe string (pi_mock_123...), we append it so it's not lost.
  IF v_is_uuid OR p_reference_id IS NULL THEN
    v_final_description := p_description;
  ELSE
    v_final_description := p_description || ' - ' || p_reference_id;
  END IF;

  INSERT INTO public.credit_transactions (
    guide_id,
    type,
    amount,
    description,
    reference_id
  )
  VALUES (
    p_guide_id,
    'purchase',
    p_credits,
    v_final_description,
    CASE WHEN v_is_uuid THEN p_reference_id::uuid ELSE NULL END
  );
END;
$_$;


ALTER FUNCTION "public"."add_credits"("p_guide_id" "uuid", "p_credits" integer, "p_description" "text", "p_reference_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_credits_for_purchase"("p_guide_id" "uuid", "p_credits" integer, "p_description" "text", "p_reference_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."add_credits_for_purchase"("p_guide_id" "uuid", "p_credits" integer, "p_description" "text", "p_reference_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."booking_credit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.deduct_credits_on_booking(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."booking_credit_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."booking_refund_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.refund_credits_on_cancellation(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."booking_refund_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_credit_balance"("p_guide_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."check_credit_balance"("p_guide_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "tourist_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "adults" integer DEFAULT 0 NOT NULL,
    "children" integer DEFAULT 0 NOT NULL,
    "total_guests" integer DEFAULT 0 NOT NULL,
    "credits_charged" integer DEFAULT 0 NOT NULL,
    "user_id" "uuid",
    "payment_status" "text" DEFAULT 'not_required'::"text" NOT NULL,
    "tour_id" "uuid",
    "completed_at" timestamp with time zone,
    "tourist_confirmed_attendance" boolean,
    "guide_confirmed_attendance" boolean,
    "attendance_confirmed_at" timestamp with time zone,
    "review_id" "uuid",
    "attended_at" timestamp with time zone,
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'upcoming'::"text", 'completed'::"text", 'cancelled'::"text", 'no_show'::"text"]))),
    CONSTRAINT "bookings_total_guests_check" CHECK (("total_guests" = ("adults" + "children")))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bookings"."tourist_confirmed_attendance" IS 'Tourist confirmed this booking attendance';



COMMENT ON COLUMN "public"."bookings"."guide_confirmed_attendance" IS 'Guide confirmed this booking attendance';



COMMENT ON COLUMN "public"."bookings"."attendance_confirmed_at" IS 'Timestamp when both parties confirmed';



COMMENT ON COLUMN "public"."bookings"."attended_at" IS 'Final attendance timestamp';



CREATE OR REPLACE FUNCTION "public"."create_booking"("p_schedule_id" "uuid", "p_adults" integer, "p_children" integer) RETURNS "public"."bookings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_booking public.bookings;
  v_tour_id uuid;
  v_capacity int;
  v_booked int;
  v_total int;
  v_cost int;
begin
  -- must be logged in
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_total := coalesce(p_adults,0) + coalesce(p_children,0);
  if v_total <= 0 then
    raise exception 'Total guests must be > 0';
  end if;

  -- lock schedule row to prevent race conditions
  select s.tour_id, s.capacity, s.booked_count
  into v_tour_id, v_capacity, v_booked
  from public.tour_schedules s
  where s.id = p_schedule_id
  for update;

  if v_tour_id is null then
    raise exception 'Schedule not found';
  end if;

  if (v_booked + v_total) > v_capacity then
    raise exception 'Not enough capacity';
  end if;

  -- credits cost: 3 per adult, children free (your rule)
  v_cost := coalesce(p_adults,0) * 3;

  insert into public.bookings (
    schedule_id,
    tour_id,
    tourist_id,
    adults,
    children,
    total_guests,
    credits_charged,
    payment_status,
    status,
    created_at
  )
  values (
    p_schedule_id,
    v_tour_id,
    auth.uid(),
    coalesce(p_adults,0),
    coalesce(p_children,0),
    v_total,
    v_cost,
    'unpaid',
    'confirmed',
    now()
  )
  returning * into v_booking;

  -- update booked_count safely
  update public.tour_schedules
  set booked_count = booked_count + v_total
  where id = p_schedule_id;

  return v_booking;
end;
$$;


ALTER FUNCTION "public"."create_booking"("p_schedule_id" "uuid", "p_adults" integer, "p_children" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_as"("p_user_id" "uuid", "p_schedule_id" "uuid", "p_adults" integer, "p_children" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_booking_id uuid;
  v_capacity int;
  v_booked int;
  v_tour_id uuid;
  v_guide_id uuid;
  v_total int;
  v_cost int;
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  v_total := coalesce(p_adults,0) + coalesce(p_children,0);
  if v_total <= 0 then
    raise exception 'At least 1 participant required';
  end if;

  select tour_id, capacity, booked_count
  into v_tour_id, v_capacity, v_booked
  from public.tour_schedules
  where id = p_schedule_id
  for update;

  if v_tour_id is null then
    raise exception 'Schedule not found';
  end if;

  if (v_capacity - v_booked) < v_total then
    raise exception 'Not enough capacity';
  end if;

  select guide_id into v_guide_id
  from public.tours
  where id = v_tour_id;

  insert into public.bookings (user_id, schedule_id, adults, children, status, created_at)
  values (p_user_id, p_schedule_id, p_adults, p_children, 'confirmed', now())
  returning id into v_booking_id;

  update public.tour_schedules
  set booked_count = booked_count + v_total
  where id = p_schedule_id;

  v_cost := coalesce(p_adults,0) * 3;

  insert into public.guide_credits (id, guide_id, balance, updated_at)
  values (gen_random_uuid(), v_guide_id, 0, now())
  on conflict (guide_id) do nothing;

  update public.guide_credits
  set balance = balance - v_cost,
      updated_at = now()
  where guide_id = v_guide_id;

  return v_booking_id;
end;
$$;


ALTER FUNCTION "public"."create_booking_as"("p_user_id" "uuid", "p_schedule_id" "uuid", "p_adults" integer, "p_children" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_review_qr_session"("p_schedule_id" "uuid", "p_guide_id" "uuid", "p_ttl_minutes" integer DEFAULT 180) RETURNS TABLE("session_id" "uuid", "public_token" "text", "expires_at" timestamp with time zone, "slots_total" integer, "slots_remaining" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_tour_id uuid;
  v_city_slug text;
  v_slots integer;
  v_token text;
  v_token_hash text;
  v_session_id uuid;
  v_expires_at timestamptz;
  v_attempt integer;
BEGIN
  SELECT
    ts.tour_id,
    COALESCE(
      NULLIF(t.city_slug, ''),
      NULLIF(trim(both '-' FROM regexp_replace(lower(COALESCE(t.city, '')), '[^a-z0-9]+', '-', 'g')), ''),
      'unknown-city'
    )
  INTO v_tour_id, v_city_slug
  FROM public.tour_schedules ts
  JOIN public.tours t ON t.id = ts.tour_id
  WHERE ts.id = p_schedule_id
    AND t.guide_id = p_guide_id
  LIMIT 1;

  IF v_tour_id IS NULL THEN
    RAISE EXCEPTION 'SCHEDULE_NOT_OWNED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.review_qr_allowlist allowlist
    WHERE allowlist.guide_id = p_guide_id
      AND allowlist.city_slug = v_city_slug
      AND allowlist.enabled = true
  ) THEN
    RAISE EXCEPTION 'GUIDE_NOT_ALLOWLISTED';
  END IF;

  SELECT COALESCE(SUM(GREATEST(COALESCE(a.adults_attended, 0), 0)), 0)::integer
  INTO v_slots
  FROM public.attendance a
  JOIN public.bookings b ON b.id = a.booking_id
  WHERE b.schedule_id = p_schedule_id
    AND a.guide_id = p_guide_id
    AND COALESCE(a.attended, false) = true
    AND COALESCE(a.confirmed_by_guide, false) = true;

  IF COALESCE(v_slots, 0) <= 0 THEN
    RAISE EXCEPTION 'NO_ELIGIBLE_ATTENDANCE';
  END IF;

  FOR v_attempt IN 1..3 LOOP
    BEGIN
      UPDATE public.review_qr_sessions
      SET status = 'closed',
          closed_at = now()
      WHERE schedule_id = p_schedule_id
        AND status = 'active';

      v_token := encode(gen_random_bytes(24), 'hex');
      v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
      v_expires_at := now() + make_interval(mins => GREATEST(COALESCE(p_ttl_minutes, 180), 10));

      INSERT INTO public.review_qr_sessions (
        schedule_id,
        tour_id,
        guide_id,
        city_slug,
        status,
        slots_total,
        slots_used,
        public_token_hash,
        expires_at
      )
      VALUES (
        p_schedule_id,
        v_tour_id,
        p_guide_id,
        v_city_slug,
        'active',
        v_slots,
        0,
        v_token_hash,
        v_expires_at
      )
      RETURNING id INTO v_session_id;

      RETURN QUERY
      SELECT v_session_id, v_token, v_expires_at, v_slots, v_slots;
      RETURN;
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempt = 3 THEN
          RAISE EXCEPTION 'SESSION_CREATE_CONFLICT';
        END IF;
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."create_review_qr_session"("p_schedule_id" "uuid", "p_guide_id" "uuid", "p_ttl_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_credits_on_booking"("p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."deduct_credits_on_booking"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_free_plan_schedule_limits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."enforce_free_plan_schedule_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_free_plan_tour_limits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."enforce_free_plan_tour_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_credits_on_attendance"("p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."finalize_credits_on_attendance"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_review_qr_tour_link"("p_tour_id" "uuid", "p_guide_id" "uuid") RETURNS TABLE("tour_id" "uuid", "guide_id" "uuid", "public_token" "text", "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_city_slug text;
  v_owner_id uuid;
  v_token text;
  v_token_hash text;
  v_link public.review_qr_tour_links%ROWTYPE;
BEGIN
  SELECT
    t.guide_id,
    COALESCE(
      NULLIF(t.city_slug, ''),
      NULLIF(trim(both '-' FROM regexp_replace(lower(COALESCE(t.city, '')), '[^a-z0-9]+', '-', 'g')), ''),
      'unknown-city'
    )
  INTO v_owner_id, v_city_slug
  FROM public.tours t
  WHERE t.id = p_tour_id
  LIMIT 1;

  IF v_owner_id IS NULL OR v_owner_id <> p_guide_id THEN
    RAISE EXCEPTION 'TOUR_NOT_OWNED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.review_qr_allowlist allowlist
    WHERE allowlist.guide_id = p_guide_id
      AND allowlist.city_slug = v_city_slug
      AND allowlist.enabled = true
  ) THEN
    RAISE EXCEPTION 'GUIDE_NOT_ALLOWLISTED';
  END IF;

  SELECT *
  INTO v_link
  FROM public.review_qr_tour_links
  WHERE tour_id = p_tour_id
  LIMIT 1;

  IF v_link.id IS NOT NULL THEN
    UPDATE public.review_qr_tour_links
    SET status = 'active',
        updated_at = now()
    WHERE id = v_link.id
    RETURNING * INTO v_link;

    RETURN QUERY
    SELECT v_link.tour_id, v_link.guide_id, v_link.public_token, v_link.status;
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.review_qr_tour_links (
    tour_id,
    guide_id,
    public_token,
    public_token_hash,
    status,
    updated_at
  )
  VALUES (
    p_tour_id,
    p_guide_id,
    v_token,
    v_token_hash,
    'active',
    now()
  )
  ON CONFLICT (tour_id)
  DO UPDATE SET
    status = 'active',
    updated_at = now()
  RETURNING * INTO v_link;

  IF v_link.guide_id <> p_guide_id THEN
    RAISE EXCEPTION 'TOUR_NOT_OWNED';
  END IF;

  RETURN QUERY
  SELECT v_link.tour_id, v_link.guide_id, v_link.public_token, v_link.status;
END;
$$;


ALTER FUNCTION "public"."get_or_create_review_qr_tour_link"("p_tour_id" "uuid", "p_guide_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_qr_session_public_state"("p_public_token" "text") RETURNS TABLE("session_id" "uuid", "schedule_id" "uuid", "tour_id" "uuid", "guide_id" "uuid", "tour_title" "text", "guide_name" "text", "slots_total" integer, "slots_used" integer, "slots_remaining" integer, "expires_at" timestamp with time zone, "status" "text", "is_open" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_token_hash text;
BEGIN
  IF COALESCE(trim(p_public_token), '') = '' THEN
    RETURN;
  END IF;

  v_token_hash := encode(digest(p_public_token, 'sha256'), 'hex');

  UPDATE public.review_qr_sessions
  SET status = 'expired'
  WHERE public_token_hash = v_token_hash
    AND status = 'active'
    AND expires_at <= now();

  RETURN QUERY
  SELECT
    s.id,
    s.schedule_id,
    s.tour_id,
    s.guide_id,
    COALESCE(t.title, 'Tour') AS tour_title,
    COALESCE(g.full_name, 'Guide') AS guide_name,
    s.slots_total,
    s.slots_used,
    GREATEST(s.slots_total - s.slots_used, 0) AS slots_remaining,
    s.expires_at,
    s.status,
    (s.status = 'active' AND s.expires_at > now() AND s.slots_used < s.slots_total) AS is_open
  FROM public.review_qr_sessions s
  LEFT JOIN public.tours t ON t.id = s.tour_id
  LEFT JOIN public.profiles g ON g.id = s.guide_id
  WHERE s.public_token_hash = v_token_hash
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_qr_session_public_state"("p_public_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ranked_tours"("search_city" "text" DEFAULT NULL::"text", "search_language" "text" DEFAULT NULL::"text", "limit_val" integer DEFAULT 100, "offset_val" integer DEFAULT 0) RETURNS TABLE("tour_id" "uuid", "guide_id" "uuid", "title" "text", "city" "text", "price" numeric, "duration_minutes" integer, "meeting_point" "text", "images" "text"[], "photos" "text"[], "schedule_id" "uuid", "start_time" timestamp with time zone, "capacity" integer, "booked_count" integer, "language" "text", "plan_type" "text", "is_newcomer" boolean, "pool_type" "text", "rank_score" numeric, "guide_name" "text", "guide_avatar" "text", "guide_role" "text", "tour_rating" double precision, "tour_review_count" integer, "is_boosted" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  weight_relevance numeric := 0.45;
  weight_rating numeric := 0.30;
  weight_reviews numeric := 0.10;
  weight_reliability numeric := 0.10;
  weight_freshness numeric := 0.05;
BEGIN
  RETURN QUERY
  WITH eligible_schedules AS (
    SELECT 
      t.id as t_id,
      t.guide_id,
      t.title,
      t.city,
      t.price,
      t.duration_minutes,
      t.meeting_point,
      t.images,
      t.photos,
      (SELECT COALESCE(AVG(r.rating), 0) FROM public.reviews r WHERE r.tour_id = t.id AND r.is_published = true) as tour_rating,
      (SELECT COUNT(*) FROM public.reviews r WHERE r.tour_id = t.id AND r.is_published = true) as tour_review_count,
      t.created_at as tour_created_at,
      s.id as s_id,
      s.start_time,
      s.capacity,
      s.booked_count,
      s.language,
      p.full_name as guide_name,
      p.avatar_url as guide_avatar,
      p.role as guide_role,
      -- Determine the closest valid schedule for this specific tour
      ROW_NUMBER() OVER(PARTITION BY t.id ORDER BY s.start_time ASC) as rn
    FROM public.tours t
    JOIN public.tour_schedules s ON t.id = s.tour_id
    JOIN public.profiles p ON t.guide_id = p.id
    WHERE t.status = 'published'
      AND s.start_time > NOW()
      AND s.booked_count < s.capacity
      AND (search_city IS NULL OR t.city ILIKE '%' || search_city || '%')
      AND (search_language IS NULL OR s.language = search_language)
  ),
  scored_tours AS (
    SELECT 
      es.*,
      gs.reviews_count,
      gs.bayesian_rating,
      gs.reliability_score,
      gs.is_newcomer,
      COALESCE(gp.plan_type, 'free') as plan_type,
      
      -- Norms
      1.0 as relevance_norm,
      (gs.bayesian_rating / 5.0) as rating_norm,
      LEAST(gs.reviews_count / 100.0, 1.0) as reviews_norm,
      gs.reliability_score as reliability_norm,
      GREATEST(0.5, 1.0 - (EXTRACT(EPOCH FROM (NOW() - es.tour_created_at)) / (365 * 24 * 3600))) as freshness_norm,
      
      -- Multipliers
      CASE 
        WHEN es.booked_count >= es.capacity THEN 0.05
        WHEN (es.capacity - es.booked_count) <= 2 THEN 0.85
        ELSE 1.00
      END as availability_mult,
      
      CASE WHEN COALESCE(gp.plan_type, 'free') = 'pro' THEN 1.15 ELSE 1.00 END as plan_mult,
      
      -- Time Decaying Boost Multiplier
      CASE 
        WHEN tb.is_active = true AND tb.expires_at > NOW() AND (gs.bayesian_rating >= 4.2 OR gs.is_newcomer) THEN
          LEAST(
            1.25, 
            1.0 + (
              (COALESCE(tb.credits_spent, 50) / 100.0) * -- Boost Strength 
              (
                EXTRACT(EPOCH FROM (tb.expires_at - NOW())) / 
                NULLIF(EXTRACT(EPOCH FROM (tb.expires_at - tb.starts_at)), 0)
              ) -- Time Factor (Remaining % of time)
            )
          )
        ELSE 1.00 
      END as boost_mult,
      
      CASE 
        WHEN gs.reviews_count < 10 THEN 1.25
        WHEN gs.reviews_count < 25 THEN 1.15
        WHEN gs.reviews_count < 50 THEN 1.05
        ELSE 1.00
      END as newcomer_mult,
      
      CASE WHEN COALESCE(gp.plan_type, 'free') = 'free' THEN 1.08 ELSE 1.00 END as free_protection_mult
      
    FROM eligible_schedules es
    LEFT JOIN public.guide_stats_view gs ON es.guide_id = gs.guide_id
    LEFT JOIN public.guide_plans gp ON es.guide_id = gp.guide_id
    LEFT JOIN (
      SELECT 
        b.tour_id, 
        MAX(b.credits_spent) as credits_spent, 
        bool_or(b.is_active) as is_active, 
        MAX(b.expires_at) as expires_at,
        MAX(b.created_at) as starts_at
      FROM public.tour_boosts b
      WHERE b.is_active = true AND b.expires_at > NOW()
      GROUP BY b.tour_id
    ) tb ON es.t_id = tb.tour_id
    WHERE es.rn = 1 -- <--- CRITICAL: Only take the 1 closest schedule per tour
  )
  SELECT 
    st.t_id as tour_id,
    st.guide_id,
    st.title,
    st.city,
    st.price,
    st.duration_minutes,
    st.meeting_point,
    st.images,
    st.photos,
    st.s_id as schedule_id,
    st.start_time,
    st.capacity,
    st.booked_count,
    st.language,
    st.plan_type,
    st.is_newcomer,
    CASE 
      WHEN st.is_newcomer THEN 'newcomer'
      WHEN st.plan_type = 'pro' THEN 'pro'
      ELSE 'free'
    END as pool_type,
    (
      ((weight_relevance * st.relevance_norm) + 
       (weight_rating * st.rating_norm) + 
       (weight_reviews * st.reviews_norm) + 
       (weight_reliability * st.reliability_norm) + 
       (weight_freshness * st.freshness_norm))
      * st.availability_mult 
      * st.plan_mult 
      * st.boost_mult 
      * st.newcomer_mult 
      * st.free_protection_mult
    ) as rank_score,
    st.guide_name,
    st.guide_avatar,
    st.guide_role,
    COALESCE(st.tour_rating, 0)::double precision as tour_rating,
    COALESCE(st.tour_review_count, 0)::integer as tour_review_count,
    (st.boost_mult > 1.0) as is_boosted
  FROM scored_tours st
  ORDER BY rank_score DESC
  LIMIT limit_val OFFSET offset_val;
END;
$$;


ALTER FUNCTION "public"."get_ranked_tours"("search_city" "text", "search_language" "text", "limit_val" integer, "offset_val" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_review_qr_tour_public_state"("p_public_token" "text") RETURNS TABLE("tour_id" "uuid", "guide_id" "uuid", "tour_title" "text", "guide_name" "text", "session_id" "uuid", "schedule_id" "uuid", "schedule_start_time" timestamp with time zone, "slots_total" integer, "slots_used" integer, "slots_remaining" integer, "expires_at" timestamp with time zone, "status" "text", "is_open" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  v_token_hash text;
  v_tour_id uuid;
  v_guide_id uuid;
begin
  if coalesce(trim(p_public_token), '') = '' then
    return;
  end if;

  v_token_hash := encode(extensions.digest(p_public_token, 'sha256'), 'hex');

  select l.tour_id, l.guide_id
  into v_tour_id, v_guide_id
  from public.review_qr_tour_links l
  where l.public_token_hash = v_token_hash
    and l.status = 'active'
  limit 1;

  if v_tour_id is null then
    raise exception 'INVALID_TOUR_QR_TOKEN';
  end if;

  update public.review_qr_sessions s
  set status = 'expired'
  where s.tour_id = v_tour_id
    and s.guide_id = v_guide_id
    and s.status = 'active'
    and s.expires_at <= now();

  return query
  select
    t.id as tour_id,
    v_guide_id as guide_id,
    coalesce(t.title, 'Tour') as tour_title,
    coalesce(p.full_name, 'Guide') as guide_name,
    s.id as session_id,
    s.schedule_id,
    ts.start_time as schedule_start_time,
    s.slots_total,
    s.slots_used,
    greatest(s.slots_total - s.slots_used, 0) as slots_remaining,
    s.expires_at,
    s.status,
    (s.status = 'active' and s.expires_at > now() and s.slots_used < s.slots_total) as is_open
  from public.tours t
  left join public.profiles p on p.id = v_guide_id
  left join public.review_qr_sessions s
    on s.tour_id = t.id
   and s.guide_id = v_guide_id
   and s.status = 'active'
   and s.expires_at > now()
   and s.slots_used < s.slots_total
  left join public.tour_schedules ts on ts.id = s.schedule_id
  where t.id = v_tour_id
  order by ts.start_time asc nulls last;
end;
$$;


ALTER FUNCTION "public"."get_review_qr_tour_public_state"("p_public_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.profiles (id, email, role, created_at)
  values (new.id, new.email, 'tourist', now())
  on conflict do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- We use a dedicated BEGIN block for the INSERT to catch errors locally
  BEGIN
    INSERT INTO public.profiles (
      id, 
      email, 
      full_name, 
      avatar_url,
      role,
      roles,
      onboarding_completed
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
      COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NULL),
      'tourist',         -- Always default identity
      ARRAY['tourist'],  -- Always default identity
      TRUE               -- Default to completed (callback will toggle for guides)
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url;
  EXCEPTION WHEN OTHERS THEN
    -- If profile creation fails, we LOG it but don't CRASH the signup.
    -- This guarantees the confirmation email is sent by Supabase.
    RAISE WARNING 'Profile trigger failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Minimal identity trigger. Business logic is handled in the application layer.';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_deleted = false
  )
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tour_id uuid;
  v_guide_id uuid;
  v_tour_title text;
  v_start timestamptz;
begin
  -- only on confirmed/pending bookings
  if new.status not in ('confirmed','pending') then
    return new;
  end if;

  select s.tour_id, s.start_time
  into v_tour_id, v_start
  from public.tour_schedules s
  where s.id = new.schedule_id;

  select t.guide_id, t.title
  into v_guide_id, v_tour_title
  from public.tours t
  where t.id = v_tour_id;

  -- Tourist notification
  insert into public.notifications (user_id, title, body)
  values (
    new.tourist_id,
    'Booking confirmed',
    'Your booking for "' || coalesce(v_tour_title,'Tour') || '" on ' || coalesce(to_char(v_start,'YYYY-MM-DD HH24:MI'), 'scheduled time') || ' is confirmed.'
  );

  -- Guide notification
  insert into public.notifications (user_id, title, body)
  values (
    v_guide_id,
    'New booking received',
    'New booking for "' || coalesce(v_tour_title,'Tour') || '" on ' || coalesce(to_char(v_start,'YYYY-MM-DD HH24:MI'), 'scheduled time') ||
    ' (Adults: ' || new.adults || ', Children: ' || new.children || ').'
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_on_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_credits_on_cancellation"("p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."refund_credits_on_cancellation"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."room_messages_broadcast_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'room:' || NEW.room_id::text || ':messages',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."room_messages_broadcast_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify_text"("input" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE(
    NULLIF(
      trim(both '-' FROM regexp_replace(lower(COALESCE(input, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    ''
  );
$$;


ALTER FUNCTION "public"."slugify_text"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_review_via_qr"("p_public_token" "text", "p_rating" integer, "p_title" "text" DEFAULT NULL::"text", "p_content" "text" DEFAULT NULL::"text", "p_reviewer_name" "text" DEFAULT NULL::"text", "p_ip_hash" "text" DEFAULT NULL::"text", "p_user_agent_hash" "text" DEFAULT NULL::"text") RETURNS TABLE("review_id" "uuid", "session_id" "uuid", "slots_remaining" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_token_hash text;
  v_session public.review_qr_sessions%ROWTYPE;
  v_review_id uuid;
  v_slots_remaining integer;
  v_recent_ip_count integer := 0;
  v_content text;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'INVALID_RATING';
  END IF;

  v_content := trim(COALESCE(p_content, ''));
  IF char_length(v_content) < 20 THEN
    RAISE EXCEPTION 'CONTENT_TOO_SHORT';
  END IF;

  IF COALESCE(trim(p_public_token), '') = '' THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  v_token_hash := encode(digest(p_public_token, 'sha256'), 'hex');

  SELECT *
  INTO v_session
  FROM public.review_qr_sessions
  WHERE public_token_hash = v_token_hash
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE';
  END IF;

  IF v_session.expires_at <= now() THEN
    UPDATE public.review_qr_sessions
    SET status = 'expired'
    WHERE id = v_session.id
      AND status = 'active';
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;

  IF v_session.slots_used >= v_session.slots_total THEN
    UPDATE public.review_qr_sessions
    SET status = 'closed',
        closed_at = now()
    WHERE id = v_session.id
      AND status = 'active';
    RAISE EXCEPTION 'NO_SLOTS_LEFT';
  END IF;

  IF COALESCE(trim(p_ip_hash), '') <> '' THEN
    SELECT COUNT(*)::integer
    INTO v_recent_ip_count
    FROM public.review_qr_reviews
    WHERE session_id = v_session.id
      AND ip_hash = p_ip_hash
      AND created_at > now() - interval '30 minutes';

    IF v_recent_ip_count >= 3 THEN
      RAISE EXCEPTION 'IP_RATE_LIMITED';
    END IF;
  END IF;

  INSERT INTO public.review_qr_reviews (
    session_id,
    schedule_id,
    tour_id,
    guide_id,
    rating,
    title,
    content,
    reviewer_name,
    is_published,
    is_verified,
    verification_method,
    ip_hash,
    user_agent_hash
  )
  VALUES (
    v_session.id,
    v_session.schedule_id,
    v_session.tour_id,
    v_session.guide_id,
    p_rating,
    NULLIF(trim(COALESCE(p_title, '')), ''),
    v_content,
    NULLIF(trim(COALESCE(p_reviewer_name, '')), ''),
    true,
    true,
    'guide_qr_session',
    NULLIF(trim(COALESCE(p_ip_hash, '')), ''),
    NULLIF(trim(COALESCE(p_user_agent_hash, '')), '')
  )
  RETURNING id INTO v_review_id;

  UPDATE public.review_qr_sessions
  SET slots_used = slots_used + 1,
      status = CASE WHEN slots_used + 1 >= slots_total THEN 'closed' ELSE status END,
      closed_at = CASE WHEN slots_used + 1 >= slots_total THEN now() ELSE closed_at END
  WHERE id = v_session.id
  RETURNING GREATEST(slots_total - slots_used, 0) INTO v_slots_remaining;

  RETURN QUERY
  SELECT v_review_id, v_session.id, v_slots_remaining;
END;
$$;


ALTER FUNCTION "public"."submit_review_via_qr"("p_public_token" "text", "p_rating" integer, "p_title" "text", "p_content" "text", "p_reviewer_name" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_review_via_tour_qr"("p_tour_public_token" "text", "p_session_id" "uuid", "p_rating" integer, "p_title" "text" DEFAULT NULL::"text", "p_content" "text" DEFAULT NULL::"text", "p_reviewer_name" "text" DEFAULT NULL::"text", "p_ip_hash" "text" DEFAULT NULL::"text", "p_user_agent_hash" "text" DEFAULT NULL::"text") RETURNS TABLE("review_id" "uuid", "session_id" "uuid", "slots_remaining" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_token_hash text;
  v_link public.review_qr_tour_links%ROWTYPE;
  v_session public.review_qr_sessions%ROWTYPE;
  v_review_id uuid;
  v_slots_remaining integer;
  v_recent_ip_count integer := 0;
  v_content text;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'INVALID_RATING';
  END IF;

  v_content := trim(COALESCE(p_content, ''));
  IF char_length(v_content) < 20 THEN
    RAISE EXCEPTION 'CONTENT_TOO_SHORT';
  END IF;

  IF COALESCE(trim(p_tour_public_token), '') = '' THEN
    RAISE EXCEPTION 'INVALID_TOUR_QR_TOKEN';
  END IF;

  v_token_hash := encode(digest(p_tour_public_token, 'sha256'), 'hex');

  SELECT *
  INTO v_link
  FROM public.review_qr_tour_links
  WHERE public_token_hash = v_token_hash
    AND status = 'active'
  LIMIT 1;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_TOUR_QR_TOKEN';
  END IF;

  SELECT *
  INTO v_session
  FROM public.review_qr_sessions
  WHERE id = p_session_id
    AND tour_id = v_link.tour_id
    AND guide_id = v_link.guide_id
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_FOR_TOUR_LINK';
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'SESSION_NOT_ACTIVE';
  END IF;

  IF v_session.expires_at <= now() THEN
    UPDATE public.review_qr_sessions
    SET status = 'expired'
    WHERE id = v_session.id
      AND status = 'active';
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;

  IF v_session.slots_used >= v_session.slots_total THEN
    UPDATE public.review_qr_sessions
    SET status = 'closed',
        closed_at = now()
    WHERE id = v_session.id
      AND status = 'active';
    RAISE EXCEPTION 'NO_SLOTS_LEFT';
  END IF;

  IF COALESCE(trim(p_ip_hash), '') <> '' THEN
    SELECT COUNT(*)::integer
    INTO v_recent_ip_count
    FROM public.review_qr_reviews
    WHERE tour_id = v_session.tour_id
      AND ip_hash = p_ip_hash
      AND created_at > now() - interval '24 hours';

    IF v_recent_ip_count >= 1 THEN
      RAISE EXCEPTION 'IP_TOUR_RATE_LIMITED';
    END IF;
  END IF;

  INSERT INTO public.review_qr_reviews (
    session_id,
    schedule_id,
    tour_id,
    guide_id,
    rating,
    title,
    content,
    reviewer_name,
    is_published,
    is_verified,
    verification_method,
    ip_hash,
    user_agent_hash
  )
  VALUES (
    v_session.id,
    v_session.schedule_id,
    v_session.tour_id,
    v_session.guide_id,
    p_rating,
    NULLIF(trim(COALESCE(p_title, '')), ''),
    v_content,
    NULLIF(trim(COALESCE(p_reviewer_name, '')), ''),
    true,
    true,
    'tour_static_qr',
    NULLIF(trim(COALESCE(p_ip_hash, '')), ''),
    NULLIF(trim(COALESCE(p_user_agent_hash, '')), '')
  )
  RETURNING id INTO v_review_id;

  UPDATE public.review_qr_sessions
  SET slots_used = slots_used + 1,
      status = CASE WHEN slots_used + 1 >= slots_total THEN 'closed' ELSE status END,
      closed_at = CASE WHEN slots_used + 1 >= slots_total THEN now() ELSE closed_at END
  WHERE id = v_session.id
  RETURNING GREATEST(slots_total - slots_used, 0) INTO v_slots_remaining;

  RETURN QUERY
  SELECT v_review_id, v_session.id, v_slots_remaining;
END;
$$;


ALTER FUNCTION "public"."submit_review_via_tour_qr"("p_tour_public_token" "text", "p_session_id" "uuid", "p_rating" integer, "p_title" "text", "p_content" "text", "p_reviewer_name" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_city_seo_content_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_city_seo_content_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_tour_stops_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_tour_stops_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" DEFAULT 'guide_application'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "adults_attended" integer DEFAULT 0 NOT NULL,
    "children_attended" integer DEFAULT 0 NOT NULL,
    "attended" boolean DEFAULT false NOT NULL,
    "confirmed_by_guide" boolean DEFAULT false NOT NULL,
    "confirmed_by_tourist" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "autoseo_article_id" bigint NOT NULL,
    "autoseo_delivery_id" "text",
    "autoseo_event" "text" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "meta_description" "text",
    "content_html" "text" NOT NULL,
    "content_markdown" "text",
    "hero_image_url" "text",
    "hero_image_alt" "text",
    "infographic_image_url" "text",
    "keywords" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "meta_keywords" "text",
    "faq_schema" "jsonb",
    "language_code" "text" DEFAULT 'en'::"text" NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "source_updated_at" timestamp with time zone,
    "source_created_at" timestamp with time zone,
    "source_payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "country" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "credits_per_adult" integer DEFAULT 3 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


COMMENT ON TABLE "public"."cities" IS 'Admin-managed list of cities with per-city booking fee (credits per adult).';



COMMENT ON COLUMN "public"."cities"."slug" IS 'Lowercase identifier matching tours.city column value.';



COMMENT ON COLUMN "public"."cities"."credits_per_adult" IS '1 credit = €1. Fee charged to guide per adult attendee in this city.';



CREATE TABLE IF NOT EXISTS "public"."city_seo_content" (
    "city_slug" "text" NOT NULL,
    "city_name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."city_seo_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tour_id" "uuid",
    "booking_id" "uuid",
    "guide_id" "uuid",
    "tourist_id" "uuid",
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "credits" integer NOT NULL,
    "price_eur" numeric NOT NULL,
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_popular" boolean DEFAULT false,
    "savings_percentage" integer
);


ALTER TABLE "public"."credit_packages" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_packages" IS 'Credit packages available for guides to purchase';



CREATE TABLE IF NOT EXISTS "public"."credit_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid",
    "package_id" "uuid" NOT NULL,
    "credits_added" integer NOT NULL,
    "amount_paid" numeric NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text",
    "payment_provider" "text",
    "payment_reference" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "credit_purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."credit_purchases" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_purchases" IS 'Records of guide credit purchases with payment details';



CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid",
    "amount" integer NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "reference_id" "uuid"
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid",
    "booking_id" "uuid",
    "adults_charged" integer DEFAULT 0 NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "status" "text" DEFAULT 'charged'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fee_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "capacity" integer DEFAULT 10 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "booked_count" integer DEFAULT 0 NOT NULL,
    "language" "text"
);


ALTER TABLE "public"."tour_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "city" "text",
    "country" "text",
    "price" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_minutes" integer,
    "max_group_size" integer,
    "languages" "text"[] DEFAULT '{}'::"text"[],
    "categories" "text"[] DEFAULT '{}'::"text"[],
    "highlights" "text"[] DEFAULT '{}'::"text"[],
    "what_to_expect" "text",
    "what_to_bring" "text",
    "accessibility_info" "text",
    "meeting_point_address" "text",
    "meeting_point_details" "text",
    "photos" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "images" "text"[] DEFAULT '{}'::"text"[],
    "max_capacity" integer,
    "meeting_point_lat" double precision,
    "meeting_point_lng" double precision,
    "meeting_point" "text",
    "published_at" timestamp with time zone,
    "city_slug" "text" NOT NULL,
    "tour_slug" "text" NOT NULL,
    "seo_keywords" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "seo_title" "text",
    "seo_meta_description" "text",
    "seo_title_manually_overridden" boolean DEFAULT false NOT NULL,
    "seo_meta_description_manually_overridden" boolean DEFAULT false NOT NULL,
    "minimum_attendees" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "tours_minimum_attendees_check" CHECK (("minimum_attendees" >= 1)),
    CONSTRAINT "tours_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."tours" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."guide_analytics_daily" WITH ("security_invoker"='on') AS
 SELECT "tours"."guide_id",
    ("date_trunc"('day'::"text", "bookings"."created_at"))::"date" AS "day",
    "count"("bookings"."id") AS "total_bookings",
    "sum"(("bookings"."adults" + "bookings"."children")) AS "total_guests",
    "sum"(
        CASE
            WHEN ("bookings"."status" = 'completed'::"text") THEN 1
            ELSE 0
        END) AS "completed_bookings",
    "sum"(
        CASE
            WHEN "attendance"."confirmed_by_guide" THEN 1
            ELSE 0
        END) AS "guide_confirmations",
    "sum"(
        CASE
            WHEN "attendance"."confirmed_by_tourist" THEN 1
            ELSE 0
        END) AS "tourist_confirmations"
   FROM ((("public"."bookings"
     JOIN "public"."tour_schedules" ON (("tour_schedules"."id" = "bookings"."schedule_id")))
     JOIN "public"."tours" ON (("tours"."id" = "tour_schedules"."tour_id")))
     LEFT JOIN "public"."attendance" ON (("attendance"."booking_id" = "bookings"."id")))
  GROUP BY "tours"."guide_id", (("date_trunc"('day'::"text", "bookings"."created_at"))::"date");


ALTER VIEW "public"."guide_analytics_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "balance_non_negative" CHECK (("balance" >= 0))
);


ALTER TABLE "public"."guide_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "plan_type" "text" DEFAULT 'free'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "auto_renew" boolean DEFAULT false,
    CONSTRAINT "guide_plans_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['free'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."guide_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."guide_plans" IS 'Guide subscription plans (free or pro)';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'tourist'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bio" "text",
    "phone" "text",
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "roles" "text"[] DEFAULT ARRAY['tourist'::"text"],
    "city" "text",
    "onboarding_completed" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false,
    "is_banned" boolean DEFAULT false NOT NULL,
    "guide_approval_status" "text",
    "guide_verified" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_guide_approval_status_check" CHECK (("guide_approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."roles" IS 'User roles array - can be both guide and tourist';



COMMENT ON COLUMN "public"."profiles"."is_banned" IS 'When true, the user is banned from the platform';



COMMENT ON COLUMN "public"."profiles"."guide_verified" IS 'Set to true when Sumsub ID verification returns GREEN';



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "tourist_id" "uuid",
    "rating" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "guide_id" "uuid",
    "booking_id" "uuid",
    "title" "text",
    "content" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "guide_response" "text",
    "guide_responded_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


COMMENT ON COLUMN "public"."reviews"."content" IS 'Main review content text';



CREATE OR REPLACE VIEW "public"."guide_stats_view" WITH ("security_invoker"='on') AS
 WITH "review_stats" AS (
         SELECT "reviews"."guide_id",
            "count"(*) AS "total_reviews",
            COALESCE("avg"("reviews"."rating"), (0)::numeric) AS "avg_rating"
           FROM "public"."reviews"
          WHERE ("reviews"."is_published" = true)
          GROUP BY "reviews"."guide_id"
        ), "booking_stats" AS (
         SELECT "schedule"."tour_id",
            "tour"."guide_id",
            "count"(
                CASE
                    WHEN ("b_1"."status" = 'completed'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "completed_tours",
            "count"(
                CASE
                    WHEN ("b_1"."status" = ANY (ARRAY['cancelled'::"text", 'no_show'::"text"])) THEN 1
                    ELSE NULL::integer
                END) AS "cancelled_tours"
           FROM (("public"."bookings" "b_1"
             JOIN "public"."tour_schedules" "schedule" ON (("b_1"."schedule_id" = "schedule"."id")))
             JOIN "public"."tours" "tour" ON (("schedule"."tour_id" = "tour"."id")))
          GROUP BY "schedule"."tour_id", "tour"."guide_id"
        ), "guide_booking_totals" AS (
         SELECT "booking_stats"."guide_id",
            "sum"("booking_stats"."completed_tours") AS "total_completed",
            "sum"("booking_stats"."cancelled_tours") AS "total_cancelled"
           FROM "booking_stats"
          GROUP BY "booking_stats"."guide_id"
        )
 SELECT "p"."id" AS "guide_id",
    COALESCE("r"."total_reviews", (0)::bigint) AS "reviews_count",
    COALESCE("r"."avg_rating", (0)::numeric) AS "raw_rating",
    ((((5)::numeric * 4.5) + (COALESCE("r"."avg_rating", (0)::numeric) * (COALESCE("r"."total_reviews", (0)::bigint))::numeric)) / (NULLIF((5 + COALESCE("r"."total_reviews", (0)::bigint)), 0))::numeric) AS "bayesian_rating",
    COALESCE("b"."total_completed", (0)::numeric) AS "completed_bookings",
    COALESCE("b"."total_cancelled", (0)::numeric) AS "cancelled_bookings",
        CASE
            WHEN ((COALESCE("b"."total_completed", (0)::numeric) + COALESCE("b"."total_cancelled", (0)::numeric)) = (0)::numeric) THEN 1.0
            ELSE (COALESCE("b"."total_completed", (0)::numeric) / (COALESCE("b"."total_completed", (0)::numeric) + COALESCE("b"."total_cancelled", (0)::numeric)))
        END AS "reliability_score",
        CASE
            WHEN ((COALESCE("r"."total_reviews", (0)::bigint) < 10) OR ("p"."created_at" > ("now"() - '30 days'::interval))) THEN true
            ELSE false
        END AS "is_newcomer"
   FROM (("public"."profiles" "p"
     LEFT JOIN "review_stats" "r" ON (("p"."id" = "r"."guide_id")))
     LEFT JOIN "guide_booking_totals" "b" ON (("p"."id" = "b"."guide_id")))
  WHERE (("p"."roles" @> ARRAY['guide'::"text"]) OR ("p"."role" = 'guide'::"text"));


ALTER VIEW "public"."guide_stats_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_verification_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "verification_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guide_verification_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guide_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "full_name" "text",
    "country" "text",
    "address" "text",
    "city" "text",
    "notes" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "admin_note" "text"
);


ALTER TABLE "public"."guide_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_read" boolean DEFAULT false,
    "content" "text",
    "read_at" timestamp with time zone
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."messages"."body" IS 'Main message text content';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_settings" (
    "plan_type" "text" NOT NULL,
    "max_tours" integer DEFAULT 1 NOT NULL,
    "max_schedules_per_week" integer DEFAULT 2 NOT NULL,
    "max_tourist_capacity" integer DEFAULT 7 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "plan_settings_max_schedules_per_week_check" CHECK (("max_schedules_per_week" >= 0)),
    CONSTRAINT "plan_settings_max_tourist_capacity_check" CHECK (("max_tourist_capacity" >= 1)),
    CONSTRAINT "plan_settings_max_tours_check" CHECK (("max_tours" >= 0))
);


ALTER TABLE "public"."plan_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "value_type" "text" DEFAULT 'string'::"text" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT false,
    "category" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_config" IS 'Platform-wide configuration and business rules';



COMMENT ON COLUMN "public"."platform_config"."value_type" IS 'Data type: string, integer, decimal, boolean';



COMMENT ON COLUMN "public"."platform_config"."is_public" IS 'Whether this setting is visible to users in UI';



COMMENT ON COLUMN "public"."platform_config"."category" IS 'Config grouping: pricing, limits, marketing, features';



CREATE TABLE IF NOT EXISTS "public"."promo_code_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promo_code_id" "uuid" NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "redeemed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promo_code_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "credits_to_give" integer DEFAULT 0 NOT NULL,
    "gives_pro_status" boolean DEFAULT false NOT NULL,
    "max_uses" integer DEFAULT 1 NOT NULL,
    "current_uses" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promo_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_qr_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "reviewer_name" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "is_verified" boolean DEFAULT true NOT NULL,
    "verification_method" "text" DEFAULT 'guide_qr_session'::"text" NOT NULL,
    "ip_hash" "text",
    "user_agent_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_qr_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."review_qr_reviews" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_review_feed" WITH ("security_invoker"='true') AS
 SELECT "r"."id",
    'booking'::"text" AS "source",
    "r"."rating",
    "r"."title",
    "r"."content",
    "r"."created_at",
    "r"."tour_id",
    "t"."title" AS "tour_title",
    "t"."city" AS "tour_city",
    COALESCE("p"."full_name", 'Anonymous Traveler'::"text") AS "author_name",
    "p"."avatar_url" AS "author_avatar",
    true AS "is_verified"
   FROM (("public"."reviews" "r"
     LEFT JOIN "public"."tours" "t" ON (("t"."id" = "r"."tour_id")))
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "r"."tourist_id")))
  WHERE (COALESCE("r"."is_published", true) = true)
UNION ALL
 SELECT "qr"."id",
    'qr'::"text" AS "source",
    "qr"."rating",
    "qr"."title",
    "qr"."content",
    "qr"."created_at",
    "qr"."tour_id",
    "t"."title" AS "tour_title",
    "t"."city" AS "tour_city",
    COALESCE(NULLIF(TRIM(BOTH FROM "qr"."reviewer_name"), ''::"text"), 'Verified Guest'::"text") AS "author_name",
    NULL::"text" AS "author_avatar",
    true AS "is_verified"
   FROM ("public"."review_qr_reviews" "qr"
     LEFT JOIN "public"."tours" "t" ON (("t"."id" = "qr"."tour_id")))
  WHERE ("qr"."is_published" = true);


ALTER VIEW "public"."public_review_feed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_qr_allowlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city_slug" "text" NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."review_qr_allowlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_qr_google_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "review_id" "uuid",
    "tour_id" "uuid",
    "guide_id" "uuid",
    "clicked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_hash" "text",
    "user_agent_hash" "text"
);


ALTER TABLE "public"."review_qr_google_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_qr_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "city_slug" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "slots_total" integer NOT NULL,
    "slots_used" integer DEFAULT 0 NOT NULL,
    "public_token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    CONSTRAINT "review_qr_sessions_slots_total_check" CHECK (("slots_total" > 0)),
    CONSTRAINT "review_qr_sessions_slots_used_check" CHECK (("slots_used" >= 0)),
    CONSTRAINT "review_qr_sessions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."review_qr_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_qr_tour_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "guide_id" "uuid" NOT NULL,
    "public_token" "text" NOT NULL,
    "public_token_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rotated_at" timestamp with time zone,
    CONSTRAINT "review_qr_tour_links_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."review_qr_tour_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."room_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_boosts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "guide_id" "uuid",
    "credits_spent" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "boost_type" "text",
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    CONSTRAINT "tour_boosts_boost_type_check" CHECK (("boost_type" = ANY (ARRAY['featured_listing'::"text", 'search_boost'::"text", 'profile_highlight'::"text", 'priority_placement'::"text", 'advanced_analytics'::"text"])))
);


ALTER TABLE "public"."tour_boosts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tour_boosts"."boost_type" IS 'Type of boost purchased';



COMMENT ON COLUMN "public"."tour_boosts"."expires_at" IS 'When this boost expires';



COMMENT ON COLUMN "public"."tour_boosts"."is_active" IS 'Whether this boost is currently active';



CREATE TABLE IF NOT EXISTS "public"."tour_stops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "stop_name" "text" NOT NULL,
    "highlight" "text",
    "route_snapshot" "text",
    "google_context" "text",
    "highlight_manually_overridden" boolean DEFAULT false NOT NULL,
    "route_snapshot_manually_overridden" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tour_stops_position_check" CHECK (("position" > 0))
);


ALTER TABLE "public"."tour_stops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wishlists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tourist_id" "uuid" NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wishlists" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."city_seo_content"
    ADD CONSTRAINT "city_seo_content_pkey" PRIMARY KEY ("city_slug");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_unique_participants" UNIQUE ("tourist_id", "guide_id", "tour_id");



ALTER TABLE ONLY "public"."credit_packages"
    ADD CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_type_check" CHECK (("type" = ANY (ARRAY['purchase'::"text", 'spend'::"text", 'bonus'::"text", 'refund'::"text", 'auto_topup'::"text", 'boost'::"text", 'attendance_fee'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."fee_items"
    ADD CONSTRAINT "fee_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guide_credits"
    ADD CONSTRAINT "guide_credits_guide_id_key" UNIQUE ("guide_id");



ALTER TABLE ONLY "public"."guide_credits"
    ADD CONSTRAINT "guide_credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guide_plans"
    ADD CONSTRAINT "guide_plans_guide_id_key" UNIQUE ("guide_id");



ALTER TABLE ONLY "public"."guide_plans"
    ADD CONSTRAINT "guide_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guide_verification_documents"
    ADD CONSTRAINT "guide_verification_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guide_verifications"
    ADD CONSTRAINT "guide_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_settings"
    ADD CONSTRAINT "plan_settings_pkey" PRIMARY KEY ("plan_type");



ALTER TABLE ONLY "public"."platform_config"
    ADD CONSTRAINT "platform_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_code_redemptions"
    ADD CONSTRAINT "promo_code_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_code_redemptions"
    ADD CONSTRAINT "promo_code_redemptions_unique_user" UNIQUE ("promo_code_id", "guide_id");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_qr_allowlist"
    ADD CONSTRAINT "review_qr_allowlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_qr_google_events"
    ADD CONSTRAINT "review_qr_google_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_qr_reviews"
    ADD CONSTRAINT "review_qr_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_qr_sessions"
    ADD CONSTRAINT "review_qr_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_qr_tour_links"
    ADD CONSTRAINT "review_qr_tour_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_boosts"
    ADD CONSTRAINT "tour_boosts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_schedules"
    ADD CONSTRAINT "tour_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_stops"
    ADD CONSTRAINT "tour_stops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_tourist_id_tour_id_key" UNIQUE ("tourist_id", "tour_id");



CREATE UNIQUE INDEX "blog_posts_autoseo_article_id_uidx" ON "public"."blog_posts" USING "btree" ("autoseo_article_id");



CREATE INDEX "blog_posts_language_status_idx" ON "public"."blog_posts" USING "btree" ("language_code", "status");



CREATE UNIQUE INDEX "blog_posts_slug_uidx" ON "public"."blog_posts" USING "btree" ("slug");



CREATE INDEX "blog_posts_status_published_at_idx" ON "public"."blog_posts" USING "btree" ("status", "published_at" DESC);



CREATE UNIQUE INDEX "bookings_one_active_per_schedule" ON "public"."bookings" USING "btree" ("schedule_id", "tourist_id") WHERE ("status" = ANY (ARRAY['confirmed'::"text", 'pending'::"text"]));



CREATE UNIQUE INDEX "conversations_unique_pair" ON "public"."conversations" USING "btree" ("tour_id", "guide_id", "tourist_id");



CREATE UNIQUE INDEX "guide_credits_guide_id_uq" ON "public"."guide_credits" USING "btree" ("guide_id");



CREATE INDEX "idx_attendance_booking_id" ON "public"."attendance" USING "btree" ("booking_id");



CREATE INDEX "idx_bookings_schedule_id" ON "public"."bookings" USING "btree" ("schedule_id");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



COMMENT ON INDEX "public"."idx_bookings_status" IS 'Speed up booking status filtering';



CREATE INDEX "idx_bookings_tour_id" ON "public"."bookings" USING "btree" ("tour_id");



CREATE INDEX "idx_bookings_tourist_id" ON "public"."bookings" USING "btree" ("tourist_id");



CREATE INDEX "idx_conversations_guide" ON "public"."conversations" USING "btree" ("guide_id");



CREATE INDEX "idx_conversations_last" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_conversations_tourist" ON "public"."conversations" USING "btree" ("tourist_id");



CREATE INDEX "idx_credit_purchases_guide_id" ON "public"."credit_purchases" USING "btree" ("guide_id");



CREATE INDEX "idx_credit_purchases_status" ON "public"."credit_purchases" USING "btree" ("status");



CREATE INDEX "idx_credit_transactions_created_at" ON "public"."credit_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_credit_transactions_guide_id" ON "public"."credit_transactions" USING "btree" ("guide_id");



COMMENT ON INDEX "public"."idx_credit_transactions_guide_id" IS 'Speed up credit transaction lookups by guide';



CREATE INDEX "idx_guide_credits_guide_id" ON "public"."guide_credits" USING "btree" ("guide_id");



CREATE INDEX "idx_guide_plans_guide_id" ON "public"."guide_plans" USING "btree" ("guide_id");



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_conversation_created" ON "public"."messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_messages_sender" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_messages_unread" ON "public"."messages" USING "btree" ("conversation_id", "sender_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_reviews_booking_id" ON "public"."reviews" USING "btree" ("booking_id");



CREATE INDEX "idx_reviews_guide_id" ON "public"."reviews" USING "btree" ("guide_id");



CREATE INDEX "idx_reviews_tour_id" ON "public"."reviews" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_boosts_active" ON "public"."tour_boosts" USING "btree" ("expires_at") WHERE ("is_active" = true);



COMMENT ON INDEX "public"."idx_tour_boosts_active" IS 'Speed up active boost lookups';



CREATE INDEX "idx_tour_schedules_language" ON "public"."tour_schedules" USING "btree" ("language");



CREATE INDEX "idx_tour_schedules_tour_id" ON "public"."tour_schedules" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_schedules_tour_start" ON "public"."tour_schedules" USING "btree" ("tour_id", "start_time");



CREATE INDEX "idx_tours_city" ON "public"."tours" USING "btree" ("city");



CREATE INDEX "idx_tours_guide_id" ON "public"."tours" USING "btree" ("guide_id");



CREATE INDEX "idx_tours_status" ON "public"."tours" USING "btree" ("status");



CREATE INDEX "profiles_is_deleted_idx" ON "public"."profiles" USING "btree" ("is_deleted");



CREATE INDEX "profiles_role_idx" ON "public"."profiles" USING "btree" ("role");



CREATE UNIQUE INDEX "review_qr_allowlist_city_guide_uidx" ON "public"."review_qr_allowlist" USING "btree" ("city_slug", "guide_id");



CREATE INDEX "review_qr_allowlist_enabled_idx" ON "public"."review_qr_allowlist" USING "btree" ("enabled", "city_slug");



CREATE INDEX "review_qr_google_events_clicked_idx" ON "public"."review_qr_google_events" USING "btree" ("clicked_at" DESC);



CREATE INDEX "review_qr_reviews_guide_idx" ON "public"."review_qr_reviews" USING "btree" ("guide_id", "created_at" DESC);



CREATE INDEX "review_qr_reviews_ip_hash_idx" ON "public"."review_qr_reviews" USING "btree" ("ip_hash", "created_at" DESC);



CREATE INDEX "review_qr_reviews_session_idx" ON "public"."review_qr_reviews" USING "btree" ("session_id", "created_at" DESC);



CREATE INDEX "review_qr_reviews_tour_idx" ON "public"."review_qr_reviews" USING "btree" ("tour_id", "created_at" DESC);



CREATE INDEX "review_qr_sessions_guide_idx" ON "public"."review_qr_sessions" USING "btree" ("guide_id", "created_at" DESC);



CREATE UNIQUE INDEX "review_qr_sessions_one_active_per_schedule_uidx" ON "public"."review_qr_sessions" USING "btree" ("schedule_id") WHERE ("status" = 'active'::"text");



CREATE UNIQUE INDEX "review_qr_sessions_public_token_hash_uidx" ON "public"."review_qr_sessions" USING "btree" ("public_token_hash");



CREATE INDEX "review_qr_sessions_schedule_idx" ON "public"."review_qr_sessions" USING "btree" ("schedule_id", "created_at" DESC);



CREATE INDEX "review_qr_tour_links_guide_status_idx" ON "public"."review_qr_tour_links" USING "btree" ("guide_id", "status", "updated_at" DESC);



CREATE UNIQUE INDEX "review_qr_tour_links_token_hash_uidx" ON "public"."review_qr_tour_links" USING "btree" ("public_token_hash");



CREATE UNIQUE INDEX "review_qr_tour_links_token_uidx" ON "public"."review_qr_tour_links" USING "btree" ("public_token");



CREATE UNIQUE INDEX "review_qr_tour_links_tour_uidx" ON "public"."review_qr_tour_links" USING "btree" ("tour_id");



CREATE UNIQUE INDEX "tour_schedules_unique_slot" ON "public"."tour_schedules" USING "btree" ("tour_id", "start_time", COALESCE("language", ''::"text"));



CREATE INDEX "tour_stops_tour_created_idx" ON "public"."tour_stops" USING "btree" ("tour_id", "created_at" DESC);



CREATE UNIQUE INDEX "tour_stops_tour_position_uidx" ON "public"."tour_stops" USING "btree" ("tour_id", "position");



CREATE INDEX "tour_stops_tour_updated_idx" ON "public"."tour_stops" USING "btree" ("tour_id", "updated_at" DESC);



CREATE INDEX "tours_city_slug_idx" ON "public"."tours" USING "btree" ("city_slug");



CREATE UNIQUE INDEX "tours_city_slug_tour_slug_uidx" ON "public"."tours" USING "btree" ("city_slug", "tour_slug");



CREATE INDEX "tours_status_city_slug_idx" ON "public"."tours" USING "btree" ("status", "city_slug");



CREATE UNIQUE INDEX "uniq_conversation_tour_guide_tourist" ON "public"."conversations" USING "btree" ("tour_id", "guide_id", "tourist_id");



CREATE UNIQUE INDEX "uniq_schedule_per_tour_time_lang" ON "public"."tour_schedules" USING "btree" ("tour_id", "start_time", COALESCE("language", ''::"text"));



CREATE UNIQUE INDEX "unique_booking_deduction" ON "public"."credit_transactions" USING "btree" ("reference_id", "type") WHERE ("type" = ANY (ARRAY['spend'::"text", 'refund'::"text"]));



CREATE UNIQUE INDEX "uq_conversations_tour_guide_tourist" ON "public"."conversations" USING "btree" ("tour_id", "guide_id", "tourist_id");



CREATE OR REPLACE TRIGGER "booking_credit_trigger" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW WHEN ((("new"."status" = 'confirmed'::"text") AND ("old"."status" IS DISTINCT FROM "new"."status"))) EXECUTE FUNCTION "public"."booking_credit_trigger"();



CREATE OR REPLACE TRIGGER "booking_refund_trigger" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW WHEN ((("new"."status" = 'cancelled'::"text") AND ("old"."status" IS DISTINCT FROM "new"."status"))) EXECUTE FUNCTION "public"."booking_refund_trigger"();



CREATE OR REPLACE TRIGGER "city_seo_content_touch_updated_at" BEFORE UPDATE ON "public"."city_seo_content" FOR EACH ROW EXECUTE FUNCTION "public"."touch_city_seo_content_updated_at"();



CREATE OR REPLACE TRIGGER "free_plan_schedule_limit_trigger" BEFORE INSERT ON "public"."tour_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_free_plan_schedule_limits"();



CREATE OR REPLACE TRIGGER "free_plan_tour_limit_trigger" BEFORE INSERT ON "public"."tours" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_free_plan_tour_limits"();



CREATE OR REPLACE TRIGGER "set_tours_updated_at" BEFORE UPDATE ON "public"."tours" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tour_stops_touch_updated_at" BEFORE UPDATE ON "public"."tour_stops" FOR EACH ROW EXECUTE FUNCTION "public"."touch_tour_stops_updated_at"();



CREATE OR REPLACE TRIGGER "trg_notify_on_booking" AFTER INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_booking"();



CREATE OR REPLACE TRIGGER "trg_recalc_booked_count" AFTER INSERT OR DELETE OR UPDATE OF "status", "total_guests" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."_recalc_booked_count_trigger"();



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."tour_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_tourist_id_fkey" FOREIGN KEY ("tourist_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_tourist_id_fkey" FOREIGN KEY ("tourist_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_purchases"
    ADD CONSTRAINT "credit_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."credit_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fee_items"
    ADD CONSTRAINT "fee_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fee_items"
    ADD CONSTRAINT "fee_items_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."guide_credits"
    ADD CONSTRAINT "guide_credits_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_plans"
    ADD CONSTRAINT "guide_plans_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_verification_documents"
    ADD CONSTRAINT "guide_verification_documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "public"."guide_verifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_verifications"
    ADD CONSTRAINT "guide_verifications_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guide_verifications"
    ADD CONSTRAINT "guide_verifications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_code_redemptions"
    ADD CONSTRAINT "promo_code_redemptions_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_code_redemptions"
    ADD CONSTRAINT "promo_code_redemptions_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_qr_allowlist"
    ADD CONSTRAINT "review_qr_allowlist_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_qr_google_events"
    ADD CONSTRAINT "review_qr_google_events_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."review_qr_google_events"
    ADD CONSTRAINT "review_qr_google_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."review_qr_reviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."review_qr_google_events"
    ADD CONSTRAINT "review_qr_google_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."review_qr_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."review_qr_google_events"
    ADD CONSTRAINT "review_qr_google_events_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."review_qr_reviews"
    ADD CONSTRAINT "review_qr_reviews_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_qr_reviews"
    ADD CONSTRAINT "review_qr_reviews_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."tour_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_qr_reviews"
    ADD CONSTRAINT "review_qr_reviews_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."review_qr_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_qr_reviews"
    ADD CONSTRAINT "review_qr_reviews_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_qr_sessions"
    ADD CONSTRAINT "review_qr_sessions_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_qr_sessions"
    ADD CONSTRAINT "review_qr_sessions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."tour_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_qr_sessions"
    ADD CONSTRAINT "review_qr_sessions_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_qr_tour_links"
    ADD CONSTRAINT "review_qr_tour_links_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_qr_tour_links"
    ADD CONSTRAINT "review_qr_tour_links_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_tourist_id_fkey" FOREIGN KEY ("tourist_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tour_boosts"
    ADD CONSTRAINT "tour_boosts_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tour_boosts"
    ADD CONSTRAINT "tour_boosts_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_schedules"
    ADD CONSTRAINT "tour_schedules_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_stops"
    ADD CONSTRAINT "tour_stops_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_tourist_id_fkey" FOREIGN KEY ("tourist_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can delete any tour" ON "public"."tours" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text") AND ("p"."is_deleted" = false)))));



CREATE POLICY "Admin can manage credit packages" ON "public"."credit_packages" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text") AND ("p"."is_deleted" = false))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text") AND ("p"."is_deleted" = false)))));



CREATE POLICY "Admin can manage promo codes" ON "public"."promo_codes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text") AND ("p"."is_deleted" = false))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text") AND ("p"."is_deleted" = false)))));



CREATE POLICY "Admin can read all bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text") AND ("p"."is_deleted" = false)))));



CREATE POLICY "Admin can read all credit transactions" ON "public"."credit_transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text") AND ("p"."is_deleted" = false)))));



CREATE POLICY "Admin can read all guide verifications" ON "public"."guide_verifications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text") AND ("p"."is_deleted" = false)))));



CREATE POLICY "Admin can read all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin can read all tours" ON "public"."tours" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text") AND ("p"."is_deleted" = false)))));



CREATE POLICY "Admin can update any profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin can update any tour" ON "public"."tours" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text") AND ("p"."is_deleted" = false)))));



CREATE POLICY "Admins can manage notifications" ON "public"."admin_notifications" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Anyone can read active promo codes" ON "public"."promo_codes" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public config read" ON "public"."platform_config" FOR SELECT TO "authenticated" USING (("is_public" = true));



CREATE POLICY "Public read for active boosts" ON "public"."tour_boosts" FOR SELECT USING (true);



CREATE POLICY "Public read for aggregate bookings" ON "public"."bookings" FOR SELECT USING (("status" = ANY (ARRAY['completed'::"text", 'cancelled'::"text", 'no_show'::"text"])));



CREATE POLICY "Public read for guide_plans" ON "public"."guide_plans" FOR SELECT USING (true);



CREATE POLICY "Read for authenticated on credit_packages" ON "public"."credit_packages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create conversations" ON "public"."conversations" FOR INSERT WITH CHECK ((("auth"."uid"() = "tourist_id") OR ("auth"."uid"() = "guide_id")));



CREATE POLICY "Users can mark messages as read" ON "public"."messages" FOR UPDATE USING ((("sender_id" <> "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND (("conversations"."tourist_id" = "auth"."uid"()) OR ("conversations"."guide_id" = "auth"."uid"())))))));



CREATE POLICY "Users can read own purchases" ON "public"."credit_purchases" FOR SELECT TO "authenticated" USING (("guide_id" = "auth"."uid"()));



CREATE POLICY "Users can read own room memberships" ON "public"."room_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can send messages in their conversations" ON "public"."messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND (("conversations"."tourist_id" = "auth"."uid"()) OR ("conversations"."guide_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update their conversations" ON "public"."conversations" FOR UPDATE USING ((("auth"."uid"() = "tourist_id") OR ("auth"."uid"() = "guide_id")));



CREATE POLICY "Users can view messages in their conversations" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND (("conversations"."tourist_id" = "auth"."uid"()) OR ("conversations"."guide_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own conversations" ON "public"."conversations" FOR SELECT USING ((("auth"."uid"() = "tourist_id") OR ("auth"."uid"() = "guide_id")));



CREATE POLICY "Users can view their own redemptions" ON "public"."promo_code_redemptions" FOR SELECT USING (("guide_id" = "auth"."uid"()));



ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_audit_log_all" ON "public"."admin_audit_log" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."admin_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_verification_docs_all" ON "public"."guide_verification_documents" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "admin_verifications_all" ON "public"."guide_verifications" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_insert_guide" ON "public"."attendance" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."bookings"
     JOIN "public"."tour_schedules" ON (("tour_schedules"."id" = "bookings"."schedule_id")))
     JOIN "public"."tours" ON (("tours"."id" = "tour_schedules"."tour_id")))
  WHERE (("bookings"."id" = "attendance"."booking_id") AND ("tours"."guide_id" = "auth"."uid"())))));



CREATE POLICY "attendance_insert_tourist" ON "public"."attendance" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "attendance"."booking_id") AND ("bookings"."tourist_id" = "auth"."uid"())))));



CREATE POLICY "attendance_select_guide" ON "public"."attendance" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."bookings"
     JOIN "public"."tour_schedules" ON (("tour_schedules"."id" = "bookings"."schedule_id")))
     JOIN "public"."tours" ON (("tours"."id" = "tour_schedules"."tour_id")))
  WHERE (("bookings"."id" = "attendance"."booking_id") AND ("tours"."guide_id" = "auth"."uid"())))));



CREATE POLICY "attendance_select_tourist" ON "public"."attendance" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "attendance"."booking_id") AND ("bookings"."tourist_id" = "auth"."uid"())))));



CREATE POLICY "attendance_update_tourist" ON "public"."attendance" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "attendance"."booking_id") AND ("bookings"."tourist_id" = "auth"."uid"())))));



ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blog_posts_admin_manage_all" ON "public"."blog_posts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "blog_posts_public_read_published" ON "public"."blog_posts" FOR SELECT TO "authenticated", "anon" USING (("status" = 'published'::"text"));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_insert_tourist" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK ((("tourist_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."tour_schedules" "s"
     JOIN "public"."tours" "t" ON (("t"."id" = "s"."tour_id")))
  WHERE (("s"."id" = "bookings"."schedule_id") AND ("t"."status" = 'published'::"text") AND ("t"."published_at" IS NOT NULL))))));



CREATE POLICY "bookings_insert_tourist_own" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK (("tourist_id" = "auth"."uid"()));



CREATE POLICY "bookings_select_guide" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tour_schedules" "s"
     JOIN "public"."tours" "t" ON (("t"."id" = "s"."tour_id")))
  WHERE (("s"."id" = "bookings"."schedule_id") AND ("t"."guide_id" = "auth"."uid"())))));



CREATE POLICY "bookings_select_tourist" ON "public"."bookings" FOR SELECT TO "authenticated" USING (("tourist_id" = "auth"."uid"()));



CREATE POLICY "bookings_select_tourist_own" ON "public"."bookings" FOR SELECT TO "authenticated" USING (("tourist_id" = "auth"."uid"()));



CREATE POLICY "bookings_update_guide" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."tour_schedules" "s"
     JOIN "public"."tours" "t" ON (("t"."id" = "s"."tour_id")))
  WHERE (("s"."id" = "bookings"."schedule_id") AND ("t"."guide_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."tour_schedules" "s"
     JOIN "public"."tours" "t" ON (("t"."id" = "s"."tour_id")))
  WHERE (("s"."id" = "bookings"."schedule_id") AND ("t"."guide_id" = "auth"."uid"())))));



CREATE POLICY "bookings_update_tourist" ON "public"."bookings" FOR UPDATE TO "authenticated" USING (("tourist_id" = "auth"."uid"())) WITH CHECK (("tourist_id" = "auth"."uid"()));



CREATE POLICY "bookings_update_tourist_own" ON "public"."bookings" FOR UPDATE TO "authenticated" USING (("tourist_id" = "auth"."uid"())) WITH CHECK (("tourist_id" = "auth"."uid"()));



ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cities_admin_manage_all" ON "public"."cities" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "cities_public_read" ON "public"."cities" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."city_seo_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_insert" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "guide_id") OR ("auth"."uid"() = "tourist_id")));



CREATE POLICY "conversations_select" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "guide_id") OR ("auth"."uid"() = "tourist_id")));



CREATE POLICY "conversations_update" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "guide_id") OR ("auth"."uid"() = "tourist_id"))) WITH CHECK ((("auth"."uid"() = "guide_id") OR ("auth"."uid"() = "tourist_id")));



ALTER TABLE "public"."credit_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_transactions_select_own" ON "public"."credit_transactions" FOR SELECT USING (("guide_id" = "auth"."uid"()));



CREATE POLICY "credit_tx_insert_own" ON "public"."credit_transactions" FOR INSERT TO "authenticated" WITH CHECK (("guide_id" = "auth"."uid"()));



CREATE POLICY "credit_tx_select_own" ON "public"."credit_transactions" FOR SELECT TO "authenticated" USING (("guide_id" = "auth"."uid"()));



ALTER TABLE "public"."fee_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_items_select_own" ON "public"."fee_items" FOR SELECT USING (("guide_id" = "auth"."uid"()));



ALTER TABLE "public"."guide_credits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guide_credits_select_own" ON "public"."guide_credits" FOR SELECT USING (("guide_id" = "auth"."uid"()));



ALTER TABLE "public"."guide_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guide_verification_docs_insert_own" ON "public"."guide_verification_documents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."guide_verifications"
  WHERE (("guide_verifications"."id" = "guide_verification_documents"."verification_id") AND ("guide_verifications"."guide_id" = "auth"."uid"())))));



CREATE POLICY "guide_verification_docs_select_own" ON "public"."guide_verification_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."guide_verifications"
  WHERE (("guide_verifications"."id" = "guide_verification_documents"."verification_id") AND ("guide_verifications"."guide_id" = "auth"."uid"())))));



ALTER TABLE "public"."guide_verification_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guide_verifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guide_verifications_insert_own" ON "public"."guide_verifications" FOR INSERT WITH CHECK (("guide_id" = "auth"."uid"()));



CREATE POLICY "guide_verifications_select_own" ON "public"."guide_verifications" FOR SELECT USING (("guide_id" = "auth"."uid"()));



CREATE POLICY "guide_verifications_update_own" ON "public"."guide_verifications" FOR UPDATE USING (("guide_id" = "auth"."uid"()));



CREATE POLICY "guides can insert schedules for own tours" ON "public"."tour_schedules" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_schedules"."tour_id") AND ("t"."guide_id" = "auth"."uid"())))));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_delete_sender" ON "public"."messages" FOR DELETE TO "authenticated" USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "messages_insert" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."guide_id" = "auth"."uid"()) OR ("c"."tourist_id" = "auth"."uid"())))))));



CREATE POLICY "messages_select" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."guide_id" = "auth"."uid"()) OR ("c"."tourist_id" = "auth"."uid"()))))));



CREATE POLICY "messages_update_sender" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("sender_id" = "auth"."uid"())) WITH CHECK (("sender_id" = "auth"."uid"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert_auth" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."plan_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_settings_admin_manage_all" ON "public"."plan_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "plan_settings_admin_read" ON "public"."plan_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



ALTER TABLE "public"."platform_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_public_guides" ON "public"."profiles" FOR SELECT USING (("role" = 'guide'::"text"));



CREATE POLICY "profiles_select_authenticated" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("is_public" = true) OR ("id" = "auth"."uid"())));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_public" ON "public"."profiles" FOR SELECT USING (("is_public" = true));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."promo_code_redemptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public can read schedules for published tours" ON "public"."tour_schedules" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_schedules"."tour_id") AND ("t"."status" = 'published'::"text") AND ("t"."published_at" IS NOT NULL)))));



CREATE POLICY "public_select" ON "public"."city_seo_content" FOR SELECT USING (true);



ALTER TABLE "public"."review_qr_allowlist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_qr_allowlist_admin_manage_all" ON "public"."review_qr_allowlist" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "review_qr_allowlist_guide_read_own" ON "public"."review_qr_allowlist" FOR SELECT TO "authenticated" USING (("guide_id" = "auth"."uid"()));



ALTER TABLE "public"."review_qr_google_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_qr_google_events_admin_manage_all" ON "public"."review_qr_google_events" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "review_qr_google_events_guide_read_own" ON "public"."review_qr_google_events" FOR SELECT TO "authenticated" USING (("guide_id" = "auth"."uid"()));



ALTER TABLE "public"."review_qr_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_qr_reviews_admin_manage_all" ON "public"."review_qr_reviews" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "review_qr_reviews_guide_read_own" ON "public"."review_qr_reviews" FOR SELECT TO "authenticated" USING (("guide_id" = "auth"."uid"()));



CREATE POLICY "review_qr_reviews_public_read_published" ON "public"."review_qr_reviews" FOR SELECT TO "authenticated", "anon" USING (("is_published" = true));



ALTER TABLE "public"."review_qr_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_qr_sessions_admin_manage_all" ON "public"."review_qr_sessions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "review_qr_sessions_guide_read_own" ON "public"."review_qr_sessions" FOR SELECT TO "authenticated" USING (("guide_id" = "auth"."uid"()));



ALTER TABLE "public"."review_qr_tour_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_qr_tour_links_admin_manage_all" ON "public"."review_qr_tour_links" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "review_qr_tour_links_guide_read_own" ON "public"."review_qr_tour_links" FOR SELECT TO "authenticated" USING (("guide_id" = "auth"."uid"()));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_delete_tourist_own" ON "public"."reviews" FOR DELETE TO "authenticated" USING (("tourist_id" = "auth"."uid"()));



CREATE POLICY "reviews_insert_after_tour" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK ((("tourist_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."bookings" "b"
     JOIN "public"."tour_schedules" "s" ON (("s"."id" = "b"."schedule_id")))
  WHERE (("b"."tourist_id" = "auth"."uid"()) AND ("s"."tour_id" = "reviews"."tour_id") AND ("s"."start_time" <= "now"()) AND ("b"."status" = 'confirmed'::"text"))))));



CREATE POLICY "reviews_insert_tourist_own" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("tourist_id" = "auth"."uid"()));



CREATE POLICY "reviews_select_guide" ON "public"."reviews" FOR SELECT TO "authenticated" USING (("guide_id" = "auth"."uid"()));



CREATE POLICY "reviews_select_public" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "reviews_select_tourist_own" ON "public"."reviews" FOR SELECT TO "authenticated" USING (("tourist_id" = "auth"."uid"()));



CREATE POLICY "reviews_update_tourist_own" ON "public"."reviews" FOR UPDATE TO "authenticated" USING (("tourist_id" = "auth"."uid"())) WITH CHECK (("tourist_id" = "auth"."uid"()));



ALTER TABLE "public"."room_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedules_delete_owner" ON "public"."tour_schedules" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_schedules"."tour_id") AND ("t"."guide_id" = "auth"."uid"())))));



CREATE POLICY "schedules_insert_owner" ON "public"."tour_schedules" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_schedules"."tour_id") AND ("t"."guide_id" = "auth"."uid"())))));



CREATE POLICY "schedules_select_public" ON "public"."tour_schedules" FOR SELECT USING (true);



CREATE POLICY "schedules_update_owner" ON "public"."tour_schedules" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_schedules"."tour_id") AND ("t"."guide_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_schedules"."tour_id") AND ("t"."guide_id" = "auth"."uid"())))));



ALTER TABLE "public"."tour_boosts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tour_boosts_insert_own" ON "public"."tour_boosts" FOR INSERT TO "authenticated" WITH CHECK ((("guide_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_boosts"."tour_id") AND ("t"."guide_id" = "auth"."uid"()))))));



CREATE POLICY "tour_boosts_select_own" ON "public"."tour_boosts" FOR SELECT TO "authenticated" USING (("guide_id" = "auth"."uid"()));



ALTER TABLE "public"."tour_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_stops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tour_stops_owner_delete" ON "public"."tour_stops" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_stops"."tour_id") AND ("t"."guide_id" = "auth"."uid"())))));



CREATE POLICY "tour_stops_owner_insert" ON "public"."tour_stops" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_stops"."tour_id") AND ("t"."guide_id" = "auth"."uid"())))));



CREATE POLICY "tour_stops_owner_update" ON "public"."tour_stops" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_stops"."tour_id") AND ("t"."guide_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_stops"."tour_id") AND ("t"."guide_id" = "auth"."uid"())))));



CREATE POLICY "tour_stops_public_or_owner_select" ON "public"."tour_stops" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_stops"."tour_id") AND (("t"."status" = 'published'::"text") OR ("t"."guide_id" = "auth"."uid"()))))));



ALTER TABLE "public"."tours" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tours_delete_owner" ON "public"."tours" FOR DELETE TO "authenticated" USING (("guide_id" = "auth"."uid"()));



CREATE POLICY "tours_insert_guide_own" ON "public"."tours" FOR INSERT TO "authenticated" WITH CHECK ((("guide_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'guide'::"text"))))));



CREATE POLICY "tours_insert_guide_owner" ON "public"."tours" FOR INSERT TO "authenticated" WITH CHECK ((("guide_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'guide'::"text"))))));



CREATE POLICY "tours_insert_owner" ON "public"."tours" FOR INSERT TO "authenticated" WITH CHECK (("guide_id" = "auth"."uid"()));



CREATE POLICY "tours_select_owner" ON "public"."tours" FOR SELECT TO "authenticated" USING (("guide_id" = "auth"."uid"()));



CREATE POLICY "tours_select_public" ON "public"."tours" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "tours_select_published" ON "public"."tours" FOR SELECT USING ((("status" = 'published'::"text") AND ("published_at" IS NOT NULL)));



CREATE POLICY "tours_update_owner" ON "public"."tours" FOR UPDATE TO "authenticated" USING (("guide_id" = "auth"."uid"())) WITH CHECK (("guide_id" = "auth"."uid"()));



ALTER TABLE "public"."wishlists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wishlists_delete_own" ON "public"."wishlists" FOR DELETE TO "authenticated" USING (("tourist_id" = "auth"."uid"()));



CREATE POLICY "wishlists_insert_own" ON "public"."wishlists" FOR INSERT TO "authenticated" WITH CHECK (("tourist_id" = "auth"."uid"()));



CREATE POLICY "wishlists_select_own" ON "public"."wishlists" FOR SELECT TO "authenticated" USING (("tourist_id" = "auth"."uid"()));



CREATE POLICY "wishlists_update_own" ON "public"."wishlists" FOR UPDATE TO "authenticated" USING (("tourist_id" = "auth"."uid"())) WITH CHECK (("tourist_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."admin_notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."_recalc_booked_count_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."_recalc_booked_count_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_recalc_booked_count_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."activate_tour_boost"("p_tour_id" "uuid", "p_credits" integer, "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."activate_tour_boost"("p_tour_id" "uuid", "p_credits" integer, "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_tour_boost"("p_tour_id" "uuid", "p_credits" integer, "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_credits"("p_guide_id" "uuid", "p_credits" integer, "p_description" "text", "p_reference_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_credits"("p_guide_id" "uuid", "p_credits" integer, "p_description" "text", "p_reference_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_credits"("p_guide_id" "uuid", "p_credits" integer, "p_description" "text", "p_reference_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_credits_for_purchase"("p_guide_id" "uuid", "p_credits" integer, "p_description" "text", "p_reference_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_credits_for_purchase"("p_guide_id" "uuid", "p_credits" integer, "p_description" "text", "p_reference_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_credits_for_purchase"("p_guide_id" "uuid", "p_credits" integer, "p_description" "text", "p_reference_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."booking_credit_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."booking_credit_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."booking_credit_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."booking_refund_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."booking_refund_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."booking_refund_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_credit_balance"("p_guide_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_credit_balance"("p_guide_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_credit_balance"("p_guide_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking"("p_schedule_id" "uuid", "p_adults" integer, "p_children" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking"("p_schedule_id" "uuid", "p_adults" integer, "p_children" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking"("p_schedule_id" "uuid", "p_adults" integer, "p_children" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_as"("p_user_id" "uuid", "p_schedule_id" "uuid", "p_adults" integer, "p_children" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_as"("p_user_id" "uuid", "p_schedule_id" "uuid", "p_adults" integer, "p_children" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_as"("p_user_id" "uuid", "p_schedule_id" "uuid", "p_adults" integer, "p_children" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_review_qr_session"("p_schedule_id" "uuid", "p_guide_id" "uuid", "p_ttl_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_review_qr_session"("p_schedule_id" "uuid", "p_guide_id" "uuid", "p_ttl_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_review_qr_session"("p_schedule_id" "uuid", "p_guide_id" "uuid", "p_ttl_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."deduct_credits_on_booking"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_credits_on_booking"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_credits_on_booking"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_free_plan_schedule_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_free_plan_schedule_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_free_plan_schedule_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_free_plan_tour_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_free_plan_tour_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_free_plan_tour_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_credits_on_attendance"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_credits_on_attendance"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_credits_on_attendance"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_review_qr_tour_link"("p_tour_id" "uuid", "p_guide_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_review_qr_tour_link"("p_tour_id" "uuid", "p_guide_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_review_qr_tour_link"("p_tour_id" "uuid", "p_guide_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_qr_session_public_state"("p_public_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_qr_session_public_state"("p_public_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_qr_session_public_state"("p_public_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ranked_tours"("search_city" "text", "search_language" "text", "limit_val" integer, "offset_val" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_ranked_tours"("search_city" "text", "search_language" "text", "limit_val" integer, "offset_val" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ranked_tours"("search_city" "text", "search_language" "text", "limit_val" integer, "offset_val" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_review_qr_tour_public_state"("p_public_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_review_qr_tour_public_state"("p_public_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_review_qr_tour_public_state"("p_public_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_auth_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refund_credits_on_cancellation"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refund_credits_on_cancellation"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_credits_on_cancellation"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."room_messages_broadcast_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."room_messages_broadcast_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."room_messages_broadcast_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify_text"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify_text"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify_text"("input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_review_via_qr"("p_public_token" "text", "p_rating" integer, "p_title" "text", "p_content" "text", "p_reviewer_name" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_review_via_qr"("p_public_token" "text", "p_rating" integer, "p_title" "text", "p_content" "text", "p_reviewer_name" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_review_via_qr"("p_public_token" "text", "p_rating" integer, "p_title" "text", "p_content" "text", "p_reviewer_name" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_review_via_tour_qr"("p_tour_public_token" "text", "p_session_id" "uuid", "p_rating" integer, "p_title" "text", "p_content" "text", "p_reviewer_name" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_review_via_tour_qr"("p_tour_public_token" "text", "p_session_id" "uuid", "p_rating" integer, "p_title" "text", "p_content" "text", "p_reviewer_name" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_review_via_tour_qr"("p_tour_public_token" "text", "p_session_id" "uuid", "p_rating" integer, "p_title" "text", "p_content" "text", "p_reviewer_name" "text", "p_ip_hash" "text", "p_user_agent_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_city_seo_content_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_city_seo_content_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_city_seo_content_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_tour_stops_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_tour_stops_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_tour_stops_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_notifications" TO "anon";
GRANT ALL ON TABLE "public"."admin_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."city_seo_content" TO "anon";
GRANT ALL ON TABLE "public"."city_seo_content" TO "authenticated";
GRANT ALL ON TABLE "public"."city_seo_content" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."credit_packages" TO "anon";
GRANT ALL ON TABLE "public"."credit_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_packages" TO "service_role";



GRANT ALL ON TABLE "public"."credit_purchases" TO "anon";
GRANT ALL ON TABLE "public"."credit_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "anon";
GRANT ALL ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."fee_items" TO "anon";
GRANT ALL ON TABLE "public"."fee_items" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_items" TO "service_role";



GRANT ALL ON TABLE "public"."tour_schedules" TO "anon";
GRANT ALL ON TABLE "public"."tour_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."tours" TO "anon";
GRANT ALL ON TABLE "public"."tours" TO "authenticated";
GRANT ALL ON TABLE "public"."tours" TO "service_role";



GRANT ALL ON TABLE "public"."guide_analytics_daily" TO "anon";
GRANT ALL ON TABLE "public"."guide_analytics_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_analytics_daily" TO "service_role";



GRANT ALL ON TABLE "public"."guide_credits" TO "anon";
GRANT ALL ON TABLE "public"."guide_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_credits" TO "service_role";



GRANT ALL ON TABLE "public"."guide_plans" TO "anon";
GRANT ALL ON TABLE "public"."guide_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_plans" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."guide_stats_view" TO "anon";
GRANT ALL ON TABLE "public"."guide_stats_view" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_stats_view" TO "service_role";



GRANT ALL ON TABLE "public"."guide_verification_documents" TO "anon";
GRANT ALL ON TABLE "public"."guide_verification_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_verification_documents" TO "service_role";



GRANT ALL ON TABLE "public"."guide_verifications" TO "anon";
GRANT ALL ON TABLE "public"."guide_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."guide_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."plan_settings" TO "anon";
GRANT ALL ON TABLE "public"."plan_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_settings" TO "service_role";



GRANT ALL ON TABLE "public"."platform_config" TO "anon";
GRANT ALL ON TABLE "public"."platform_config" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_config" TO "service_role";



GRANT ALL ON TABLE "public"."promo_code_redemptions" TO "anon";
GRANT ALL ON TABLE "public"."promo_code_redemptions" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_code_redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_codes" TO "service_role";



GRANT ALL ON TABLE "public"."review_qr_reviews" TO "anon";
GRANT ALL ON TABLE "public"."review_qr_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."review_qr_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."public_review_feed" TO "anon";
GRANT ALL ON TABLE "public"."public_review_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."public_review_feed" TO "service_role";



GRANT ALL ON TABLE "public"."review_qr_allowlist" TO "anon";
GRANT ALL ON TABLE "public"."review_qr_allowlist" TO "authenticated";
GRANT ALL ON TABLE "public"."review_qr_allowlist" TO "service_role";



GRANT ALL ON TABLE "public"."review_qr_google_events" TO "anon";
GRANT ALL ON TABLE "public"."review_qr_google_events" TO "authenticated";
GRANT ALL ON TABLE "public"."review_qr_google_events" TO "service_role";



GRANT ALL ON TABLE "public"."review_qr_sessions" TO "anon";
GRANT ALL ON TABLE "public"."review_qr_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."review_qr_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."review_qr_tour_links" TO "anon";
GRANT ALL ON TABLE "public"."review_qr_tour_links" TO "authenticated";
GRANT ALL ON TABLE "public"."review_qr_tour_links" TO "service_role";



GRANT ALL ON TABLE "public"."room_members" TO "anon";
GRANT ALL ON TABLE "public"."room_members" TO "authenticated";
GRANT ALL ON TABLE "public"."room_members" TO "service_role";



GRANT ALL ON TABLE "public"."tour_boosts" TO "anon";
GRANT ALL ON TABLE "public"."tour_boosts" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_boosts" TO "service_role";



GRANT ALL ON TABLE "public"."tour_stops" TO "anon";
GRANT ALL ON TABLE "public"."tour_stops" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_stops" TO "service_role";



GRANT ALL ON TABLE "public"."wishlists" TO "anon";
GRANT ALL ON TABLE "public"."wishlists" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlists" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































