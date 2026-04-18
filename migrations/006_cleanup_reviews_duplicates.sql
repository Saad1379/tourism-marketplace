-- Migration: Clean up duplicate columns in reviews table
-- Description: Remove redundant comment column (content is the main one)

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'reviews' AND column_name = 'comment') THEN
    ALTER TABLE public.reviews DROP COLUMN comment;
  END IF;
END $$;

-- Kept column: content
COMMENT ON COLUMN public.reviews.content IS 'Main review content text';