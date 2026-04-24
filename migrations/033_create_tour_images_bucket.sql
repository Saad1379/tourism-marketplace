-- Create the `tour-images` Supabase Storage bucket and RLS policies.
--
-- Upload path convention used by app/api/tours/[id]/upload-image/route.ts:
--   {user_id}/{tour_id}/{timestamp}-{filename}
-- The route uses the anon client (so the signed-in user's JWT is the subject
-- for RLS), then hands off to the service role for the tours-table update.
-- The bucket is public so `supabase.storage.getPublicUrl(...)` works directly.

-- 1. Bucket (idempotent: upserts keep size/MIME limits in sync on re-run).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-images',
  'tour-images',
  true,
  10 * 1024 * 1024,  -- 10 MB, matches TOUR_IMAGE_POLICY.maxRawUploadBytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Policies. RLS is already enabled on storage.objects by default; we just
--    define the access rules for this bucket.

-- Public read: anyone can load a tour image (used by the marketing site).
DROP POLICY IF EXISTS "tour_images_public_read" ON storage.objects;
CREATE POLICY "tour_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tour-images');

-- Insert: signed-in user can only write under their own `{auth.uid()}/...` prefix.
DROP POLICY IF EXISTS "tour_images_owner_insert" ON storage.objects;
CREATE POLICY "tour_images_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: same prefix rule.
DROP POLICY IF EXISTS "tour_images_owner_update" ON storage.objects;
CREATE POLICY "tour_images_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: same prefix rule. Lets guides remove their own photos from the UI.
DROP POLICY IF EXISTS "tour_images_owner_delete" ON storage.objects;
CREATE POLICY "tour_images_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
