BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lodging-photos',
  'lodging-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS terangasn_lodging_photos_public_read ON storage.objects;
CREATE POLICY terangasn_lodging_photos_public_read
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'lodging-photos');

DROP POLICY IF EXISTS terangasn_lodging_photos_owner_upload ON storage.objects;
CREATE POLICY terangasn_lodging_photos_owner_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lodging-photos'
  AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
  AND EXISTS (
    SELECT 1
    FROM public.hotels h
    WHERE h.id = (storage.foldername(name))[1]::uuid
      AND h.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS terangasn_lodging_photos_owner_delete ON storage.objects;
CREATE POLICY terangasn_lodging_photos_owner_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lodging-photos'
  AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
  AND EXISTS (
    SELECT 1
    FROM public.hotels h
    WHERE h.id = (storage.foldername(name))[1]::uuid
      AND h.owner_id = (SELECT auth.uid())
  )
);

COMMIT;
