-- Migration: Add onboarding_completed to profiles
-- Description: Adds a flag to track if a user has finished their role-specific setup

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing users to true (assuming they finished signup before this migration)
UPDATE public.profiles SET onboarding_completed = TRUE;
