BEGIN;

ALTER TABLE public.room_availability
  ADD COLUMN IF NOT EXISTS sales_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closure_reason text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.room_availability
  DROP CONSTRAINT IF EXISTS room_availability_reason_length;
ALTER TABLE public.room_availability
  ADD CONSTRAINT room_availability_reason_length
  CHECK (
    (closure_reason IS NULL OR length(closure_reason) <= 300)
    AND (reason IS NULL OR length(reason) <= 300)
  );

CREATE OR REPLACE FUNCTION public.guard_booking_inventory()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_hotel uuid;
  v_total integer;
  v_day date;
  v_cap integer;
  v_reserved integer;
BEGIN
  IF NEW.check_out <= NEW.check_in OR NEW.rooms_count < 1 THEN
    RAISE EXCEPTION 'Invalid booking dates or room count';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.hotel_id IS DISTINCT FROM OLD.hotel_id
    OR NEW.room_type_id IS DISTINCT FROM OLD.room_type_id
    OR NEW.check_in IS DISTINCT FROM OLD.check_in
    OR NEW.check_out IS DISTINCT FROM OLD.check_out
    OR NEW.rooms_count IS DISTINCT FROM OLD.rooms_count
  ) THEN
    RAISE EXCEPTION 'Change of booking inventory requires a dedicated rescheduling operation';
  END IF;
  SELECT hotel_id, total_rooms INTO v_hotel, v_total
  FROM public.room_types WHERE id = NEW.room_type_id FOR UPDATE;
  IF NOT FOUND OR v_hotel IS DISTINCT FROM NEW.hotel_id THEN
    RAISE EXCEPTION 'Room type does not belong to lodging';
  END IF;
  IF NEW.status IN ('pending', 'confirmed', 'completed') THEN
    FOR v_day IN
      SELECT generate_series(NEW.check_in, NEW.check_out - 1, interval '1 day')::date
    LOOP
      IF TG_OP = 'INSERT' AND EXISTS (
        SELECT 1 FROM public.room_availability ra
        WHERE ra.room_type_id = NEW.room_type_id AND ra.date = v_day AND ra.sales_closed
      ) THEN
        RAISE EXCEPTION 'Sales are closed on %', v_day;
      END IF;
      SELECT LEAST(v_total, rooms_available) INTO v_cap
      FROM public.room_availability
      WHERE room_type_id = NEW.room_type_id AND date = v_day;
      v_cap := COALESCE(v_cap, v_total);
      SELECT COALESCE(SUM(rooms_count), 0) INTO v_reserved
      FROM public.bookings
      WHERE room_type_id = NEW.room_type_id
        AND status IN ('pending', 'confirmed', 'completed')
        AND check_in <= v_day AND check_out > v_day
        AND id IS DISTINCT FROM NEW.id;
      IF v_reserved + NEW.rooms_count > v_cap THEN
        RAISE EXCEPTION 'No inventory available on %', v_day;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.room_unit_rate_overrides (
  room_unit_id uuid NOT NULL REFERENCES public.room_units(id) ON DELETE CASCADE,
  date date NOT NULL,
  price_override integer NOT NULL CHECK (price_override > 0),
  reason text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_unit_id, date),
  CHECK (reason IS NULL OR length(reason) <= 300)
);
ALTER TABLE public.room_unit_rate_overrides
  DROP CONSTRAINT IF EXISTS room_unit_rate_overrides_price_override_check;
ALTER TABLE public.room_unit_rate_overrides
  ADD CONSTRAINT room_unit_rate_overrides_price_override_check
  CHECK (price_override >= 0);

CREATE INDEX IF NOT EXISTS room_unit_rate_overrides_date_idx
  ON public.room_unit_rate_overrides(room_unit_id, date);
ALTER TABLE public.room_unit_rate_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_unit_rate_overrides FROM anon, authenticated;
GRANT SELECT ON public.room_unit_rate_overrides TO authenticated;
DROP POLICY IF EXISTS room_unit_rate_overrides_owner_read ON public.room_unit_rate_overrides;
CREATE POLICY room_unit_rate_overrides_owner_read ON public.room_unit_rate_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.room_units u
      JOIN public.room_types r ON r.id = u.room_type_id
      JOIN public.hotels h ON h.id = r.hotel_id
      WHERE u.id = room_unit_id
        AND (h.owner_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

CREATE TABLE IF NOT EXISTS public.room_calendar_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  hotel_id uuid NOT NULL,
  room_type_id uuid NOT NULL,
  room_unit_id uuid,
  action text NOT NULL CHECK (action IN ('close_sales', 'reopen_sales', 'set_price', 'remove_price', 'set_capacity')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  affected_date date NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (reason IS NULL OR length(reason) <= 300)
);
CREATE INDEX IF NOT EXISTS room_calendar_audit_room_recent_idx
  ON public.room_calendar_audit(room_type_id, created_at DESC);
ALTER TABLE public.room_calendar_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_calendar_audit FROM anon, authenticated;
GRANT SELECT ON public.room_calendar_audit TO authenticated;
DROP POLICY IF EXISTS room_calendar_audit_owner_read ON public.room_calendar_audit;
CREATE POLICY room_calendar_audit_owner_read ON public.room_calendar_audit
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = public.room_calendar_audit.hotel_id
        AND h.owner_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.room_calendar_audit_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Le journal du calendrier est immuable';
END;
$$;
REVOKE ALL ON FUNCTION public.room_calendar_audit_block_mutation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS room_calendar_audit_append_only ON public.room_calendar_audit;
CREATE TRIGGER room_calendar_audit_append_only
BEFORE UPDATE OR DELETE ON public.room_calendar_audit
FOR EACH ROW EXECUTE FUNCTION public.room_calendar_audit_block_mutation();

CREATE OR REPLACE FUNCTION public.set_room_calendar_action(
  p_room_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_action text,
  p_room_unit_ids uuid[] DEFAULT NULL,
  p_rooms_available integer DEFAULT NULL,
  p_price_override integer DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_hotel_id uuid;
  v_owner_id uuid;
  v_total integer;
  v_day date;
  v_unit_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_capacity integer;
  v_reserved integer;
  v_unit_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '28000';
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL
     OR p_end_date < p_start_date OR p_end_date > p_start_date + 365
     OR p_start_date < (now() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'Période invalide';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('close_sales', 'reopen_sales', 'set_price', 'remove_price', 'set_capacity') THEN
    RAISE EXCEPTION 'Action calendrier invalide';
  END IF;
  IF p_reason IS NOT NULL AND length(btrim(p_reason)) > 300 THEN
    RAISE EXCEPTION 'Le motif ne peut pas dépasser 300 caractères';
  END IF;
  IF p_action = 'set_price' AND (p_price_override IS NULL OR p_price_override < 0) THEN
    RAISE EXCEPTION 'Le prix spécial ne peut pas être négatif';
  END IF;
  IF p_action = 'set_capacity' AND (p_room_unit_ids IS NOT NULL OR p_rooms_available IS NULL OR p_rooms_available < 0) THEN
    RAISE EXCEPTION 'Capacité ou périmètre invalide';
  END IF;
  IF p_action IN ('close_sales', 'reopen_sales', 'set_price', 'remove_price')
     AND p_room_unit_ids IS NOT NULL AND cardinality(p_room_unit_ids) = 0 THEN
    RAISE EXCEPTION 'Sélectionnez au moins une unité ou choisissez toute la catégorie';
  END IF;

  SELECT r.hotel_id, h.owner_id, r.total_rooms
  INTO v_hotel_id, v_owner_id, v_total
  FROM public.room_types r
  JOIN public.hotels h ON h.id = r.hotel_id
  WHERE r.id = p_room_type_id
  FOR UPDATE OF r;
  IF NOT FOUND OR (v_owner_id IS DISTINCT FROM v_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Catégorie introuvable ou accès refusé' USING ERRCODE = '42501';
  END IF;

  IF p_room_unit_ids IS NOT NULL THEN
    SELECT count(DISTINCT u.id) INTO v_unit_count
    FROM public.room_units u
    WHERE u.room_type_id = p_room_type_id
      AND u.is_active
      AND u.id = ANY(p_room_unit_ids);
    IF v_unit_count <> cardinality(p_room_unit_ids) THEN
      RAISE EXCEPTION 'Une ou plusieurs unités sélectionnées sont invalides';
    END IF;
  END IF;

  IF p_action = 'reopen_sales' THEN
    IF p_room_unit_ids IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.room_availability ra
      WHERE ra.room_type_id = p_room_type_id
        AND ra.date BETWEEN p_start_date AND p_end_date AND ra.sales_closed
    ) THEN
      RAISE EXCEPTION 'Aucune fermeture de catégorie n’existe sur cette période';
    ELSIF p_room_unit_ids IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.room_unit_availability a
      WHERE a.room_unit_id = ANY(p_room_unit_ids)
        AND a.date BETWEEN p_start_date AND p_end_date AND a.sales_closed
    ) THEN
      RAISE EXCEPTION 'Aucune fermeture d’unité n’existe sur cette période';
    END IF;
  ELSIF p_action = 'remove_price' THEN
    IF p_room_unit_ids IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.room_availability ra
      WHERE ra.room_type_id = p_room_type_id
        AND ra.date BETWEEN p_start_date AND p_end_date AND ra.price_override IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Aucun tarif spécial de catégorie n’existe sur cette période';
    ELSIF p_room_unit_ids IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.room_unit_rate_overrides r
      WHERE r.room_unit_id = ANY(p_room_unit_ids)
        AND r.date BETWEEN p_start_date AND p_end_date
    ) THEN
      RAISE EXCEPTION 'Aucun tarif spécial d’unité n’existe sur cette période';
    END IF;
  END IF;

  IF p_action = 'set_capacity' THEN
    IF p_rooms_available > v_total THEN
      RAISE EXCEPTION 'La capacité ne peut pas dépasser le nombre d’unités actives';
    END IF;
    FOR v_day IN SELECT generate_series(p_start_date, p_end_date, interval '1 day')::date LOOP
      SELECT COALESCE(sum(b.rooms_count), 0) INTO v_reserved
      FROM public.bookings b
      WHERE b.room_type_id = p_room_type_id
        AND b.status IN ('pending', 'confirmed', 'completed')
        AND b.check_in <= v_day AND b.check_out > v_day;
      IF p_rooms_available < v_reserved THEN
        RAISE EXCEPTION 'La capacité du % serait inférieure aux réservations existantes (% unités)', v_day, v_reserved;
      END IF;
      SELECT to_jsonb(ra) - 'id' - 'created_at' INTO v_old
      FROM public.room_availability ra
      WHERE ra.room_type_id = p_room_type_id AND ra.date = v_day;
      INSERT INTO public.room_availability (room_type_id, date, rooms_available, updated_by, updated_at)
      VALUES (p_room_type_id, v_day, p_rooms_available, v_user_id, now())
      ON CONFLICT (room_type_id, date) DO UPDATE
      SET rooms_available = EXCLUDED.rooms_available,
          updated_by = EXCLUDED.updated_by,
          updated_at = now();
      SELECT jsonb_build_object('rooms_available', p_rooms_available) INTO v_new;
      INSERT INTO public.room_calendar_audit (
        actor_id, hotel_id, room_type_id, action, start_date, end_date, affected_date, old_value, new_value, reason
      ) VALUES (v_user_id, v_hotel_id, p_room_type_id, p_action, p_start_date, p_end_date, v_day, v_old, v_new, nullif(btrim(p_reason), ''));
    END LOOP;
    RETURN;
  END IF;

  IF p_room_unit_ids IS NULL THEN
    FOR v_day IN SELECT generate_series(p_start_date, p_end_date, interval '1 day')::date LOOP
      SELECT jsonb_build_object(
        'sales_closed', ra.sales_closed,
        'closure_reason', ra.closure_reason,
        'price_override', ra.price_override,
        'reason', ra.reason
      ) INTO v_old
      FROM public.room_availability ra
      WHERE ra.room_type_id = p_room_type_id AND ra.date = v_day;
      IF p_action = 'close_sales' THEN
        INSERT INTO public.room_availability (room_type_id, date, rooms_available, sales_closed, closure_reason, updated_by, updated_at)
        VALUES (p_room_type_id, v_day, v_total, true, nullif(btrim(p_reason), ''), v_user_id, now())
        ON CONFLICT (room_type_id, date) DO UPDATE
        SET sales_closed = true, closure_reason = EXCLUDED.closure_reason,
            updated_by = EXCLUDED.updated_by, updated_at = now();
        v_new := jsonb_build_object('sales_closed', true, 'reason', nullif(btrim(p_reason), ''));
      ELSIF p_action = 'reopen_sales' THEN
        UPDATE public.room_availability
        SET sales_closed = false, closure_reason = NULL, updated_by = v_user_id, updated_at = now()
        WHERE room_type_id = p_room_type_id AND date = v_day;
        v_new := jsonb_build_object('sales_closed', false, 'reason', NULL);
      ELSIF p_action = 'set_price' THEN
        INSERT INTO public.room_availability (room_type_id, date, rooms_available, price_override, reason, updated_by, updated_at)
        VALUES (p_room_type_id, v_day, v_total, p_price_override, nullif(btrim(p_reason), ''), v_user_id, now())
        ON CONFLICT (room_type_id, date) DO UPDATE
        SET price_override = EXCLUDED.price_override,
            reason = EXCLUDED.reason, updated_by = EXCLUDED.updated_by, updated_at = now();
        v_new := jsonb_build_object('price_override', p_price_override, 'reason', nullif(btrim(p_reason), ''));
      ELSE
        UPDATE public.room_availability
        SET price_override = NULL, reason = NULL, updated_by = v_user_id, updated_at = now()
        WHERE room_type_id = p_room_type_id AND date = v_day;
        v_new := jsonb_build_object('price_override', NULL, 'reason', NULL);
      END IF;
      INSERT INTO public.room_calendar_audit (
        actor_id, hotel_id, room_type_id, action, start_date, end_date, affected_date, old_value, new_value, reason
      ) VALUES (v_user_id, v_hotel_id, p_room_type_id, p_action, p_start_date, p_end_date, v_day, v_old, v_new, nullif(btrim(p_reason), ''));
    END LOOP;
  ELSE
    FOREACH v_unit_id IN ARRAY p_room_unit_ids LOOP
      FOR v_day IN SELECT generate_series(p_start_date, p_end_date, interval '1 day')::date LOOP
        IF p_action = 'close_sales' THEN
          SELECT jsonb_build_object('sales_closed', true, 'reason', a.reason) INTO v_old
          FROM public.room_unit_availability a
          WHERE a.room_unit_id = v_unit_id AND a.date = v_day AND a.sales_closed;
          INSERT INTO public.room_unit_availability (room_unit_id, date, sales_closed, reason, updated_by, updated_at)
          VALUES (v_unit_id, v_day, true, nullif(btrim(p_reason), ''), v_user_id, now())
          ON CONFLICT (room_unit_id, date) DO UPDATE
          SET sales_closed = true, reason = EXCLUDED.reason, updated_by = EXCLUDED.updated_by, updated_at = now();
          v_new := jsonb_build_object('sales_closed', true, 'reason', nullif(btrim(p_reason), ''));
        ELSIF p_action = 'reopen_sales' THEN
          SELECT jsonb_build_object('sales_closed', true, 'reason', a.reason) INTO v_old
          FROM public.room_unit_availability a
          WHERE a.room_unit_id = v_unit_id AND a.date = v_day AND a.sales_closed;
          DELETE FROM public.room_unit_availability
          WHERE room_unit_id = v_unit_id AND date = v_day;
          v_new := jsonb_build_object('sales_closed', false, 'reason', NULL);
        ELSIF p_action = 'set_price' THEN
          SELECT jsonb_build_object('price_override', r.price_override, 'reason', r.reason) INTO v_old
          FROM public.room_unit_rate_overrides r
          WHERE r.room_unit_id = v_unit_id AND r.date = v_day;
          INSERT INTO public.room_unit_rate_overrides (room_unit_id, date, price_override, reason, updated_by, updated_at)
          VALUES (v_unit_id, v_day, p_price_override, nullif(btrim(p_reason), ''), v_user_id, now())
          ON CONFLICT (room_unit_id, date) DO UPDATE
          SET price_override = EXCLUDED.price_override, reason = EXCLUDED.reason,
              updated_by = EXCLUDED.updated_by, updated_at = now();
          v_new := jsonb_build_object('price_override', p_price_override, 'reason', nullif(btrim(p_reason), ''));
        ELSE
          SELECT jsonb_build_object('price_override', r.price_override, 'reason', r.reason) INTO v_old
          FROM public.room_unit_rate_overrides r
          WHERE r.room_unit_id = v_unit_id AND r.date = v_day;
          DELETE FROM public.room_unit_rate_overrides
          WHERE room_unit_id = v_unit_id AND date = v_day;
          v_new := jsonb_build_object('price_override', NULL, 'reason', NULL);
        END IF;
        INSERT INTO public.room_calendar_audit (
          actor_id, hotel_id, room_type_id, room_unit_id, action, start_date, end_date, affected_date, old_value, new_value, reason
        ) VALUES (v_user_id, v_hotel_id, p_room_type_id, v_unit_id, p_action, p_start_date, p_end_date, v_day, v_old, v_new, nullif(btrim(p_reason), ''));
      END LOOP;
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_room_availability(
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_rooms_needed integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total integer;
  v_day date;
  v_cap integer;
  v_reserved integer;
  v_physical_free integer;
BEGIN
  IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in
     OR p_check_out > p_check_in + 365 OR p_rooms_needed IS NULL OR p_rooms_needed < 1 THEN
    RETURN false;
  END IF;
  SELECT total_rooms INTO v_total FROM public.room_types WHERE id = p_room_type_id;
  IF v_total IS NULL THEN RETURN false; END IF;
  FOR v_day IN SELECT generate_series(p_check_in, p_check_out - 1, interval '1 day')::date LOOP
    IF EXISTS (
      SELECT 1 FROM public.room_availability ra
      WHERE ra.room_type_id = p_room_type_id AND ra.date = v_day AND ra.sales_closed
    ) THEN RETURN false; END IF;
    SELECT LEAST(v_total, ra.rooms_available) INTO v_cap
    FROM public.room_availability ra
    WHERE ra.room_type_id = p_room_type_id AND ra.date = v_day;
    v_cap := COALESCE(v_cap, v_total);
    SELECT COALESCE(sum(b.rooms_count), 0) INTO v_reserved
    FROM public.bookings b
    WHERE b.room_type_id = p_room_type_id AND b.status IN ('pending','confirmed','completed')
      AND b.check_in <= v_day AND b.check_out > v_day;
    IF v_reserved + p_rooms_needed > v_cap THEN RETURN false; END IF;
  END LOOP;
  SELECT count(*) INTO v_physical_free
  FROM public.room_units u
  WHERE u.room_type_id = p_room_type_id AND u.is_active
    AND NOT EXISTS (
      SELECT 1 FROM public.booking_room_assignments a
      JOIN public.bookings b ON b.id = a.booking_id
      WHERE a.room_unit_id = u.id AND b.status IN ('pending','confirmed','completed')
        AND b.check_in < p_check_out AND p_check_in < b.check_out
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.room_unit_availability a
      WHERE a.room_unit_id = u.id AND a.sales_closed
        AND a.date >= p_check_in AND a.date < p_check_out
    );
  RETURN v_physical_free >= p_rooms_needed;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_room_calendar_status_v2(
  p_room_type_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  date date,
  rooms_available integer,
  price_override integer,
  configured boolean,
  sales_closed boolean,
  closure_reason text,
  reason text,
  booked_rooms integer,
  active_units integer,
  special_units integer,
  special_unit_min_price integer,
  special_unit_max_price integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_total integer;
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date OR p_end_date > p_start_date + 400 THEN
    RAISE EXCEPTION 'Période de lecture invalide';
  END IF;
  SELECT h.owner_id, r.total_rooms INTO v_owner_id, v_total
  FROM public.room_types r JOIN public.hotels h ON h.id = r.hotel_id
  WHERE r.id = p_room_type_id;
  IF NOT FOUND OR (v_owner_id IS DISTINCT FROM v_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Catégorie introuvable ou accès refusé' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT d::date,
    LEAST(v_total, COALESCE(ra.rooms_available, v_total)),
    ra.price_override,
    ra.id IS NOT NULL,
    COALESCE(ra.sales_closed, false),
    ra.closure_reason,
    ra.reason,
    (SELECT COALESCE(sum(b.rooms_count), 0)::integer FROM public.bookings b
      WHERE b.room_type_id = p_room_type_id AND b.status IN ('pending','confirmed','completed')
        AND b.check_in <= d::date AND b.check_out > d::date),
    (SELECT count(*)::integer FROM public.room_units u WHERE u.room_type_id = p_room_type_id AND u.is_active),
    (SELECT count(*)::integer FROM public.room_unit_rate_overrides x
      JOIN public.room_units u ON u.id = x.room_unit_id
      WHERE u.room_type_id = p_room_type_id AND u.is_active AND x.date = d::date),
    (SELECT min(x.price_override)::integer FROM public.room_unit_rate_overrides x
      JOIN public.room_units u ON u.id = x.room_unit_id
      WHERE u.room_type_id = p_room_type_id AND u.is_active AND x.date = d::date),
    (SELECT max(x.price_override)::integer FROM public.room_unit_rate_overrides x
      JOIN public.room_units u ON u.id = x.room_unit_id
      WHERE u.room_type_id = p_room_type_id AND u.is_active AND x.date = d::date)
  FROM generate_series(p_start_date, p_end_date, interval '1 day') d
  LEFT JOIN public.room_availability ra ON ra.room_type_id = p_room_type_id AND ra.date = d::date
  ORDER BY d;
END;
$$;

DROP FUNCTION IF EXISTS public.set_room_sales_status(uuid, date, date, boolean);

CREATE FUNCTION public.set_room_sales_status(
  p_room_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_close_sales boolean
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.set_room_calendar_action(
    p_room_type_id, p_start_date, p_end_date,
    CASE WHEN p_close_sales THEN 'close_sales' ELSE 'reopen_sales' END,
    NULL, NULL, NULL, NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.set_room_unit_sales_status(
  p_room_unit_id uuid,
  p_start_date date,
  p_end_date date,
  p_close_sales boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room_type_id uuid;
BEGIN
  SELECT room_type_id INTO v_room_type_id
  FROM public.room_units
  WHERE id = p_room_unit_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chambre introuvable ou désactivée'; END IF;
  PERFORM public.set_room_calendar_action(
    v_room_type_id, p_start_date, p_end_date,
    CASE WHEN p_close_sales THEN 'close_sales' ELSE 'reopen_sales' END,
    ARRAY[p_room_unit_id], NULL, NULL, p_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_room_calendar_range(
  p_room_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_rooms_available integer,
  p_price_override integer,
  p_update_price boolean,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_rooms_available IS NOT NULL THEN
    PERFORM public.set_room_calendar_action(
      p_room_type_id, p_start_date, p_end_date, 'set_capacity', NULL, p_rooms_available, NULL, p_reason
    );
  END IF;
  IF p_update_price THEN
    PERFORM public.set_room_calendar_action(
      p_room_type_id, p_start_date, p_end_date,
      CASE WHEN p_price_override IS NULL THEN 'remove_price' ELSE 'set_price' END,
      NULL, NULL, p_price_override, p_reason
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_room_calendar_range(
  p_room_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_rooms_available integer,
  p_price_override integer,
  p_update_price boolean
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.update_room_calendar_range(
    p_room_type_id, p_start_date, p_end_date,
    p_rooms_available, p_price_override, p_update_price, NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.preview_room_booking_price(
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_rooms_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room public.room_types%ROWTYPE;
  v_units uuid[];
  v_day date;
  v_category_price integer;
  v_category_capacity integer;
  v_reserved integer;
  v_available integer;
  v_physical_free integer;
  v_day_total bigint;
  v_total bigint := 0;
  v_night_special boolean;
  v_has_special boolean := false;
  v_breakdown jsonb := '[]'::jsonb;
  v_unit_count integer := 0;
  v_active_unit_count integer := 0;
  v_special_unit_count integer := 0;
  v_min_available integer;
  v_nights integer;
  v_base_total bigint;
  v_category_wide_special boolean := false;
  v_unit_specific_rates boolean := false;
BEGIN
  IF p_check_in IS NULL OR p_check_out IS NULL
     OR p_check_in < (now() AT TIME ZONE 'UTC')::date
     OR p_check_out <= p_check_in OR p_check_out > p_check_in + 365
     OR p_rooms_count IS NULL OR p_rooms_count < 1 OR p_rooms_count > 20 THEN
    RAISE EXCEPTION 'Dates ou nombre d’unités invalides';
  END IF;
  SELECT r.* INTO v_room
  FROM public.room_types r
  JOIN public.hotels h ON h.id = r.hotel_id
  WHERE r.id = p_room_type_id AND h.status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Hébergement indisponible à la réservation'; END IF;
  SELECT COALESCE(array_agg(candidate.id ORDER BY candidate.unit_code, candidate.id), ARRAY[]::uuid[])
  INTO v_units
  FROM (
    SELECT u.id, u.unit_code
    FROM public.room_units u
    WHERE u.room_type_id = p_room_type_id AND u.is_active
      AND NOT EXISTS (
        SELECT 1 FROM public.booking_room_assignments a
        JOIN public.bookings b ON b.id = a.booking_id
        WHERE a.room_unit_id = u.id AND b.status IN ('pending','confirmed','completed')
          AND b.check_in < p_check_out AND p_check_in < b.check_out
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.room_unit_availability a
        WHERE a.room_unit_id = u.id AND a.sales_closed
          AND a.date >= p_check_in AND a.date < p_check_out
      )
    ORDER BY u.unit_code, u.id
    LIMIT p_rooms_count
  ) candidate;
  v_unit_count := cardinality(v_units);
  SELECT count(*)::integer INTO v_active_unit_count
  FROM public.room_units u
  WHERE u.room_type_id = p_room_type_id AND u.is_active;
  v_nights := p_check_out - p_check_in;
  v_base_total := v_room.price_per_night::bigint * v_nights * p_rooms_count;
  v_min_available := v_room.total_rooms;

  FOR v_day IN SELECT generate_series(p_check_in, p_check_out - 1, interval '1 day')::date LOOP
    SELECT ra.price_override, LEAST(v_room.total_rooms, COALESCE(ra.rooms_available, v_room.total_rooms))
    INTO v_category_price, v_category_capacity
    FROM (SELECT 1) seed
    LEFT JOIN public.room_availability ra ON ra.room_type_id = p_room_type_id AND ra.date = v_day;
    SELECT count(*)::integer INTO v_special_unit_count
    FROM public.room_unit_rate_overrides rate
    JOIN public.room_units u ON u.id = rate.room_unit_id
    WHERE u.room_type_id = p_room_type_id AND u.is_active AND rate.date = v_day;
    IF v_category_price IS NOT NULL
       OR (v_active_unit_count > 0 AND v_special_unit_count = v_active_unit_count) THEN
      v_category_wide_special := true;
    END IF;
    SELECT COALESCE(sum(b.rooms_count), 0)::integer INTO v_reserved
    FROM public.bookings b
    WHERE b.room_type_id = p_room_type_id AND b.status IN ('pending','confirmed','completed')
      AND b.check_in <= v_day AND b.check_out > v_day;
    SELECT count(*)::integer INTO v_physical_free
    FROM public.room_units u
    WHERE u.room_type_id = p_room_type_id AND u.is_active
      AND NOT EXISTS (
        SELECT 1 FROM public.booking_room_assignments a
        JOIN public.bookings b ON b.id = a.booking_id
        WHERE a.room_unit_id = u.id AND b.status IN ('pending','confirmed','completed')
          AND b.check_in <= v_day AND b.check_out > v_day
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.room_unit_availability a
        WHERE a.room_unit_id = u.id AND a.sales_closed AND a.date = v_day
      );
    v_available := LEAST(
      GREATEST(0, v_category_capacity - v_reserved),
      v_physical_free
    );
    IF EXISTS (
      SELECT 1 FROM public.room_availability ra
      WHERE ra.room_type_id = p_room_type_id AND ra.date = v_day AND ra.sales_closed
    ) THEN
      v_available := 0;
    END IF;
    v_min_available := LEAST(v_min_available, v_available);

    SELECT COALESCE(sum(COALESCE(rate.price_override, v_category_price, v_room.price_per_night)), 0)
    INTO v_day_total
    FROM unnest(v_units) selected(room_unit_id)
    LEFT JOIN public.room_unit_rate_overrides rate ON rate.room_unit_id = selected.room_unit_id AND rate.date = v_day;
    v_day_total := v_day_total
      + GREATEST(p_rooms_count - v_unit_count, 0)::bigint * COALESCE(v_category_price, v_room.price_per_night);
    v_night_special := v_category_price IS NOT NULL OR (v_unit_count > 0 AND EXISTS (
      SELECT 1 FROM public.room_unit_rate_overrides rate
      WHERE rate.room_unit_id = ANY(v_units) AND rate.date = v_day
    ));
    IF EXISTS (
      SELECT 1 FROM public.room_unit_rate_overrides rate
      WHERE rate.room_unit_id = ANY(v_units) AND rate.date = v_day
    ) THEN
      v_unit_specific_rates := true;
    END IF;
    IF v_night_special THEN
      v_has_special := true;
    END IF;
    v_total := v_total + v_day_total;
    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
      'date', v_day,
      'price', round(v_day_total::numeric / p_rooms_count),
      'isOverride', v_night_special,
      'roomsAvailable', v_available
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'totalPrice', v_total,
    'baseTotalPrice', v_base_total,
    'averageNightlyPrice', round(v_total::numeric / (v_nights * p_rooms_count)),
    'nightsCount', v_nights,
    'hasSpecialRates', v_has_special,
    'hasCategoryWideSpecialRate', v_category_wide_special,
    'hasUnitSpecificRates', v_unit_specific_rates,
    'minAvailable', v_min_available,
    'nightlyBreakdown', v_breakdown
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking(
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests_adults integer,
  p_guests_children integer,
  p_rooms_count integer,
  p_guest_name text,
  p_guest_phone text,
  p_special_requests text,
  p_expected_total_price integer
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_hotel public.hotels%ROWTYPE;
  v_room public.room_types%ROWTYPE;
  v_plan text;
  v_commission_pct numeric(5,2);
  v_day date;
  v_cap integer;
  v_reserved integer;
  v_night_price integer;
  v_total bigint := 0;
  v_commission bigint;
  v_nights integer;
  v_booking public.bookings%ROWTYPE;
  v_unit_id uuid;
  v_available_units integer;
  v_closed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '28000';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL OR btrim(v_email) = '' THEN
    RAISE EXCEPTION 'Adresse e-mail de compte manquante';
  END IF;
  IF p_check_in IS NULL OR p_check_out IS NULL
     OR p_check_in < (now() AT TIME ZONE 'UTC')::date
     OR p_check_out <= p_check_in OR p_check_out > p_check_in + 365 THEN
    RAISE EXCEPTION 'Dates de séjour invalides (maximum 365 nuits)';
  END IF;
  IF p_rooms_count IS NULL OR p_rooms_count < 1 OR p_rooms_count > 20
     OR p_guests_adults IS NULL OR p_guests_adults < 1
     OR p_guests_children IS NULL OR p_guests_children < 0 THEN
    RAISE EXCEPTION 'Nombre de chambres ou de voyageurs invalide';
  END IF;
  IF p_guest_name IS NULL OR length(btrim(p_guest_name)) NOT BETWEEN 2 AND 150
     OR p_guest_phone IS NULL OR length(btrim(p_guest_phone)) NOT BETWEEN 5 AND 40
     OR length(coalesce(p_special_requests, '')) > 2000 THEN
    RAISE EXCEPTION 'Coordonnées du voyageur invalides';
  END IF;

  SELECT * INTO v_room FROM public.room_types WHERE id = p_room_type_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Type de chambre introuvable'; END IF;
  SELECT * INTO v_hotel FROM public.hotels WHERE id = v_room.hotel_id;
  IF NOT FOUND OR v_hotel.status <> 'published' THEN
    RAISE EXCEPTION 'Hébergement indisponible à la réservation';
  END IF;
  IF p_rooms_count > v_room.total_rooms
     OR p_guests_adults > v_room.capacity_adults * p_rooms_count
     OR p_guests_children > v_room.capacity_children * p_rooms_count THEN
    RAISE EXCEPTION 'Capacité du type de chambre dépassée';
  END IF;

  SELECT os.plan_code, COALESCE(os.custom_marketplace_commission_pct, sp.marketplace_commission_pct)
  INTO v_plan, v_commission_pct
  FROM public.owner_subscriptions os
  JOIN public.saas_plans sp ON sp.code = os.plan_code
  WHERE os.owner_id = v_hotel.owner_id AND os.status IN ('active', 'trialing')
    AND (os.current_period_end IS NULL OR os.current_period_end > now());
  IF NOT FOUND THEN
    v_plan := 'standard';
    SELECT marketplace_commission_pct INTO v_commission_pct FROM public.saas_plans WHERE code = 'standard';
  END IF;
  IF v_commission_pct IS NULL THEN RAISE EXCEPTION 'Commission Enterprise non configurée'; END IF;

  v_nights := p_check_out - p_check_in;
  FOR v_day IN SELECT generate_series(p_check_in, p_check_out - 1, interval '1 day')::date LOOP
    SELECT LEAST(v_room.total_rooms, COALESCE(ra.rooms_available, v_room.total_rooms)),
      COALESCE(ra.price_override, v_room.price_per_night),
      COALESCE(ra.sales_closed, false)
    INTO v_cap, v_night_price, v_closed
    FROM (SELECT 1) seed
    LEFT JOIN public.room_availability ra ON ra.room_type_id = v_room.id AND ra.date = v_day;
    IF v_closed THEN RAISE EXCEPTION 'Les ventes sont fermées le %', v_day; END IF;
    SELECT COALESCE(sum(b.rooms_count), 0) INTO v_reserved
    FROM public.bookings b
    WHERE b.room_type_id = v_room.id
      AND b.status IN ('pending', 'confirmed', 'completed')
      AND b.check_in <= v_day AND b.check_out > v_day;
    IF v_reserved + p_rooms_count > v_cap THEN
      RAISE EXCEPTION 'Plus assez de chambres disponibles le %', v_day;
    END IF;

    v_available_units := 0;
    FOR v_unit_id IN
      SELECT u.id
      FROM public.room_units u
      WHERE u.room_type_id = v_room.id AND u.is_active
        AND NOT EXISTS (
          SELECT 1 FROM public.booking_room_assignments a
          JOIN public.bookings b ON b.id = a.booking_id
          WHERE a.room_unit_id = u.id AND b.status IN ('pending','confirmed','completed')
            AND b.check_in < p_check_out AND p_check_in < b.check_out
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.room_unit_availability a
          WHERE a.room_unit_id = u.id AND a.sales_closed
            AND a.date >= p_check_in AND a.date < p_check_out
        )
      ORDER BY u.unit_code, u.id
      LIMIT p_rooms_count
    LOOP
      v_available_units := v_available_units + 1;
      SELECT COALESCE(rate.price_override, ra.price_override, v_room.price_per_night)
      INTO v_night_price
      FROM (SELECT 1) seed
      LEFT JOIN public.room_unit_rate_overrides rate ON rate.room_unit_id = v_unit_id AND rate.date = v_day
      LEFT JOIN public.room_availability ra ON ra.room_type_id = v_room.id AND ra.date = v_day;
      v_total := v_total + v_night_price::bigint;
    END LOOP;
    IF v_available_units < p_rooms_count THEN
      RAISE EXCEPTION 'Plus assez d’unités physiques disponibles du % au %', p_check_in, p_check_out;
    END IF;
  END LOOP;

  IF v_total > 2147483647 THEN RAISE EXCEPTION 'Montant du séjour trop élevé'; END IF;
  v_commission := round(v_total * v_commission_pct / 100);
  IF v_commission > 2147483647 THEN RAISE EXCEPTION 'Commission trop élevée'; END IF;
  IF p_expected_total_price IS NOT NULL AND p_expected_total_price <> v_total THEN
    RAISE EXCEPTION 'Le tarif du séjour a changé. Vérifiez le nouveau montant avant de confirmer.';
  END IF;

  INSERT INTO public.bookings (
    booking_number, hotel_id, room_type_id, user_id,
    check_in, check_out, guests_adults, guests_children, rooms_count,
    nights_count, total_price, commission_amount,
    guest_name, guest_email, guest_phone, special_requests,
    status, payment_status, booking_source, currency
  ) VALUES (
    'TGS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)),
    v_hotel.id, v_room.id, v_user_id,
    p_check_in, p_check_out, p_guests_adults, p_guests_children, p_rooms_count,
    v_nights, v_total::integer, v_commission::integer,
    btrim(p_guest_name), v_email, btrim(p_guest_phone), nullif(btrim(p_special_requests), ''),
    'pending', 'on_site_unpaid', 'marketplace', 'XOF'
  ) RETURNING * INTO v_booking;
  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking(
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests_adults integer,
  p_guests_children integer,
  p_rooms_count integer,
  p_guest_name text,
  p_guest_phone text,
  p_special_requests text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.create_booking(
    p_room_type_id, p_check_in, p_check_out, p_guests_adults,
    p_guests_children, p_rooms_count, p_guest_name, p_guest_phone,
    p_special_requests, NULL
  );
$$;

REVOKE ALL ON FUNCTION public.set_room_calendar_action(uuid,date,date,text,uuid[],integer,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_room_calendar_action(uuid,date,date,text,uuid[],integer,integer,text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_room_calendar_status_v2(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_room_calendar_status_v2(uuid,date,date) TO authenticated;
REVOKE ALL ON FUNCTION public.check_room_availability(uuid,date,date,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_room_availability(uuid,date,date,integer) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.set_room_sales_status(uuid,date,date,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_room_sales_status(uuid,date,date,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.set_room_unit_sales_status(uuid,date,date,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_room_unit_sales_status(uuid,date,date,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.update_room_calendar_range(uuid,date,date,integer,integer,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_room_calendar_range(uuid,date,date,integer,integer,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.update_room_calendar_range(uuid,date,date,integer,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_room_calendar_range(uuid,date,date,integer,integer,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.create_booking(uuid,date,date,integer,integer,integer,text,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid,date,date,integer,integer,integer,text,text,text,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.create_booking(uuid,date,date,integer,integer,integer,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid,date,date,integer,integer,integer,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.preview_room_booking_price(uuid,date,date,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_room_booking_price(uuid,date,date,integer) TO anon, authenticated;

COMMIT;
