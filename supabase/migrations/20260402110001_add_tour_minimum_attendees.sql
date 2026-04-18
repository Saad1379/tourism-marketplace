BEGIN;

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS minimum_attendees integer;

UPDATE public.tours
SET minimum_attendees = 1
WHERE minimum_attendees IS NULL;

ALTER TABLE public.tours
  ALTER COLUMN minimum_attendees SET DEFAULT 1,
  ALTER COLUMN minimum_attendees SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tours_minimum_attendees_check'
      AND conrelid = 'public.tours'::regclass
  ) THEN
    ALTER TABLE public.tours
      ADD CONSTRAINT tours_minimum_attendees_check CHECK (minimum_attendees >= 1);
  END IF;
END;
$$;

COMMIT;
