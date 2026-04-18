-- Migration: Create Guide Stats View for Ranking Algorithm
-- Description: Aggregates reviews and bookings to compute guide reliability, rating, and review counts for use in ranking.

CREATE OR REPLACE VIEW public.guide_stats_view AS
WITH review_stats AS (
  SELECT 
    guide_id,
    COUNT(*) as total_reviews,
    COALESCE(AVG(rating), 0) as avg_rating
  FROM public.reviews
  WHERE is_published = true
  GROUP BY guide_id
),
booking_stats AS (
  SELECT 
    schedule.tour_id,
    tour.guide_id,
    COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_tours,
    COUNT(CASE WHEN b.status IN ('cancelled', 'no_show') THEN 1 END) as cancelled_tours
  FROM public.bookings b
  JOIN public.tour_schedules schedule ON b.schedule_id = schedule.id
  JOIN public.tours tour ON schedule.tour_id = tour.id
  GROUP BY schedule.tour_id, tour.guide_id
),
guide_booking_totals AS (
  SELECT 
    guide_id,
    SUM(completed_tours) as total_completed,
    SUM(cancelled_tours) as total_cancelled
  FROM booking_stats
  GROUP BY guide_id
)
SELECT 
  p.id as guide_id,
  COALESCE(r.total_reviews, 0) as reviews_count,
  COALESCE(r.avg_rating, 0) as raw_rating,
  -- Bayesian average approximation (assuming prior of 5 reviews with 4.5 rating)
  -- Formlua: (C*m + sum(ratings)) / (C + n)
  (5 * 4.5 + COALESCE(r.avg_rating, 0) * COALESCE(r.total_reviews, 0)) / NULLIF(5 + COALESCE(r.total_reviews, 0), 0) as bayesian_rating,
  COALESCE(b.total_completed, 0) as completed_bookings,
  COALESCE(b.total_cancelled, 0) as cancelled_bookings,
  -- Reliability norm: completed / total (default to 1.0 if no bookings)
  CASE 
    WHEN COALESCE(b.total_completed, 0) + COALESCE(b.total_cancelled, 0) = 0 THEN 1.0
    ELSE COALESCE(b.total_completed, 0)::numeric / (COALESCE(b.total_completed, 0) + COALESCE(b.total_cancelled, 0))
  END as reliability_score,
  -- Newcomer flag evaluation (< 10 reviews OR account age < 30 days)
  CASE 
    WHEN COALESCE(r.total_reviews, 0) < 10 OR p.created_at > (NOW() - INTERVAL '30 days') THEN true
    ELSE false
  END as is_newcomer
FROM public.profiles p
LEFT JOIN review_stats r ON p.id = r.guide_id
LEFT JOIN guide_booking_totals b ON p.id = b.guide_id
WHERE p.roles @> ARRAY['guide'::text] OR p.role = 'guide';
