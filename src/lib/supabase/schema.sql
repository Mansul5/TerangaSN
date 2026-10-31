-- TERANGASN V1.2 — Schéma initial sécurisé
-- Destiné à une base public VIDE. Exécuter UNE SEULE FOIS via Supabase SQL Editor.
-- Ne pas exécuter l'ancien schema.sql ni la migration PMS précédente sans adaptation.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email text NOT NULL, full_name text, phone text,
 role text NOT NULL DEFAULT 'traveler' CHECK (role IN ('traveler','owner','admin')),
 avatar_url text, name_changed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.saas_plans (
 code text PRIMARY KEY CHECK (code IN ('standard','business','enterprise')),
 label text NOT NULL, monthly_price_xof integer,
 marketplace_commission_pct numeric(5,2), max_active_lodgings integer,
 max_collaborators integer, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (monthly_price_xof IS NULL OR monthly_price_xof >= 0),
 CHECK (marketplace_commission_pct IS NULL OR marketplace_commission_pct BETWEEN 0 AND 100),
 CHECK (max_active_lodgings IS NULL OR max_active_lodgings >= 1),
 CHECK (max_collaborators IS NULL OR max_collaborators >= 0)
);
INSERT INTO public.saas_plans (code,label,monthly_price_xof,marketplace_commission_pct,max_active_lodgings,max_collaborators) VALUES
 ('standard','Standard',0,12,1,0),('business','Business',39900,0,3,5),('enterprise','Enterprise',NULL,NULL,NULL,NULL);

CREATE TABLE public.owner_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
 plan_code text NOT NULL DEFAULT 'standard' REFERENCES public.saas_plans(code),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('trialing','active','past_due','cancelled','expired')),
 current_period_start timestamptz NOT NULL DEFAULT now(), current_period_end timestamptz,
 custom_marketplace_commission_pct numeric(5,2), custom_max_active_lodgings integer, custom_max_collaborators integer,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (custom_marketplace_commission_pct IS NULL OR custom_marketplace_commission_pct BETWEEN 0 AND 100)
);

CREATE TABLE public.hotels (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 name text NOT NULL, slug text UNIQUE, description text NOT NULL DEFAULT '',
 category text NOT NULL CHECK (category IN ('hotel','lodge','campement','residence','villa','appartement','chambre_hotes')),
 region text NOT NULL, city text NOT NULL, address text NOT NULL,
 latitude double precision, longitude double precision, distance_beach_m integer, distance_center_m integer,
 amenities text[] NOT NULL DEFAULT '{}', photos text[] NOT NULL DEFAULT '{}',
 phone text, email text, check_in_time text NOT NULL DEFAULT '14:00', check_out_time text NOT NULL DEFAULT '12:00',
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected','draft')),
 commission_rate numeric(5,2) NOT NULL DEFAULT 0.12 CHECK (commission_rate BETWEEN 0 AND 1),
 featured boolean NOT NULL DEFAULT false, rating numeric(3,1) NOT NULL DEFAULT 0,
 reviews_count integer NOT NULL DEFAULT 0, min_price integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90), CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX hotels_owner_idx ON public.hotels(owner_id);
CREATE INDEX hotels_public_idx ON public.hotels(status,category,region);

CREATE TABLE public.room_types (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE RESTRICT,
 name text NOT NULL, description text, price_per_night integer NOT NULL CHECK (price_per_night >= 0),
 capacity_adults integer NOT NULL DEFAULT 2 CHECK (capacity_adults >= 1),
 capacity_children integer NOT NULL DEFAULT 0 CHECK (capacity_children >= 0),
 total_rooms integer NOT NULL DEFAULT 1 CHECK (total_rooms >= 1),
 cancellation_policy text NOT NULL DEFAULT 'free_cancellation' CHECK (cancellation_policy IN ('free_cancellation','flexible','non_refundable')),
 breakfast_included boolean NOT NULL DEFAULT false,
 amenities text[] NOT NULL DEFAULT '{}', photos text[] NOT NULL DEFAULT '{}', bed_type text, size_sqm integer,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX room_types_hotel_idx ON public.room_types(hotel_id);

CREATE TABLE public.room_availability (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_type_id uuid NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
 date date NOT NULL, rooms_available integer NOT NULL CHECK (rooms_available >= 0),
 price_override integer CHECK (price_override IS NULL OR price_override >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(room_type_id,date)
);
CREATE INDEX room_availability_date_idx ON public.room_availability(room_type_id,date);

CREATE TABLE public.bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_number text NOT NULL UNIQUE,
 hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE RESTRICT,
 room_type_id uuid NOT NULL REFERENCES public.room_types(id) ON DELETE RESTRICT,
 user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 check_in date NOT NULL, check_out date NOT NULL,
 guests_adults integer NOT NULL DEFAULT 1 CHECK (guests_adults >= 1),
 guests_children integer NOT NULL DEFAULT 0 CHECK (guests_children >= 0),
 rooms_count integer NOT NULL DEFAULT 1 CHECK (rooms_count >= 1),
 nights_count integer NOT NULL CHECK (nights_count >= 1),
 total_price integer NOT NULL CHECK (total_price >= 0), commission_amount integer NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
 guest_name text NOT NULL, guest_email text, guest_phone text NOT NULL, special_requests text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
 payment_status text NOT NULL DEFAULT 'on_site_unpaid' CHECK (payment_status IN ('on_site_unpaid','on_site_paid')),
 booking_source text NOT NULL DEFAULT 'marketplace' CHECK (booking_source IN ('marketplace','direct','manual')),
 manual_channel text CHECK (manual_channel IS NULL OR manual_channel IN ('whatsapp','telephone','sur_place','autre')),
 currency text NOT NULL DEFAULT 'XOF' CHECK (currency IN ('XOF','EUR','USD')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (check_out > check_in), CHECK (nights_count = check_out - check_in)
);
CREATE INDEX bookings_inventory_idx ON public.bookings(room_type_id,check_in,check_out,status);
CREATE INDEX bookings_user_idx ON public.bookings(user_id);
CREATE INDEX bookings_hotel_idx ON public.bookings(hotel_id);

CREATE TABLE public.reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
 rating numeric(3,1) NOT NULL CHECK (rating BETWEEN 1 AND 10),
 cleanliness numeric(3,1) CHECK (cleanliness BETWEEN 1 AND 10),
 comfort numeric(3,1) CHECK (comfort BETWEEN 1 AND 10),
 location numeric(3,1) CHECK (location BETWEEN 1 AND 10),
 staff numeric(3,1) CHECK (staff BETWEEN 1 AND 10),
 comment text NOT NULL, guest_name text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('approved','pending','rejected')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.favorites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,hotel_id)
);

-- SECURITY DEFINER helpers: role cannot be self-assigned through signup metadata or profile updates.
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path = '' AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin') $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.profiles(id,email,full_name,role)
 VALUES (NEW.id,COALESCE(NEW.email,''),COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''),split_part(COALESCE(NEW.email,''),'@',1)),'traveler')
 ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email;
 RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Backfill users who signed up before this schema was created.
INSERT INTO public.profiles(id,email,full_name,role)
SELECT id,COALESCE(email,''),COALESCE(NULLIF(raw_user_meta_data->>'full_name',''),split_part(COALESCE(email,''),'@',1)),'traveler'
FROM auth.users ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION public.guard_profile_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NOT public.is_admin() THEN
   IF NEW.role IS DISTINCT FROM OLD.role OR NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
     RAISE EXCEPTION 'Protected profile fields cannot be modified';
   END IF;
   IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
     IF OLD.name_changed_at IS NOT NULL AND OLD.name_changed_at > now() - interval '30 days' THEN
       RAISE EXCEPTION 'Name can only be changed once every 30 days';
     END IF;
     NEW.name_changed_at := now();
   ELSE
     NEW.name_changed_at := OLD.name_changed_at;
   END IF;
 END IF;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER guard_profile_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

CREATE FUNCTION public.guard_hotel_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NOT public.is_admin() THEN
   IF TG_OP='INSERT' THEN
     NEW.status := 'pending'; NEW.featured := false; NEW.commission_rate := 0.12;
     NEW.rating := 0; NEW.reviews_count := 0; NEW.min_price := 0;
   ELSE
     IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.status IS DISTINCT FROM OLD.status
        OR NEW.featured IS DISTINCT FROM OLD.featured OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
        OR NEW.rating IS DISTINCT FROM OLD.rating OR NEW.reviews_count IS DISTINCT FROM OLD.reviews_count
        OR NEW.min_price IS DISTINCT FROM OLD.min_price THEN
       RAISE EXCEPTION 'Only administration or internal processes may modify protected lodging fields';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_hotel BEFORE INSERT OR UPDATE ON public.hotels FOR EACH ROW EXECUTE FUNCTION public.guard_hotel_update();

-- Booking inventory validation: lock room_type to serialize concurrent bookings.
-- Pending, confirmed, and completed bookings consume inventory.
-- A per-date room_availability row is a saleable CAP, not a decrementing counter.
CREATE FUNCTION public.guard_booking_inventory() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_hotel uuid; v_total integer; v_day date; v_cap integer; v_reserved integer;
BEGIN
 IF NEW.check_out <= NEW.check_in OR NEW.rooms_count < 1 THEN RAISE EXCEPTION 'Invalid booking dates or room count'; END IF;
 IF TG_OP='UPDATE' AND (NEW.hotel_id IS DISTINCT FROM OLD.hotel_id OR NEW.room_type_id IS DISTINCT FROM OLD.room_type_id
     OR NEW.check_in IS DISTINCT FROM OLD.check_in OR NEW.check_out IS DISTINCT FROM OLD.check_out
     OR NEW.rooms_count IS DISTINCT FROM OLD.rooms_count) THEN
   RAISE EXCEPTION 'Change of booking inventory requires a dedicated rescheduling operation';
 END IF;
 SELECT hotel_id,total_rooms INTO v_hotel,v_total FROM public.room_types WHERE id=NEW.room_type_id FOR UPDATE;
 IF NOT FOUND OR v_hotel IS DISTINCT FROM NEW.hotel_id THEN RAISE EXCEPTION 'Room type does not belong to lodging'; END IF;
 IF NEW.status IN ('pending','confirmed','completed') THEN
   FOR v_day IN SELECT generate_series(NEW.check_in,NEW.check_out-1,interval '1 day')::date LOOP
     SELECT LEAST(v_total,rooms_available) INTO v_cap FROM public.room_availability
       WHERE room_type_id=NEW.room_type_id AND date=v_day;
     v_cap := COALESCE(v_cap,v_total);
     SELECT COALESCE(SUM(rooms_count),0) INTO v_reserved FROM public.bookings
       WHERE room_type_id=NEW.room_type_id AND status IN ('pending','confirmed','completed')
       AND check_in <= v_day AND check_out > v_day AND id IS DISTINCT FROM NEW.id;
     IF v_reserved + NEW.rooms_count > v_cap THEN RAISE EXCEPTION 'No inventory available on %',v_day; END IF;
   END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_booking_inventory BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_booking_inventory();

CREATE FUNCTION public.check_room_availability(p_room_type_id uuid,p_check_in date,p_check_out date,p_rooms_needed integer DEFAULT 1)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_total integer; v_day date; v_cap integer; v_reserved integer;
BEGIN
 IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out<=p_check_in
    OR p_check_out>p_check_in+365 OR p_rooms_needed IS NULL OR p_rooms_needed<1 THEN RETURN false; END IF;
 SELECT total_rooms INTO v_total FROM public.room_types WHERE id=p_room_type_id;
 IF v_total IS NULL THEN RETURN false; END IF;
 FOR v_day IN SELECT generate_series(p_check_in,p_check_out-1,interval '1 day')::date LOOP
   SELECT LEAST(v_total,rooms_available) INTO v_cap FROM public.room_availability WHERE room_type_id=p_room_type_id AND date=v_day;
   v_cap:=COALESCE(v_cap,v_total);
   SELECT COALESCE(SUM(rooms_count),0) INTO v_reserved FROM public.bookings
     WHERE room_type_id=p_room_type_id AND status IN ('pending','confirmed','completed') AND check_in<=v_day AND check_out>v_day;
   IF v_reserved+p_rooms_needed>v_cap THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.check_room_availability(uuid,date,date,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_room_availability(uuid,date,date,integer) TO anon,authenticated;

-- Minimal privileges: client may not directly write booking financial fields or inventory.
-- Bookings will be created through a dedicated validated RPC in the next migration.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_self_select ON public.profiles FOR SELECT TO authenticated USING (id=(SELECT auth.uid()) OR public.is_admin());
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (id=(SELECT auth.uid()) OR public.is_admin()) WITH CHECK (id=(SELECT auth.uid()) OR public.is_admin());
CREATE POLICY plans_read ON public.saas_plans FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY subscriptions_owner_read ON public.owner_subscriptions FOR SELECT TO authenticated USING (owner_id=(SELECT auth.uid()) OR public.is_admin());
CREATE POLICY hotels_read ON public.hotels FOR SELECT TO anon,authenticated USING (status='published' OR owner_id=(SELECT auth.uid()) OR public.is_admin());
CREATE POLICY hotels_insert ON public.hotels FOR INSERT TO authenticated WITH CHECK (owner_id=(SELECT auth.uid()));
CREATE POLICY hotels_update ON public.hotels FOR UPDATE TO authenticated USING (owner_id=(SELECT auth.uid()) OR public.is_admin()) WITH CHECK (owner_id=(SELECT auth.uid()) OR public.is_admin());
CREATE POLICY rooms_read ON public.room_types FOR SELECT TO anon,authenticated USING (
 EXISTS(SELECT 1 FROM public.hotels h WHERE h.id=hotel_id AND (h.status='published' OR h.owner_id=(SELECT auth.uid()) OR public.is_admin())));
CREATE POLICY rooms_insert ON public.room_types FOR INSERT TO authenticated WITH CHECK (
 EXISTS(SELECT 1 FROM public.hotels h WHERE h.id=hotel_id AND (h.owner_id=(SELECT auth.uid()) OR public.is_admin())));
CREATE POLICY rooms_update ON public.room_types FOR UPDATE TO authenticated USING (
 EXISTS(SELECT 1 FROM public.hotels h WHERE h.id=hotel_id AND (h.owner_id=(SELECT auth.uid()) OR public.is_admin()))) WITH CHECK (
 EXISTS(SELECT 1 FROM public.hotels h WHERE h.id=hotel_id AND (h.owner_id=(SELECT auth.uid()) OR public.is_admin())));
CREATE POLICY availability_read ON public.room_availability FOR SELECT TO anon,authenticated USING (
 EXISTS(SELECT 1 FROM public.room_types r JOIN public.hotels h ON h.id=r.hotel_id WHERE r.id=room_type_id AND (h.status='published' OR h.owner_id=(SELECT auth.uid()) OR public.is_admin())));
CREATE POLICY bookings_read ON public.bookings FOR SELECT TO authenticated USING (
 user_id=(SELECT auth.uid()) OR public.is_admin() OR EXISTS(SELECT 1 FROM public.hotels h WHERE h.id=hotel_id AND h.owner_id=(SELECT auth.uid())));
CREATE POLICY reviews_read ON public.reviews FOR SELECT TO anon,authenticated USING (status='approved' OR user_id=(SELECT auth.uid()) OR public.is_admin());
CREATE POLICY reviews_insert ON public.reviews FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()) AND status='pending');
CREATE POLICY favorites_self ON public.favorites FOR ALL TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));

-- Sensitive columns are never writable by browser clients.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE(full_name,phone,avatar_url) ON public.profiles TO authenticated;
REVOKE UPDATE ON public.hotels FROM authenticated;
GRANT UPDATE(name,slug,description,category,region,city,address,latitude,longitude,distance_beach_m,distance_center_m,amenities,photos,phone,email,check_in_time,check_out_time) ON public.hotels TO authenticated;
REVOKE INSERT ON public.hotels FROM authenticated;
GRANT INSERT(owner_id,name,slug,description,category,region,city,address,latitude,longitude,distance_beach_m,distance_center_m,amenities,photos,phone,email,check_in_time,check_out_time) ON public.hotels TO authenticated;
REVOKE ALL ON public.owner_subscriptions FROM anon,authenticated;
GRANT SELECT ON public.owner_subscriptions TO authenticated;
REVOKE ALL ON public.bookings FROM anon,authenticated;
GRANT SELECT ON public.bookings TO authenticated;
REVOKE ALL ON public.room_availability FROM anon,authenticated;
GRANT SELECT ON public.room_availability TO anon,authenticated;
-- Review moderation is server/admin-only until dedicated admin RPC is installed.
REVOKE UPDATE,DELETE ON public.reviews FROM authenticated;

-- Private server/admin logic will enforce plan limits and commission source in the next migration.
-- No Storage policy is installed here: uploads must be scoped to owned lodging paths.
COMMIT;
