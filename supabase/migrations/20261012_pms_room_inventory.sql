-- TerangaSN V1.2 - Migration PMS compatible avec schema initial corrige (revue)
-- A executer seulement apres installation du schema initial corrige.
-- Ce script ne decremente PAS room_availability : cette table definit une capacite de vente par nuit.
-- Les reservations confirmed/completed sont deja comptees par guard_booking_inventory.
BEGIN;

-- Protege la suppression accidentelle de reservations (notamment via le SQL Editor).
CREATE OR REPLACE FUNCTION public.pms_guard_booking_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status IN ('pending', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'Annuler ou archiver la reservation avant toute suppression';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS pms_booking_delete_guard ON public.bookings;
CREATE TRIGGER pms_booking_delete_guard
BEFORE DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.pms_guard_booking_delete();

-- Les modifications de capacite prennent le meme verrou que la confirmation d'une reservation.
-- Une diminution ne peut pas rendre les reservations qui bloquent le stock impossibles.
CREATE OR REPLACE FUNCTION public.pms_guard_room_capacity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_peak integer;
BEGIN
  IF NEW.total_rooms = OLD.total_rooms THEN RETURN NEW; END IF;
  -- La ligne room_types est verrouillee par l'UPDATE et par guard_booking_inventory.
  SELECT COALESCE(MAX(booked), 0) INTO v_peak
  FROM (
    SELECT COALESCE(SUM(b.rooms_count), 0) AS booked
    FROM public.bookings b
    CROSS JOIN LATERAL generate_series(b.check_in::timestamp, (b.check_out - 1)::timestamp, interval '1 day') AS nights(stay_date)
    WHERE b.room_type_id = NEW.id AND b.status IN ('pending', 'confirmed', 'completed')
    GROUP BY nights.stay_date::date
  ) x;
  IF NEW.total_rooms < v_peak THEN
    RAISE EXCEPTION 'Capacite insuffisante : % chambres deja reservees pour une nuit', v_peak;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pms_room_capacity_guard ON public.room_types;
CREATE TRIGGER pms_room_capacity_guard
BEFORE UPDATE OF total_rooms ON public.room_types
FOR EACH ROW EXECUTE FUNCTION public.pms_guard_room_capacity();

-- Le calendrier ne peut pas etre reduit en dessous des reservations qui bloquent le stock.
CREATE OR REPLACE FUNCTION public.pms_guard_calendar_capacity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_total integer;
  v_booked integer;
BEGIN
  SELECT total_rooms INTO v_total FROM public.room_types WHERE id = NEW.room_type_id FOR UPDATE;
  IF v_total IS NULL THEN RAISE EXCEPTION 'Type de chambre inexistant'; END IF;
  IF NEW.rooms_available < 0 THEN
    RAISE EXCEPTION 'Capacite calendrier negative interdite';
  END IF;
  IF NEW.rooms_available > v_total THEN
    RAISE EXCEPTION 'Capacite calendrier superieure au nombre de chambres';
  END IF;
  SELECT COALESCE(SUM(rooms_count), 0) INTO v_booked
  FROM public.bookings
  WHERE room_type_id = NEW.room_type_id
    AND status IN ('pending', 'confirmed', 'completed')
    AND check_in <= NEW.date AND check_out > NEW.date;
  IF NEW.rooms_available < v_booked THEN
    RAISE EXCEPTION 'Capacite calendrier inferieure aux reservations confirmees';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pms_calendar_capacity_guard ON public.room_availability;
CREATE TRIGGER pms_calendar_capacity_guard
BEFORE INSERT OR UPDATE OF room_type_id, date, rooms_available ON public.room_availability
FOR EACH ROW EXECUTE FUNCTION public.pms_guard_calendar_capacity();

-- Les index du schema initial existent deja. Ne pas dupliquer le trigger de reservation.
COMMIT;
