export type UserRole = 'traveler' | 'owner' | 'admin';

export type HotelCategory = 'hotel' | 'lodge' | 'campement' | 'residence';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export type CancellationPolicy = 'free_cancellation' | 'flexible' | 'non_refundable';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Hotel {
  id: string;
  owner_id: string;
  name: string;
  slug?: string;
  description: string;
  category: HotelCategory;
  region: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_beach_m: number | null;
  distance_center_m: number | null;
  amenities: string[];
  photos: string[];
  phone: string | null;
  email: string | null;
  check_in_time: string;
  check_out_time: string;
  status: 'pending' | 'published' | 'rejected' | 'draft';
  is_published?: boolean;
  commission_rate: number;
  featured: boolean;
  rating: number;
  reviews_count: number;
  min_price: number;
  created_at: string;
  updated_at?: string;
  // Joined fields
  room_types?: RoomType[];
  owner?: Profile;
}

export interface RoomType {
  id: string;
  hotel_id: string;
  name: string;
  description: string | null;
  price_per_night: number; // in FCFA
  capacity_adults: number;
  capacity_children: number;
  total_rooms: number;
  cancellation_policy: CancellationPolicy;
  breakfast_included?: boolean;
  amenities: string[];
  photos: string[];
  bed_type: string | null;
  size_sqm: number | null;
  created_at: string;
}

export interface RoomAvailability {
  id: string;
  room_type_id: string;
  date: string; // YYYY-MM-DD
  rooms_available: number;
  price_override: number | null; // in FCFA
  created_at?: string;
  updated_at?: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  hotel_id: string;
  room_type_id: string;
  user_id: string | null;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  guests_adults: number;
  guests_children: number;
  rooms_count: number;
  nights_count: number;
  total_price: number; // in FCFA
  commission_amount: number; // in FCFA
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  special_requests: string | null;
  status: BookingStatus;
  payment_status: 'on_site_unpaid' | 'on_site_paid';
  created_at: string;
  updated_at?: string;
  // Joined fields
  hotel?: Hotel;
  room_type?: RoomType;
}

export interface Review {
  id: string;
  hotel_id: string;
  user_id: string;
  booking_id: string | null;
  rating: number;
  cleanliness: number | null;
  comfort: number | null;
  location: number | null;
  staff: number | null;
  comment: string;
  guest_name: string;
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
  // Joined fields
  hotel?: Hotel;
}

export interface Favorite {
  id: string;
  user_id: string;
  hotel_id: string;
  created_at: string;
  hotel?: Hotel;
}

export interface SearchFilters {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  category?: string;
  amenities: string[];
  maxBeachDistance?: number;
  sortBy?: 'recommended' | 'price_asc' | 'price_desc' | 'rating_desc';
}

export const SENEGAL_REGIONS = [
  { id: 'dakar', name: 'Dakar', image: 'https://images.unsplash.com/photo-1577942296181-a67b4478ecf8?auto=format&fit=crop&w=800&q=80', description: 'Capitale vibrante, Almadies, Ngor, Corniche et vie culturelle' },
  { id: 'saly', name: 'Saly / Petite Côte', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80', description: 'Plages de sable fin, stations balnéaires et sports nautiques' },
  { id: 'saint-louis', name: 'Saint-Louis', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', description: 'Ville coloniale historique, jazz, fleuve Sénégal et Langue de Barbarie' },
  { id: 'cap-skirring', name: 'Cap Skirring / Casamance', image: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=800&q=80', description: 'Nature luxuriante, bolongs, traditions diola et plages sauvages' },
  { id: 'sine-saloum', name: 'Sine Saloum', image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80', description: 'Delta majestueux, îles d’oiseaux, pirogues et écolodges paisibles' },
  { id: 'lac-rose', name: 'Lac Rose', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80', description: 'Dunes, ramassage traditionnel de sel et balades en quad' },
  { id: 'goree', name: 'Île de Gorée', image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80', description: 'Île mémoire chargée d’histoire, ruelles fleuries et patrimoine UNESCO' },
] as const;

export const HOTEL_AMENITIES = [
  { id: 'wifi', label: 'Wi-Fi haut débit', icon: 'Wifi' },
  { id: 'pool', label: 'Piscine', icon: 'Waves' },
  { id: 'ac', label: 'Climatisation', icon: 'AirVent' },
  { id: 'breakfast', label: 'Petit-déjeuner inclus', icon: 'Coffee' },
  { id: 'sea_view', label: 'Vue sur la mer', icon: 'Eye' },
  { id: 'parking', label: 'Parking gratuit', icon: 'Car' },
  { id: 'restaurant', label: 'Restaurant sur place', icon: 'Utensils' },
  { id: 'bar', label: 'Bar / Salon', icon: 'Wine' },
  { id: 'spa', label: 'Spa & Bien-être', icon: 'Sparkles' },
  { id: 'generator', label: 'Groupe électrogène / Solaire', icon: 'Zap' },
  { id: 'airport_shuttle', label: 'Navette Aéroport (AIBD)', icon: 'Plane' },
  { id: 'beachfront', label: 'Accès direct plage', icon: 'Sun' },
] as const;
