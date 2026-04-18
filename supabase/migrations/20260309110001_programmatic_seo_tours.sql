-- Programmatic SEO for tours:
-- - Adds canonical slugs and SEO keyword storage on tours
-- - Backfills deterministic city/tour slugs for existing rows
-- - Adds city-level SEO content table for optional editorial descriptions

BEGIN;

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS city_slug text,
  ADD COLUMN IF NOT EXISTS tour_slug text,
  ADD COLUMN IF NOT EXISTS seo_keywords text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.slugify_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      trim(both '-' FROM regexp_replace(lower(COALESCE(input, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    ''
  );
$$;

WITH normalized AS (
  SELECT
    t.id,
    COALESCE(NULLIF(public.slugify_text(t.city), ''), 'city') AS normalized_city_slug,
    COALESCE(NULLIF(public.slugify_text(t.title), ''), 'tour') AS normalized_tour_slug,
    t.created_at
  FROM public.tours t
),
ranked AS (
  SELECT
    n.id,
    n.normalized_city_slug,
    n.normalized_tour_slug,
    ROW_NUMBER() OVER (
      PARTITION BY n.normalized_city_slug, n.normalized_tour_slug
      ORDER BY n.created_at NULLS LAST, n.id
    ) AS slug_rank
  FROM normalized n
)
UPDATE public.tours t
SET
  city_slug = r.normalized_city_slug,
  tour_slug = CASE
    WHEN r.slug_rank = 1 THEN r.normalized_tour_slug
    ELSE r.normalized_tour_slug || '-' || r.slug_rank::text
  END
FROM ranked r
WHERE t.id = r.id;

ALTER TABLE public.tours
  ALTER COLUMN city_slug SET NOT NULL,
  ALTER COLUMN tour_slug SET NOT NULL,
  ALTER COLUMN seo_keywords SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tours_city_slug_tour_slug_uidx
  ON public.tours (city_slug, tour_slug);

CREATE INDEX IF NOT EXISTS tours_city_slug_idx
  ON public.tours (city_slug);

CREATE INDEX IF NOT EXISTS tours_status_city_slug_idx
  ON public.tours (status, city_slug);

CREATE TABLE IF NOT EXISTS public.city_seo_content (
  city_slug text PRIMARY KEY,
  city_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_city_seo_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS city_seo_content_touch_updated_at ON public.city_seo_content;
CREATE TRIGGER city_seo_content_touch_updated_at
BEFORE UPDATE ON public.city_seo_content
FOR EACH ROW
EXECUTE FUNCTION public.touch_city_seo_content_updated_at();

INSERT INTO public.city_seo_content (city_slug, city_name)
SELECT
  t.city_slug,
  MIN(COALESCE(NULLIF(trim(t.city), ''), initcap(replace(t.city_slug, '-', ' ')))) AS city_name
FROM public.tours t
WHERE COALESCE(t.city_slug, '') <> ''
GROUP BY t.city_slug
ON CONFLICT (city_slug) DO NOTHING;

COMMIT;
