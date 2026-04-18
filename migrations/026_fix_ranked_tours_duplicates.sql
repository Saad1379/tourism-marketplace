-- Migration: Fix Ranked Tours Duplicates
-- Description: Updates get_ranked_tours to only return the nearest future schedule for each tour, preventing a single tour with many schedules from monopolizing the frontend quota.

DROP FUNCTION IF EXISTS public.get_ranked_tours(text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_ranked_tours(
  search_city text DEFAULT NULL,
  search_language text DEFAULT NULL,
  limit_val int DEFAULT 100,
  offset_val int DEFAULT 0
)
RETURNS TABLE (
  tour_id uuid,
  guide_id uuid,
  title text,
  city text,
  price numeric,
  duration_minutes integer,
  meeting_point text,
  images text[],
  photos text[],
  schedule_id uuid,
  start_time timestamp with time zone,
  capacity integer,
  booked_count integer,
  language text,
  plan_type text,
  is_newcomer boolean,
  pool_type text,
  rank_score numeric,
  guide_name text,
  guide_avatar text,
  guide_role text,
  tour_rating double precision,
  tour_review_count integer,
  is_boosted boolean
) AS $$
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
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;
