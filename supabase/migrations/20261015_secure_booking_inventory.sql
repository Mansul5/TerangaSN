-- Pending requests and manual reservations consume the same room inventory.
BEGIN;

ALTER TABLE public.bookings
  ALTER COLUMN guest_email DROP NOT NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS manual_channel text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_manual_channel_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_manual_channel_check
      CHECK (manual_channel IS NULL OR manual_channel IN ('whatsapp', 'telephone', 'sur_place', 'autre'));
  END IF;
END;
$$;

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
  FROM public.room_types
  WHERE id = NEW.room_type_id
  FOR UPDATE;

  IF NOT FOUND OR v_hotel IS DISTINCT FROM NEW.hotel_id THEN
    RAISE EXCEPTION 'Room type does not belong to lodging';
  END IF;

  IF NEW.status IN ('pending', 'confirmed', 'completed') THEN
    FOR v_day IN
      SELECT generate_series(NEW.check_in, NEW.check_out - 1, interval '1 day')::date
    LOOP
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

DROP TRIGGER IF EXISTS guard_booking_inventory ON public.bookings;
CREATE TRIGGER guard_booking_inventory
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_booking_inventory();

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

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_room_availability(uuid, date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_room_availability(uuid, date, date, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pms_guard_booking_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('pending', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'Cancel or archive the booking before deleting it';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS pms_booking_delete_guard ON public.bookings;
CREATE TRIGGER pms_booking_delete_guard
BEFORE DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.pms_guard_booking_delete();

CREATE OR REPLACE FUNCTION public.pms_guard_room_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_peak integer;
BEGIN
  IF NEW.total_rooms = OLD.total_rooms THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(booked), 0) INTO v_peak
  FROM (
    SELECT COALESCE(SUM(b.rooms_count), 0) AS booked
    FROM public.bookings b
    CROSS JOIN LATERAL generate_series(
      b.check_in::timestamp,
      (b.check_out - 1)::timestamp,
      interval '1 day'
    ) AS nights(stay_date)
    WHERE b.room_type_id = NEW.id
      AND b.status IN ('pending', 'confirmed', 'completed')
    GROUP BY nights.stay_date::date
  ) x;

  IF NEW.total_rooms < v_peak THEN
    RAISE EXCEPTION 'Capacity too low: % rooms are already booked for a night', v_peak;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pms_room_capacity_guard ON public.room_types;
CREATE TRIGGER pms_room_capacity_guard
BEFORE UPDATE OF total_rooms ON public.room_types
FOR EACH ROW EXECUTE FUNCTION public.pms_guard_room_capacity();

CREATE OR REPLACE FUNCTION public.pms_guard_calendar_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_total integer;
  v_booked integer;
BEGIN
  SELECT total_rooms INTO v_total
  FROM public.room_types WHERE id = NEW.room_type_id FOR UPDATE;
  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Room type does not exist';
  END IF;
  IF NEW.rooms_available < 0 OR NEW.rooms_available > v_total THEN
    RAISE EXCEPTION 'Calendar capacity must be between zero and the room type capacity';
  END IF;

  SELECT COALESCE(SUM(rooms_count), 0) INTO v_booked
  FROM public.bookings
  WHERE room_type_id = NEW.room_type_id
    AND status IN ('pending', 'confirmed', 'completed')
    AND check_in <= NEW.date AND check_out > NEW.date;
  IF NEW.rooms_available < v_booked THEN
    RAISE EXCEPTION 'Calendar capacity is lower than the number of booked rooms';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pms_calendar_capacity_guard ON public.room_availability;
CREATE TRIGGER pms_calendar_capacity_guard
BEFORE INSERT OR UPDATE OF room_type_id, date, rooms_available ON public.room_availability
FOR EACH ROW EXECUTE FUNCTION public.pms_guard_calendar_capacity();

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

  SELECT * INTO v_room FROM public.room_types
  WHERE id = p_room_type_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Type de chambre introuvable';
  END IF;
  SELECT * INTO v_hotel FROM public.hotels WHERE id = v_room.hotel_id;
  IF NOT FOUND OR v_hotel.status <> 'published' THEN
    RAISE EXCEPTION 'Hébergement indisponible à la réservation';
  END IF;
  IF p_rooms_count > v_room.total_rooms
     OR p_guests_adults > v_room.capacity_adults * p_rooms_count
     OR p_guests_children > v_room.capacity_children * p_rooms_count THEN
    RAISE EXCEPTION 'Capacité du type de chambre dépassée';
  END IF;

  SELECT os.plan_code,
         COALESCE(os.custom_marketplace_commission_pct, sp.marketplace_commission_pct)
  INTO v_plan, v_commission_pct
  FROM public.owner_subscriptions os
  JOIN public.saas_plans sp ON sp.code = os.plan_code
  WHERE os.owner_id = v_hotel.owner_id
    AND os.status IN ('active', 'trialing')
    AND (os.current_period_end IS NULL OR os.current_period_end > now());
  IF NOT FOUND THEN
    v_plan := 'standard';
    SELECT marketplace_commission_pct INTO v_commission_pct
    FROM public.saas_plans WHERE code = 'standard';
  END IF;
  IF v_commission_pct IS NULL THEN
    RAISE EXCEPTION 'Commission Enterprise non configurée';
  END IF;

  v_nights := p_check_out - p_check_in;
  FOR v_day IN
    SELECT generate_series(p_check_in, p_check_out - 1, interval '1 day')::date
  LOOP
    SELECT LEAST(v_room.total_rooms, ra.rooms_available),
           COALESCE(ra.price_override, v_room.price_per_night)
    INTO v_cap, v_night_price
    FROM public.room_availability ra
    WHERE ra.room_type_id = v_room.id AND ra.date = v_day;
    IF NOT FOUND THEN
      v_cap := v_room.total_rooms;
      v_night_price := v_room.price_per_night;
    END IF;

    SELECT COALESCE(sum(b.rooms_count), 0) INTO v_reserved
    FROM public.bookings b
    WHERE b.room_type_id = v_room.id
      AND b.status IN ('pending', 'confirmed', 'completed')
      AND b.check_in <= v_day AND b.check_out > v_day;
    IF v_reserved + p_rooms_count > v_cap THEN
      RAISE EXCEPTION 'Plus assez de chambres disponibles le %', v_day;
    END IF;
    v_total := v_total + v_night_price::bigint * p_rooms_count;
  END LOOP;

  IF v_total > 2147483647 THEN
    RAISE EXCEPTION 'Montant du séjour trop élevé';
  END IF;
  v_commission := round(v_total * v_commission_pct / 100);
  IF v_commission > 2147483647 THEN
    RAISE EXCEPTION 'Commission trop élevée';
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

CREATE OR REPLACE FUNCTION public.create_manual_booking(
  p_hotel_id uuid,
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_rooms_count integer,
  p_guest_name text,
  p_guest_phone text,
  p_guest_email text,
  p_manual_channel text,
  p_total_price integer
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_room public.room_types%ROWTYPE;
  v_day date;
  v_cap integer;
  v_reserved integer;
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.hotels
    WHERE id = p_hotel_id AND owner_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas créer de réservation pour cet hébergement';
  END IF;
  IF p_check_in IS NULL OR p_check_out IS NULL
     OR p_check_in < (now() AT TIME ZONE 'UTC')::date
     OR p_check_out <= p_check_in OR p_check_out > p_check_in + 365 THEN
    RAISE EXCEPTION 'Dates de séjour invalides (maximum 365 nuits)';
  END IF;
  IF p_rooms_count IS NULL OR p_rooms_count < 1 OR p_rooms_count > 20
     OR p_total_price IS NULL OR p_total_price < 0 THEN
    RAISE EXCEPTION 'Nombre de chambres ou montant invalide';
  END IF;
  IF p_guest_name IS NULL OR length(btrim(p_guest_name)) NOT BETWEEN 2 AND 150
     OR p_guest_phone IS NULL OR length(btrim(p_guest_phone)) NOT BETWEEN 5 AND 40
     OR (p_guest_email IS NOT NULL AND length(btrim(p_guest_email)) > 254)
     OR p_manual_channel IS NULL
     OR p_manual_channel NOT IN ('whatsapp', 'telephone', 'sur_place', 'autre') THEN
    RAISE EXCEPTION 'Coordonnées du voyageur ou canal invalide';
  END IF;

  SELECT * INTO v_room FROM public.room_types
  WHERE id = p_room_type_id AND hotel_id = p_hotel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Type de chambre introuvable pour cet hébergement';
  END IF;
  IF p_rooms_count > v_room.total_rooms THEN
    RAISE EXCEPTION 'Nombre de chambres supérieur à la capacité de cette offre';
  END IF;

  FOR v_day IN
    SELECT generate_series(p_check_in, p_check_out - 1, interval '1 day')::date
  LOOP
    SELECT LEAST(v_room.total_rooms, rooms_available) INTO v_cap
    FROM public.room_availability
    WHERE room_type_id = v_room.id AND date = v_day;
    v_cap := COALESCE(v_cap, v_room.total_rooms);

    SELECT COALESCE(sum(b.rooms_count), 0) INTO v_reserved
    FROM public.bookings b
    WHERE b.room_type_id = v_room.id
      AND b.status IN ('pending', 'confirmed', 'completed')
      AND b.check_in <= v_day AND b.check_out > v_day;
    IF v_reserved + p_rooms_count > v_cap THEN
      RAISE EXCEPTION 'Plus assez de chambres disponibles le %', v_day;
    END IF;
  END LOOP;

  INSERT INTO public.bookings (
    booking_number, hotel_id, room_type_id, user_id,
    check_in, check_out, guests_adults, guests_children, rooms_count,
    nights_count, total_price, commission_amount,
    guest_name, guest_email, guest_phone,
    status, payment_status, booking_source, manual_channel, currency
  ) VALUES (
    'TGS-M-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)),
    p_hotel_id, p_room_type_id, NULL,
    p_check_in, p_check_out, 1, 0, p_rooms_count,
    p_check_out - p_check_in, p_total_price, 0,
    btrim(p_guest_name), nullif(btrim(p_guest_email), ''), btrim(p_guest_phone),
    'confirmed', 'on_site_unpaid', 'manual', p_manual_channel, 'XOF'
  ) RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id uuid,
  p_status text,
  p_payment_status text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_owner_id uuid;
  v_is_admin boolean;
  v_is_owner boolean;
  v_is_guest boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '28000';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('pending', 'confirmed', 'cancelled', 'completed') THEN
    RAISE EXCEPTION 'Statut de réservation invalide';
  END IF;
  IF p_payment_status IS NOT NULL AND p_payment_status NOT IN ('on_site_unpaid', 'on_site_paid') THEN
    RAISE EXCEPTION 'Statut de paiement invalide';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.hotels WHERE id = v_booking.hotel_id;
  v_is_admin := COALESCE(public.is_admin(), false);
  v_is_owner := COALESCE(v_owner_id = v_user_id, false);
  v_is_guest := COALESCE(v_booking.user_id = v_user_id, false);

  IF NOT v_is_admin AND NOT v_is_owner AND NOT v_is_guest THEN
    RAISE EXCEPTION 'Accès refusé à cette réservation' USING ERRCODE = '42501';
  END IF;
  IF v_is_guest AND NOT v_is_owner AND NOT v_is_admin THEN
    IF p_status <> 'cancelled'
       OR v_booking.status NOT IN ('pending', 'confirmed')
       OR (v_booking.status = 'confirmed' AND v_booking.check_in <= current_date)
       OR p_payment_status IS NOT NULL THEN
      RAISE EXCEPTION 'Cette réservation ne peut pas être modifiée par le voyageur' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT v_is_admin AND NOT (
      (v_booking.status = 'pending' AND p_status IN ('pending', 'confirmed', 'cancelled'))
      OR (v_booking.status = 'confirmed' AND p_status IN ('confirmed', 'completed', 'cancelled'))
      OR (v_booking.status = 'completed' AND p_status = 'completed')
      OR (v_booking.status = 'cancelled' AND p_status = 'cancelled')
    ) THEN
      RAISE EXCEPTION 'Transition de statut non autorisée';
    END IF;
    IF p_payment_status IS NOT NULL AND v_booking.booking_source <> 'manual' THEN
      RAISE EXCEPTION 'Le paiement de cette réservation ne peut pas être modifié ici';
    END IF;
  END IF;

  UPDATE public.bookings
  SET status = p_status,
      payment_status = COALESCE(p_payment_status, payment_status),
      updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;
  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_manual_booking_payment(
  p_booking_id uuid,
  p_payment_status text
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '28000';
  END IF;
  IF p_payment_status IS NULL OR p_payment_status NOT IN ('on_site_unpaid', 'on_site_paid') THEN
    RAISE EXCEPTION 'Statut de paiement invalide';
  END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings b
  JOIN public.hotels h ON h.id = b.hotel_id
  WHERE b.id = p_booking_id
    AND b.booking_source = 'manual'
    AND (h.owner_id = auth.uid() OR public.is_admin())
  FOR UPDATE OF b;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation manuelle introuvable ou accès refusé' USING ERRCODE = '42501';
  END IF;

  UPDATE public.bookings
  SET payment_status = p_payment_status, updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;
  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(uuid, date, date, integer, integer, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, date, date, integer, integer, integer, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_manual_booking(uuid, uuid, date, date, integer, text, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_booking(uuid, uuid, date, date, integer, text, text, text, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.update_booking_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_booking_status(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.set_manual_booking_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_manual_booking_payment(uuid, text) TO authenticated;

COMMIT;
