import React, { useState } from 'react';
import { 
  Database, 
  Check, 
  Copy, 
  ExternalLink, 
  Key, 
  Server, 
  ShieldCheck, 
  X, 
  Sparkles,
  AlertCircle,
  FileCode,
  CheckCircle2
} from 'lucide-react';
import { defaultSupabaseUrl, defaultSupabaseKey, isSupabaseConfigured, saveSupabaseConfig, clearSupabaseConfig } from '@/src/lib/supabase/client';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'status' | 'sql' | 'seed'>('status');
  const [customUrl, setCustomUrl] = useState<string>(
    defaultSupabaseUrl !== 'https://placeholder.supabase.co' ? defaultSupabaseUrl : ''
  );
  const [customKey, setCustomKey] = useState<string>(
    defaultSupabaseKey !== 'placeholder-anon-key' ? defaultSupabaseKey : ''
  );
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [copiedSeed, setCopiedSeed] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl && customKey) {
      saveSupabaseConfig(customUrl, customKey);
    }
  };

  const sqlSchemaCode = `-- 1. TABLE PROFILES
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

-- 2. TABLE HOTELS
CREATE TABLE IF NOT EXISTS public.hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('hotel', 'lodge', 'campement', 'residence')),
  region TEXT NOT NULL,
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
  commission_rate NUMERIC(4,2) DEFAULT 0.10,
  featured BOOLEAN DEFAULT FALSE,
  rating NUMERIC(3,1) DEFAULT 0.0,
  reviews_count INTEGER DEFAULT 0,
  min_price INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLE ROOM_TYPES
CREATE TABLE IF NOT EXISTS public.room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_per_night INTEGER NOT NULL,
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

-- 4. TABLE BOOKINGS
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
  total_price INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  special_requests TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_status TEXT NOT NULL DEFAULT 'on_site_unpaid' CHECK (payment_status IN ('on_site_unpaid', 'on_site_paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABLE REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 10),
  cleanliness NUMERIC(2,1),
  comfort NUMERIC(2,1),
  location NUMERIC(2,1),
  staff NUMERIC(2,1),
  comment TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLE FAVORITES
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, hotel_id)
);

-- ACTIVER RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hotels" ON public.hotels FOR SELECT USING (true);
CREATE POLICY "Public read rooms" ON public.room_types FOR SELECT USING (true);
CREATE POLICY "Public read reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Public insert booking" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read bookings" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Public update bookings" ON public.bookings FOR UPDATE USING (true);
CREATE POLICY "Public profiles" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Public favorites" ON public.favorites FOR ALL USING (true);
`;

  const sqlSeedCode = `-- EXEMPLE DE DONNÉES DE DÉMARRAGE (HÔTELS AU SÉNÉGAL)
-- À exécuter dans votre SQL Editor Supabase pour remplir la base

INSERT INTO public.hotels (id, name, description, category, region, city, address, latitude, longitude, distance_beach_m, distance_center_m, amenities, photos, phone, email, status, featured, rating, reviews_count, min_price)
VALUES 
(
  'a1111111-1111-1111-1111-111111111111',
  'Radisson Blu Hotel Dakar Sea Plaza',
  'Hôtel 5 étoiles face à l''océan Atlantique sur la Corniche Ouest de Dakar. Dispose d''une magnifique piscine à débordement, d''un spa luxueux et de restaurants gastronomiques.',
  'hotel',
  'Dakar',
  'Dakar',
  'Route de la Corniche Ouest, Fann Résidence, Dakar',
  14.6934,
  -17.4715,
  50,
  2500,
  ARRAY['wifi', 'pool', 'ac', 'breakfast', 'sea_view', 'parking', 'restaurant', 'bar', 'spa', 'generator', 'airport_shuttle', 'beachfront'],
  ARRAY[
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80'
  ],
  '+221 33 869 33 33',
  'reservation.dakar@radissonblu.com',
  'published',
  true,
  9.1,
  128,
  135000
),
(
  'b2222222-2222-2222-2222-222222222222',
  'Palm Beach Resort & Spa Saly',
  'Magnifique complexe hôtelier au cœur de Saly Portudal, pieds dans l''eau avec plage privée de sable blanc, cocoteraie et multiples activités nautiques sur la Petite Côte.',
  'hotel',
  'Saly / Petite Côte',
  'Saly Portudal',
  'Boulevard des Cocotiers, Saly',
  14.4412,
  -17.0254,
  0,
  500,
  ARRAY['wifi', 'pool', 'ac', 'breakfast', 'sea_view', 'parking', 'restaurant', 'bar', 'spa', 'generator', 'beachfront'],
  ARRAY[
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80'
  ],
  '+221 33 957 10 11',
  'contact@palmbeachsaly.sn',
  'published',
  true,
  8.8,
  94,
  75000
),
(
  'c3333333-3333-3333-3333-333333333333',
  'Hôtel de la Poste Saint-Louis',
  'Établissement mythique et historique fondé en 1850 au cœur de l''île de Saint-Louis, lieu de séjour légendaire de Jean Mermoz et des pionniers de l''Aéropostale.',
  'hotel',
  'Saint-Louis',
  'Saint-Louis',
  'Place Faidherbe, Île de Saint-Louis',
  16.0245,
  -16.5050,
  800,
  50,
  ARRAY['wifi', 'ac', 'breakfast', 'restaurant', 'bar', 'parking', 'generator'],
  ARRAY[
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80'
  ],
  '+221 33 961 11 18',
  'reception@hotel-laposte.sn',
  'published',
  true,
  8.6,
  62,
  45000
),
(
  'd4444444-4444-4444-4444-444444444444',
  'Écolodge des Bolongs du Saloum',
  'Lodge écologique niché dans le delta du Sine Saloum, cases sur pilotis face aux mangroves, observation des oiseaux et excursions en pirogue traditionnelle.',
  'lodge',
  'Sine Saloum',
  'Toubacouta',
  'Bord des Bolongs, Toubacouta',
  13.7820,
  -16.4850,
  1200,
  300,
  ARRAY['wifi', 'pool', 'breakfast', 'restaurant', 'bar', 'solaire', 'generator'],
  ARRAY[
    'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80'
  ],
  '+221 77 638 90 22',
  'bolongs@saloum-ecolodge.sn',
  'published',
  true,
  9.4,
  45,
  55000
),
(
  'e5555555-5555-5555-5555-555555555555',
  'Campement Touristique Chez Salim Lac Rose',
  'Campement authentique au bord du célèbre Lac Rose (Lac Retba), entre dunes et filaos. Départs d''excursions en quad et découverte de l''extraction du sel.',
  'campement',
  'Lac Rose',
  'Niaga',
  'Rive Nord du Lac Rose, Niaga Peulh',
  14.8385,
  -17.2285,
  600,
  100,
  ARRAY['wifi', 'pool', 'breakfast', 'restaurant', 'parking', 'generator'],
  ARRAY[
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80'
  ],
  '+221 77 637 12 34',
  'salim@lacrose-senegal.com',
  'published',
  false,
  8.3,
  38,
  30000
)
ON CONFLICT (id) DO NOTHING;

-- INSERTION DES TYPES DE CHAMBRES
INSERT INTO public.room_types (hotel_id, name, description, price_per_night, capacity_adults, capacity_children, total_rooms, cancellation_policy, bed_type, size_sqm, amenities)
VALUES 
(
  'a1111111-1111-1111-1111-111111111111',
  'Chambre Standard Supérieure avec Vue Océan',
  'Chambre spacieuse et lumineuse avec balcon privé offrant une vue imprenable sur l''Atlantique.',
  135000,
  2,
  1,
  15,
  'free_cancellation',
  '1 grand lit King Size',
  38,
  ARRAY['wifi', 'ac', 'tv', 'sea_view', 'breakfast']
),
(
  'a1111111-1111-1111-1111-111111111111',
  'Suite Exécutive Prestige',
  'Suite élégante comprenant salon séparé, bain à remous et terrasse panoramique.',
  220000,
  3,
  1,
  6,
  'free_cancellation',
  '1 très grand lit King Size + canapé lit',
  65,
  ARRAY['wifi', 'ac', 'tv', 'sea_view', 'breakfast', 'spa']
),
(
  'b2222222-2222-2222-2222-222222222222',
  'Bungalow Jardin Tropical',
  'Bungalow de charme au milieu d''une végétation luxuriante à 50 mètres de la plage.',
  75000,
  2,
  1,
  20,
  'free_cancellation',
  '1 lit double Queen Size',
  32,
  ARRAY['wifi', 'ac', 'breakfast', 'parking']
),
(
  'c3333333-3333-3333-3333-333333333333',
  'Chambre Historique Jean Mermoz',
  'Chambre d''époque restaurée avec meubles d''art et vue sur le fleuve Sénégal.',
  45000,
  2,
  0,
  10,
  'flexible',
  '1 lit double colonial',
  28,
  ARRAY['wifi', 'ac', 'breakfast']
),
(
  'd4444444-4444-4444-4444-444444444444',
  'Case Traditionnelle sur Pilotis',
  'Case en matériaux naturels au-dessus des eaux du Saloum avec terrasse privative.',
  55000,
  2,
  1,
  8,
  'free_cancellation',
  '1 lit Queen Size moustiquaire',
  35,
  ARRAY['breakfast', 'wifi', 'solaire']
);
`;

  const copyToClipboard = (text: string, isSeed = false) => {
    navigator.clipboard.writeText(text);
    if (isSeed) {
      setCopiedSeed(true);
      setTimeout(() => setCopiedSeed(false), 2000);
    } else {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#2D2A26]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-[#E6E2D3] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#2D2A26] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3F6212]/30 text-[#ECF3E5] flex items-center justify-center border border-[#3F6212]">
              <Database size={22} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg">Configuration Supabase Postgres</h3>
              <p className="text-xs text-[#D1DBC2]">Teranga Booking Sénégal • Auth, Base de données & Stockage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#3D3A36] hover:bg-[#4D4A46] text-[#D1DBC2] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#E6E2D3] bg-[#FAF9F6] px-6 pt-3 gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'status'
                ? 'border-[#3F6212] text-[#3F6212]'
                : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
            }`}
          >
            <Server size={15} />
            <span>État de la connexion</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'sql'
                ? 'border-[#3F6212] text-[#3F6212]'
                : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
            }`}
          >
            <FileCode size={15} />
            <span>Schéma SQL complet</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('seed')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'seed'
                ? 'border-[#3F6212] text-[#3F6212]'
                : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
            }`}
          >
            <Sparkles size={15} />
            <span>Données de test Sénégal</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* TAB 1: Status & Custom URL/Anon Key */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                isSupabaseConfigured
                  ? 'bg-[#ECF3E5] border-[#D1DBC2] text-[#3F6212]'
                  : 'bg-[#F0EDE4] border-[#E6E2D3] text-[#8B5E34]'
              }`}>
                {isSupabaseConfigured ? (
                  <CheckCircle2 className="text-[#3F6212] shrink-0 mt-0.5" size={20} />
                ) : (
                  <AlertCircle className="text-[#8B5E34] shrink-0 mt-0.5" size={20} />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {isSupabaseConfigured 
                      ? 'Projet Supabase connecté et actif' 
                      : 'Projet Supabase en attente de vos identifiants'}
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed text-[#6B6658]">
                    {isSupabaseConfigured 
                      ? 'L’application effectue de vrais appels Supabase (Auth, Postgres, Storage). Vous pouvez créer des réservations, gérer vos hôtels et vos profils.' 
                      : 'Pour connecter votre propre base Supabase, renseignez votre URL de projet et la clé publique anonyme (anon key) ci-dessous ou dans votre fichier .env.local.'}
                  </p>
                </div>
              </div>

              {/* Form to paste custom Supabase credentials */}
              <form onSubmit={handleSaveCredentials} className="bg-[#FAF9F6] p-4 rounded-xl border border-[#E6E2D3] space-y-4">
                <h4 className="font-bold text-sm text-[#2D2A26] flex items-center gap-2">
                  <Key size={16} className="text-[#3F6212]" />
                  <span>Identifiants Supabase</span>
                </h4>

                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full text-xs font-mono px-3 py-2 bg-white border border-[#E6E2D3] rounded-lg outline-none focus:border-[#3F6212]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1">
                    Supabase Anon Public Key
                  </label>
                  <input
                    type="password"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full text-xs font-mono px-3 py-2 bg-white border border-[#E6E2D3] rounded-lg outline-none focus:border-[#3F6212]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={clearSupabaseConfig}
                    className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                  >
                    Réinitialiser
                  </button>
                  <button
                    type="submit"
                    className="bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    Enregistrer et recharger
                  </button>
                </div>
              </form>

              <div className="text-xs text-[#6B6658] space-y-1">
                <p>💡 <span className="font-semibold">Conseil:</span> Ouvrez votre tableau de bord Supabase sur <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-[#3F6212] underline font-semibold">supabase.com</a>, allez dans <span className="font-bold">Project Settings &gt; API</span> pour récupérer ces clés.</p>
              </div>
            </div>
          )}

          {/* TAB 2: Full SQL Schema */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#2D2A26]">Schéma SQL complet pour Supabase</h4>
                  <p className="text-xs text-[#6B6658]">Copiez ce script et collez-le dans le <b>SQL Editor</b> de votre Supabase</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(sqlSchemaCode, false)}
                  className="bg-[#3F6212] hover:bg-[#365314] text-white text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check size={14} className="text-[#ECF3E5]" />
                      <span>Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copier le script SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative bg-[#2D2A26] text-[#E6E2D3] p-4 rounded-xl font-mono text-xs max-h-96 overflow-y-auto border border-[#4D4A46]">
                <pre className="whitespace-pre-wrap">{sqlSchemaCode}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: Seed Data */}
          {activeTab === 'seed' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#2D2A26]">Données de départ au Sénégal</h4>
                  <p className="text-xs text-[#6B6658]">Ajoute 5 hôtels réels (Dakar, Saly, Saint-Louis, Sine Saloum, Lac Rose)</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(sqlSeedCode, true)}
                  className="bg-[#8B5E34] hover:bg-[#724B28] text-white text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {copiedSeed ? (
                    <>
                      <Check size={14} className="text-[#F0EDE4]" />
                      <span>Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copier les données</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative bg-[#2D2A26] text-[#E6E2D3] p-4 rounded-xl font-mono text-xs max-h-96 overflow-y-auto border border-[#4D4A46]">
                <pre className="whitespace-pre-wrap">{sqlSeedCode}</pre>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-[#FAF9F6] border-t border-[#E6E2D3] px-6 py-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#F0EDE4] hover:bg-[#E6E2D3] text-[#2D2A26] rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
