-- Admin support cases, dispute-linked sanctions, and append-only action history.
-- Apply after src/lib/supabase/schema.sql and earlier migrations.
BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_staff_assignments (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE RESTRICT,
  staff_role text NOT NULL CHECK (staff_role IN (
    'support_agent','support_lead','dispute_agent','verifier','moderator','finance','analyst'
  )),
  is_active boolean NOT NULL DEFAULT true,
  assigned_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 5 AND 180),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 10 AND 5000),
  category text NOT NULL CHECK (category IN ('question','booking','account','technical','dispute','other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_user','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (category <> 'dispute' OR booking_id IS NOT NULL),
  CHECK (status NOT IN ('resolved','closed') OR resolved_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS support_tickets_queue_idx ON public.support_tickets(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_booking_idx ON public.support_tickets(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_tickets_assignee_idx ON public.support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_ticket_messages_thread_idx ON public.support_ticket_messages(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.admin_sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sanction_type text NOT NULL CHECK (sanction_type IN (
    'warning','financial_penalty','temporary_restriction','suspension','deactivation'
  )),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 2000),
  amount_xof integer,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK (sanction_type <> 'temporary_restriction' OR ends_at IS NOT NULL),
  CHECK ((sanction_type = 'financial_penalty' AND amount_xof IS NOT NULL AND amount_xof > 0)
      OR (sanction_type <> 'financial_penalty' AND amount_xof IS NULL))
);
CREATE INDEX IF NOT EXISTS admin_sanctions_case_idx ON public.admin_sanctions(support_ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_sanctions_target_idx ON public.admin_sanctions(target_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  support_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_recent_idx ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_case_idx ON public.admin_audit_logs(support_ticket_id, created_at DESC)
  WHERE support_ticket_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_old_row jsonb;
  v_new_row jsonb;
  v_entity_id text;
  v_case_id uuid;
  v_action text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_row := to_jsonb(OLD);
    IF TG_TABLE_NAME = 'support_tickets' THEN
      v_old := jsonb_build_object(
        'category', v_old_row->'category', 'status', v_old_row->'status',
        'priority', v_old_row->'priority', 'assigned_to', v_old_row->'assigned_to',
        'booking_id', v_old_row->'booking_id'
      );
    ELSIF TG_TABLE_NAME = 'admin_staff_assignments' THEN
      v_old := jsonb_build_object('staff_role', v_old_row->'staff_role', 'is_active', v_old_row->'is_active');
    ELSIF TG_TABLE_NAME = 'admin_sanctions' THEN
      v_old := jsonb_build_object('sanction_type', v_old_row->'sanction_type', 'target_user_id', v_old_row->'target_user_id');
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new_row := to_jsonb(NEW);
    IF TG_TABLE_NAME = 'support_tickets' THEN
      v_new := jsonb_build_object(
        'category', v_new_row->'category', 'status', v_new_row->'status',
        'priority', v_new_row->'priority', 'assigned_to', v_new_row->'assigned_to',
        'booking_id', v_new_row->'booking_id'
      );
      v_entity_id := v_new_row->>'id';
      v_case_id := (v_new_row->>'id')::uuid;
    ELSIF TG_TABLE_NAME = 'support_ticket_messages' THEN
      v_entity_id := v_new_row->>'id';
      v_case_id := (v_new_row->>'ticket_id')::uuid;
    ELSIF TG_TABLE_NAME = 'admin_staff_assignments' THEN
      v_new := jsonb_build_object('staff_role', v_new_row->'staff_role', 'is_active', v_new_row->'is_active');
      v_entity_id := v_new_row->>'user_id';
    ELSIF TG_TABLE_NAME = 'admin_sanctions' THEN
      v_new := jsonb_build_object(
        'sanction_type', v_new_row->'sanction_type', 'target_user_id', v_new_row->'target_user_id',
        'starts_at', v_new_row->'starts_at', 'ends_at', v_new_row->'ends_at'
      );
      v_entity_id := v_new_row->>'id';
      v_case_id := (v_new_row->>'support_ticket_id')::uuid;
    END IF;
  ELSE
    v_entity_id := v_old_row->>'id';
    v_case_id := (v_old_row->>'ticket_id')::uuid;
  END IF;

  v_action := lower(TG_TABLE_NAME) || '.' || lower(TG_OP);
  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, support_ticket_id, old_data, new_data
  ) VALUES (
    (SELECT auth.uid()), v_action, TG_TABLE_NAME, v_entity_id, v_case_id, v_old, v_new
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_audit_row_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_validate_sanction_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = NEW.support_ticket_id AND category = 'dispute' AND booking_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Sanctions must be linked to a dispute case with a booking';
  END IF;
  IF NEW.created_by IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Sanction author must match the authenticated administrator';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_validate_sanction_case() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_prepare_support_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'admin_staff_assignments' THEN
    NEW.assigned_by := (SELECT auth.uid());
    NEW.assigned_at := now();
    NEW.updated_at := now();
  ELSIF TG_TABLE_NAME = 'support_tickets' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.created_by := (SELECT auth.uid());
    END IF;
    IF NEW.assigned_to IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
       AND NOT EXISTS (
         SELECT 1 FROM public.admin_staff_assignments
         WHERE user_id = NEW.assigned_to AND is_active
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
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_prepare_support_write() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_validate_internal_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.author_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Message author must match the authenticated administrator';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_validate_internal_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS admin_staff_assignments_prepare ON public.admin_staff_assignments;
CREATE TRIGGER admin_staff_assignments_prepare
BEFORE INSERT OR UPDATE ON public.admin_staff_assignments
FOR EACH ROW EXECUTE FUNCTION public.admin_prepare_support_write();
DROP TRIGGER IF EXISTS support_tickets_prepare ON public.support_tickets;
CREATE TRIGGER support_tickets_prepare
BEFORE INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.admin_prepare_support_write();
DROP TRIGGER IF EXISTS support_ticket_messages_validate ON public.support_ticket_messages;
CREATE TRIGGER support_ticket_messages_validate
BEFORE INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.admin_validate_internal_message();

DROP TRIGGER IF EXISTS support_tickets_audit ON public.support_tickets;
CREATE TRIGGER support_tickets_audit
AFTER INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_row_change();
DROP TRIGGER IF EXISTS support_ticket_messages_audit ON public.support_ticket_messages;
CREATE TRIGGER support_ticket_messages_audit
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_row_change();
DROP TRIGGER IF EXISTS admin_staff_assignments_audit ON public.admin_staff_assignments;
CREATE TRIGGER admin_staff_assignments_audit
AFTER INSERT OR UPDATE ON public.admin_staff_assignments
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_row_change();
DROP TRIGGER IF EXISTS admin_sanctions_audit ON public.admin_sanctions;
CREATE TRIGGER admin_sanctions_audit
AFTER INSERT ON public.admin_sanctions
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_row_change();
DROP TRIGGER IF EXISTS admin_sanctions_validate_case ON public.admin_sanctions;
CREATE TRIGGER admin_sanctions_validate_case
BEFORE INSERT ON public.admin_sanctions
FOR EACH ROW EXECUTE FUNCTION public.admin_validate_sanction_case();

ALTER TABLE public.admin_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_staff_assignments' AND policyname='admin_staff_assignments_admin_all') THEN
    CREATE POLICY admin_staff_assignments_admin_all ON public.admin_staff_assignments
      FOR ALL TO authenticated USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_staff_assignments' AND policyname='admin_staff_assignments_admin_guard') THEN
    CREATE POLICY admin_staff_assignments_admin_guard ON public.admin_staff_assignments AS RESTRICTIVE
      FOR ALL TO authenticated USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='support_tickets_admin_all') THEN
    CREATE POLICY support_tickets_admin_all ON public.support_tickets
      FOR ALL TO authenticated USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='support_tickets_admin_guard') THEN
    CREATE POLICY support_tickets_admin_guard ON public.support_tickets AS RESTRICTIVE
      FOR ALL TO authenticated USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_ticket_messages' AND policyname='support_ticket_messages_admin_all') THEN
    CREATE POLICY support_ticket_messages_admin_all ON public.support_ticket_messages
      FOR ALL TO authenticated USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_ticket_messages' AND policyname='support_ticket_messages_admin_guard') THEN
    CREATE POLICY support_ticket_messages_admin_guard ON public.support_ticket_messages AS RESTRICTIVE
      FOR ALL TO authenticated USING ((SELECT public.is_admin()))
      WITH CHECK ((SELECT public.is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_sanctions' AND policyname='admin_sanctions_admin_select') THEN
    CREATE POLICY admin_sanctions_admin_select ON public.admin_sanctions
      FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_sanctions' AND policyname='admin_sanctions_admin_select_guard') THEN
    CREATE POLICY admin_sanctions_admin_select_guard ON public.admin_sanctions AS RESTRICTIVE
      FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_sanctions' AND policyname='admin_sanctions_admin_insert') THEN
    CREATE POLICY admin_sanctions_admin_insert ON public.admin_sanctions
      FOR INSERT TO authenticated WITH CHECK (
        (SELECT public.is_admin()) AND created_by = (SELECT auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_sanctions' AND policyname='admin_sanctions_admin_insert_guard') THEN
    CREATE POLICY admin_sanctions_admin_insert_guard ON public.admin_sanctions AS RESTRICTIVE
      FOR INSERT TO authenticated WITH CHECK (
        (SELECT public.is_admin()) AND created_by = (SELECT auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_audit_logs' AND policyname='admin_audit_logs_admin_select') THEN
    CREATE POLICY admin_audit_logs_admin_select ON public.admin_audit_logs
      FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_audit_logs' AND policyname='admin_audit_logs_admin_select_guard') THEN
    CREATE POLICY admin_audit_logs_admin_select_guard ON public.admin_audit_logs AS RESTRICTIVE
      FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
  END IF;
END;
$$;

REVOKE ALL ON public.admin_staff_assignments, public.support_tickets,
  public.support_ticket_messages, public.admin_sanctions, public.admin_audit_logs
  FROM PUBLIC, anon;
REVOKE ALL ON SEQUENCE public.admin_audit_logs_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_staff_assignments,
  public.support_tickets, public.support_ticket_messages TO authenticated;
GRANT SELECT, INSERT ON public.admin_sanctions TO authenticated;
GRANT SELECT ON public.admin_audit_logs TO authenticated;

COMMIT;
