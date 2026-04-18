-- Create wishlists table for tourists
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tourist_id, tour_id)
);

-- Enable RLS
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "wishlists_select_own"
  ON public.wishlists FOR SELECT
  USING (tourist_id = auth.uid());

CREATE POLICY "wishlists_insert_own"
  ON public.wishlists FOR INSERT
  WITH CHECK (tourist_id = auth.uid());

CREATE POLICY "wishlists_delete_own"
  ON public.wishlists FOR DELETE
  USING (tourist_id = auth.uid());

-- Index
CREATE INDEX IF NOT EXISTS idx_wishlists_tourist ON public.wishlists(tourist_id);
