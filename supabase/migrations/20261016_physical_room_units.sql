-- Track each physical room independently while preserving room-type capacity.
BEGIN;

CREATE TABLE IF NOT EXISTS public.room_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id uuid NOT NULL REFERENCES public.room_types(id) ON DELETE RESTRICT,
  unit_code text NOT NULL,
  unit_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_type_id, unit_code),
  CHECK (length(btrim(unit_code)) BETWEEN 1 AND 40),
  CHECK (unit_name IS NULL OR length(btrim(unit_name)) <= 100)
);

-- A room_units table may already exist from an earlier deployment without
-- these lifecycle columns; CREATE TABLE IF NOT EXISTS does not add them.
ALTER TABLE public.room_units
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.room_units
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS room_units_type_active_idx
  ON public.room_units(room_type_id, is_active, unit_code);

CREATE TABLE IF NOT EXISTS public.booking_room_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  room_unit_id uuid NOT NULL REFERENCES public.room_units(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, room_unit_id)
);

CREATE INDEX IF NOT EXISTS booking_room_assignments_unit_idx
  ON public.booking_room_assignments(room_unit_id, booking_id);

CREATE TABLE IF NOT EXISTS public.room_unit_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_unit_id uuid NOT NULL REFERENCES public.room_units(id) ON DELETE CASCADE,
  date date NOT NULL,
  sales_closed boolean NOT NULL DEFAULT true,
  reason text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_unit_id, date),
  CHECK (reason IS NULL OR length(reason) <= 300)
);

CREATE INDEX IF NOT EXISTS room_unit_availability_date_idx
  ON public.room_unit_availability(room_unit_id, date);

ALTER TABLE public.room_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_room_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_unit_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_units_owner_read ON public.room_units;
CREATE POLICY room_units_owner_read ON public.room_units
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_types r
      JOIN public.hotels h ON h.id = r.hotel_id
      WHERE r.id = room_type_id
        AND (h.owner_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS booking_room_assignments_read ON public.booking_room_assignments;
CREATE POLICY booking_room_assignments_read ON public.booking_room_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.hotels h ON h.id = b.hotel_id
      WHERE b.id = booking_id
        AND (b.user_id = (SELECT auth.uid()) OR h.owner_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS room_unit_availability_owner_read ON public.room_unit_availability;
CREATE POLICY room_unit_availability_owner_read ON public.room_unit_availability
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_units u
      JOIN public.room_types r ON r.id = u.room_type_id
      JOIN public.hotels h ON h.id = r.hotel_id
      WHERE u.id = room_unit_id
        AND (h.owner_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

REVOKE ALL ON public.room_units, public.booking_room_assignments,
  public.room_unit_availability FROM anon, authenticated;
GRANT SELECT ON public.room_units, public.booking_room_assignments,
  public.room_unit_availability TO authenticated;

-- Replace the legacy fixed limit (three units per category) with the actual
-- room_types.total_rooms capacity. Preserve the guard against excess units.
CREATE OR REPLACE FUNCTION public.boly_guard_room_unit_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_room_type_id uuid;
  v_capacity integer;
  v_active_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_room_type_id := NEW.room_type_id;
  SELECT total_rooms INTO v_capacity
  FROM public.room_types
  WHERE id = v_room_type_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room category does not exist';
  END IF;

  IF NEW.is_active THEN
    SELECT count(*) INTO v_active_count
    FROM public.room_units
    WHERE room_type_id = v_room_type_id
      AND is_active
      AND (TG_OP <> 'UPDATE' OR id IS DISTINCT FROM NEW.id);

    IF v_active_count + 1 > v_capacity THEN
      RAISE EXCEPTION 'Physical room count exceeds this category capacity of %', v_capacity;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_room_units_for_type(
  p_room_type_id uuid,
  p_total_rooms integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_total_rooms < 1 THEN
    RAISE EXCEPTION 'A room type must retain at least one physical room';
  END IF;

  PERFORM 1
  FROM public.room_types
  WHERE id = p_room_type_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room type does not exist';
  END IF;

  SELECT count(DISTINCT a.room_unit_id) INTO v_count
  FROM public.booking_room_assignments a
  JOIN public.bookings b ON b.id = a.booking_id
  JOIN public.room_units u ON u.id = a.room_unit_id
  WHERE u.room_type_id = p_room_type_id
    AND u.is_active
    AND b.status IN ('pending', 'confirmed', 'completed')
    AND b.check_out > current_date;
  IF v_count > p_total_rooms THEN
    RAISE EXCEPTION 'Reassign upcoming stays before reducing the physical room capacity';
  END IF;

  INSERT INTO public.room_units (room_type_id, unit_code)
  SELECT p_room_type_id, 'CH-' || lpad(g.unit_number::text, 3, '0')
  FROM generate_series(1, p_total_rooms) AS g(unit_number)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.room_units existing
    WHERE existing.room_type_id = p_room_type_id
      AND existing.unit_code = 'CH-' || lpad(g.unit_number::text, 3, '0')
  )
  ORDER BY g.unit_number
  LIMIT GREATEST(
    p_total_rooms - (
      SELECT count(*)
      FROM public.room_units existing
      WHERE existing.room_type_id = p_room_type_id
    ),
    0
  );

  WITH ranked AS (
    SELECT u.id,
           row_number() OVER (
             ORDER BY EXISTS (
               SELECT 1
               FROM public.booking_room_assignments a
               JOIN public.bookings b ON b.id = a.booking_id
               WHERE a.room_unit_id = u.id
                 AND b.status IN ('pending', 'confirmed', 'completed')
                 AND b.check_out > current_date
             ) DESC, u.created_at, u.id
           ) AS position
    FROM public.room_units u
    WHERE u.room_type_id = p_room_type_id
  )
  UPDATE public.room_units u
  SET is_active = ranked.position <= p_total_rooms,
      updated_at = now()
  FROM ranked
  WHERE u.id = ranked.id
    AND u.is_active IS DISTINCT FROM (ranked.position <= p_total_rooms);

  SELECT count(*) INTO v_count
  FROM public.room_units
  WHERE room_type_id = p_room_type_id AND is_active;
  IF v_count <> p_total_rooms THEN
    RAISE EXCEPTION 'Physical room count does not match room type capacity';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_room_units_after_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.sync_room_units_for_type(NEW.id, NEW.total_rooms);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS room_units_sync_after_type_change ON public.room_types;
CREATE TRIGGER room_units_sync_after_type_change
AFTER INSERT OR UPDATE OF total_rooms ON public.room_types
FOR EACH ROW EXECUTE FUNCTION public.sync_room_units_after_type_change();

DO $$
DECLARE
  v_room record;
BEGIN
  FOR v_room IN SELECT id, total_rooms FROM public.room_types LOOP
    PERFORM public.sync_room_units_for_type(v_room.id, v_room.total_rooms);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_booking_room_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_unit public.room_units%ROWTYPE;
  v_other_assignments integer;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings WHERE id = NEW.booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.status NOT IN ('pending', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'Only active bookings can have a physical room assigned';
  END IF;

  SELECT * INTO v_unit
  FROM public.room_units WHERE id = NEW.room_unit_id FOR UPDATE;
  IF NOT FOUND OR NOT v_unit.is_active OR v_unit.room_type_id <> v_booking.room_type_id THEN
    RAISE EXCEPTION 'Physical room is inactive or belongs to another room category';
  END IF;

  SELECT count(*) INTO v_other_assignments
  FROM public.booking_room_assignments
  WHERE booking_id = NEW.booking_id
    AND id IS DISTINCT FROM NEW.id;
  IF v_other_assignments >= v_booking.rooms_count THEN
    RAISE EXCEPTION 'Booking already has all required physical rooms assigned';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.booking_room_assignments a
    JOIN public.bookings b ON b.id = a.booking_id
    WHERE a.room_unit_id = NEW.room_unit_id
      AND a.booking_id <> NEW.booking_id
      AND b.status IN ('pending', 'confirmed', 'completed')
      AND b.check_in < v_booking.check_out
      AND v_booking.check_in < b.check_out
  ) THEN
    RAISE EXCEPTION 'Physical room is already assigned during these dates';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.room_unit_availability a
    WHERE a.room_unit_id = NEW.room_unit_id
      AND a.sales_closed
      AND a.date >= v_booking.check_in
      AND a.date < v_booking.check_out
  ) THEN
    RAISE EXCEPTION 'Physical room is blocked for one or more booking dates';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_room_assignment_guard ON public.booking_room_assignments;
CREATE TRIGGER booking_room_assignment_guard
BEFORE INSERT OR UPDATE ON public.booking_room_assignments
FOR EACH ROW EXECUTE FUNCTION public.guard_booking_room_assignment();

CREATE OR REPLACE FUNCTION public.auto_assign_booking_rooms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assigned integer;
  v_needed integer;
  v_unit_id uuid;
BEGIN
  IF NEW.status NOT IN ('pending', 'confirmed', 'completed') THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.room_types
  WHERE id = NEW.room_type_id
  FOR UPDATE;

  SELECT count(*) INTO v_assigned
  FROM public.booking_room_assignments
  WHERE booking_id = NEW.id;
  v_needed := NEW.rooms_count - v_assigned;
  IF v_needed <= 0 THEN
    RETURN NEW;
  END IF;

  FOR v_unit_id IN
    SELECT u.id
    FROM public.room_units u
    WHERE u.room_type_id = NEW.room_type_id
      AND u.is_active
      AND NOT EXISTS (
        SELECT 1
        FROM public.booking_room_assignments a
        JOIN public.bookings b ON b.id = a.booking_id
        WHERE a.room_unit_id = u.id
          AND a.booking_id <> NEW.id
          AND b.status IN ('pending', 'confirmed', 'completed')
          AND b.check_in < NEW.check_out
          AND NEW.check_in < b.check_out
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.room_unit_availability a
        WHERE a.room_unit_id = u.id
          AND a.sales_closed
          AND a.date >= NEW.check_in AND a.date < NEW.check_out
      )
    ORDER BY u.unit_code, u.id
    LIMIT v_needed
    FOR UPDATE
  LOOP
    INSERT INTO public.booking_room_assignments (booking_id, room_unit_id)
    VALUES (NEW.id, v_unit_id);
  END LOOP;

  SELECT count(*) INTO v_assigned
  FROM public.booking_room_assignments
  WHERE booking_id = NEW.id;
  IF v_assigned < NEW.rooms_count THEN
    RAISE EXCEPTION 'Not enough individually available physical rooms for this booking';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_auto_assign_physical_rooms ON public.bookings;
CREATE TRIGGER booking_auto_assign_physical_rooms
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_booking_rooms();

DO $$
DECLARE
  v_booking record;
  v_assigned integer;
  v_needed integer;
  v_unit_id uuid;
BEGIN
  FOR v_booking IN
    SELECT * FROM public.bookings
    WHERE status IN ('pending', 'confirmed', 'completed')
    ORDER BY room_type_id, check_in, created_at, id
  LOOP
    SELECT count(*) INTO v_assigned
    FROM public.booking_room_assignments
    WHERE booking_id = v_booking.id;
    v_needed := v_booking.rooms_count - v_assigned;

    FOR v_unit_id IN
      SELECT u.id
      FROM public.room_units u
      WHERE u.room_type_id = v_booking.room_type_id
        AND u.is_active
        AND NOT EXISTS (
          SELECT 1
          FROM public.booking_room_assignments a
          JOIN public.bookings b ON b.id = a.booking_id
          WHERE a.room_unit_id = u.id
            AND a.booking_id <> v_booking.id
            AND b.status IN ('pending', 'confirmed', 'completed')
            AND b.check_in < v_booking.check_out
            AND v_booking.check_in < b.check_out
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.room_unit_availability a
          WHERE a.room_unit_id = u.id
            AND a.sales_closed
            AND a.date >= v_booking.check_in AND a.date < v_booking.check_out
        )
      ORDER BY u.unit_code, u.id
      LIMIT GREATEST(v_needed, 0)
    LOOP
      INSERT INTO public.booking_room_assignments (booking_id, room_unit_id)
      VALUES (v_booking.id, v_unit_id)
      ON CONFLICT (booking_id, room_unit_id) DO NOTHING;
    END LOOP;

    SELECT count(*) INTO v_assigned
    FROM public.booking_room_assignments
    WHERE booking_id = v_booking.id;
    IF v_assigned < v_booking.rooms_count THEN
      RAISE WARNING 'Booking % could not be fully assigned to physical rooms; resolve its overlapping inventory before accepting new bookings.',
        v_booking.booking_number;
      DELETE FROM public.booking_room_assignments
      WHERE booking_id = v_booking.id;
    END IF;
  END LOOP;
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
  IF p_check_in IS NULL OR p_check_out IS NULL
     OR p_check_out <= p_check_in OR p_check_out > p_check_in + 365
     OR p_rooms_needed IS NULL OR p_rooms_needed < 1 THEN
    RETURN false;
  END IF;

  SELECT total_rooms INTO v_total
  FROM public.room_types WHERE id = p_room_type_id;
  IF v_total IS NULL THEN
    RETURN false;
  END IF;

  FOR v_day IN
    SELECT generate_series(p_check_in, p_check_out - 1, interval '1 day')::date
  LOOP
    SELECT LEAST(v_total, rooms_available) INTO v_cap
    FROM public.room_availability
    WHERE room_type_id = p_room_type_id AND date = v_day;
    v_cap := COALESCE(v_cap, v_total);

    SELECT COALESCE(SUM(rooms_count), 0) INTO v_reserved
    FROM public.bookings
    WHERE room_type_id = p_room_type_id
      AND status IN ('pending', 'confirmed', 'completed')
      AND check_in <= v_day AND check_out > v_day;
    IF v_reserved + p_rooms_needed > v_cap THEN
      RETURN false;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_physical_free
  FROM public.room_units u
  WHERE u.room_type_id = p_room_type_id
    AND u.is_active
    AND NOT EXISTS (
      SELECT 1
      FROM public.booking_room_assignments a
      JOIN public.bookings b ON b.id = a.booking_id
      WHERE a.room_unit_id = u.id
        AND b.status IN ('pending', 'confirmed', 'completed')
        AND b.check_in < p_check_out AND p_check_in < b.check_out
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.room_unit_availability a
      WHERE a.room_unit_id = u.id
        AND a.sales_closed
        AND a.date >= p_check_in AND a.date < p_check_out
    );

  RETURN v_physical_free >= p_rooms_needed;
END;
$$;

REVOKE ALL ON FUNCTION public.check_room_availability(uuid, date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_room_availability(uuid, date, date, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_room_unit(
  p_room_type_id uuid,
  p_unit_code text,
  p_unit_name text DEFAULT NULL
)
RETURNS public.room_units
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_id uuid;
  v_unit public.room_units%ROWTYPE;
  v_active integer;
  v_total integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '28000';
  END IF;
  IF p_unit_code IS NULL OR length(btrim(p_unit_code)) NOT BETWEEN 1 AND 40
     OR (p_unit_name IS NOT NULL AND length(btrim(p_unit_name)) > 100) THEN
    RAISE EXCEPTION 'Numéro ou nom de chambre invalide';
  END IF;

  SELECT r.total_rooms, h.owner_id INTO v_total, v_owner_id
  FROM public.room_types r
  JOIN public.hotels h ON h.id = r.hotel_id
  WHERE r.id = p_room_type_id FOR UPDATE OF r;
  IF NOT FOUND OR (v_owner_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Catégorie introuvable ou accès refusé' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO v_active FROM public.room_units
  WHERE room_type_id = p_room_type_id AND is_active;
  IF v_active >= v_total THEN
    RAISE EXCEPTION 'Augmentez d’abord le nombre de chambres de la catégorie';
  END IF;

  INSERT INTO public.room_units (room_type_id, unit_code, unit_name)
  VALUES (p_room_type_id, btrim(p_unit_code), nullif(btrim(p_unit_name), ''))
  RETURNING * INTO v_unit;
  RETURN v_unit;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_room_unit(p_room_unit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room_type_id uuid;
  v_owner_id uuid;
  v_total integer;
  v_unit_count integer;
  v_last_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '28000';
  END IF;
  SELECT room_type_id INTO v_room_type_id
  FROM public.room_units WHERE id = p_room_unit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chambre introuvable';
  END IF;
  SELECT r.total_rooms, h.owner_id INTO v_total, v_owner_id
  FROM public.room_types r
  JOIN public.hotels h ON h.id = r.hotel_id
  WHERE r.id = v_room_type_id
  FOR UPDATE OF r;
  IF NOT FOUND OR (v_owner_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Chambre introuvable ou accès refusé' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.room_units
  WHERE id = p_room_unit_id AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chambre introuvable ou déjà désactivée';
  END IF;
  IF EXISTS (SELECT 1 FROM public.booking_room_assignments WHERE room_unit_id = p_room_unit_id) THEN
    RAISE EXCEPTION 'Cette chambre possède un historique de réservations et ne peut pas être supprimée';
  END IF;

  SELECT count(*) INTO v_unit_count FROM public.room_units
  WHERE room_type_id = v_room_type_id AND is_active;
  SELECT id INTO v_last_id FROM public.room_units
  WHERE room_type_id = v_room_type_id AND is_active
  ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_unit_count <= 1 OR v_last_id IS DISTINCT FROM p_room_unit_id THEN
    RAISE EXCEPTION 'Réduisez la capacité depuis la catégorie de chambres; seule la dernière unité non utilisée peut être supprimée';
  END IF;

  UPDATE public.room_types
  SET total_rooms = v_total - 1
  WHERE id = v_room_type_id;
  DELETE FROM public.room_units WHERE id = p_room_unit_id;
END;
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
  v_user_id uuid := auth.uid();
  v_room_type_id uuid;
  v_unit public.room_units%ROWTYPE;
  v_owner_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '28000';
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL
     OR p_end_date < p_start_date OR p_end_date > p_start_date + 365
     OR p_start_date < (now() AT TIME ZONE 'UTC')::date
     OR p_close_sales IS NULL THEN
    RAISE EXCEPTION 'Période ou état de fermeture invalide';
  END IF;
  SELECT room_type_id INTO v_room_type_id
  FROM public.room_units WHERE id = p_room_unit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chambre introuvable';
  END IF;
  SELECT h.owner_id INTO v_owner_id
  FROM public.room_types r
  JOIN public.hotels h ON h.id = r.hotel_id
  WHERE r.id = v_room_type_id
  FOR UPDATE OF r;
  IF NOT FOUND OR (v_owner_id IS DISTINCT FROM v_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Chambre introuvable ou accès refusé' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_unit FROM public.room_units
  WHERE id = p_room_unit_id AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chambre introuvable ou déjà désactivée';
  END IF;

  IF p_close_sales AND EXISTS (
    SELECT 1 FROM public.booking_room_assignments a
    JOIN public.bookings b ON b.id = a.booking_id
    WHERE a.room_unit_id = p_room_unit_id
      AND b.status IN ('pending', 'confirmed', 'completed')
      AND b.check_in <= p_end_date
      AND b.check_out > p_start_date
  ) THEN
    RAISE EXCEPTION 'Cette chambre a déjà une réservation active sur la période';
  END IF;

  IF p_close_sales THEN
    INSERT INTO public.room_unit_availability (room_unit_id, date, sales_closed, reason, updated_by, updated_at)
    SELECT p_room_unit_id, d::date, true, nullif(btrim(p_reason), ''), v_user_id, now()
    FROM generate_series(p_start_date, p_end_date, interval '1 day') AS d
    ON CONFLICT (room_unit_id, date) DO UPDATE
    SET sales_closed = true, reason = EXCLUDED.reason,
        updated_by = EXCLUDED.updated_by, updated_at = now();
  ELSE
    DELETE FROM public.room_unit_availability
    WHERE room_unit_id = p_room_unit_id
      AND date BETWEEN p_start_date AND p_end_date;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_room_unit_label(
  p_room_unit_id uuid,
  p_unit_code text,
  p_unit_name text DEFAULT NULL
)
RETURNS public.room_units
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit public.room_units%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '28000';
  END IF;
  IF p_unit_code IS NULL OR length(btrim(p_unit_code)) NOT BETWEEN 1 AND 40
     OR (p_unit_name IS NOT NULL AND length(btrim(p_unit_name)) > 100) THEN
    RAISE EXCEPTION 'Numéro ou nom de chambre invalide';
  END IF;

  UPDATE public.room_units u
  SET unit_code = btrim(p_unit_code),
      unit_name = nullif(btrim(p_unit_name), ''),
      updated_at = now()
  FROM public.room_types r
  JOIN public.hotels h ON h.id = r.hotel_id
  WHERE u.id = p_room_unit_id
    AND r.id = u.room_type_id
    AND (h.owner_id = auth.uid() OR public.is_admin())
  RETURNING u.* INTO v_unit;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chambre introuvable ou accès refusé' USING ERRCODE = '42501';
  END IF;
  RETURN v_unit;
END;
$$;

CREATE OR REPLACE FUNCTION public.reassign_booking_room_unit(
  p_booking_id uuid,
  p_old_room_unit_id uuid,
  p_new_room_unit_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_owner_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO v_booking
  FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Réservation active introuvable';
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.hotels WHERE id = v_booking.hotel_id;
  IF v_owner_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé à cette réservation' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.room_types
  WHERE id = v_booking.room_type_id
  FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM public.booking_room_assignments
    WHERE booking_id = p_booking_id AND room_unit_id = p_old_room_unit_id
  ) THEN
    RAISE EXCEPTION 'Affectation actuelle introuvable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.room_units
    WHERE id = p_new_room_unit_id
      AND room_type_id = v_booking.room_type_id
      AND is_active
  ) THEN
    RAISE EXCEPTION 'La nouvelle chambre ne correspond pas à cette catégorie';
  END IF;

  UPDATE public.booking_room_assignments
  SET room_unit_id = p_new_room_unit_id
  WHERE booking_id = p_booking_id
    AND room_unit_id = p_old_room_unit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_room_units_for_type(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_room_units_after_type_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_booking_room_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_assign_booking_rooms() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_room_unit_sales_status(uuid, date, date, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_room_unit_sales_status(uuid, date, date, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_room_unit(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_room_unit(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_room_unit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_room_unit(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.update_room_unit_label(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_room_unit_label(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.reassign_booking_room_unit(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reassign_booking_room_unit(uuid, uuid, uuid) TO authenticated;

COMMIT;
