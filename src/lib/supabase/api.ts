import { supabase } from './client';
import { 
  Hotel, 
  RoomType, 
  RoomAvailability,
  Booking, 
  Review, 
  SearchFilters, 
  Favorite,
  BookingStatus 
} from '@/src/types';

/**
 * Fetch hotels with search query and filters
 */
export async function fetchHotels(filters?: Partial<SearchFilters>): Promise<{ data: Hotel[]; count: number; error: any }> {
  try {
    let query = supabase
      .from('hotels')
      .select('*, room_types(*)', { count: 'exact' })
      .eq('status', 'published');

    if (filters?.destination && filters.destination !== 'all' && filters.destination.trim() !== '') {
      const dest = filters.destination.toLowerCase().trim();
      // Search matching region, city, or name
      query = query.or(`region.ilike.%${dest}%,city.ilike.%${dest}%,name.ilike.%${dest}%`);
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
      query = query.lte('distance_beach_m', filters.maxBeachDistance);
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
        query = query.order('featured', { ascending: false }).order('rating', { ascending: false });
        break;
    }

    const { data, error, count } = await query;

    if (error) {
      console.warn('Supabase fetchHotels error:', error.message);
      return { data: [], count: 0, error };
    }

    return { data: (data as Hotel[]) || [], count: count || 0, error: null };
  } catch (err) {
    console.error('fetchHotels exception:', err);
    return { data: [], count: 0, error: err };
  }
}

/**
 * Fetch a single hotel by ID including room types and reviews
 */
export async function fetchHotelById(id: string): Promise<{ data: Hotel | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('*, room_types(*), owner:profiles(id, full_name, email, phone)')
      .eq('id', id)
      .single();

    if (error) return { data: null, error };
    return { data: data as Hotel, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Fetch featured offers / "offres du moment"
 */
export async function fetchFeaturedHotels(): Promise<{ data: Hotel[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('*, room_types(*)')
      .eq('status', 'published')
      .order('featured', { ascending: false })
      .order('rating', { ascending: false })
      .limit(6);

    if (error) return { data: [], error };
    return { data: (data as Hotel[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * Fetch hotel counts grouped by region in Senegal
 */
export async function fetchRegionCounts(): Promise<{ [regionName: string]: number }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('region')
      .eq('status', 'published');

    if (error || !data) return {};

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
 * Fetch room types for a specific hotel
 */
export async function fetchHotelRooms(hotelId: string): Promise<{ data: RoomType[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('room_types')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('price_per_night', { ascending: true });

    if (error) return { data: [], error };
    return { data: (data as RoomType[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * Fetch reviews for a specific hotel
 */
export async function fetchHotelReviews(hotelId: string): Promise<{ data: Review[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as Review[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * Create a new booking (pending status)
 */
export async function createBooking(booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Booking | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...booking,
        status: 'pending',
        payment_status: 'on_site_unpaid',
      })
      .select('*, hotel:hotels(name, region, city, address, photos, phone, email), room_type:room_types(name, bed_type, price_per_night)')
      .single();

    if (error) throw error;
    return { data: data as Booking, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Fetch user's bookings (Traveler Dashboard)
 */
export async function fetchUserBookings(userId: string): Promise<{ data: Booking[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, hotel:hotels(id, name, region, city, photos, address, phone), room_type:room_types(name, bed_type, price_per_night)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as Booking[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * Fetch user's favorites
 */
export async function fetchUserFavorites(userId: string): Promise<{ data: Favorite[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('*, hotel:hotels(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as Favorite[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * Toggle favorite for a hotel
 */
export async function toggleFavorite(userId: string, hotelId: string): Promise<{ isFavorite: boolean; error: any }> {
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
      if (error) throw error;
      return { isFavorite: false, error: null };
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, hotel_id: hotelId });
      if (error) throw error;
      return { isFavorite: true, error: null };
    }
  } catch (err: any) {
    return { isFavorite: false, error: err };
  }
}

/**
 * Submit a customer review
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
        status: 'pending', // Pending admin moderation
      })
      .select()
      .single();

    if (error) throw error;
    return { data: data as Review, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * HOTELIER BACK-OFFICE: Fetch hotels managed by the current user
 */
export async function fetchOwnerHotels(ownerId: string): Promise<{ data: Hotel[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('*, room_types(*)')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as Hotel[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * HOTELIER BACK-OFFICE: Fetch bookings received across owner's hotels
 */
export async function fetchOwnerBookings(ownerId: string): Promise<{ data: Booking[]; error: any }> {
  try {
    // First fetch hotel IDs of this owner
    const { data: ownerHotels, error: hError } = await supabase
      .from('hotels')
      .select('id')
      .eq('owner_id', ownerId);

    if (hError || !ownerHotels || ownerHotels.length === 0) {
      return { data: [], error: hError };
    }

    const hotelIds = ownerHotels.map(h => h.id);

    const { data, error } = await supabase
      .from('bookings')
      .select('*, hotel:hotels(name, region, city), room_type:room_types(name, price_per_night)')
      .in('hotel_id', hotelIds)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as Booking[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * Update booking status (confirm on payment received, cancel, etc.)
 */
export async function updateBookingStatus(
  bookingId: string, 
  status: BookingStatus, 
  paymentStatus?: 'on_site_unpaid' | 'on_site_paid'
): Promise<{ error: any }> {
  try {
    // 1. Fetch current booking to know details for availability adjustments
    const { data: currentBooking } = await supabase
      .from('bookings')
      .select('room_type_id, check_in, check_out, rooms_count, status')
      .eq('id', bookingId)
      .maybeSingle();

    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (paymentStatus) {
      updateData.payment_status = paymentStatus;
    }

    const { error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) throw error;

    // 2. Adjust room availability in sync (triggers fallback)
    if (currentBooking) {
      if (status === 'confirmed' && currentBooking.status !== 'confirmed') {
        await adjustRoomAvailabilityForBooking(
          currentBooking.room_type_id,
          currentBooking.check_in,
          currentBooking.check_out,
          currentBooking.rooms_count || 1,
          'decrement'
        );
      } else if (status === 'cancelled' && currentBooking.status === 'confirmed') {
        await adjustRoomAvailabilityForBooking(
          currentBooking.room_type_id,
          currentBooking.check_in,
          currentBooking.check_out,
          currentBooking.rooms_count || 1,
          'increment'
        );
      }
    }

    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Create or update hotel
 */
export async function saveHotel(hotelData: Partial<Hotel>): Promise<{ data: Hotel | null; error: any }> {
  try {
    if (hotelData.id) {
      const { data, error } = await supabase
        .from('hotels')
        .update({
          ...hotelData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', hotelData.id)
        .select()
        .single();
      if (error) throw error;
      return { data: data as Hotel, error: null };
    } else {
      const { data, error } = await supabase
        .from('hotels')
        .insert({
          ...hotelData,
          status: 'pending', // Requires admin approval
        })
        .select()
        .single();
      if (error) throw error;
      return { data: data as Hotel, error: null };
    }
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Create or update room type
 */
export async function saveRoomType(roomData: Partial<RoomType>): Promise<{ data: RoomType | null; error: any }> {
  try {
    if (roomData.id) {
      const { data, error } = await supabase
        .from('room_types')
        .update(roomData)
        .eq('id', roomData.id)
        .select()
        .single();
      if (error) throw error;
      return { data: data as RoomType, error: null };
    } else {
      const { data, error } = await supabase
        .from('room_types')
        .insert(roomData)
        .select()
        .single();
      if (error) throw error;
      return { data: data as RoomType, error: null };
    }
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Delete room type
 */
export async function deleteRoomType(roomId: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('room_types')
      .delete()
      .eq('id', roomId);
    return { error };
  } catch (err) {
    return { error: err };
  }
}

/**
 * ADMIN: Fetch all hotels (pending, published, rejected)
 */
export async function fetchAllHotelsAdmin(): Promise<{ data: Hotel[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .select('*, owner:profiles(full_name, email, phone)')
      .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as Hotel[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * ADMIN: Update hotel publication status
 */
export async function updateHotelStatus(hotelId: string, status: 'published' | 'rejected' | 'pending'): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('hotels')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', hotelId);
    return { error };
  } catch (err) {
    return { error: err };
  }
}

/**
 * ADMIN: Fetch all reviews for moderation
 */
export async function fetchAllReviewsAdmin(): Promise<{ data: Review[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, hotel:hotels(name, region)')
      .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as Review[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * ADMIN: Update review moderation status
 */
export async function updateReviewStatus(reviewId: string, status: 'approved' | 'rejected' | 'pending'): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({ status })
      .eq('id', reviewId);
    return { error };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Storage: Upload photo to Supabase Storage bucket 'hotel-photos'
 */
export async function uploadHotelPhoto(file: File, folder: string = 'hotels'): Promise<{ url: string | null; error: any }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('hotel-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('hotel-photos')
      .getPublicUrl(fileName);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (err: any) {
    return { url: null, error: err };
  }
}

/**
 * Fetch bookings for a specific hotel
 */
export async function fetchHotelBookings(hotelId: string): Promise<{ data: Booking[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, hotel:hotels(name, region, city), room_type:room_types(name, price_per_night)')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error };
    return { data: (data as Booking[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * Create a new hotel
 */
export async function createHotel(hotel: Partial<Hotel>): Promise<{ data: Hotel | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .insert({
        ...hotel,
        status: 'published',
      })
      .select()
      .single();

    if (error) throw error;
    return { data: data as Hotel, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Update an existing hotel
 */
export async function updateHotel(hotelId: string, updates: Partial<Hotel>): Promise<{ data: Hotel | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('hotels')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', hotelId)
      .select()
      .single();

    if (error) throw error;
    return { data: data as Hotel, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Delete a hotel
 */
export async function deleteHotel(hotelId: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('hotels')
      .delete()
      .eq('id', hotelId);

    return { error };
  } catch (err: any) {
    return { error: err };
  }
}

/**
 * Create a room type and automatically populate 365 days of availability
 */
export async function createRoomType(room: Partial<RoomType>): Promise<{ data: RoomType | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('room_types')
      .insert(room)
      .select()
      .single();

    if (error) throw error;
    
    // Automatically generate rows in room_availability for the next 365 days
    if (data && data.id) {
      await populateRoomAvailability(data.id, data.total_rooms || 1, 365);
    }

    return { data: data as RoomType, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

// ====================================================================
// ROOM AVAILABILITY & DYNAMIC PRICING ENGINE
// ====================================================================

/**
 * 1. Automatically populate room_availability for the next N days (default 365)
 */
export async function populateRoomAvailability(
  roomTypeId: string,
  totalRooms: number = 1,
  daysAhead: number = 365
): Promise<{ success: boolean; count: number; error: any }> {
  try {
    const today = new Date();
    const rows: {
      room_type_id: string;
      date: string;
      rooms_available: number;
      price_override: number | null;
    }[] = [];

    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      rows.push({
        room_type_id: roomTypeId,
        date: dateStr,
        rooms_available: Math.max(0, totalRooms),
        price_override: null,
      });
    }

    // Insert in batches of 100 to stay optimal
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('room_availability')
        .upsert(chunk, { onConflict: 'room_type_id,date' });

      if (error) {
        console.warn('Batch populate room_availability notice:', error.message);
      }
    }

    return { success: true, count: rows.length, error: null };
  } catch (err: any) {
    console.error('populateRoomAvailability error:', err);
    return { success: false, count: 0, error: err };
  }
}

/**
 * 2. Fetch room availability records for a date range (for hotelier back-office calendar)
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
      console.warn('fetchRoomAvailability error:', error);
      return { data: [], error };
    }

    return { data: (data as RoomAvailability[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * 3. Fetch availability for multiple room types across a date range
 */
export async function fetchMultipleRoomsAvailability(
  roomTypeIds: string[],
  startDate: string,
  endDate: string
): Promise<{ data: RoomAvailability[]; error: any }> {
  try {
    if (!roomTypeIds || roomTypeIds.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
      .from('room_availability')
      .select('*')
      .in('room_type_id', roomTypeIds)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) return { data: [], error };
    return { data: (data as RoomAvailability[]) || [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/**
 * 4. Update single date availability / price override (hotelier calendar)
 */
export async function updateSingleDateAvailability(
  roomTypeId: string,
  date: string,
  roomsAvailable: number,
  priceOverride: number | null
): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('room_availability')
      .upsert({
        room_type_id: roomTypeId,
        date: date,
        rooms_available: roomsAvailable,
        price_override: priceOverride && priceOverride > 0 ? priceOverride : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'room_type_id,date' });

    return { error };
  } catch (err) {
    return { error: err };
  }
}

/**
 * 5. Update date range availability / special pricing (bulk date range update for hotelier)
 */
export async function updateDateRangeAvailability(
  roomTypeId: string,
  startDate: string,
  endDate: string,
  options: {
    roomsAvailable?: number;
    priceOverride?: number | null;
  }
): Promise<{ success: boolean; count: number; error: any }> {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const rows: {
      room_type_id: string;
      date: string;
      rooms_available?: number;
      price_override?: number | null;
      updated_at: string;
    }[] = [];

    const curr = new Date(start);
    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      const payload: any = {
        room_type_id: roomTypeId,
        date: dateStr,
        updated_at: new Date().toISOString(),
      };
      if (typeof options.roomsAvailable === 'number') {
        payload.rooms_available = options.roomsAvailable;
      }
      if (options.priceOverride !== undefined) {
        payload.price_override = options.priceOverride && options.priceOverride > 0 ? options.priceOverride : null;
      }
      rows.push(payload);
      curr.setDate(curr.getDate() + 1);
    }

    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('room_availability')
        .upsert(chunk, { onConflict: 'room_type_id,date' });

      if (error) throw error;
    }

    return { success: true, count: rows.length, error: null };
  } catch (err: any) {
    return { success: false, count: 0, error: err };
  }
}

/**
 * 6. CHECK ROOM AVAILABILITY VIA POSTGRES RPC: check_room_availability
 * Calls supabase.rpc('check_room_availability', { p_room_type_id, p_check_in, p_check_out, p_rooms_needed })
 * with resilient table fallback.
 */
export async function checkRoomAvailabilityRPC(
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  roomsNeeded: number = 1
): Promise<{ isAvailable: boolean; minAvailable: number; error: any }> {
  try {
    // Call Supabase Postgres RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('check_room_availability', {
      p_room_type_id: roomTypeId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_rooms_needed: roomsNeeded,
    });

    if (!rpcError && typeof rpcResult === 'boolean') {
      return { isAvailable: rpcResult, minAvailable: rpcResult ? roomsNeeded : 0, error: null };
    }

    // Direct table fallback
    const { data, error } = await supabase
      .from('room_availability')
      .select('date, rooms_available')
      .eq('room_type_id', roomTypeId)
      .gte('date', checkIn)
      .lt('date', checkOut);

    if (error || !data || data.length === 0) {
      // If table query returned no rows (e.g. uninitialized), fallback to room_type default
      const { data: roomData } = await supabase
        .from('room_types')
        .select('total_rooms')
        .eq('id', roomTypeId)
        .maybeSingle();

      const defaultTotal = roomData?.total_rooms || 1;
      return { isAvailable: defaultTotal >= roomsNeeded, minAvailable: defaultTotal, error: null };
    }

    const minAvail = Math.min(...data.map(d => Number(d.rooms_available)));
    return { isAvailable: minAvail >= roomsNeeded, minAvailable: minAvail, error: null };
  } catch (err) {
    return { isAvailable: true, minAvailable: roomsNeeded, error: err };
  }
}

/**
 * 7. Calculate Stay Pricing including Date-Specific Price Overrides
 * Uses price_override if set for a date, otherwise room_type.price_per_night
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
  nightlyBreakdown: { date: string; price: number; isOverride: boolean; roomsAvailable: number }[];
}> {
  try {
    const { data } = await supabase
      .from('room_availability')
      .select('date, rooms_available, price_override')
      .eq('room_type_id', roomType.id)
      .gte('date', checkIn)
      .lt('date', checkOut)
      .order('date', { ascending: true });

    const availMap = new Map<string, { rooms_available: number; price_override: number | null }>();
    if (data) {
      data.forEach(item => {
        availMap.set(item.date, {
          rooms_available: item.rooms_available,
          price_override: item.price_override,
        });
      });
    }

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nightlyBreakdown: { date: string; price: number; isOverride: boolean; roomsAvailable: number }[] = [];
    let totalPrice = 0;
    let hasSpecialRates = false;
    let minAvailable = roomType.total_rooms;

    const curr = new Date(start);
    while (curr < end) {
      const dateStr = curr.toISOString().split('T')[0];
      const rec = availMap.get(dateStr);
      
      const isOverride = Boolean(rec && rec.price_override && rec.price_override > 0);
      const nightPrice = isOverride ? (rec!.price_override as number) : roomType.price_per_night;
      const availableUnits = rec ? rec.rooms_available : roomType.total_rooms;

      if (availableUnits < minAvailable) {
        minAvailable = availableUnits;
      }

      if (isOverride) hasSpecialRates = true;

      nightlyBreakdown.push({
        date: dateStr,
        price: nightPrice,
        isOverride,
        roomsAvailable: availableUnits,
      });

      totalPrice += nightPrice * roomsCount;
      curr.setDate(curr.getDate() + 1);
    }

    const nightsCount = Math.max(1, nightlyBreakdown.length);
    const averageNightlyPrice = Math.round(totalPrice / (nightsCount * roomsCount));

    return {
      totalPrice,
      averageNightlyPrice,
      nightsCount,
      hasSpecialRates,
      minAvailable,
      nightlyBreakdown,
    };
  } catch (err) {
    // Fallback if query fails
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    const totalPrice = roomType.price_per_night * diffDays * roomsCount;
    return {
      totalPrice,
      averageNightlyPrice: roomType.price_per_night,
      nightsCount: diffDays,
      hasSpecialRates: false,
      minAvailable: roomType.total_rooms,
      nightlyBreakdown: [],
    };
  }
}

/**
 * 8. Adjust room availability for booking (Client sync fallback alongside Postgres trigger)
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

    if (!data || data.length === 0) return;

    for (const item of data) {
      const currentVal = Number(item.rooms_available);
      const newVal = action === 'decrement' 
        ? Math.max(0, currentVal - roomsCount) 
        : currentVal + roomsCount;

      await supabase
        .from('room_availability')
        .update({
          rooms_available: newVal,
          updated_at: new Date().toISOString(),
        })
        .eq('room_type_id', roomTypeId)
        .eq('date', item.date);
    }
  } catch (err) {
    console.warn('adjustRoomAvailabilityForBooking warning:', err);
  }
}

/**
 * Fetch Admin Overview Stats
 */
export async function fetchAdminStats(): Promise<{
  totalHotels: number;
  totalBookings: number;
  totalVolume: number;
  totalCommission: number;
  pendingBookings: number;
}> {
  try {
    const [hotelsRes, bookingsRes] = await Promise.all([
      supabase.from('hotels').select('id', { count: 'exact' }),
      supabase.from('bookings').select('total_price, commission_amount, status'),
    ]);

    const totalHotels = hotelsRes.count || 0;
    const allBookings = (bookingsRes.data as Booking[]) || [];
    const totalBookings = allBookings.length;
    const pendingBookings = allBookings.filter(b => b.status === 'pending').length;
    
    const totalVolume = allBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
    const totalCommission = allBookings.reduce((sum, b) => sum + (b.commission_amount || Math.round((b.total_price || 0) * 0.10)), 0);

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

