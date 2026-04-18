-- Migration: Fix Function Search Path and Materialized View Vulnerabilities
-- Description: Secures pgSQL functions by explicitly setting the search_path to 'public' to prevent search path injection attacks. Fixes materialized view exposing data and removes overly permissive 'true' UPDATE policy on bookings.

-- 1. Secure Functions by explicitly setting the search_path
-- Doing this prevents malicious actors from creating spoofed tables in other schemas and tricking the function into reading/writing to them.
ALTER FUNCTION public.get_ranked_tours(search_city text, search_language text, limit_val integer, offset_val integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.create_booking(p_schedule_id uuid, p_adults integer, p_children integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.finalize_credits_on_attendance(p_booking_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_booking_as(p_user_id uuid, p_schedule_id uuid, p_adults integer, p_children integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.deduct_credits_on_booking(p_booking_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.add_credits(p_guide_id uuid, p_credits integer, p_description text, p_reference_id text) SET search_path = public, pg_temp;
ALTER FUNCTION public._recalc_booked_count_trigger() SET search_path = public, pg_temp;
ALTER FUNCTION public.refund_credits_on_cancellation(p_booking_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.room_messages_broadcast_trigger() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_auth_user() SET search_path = public, pg_temp;

-- 2. Secure Materialized View
-- Problem: guide_analytics_daily_mv is technically a physical snapshot of data, which bypassed RLS rules of the view.
-- Solution: Drop the materialized view. Next.js server components cache the underlying view automatically, so the materialized copy is an unnecessary security risk.
DROP MATERIALIZED VIEW IF EXISTS public.guide_analytics_daily_mv;

-- 3. Fix Overly Permissive UPDATE Policy
-- Problem: The 'bookings_update_guide' policy had WITH CHECK (true), meaning a malicious guide could bypass validation.
-- Solution: Sync the WITH CHECK clause to match the USING clause so they can only update bookings for their *own* tours.
DROP POLICY IF EXISTS "bookings_update_guide" ON public.bookings;
CREATE POLICY "bookings_update_guide" ON public.bookings
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tour_schedules s
      JOIN public.tours t ON t.id = s.tour_id
      WHERE s.id = bookings.schedule_id AND t.guide_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tour_schedules s
      JOIN public.tours t ON t.id = s.tour_id
      WHERE s.id = bookings.schedule_id AND t.guide_id = auth.uid()
    )
  );
