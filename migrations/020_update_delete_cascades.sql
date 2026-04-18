-- ============================================
-- GDPR SAFE FOREIGN KEY UPDATE MIGRATION
-- Marketplace-safe configuration
-- ============================================

BEGIN;

-- =====================================================
-- 1. admin_audit_log -> SET NULL (preserve audit trail)
-- =====================================================

ALTER TABLE public.admin_audit_log
DROP CONSTRAINT IF EXISTS admin_audit_log_admin_id_fkey;

ALTER TABLE public.admin_audit_log
ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE public.admin_audit_log
ADD CONSTRAINT admin_audit_log_admin_id_fkey
FOREIGN KEY (admin_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;


-- =====================================================
-- 2. bookings -> SET NULL (preserve booking history)
-- =====================================================

ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_tourist_id_fkey;

ALTER TABLE public.bookings
ALTER COLUMN tourist_id DROP NOT NULL;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_tourist_id_fkey
FOREIGN KEY (tourist_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;


-- =====================================================
-- 3. guide_verifications.reviewed_by -> SET NULL
-- =====================================================

ALTER TABLE public.guide_verifications
DROP CONSTRAINT IF EXISTS guide_verifications_reviewed_by_fkey;

ALTER TABLE public.guide_verifications
ADD CONSTRAINT guide_verifications_reviewed_by_fkey
FOREIGN KEY (reviewed_by)
REFERENCES public.profiles(id)
ON DELETE SET NULL;


-- =====================================================
-- 4. messages -> SET NULL (preserve conversation history)
-- =====================================================

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.messages
ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey
FOREIGN KEY (sender_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;


-- =====================================================
-- 5. notifications -> CASCADE (purely personal data)
-- =====================================================

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;


-- =====================================================
-- 6. reviews -> SET NULL (keep rating, anonymize author)
-- =====================================================

ALTER TABLE public.reviews
DROP CONSTRAINT IF EXISTS reviews_tourist_id_fkey;

ALTER TABLE public.reviews
ALTER COLUMN tourist_id DROP NOT NULL;

ALTER TABLE public.reviews
ADD CONSTRAINT reviews_tourist_id_fkey
FOREIGN KEY (tourist_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;


-- =====================================================
-- 7. wishlists -> CASCADE (purely personal)
-- =====================================================

ALTER TABLE public.wishlists
DROP CONSTRAINT IF EXISTS wishlists_tourist_id_fkey;

ALTER TABLE public.wishlists
ADD CONSTRAINT wishlists_tourist_id_fkey
FOREIGN KEY (tourist_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;


-- =====================================================
-- 8. Add soft delete fields to profiles (GDPR safe)
-- =====================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;


COMMIT;
