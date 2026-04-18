BEGIN;

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autoseo_article_id bigint NOT NULL,
  autoseo_delivery_id text,
  autoseo_event text NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  meta_description text,
  content_html text NOT NULL,
  content_markdown text,
  hero_image_url text,
  hero_image_alt text,
  infographic_image_url text,
  keywords text[] NOT NULL DEFAULT '{}',
  meta_keywords text,
  faq_schema jsonb,
  language_code text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'published',
  published_at timestamptz,
  source_updated_at timestamptz,
  source_created_at timestamptz,
  source_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_autoseo_article_id_uidx
  ON public.blog_posts (autoseo_article_id);

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_uidx
  ON public.blog_posts (slug);

CREATE INDEX IF NOT EXISTS blog_posts_status_published_at_idx
  ON public.blog_posts (status, published_at DESC);

CREATE INDEX IF NOT EXISTS blog_posts_language_status_idx
  ON public.blog_posts (language_code, status);

COMMIT;
