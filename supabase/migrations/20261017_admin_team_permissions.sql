BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 160),
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
  account_status text NOT NULL DEFAULT 'invited'
    CHECK (account_status IN ('invited', 'active', 'suspended', 'deactivated')),
  permissions text[] NOT NULL DEFAULT '{}',
  invited_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  invited_at timestamptz NOT NULL DEFAULT now(),
  invitation_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  last_seen_at timestamptz,
  presence_preference text NOT NULL DEFAULT 'online'
    CHECK (presence_preference IN ('online', 'away')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (account_status <> 'active' OR user_id IS NOT NULL),
  CHECK (permissions <@ ARRAY[
    'support', 'finance', 'verification', 'moderation', 'users',
    'bookings', 'disputes', 'supervision', 'settings'
  ]::text[])
);

CREATE INDEX IF NOT EXISTS admin_staff_members_status_idx
  ON public.admin_staff_members(account_status);
CREATE INDEX IF NOT EXISTS admin_staff_members_presence_idx
  ON public.admin_staff_members(last_seen_at DESC)
  WHERE account_status = 'active';

ALTER TABLE public.admin_staff_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_staff_members_admin_all ON public.admin_staff_members;
CREATE POLICY admin_staff_members_admin_all ON public.admin_staff_members
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON public.admin_staff_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_staff_members TO authenticated;

CREATE OR REPLACE FUNCTION public.has_admin_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT public.is_admin()), false)
    OR EXISTS (
      SELECT 1
      FROM public.admin_staff_members m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.account_status = 'active'
        AND p_permission = ANY(m.permissions)
    );
$$;
REVOKE ALL ON FUNCTION public.has_admin_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO authenticated;

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

  INSERT INTO public.admin_audit_logs
    (actor_id, action, entity_type, entity_id, new_data)
  VALUES
    ((SELECT auth.uid()), 'admin_staff_members.invited',
     'admin_staff_members', v_id::text,
     jsonb_build_object('full_name', btrim(p_full_name), 'email', v_email));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_admin_staff_member(
  p_member_id uuid,
  p_account_status text,
  p_permissions text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old jsonb;
  v_permissions text[] := coalesce(p_permissions, '{}'::text[]);
BEGIN
  IF NOT coalesce((SELECT public.is_admin()), false) THEN
    RAISE EXCEPTION 'Accès réservé à la direction' USING ERRCODE = '42501';
  END IF;
  IF p_account_status IS NULL OR p_permissions IS NULL
     OR p_account_status NOT IN ('invited', 'active', 'suspended', 'deactivated')
     OR NOT (v_permissions <@ ARRAY[
       'support', 'finance', 'verification', 'moderation', 'users',
       'bookings', 'disputes', 'supervision', 'settings'
     ]::text[]) THEN
    RAISE EXCEPTION 'Statut ou permission invalide' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object('account_status', account_status, 'permissions', permissions)
    INTO v_old
    FROM public.admin_staff_members WHERE id = p_member_id FOR UPDATE;
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
      updated_at = now()
  WHERE id = p_member_id;

  INSERT INTO public.admin_audit_logs
    (actor_id, action, entity_type, entity_id, old_data, new_data)
  VALUES
    ((SELECT auth.uid()), 'admin_staff_members.updated',
     'admin_staff_members', p_member_id::text, v_old,
     jsonb_build_object('account_status', p_account_status, 'permissions', v_permissions));
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_admin_staff_invite()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_confirmed boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN false;
  END IF;
  SELECT lower(u.email), u.email_confirmed_at IS NOT NULL
    INTO v_email, v_confirmed
    FROM auth.users u WHERE u.id = (SELECT auth.uid());
  IF v_email IS NULL OR NOT coalesce(v_confirmed, false) THEN
    RETURN false;
  END IF;

  UPDATE public.admin_staff_members
  SET user_id = (SELECT auth.uid()),
      account_status = 'active',
      updated_at = now()
  WHERE email = v_email
    AND user_id IS NULL
    AND account_status = 'invited'
    AND invitation_expires_at > now();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_staff_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'account_status', m.account_status,
    'permissions', m.permissions,
    'presence_preference', m.presence_preference
  )
  INTO v_result
  FROM public.admin_staff_members m
  WHERE m.user_id = (SELECT auth.uid());
  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_admin_staff_presence(p_preference text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_preference IS NULL OR p_preference NOT IN ('online', 'away') THEN
    RAISE EXCEPTION 'Présence invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE public.admin_staff_members
  SET last_seen_at = now(), presence_preference = p_preference
  WHERE user_id = (SELECT auth.uid()) AND account_status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_staff_invite(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_admin_staff_member(uuid, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_admin_staff_invite() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_admin_staff_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_admin_staff_presence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_staff_invite(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_staff_member(uuid, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_staff_invite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_admin_staff_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_staff_presence(text) TO authenticated;

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
       AND NOT (
         EXISTS (
           SELECT 1 FROM public.admin_staff_assignments
           WHERE user_id = NEW.assigned_to AND is_active
         )
         OR EXISTS (
           SELECT 1 FROM public.admin_staff_members
           WHERE user_id = NEW.assigned_to AND account_status = 'active'
         )
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

-- Keep existing assignments while mapping legacy single roles to independent permissions.
INSERT INTO public.admin_staff_members
  (full_name, email, user_id, account_status, permissions, invited_by, invited_at,
   invitation_expires_at, last_seen_at)
SELECT
  coalesce(nullif(btrim(to_jsonb(p)->>'full_name'), ''), u.email),
  lower(u.email),
  a.user_id,
  CASE WHEN a.is_active THEN 'active' ELSE 'suspended' END,
  CASE a.staff_role
    WHEN 'support_agent' THEN ARRAY['support']::text[]
    WHEN 'support_lead' THEN ARRAY['support', 'disputes']::text[]
    WHEN 'dispute_agent' THEN ARRAY['disputes']::text[]
    WHEN 'verifier' THEN ARRAY['verification']::text[]
    WHEN 'moderator' THEN ARRAY['moderation']::text[]
    WHEN 'finance' THEN ARRAY['finance']::text[]
    WHEN 'analyst' THEN ARRAY['supervision']::text[]
    ELSE '{}'::text[]
  END,
  a.assigned_by,
  a.assigned_at,
  now() + interval '7 days',
  NULL
FROM public.admin_staff_assignments a
JOIN auth.users u ON u.id = a.user_id
LEFT JOIN public.profiles p ON p.id = a.user_id
ON CONFLICT (email) DO NOTHING;

-- Replace restrictive admin-only guards with permission-specific checks.
DROP POLICY IF EXISTS support_tickets_admin_guard ON public.support_tickets;
CREATE POLICY support_tickets_staff_guard ON public.support_tickets AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    (SELECT public.has_admin_permission('support'))
    OR (category = 'dispute' AND (SELECT public.has_admin_permission('disputes')))
  )
  WITH CHECK (
    (SELECT public.has_admin_permission('support'))
    OR (category = 'dispute' AND (SELECT public.has_admin_permission('disputes')))
  );
DROP POLICY IF EXISTS support_tickets_dispute_read ON public.support_tickets;
CREATE POLICY support_tickets_dispute_read ON public.support_tickets
  FOR SELECT TO authenticated
  USING (category = 'dispute' AND (SELECT public.has_admin_permission('disputes')));
DROP POLICY IF EXISTS support_tickets_dispute_insert ON public.support_tickets;
CREATE POLICY support_tickets_dispute_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    category = 'dispute'
    AND created_by = (SELECT auth.uid())
    AND (SELECT public.has_admin_permission('disputes'))
  );
DROP POLICY IF EXISTS support_ticket_messages_admin_guard ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_staff_guard ON public.support_ticket_messages AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    (SELECT public.has_admin_permission('support'))
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.category = 'dispute'
        AND (SELECT public.has_admin_permission('disputes'))
    )
  )
  WITH CHECK (
    (SELECT public.has_admin_permission('support'))
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.category = 'dispute'
        AND (SELECT public.has_admin_permission('disputes'))
    )
  );
DROP POLICY IF EXISTS support_ticket_messages_dispute_read ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_dispute_read ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.category = 'dispute'
        AND (SELECT public.has_admin_permission('disputes'))
    )
  );
DROP POLICY IF EXISTS support_ticket_messages_dispute_insert ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_dispute_insert ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.category = 'dispute'
        AND (SELECT public.has_admin_permission('disputes'))
    )
  );

DROP POLICY IF EXISTS support_tickets_admin_all ON public.support_tickets;
CREATE POLICY support_tickets_admin_all ON public.support_tickets
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_permission('support')))
  WITH CHECK ((SELECT public.has_admin_permission('support')));
DROP POLICY IF EXISTS support_ticket_messages_admin_all ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_admin_all ON public.support_ticket_messages
  FOR ALL TO authenticated
  USING ((SELECT public.has_admin_permission('support')))
  WITH CHECK ((SELECT public.has_admin_permission('support')));

DROP POLICY IF EXISTS admin_sanctions_admin_select_guard ON public.admin_sanctions;
CREATE POLICY admin_sanctions_staff_select_guard ON public.admin_sanctions AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_permission('disputes')));
DROP POLICY IF EXISTS admin_sanctions_admin_insert_guard ON public.admin_sanctions;
CREATE POLICY admin_sanctions_staff_insert_guard ON public.admin_sanctions AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_admin_permission('disputes'))
    AND created_by = (SELECT auth.uid())
  );
DROP POLICY IF EXISTS admin_sanctions_admin_select ON public.admin_sanctions;
CREATE POLICY admin_sanctions_admin_select ON public.admin_sanctions
  FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_permission('disputes')));
DROP POLICY IF EXISTS admin_sanctions_admin_insert ON public.admin_sanctions;
CREATE POLICY admin_sanctions_admin_insert ON public.admin_sanctions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_admin_permission('disputes'))
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS admin_audit_logs_admin_select_guard ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_staff_select_guard ON public.admin_audit_logs AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_permission('supervision')));
DROP POLICY IF EXISTS admin_audit_logs_admin_select ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_admin_select ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_permission('supervision')));

-- Grant scoped read access for staff-facing admin views. Existing admin policies remain intact.
DROP POLICY IF EXISTS profiles_staff_read ON public.profiles;
CREATE POLICY profiles_staff_read ON public.profiles FOR SELECT TO authenticated
  USING (
    (SELECT public.has_admin_permission('users'))
    OR (
      (SELECT public.has_admin_permission('verification'))
      AND EXISTS (SELECT 1 FROM public.hotels h WHERE h.owner_id = profiles.id)
    )
  );
DROP POLICY IF EXISTS subscriptions_staff_read ON public.owner_subscriptions;
CREATE POLICY subscriptions_staff_read ON public.owner_subscriptions FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_permission('finance')));
DROP POLICY IF EXISTS hotels_staff_verification_read ON public.hotels;
CREATE POLICY hotels_staff_verification_read ON public.hotels FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_permission('verification')));
DROP POLICY IF EXISTS hotels_staff_moderation_read ON public.hotels;
CREATE POLICY hotels_staff_moderation_read ON public.hotels FOR SELECT TO authenticated
  USING (
    (SELECT public.has_admin_permission('moderation'))
    AND EXISTS (SELECT 1 FROM public.reviews r WHERE r.hotel_id = hotels.id)
  );
DROP POLICY IF EXISTS bookings_staff_read ON public.bookings;
CREATE POLICY bookings_staff_read ON public.bookings FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_permission('bookings')));
DROP POLICY IF EXISTS reviews_staff_read ON public.reviews;
CREATE POLICY reviews_staff_read ON public.reviews FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_permission('moderation')));
DROP POLICY IF EXISTS audit_logs_staff_read ON public.admin_audit_logs;
CREATE POLICY audit_logs_staff_read ON public.admin_audit_logs FOR SELECT TO authenticated
  USING ((SELECT public.has_admin_permission('supervision')));

COMMIT;
