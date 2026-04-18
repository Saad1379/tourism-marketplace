-- Create tours table for guide tour listings
CREATE TABLE IF NOT EXISTS public.tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  meeting_point TEXT NOT NULL,
  meeting_point_details TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  duration_hours DECIMAL(3, 1) NOT NULL DEFAULT 2,
  max_capacity INTEGER NOT NULL DEFAULT 15,
  languages TEXT[] DEFAULT '{English}',
  highlights TEXT[] DEFAULT '{}',
  included TEXT[] DEFAULT '{}',
  not_included TEXT[] DEFAULT '{}',
  accessibility_info TEXT,
  images TEXT[] DEFAULT '{}',
  cover_image TEXT,
  -- Status and visibility
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  is_featured BOOLEAN DEFAULT FALSE,
  is_premium BOOLEAN DEFAULT FALSE,
  -- Stats
  rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;

-- Policies for tours
CREATE POLICY "tours_select_active"
  ON public.tours FOR SELECT
  USING (status = 'active' OR guide_id = auth.uid());

CREATE POLICY "tours_insert_own"
  ON public.tours FOR INSERT
  WITH CHECK (guide_id = auth.uid());

CREATE POLICY "tours_update_own"
  ON public.tours FOR UPDATE
  USING (guide_id = auth.uid());

CREATE POLICY "tours_delete_own"
  ON public.tours FOR DELETE
  USING (guide_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tours_guide_id ON public.tours(guide_id);
CREATE INDEX IF NOT EXISTS idx_tours_city ON public.tours(city);
CREATE INDEX IF NOT EXISTS idx_tours_status ON public.tours(status);
CREATE INDEX IF NOT EXISTS idx_tours_rating ON public.tours(rating DESC);
