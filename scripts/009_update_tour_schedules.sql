-- Migration: Update tour_schedules table to support recurring schedules with language and capacity
-- Adds: language, capacity, booked_count, and changes start_time to timestamptz

ALTER TABLE public.tour_schedules
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English',
ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS booked_count INTEGER DEFAULT 0;

-- Alter start_time to be timestamptz instead of TIME (store full datetime for each occurrence)
ALTER TABLE public.tour_schedules 
ALTER COLUMN start_time TYPE TIMESTAMP WITH TIME ZONE USING start_time AT TIME ZONE 'UTC';

-- Drop old day_of_week column if it exists (no longer needed with full timestamps)
ALTER TABLE public.tour_schedules
DROP COLUMN IF EXISTS day_of_week;

-- Add unique constraint to prevent duplicate schedules for same time/language/tour
ALTER TABLE public.tour_schedules
ADD CONSTRAINT unique_tour_schedule UNIQUE (tour_id, start_time, language);

-- Add index for faster queries by language
CREATE INDEX IF NOT EXISTS idx_tour_schedules_language ON public.tour_schedules(language);
CREATE INDEX IF NOT EXISTS idx_tour_schedules_start_time ON public.tour_schedules(start_time);

COMMIT;
