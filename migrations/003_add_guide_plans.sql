-- Migration: Add guide plans table for Free vs Pro subscriptions
-- Description: Tracks which plan each guide is on and expiry dates

CREATE TABLE IF NOT EXISTS public.guide_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  guide_id uuid NOT NULL UNIQUE,
  plan_type text NOT NULL DEFAULT 'free',
  started_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  auto_renew boolean DEFAULT false,
  CONSTRAINT guide_plans_pkey PRIMARY KEY (id),
  CONSTRAINT guide_plans_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT guide_plans_plan_type_check CHECK (plan_type IN ('free', 'pro'))
);

-- Auto-create free plan for all existing guides
INSERT INTO public.guide_plans (guide_id, plan_type)
SELECT id, 'free'
FROM public.profiles
WHERE role = 'guide'
ON CONFLICT (guide_id) DO NOTHING;

COMMENT ON TABLE public.guide_plans IS 'Guide subscription plans (free or pro)';