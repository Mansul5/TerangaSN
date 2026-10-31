-- TerangaSN / étape 2B : stockage privé des justificatifs juridiques.
-- À exécuter uniquement sur la base de TEST après les migrations juridiques.
-- Structure des objets : dossier_uuid/document_uuid/nom_fichier.pdf
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hotel-legal-documents',
  'hotel-legal-documents',
  false,
  10485760,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- L'hôte peut voir uniquement les documents de ses établissements.
-- Les administrateurs autorisés peuvent les examiner.
DROP POLICY IF EXISTS "terangasn_legal_files_read" ON storage.objects;
CREATE POLICY "terangasn_legal_files_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'hotel-legal-documents'
  AND name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/]+$'
  AND (
    public.is_admin()
    OR public.is_legal_dossier_owner((storage.foldername(name))[1]::uuid)
  )
);

-- Seul l'hôte propriétaire du dossier peut ajouter un nouveau fichier,
-- et uniquement si le dossier est modifiable. Pas d'UPDATE / DELETE.
DROP POLICY IF EXISTS "terangasn_legal_files_upload" ON storage.objects;
CREATE POLICY "terangasn_legal_files_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hotel-legal-documents'
  AND name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/]+$'
  AND public.is_legal_dossier_owner((storage.foldername(name))[1]::uuid)
  AND EXISTS (
    SELECT 1 FROM public.hotel_legal_dossiers d
    WHERE d.id = (storage.foldername(name))[1]::uuid
      AND d.status IN ('draft', 'changes_requested', 'rejected')
  )
);

-- Important : aucune politique UPDATE ou DELETE sur ce bucket.
-- Ne pas ajouter de politique de lecture anonyme.
COMMIT;
