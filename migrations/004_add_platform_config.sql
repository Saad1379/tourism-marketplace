-- Migration: Add platform configuration table
-- Description: Central place for all business rules and configurable values

CREATE TABLE IF NOT EXISTS public.platform_config (
  key text NOT NULL,
  value text NOT NULL,
  value_type text NOT NULL DEFAULT 'string',
  description text,
  is_public boolean DEFAULT false,
  category text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT platform_config_pkey PRIMARY KEY (key)
);

-- Seed business rules based on client requirements
INSERT INTO public.platform_config (key, value, value_type, description, is_public, category) VALUES
  -- PRICING (1 credit = 1 euro, as per client: €3 per adult)
  ('credit_price_eur', '1.00', 'decimal', 'Base price: 1 credit = €1', true, 'pricing'),
  ('credits_per_adult', '3', 'integer', 'Platform fee: 3 credits (€3) per adult attendee', false, 'pricing'),
  ('credits_per_child', '0', 'integer', 'Children under 10 are free', false, 'pricing'),
  ('child_age_limit', '10', 'integer', 'Maximum age to be considered a child (free)', true, 'pricing'),
  
  -- PLAN LIMITS
  ('free_plan_max_tours', '3', 'integer', 'Max active tours for free plan', true, 'limits'),
  ('free_plan_max_capacity', '10', 'integer', 'Max guests per tour for free plan', true, 'limits'),
  ('pro_plan_max_tours', '-1', 'integer', 'Unlimited tours for pro plan', true, 'limits'),
  ('pro_plan_max_capacity', '-1', 'integer', 'Unlimited capacity for pro plan', true, 'limits'),
  ('pro_plan_monthly_price_eur', '29.99', 'decimal', 'Pro plan monthly subscription cost', true, 'pricing'),
  
  -- MARKETING BOOSTS (in credits, which equal euros)
  ('featured_listing_credits', '25', 'integer', 'Featured Listing boost (€25 for 7 days)', true, 'marketing'),
  ('featured_listing_duration_days', '7', 'integer', 'Featured Listing duration', true, 'marketing'),
  ('search_boost_credits', '15', 'integer', 'Search Boost (€15 for 3 days)', true, 'marketing'),
  ('search_boost_duration_days', '3', 'integer', 'Search Boost duration', true, 'marketing'),
  ('profile_highlight_credits', '20', 'integer', 'Profile Highlight (€20 for 5 days)', true, 'marketing'),
  ('profile_highlight_duration_days', '5', 'integer', 'Profile Highlight duration', true, 'marketing'),
  ('priority_placement_credits', '40', 'integer', 'Priority Placement (€40 for 14 days)', true, 'marketing'),
  ('priority_placement_duration_days', '14', 'integer', 'Priority Placement duration', true, 'marketing'),
  ('advanced_analytics_credits', '30', 'integer', 'Advanced Analytics (€30 for 30 days)', true, 'marketing'),
  ('advanced_analytics_duration_days', '30', 'integer', 'Advanced Analytics duration', true, 'marketing'),
  
  -- CREDIT MANAGEMENT
  ('low_balance_threshold', '20', 'integer', 'Show low balance warning when credits fall below this', true, 'features'),
  ('min_purchase_credits', '50', 'integer', 'Minimum credits in a single purchase', true, 'features'),
  ('auto_recharge_enabled', 'true', 'boolean', 'Allow guides to enable auto-recharge', true, 'features'),
  ('auto_recharge_default_amount', '100', 'integer', 'Default auto-recharge amount in credits', true, 'features')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.platform_config IS 'Platform-wide configuration and business rules';
COMMENT ON COLUMN public.platform_config.value_type IS 'Data type: string, integer, decimal, boolean';
COMMENT ON COLUMN public.platform_config.is_public IS 'Whether this setting is visible to users in UI';
COMMENT ON COLUMN public.platform_config.category IS 'Config grouping: pricing, limits, marketing, features';