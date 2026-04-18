-- Migration: Enhance tour_boosts table with boost type and expiry
-- Description: Track what kind of boost was purchased and when it expires

DO $$ 
BEGIN
  -- Add boost_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tour_boosts' AND column_name = 'boost_type') THEN
    ALTER TABLE public.tour_boosts ADD COLUMN boost_type text;
  END IF;

  -- Add expires_at if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tour_boosts' AND column_name = 'expires_at') THEN
    ALTER TABLE public.tour_boosts ADD COLUMN expires_at timestamp with time zone;
  END IF;

  -- Add is_active if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tour_boosts' AND column_name = 'is_active') THEN
    ALTER TABLE public.tour_boosts ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Add constraint for boost_type
ALTER TABLE public.tour_boosts 
DROP CONSTRAINT IF EXISTS tour_boosts_boost_type_check;

ALTER TABLE public.tour_boosts 
ADD CONSTRAINT tour_boosts_boost_type_check 
CHECK (boost_type IN ('featured_listing', 'search_boost', 'profile_highlight', 'priority_placement', 'advanced_analytics'));

COMMENT ON COLUMN public.tour_boosts.boost_type IS 'Type of boost purchased';
COMMENT ON COLUMN public.tour_boosts.expires_at IS 'When this boost expires';
COMMENT ON COLUMN public.tour_boosts.is_active IS 'Whether this boost is currently active';