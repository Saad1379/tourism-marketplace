-- Create tour schedules for recurring tour times
CREATE TABLE IF NOT EXISTS public.tour_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  start_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tour_schedules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "tour_schedules_select_all"
  ON public.tour_schedules FOR SELECT
  USING (TRUE);

CREATE POLICY "tour_schedules_insert_own"
  ON public.tour_schedules FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tours WHERE id = tour_id AND guide_id = auth.uid())
  );

CREATE POLICY "tour_schedules_update_own"
  ON public.tour_schedules FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.tours WHERE id = tour_id AND guide_id = auth.uid())
  );

CREATE POLICY "tour_schedules_delete_own"
  ON public.tour_schedules FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.tours WHERE id = tour_id AND guide_id = auth.uid())
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_tour_schedules_tour_id ON public.tour_schedules(tour_id);
