BEGIN;

CREATE TABLE IF NOT EXISTS public.review_qr_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug text NOT NULL,
  guide_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS review_qr_allowlist_city_guide_uidx
  ON public.review_qr_allowlist (city_slug, guide_id);

CREATE INDEX IF NOT EXISTS review_qr_allowlist_enabled_idx
  ON public.review_qr_allowlist (enabled, city_slug);

CREATE TABLE IF NOT EXISTS public.review_qr_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.tour_schedules(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  guide_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city_slug text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
  slots_total integer NOT NULL CHECK (slots_total > 0),
  slots_used integer NOT NULL DEFAULT 0 CHECK (slots_used >= 0),
  public_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS review_qr_sessions_public_token_hash_uidx
  ON public.review_qr_sessions (public_token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS review_qr_sessions_one_active_per_schedule_uidx
  ON public.review_qr_sessions (schedule_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS review_qr_sessions_schedule_idx
  ON public.review_qr_sessions (schedule_id, created_at DESC);

CREATE INDEX IF NOT EXISTS review_qr_sessions_guide_idx
  ON public.review_qr_sessions (guide_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.review_qr_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.review_qr_sessions(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.tour_schedules(id) ON DELETE CASCADE,
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  guide_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  content text NOT NULL,
  reviewer_name text,
  is_published boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT true,
  verification_method text NOT NULL DEFAULT 'guide_qr_session',
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_qr_reviews_session_idx
  ON public.review_qr_reviews (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS review_qr_reviews_tour_idx
  ON public.review_qr_reviews (tour_id, created_at DESC);

CREATE INDEX IF NOT EXISTS review_qr_reviews_guide_idx
  ON public.review_qr_reviews (guide_id, created_at DESC);

CREATE INDEX IF NOT EXISTS review_qr_reviews_ip_hash_idx
  ON public.review_qr_reviews (ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS public.review_qr_google_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.review_qr_sessions(id) ON DELETE SET NULL,
  review_id uuid REFERENCES public.review_qr_reviews(id) ON DELETE SET NULL,
  tour_id uuid REFERENCES public.tours(id) ON DELETE SET NULL,
  guide_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent_hash text
);

CREATE INDEX IF NOT EXISTS review_qr_google_events_clicked_idx
  ON public.review_qr_google_events (clicked_at DESC);

CREATE OR REPLACE FUNCTION public.create_review_qr_session(
  p_schedule_id uuid,
  p_guide_id uuid,
  p_ttl_minutes integer DEFAULT 180
)
RETURNS TABLE(
  session_id uuid,
  public_token text,
  expires_at timestamptz,
  slots_total integer,
  slots_remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tour_id uuid;
  v_city_slug text;
  v_slots integer;
  v_token text;
  v_token_hash text;
  v_session_id uuid;
  v_expires_at timestamptz;
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
END;
$$;

CREATE OR REPLACE FUNCTION public.get_qr_session_public_state(
  p_public_token text
)
RETURNS TABLE(
  session_id uuid,
  schedule_id uuid,
  tour_id uuid,
  guide_id uuid,
  tour_title text,
  guide_name text,
  slots_total integer,
  slots_used integer,
  slots_remaining integer,
  expires_at timestamptz,
  status text,
  is_open boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.submit_review_via_qr(
  p_public_token text,
  p_rating integer,
  p_title text DEFAULT NULL,
  p_content text DEFAULT NULL,
  p_reviewer_name text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL,
  p_user_agent_hash text DEFAULT NULL
)
RETURNS TABLE(
  review_id uuid,
  session_id uuid,
  slots_remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

CREATE OR REPLACE VIEW public.public_review_feed AS
SELECT
  r.id,
  'booking'::text AS source,
  r.rating,
  r.title,
  r.content,
  r.created_at,
  r.tour_id,
  t.title AS tour_title,
  t.city AS tour_city,
  COALESCE(p.full_name, 'Anonymous Traveler') AS author_name,
  p.avatar_url AS author_avatar,
  true AS is_verified
FROM public.reviews r
LEFT JOIN public.tours t ON t.id = r.tour_id
LEFT JOIN public.profiles p ON p.id = r.tourist_id
WHERE COALESCE(r.is_published, true) = true

UNION ALL

SELECT
  qr.id,
  'qr'::text AS source,
  qr.rating,
  qr.title,
  qr.content,
  qr.created_at,
  qr.tour_id,
  t.title AS tour_title,
  t.city AS tour_city,
  COALESCE(NULLIF(trim(qr.reviewer_name), ''), 'Verified Guest') AS author_name,
  NULL::text AS author_avatar,
  true AS is_verified
FROM public.review_qr_reviews qr
LEFT JOIN public.tours t ON t.id = qr.tour_id
WHERE qr.is_published = true;

COMMIT;
