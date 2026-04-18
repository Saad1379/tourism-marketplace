-- Migration 013: Fix guide deletion cascade
-- Description: Updates foreign key constraints to allow guide deletion

ALTER TABLE tours DROP CONSTRAINT tours_guide_id_fkey;
ALTER TABLE tours ADD CONSTRAINT tours_guide_id_fkey 
FOREIGN KEY (guide_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE credit_transactions DROP CONSTRAINT credit_transactions_guide_id_fkey;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_guide_id_fkey 
FOREIGN KEY (guide_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE tour_boosts DROP CONSTRAINT tour_boosts_guide_id_fkey;
ALTER TABLE tour_boosts ADD CONSTRAINT tour_boosts_guide_id_fkey 
FOREIGN KEY (guide_id) REFERENCES profiles(id) ON DELETE CASCADE;
