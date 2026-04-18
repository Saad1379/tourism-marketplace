-- Migration 012: Fix guide_credits cascade deletion
-- Description: Updates foreign key constraint to allow automatic deletion when guide is deleted

-- Drop the old constraint
ALTER TABLE guide_credits 
DROP CONSTRAINT IF EXISTS guide_credits_guide_id_fkey;

-- Add new constraint with CASCADE
ALTER TABLE guide_credits 
ADD CONSTRAINT guide_credits_guide_id_fkey 
FOREIGN KEY (guide_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT guide_credits_guide_id_fkey ON guide_credits IS 'Cascade delete guide credits when guide profile is deleted';
