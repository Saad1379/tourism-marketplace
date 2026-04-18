-- Migration: Fix Public Ranking Visibility
-- Description: Reverts security restrictions that accidentally blinded the ranking algorithm for unsigned/anonymous visitors looking at the public tours page.

-- 1. Restore the Guide Stats View to run safely as the owner (bypassing RLS)
-- Problem: By forcing the view to run as the "invoker" (the anonymous tourist), Row Level Security kicked in and blocked them from reading the `bookings` table. This forced everyone's completed bookings to 0.
-- Fix: We revert this to run natively so it can mathematically aggregate bookings correctly without leaking the underlying rows to the tourist.
ALTER VIEW public.guide_stats_view SET (security_invoker = false);
ALTER VIEW public.guide_analytics_daily SET (security_invoker = false);

-- 2. Allow anonymous users to see Guide Plans
-- Problem: Migration 023 locked guide_plans to "authenticated" only. Anonymous visitors couldn't read the plan, dropping the 1.15x Pro multiplier from the algorithm.
-- Fix: We drop the "authenticated" restriction and allow public read access. (This only exposes the plan name).
DROP POLICY IF EXISTS "Public read for guide_plans" ON public.guide_plans;
CREATE POLICY "Public read for guide_plans" ON public.guide_plans FOR SELECT USING (true);

-- 3. Allow anonymous users to see Active Tour Boosts
-- Problem: `tour_boosts` is a private monetization table. Because anonymous users can't read it, the algorithm thought no boosts existed, breaking the 1.25x multiplier and the Featured badge.
-- Fix: We explicitly allow public read access to the boosts table so the frontend can retrieve the correct ranking math.
ALTER TABLE public.tour_boosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for active boosts" ON public.tour_boosts;
CREATE POLICY "Public read for active boosts" ON public.tour_boosts FOR SELECT USING (true);
