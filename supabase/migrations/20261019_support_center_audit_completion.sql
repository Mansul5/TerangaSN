BEGIN;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS decision_reason text;
ALTER TABLE public.support_ticket_messages
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT true;
ALTER TABLE public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS actor_name text;
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS decision_reason text;
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.hotels
  DROP CONSTRAINT IF EXISTS hotels_status_check;
ALTER TABLE public.hotels
  ADD CONSTRAINT hotels_status_check
  CHECK (status IN ('draft','pending','approved','published','unpublished','rejected'));
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS moderation_reason text;
ALTER TABLE public.admin_staff_members
  ADD COLUMN IF NOT EXISTS decision_reason text;

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open','in_progress','waiting_user','follow_up','resolved','closed'));

CREATE TABLE IF NOT EXISTS public.support_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (char_length(btrim(file_name)) BETWEEN 1 AND 255),
  content_type text NOT NULL CHECK (content_type IN (
    'application/pdf','image/jpeg','image/png','image/webp'
  )),
  file_size integer NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (storage_path LIKE ticket_id::text || '/%')
);
CREATE INDEX IF NOT EXISTS support_ticket_attachments_ticket_idx
  ON public.support_ticket_attachments(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.support_ticket_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  rated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(btrim(comment)) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_ticket_ratings_recent_idx
  ON public.support_ticket_ratings(created_at DESC);

CREATE OR REPLACE FUNCTION public.can_access_support_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE t.id = p_ticket_id
      AND (
        t.created_by = (SELECT auth.uid())
        OR (SELECT public.has_admin_permission('support'))
        OR (t.category = 'dispute' AND (SELECT public.has_admin_permission('disputes')))
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_access_support_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_support_ticket(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_support_requester_details(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (SELECT public.can_access_support_ticket(p_ticket_id)) THEN
    RAISE EXCEPTION 'Accès au dossier refusé' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'full_name', p.full_name,
    'email', p.email,
    'phone', p.phone,
    'role', p.role
  )
  INTO v_result
  FROM public.support_tickets t
  JOIN public.profiles p ON p.id = t.created_by
  WHERE t.id = p_ticket_id;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_support_requester_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_requester_details(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_support_ticket(
  p_ticket_id uuid,
  p_status text,
  p_priority text,
  p_assigned_to uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  SELECT category INTO v_category
    FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossier introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    (SELECT public.has_admin_permission('support'))
    OR (v_category = 'dispute' AND (SELECT public.has_admin_permission('disputes')))
  ) THEN
    RAISE EXCEPTION 'Accès réservé à un agent habilité' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN (
    'open','in_progress','waiting_user','follow_up','resolved','closed'
  ) OR p_priority IS NULL OR p_priority NOT IN ('low','normal','high','urgent')
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION 'Statut, priorité ou justification invalide' USING ERRCODE = '22023';
  END IF;
  IF p_assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.admin_staff_members
    WHERE user_id = p_assigned_to AND account_status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.admin_staff_assignments
    WHERE user_id = p_assigned_to AND is_active
  ) THEN
    RAISE EXCEPTION 'Le responsable doit être un collaborateur actif' USING ERRCODE = '22023';
  END IF;

  UPDATE public.support_tickets
  SET status = p_status,
      priority = p_priority,
      assigned_to = p_assigned_to,
      decision_reason = btrim(p_reason)
  WHERE id = p_ticket_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_support_ticket(uuid,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_support_ticket(uuid,text,text,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_row jsonb;
  v_new_row jsonb;
  v_old jsonb;
  v_new jsonb;
  v_entity_id text;
  v_case_id uuid;
  v_reason text;
  v_actor_name text;
  v_sensitive_columns text[] := ARRAY[
    'email','phone','guest_name','guest_email','guest_phone','full_name',
    'description','body','comment','avatar_url','storage_path','file_name',
    'file_path','document_path','document_reference','document_number',
    'document_notes','review_note','relationship_details','special_requests',
    'tax_id','national_id','token','password','password_hash'
  ];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_row := to_jsonb(OLD);
    v_old := v_old_row - v_sensitive_columns;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new_row := to_jsonb(NEW);
    v_new := v_new_row - v_sensitive_columns;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_entity_id := coalesce(
      v_old_row->>'id', v_old_row->>'user_id', v_old_row->>'code',
      v_old_row->>'hotel_id', v_old_row->>'booking_id',
      v_old_row->>'room_type_id', v_old_row->>'room_unit_id',
      v_old_row->>'dossier_id', v_old_row->>'document_id',
      v_old_row->>'document_type', v_old_row->>'date'
    );
    v_reason := coalesce(
      nullif(btrim(v_old_row->>'decision_reason'), ''),
      nullif(btrim(v_old_row->>'decision_note'), ''),
      nullif(btrim(v_old_row->>'moderation_reason'), ''),
      nullif(btrim(v_old_row->>'review_note'), ''),
      nullif(btrim(v_old_row->>'rejection_reason'), ''),
      nullif(btrim(v_old_row->>'reason'), ''),
      nullif(btrim(v_old_row->>'note'), '')
    );
  ELSE
    v_entity_id := coalesce(
      v_new_row->>'id', v_new_row->>'user_id', v_new_row->>'code',
      v_new_row->>'hotel_id', v_new_row->>'booking_id',
      v_new_row->>'room_type_id', v_new_row->>'room_unit_id',
      v_new_row->>'dossier_id', v_new_row->>'document_id',
      v_new_row->>'document_type', v_new_row->>'date'
    );
    v_reason := coalesce(
      nullif(btrim(v_new_row->>'decision_reason'), ''),
      nullif(btrim(v_new_row->>'decision_note'), ''),
      nullif(btrim(v_new_row->>'moderation_reason'), ''),
      nullif(btrim(v_new_row->>'review_note'), ''),
      nullif(btrim(v_new_row->>'rejection_reason'), ''),
      nullif(btrim(v_new_row->>'reason'), ''),
      nullif(btrim(v_new_row->>'note'), '')
    );
  END IF;

  IF TG_TABLE_NAME = 'support_tickets' THEN
    v_case_id := (coalesce(v_new_row, v_old_row)->>'id')::uuid;
    v_reason := coalesce(v_reason, nullif(btrim(coalesce(v_new_row, v_old_row)->>'decision_reason'), ''));
  ELSIF TG_TABLE_NAME IN ('support_ticket_messages','support_ticket_attachments','support_ticket_ratings') THEN
    v_case_id := (coalesce(v_new_row, v_old_row)->>'ticket_id')::uuid;
  ELSIF TG_TABLE_NAME = 'admin_sanctions' THEN
    v_case_id := (coalesce(v_new_row, v_old_row)->>'support_ticket_id')::uuid;
    v_reason := coalesce(v_reason, nullif(btrim(coalesce(v_new_row, v_old_row)->>'reason'), ''));
  ELSIF TG_TABLE_NAME = 'admin_staff_members' THEN
    v_reason := coalesce(v_reason, 'Mise à jour des accès de l’équipe');
  END IF;

  SELECT nullif(btrim(full_name), '')
    INTO v_actor_name
    FROM public.profiles
    WHERE id = (SELECT auth.uid());

  INSERT INTO public.admin_audit_logs (
    actor_id, actor_name, action, entity_type, entity_id, support_ticket_id,
    old_data, new_data, reason
  ) VALUES (
    (SELECT auth.uid()),
    v_actor_name,
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    coalesce(v_entity_id, 'unknown'),
    v_case_id,
    v_old,
    v_new,
    v_reason
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_audit_row_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_logs_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Le journal d’audit est append-only';
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_audit_logs_block_mutation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS admin_audit_logs_append_only ON public.admin_audit_logs;
CREATE TRIGGER admin_audit_logs_append_only
BEFORE UPDATE OR DELETE ON public.admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_logs_block_mutation();

CREATE OR REPLACE FUNCTION public.admin_require_decision_reason()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'hotels'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('approved','rejected') THEN
    IF NOT (SELECT public.has_admin_permission('verification')) THEN
      RAISE EXCEPTION 'Accès réservé à un responsable habilité' USING ERRCODE = '42501';
    END IF;
    IF NEW.decision_reason IS NULL
       OR char_length(btrim(NEW.decision_reason)) NOT BETWEEN 5 AND 2000 THEN
      RAISE EXCEPTION 'Une justification de décision (5 caractères minimum) est obligatoire'
        USING ERRCODE = '22023';
    END IF;
  ELSIF TG_TABLE_NAME = 'reviews'
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (SELECT public.has_admin_permission('moderation')) THEN
      RAISE EXCEPTION 'Accès réservé à un modérateur habilité' USING ERRCODE = '42501';
    END IF;
    IF NEW.moderation_reason IS NULL
       OR char_length(btrim(NEW.moderation_reason)) NOT BETWEEN 5 AND 2000 THEN
      RAISE EXCEPTION 'Une justification de modération (5 caractères minimum) est obligatoire'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_require_decision_reason() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hotels_decision_reason_required ON public.hotels;
CREATE TRIGGER hotels_decision_reason_required
BEFORE UPDATE OF status ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.admin_require_decision_reason();
DROP TRIGGER IF EXISTS reviews_moderation_reason_required ON public.reviews;
CREATE TRIGGER reviews_moderation_reason_required
BEFORE UPDATE OF status ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.admin_require_decision_reason();

CREATE OR REPLACE FUNCTION public.guard_hotel_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_is_admin boolean := coalesce((SELECT public.is_admin()), false);
  v_can_verify boolean := coalesce((SELECT public.has_admin_permission('verification')), false);
  v_owner_publish boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_is_admin THEN
      NEW.status := 'pending';
      NEW.featured := false;
      NEW.commission_rate := 0.12;
      NEW.rating := 0;
      NEW.reviews_count := 0;
      NEW.min_price := 0;
    END IF;
    RETURN NEW;
  END IF;

  v_owner_publish := OLD.owner_id = (SELECT auth.uid())
    AND OLD.status = 'approved'
    AND NEW.status IN ('published','unpublished');

  IF NOT v_is_admin THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.featured IS DISTINCT FROM OLD.featured
       OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
       OR NEW.rating IS DISTINCT FROM OLD.rating
       OR NEW.reviews_count IS DISTINCT FROM OLD.reviews_count
       OR NEW.min_price IS DISTINCT FROM OLD.min_price THEN
      RAISE EXCEPTION 'Only administration or internal processes may modify protected lodging fields';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         v_can_verify AND NEW.status IN ('approved','rejected')
         OR v_owner_publish
       ) THEN
      RAISE EXCEPTION 'Only an authorized reviewer may decide this lodging status';
    END IF;
    IF (NEW.decision_reason IS DISTINCT FROM OLD.decision_reason
        OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason)
       AND NOT v_can_verify THEN
      RAISE EXCEPTION 'Only an authorized reviewer may change decision reasons';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_hotel(
  p_hotel_id uuid,
  p_status text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT (SELECT public.has_admin_permission('verification')) THEN
    RAISE EXCEPTION 'Accès réservé à un responsable habilité' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved','rejected')
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION 'Décision ou justification invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE public.hotels
  SET status = p_status,
      decision_reason = btrim(p_reason),
      rejection_reason = CASE WHEN p_status = 'rejected' THEN btrim(p_reason) ELSE NULL END
  WHERE id = p_hotel_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossier introuvable ou déjà traité' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_hotel(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_hotel(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_review_moderation(
  p_review_id uuid,
  p_status text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT (SELECT public.has_admin_permission('moderation')) THEN
    RAISE EXCEPTION 'Accès réservé à un modérateur habilité' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved','rejected','pending')
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION 'Statut ou justification invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE public.reviews
  SET status = p_status, moderation_reason = btrim(p_reason)
  WHERE id = p_review_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avis introuvable' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_review_moderation(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_review_moderation(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_support_agent_performance()
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  assigned_tickets bigint,
  resolved_tickets bigint,
  rated_tickets bigint,
  average_rating numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT public.has_admin_permission('support')) THEN
    RAISE EXCEPTION 'Accès réservé à un responsable habilité' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    t.assigned_to,
    coalesce(m.full_name, p.full_name, t.assigned_to::text),
    count(*),
    count(*) FILTER (WHERE t.status IN ('resolved','closed')),
    count(r.ticket_id),
    round(avg(r.rating)::numeric, 1)
  FROM public.support_tickets t
  LEFT JOIN public.support_ticket_ratings r ON r.ticket_id = t.id
  LEFT JOIN public.admin_staff_members m ON m.user_id = t.assigned_to
  LEFT JOIN public.profiles p ON p.id = t.assigned_to
  WHERE t.assigned_to IS NOT NULL
  GROUP BY t.assigned_to, m.full_name, p.full_name
  ORDER BY coalesce(m.full_name, p.full_name, t.assigned_to::text);
END;
$$;
REVOKE ALL ON FUNCTION public.get_support_agent_performance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_agent_performance() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_validate_internal_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.author_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Message author must match the authenticated user';
  END IF;
  IF NOT (SELECT public.can_access_support_ticket(NEW.ticket_id)) THEN
    RAISE EXCEPTION 'Accès au dossier refusé' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    (SELECT public.has_admin_permission('support'))
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = NEW.ticket_id AND t.category = 'dispute'
        AND (SELECT public.has_admin_permission('disputes'))
    )
  ) THEN
    NEW.is_internal := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_reopen_on_requester_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_internal = false AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = NEW.ticket_id AND t.created_by = NEW.author_id
      AND t.status IN ('waiting_user','follow_up','resolved')
  ) THEN
    UPDATE public.support_tickets
    SET status = 'in_progress',
        decision_reason = 'Réponse reçue du demandeur'
    WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.support_reopen_on_requester_reply() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_prepare_support_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'support_tickets' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.created_by := (SELECT auth.uid());
      IF NEW.category = 'dispute' AND NOT (
        (SELECT public.has_admin_permission('support'))
        OR (SELECT public.has_admin_permission('disputes'))
      ) AND NOT EXISTS (
        SELECT 1 FROM public.bookings b
        LEFT JOIN public.hotels h ON h.id = b.hotel_id
        WHERE b.id = NEW.booking_id
          AND (b.user_id = (SELECT auth.uid()) OR h.owner_id = (SELECT auth.uid()))
      ) THEN
        RAISE EXCEPTION 'Le litige doit concerner une réservation de votre compte'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NEW.assigned_to IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
       AND NOT (
         EXISTS (SELECT 1 FROM public.admin_staff_assignments
                 WHERE user_id = NEW.assigned_to AND is_active)
         OR EXISTS (SELECT 1 FROM public.admin_staff_members
                    WHERE user_id = NEW.assigned_to AND account_status = 'active')
       ) THEN
      RAISE EXCEPTION 'Ticket assignee must have an active staff assignment';
    END IF;
    NEW.updated_at := now();
    IF NEW.status IN ('resolved','closed') AND
       (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR NEW.resolved_at IS NULL) THEN
      NEW.resolved_at := now();
    ELSIF NEW.status NOT IN ('resolved','closed') THEN
      NEW.resolved_at := NULL;
    END IF;
  ELSIF TG_TABLE_NAME = 'support_ticket_attachments' THEN
    NEW.created_at := now();
    NEW.uploaded_by := (SELECT auth.uid());
    IF NOT (SELECT public.can_access_support_ticket(NEW.ticket_id)) THEN
      RAISE EXCEPTION 'Accès au dossier refusé' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'support_ticket_ratings' THEN
    NEW.created_at := now();
    NEW.rated_by := (SELECT auth.uid());
    IF NOT EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = NEW.ticket_id AND created_by = (SELECT auth.uid())
        AND status IN ('resolved','closed')
    ) THEN
      RAISE EXCEPTION 'Seul le demandeur peut évaluer un dossier résolu'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_prepare_support_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS support_tickets_prepare ON public.support_tickets;
CREATE TRIGGER support_tickets_prepare
BEFORE INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.admin_prepare_support_write();
DROP TRIGGER IF EXISTS support_ticket_messages_validate ON public.support_ticket_messages;
CREATE TRIGGER support_ticket_messages_validate
BEFORE INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.admin_validate_internal_message();
DROP TRIGGER IF EXISTS support_ticket_messages_reopen ON public.support_ticket_messages;
CREATE TRIGGER support_ticket_messages_reopen
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.support_reopen_on_requester_reply();

DROP TRIGGER IF EXISTS support_tickets_audit ON public.support_tickets;
CREATE TRIGGER support_tickets_audit
AFTER INSERT OR UPDATE OR DELETE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_row_change();
DROP TRIGGER IF EXISTS support_ticket_messages_audit ON public.support_ticket_messages;
CREATE TRIGGER support_ticket_messages_audit
AFTER INSERT OR UPDATE OR DELETE ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_row_change();

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'profiles','hotels','bookings','reviews','owner_subscriptions','saas_plans',
    'admin_staff_assignments','admin_sanctions',
    'support_ticket_attachments','support_ticket_ratings','room_types',
    'room_availability','room_units','booking_room_assignments',
    'room_unit_availability','hotel_legal_dossiers','hotel_legal_documents',
    'hotel_documents','hotel_document_reviews','hotel_legal_dossier_reviews','legal_document_requirements',
    'hotel_legal_document_notes','hotel_legal_dossier_history'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_table || '_audit', v_table);
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.admin_audit_row_change()',
        v_table || '_audit', v_table
      );
    END IF;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS admin_staff_members_audit ON public.admin_staff_members;
CREATE TRIGGER admin_staff_members_audit
AFTER INSERT OR DELETE OR UPDATE OF
  full_name, email, user_id, account_status, permissions, invited_by,
  invited_at, invitation_expires_at, decision_reason
ON public.admin_staff_members
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_row_change();

CREATE OR REPLACE FUNCTION public.create_admin_staff_invite(
  p_full_name text,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_email text := lower(btrim(p_email));
BEGIN
  IF NOT coalesce((SELECT public.is_admin()), false) THEN
    RAISE EXCEPTION 'Accès réservé à la direction' USING ERRCODE = '42501';
  END IF;
  IF p_full_name IS NULL OR p_email IS NULL
     OR char_length(btrim(p_full_name)) NOT BETWEEN 2 AND 160
     OR v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Nom ou adresse email invalide' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.admin_staff_members (full_name, email, invited_by)
  VALUES (btrim(p_full_name), v_email, (SELECT auth.uid()))
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    invited_by = EXCLUDED.invited_by,
    invited_at = now(),
    invitation_expires_at = now() + interval '7 days',
    updated_at = now()
  WHERE public.admin_staff_members.account_status = 'invited'
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Une invitation ou un compte existe déjà pour cette adresse email'
      USING ERRCODE = '23505';
  END IF;
  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.update_admin_staff_member(uuid, text, text[]);
CREATE OR REPLACE FUNCTION public.update_admin_staff_member(
  p_member_id uuid,
  p_account_status text,
  p_permissions text[],
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_permissions text[] := coalesce(p_permissions, '{}'::text[]);
BEGIN
  IF NOT coalesce((SELECT public.is_admin()), false) THEN
    RAISE EXCEPTION 'Accès réservé à la direction' USING ERRCODE = '42501';
  END IF;
  IF p_account_status IS NULL OR p_permissions IS NULL
     OR p_account_status NOT IN ('invited', 'active', 'suspended', 'deactivated')
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 2000
     OR NOT (v_permissions <@ ARRAY[
       'support', 'finance', 'verification', 'moderation', 'users',
       'bookings', 'disputes', 'supervision', 'settings'
     ]::text[]) THEN
    RAISE EXCEPTION 'Statut ou permission invalide' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.admin_staff_members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collaborateur introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_account_status = 'active' AND NOT EXISTS (
    SELECT 1 FROM public.admin_staff_members
    WHERE id = p_member_id AND user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Le collaborateur doit accepter son invitation avant activation'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.admin_staff_members
  SET account_status = p_account_status,
      permissions = v_permissions,
      decision_reason = btrim(p_reason),
      updated_at = now()
  WHERE id = p_member_id;
END;
$$;
REVOKE ALL ON FUNCTION public.update_admin_staff_member(uuid,text,text[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_staff_member(uuid,text,text[],text) TO authenticated;

ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_staff_guard ON public.support_tickets;
CREATE POLICY support_tickets_staff_guard ON public.support_tickets AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    (SELECT public.has_admin_permission('support'))
    OR (category = 'dispute' AND (SELECT public.has_admin_permission('disputes')))
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT public.has_admin_permission('support'))
    OR (category = 'dispute' AND (SELECT public.has_admin_permission('disputes')))
    OR created_by = (SELECT auth.uid())
  );
DROP POLICY IF EXISTS support_tickets_requester_read ON public.support_tickets;
CREATE POLICY support_tickets_requester_read ON public.support_tickets
  FOR SELECT TO authenticated USING (created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS support_tickets_requester_insert ON public.support_tickets;
CREATE POLICY support_tickets_requester_insert ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS support_ticket_messages_staff_guard ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_staff_guard ON public.support_ticket_messages AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    (SELECT public.has_admin_permission('support'))
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.category = 'dispute'
        AND (SELECT public.has_admin_permission('disputes'))
    )
    OR (
      is_internal = false
      AND EXISTS (SELECT 1 FROM public.support_tickets t
                  WHERE t.id = ticket_id AND t.created_by = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    (SELECT public.has_admin_permission('support'))
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.category = 'dispute'
        AND (SELECT public.has_admin_permission('disputes'))
    )
    OR (
      is_internal = false
      AND EXISTS (SELECT 1 FROM public.support_tickets t
                  WHERE t.id = ticket_id AND t.created_by = (SELECT auth.uid()))
    )
  );
DROP POLICY IF EXISTS support_ticket_messages_requester_read ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_requester_read ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    is_internal = false AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.created_by = (SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS support_ticket_messages_requester_insert ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_requester_insert ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid()) AND is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS support_ticket_attachments_access ON public.support_ticket_attachments;
CREATE POLICY support_ticket_attachments_access ON public.support_ticket_attachments
  FOR SELECT TO authenticated
  USING ((SELECT public.can_access_support_ticket(ticket_id)));
DROP POLICY IF EXISTS support_ticket_attachments_insert ON public.support_ticket_attachments;
CREATE POLICY support_ticket_attachments_insert ON public.support_ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND (SELECT public.can_access_support_ticket(ticket_id))
  );

DROP POLICY IF EXISTS support_ticket_ratings_requester_read ON public.support_ticket_ratings;
CREATE POLICY support_ticket_ratings_requester_read ON public.support_ticket_ratings
  FOR SELECT TO authenticated
  USING (
    rated_by = (SELECT auth.uid())
    OR (SELECT public.has_admin_permission('support'))
  );
DROP POLICY IF EXISTS support_ticket_ratings_requester_insert ON public.support_ticket_ratings;
CREATE POLICY support_ticket_ratings_requester_insert ON public.support_ticket_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    rated_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.created_by = (SELECT auth.uid())
        AND t.status IN ('resolved','closed')
    )
  );
DROP POLICY IF EXISTS support_ticket_ratings_staff_read ON public.support_ticket_ratings;
CREATE POLICY support_ticket_ratings_staff_read ON public.support_ticket_ratings
  FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_permission('support')));

REVOKE UPDATE, DELETE ON public.support_tickets,
  public.support_ticket_messages, public.support_ticket_attachments,
  public.support_ticket_ratings FROM authenticated;
REVOKE INSERT ON public.support_tickets FROM authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT INSERT (subject, description, category, booking_id)
  ON public.support_tickets TO authenticated;
GRANT SELECT ON public.support_ticket_messages TO authenticated;
REVOKE INSERT ON public.support_ticket_messages FROM authenticated;
GRANT INSERT (ticket_id, author_id, body, is_internal)
  ON public.support_ticket_messages TO authenticated;
GRANT SELECT ON public.support_ticket_attachments,
  public.support_ticket_ratings TO authenticated;
REVOKE INSERT ON public.support_ticket_attachments,
  public.support_ticket_ratings FROM authenticated;
GRANT INSERT (ticket_id, uploaded_by, storage_path, file_name, content_type, file_size)
  ON public.support_ticket_attachments TO authenticated;
GRANT INSERT (ticket_id, rated_by, rating, comment)
  ON public.support_ticket_ratings TO authenticated;
REVOKE ALL ON public.admin_audit_logs FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_logs FROM authenticated;
DROP POLICY IF EXISTS admin_audit_logs_staff_select_guard ON public.admin_audit_logs;
DROP POLICY IF EXISTS audit_logs_staff_read ON public.admin_audit_logs;
DROP POLICY IF EXISTS admin_audit_logs_admin_select_guard ON public.admin_audit_logs;
DROP POLICY IF EXISTS admin_audit_logs_admin_select ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_direction_only ON public.admin_audit_logs
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
GRANT SELECT ON public.admin_audit_logs TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments','support-attachments',false,10485760,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','image/webp']::text[];

DROP POLICY IF EXISTS support_attachments_read ON storage.objects;
CREATE POLICY support_attachments_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (SELECT public.can_access_support_ticket(((storage.foldername(name))[1])::uuid))
      ELSE false
    END
  );
DROP POLICY IF EXISTS support_attachments_upload ON storage.objects;
CREATE POLICY support_attachments_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (SELECT public.can_access_support_ticket(((storage.foldername(name))[1])::uuid))
      ELSE false
    END
  );

COMMIT;
