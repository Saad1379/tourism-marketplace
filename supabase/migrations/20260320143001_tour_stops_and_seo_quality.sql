BEGIN;

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_meta_description text,
  ADD COLUMN IF NOT EXISTS seo_title_manually_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_meta_description_manually_overridden boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.tour_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  stop_name text NOT NULL,
  highlight text,
  route_snapshot text,
  google_context text,
  highlight_manually_overridden boolean NOT NULL DEFAULT false,
  route_snapshot_manually_overridden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tour_stops_tour_position_uidx
  ON public.tour_stops (tour_id, position);

CREATE INDEX IF NOT EXISTS tour_stops_tour_created_idx
  ON public.tour_stops (tour_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tour_stops_tour_updated_idx
  ON public.tour_stops (tour_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_tour_stops_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'tour_stops_touch_updated_at'
      AND tgrelid = 'public.tour_stops'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER tour_stops_touch_updated_at
    BEFORE UPDATE ON public.tour_stops
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_tour_stops_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.tour_stops ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tour_stops'
      AND policyname = 'tour_stops_public_or_owner_select'
  ) THEN
    CREATE POLICY tour_stops_public_or_owner_select
      ON public.tour_stops FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.tours t
          WHERE t.id = tour_stops.tour_id
            AND (t.status = 'published' OR t.guide_id = auth.uid())
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tour_stops'
      AND policyname = 'tour_stops_owner_insert'
  ) THEN
    CREATE POLICY tour_stops_owner_insert
      ON public.tour_stops FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.tours t
          WHERE t.id = tour_stops.tour_id
            AND t.guide_id = auth.uid()
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tour_stops'
      AND policyname = 'tour_stops_owner_update'
  ) THEN
    CREATE POLICY tour_stops_owner_update
      ON public.tour_stops FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.tours t
          WHERE t.id = tour_stops.tour_id
            AND t.guide_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.tours t
          WHERE t.id = tour_stops.tour_id
            AND t.guide_id = auth.uid()
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tour_stops'
      AND policyname = 'tour_stops_owner_delete'
  ) THEN
    CREATE POLICY tour_stops_owner_delete
      ON public.tour_stops FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.tours t
          WHERE t.id = tour_stops.tour_id
            AND t.guide_id = auth.uid()
        )
      );
  END IF;
END;
$$;

WITH expanded AS (
  SELECT
    t.id AS tour_id,
    trim(h.stop_name) AS stop_name,
    h.position::integer AS position
  FROM public.tours t
  CROSS JOIN LATERAL unnest(COALESCE(t.highlights, ARRAY[]::text[])) WITH ORDINALITY AS h(stop_name, position)
  WHERE trim(COALESCE(h.stop_name, '')) <> ''
)
INSERT INTO public.tour_stops (
  tour_id,
  position,
  stop_name,
  created_at,
  updated_at
)
SELECT
  e.tour_id,
  e.position,
  e.stop_name,
  now(),
  now()
FROM expanded e
ON CONFLICT (tour_id, position)
DO UPDATE SET
  stop_name = EXCLUDED.stop_name,
  updated_at = now();

COMMIT;
