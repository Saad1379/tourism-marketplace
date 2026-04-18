-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  tourist_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Review content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT NOT NULL,
  -- Response from guide
  guide_response TEXT,
  guide_responded_at TIMESTAMP WITH TIME ZONE,
  -- Moderation
  is_published BOOLEAN DEFAULT TRUE,
  is_flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "reviews_select_published"
  ON public.reviews FOR SELECT
  USING (is_published = TRUE OR tourist_id = auth.uid() OR guide_id = auth.uid());

CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  WITH CHECK (tourist_id = auth.uid());

CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  USING (tourist_id = auth.uid() OR guide_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_tour_id ON public.reviews(tour_id);
CREATE INDEX IF NOT EXISTS idx_reviews_guide_id ON public.reviews(guide_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);

-- Function to update tour and guide ratings after review
CREATE OR REPLACE FUNCTION update_ratings_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update tour rating
  UPDATE public.tours
  SET 
    rating = (SELECT AVG(rating)::DECIMAL(3,2) FROM public.reviews WHERE tour_id = NEW.tour_id AND is_published = TRUE),
    total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE tour_id = NEW.tour_id AND is_published = TRUE)
  WHERE id = NEW.tour_id;

  -- Update guide rating
  UPDATE public.profiles
  SET 
    guide_rating = (SELECT AVG(rating)::DECIMAL(3,2) FROM public.reviews WHERE guide_id = NEW.guide_id AND is_published = TRUE),
    guide_total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE guide_id = NEW.guide_id AND is_published = TRUE)
  WHERE id = NEW.guide_id;

  RETURN NEW;
END;
$$;

-- Trigger for rating updates
DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
CREATE TRIGGER on_review_created
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_ratings_on_review();
