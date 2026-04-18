-- Migration 019: Add updated_at to profiles
-- Description: Ensures the updated_at column exists in the profiles table

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Enable automatic updated_at if a trigger exists for this
-- (Assuming handle_updated_at function exists from other tables)
-- If not, simple manual updates in code or this column default will suffice.
