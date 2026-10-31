import { supabase } from './client';

import {
  Lodging,
  RoomType,
  RoomAvailability,
  Booking,
  Review,
  SearchFilters,
  Favorite,
  BookingStatus,
} from '@/src/types';

/**
 * Fetch lodgings with search query and filters.
 *
 * NOTE:
 * The database table is still named `hotels` for now.
 * The migration to a generic `lodgings` table will be handled separately.
 */
export async function fetchHotels(
  filters?: Partial<SearchFilters>
): Promise<{ data: Lodging[]; count: number; error: any }> {
  try {
    let query = supabase
      .from('hotels')
      .select('*, room_types(*)', { count: 'exact' })
      .eq('status', 'published');

    if (
      filters?.destination &&
      filters.destination !== 'all' &&
      filters.destination.trim() !== ''
    ) {
      const dest = filters.destination.toLowerCase().trim();

      // Search matching region, city, or lodging name
      query = query.or(
        `region.ilike.%${dest}%,city.ilike.%${dest}%,name.ilike.%${dest}%`
      );
    }

    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    if (filters?.minPrice && filters.minPrice > 0) {
      query = query.gte('min_price', filters.minPrice);
    }

    if (filters?.maxPrice && filters.maxPrice < 1000000) {
      query = query.lte('min_price', filters.maxPrice);
    }

    if (filters?.minRating && filters.minRating > 0) {
      query = query.gte('rating', filters.minRating);
    }

    if (filters?.maxBeachDistance && filters.maxBeachDistance > 0) {
      query = query.lte(
        'distance_beach_m',
        filters.maxBeachDistance
      );
    }

    // Amenities filtering
    if (filters?.amenities && filters.amenities.length > 0) {
      query = query.contains('amenities', filters.amenities);
    }

    // Sorting
    switch (filters?.sortBy) {
      case 'price_asc':
        query = query.order('min_price', { ascending: true });
        break;

      case 'price_desc':
        query = query.order('min_price', { ascending: false });
        break;

      case 'rating_desc':
        query = query.order('rating', { ascending: false });
        break;

      case 'recommended':
      default:
        query = query
          .order('featured', { ascending: false })
          .order('rating', { ascending: false });
        break;
    }

    const { data, error, count } = await query;

    if (error) {
      console.warn('Supabase fetchHotels error:', error.message);

      return {
        data: [],
        count: 0,
        error,
      };
    }

    return {
      data: (data as Lodging[]) || [],
      count: count || 0,
      error: null,
    };
  } catch (err) {
    console.error('fetchHotels exception:', err);

    return {
      data: [],
      count: 0,
      error: err,
    };
  }
}

/**
 * Fetch a single lodging by ID including room types and owner.
 *
 * Kept under the existing function name for compatibility.
 */
export async function fetchHotelById(
  id: string
): Promise<{ data: Lodging | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select(
        '*, room_types(*), owner:profiles(id, full_name, email, phone)'
      )
      .eq('id', id)
      .single();

    if (error) {
      return {
        data: null,
        error,
      };
    }

    return {
      data: data as Lodging,
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err,
    };
  }
}

/**
 * Fetch featured offers / "offres du moment".
 */
export async function fetchFeaturedHotels(): Promise<{
  data: Lodging[];
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('*, room_types(*)')
      .eq('status', 'published')
      .order('featured', { ascending: false })
      .order('rating', { ascending: false })
      .limit(6);

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as Lodging[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * Fetch lodging counts grouped by region in Senegal.
 */
export async function fetchRegionCounts(): Promise<{
  [regionName: string]: number;
}> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('region')
      .eq('status', 'published');

    if (error || !data) {
      return {};
    }

    const counts: { [regionName: string]: number } = {};

    data.forEach((item) => {
      const reg = item.region;
      counts[reg] = (counts[reg] || 0) + 1;
    });

    return counts;
  } catch {
    return {};
  }
}

/**
 * Fetch room types for a specific lodging.
 *
 * The database still uses `hotel_id` for now.
 */
export async function fetchHotelRooms(
  hotelId: string
): Promise<{ data: RoomType[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('room_types')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('price_per_night', { ascending: true });

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as RoomType[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * Fetch reviews for a specific lodging.
 *
 * The database still uses `hotel_id` for now.
 */
export async function fetchHotelReviews(
  hotelId: string
): Promise<{ data: Review[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as Review[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * Create a pending marketplace booking using the secured Supabase RPC.
 * The server validates inventory, calculates XOF pricing and commission,
 * and derives the authenticated user's identity. Client financial fields
 * are intentionally ignored.
 */
export async function createBooking(
  booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: Booking | null; error: any }> {
  try {
    const { data: created, error } = await supabase.rpc('create_booking', {
      p_room_type_id: booking.room_type_id,
      p_check_in: booking.check_in,
      p_check_out: booking.check_out,
      p_guests_adults: booking.guests_adults,
      p_guests_children: booking.guests_children ?? 0,
      p_rooms_count: booking.rooms_count ?? 1,
      p_guest_name: booking.guest_name,
      p_guest_phone: booking.guest_phone,
      p_special_requests: booking.special_requests ?? null,
    });

    if (error) throw error;
    if (!created?.id) throw new Error('Réservation créée sans identifiant retourné.');

    // Preserve the relational shape expected by existing booking screens.
    // The booking itself is already committed even if this optional read fails.
    const { data: enriched, error: readError } = await supabase
      .from('bookings')
      .select(
        '*, hotel:hotels(name, region, city, address, photos, phone, email), room_type:room_types(name, bed_type, price_per_night)'
      )
      .eq('id', created.id)
      .single();

    if (readError) {
      console.warn('Booking created; details could not be loaded:', readError.message);
    }

    return { data: (enriched ?? created) as Booking, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Fetch user's bookings (Traveler Dashboard).
 *
 * cancellation_policy is included because the traveler dashboard
 * needs it to determine whether a confirmed booking can be cancelled.
 */
export async function fetchUserBookings(
  userId: string
): Promise<{ data: Booking[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(
        '*, hotel:hotels(id, name, region, city, photos, address, phone), room_type:room_types(name, bed_type, price_per_night, cancellation_policy)'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as Booking[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * Fetch user's favorites.
 */
export async function fetchUserFavorites(
  userId: string
): Promise<{ data: Favorite[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('*, hotel:hotels(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as Favorite[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * Toggle favorite for a lodging.
 *
 * The database still uses `hotel_id` for now.
 */
export async function toggleFavorite(
  userId: string,
  hotelId: string
): Promise<{ isFavorite: boolean; error: any }> {
  try {
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('hotel_id', hotelId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', existing.id);

      if (error) {
        throw error;
      }

      return {
        isFavorite: false,
        error: null,
      };
    }

    const { error } = await supabase
      .from('favorites')
      .insert({
        user_id: userId,
        hotel_id: hotelId,
      });

    if (error) {
      throw error;
    }

    return {
      isFavorite: true,
      error: null,
    };
  } catch (err: any) {
    return {
      isFavorite: false,
      error: err,
    };
  }
}

/**
 * Submit a customer review.
 */
export async function submitReview(review: {
  hotel_id: string;
  user_id: string;
  rating: number;
  cleanliness?: number;
  comfort?: number;
  location?: number;
  staff?: number;
  comment: string;
  guest_name: string;
  booking_id?: string;
}): Promise<{ data: Review | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        ...review,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: data as Review,
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err,
    };
  }
}

/**
 * OWNER BACK-OFFICE:
 * Fetch lodgings managed by the current user.
 */
export async function fetchOwnerHotels(
  ownerId: string
): Promise<{ data: Lodging[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('*, room_types(*)')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as Lodging[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * OWNER BACK-OFFICE:
 * Fetch bookings received across owner's lodgings.
 */
export async function fetchOwnerBookings(
  ownerId: string
): Promise<{ data: Booking[]; error: any }> {
  try {
    // First fetch lodging IDs of this owner
    const { data: ownerHotels, error: hError } = await supabase
      .from('hotels')
      .select('id')
      .eq('owner_id', ownerId);

    if (
      hError ||
      !ownerHotels ||
      ownerHotels.length === 0
    ) {
      return {
        data: [],
        error: hError,
      };
    }

    const hotelIds = ownerHotels.map((h) => h.id);

    const { data, error } = await supabase
      .from('bookings')
      .select(
        '*, hotel:hotels(name, region, city), room_type:room_types(name, price_per_night)'
      )
      .in('hotel_id', hotelIds)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as Booking[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * Update booking status.
 *
 * IMPORTANT:
 * The server validates access and the inventory trigger serializes status
 * changes. Availability is derived from active bookings, not decremented.
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  paymentStatus?: 'on_site_unpaid' | 'on_site_paid'
): Promise<{ error: any }> {
  try {
    const { error } = await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_status: status,
      p_payment_status: paymentStatus ?? null,
    });

    if (error) {
      throw error;
    }

    return {
      error: null,
    };
  } catch (err) {
    return {
      error: err,
    };
  }
}

/**
 * Déclare le paiement d'une réservation manuelle.
 * Les droits d'accès sont vérifiés côté Supabase.
 */
export async function setManualBookingPayment(
  bookingId: string,
  paymentStatus: 'on_site_paid' | 'on_site_unpaid'
): Promise<{ error: any }> {
  try {
    const { error } = await supabase.rpc('set_manual_booking_payment', {
      p_booking_id: bookingId,
      p_payment_status: paymentStatus,
    });
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Publication status is never accepted from ordinary lodging edit forms.
 * The server-side guard/RLS remain authoritative for permissions.
 */
function omitPublicationFields(input: Partial<Lodging>): Partial<Lodging> {
  const { status: _status, is_published: _isPublished, id: _id, owner_id: _ownerId, ...editable } = input;
  return editable;
}

/**
 * Submit an existing draft or rejected lodging for administrative review.
 * The database must validate ownership, status transition and completeness.
 * A missing/denied update is not treated as success.
 */
export async function submitHotelForReview(
  hotelId: string
): Promise<{ data: Lodging | null; error: any }> {
  try {
    if (!hotelId) throw new Error('Établissement manquant.');
    const { data, error } = await supabase
      .from('hotels')
      .update({ status: 'pending' })
      .eq('id', hotelId)
      .in('status', ['draft', 'rejected'])
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Soumission impossible : établissement introuvable, statut incompatible ou accès refusé.');
    return { data: data as Lodging, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Create or update lodging.
 *
 * Kept under the existing function name for compatibility.
 */
export async function saveHotel(
  hotelData: Partial<Lodging>
): Promise<{ data: Lodging | null; error: any }> {
  try {
    if (hotelData.id) {
      const { data, error } = await supabase
        .from('hotels')
        .update({
          ...omitPublicationFields(hotelData),
          updated_at: new Date().toISOString(),
        })
        .eq('id', hotelData.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        data: data as Lodging,
        error: null,
      };
    }

    const { data, error } = await supabase
      .from('hotels')
      .insert({
        ...omitPublicationFields(hotelData),
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: data as Lodging,
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err,
    };
  }
}

/**
 * Create or update room type.
 */
export async function saveRoomType(
  roomData: Partial<RoomType>
): Promise<{ data: RoomType | null; error: any }> {
  try {
    if (roomData.id) {
      const { data, error } = await supabase
        .from('room_types')
        .update(roomData)
        .eq('id', roomData.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        data: data as RoomType,
        error: null,
      };
    }

    const { data, error } = await supabase
      .from('room_types')
      .insert(roomData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: data as RoomType,
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err,
    };
  }
}

/**
 * Delete room type.
 */
export async function deleteRoomType(
  roomId: string
): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('room_types')
      .delete()
      .eq('id', roomId);

    return {
      error,
    };
  } catch (err) {
    return {
      error: err,
    };
  }
}

/**
 * ADMIN:
 * Fetch all lodgings (pending, published, rejected).
 */
export async function fetchAllHotelsAdmin(): Promise<{
  data: Lodging[];
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('*, owner:profiles(full_name, email, phone)')
      .order('created_at', { ascending: false });

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as Lodging[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * ADMIN: Retrieve a complete lodging dossier for review.
 * The database RLS policies determine which records the admin may read.
 * Legal documents are not assumed to exist in this query.
 */
export async function fetchHotelReviewDossier(
  hotelId: string
): Promise<{ data: Lodging | null; error: any }> {
  try {
    if (!hotelId) throw new Error('Identifiant d’établissement manquant.');
    const { data, error } = await supabase
      .from('hotels')
      .select('*, room_types(*), owner:profiles(id, full_name, email, phone)')
      .eq('id', hotelId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Dossier introuvable ou accès non autorisé.');
    return { data: data as Lodging, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * ADMIN: Approve a pending dossier without publishing it.
 * Review metadata is populated by guard_hotel_update() in PostgreSQL.
 */
export async function approveHotelDossier(
  hotelId: string
): Promise<{ error: any }> {
  try {
    if (!hotelId) throw new Error('Identifiant d’établissement manquant.');
    const { data, error } = await supabase
      .from('hotels')
      .update({ status: 'approved' })
      .eq('id', hotelId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Approbation impossible : dossier introuvable, déjà traité ou accès refusé.');
    return { error: null };
  } catch (error) {
    return { error };
  }
}

/**
 * ADMIN: Reject a pending dossier with a mandatory explanation.
 * The PostgreSQL trigger remains authoritative for all status transitions.
 */
export async function rejectHotelDossier(
  hotelId: string,
  reason: string
): Promise<{ error: any }> {
  try {
    if (!hotelId) throw new Error('Identifiant d’établissement manquant.');
    const trimmedReason = reason?.trim();
    if (!trimmedReason) throw new Error('Un motif de rejet est obligatoire.');
    const { data, error } = await supabase
      .from('hotels')
      .update({ status: 'rejected', rejection_reason: trimmedReason })
      .eq('id', hotelId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Rejet impossible : dossier introuvable, déjà traité ou accès refusé.');
    return { error: null };
  } catch (error) {
    return { error };
  }
}

/**
 * Compatibility for existing dashboard calls. Publication by an admin is
 * forbidden; only the owner may publish an approved establishment.
 * Replace old dashboard actions with approveHotelDossier/rejectHotelDossier.
 */
export async function updateHotelStatus(
  _hotelId: string,
  _status: 'published' | 'rejected' | 'pending'
): Promise<{ error: any }> {
  return {
    error: new Error('Action administrative obsolète : utilisez l’examen du dossier (approbation ou rejet motivé). La publication appartient à l’hébergeur.'),
  };
}

/**
 * ADMIN:
 * Fetch all reviews for moderation.
 */
export async function fetchAllReviewsAdmin(): Promise<{
  data: Review[];
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, hotel:hotels(name, region)')
      .order('created_at', { ascending: false });

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as Review[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * ADMIN:
 * Update review moderation status.
 */
export async function updateReviewStatus(
  reviewId: string,
  status: 'approved' | 'rejected' | 'pending'
): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({ status })
      .eq('id', reviewId);

    return {
      error,
    };
  } catch (err) {
    return {
      error: err,
    };
  }
}

/**
 * STORAGE:
 * Upload photo to Supabase Storage bucket `lodging-photos`.
 *
 * Files are organized by lodging UUID.
 */
export async function uploadHotelPhoto(
  file: File,
  folder: string = 'hotels'
): Promise<{ url: string | null; error: any }> {
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Format non accepté. Utilisez une image JPEG, PNG ou WebP.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Chaque image doit faire 10 Mo maximum.');
    }

    const fileExt = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }[file.type];
    if (!fileExt) throw new Error('Format d’image non pris en charge.');

    const fileName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('lodging-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from('lodging-photos')
      .getPublicUrl(fileName);

    return {
      url: publicUrlData.publicUrl,
      error: null,
    };
  } catch (err: any) {
    return {
      url: null,
      error: err,
    };
  }
}

/**
 * Fetch bookings for a specific lodging.
 */
export async function fetchHotelBookings(
  hotelId: string
): Promise<{ data: Booking[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(
        '*, hotel:hotels(name, region, city), room_type:room_types(name, price_per_night)'
      )
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as Booking[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * Create a new lodging.
 *
 * Kept under the existing function name for compatibility.
 */
export async function createHotel(
  hotel: Partial<Lodging>
): Promise<{ data: Lodging | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .insert({
        ...omitPublicationFields(hotel),
        // Creation is not submission: the owner completes the dossier first.
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: data as Lodging,
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err,
    };
  }
}

/**
 * Update an existing lodging.
 */
export async function updateHotel(
  hotelId: string,
  updates: Partial<Lodging>
): Promise<{ data: Lodging | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .update({
        ...omitPublicationFields(updates),
        updated_at: new Date().toISOString(),
      })
      .eq('id', hotelId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: data as Lodging,
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err,
    };
  }
}

/**
 * Delete a lodging.
 */
export async function deleteHotel(
  hotelId: string
): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('hotels')
      .delete()
      .eq('id', hotelId);

    return {
      error,
    };
  } catch (err) {
    return {
      error: err,
    };
  }
}

/**
 * Create a room type and automatically populate
 * 365 days of availability.
 */
export async function createRoomType(
  room: Partial<RoomType>
): Promise<{ data: RoomType | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('room_types')
      .insert(room)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Automatically generate rows in room_availability
    // for the next 365 days.
    if (data && data.id) {
      await populateRoomAvailability(
        data.id,
        data.total_rooms || 1,
        365
      );
    }

    return {
      data: data as RoomType,
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err,
    };
  }
}

// ====================================================================
// ROOM AVAILABILITY & DYNAMIC PRICING ENGINE
// ====================================================================

/**
 * 1. Automatically populate room_availability for the next N days.
 */
export async function populateRoomAvailability(
  roomTypeId: string,
  totalRooms: number = 1,
  daysAhead: number = 365
): Promise<{ success: boolean; count: number; error: any }> {
  try {
    if (
      !roomTypeId ||
      !Number.isInteger(totalRooms) ||
      totalRooms < 0 ||
      !Number.isInteger(daysAhead) ||
      daysAhead < 1 ||
      daysAhead > 730
    ) {
      throw new Error("Paramètres d'initialisation invalides.");
    }

    const today = new Date();
    const start = Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const rows = Array.from({ length: daysAhead }, (_, i) => ({
      room_type_id: roomTypeId,
      date: new Date(start + i * 86400000).toISOString().slice(0, 10),
      rooms_available: totalRooms,
      price_override: null as number | null,
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase
        .from('room_availability')
        .upsert(rows.slice(i, i + 100), {
          onConflict: 'room_type_id,date',
          ignoreDuplicates: true,
        });

      if (error) throw error;
    }

    return { success: true, count: rows.length, error: null };
  } catch (err: any) {
    console.error('populateRoomAvailability error:', err);
    return { success: false, count: 0, error: err };
  }
}

/**
 * 2. Fetch room availability records for a date range.
 */
export async function fetchRoomAvailability(
  roomTypeId: string,
  startDate: string,
  endDate: string
): Promise<{ data: RoomAvailability[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('room_availability')
      .select('*')
      .eq('room_type_id', roomTypeId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.warn(
        'fetchRoomAvailability error:',
        error
      );

      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as RoomAvailability[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * 3. Fetch availability for multiple room types
 * across a date range.
 */
export async function fetchMultipleRoomsAvailability(
  roomTypeIds: string[],
  startDate: string,
  endDate: string
): Promise<{ data: RoomAvailability[]; error: any }> {
  try {
    if (!roomTypeIds || roomTypeIds.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    const { data, error } = await supabase
      .from('room_availability')
      .select('*')
      .in('room_type_id', roomTypeIds)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      return {
        data: [],
        error,
      };
    }

    return {
      data: (data as RoomAvailability[]) || [],
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err,
    };
  }
}

/**
 * 4. Update single date availability / price override.
 */
export async function updateSingleDateAvailability(
  roomTypeId: string,
  date: string,
  roomsAvailable: number,
  priceOverride: number | null
): Promise<{ error: any }> {
  try {
    // The existing UI supplies both values. Compare with the current row so
    // a price-only edit does not accidentally turn auto inventory into manual.
    const { data: current, error: readError } = await supabase
      .from('room_availability')
      .select('rooms_available, price_override')
      .eq('room_type_id', roomTypeId)
      .eq('date', date)
      .maybeSingle();

    if (readError) throw readError;

    const options: { roomsAvailable?: number; priceOverride?: number | null } = {};
    if (!current || Number(current.rooms_available) !== roomsAvailable) {
      options.roomsAvailable = roomsAvailable;
    }
    if (!current || current.price_override !== priceOverride) {
      options.priceOverride = priceOverride;
    }
    if (!Object.keys(options).length) return { error: null };

    const result = await updateDateRangeAvailability(roomTypeId, date, date, options);
    return { error: result.error };
  } catch (error) {
    return { error };
  }
}

/**
 * 5. Update a date range in one atomic database transaction.
 * Omitting a field preserves its current value; null price clears the override.
 */
export async function updateDateRangeAvailability(
  roomTypeId: string,
  startDate: string,
  endDate: string,
  options: { roomsAvailable?: number; priceOverride?: number | null }
): Promise<{ success: boolean; count: number; error: any }> {
  try {
    if (!roomTypeId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
      throw new Error('Chambre ou dates invalides.');
    }
    if (options.roomsAvailable !== undefined &&
        (!Number.isInteger(options.roomsAvailable) || options.roomsAvailable < 0)) {
      throw new Error('Capacité de vente invalide.');
    }
    if (options.priceOverride !== undefined && options.priceOverride !== null &&
        (!Number.isFinite(options.priceOverride) || options.priceOverride <= 0)) {
      throw new Error('Tarif spécial invalide.');
    }
    if (options.roomsAvailable === undefined && options.priceOverride === undefined) {
      throw new Error('Aucune modification demandée.');
    }
    const { data, error } = await supabase.rpc('update_room_calendar_range', {
      p_room_type_id: roomTypeId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_rooms_available: options.roomsAvailable ?? null,
      p_price_override: options.priceOverride ?? null,
      p_update_price: options.priceOverride !== undefined,
    });
    if (error) throw error;
    return { success: true, count: Number(data) || 0, error: null };
  } catch (err: any) {
    return { success: false, count: 0, error: err };
  }
}

/**
 * 6. Check availability through the authoritative database RPC.
 * Never infer availability from raw calendar rows or a default capacity:
 * those values can omit bookings, closed sales and inventory locks.
 * If verification fails, fail closed and return the error.
 */
export async function checkRoomAvailabilityRPC(
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  roomsNeeded: number = 1
): Promise<{
  isAvailable: boolean;
  minAvailable: number;
  error: any;
}> {
  try {
    if (
      !roomTypeId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) ||
      checkOut <= checkIn ||
      !Number.isInteger(roomsNeeded) ||
      roomsNeeded < 1
    ) {
      throw new Error('Paramètres de disponibilité invalides.');
    }

    const { data, error } = await supabase.rpc('check_room_availability', {
      p_room_type_id: roomTypeId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_rooms_needed: roomsNeeded,
    });

    if (error) throw error;
    if (typeof data !== 'boolean') {
      throw new Error('Réponse de disponibilité inattendue.');
    }

    return {
      isAvailable: data,
      minAvailable: data ? roomsNeeded : 0,
      error: null,
    };
  } catch (error) {
    console.error('checkRoomAvailabilityRPC error:', error);
    return { isAvailable: false, minAvailable: 0, error };
  }
}

/**
 * 7. Calculate stay pricing including
 * date-specific price overrides.
 */
export async function calculateStayPricing(
  roomType: RoomType,
  checkIn: string,
  checkOut: string,
  roomsCount: number = 1
): Promise<{
  totalPrice: number;
  averageNightlyPrice: number;
  nightsCount: number;
  hasSpecialRates: boolean;
  minAvailable: number;
  nightlyBreakdown: {
    date: string;
    price: number;
    isOverride: boolean;
    roomsAvailable: number;
  }[];
}> {
  try {
    const { data } = await supabase
      .from('room_availability')
      .select(
        'date, rooms_available, price_override'
      )
      .eq('room_type_id', roomType.id)
      .gte('date', checkIn)
      .lt('date', checkOut)
      .order('date', {
        ascending: true,
      });

    const availMap = new Map<
      string,
      {
        rooms_available: number;
        price_override: number | null;
      }
    >();

    if (data) {
      data.forEach((item) => {
        availMap.set(item.date, {
          rooms_available:
            item.rooms_available,
          price_override:
            item.price_override,
        });
      });
    }

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    const nightlyBreakdown: {
      date: string;
      price: number;
      isOverride: boolean;
      roomsAvailable: number;
    }[] = [];

    let totalPrice = 0;
    let hasSpecialRates = false;
    let minAvailable = roomType.total_rooms;

    const curr = new Date(start);

    while (curr < end) {
      const dateStr =
        curr.toISOString().split('T')[0];

      const rec = availMap.get(dateStr);

      const isOverride = Boolean(
        rec &&
          rec.price_override &&
          rec.price_override > 0
      );

      const nightPrice = isOverride
        ? (rec!.price_override as number)
        : roomType.price_per_night;

      const availableUnits = rec
        ? rec.rooms_available
        : roomType.total_rooms;

      if (availableUnits < minAvailable) {
        minAvailable = availableUnits;
      }

      if (isOverride) {
        hasSpecialRates = true;
      }

      nightlyBreakdown.push({
        date: dateStr,
        price: nightPrice,
        isOverride,
        roomsAvailable: availableUnits,
      });

      totalPrice +=
        nightPrice * roomsCount;

      curr.setDate(
        curr.getDate() + 1
      );
    }

    const nightsCount = Math.max(
      1,
      nightlyBreakdown.length
    );

    const averageNightlyPrice =
      Math.round(
        totalPrice /
          (nightsCount * roomsCount)
      );

    return {
      totalPrice,
      averageNightlyPrice,
      nightsCount,
      hasSpecialRates,
      minAvailable,
      nightlyBreakdown,
    };
  } catch {
    // Fallback if query fails
    const start = new Date(checkIn);
    const end = new Date(checkOut);

    const diffDays = Math.max(
      1,
      Math.round(
        (end.getTime() -
          start.getTime()) /
          86400000
      )
    );

    const totalPrice =
      roomType.price_per_night *
      diffDays *
      roomsCount;

    return {
      totalPrice,
      averageNightlyPrice:
        roomType.price_per_night,
      nightsCount: diffDays,
      hasSpecialRates: false,
      minAvailable:
        roomType.total_rooms,
      nightlyBreakdown: [],
    };
  }
}

/**
 * 8. Adjust room availability for booking.
 *
 * NOTE:
 * This function remains available as an exported helper,
 * but updateBookingStatus() no longer calls it.
 *
 * The database trigger sync_booking_availability()
 * is responsible for booking-related availability changes.
 */
export async function adjustRoomAvailabilityForBooking(
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  roomsCount: number,
  action: 'decrement' | 'increment'
): Promise<void> {
  try {
    const { data } = await supabase
      .from('room_availability')
      .select('date, rooms_available')
      .eq('room_type_id', roomTypeId)
      .gte('date', checkIn)
      .lt('date', checkOut);

    if (!data || data.length === 0) {
      return;
    }

    for (const item of data) {
      const currentVal = Number(
        item.rooms_available
      );

      const newVal =
        action === 'decrement'
          ? Math.max(
              0,
              currentVal - roomsCount
            )
          : currentVal + roomsCount;

      await supabase
        .from('room_availability')
        .update({
          rooms_available: newVal,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'room_type_id',
          roomTypeId
        )
        .eq('date', item.date);
    }
  } catch (err) {
    console.warn(
      'adjustRoomAvailabilityForBooking warning:',
      err
    );
  }
}

/**
 * Fetch Admin Overview Stats.
 *
 * `totalHotels` is kept for backward compatibility.
 * It currently represents the total number of lodgings
 * stored in the existing `hotels` table.
 */
export async function fetchAdminStats(): Promise<{
  totalHotels: number;
  totalBookings: number;
  totalVolume: number;
  totalCommission: number;
  pendingBookings: number;
}> {
  try {
    const [
      hotelsRes,
      bookingsRes,
    ] = await Promise.all([
      supabase
        .from('hotels')
        .select('id', {
          count: 'exact',
        }),

      supabase
        .from('bookings')
        .select(
          'total_price, commission_amount, status'
        ),
    ]);

    const totalHotels =
      hotelsRes.count || 0;

    const allBookings =
      (bookingsRes.data as Booking[]) ||
      [];

    const totalBookings =
      allBookings.length;

    const pendingBookings =
      allBookings.filter(
        (b) =>
          b.status === 'pending'
      ).length;

    const totalVolume =
      allBookings.reduce(
        (sum, b) =>
          sum + (b.total_price || 0),
        0
      );

    const totalCommission =
      allBookings.reduce(
        (sum, b) =>
          sum +
          (Number.isFinite(Number(b.commission_amount))
              ? Number(b.commission_amount || 0)
              : 0),
        0
      );

    return {
      totalHotels,
      totalBookings,
      totalVolume,
      totalCommission,
      pendingBookings,
    };
  } catch {
    return {
      totalHotels: 0,
      totalBookings: 0,
      totalVolume: 0,
      totalCommission: 0,
      pendingBookings: 0,
    };
  }
}

/** Create a persisted manual booking; the server validates ownership and inventory. */
export async function createManualBooking(input: {
  hotel_id: string;
  room_type_id: string;
  check_in: string;
  check_out: string;
  rooms_count: number;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  manual_channel: 'whatsapp' | 'telephone' | 'sur_place' | 'autre';
  total_price: number;
}): Promise<{ data: Booking | null; error: any }> {
  try {
    const { data, error } = await supabase.rpc('create_manual_booking', {
      p_hotel_id: input.hotel_id,
      p_room_type_id: input.room_type_id,
      p_check_in: input.check_in,
      p_check_out: input.check_out,
      p_rooms_count: input.rooms_count,
      p_guest_name: input.guest_name,
      p_guest_phone: input.guest_phone,
      p_guest_email: input.guest_email,
      p_manual_channel: input.manual_channel,
      p_total_price: input.total_price,
    });
    if (error) throw error;
    if (!data?.id) throw new Error('Réservation créée sans identifiant retourné.');
    return { data: data as Booking, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// ============================================================================
// PHYSICAL ROOM UNITS — individually identified rooms within a room category
// ============================================================================
// Ownership, capacity, and assignment constraints are enforced by Supabase RPCs.

export interface PhysicalRoomUnit {
  id: string;
  room_type_id: string;
  unit_code: string | null;
  unit_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BookingRoomAssignment {
  id: string;
  booking_id: string;
  room_unit_id: string;
  created_at: string;
}

export interface RoomUnitOccupancy {
  booking_id: string;
  room_unit_id: string;
  check_in: string;
  check_out: string;
  status: string;
  guest_name: string;
  booking_number: string;
  rooms_count: number;
}

/** List identified physical units for one room category. */
export async function fetchRoomUnits(
  roomTypeId: string
): Promise<{ data: PhysicalRoomUnit[]; error: any }> {
  try {
    if (!roomTypeId) throw new Error('Catégorie de chambre manquante.');
    const { data, error } = await supabase
      .from('room_units')
      .select('id, room_type_id, unit_code, unit_name, is_active, created_at')
      .eq('room_type_id', roomTypeId)
      .order('created_at', { ascending: true });
    return { data: (data as PhysicalRoomUnit[]) ?? [], error };
  } catch (error) {
    return { data: [], error };
  }
}

/** Create an optional physical unit label; capacity is enforced server-side. */
export async function createRoomUnit(input: {
  roomTypeId: string;
  unitCode?: string | null;
  unitName?: string | null;
}): Promise<{ data: PhysicalRoomUnit | null; error: any }> {
  try {
    if (!input.roomTypeId) throw new Error('Catégorie de chambre manquante.');
    const code = input.unitCode?.trim() || null;
    const name = input.unitName?.trim() || null;
    if (!code && !name) {
      throw new Error('Saisissez un numéro/code ou un nom pour identifier cette unité.');
    }
    if (!code) {
      throw new Error('Un numéro ou code est obligatoire pour créer une chambre.');
    }
    const { data, error } = await supabase.rpc('create_room_unit', {
      p_room_type_id: input.roomTypeId,
      p_unit_code: code,
      p_unit_name: name,
    });
    if (error) throw error;
    return { data: (data as PhysicalRoomUnit) ?? null, error };
  } catch (error) {
    return { data: null, error };
  }
}

/** Rename an identified unit; does not change its category or reservations. */
export async function updateRoomUnit(
  unitId: string,
  input: { unitCode?: string | null; unitName?: string | null }
): Promise<{ data: PhysicalRoomUnit | null; error: any }> {
  try {
    if (!unitId) throw new Error('Unité physique manquante.');
    if (input.unitCode === undefined && input.unitName === undefined) {
      throw new Error('Aucune modification demandée.');
    }
    const current = await supabase.from('room_units')
      .select('unit_code, unit_name').eq('id', unitId).single();
    if (current.error) throw current.error;
    const { data, error } = await supabase.rpc('update_room_unit_label', {
      p_room_unit_id: unitId,
      p_unit_code: input.unitCode === undefined ? current.data.unit_code : input.unitCode?.trim() || current.data.unit_code,
      p_unit_name: input.unitName === undefined ? current.data.unit_name : input.unitName?.trim() || null,
    });
    if (error) throw error;
    return { data: (data as PhysicalRoomUnit) ?? null, error };
  } catch (error) {
    return { data: null, error };
  }
}

/** Delete a physical identifier only if database constraints permit it. */
export async function deleteRoomUnit(
  unitId: string
): Promise<{ error: any }> {
  try {
    if (!unitId) throw new Error('Unité physique manquante.');
    const { error } = await supabase.rpc('delete_room_unit', {
      p_room_unit_id: unitId,
    });
    if (error) return { error };
    return { error: null };
  } catch (error) {
    return { error };
  }
}

/** Read assignments for a booking; assignment writes will be added separately. */
export async function fetchBookingRoomAssignments(
  bookingId: string
): Promise<{ data: BookingRoomAssignment[]; error: any }> {
  try {
    if (!bookingId) throw new Error('Réservation manquante.');
    const { data, error } = await supabase
      .from('booking_room_assignments')
      .select('id, booking_id, room_unit_id, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });
    return { data: (data as BookingRoomAssignment[]) ?? [], error };
  } catch (error) {
    return { data: [], error };
  }
}


/** Occupancy of identified units, including stays booked through other channels. */
export async function fetchRoomUnitOccupancy(roomUnitIds: string[]): Promise<{
  data: RoomUnitOccupancy[];
  error: any;
}> {
  if (!roomUnitIds.length) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from('booking_room_assignments')
      .select('booking_id, room_unit_id, bookings!inner(check_in, check_out, status, guest_name, booking_number, rooms_count)')
      .in('room_unit_id', roomUnitIds);
    if (error) return { data: [], error };
    const entries = (data || []).map((item: any) => {
      const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
      if (!booking?.check_in || !booking?.check_out || !booking?.status) {
        throw new Error('Données d’occupation incomplètes.');
      }
      return {
        booking_id: item.booking_id as string,
        room_unit_id: item.room_unit_id as string,
        check_in: booking.check_in as string,
        check_out: booking.check_out as string,
        status: booking.status as string,
        guest_name: booking.guest_name as string,
        booking_number: booking.booking_number as string,
        rooms_count: booking.rooms_count as number,
      };
    });
    return { data: entries, error: null };
  } catch (error) {
    return { data: [], error };
  }
}

/** Reassign an automatically allocated physical room to another unit. */
export async function assignPhysicalRoom(
  bookingId: string,
  oldUnitId: string,
  newUnitId: string
): Promise<{ error: any }> {
  if (!bookingId || !oldUnitId || !newUnitId) return { error: new Error('Réservation ou chambre manquante.') };
  try {
    const { error } = await supabase.rpc('reassign_booking_room_unit', {
      p_booking_id: bookingId,
      p_old_room_unit_id: oldUnitId,
      p_new_room_unit_id: newUnitId,
    });
    return { error };
  } catch (error) {
    return { error };
  }
}

export async function unassignPhysicalRoom(assignmentId: string): Promise<{ error: any }> {
  if (!assignmentId) return { error: new Error('Attribution manquante.') };
  return { error: new Error('Une réservation active doit toujours garder une chambre attribuée. Déplacez-la vers une autre chambre.') };
}

export async function setPhysicalRoomSalesStatus(input: {
  roomUnitId: string;
  startDate: string;
  endDate: string;
  closeSales: boolean;
  reason?: string | null;
}): Promise<{ error: any }> {
  try {
    const { error } = await supabase.rpc('set_room_unit_sales_status', {
      p_room_unit_id: input.roomUnitId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_close_sales: input.closeSales,
      p_reason: input.reason ?? null,
    });
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}
