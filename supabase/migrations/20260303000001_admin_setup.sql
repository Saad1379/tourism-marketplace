-- Admin Setup Migration
-- Adds is_banned column to profiles and sets up admin RLS policies

-- 1. Add is_banned column to profiles (if not exists)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- 2. Create indexes for faster admin queries
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_is_deleted_idx ON public.profiles (is_deleted);

-- 3. RLS policy: Admin can read all profiles
DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
CREATE POLICY "Admin can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  );

-- 4. RLS policy: Admin can update any profile
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  );

-- 5. RLS policy: Admin can read all tours
DROP POLICY IF EXISTS "Admin can read all tours" ON public.tours;
CREATE POLICY "Admin can read all tours"
  ON public.tours
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  );

-- 6. RLS policy: Admin can update any tour
DROP POLICY IF EXISTS "Admin can update any tour" ON public.tours;
CREATE POLICY "Admin can update any tour"
  ON public.tours
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  );

-- 7. RLS policy: Admin can delete any tour
DROP POLICY IF EXISTS "Admin can delete any tour" ON public.tours;
CREATE POLICY "Admin can delete any tour"
  ON public.tours
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  );

-- 8. RLS policy: Admin can manage promo codes
DROP POLICY IF EXISTS "Admin can manage promo codes" ON public.promo_codes;
CREATE POLICY "Admin can manage promo codes"
  ON public.promo_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  );

-- 9. RLS policy: Admin can manage credit packages
DROP POLICY IF EXISTS "Admin can manage credit packages" ON public.credit_packages;
CREATE POLICY "Admin can manage credit packages"
  ON public.credit_packages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  );

-- 10. RLS policy: Admin can read all bookings
DROP POLICY IF EXISTS "Admin can read all bookings" ON public.bookings;
CREATE POLICY "Admin can read all bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  );

-- 11. RLS policy: Admin can read all credit transactions
DROP POLICY IF EXISTS "Admin can read all credit transactions" ON public.credit_transactions;
CREATE POLICY "Admin can read all credit transactions"
  ON public.credit_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  );

-- 12. RLS policy: Admin can read guide verifications
DROP POLICY IF EXISTS "Admin can read all guide verifications" ON public.guide_verifications;
CREATE POLICY "Admin can read all guide verifications"
  ON public.guide_verifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.is_deleted = false
    )
  );

COMMENT ON COLUMN public.profiles.is_banned IS 'When true, the user is banned from the platform';
