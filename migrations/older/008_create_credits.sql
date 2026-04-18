-- Create guide credits table
CREATE TABLE IF NOT EXISTS public.guide_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER DEFAULT 0,
  lifetime_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.guide_credits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "guide_credits_select_own"
  ON public.guide_credits FOR SELECT
  USING (guide_id = auth.uid());

CREATE POLICY "guide_credits_update_own"
  ON public.guide_credits FOR UPDATE
  USING (guide_id = auth.uid());

-- Create credit transactions table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'spend', 'bonus', 'refund')),
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  -- For purchases
  package_name TEXT,
  payment_intent_id TEXT,
  -- For spending
  feature_type TEXT CHECK (feature_type IN ('featured_listing', 'search_boost', 'profile_highlight', 'priority_placement', 'analytics')),
  feature_expires_at TIMESTAMP WITH TIME ZONE,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "credit_transactions_select_own"
  ON public.credit_transactions FOR SELECT
  USING (guide_id = auth.uid());

CREATE POLICY "credit_transactions_insert_own"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (guide_id = auth.uid());

-- Index
CREATE INDEX IF NOT EXISTS idx_credit_transactions_guide ON public.credit_transactions(guide_id);

-- Create active boosts table
CREATE TABLE IF NOT EXISTS public.active_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES public.tours(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('featured_listing', 'search_boost', 'profile_highlight', 'priority_placement', 'analytics')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS
ALTER TABLE public.active_boosts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "active_boosts_select_own"
  ON public.active_boosts FOR SELECT
  USING (guide_id = auth.uid() OR is_active = TRUE);

CREATE POLICY "active_boosts_insert_own"
  ON public.active_boosts FOR INSERT
  WITH CHECK (guide_id = auth.uid());

CREATE POLICY "active_boosts_update_own"
  ON public.active_boosts FOR UPDATE
  USING (guide_id = auth.uid());

-- Index
CREATE INDEX IF NOT EXISTS idx_active_boosts_guide ON public.active_boosts(guide_id);
CREATE INDEX IF NOT EXISTS idx_active_boosts_expires ON public.active_boosts(expires_at);
