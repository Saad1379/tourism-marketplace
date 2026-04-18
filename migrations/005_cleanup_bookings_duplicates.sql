-- Migration: Clean up duplicate columns in bookings table
-- Description: Remove redundant attendance tracking columns
-- WARNING: Ensure your app code doesn't reference these columns before running!

-- Check if columns exist before dropping (safe approach)
DO $$ 
BEGIN
  -- Drop duplicate attendance columns
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'bookings' AND column_name = 'attended_by_tourist') THEN
    ALTER TABLE public.bookings DROP COLUMN attended_by_tourist;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'bookings' AND column_name = 'attended_by_guide') THEN
    ALTER TABLE public.bookings DROP COLUMN attended_by_guide;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'bookings' AND column_name = 'guide_attended') THEN
    ALTER TABLE public.bookings DROP COLUMN guide_attended;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'bookings' AND column_name = 'tourist_attended') THEN
    ALTER TABLE public.bookings DROP COLUMN tourist_attended;
  END IF;

  -- Drop duplicate timestamp columns
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'bookings' AND column_name = 'attended_by_tourist_at') THEN
    ALTER TABLE public.bookings DROP COLUMN attended_by_tourist_at;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'bookings' AND column_name = 'attended_by_guide_at') THEN
    ALTER TABLE public.bookings DROP COLUMN attended_by_guide_at;
  END IF;
END $$;

-- Kept columns: guide_confirmed_attendance, tourist_confirmed_attendance, attendance_confirmed_at, attended_at
COMMENT ON COLUMN public.bookings.guide_confirmed_attendance IS 'Guide confirmed this booking attendance';
COMMENT ON COLUMN public.bookings.tourist_confirmed_attendance IS 'Tourist confirmed this booking attendance';
COMMENT ON COLUMN public.bookings.attendance_confirmed_at IS 'Timestamp when both parties confirmed';
COMMENT ON COLUMN public.bookings.attended_at IS 'Final attendance timestamp';