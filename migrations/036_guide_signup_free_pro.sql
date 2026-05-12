-- Migration: Add platform_config entries for "Guide Signup Free Pro" feature
-- When enabled, new guides who complete signup are instantly given Pro status + bonus credits.

INSERT INTO public.platform_config (key, value, value_type, description, is_public, category, updated_at)
VALUES
  (
    'guide_signup_free_pro_enabled',
    'false',
    'boolean',
    'When true, every new guide who completes signup is instantly given a Pro plan (instead of Free) without any payment.',
    true,
    'guide_signup',
    now()
  ),
  (
    'guide_signup_free_pro_credits',
    '200',
    'integer',
    'Number of bonus credits granted to new guides at signup when guide_signup_free_pro_enabled is true.',
    true,
    'guide_signup',
    now()
  )
ON CONFLICT (key) DO NOTHING;
