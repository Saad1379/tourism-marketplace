BEGIN;

CREATE TABLE IF NOT EXISTS public.review_qr_tour_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  guide_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  public_token text NOT NULL,
  public_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS review_qr_tour_links_tour_uidx
  ON public.review_qr_tour_links (tour_id);

CREATE UNIQUE INDEX IF NOT EXISTS review_qr_tour_links_token_uidx
  ON public.review_qr_tour_links (public_token);

CREATE UNIQUE INDEX IF NOT EXISTS review_qr_tour_links_token_hash_uidx
  ON public.review_qr_tour_links (public_token_hash);

CREATE INDEX IF NOT EXISTS review_qr_tour_links_guide_status_idx
  ON public.review_qr_tour_links (guide_id, status, updated_at DESC);

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

CREATE OR REPLACE FUNCTION public.get_or_create_review_qr_tour_link(
  p_tour_id uuid,
  p_guide_id uuid
)
RETURNS TABLE(
  tour_id uuid,
  guide_id uuid,
  public_token text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.get_review_qr_tour_public_state(
  p_public_token text
)
RETURNS TABLE(
  tour_id uuid,
  guide_id uuid,
  tour_title text,
  guide_name text,
  session_id uuid,
  schedule_id uuid,
  schedule_start_time timestamptz,
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
  v_tour_id uuid;
  v_guide_id uuid;
BEGIN
  IF COALESCE(trim(p_public_token), '') = '' THEN
    RETURN;
  END IF;

  v_token_hash := encode(digest(p_public_token, 'sha256'), 'hex');

  SELECT l.tour_id, l.guide_id
  INTO v_tour_id, v_guide_id
  FROM public.review_qr_tour_links l
  WHERE l.public_token_hash = v_token_hash
    AND l.status = 'active'
  LIMIT 1;

  IF v_tour_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_TOUR_QR_TOKEN';
  END IF;

  UPDATE public.review_qr_sessions
  SET status = 'expired'
  WHERE tour_id = v_tour_id
    AND guide_id = v_guide_id
    AND status = 'active'
    AND expires_at <= now();

  RETURN QUERY
  SELECT
    t.id,
    v_guide_id,
    COALESCE(t.title, 'Tour') AS tour_title,
    COALESCE(p.full_name, 'Guide') AS guide_name,
    s.id,
    s.schedule_id,
    ts.start_time,
    s.slots_total,
    s.slots_used,
    GREATEST(s.slots_total - s.slots_used, 0) AS slots_remaining,
    s.expires_at,
    s.status,
    (s.status = 'active' AND s.expires_at > now() AND s.slots_used < s.slots_total) AS is_open
  FROM public.tours t
  LEFT JOIN public.profiles p ON p.id = v_guide_id
  LEFT JOIN public.review_qr_sessions s
    ON s.tour_id = t.id
   AND s.guide_id = v_guide_id
   AND s.status = 'active'
   AND s.expires_at > now()
   AND s.slots_used < s.slots_total
  LEFT JOIN public.tour_schedules ts ON ts.id = s.schedule_id
  WHERE t.id = v_tour_id
  ORDER BY ts.start_time ASC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_review_via_tour_qr(
  p_tour_public_token text,
  p_session_id uuid,
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

COMMIT;
