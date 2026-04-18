-- Migration: Clean up duplicate columns in messages table
-- Description: Remove redundant content column (body is the main one)

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'messages' AND column_name = 'content') THEN
    ALTER TABLE public.messages DROP COLUMN content;
  END IF;
END $$;

-- Kept column: body
COMMENT ON COLUMN public.messages.body IS 'Main message text content';