-- TerangaSN 2G - Retrait securise d'une soumission encore en attente.
-- A executer uniquement dans Supabase TEST. Ne supprime aucun document.
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_hotel_legal_dossier()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_owner uuid; v_missing integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Legal dossiers cannot be deleted through this workflow';
  END IF;
  IF (SELECT public.is_admin()) THEN
    NEW.updated_at := now(); RETURN NEW;
  END IF;
  SELECT h.owner_id INTO v_owner FROM public.hotels h WHERE h.id = NEW.hotel_id;
  IF v_owner IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized for this hotel';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.reviewed_by IS NOT NULL
       OR NEW.reviewed_at IS NOT NULL OR NEW.review_note IS NOT NULL
       OR NEW.submitted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Review fields are admin-managed';
    END IF;
  ELSE
    IF NEW.hotel_id IS DISTINCT FROM OLD.hotel_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.review_note IS DISTINCT FROM OLD.review_note THEN
      RAISE EXCEPTION 'Owner cannot edit administrative dossier fields';
    END IF;
    IF OLD.status = 'submitted' AND NEW.status = 'draft' THEN
      -- Retrait possible uniquement avant debut de l'examen.
      -- Aucun changement de profil, ni d'autre champ dans cette operation.
      IF NEW.relationship_type IS DISTINCT FROM OLD.relationship_type
         OR NEW.relationship_details IS DISTINCT FROM OLD.relationship_details
         OR OLD.reviewed_at IS NOT NULL OR OLD.reviewed_by IS NOT NULL
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'Cannot withdraw a dossier that is under review or modify its details';
      END IF;
      NEW.submitted_at := NULL;
    ELSE
      IF OLD.status NOT IN ('draft','changes_requested','rejected') THEN
        RAISE EXCEPTION 'Dossier is locked for owner edits';
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status <> 'submitted' THEN
          RAISE EXCEPTION 'Only dossier submission is allowed for owner';
        END IF;
        IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
          RAISE EXCEPTION 'submitted_at is set by the database';
        END IF;
        SELECT count(*) INTO v_missing
        FROM public.legal_document_requirements r
        WHERE r.relationship_type = NEW.relationship_type
          AND r.is_active AND r.is_required
          AND NOT EXISTS (
            SELECT 1 FROM public.hotel_documents doc
            WHERE doc.dossier_id = NEW.id AND doc.document_type = r.document_type
              AND doc.status <> 'rejected'
          );
        IF v_missing > 0 THEN
          RAISE EXCEPTION 'Missing % required legal document type(s)', v_missing;
        END IF;
        NEW.submitted_at := now();
      ELSIF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'Owner cannot change submitted_at';
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now(); RETURN NEW;
END;
$$;
COMMIT;
