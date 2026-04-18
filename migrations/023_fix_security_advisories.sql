-- Migration: Fix Supabase Security Advisories
-- Description: Enables RLS on public tables missing it, and converts Security Definer views to Security Invoker to resolve Supabase security warnings.

-- 1. Enable RLS on tables that have policies but RLS is currently disabled
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_items ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on tables flagged as completely public and missing RLS
ALTER TABLE public.guide_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- 3. Add precise read policies for newly RLS-enabled public tables so they don't break the app
-- guide_plans: Anyone should be able to see guide plans (since tours are public and plan dictates capacity limits etc)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read for guide_plans' AND tablename = 'guide_plans') THEN
        CREATE POLICY "Public read for guide_plans" ON public.guide_plans FOR SELECT TO authenticated USING (true);
    END IF;
END
$$;

-- platform_config: Should only be readable by authenticated users and only if the config is marked public
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public config read' AND tablename = 'platform_config') THEN
        CREATE POLICY "Public config read" ON public.platform_config FOR SELECT TO authenticated USING (is_public = true);
    END IF;
END
$$;

-- credit_packages: Pricing should be visible to any logged-in user
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read for authenticated on credit_packages' AND tablename = 'credit_packages') THEN
        CREATE POLICY "Read for authenticated on credit_packages" ON public.credit_packages FOR SELECT TO authenticated USING (true);
    END IF;
END
$$;

-- credit_purchases: Should ONLY be visible to the user who made the purchase
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own purchases' AND tablename = 'credit_purchases') THEN
        CREATE POLICY "Users can read own purchases" ON public.credit_purchases FOR SELECT TO authenticated USING (guide_id = auth.uid());
    END IF;
END
$$;

-- room_members: Should ONLY be visible to the user who is a member of the room
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own room memberships' AND tablename = 'room_members') THEN
        CREATE POLICY "Users can read own room memberships" ON public.room_members FOR SELECT TO authenticated USING (user_id = auth.uid());
    END IF;
END
$$;

-- 4. Convert SECURITY DEFINER views to SECURITY INVOKER
ALTER VIEW public.guide_stats_view SET (security_invoker = on);
ALTER VIEW public.guide_analytics_daily SET (security_invoker = on);
