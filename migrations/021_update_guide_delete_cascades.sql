-- ============================================
-- GDPR SAFE GUIDE DELETION MIGRATION
-- Marketplace-safe configuration for Guides
-- ============================================

BEGIN;

-- =====================================================
-- 1. tours -> SET NULL (preserve tour history)
-- =====================================================

ALTER TABLE public.tours
DROP CONSTRAINT IF EXISTS tours_guide_id_fkey;

ALTER TABLE public.tours
ALTER COLUMN guide_id DROP NOT NULL;

ALTER TABLE public.tours
ADD CONSTRAINT tours_guide_id_fkey
FOREIGN KEY (guide_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;


-- =====================================================
-- 2. reviews.guide_id -> SET NULL (preserve rating)
-- =====================================================

ALTER TABLE public.reviews
DROP CONSTRAINT IF EXISTS reviews_guide_id_fkey;

ALTER TABLE public.reviews
ALTER COLUMN guide_id DROP NOT NULL;

ALTER TABLE public.reviews
ADD CONSTRAINT reviews_guide_id_fkey
FOREIGN KEY (guide_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;


-- =====================================================
-- 3. tour_boosts -> SET NULL
-- =====================================================

ALTER TABLE public.tour_boosts
DROP CONSTRAINT IF EXISTS tour_boosts_guide_id_fkey;

ALTER TABLE public.tour_boosts
ALTER COLUMN guide_id DROP NOT NULL;

ALTER TABLE public.tour_boosts
ADD CONSTRAINT tour_boosts_guide_id_fkey
FOREIGN KEY (guide_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;


-- =====================================================
-- 4. fee_items -> SET NULL (preserve financial history)
-- =====================================================

ALTER TABLE public.fee_items
DROP CONSTRAINT IF EXISTS fee_items_guide_id_fkey;

ALTER TABLE public.fee_items
ALTER COLUMN guide_id DROP NOT NULL;

ALTER TABLE public.fee_items
ADD CONSTRAINT fee_items_guide_id_fkey
FOREIGN KEY (guide_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;


-- =====================================================
-- 5. credit_transactions -> SET NULL (preserve financial history)
-- =====================================================

ALTER TABLE public.credit_transactions
DROP CONSTRAINT IF EXISTS credit_transactions_guide_id_fkey;

ALTER TABLE public.credit_transactions
ALTER COLUMN guide_id DROP NOT NULL;

ALTER TABLE public.credit_transactions
ADD CONSTRAINT credit_transactions_guide_id_fkey
FOREIGN KEY (guide_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- =====================================================
-- 6. credit_purchases -> SET NULL (preserve financial history)
-- =====================================================

ALTER TABLE public.credit_purchases
DROP CONSTRAINT IF EXISTS credit_purchases_guide_id_fkey;

ALTER TABLE public.credit_purchases
ALTER COLUMN guide_id DROP NOT NULL;

ALTER TABLE public.credit_purchases
ADD CONSTRAINT credit_purchases_guide_id_fkey
FOREIGN KEY (guide_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;


-- =====================================================
-- 7. guide_credits -> CASCADE (purely operational)
-- =====================================================

-- Leaves balance table strictly for active users
ALTER TABLE public.guide_credits
DROP CONSTRAINT IF EXISTS guide_credits_guide_id_fkey;

ALTER TABLE public.guide_credits
ADD CONSTRAINT guide_credits_guide_id_fkey
FOREIGN KEY (guide_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;


-- =====================================================
-- 8. guide_plans -> CASCADE (purely operational)
-- =====================================================

ALTER TABLE public.guide_plans
DROP CONSTRAINT IF EXISTS guide_plans_guide_id_fkey;

ALTER TABLE public.guide_plans
ADD CONSTRAINT guide_plans_guide_id_fkey
FOREIGN KEY (guide_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

COMMIT;
