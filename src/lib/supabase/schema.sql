-- ====================================================================
-- TERANGA BOOKING SÉNÉGAL - SCHÉMA DE BASE DE DONNÉES SUPABASE POSTGRES
-- À exécuter dans le SQL Editor de votre projet Supabase
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE DES PROFILS (Utilisateurs: voyageurs, gérants d'hôtel, admins)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'traveler' CHECK (role IN ('traveler', 'owner', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLE DES HÔTELS / ÉTABLISSEMENTS
CREATE TABLE IF NOT EXISTS public.hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('hotel', 'lodge', 'campement', 'residence')),
  region TEXT NOT NULL, -- Dakar, Saly / Petite Côte, Saint-Louis, Cap Skirring / Casamance, Sine Saloum, Lac Rose, Île de Gorée, etc.
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 14.6928,
  longitude DOUBLE PRECISION NOT NULL DEFAULT -17.4467,
  distance_beach_m INTEGER,
  distance_center_m INTEGER,
  amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  phone TEXT,
  email TEXT,
  check_in_time TEXT DEFAULT '14:00',
  check_out_time TEXT DEFAULT '12:00',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'draft')),
  commission_rate NUMERIC(4,2) DEFAULT 0.10, -- 10% de commission
  featured BOOLEAN DEFAULT FALSE,
  rating NUMERIC(3,1) DEFAULT 0.0,
  reviews_count INTEGER DEFAULT 0,
  min_price INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLE DES TYPES DE CHAMBRES / HÉBERGEMENTS
CREATE TABLE IF NOT EXISTS public.room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_per_night INTEGER NOT NULL, -- Prix en FCFA (XOF)
  capacity_adults INTEGER NOT NULL DEFAULT 2,
  capacity_children INTEGER NOT NULL DEFAULT 1,
  total_rooms INTEGER NOT NULL DEFAULT 1,
  cancellation_policy TEXT NOT NULL DEFAULT 'free_cancellation' CHECK (cancellation_policy IN ('free_cancellation', 'flexible', 'non_refundable')),
  amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  bed_type TEXT,
  size_sqm INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABLE DES RÉSERVATIONS
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT UNIQUE NOT NULL,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  room_type_id UUID REFERENCES public.room_types(id) ON DELETE RESTRICT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests_adults INTEGER NOT NULL DEFAULT 1,
  guests_children INTEGER NOT NULL DEFAULT 0,
  rooms_count INTEGER NOT NULL DEFAULT 1,
  nights_count INTEGER NOT NULL DEFAULT 1,
  total_price INTEGER NOT NULL, -- En FCFA
  commission_amount INTEGER NOT NULL DEFAULT 0, -- En FCFA (calculé sur le total)
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  special_requests TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_status TEXT NOT NULL DEFAULT 'on_site_unpaid' CHECK (payment_status IN ('on_site_unpaid', 'on_site_paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLE DES AVIS CLIENTS
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 10),
  cleanliness NUMERIC(2,1) CHECK (cleanliness >= 1 AND cleanliness <= 10),
  comfort NUMERIC(2,1) CHECK (comfort >= 1 AND comfort <= 10),
  location NUMERIC(2,1) CHECK (location >= 1 AND location <= 10),
  staff NUMERIC(2,1) CHECK (staff >= 1 AND staff <= 10),
  comment TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABLE DES FAVORIS
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, hotel_id)
);

-- ====================================================================
-- FONCTIONS & TRIGGERS
-- ====================================================================

-- Trigger de création automatique du profil lors d'une inscription Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'traveler')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger pour recalculer la note moyenne et le nombre d'avis d'un hôtel
CREATE OR REPLACE FUNCTION public.update_hotel_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.hotels
  SET 
    rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews WHERE hotel_id = NEW.hotel_id AND status = 'approved'), 0),
    reviews_count = (SELECT COUNT(*) FROM public.reviews WHERE hotel_id = NEW.hotel_id AND status = 'approved')
  WHERE id = NEW.hotel_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_changed ON public.reviews;
CREATE TRIGGER on_review_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_hotel_rating();

-- Trigger pour mettre à jour le prix minimum d'un hôtel selon ses types de chambres
CREATE OR REPLACE FUNCTION public.update_hotel_min_price()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.hotels
  SET min_price = COALESCE((SELECT MIN(price_per_night) FROM public.room_types WHERE hotel_id = COALESCE(NEW.hotel_id, OLD.hotel_id)), 0)
  WHERE id = COALESCE(NEW.hotel_id, OLD.hotel_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_room_type_changed ON public.room_types;
CREATE TRIGGER on_room_type_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.room_types
  FOR EACH ROW EXECUTE FUNCTION public.update_hotel_min_price();

-- 8. TABLE DE DISPONIBILITÉ DES CHAMBRES PAR DATE
CREATE TABLE IF NOT EXISTS public.room_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID REFERENCES public.room_types(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  rooms_available INTEGER NOT NULL DEFAULT 1,
  price_override INTEGER, -- En FCFA, nullable (prix spécial haute saison)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_type_id, date)
);

CREATE INDEX IF NOT EXISTS idx_room_availability_date ON public.room_availability(room_type_id, date);

-- 9. FONCTION RPC check_room_availability
CREATE OR REPLACE FUNCTION public.check_room_availability(
  p_room_type_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_rooms_needed INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_min_available INTEGER;
  v_total_rooms INTEGER;
BEGIN
  -- Vérifier d'abord si des entrées existent dans room_availability
  SELECT MIN(rooms_available)
  INTO v_min_available
  FROM public.room_availability
  WHERE room_type_id = p_room_type_id
    AND date >= p_check_in
    AND date < p_check_out;

  -- Si aucune ligne n'a été trouvée (non initialisé), vérifier la capacité par défaut du type de chambre
  IF v_min_available IS NULL THEN
    SELECT total_rooms INTO v_total_rooms FROM public.room_types WHERE id = p_room_type_id;
    RETURN COALESCE(v_total_rooms, 1) >= p_rooms_needed;
  END IF;

  RETURN v_min_available >= p_rooms_needed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. TRIGGER POSTGRES: Décrémentation à la confirmation et réincrémentation à l'annulation
CREATE OR REPLACE FUNCTION public.sync_booking_availability()
RETURNS TRIGGER AS $$
DECLARE
  curr_date DATE;
BEGIN
  -- Cas 1: La réservation passe à 'confirmed'
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed')) THEN
    
    curr_date := NEW.check_in;
    WHILE curr_date < NEW.check_out LOOP
      UPDATE public.room_availability
      SET rooms_available = GREATEST(0, rooms_available - NEW.rooms_count),
          updated_at = NOW()
      WHERE room_type_id = NEW.room_type_id
        AND date = curr_date;
      
      curr_date := curr_date + INTERVAL '1 day';
    END LOOP;
  
  -- Cas 2: La réservation était 'confirmed' et passe à 'cancelled'
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'confirmed') THEN
    
    curr_date := NEW.check_in;
    WHILE curr_date < NEW.check_out LOOP
      UPDATE public.room_availability
      SET rooms_available = rooms_available + NEW.rooms_count,
          updated_at = NOW()
      WHERE room_type_id = NEW.room_type_id
        AND date = curr_date;
      
      curr_date := curr_date + INTERVAL '1 day';
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_booking_status_sync_availability ON public.bookings;
CREATE TRIGGER on_booking_status_sync_availability
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.sync_booking_availability();

-- ====================================================================
-- POLITIQUES ROW LEVEL SECURITY (RLS)
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Hotels
CREATE POLICY "Published hotels are viewable by everyone" ON public.hotels FOR SELECT 
  USING (status = 'published' OR auth.uid() = owner_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Owners can insert hotels" ON public.hotels FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners and admins can update hotels" ON public.hotels FOR UPDATE 
  USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Owners and admins can delete hotels" ON public.hotels FOR DELETE 
  USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Room Types
CREATE POLICY "Room types are viewable by everyone" ON public.room_types FOR SELECT USING (true);
CREATE POLICY "Owners can manage room types" ON public.room_types FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.hotels WHERE id = room_types.hotel_id AND (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))));

-- 4. Room Availability
CREATE POLICY "Room availability is viewable by everyone" ON public.room_availability FOR SELECT USING (true);
CREATE POLICY "Owners can manage room availability" ON public.room_availability FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.room_types rt
    JOIN public.hotels h ON h.id = rt.hotel_id
    WHERE rt.id = room_availability.room_type_id
      AND (h.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  ));

-- 5. Bookings
CREATE POLICY "Travelers can view own bookings" ON public.bookings FOR SELECT 
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.hotels WHERE id = bookings.hotel_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can create a booking" ON public.bookings FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Owners, admins and guests can update booking" ON public.bookings FOR UPDATE 
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.hotels WHERE id = bookings.hotel_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 6. Reviews
CREATE POLICY "Approved reviews are viewable by everyone" ON public.reviews FOR SELECT 
  USING (status = 'approved' OR auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Authenticated users can create reviews" ON public.reviews FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update reviews" ON public.reviews FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR auth.uid() = user_id);

-- 7. Favorites
CREATE POLICY "Users can view and manage own favorites" ON public.favorites FOR ALL 
  USING (auth.uid() = user_id);

-- ====================================================================
-- STORAGE BUCKETS (Pour les photos d'hôtels et de chambres)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hotel-photos', 'hotel-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access to hotel photos" ON storage.objects FOR SELECT USING (bucket_id = 'hotel-photos');
CREATE POLICY "Authenticated upload to hotel photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'hotel-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Owners can update their uploaded photos" ON storage.objects FOR UPDATE USING (bucket_id = 'hotel-photos' AND auth.uid() = owner);
CREATE POLICY "Owners can delete their uploaded photos" ON storage.objects FOR DELETE USING (bucket_id = 'hotel-photos' AND auth.uid() = owner);
