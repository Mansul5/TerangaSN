-- TerangaSN — étape 2F — exécuter sur la base Supabase TEST uniquement.
-- Étape 2E doit avoir été exécutée (document_reference et document_valid_until).
BEGIN;
ALTER TABLE public.hotel_documents
  ADD COLUMN IF NOT EXISTS document_notes text;
ALTER TABLE public.hotel_documents
  DROP CONSTRAINT IF EXISTS hotel_documents_notes_length;
ALTER TABLE public.hotel_documents
  ADD CONSTRAINT hotel_documents_notes_length CHECK (document_notes IS NULL OR char_length(document_notes) <= 1500);
COMMIT;
