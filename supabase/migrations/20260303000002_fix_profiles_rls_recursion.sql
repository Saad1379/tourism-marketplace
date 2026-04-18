-- Fix infinite recursion in profiles RLS policies
-- The admin policies on profiles queried profiles itself, causing recursion.
-- Solution: use a SECURITY DEFINER function that bypasses RLS.

-- 1. Create a helper function that checks admin role without triggering RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_deleted = false
  )
$$;

-- 2. Fix the profiles SELECT policy to use the security-definer function
DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
CREATE POLICY "Admin can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 3. Fix the profiles UPDATE policy
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin());
