-- Guide ID Verification via Sumsub
-- Ensures guide_verified column exists on profiles (may already exist)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guide_verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.guide_verified IS 'Set to true when Sumsub ID verification returns GREEN';
