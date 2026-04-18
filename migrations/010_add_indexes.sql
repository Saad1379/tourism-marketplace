-- Migration: Add performance indexes for common queries
-- Description: Speed up frequently accessed data patterns

-- Credit-related indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_guide_id 
ON public.credit_transactions(guide_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at 
ON public.credit_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_guide_id 
ON public.credit_purchases(guide_id);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_status 
ON public.credit_purchases(status);

CREATE INDEX IF NOT EXISTS idx_guide_credits_guide_id 
ON public.guide_credits(guide_id);

-- Booking-related indexes
CREATE INDEX IF NOT EXISTS idx_bookings_schedule_id 
ON public.bookings(schedule_id);

CREATE INDEX IF NOT EXISTS idx_bookings_tourist_id 
ON public.bookings(tourist_id);

CREATE INDEX IF NOT EXISTS idx_bookings_tour_id 
ON public.bookings(tour_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status 
ON public.bookings(status);

-- Attendance index
CREATE INDEX IF NOT EXISTS idx_attendance_booking_id 
ON public.attendance(booking_id);

-- Tour boosts index for active boosts
CREATE INDEX IF NOT EXISTS idx_tour_boosts_active 
ON public.tour_boosts(expires_at) 
WHERE is_active = true;

-- Guide plans index
CREATE INDEX IF NOT EXISTS idx_guide_plans_guide_id 
ON public.guide_plans(guide_id);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_tour_id 
ON public.reviews(tour_id);

CREATE INDEX IF NOT EXISTS idx_reviews_guide_id 
ON public.reviews(guide_id);

-- Tours indexes
CREATE INDEX IF NOT EXISTS idx_tours_guide_id 
ON public.tours(guide_id);

CREATE INDEX IF NOT EXISTS idx_tours_status 
ON public.tours(status);

CREATE INDEX IF NOT EXISTS idx_tours_city 
ON public.tours(city);

COMMENT ON INDEX idx_credit_transactions_guide_id IS 'Speed up credit transaction lookups by guide';
COMMENT ON INDEX idx_bookings_status IS 'Speed up booking status filtering';
COMMENT ON INDEX idx_tour_boosts_active IS 'Speed up active boost lookups';