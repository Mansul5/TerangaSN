-- TerangaSN V1.2 — création sécurisée de réservations (première version XOF)
-- À exécuter APRÈS le schéma initial et la migration PMS validée.
-- Les demandes pending bloquent le stock jusqu'à confirmation ou annulation.
BEGIN;

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

  -- Verrou commun avec guard_booking_inventory : confirmations sérialisées.
  SELECT * INTO v_room FROM public.room_types
  WHERE id = p_room_type_id FOR UPDATE;
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

  -- Abonnement absent = Standard. Enterprise exige une commission négociée explicite.
  SELECT os.plan_code, COALESCE(os.custom_marketplace_commission_pct, sp.marketplace_commission_pct)
  INTO v_plan, v_commission_pct
  FROM public.owner_subscriptions os
  JOIN public.saas_plans sp ON sp.code = os.plan_code
  WHERE os.owner_id = v_hotel.owner_id AND os.status IN ('active', 'trialing')
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
  FOR v_day IN SELECT generate_series(p_check_in, p_check_out - 1, interval '1 day')::date LOOP
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

  IF v_total > 2147483647 THEN RAISE EXCEPTION 'Montant du séjour trop élevé'; END IF;
  v_commission := round(v_total * v_commission_pct / 100);
  IF v_commission > 2147483647 THEN RAISE EXCEPTION 'Commission trop élevée'; END IF;

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

REVOKE ALL ON FUNCTION public.create_booking(uuid,date,date,integer,integer,integer,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking(uuid,date,date,integer,integer,integer,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid,date,date,integer,integer,integer,text,text,text) TO authenticated;

COMMIT;
