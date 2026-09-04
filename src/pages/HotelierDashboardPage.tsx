import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  PlusCircle, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Bed, 
  Users, 
  MapPin, 
  Edit3, 
  Upload, 
  AlertCircle, 
  Loader2, 
  TrendingUp, 
  Image as ImageIcon,
  ShieldCheck,
  Percent,
  Sparkles,
  Phone,
  Mail
} from 'lucide-react';
import { Hotel, RoomType, Booking, SENEGAL_REGIONS, HOTEL_AMENITIES } from '@/src/types';
import { 
  fetchOwnerHotels, 
  fetchHotelBookings, 
  fetchHotelRooms, 
  createHotel, 
  createRoomType, 
  updateBookingStatus,
  updateHotel
} from '@/src/lib/supabase/api';
import { formatFCFA, formatDate } from '@/src/lib/formatters';
import { useAuth } from '@/src/context/AuthContext';
import { BadgeEquipement } from '@/src/components/BadgeEquipement';
import { RoomAvailabilityCalendar } from '@/src/components/hotelier/RoomAvailabilityCalendar';

interface HotelierDashboardPageProps {
  onOpenAuth: () => void;
  onOpenSupabaseModal: () => void;
}

export const HotelierDashboardPage: React.FC<HotelierDashboardPageProps> = ({
  onOpenAuth,
  onOpenSupabaseModal,
}) => {
  const { user, profile, role } = useAuth();

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'rooms' | 'calendar' | 'edit-hotel'>('overview');
  const [calendarSelectedRoomId, setCalendarSelectedRoomId] = useState<string>('');

  // New Hotel Modal / Form state
  const [isAddHotelOpen, setIsAddHotelOpen] = useState<boolean>(false);
  const [newHotelName, setNewHotelName] = useState<string>('');
  const [newHotelCategory, setNewHotelCategory] = useState<'hotel' | 'lodge' | 'campement' | 'residence'>('hotel');
  const [newHotelRegion, setNewHotelRegion] = useState<string>('Dakar');
  const [newHotelCity, setNewHotelCity] = useState<string>('Dakar');
  const [newHotelAddress, setNewHotelAddress] = useState<string>('');
  const [newHotelDescription, setNewHotelDescription] = useState<string>('');
  const [newHotelPhone, setNewHotelPhone] = useState<string>('+221 ');
  const [newHotelEmail, setNewHotelEmail] = useState<string>('');
  const [newHotelPhotoUrl, setNewHotelPhotoUrl] = useState<string>('');
  const [newHotelAmenities, setNewHotelAmenities] = useState<string[]>(['wifi', 'air_conditioning']);
  const [newHotelBeachDist, setNewHotelBeachDist] = useState<number>(200);
  const [isCreatingHotel, setIsCreatingHotel] = useState<boolean>(false);

  // New Room Modal / Form state
  const [isAddRoomOpen, setIsAddRoomOpen] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomPrice, setNewRoomPrice] = useState<number>(45000);
  const [newRoomCapacity, setNewRoomCapacity] = useState<number>(2);
  const [newRoomQty, setNewRoomQty] = useState<number>(5);
  const [newRoomBedType, setNewRoomBedType] = useState<string>('1 Grand Lit King-size');
  const [newRoomBreakfast, setNewRoomBreakfast] = useState<boolean>(true);
  const [newRoomPhotoUrl, setNewRoomPhotoUrl] = useState<string>('');
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);

  const loadOwnerData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await fetchOwnerHotels(user.id);
      if (error) {
        console.warn('Error fetching owner hotels:', error);
      }
      const ownerHotels = data || [];
      setHotels(ownerHotels);

      if (ownerHotels.length > 0) {
        const current = selectedHotel ? ownerHotels.find(h => h.id === selectedHotel.id) || ownerHotels[0] : ownerHotels[0];
        setSelectedHotel(current);
        await loadHotelSpecificData(current.id);
      }
    } catch (err) {
      console.error('Owner data loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHotelSpecificData = async (hotelId: string) => {
    try {
      const [bookingsRes, roomsRes] = await Promise.all([
        fetchHotelBookings(hotelId),
        fetchHotelRooms(hotelId),
      ]);
      setBookings(bookingsRes.data || []);
      setRooms(roomsRes.data || []);
    } catch (err) {
      console.error('Hotel detail fetch error:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadOwnerData();
    }
  }, [user]);

  const handleHotelChange = async (h: Hotel) => {
    setSelectedHotel(h);
    setIsLoading(true);
    await loadHotelSpecificData(h.id);
    setIsLoading(false);
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: 'confirmed' | 'cancelled' | 'completed') => {
    try {
      const paymentStatus = newStatus === 'confirmed' ? 'on_site_paid' : undefined;
      const { error } = await updateBookingStatus(bookingId, newStatus, paymentStatus);
      if (error) throw error;
      // Update local state
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus, payment_status: paymentStatus || b.payment_status } : b));
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour du statut.');
    }
  };

  const handleCreateHotelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsCreatingHotel(true);

    try {
      const photosArray = newHotelPhotoUrl.trim() 
        ? [newHotelPhotoUrl.trim(), 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80']
        : ['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80'];

      const { data, error } = await createHotel({
        owner_id: user.id,
        name: newHotelName.trim(),
        category: newHotelCategory,
        region: newHotelRegion,
        city: newHotelCity.trim(),
        address: newHotelAddress.trim(),
        latitude: 14.7167, // Dakar default coordinates
        longitude: -17.4677,
        description: newHotelDescription.trim(),
        phone: newHotelPhone.trim(),
        email: newHotelEmail.trim() || user.email || '',
        min_price: 35000,
        amenities: newHotelAmenities,
        photos: photosArray,
        distance_beach_m: newHotelBeachDist,
        commission_rate: 0.10,
        is_published: true,
      });

      if (error) throw error;

      setIsAddHotelOpen(false);
      await loadOwnerData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la création de l’établissement');
    } finally {
      setIsCreatingHotel(false);
    }
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHotel) return;
    setIsCreatingRoom(true);

    try {
      const photosArray = newRoomPhotoUrl.trim()
        ? [newRoomPhotoUrl.trim()]
        : ['https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80'];

      const { data, error } = await createRoomType({
        hotel_id: selectedHotel.id,
        name: newRoomName.trim(),
        capacity_adults: newRoomCapacity,
        capacity_children: 1,
        price_per_night: newRoomPrice,
        total_rooms: newRoomQty,
        bed_type: newRoomBedType.trim(),
        breakfast_included: newRoomBreakfast,
        cancellation_policy: 'free_cancellation',
        amenities: ['wifi', 'air_conditioning'],
        photos: photosArray,
      });

      if (error) throw error;

      setIsAddRoomOpen(false);
      setNewRoomName('');
      await loadHotelSpecificData(selectedHotel.id);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l’ajout du type de chambre');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] bg-[#FAF9F6] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-[#E6E2D3] shadow-xs text-center max-w-md space-y-4">
          <div className="w-14 h-14 bg-[#ECF3E5] text-[#3F6212] rounded-2xl flex items-center justify-center mx-auto">
            <Building2 size={28} />
          </div>
          <h2 className="text-xl font-serif font-bold text-[#2D2A26]">Espace Propriétaire / Gérant</h2>
          <p className="text-xs text-[#6B6658] leading-relaxed">
            Connectez-vous avec votre compte hôtelier pour publier votre hébergement au Sénégal, gérer vos chambres et valider les réservations.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full py-3 bg-[#8B5E34] hover:bg-[#724B28] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs cursor-pointer transition"
          >
            Se connecter en tant qu'hôtelier
          </button>
        </div>
      </div>
    );
  }

  // Financial Stats Calculation
  const totalRevenue = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((acc, b) => acc + (b.total_price || 0), 0);

  const pendingRevenue = bookings
    .filter(b => b.status === 'pending')
    .reduce((acc, b) => acc + (b.total_price || 0), 0);

  const totalNights = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((acc, b) => acc + (b.nights_count || 0), 0);

  const totalCommission = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((acc, b) => acc + (b.commission_amount || Math.round(b.total_price * 0.10)), 0);

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-20">
      
      {/* Header Banner */}
      <div className="bg-[#3F6212] text-white px-4 sm:px-6 py-6 shadow-xs border-b border-[#365314]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
              <span className="text-xs font-bold text-[#E6E2D3] uppercase tracking-widest">
                Portail Hôtelier Sénégal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold mt-1">
              Tableau de bord Établissements
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {hotels.length > 0 && (
              <div className="bg-[#2D450D] p-1.5 rounded-xl border border-[#4D7C0F] flex items-center gap-2">
                <Building2 size={16} className="text-[#E6E2D3] ml-2" />
                <label htmlFor="owner-hotel-select" className="sr-only">Sélectionner un hôtel</label>
                <select
                  id="owner-hotel-select"
                  value={selectedHotel?.id || ''}
                  onChange={(e) => {
                    const found = hotels.find(h => h.id === e.target.value);
                    if (found) handleHotelChange(found);
                  }}
                  className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-2"
                >
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id} className="bg-[#2D450D] text-white">
                      {h.name} ({h.city})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              id="add-hotel-btn"
              onClick={() => setIsAddHotelOpen(true)}
              className="px-4 py-2.5 bg-[#8B5E34] hover:bg-[#724B28] text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <PlusCircle size={16} />
              <span>Inscrire un hébergement</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* If user has no hotel registered yet */}
        {hotels.length === 0 && !isLoading && (
          <div className="bg-white p-8 sm:p-12 rounded-3xl border border-dashed border-[#E6E2D3] text-center space-y-4">
            <div className="w-16 h-16 bg-[#ECF3E5] text-[#3F6212] rounded-3xl flex items-center justify-center mx-auto">
              <Building2 size={32} />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-lg font-serif font-bold text-[#2D2A26]">Vous n'avez pas encore d'hébergement inscrit</h3>
              <p className="text-xs text-[#6B6658]">
                Ajoutez votre premier hôtel, lodge ou résidence pour commencer à recevoir des réservations de voyageurs partout au Sénégal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddHotelOpen(true)}
              className="px-6 py-3 bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer"
            >
              Créer la fiche de mon établissement
            </button>
          </div>
        )}

        {/* If user has registered hotels */}
        {hotels.length > 0 && selectedHotel && (
          <>
            {/* Financial Performance KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[#6B6658]">
                  <span className="text-xs font-bold uppercase tracking-wider">Chiffre d'Affaires Encaissé</span>
                  <div className="w-8 h-8 rounded-lg bg-[#ECF3E5] text-[#3F6212] flex items-center justify-center">
                    <TrendingUp size={16} />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-serif font-bold text-[#2D2A26]">
                  {formatFCFA(totalRevenue)}
                </p>
                <p className="text-[11px] text-[#8C887D]">Paiements validés sur place</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[#6B6658]">
                  <span className="text-xs font-bold uppercase tracking-wider">En Attente (Pending)</span>
                  <div className="w-8 h-8 rounded-lg bg-[#F0EDE4] text-[#8B5E34] flex items-center justify-center">
                    <Clock size={16} />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-serif font-bold text-[#8B5E34]">
                  {formatFCFA(pendingRevenue)}
                </p>
                <p className="text-[11px] text-[#8C887D]">À encaisser lors de l'arrivée</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[#6B6658]">
                  <span className="text-xs font-bold uppercase tracking-wider">Nuitées Vendues</span>
                  <div className="w-8 h-8 rounded-lg bg-[#ECF3E5] text-[#3F6212] flex items-center justify-center">
                    <Bed size={16} />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-serif font-bold text-[#2D2A26]">
                  {totalNights} nuit{totalNights > 1 ? 's' : ''}
                </p>
                <p className="text-[11px] text-[#8C887D]">{bookings.length} réservation(s) totale(s)</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[#6B6658]">
                  <span className="text-xs font-bold uppercase tracking-wider">Commission Teranga (10%)</span>
                  <div className="w-8 h-8 rounded-lg bg-[#F0EDE4] text-[#8B5E34] flex items-center justify-center">
                    <Percent size={16} />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-serif font-bold text-[#8B5E34]">
                  {formatFCFA(totalCommission)}
                </p>
                <p className="text-[11px] text-[#8C887D]">Commission plateforme</p>
              </div>

            </div>

            {/* Navigation tabs inside Hotelier dashboard */}
            <div className="flex border border-[#E6E2D3] gap-4 text-xs sm:text-sm font-bold bg-white px-6 pt-3 rounded-2xl shadow-xs overflow-x-auto">
              <button
                type="button"
                id="owner-tab-bookings"
                onClick={() => setActiveTab('overview')}
                className={`pb-3 border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'overview'
                    ? 'border-[#3F6212] text-[#3F6212]'
                    : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
                }`}
              >
                <Calendar size={16} />
                <span>Réservations reçues ({bookings.length})</span>
              </button>

              <button
                type="button"
                id="owner-tab-rooms"
                onClick={() => setActiveTab('rooms')}
                className={`pb-3 border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'rooms'
                    ? 'border-[#3F6212] text-[#3F6212]'
                    : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
                }`}
              >
                <Bed size={16} />
                <span>Types de chambres ({rooms.length})</span>
              </button>

              <button
                type="button"
                id="owner-tab-calendar"
                onClick={() => setActiveTab('calendar')}
                className={`pb-3 border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'calendar'
                    ? 'border-[#3F6212] text-[#3F6212]'
                    : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
                }`}
              >
                <Clock size={16} />
                <span>Disponibilités & Calendrier</span>
              </button>
            </div>

            {/* TAB: BOOKINGS MANAGEMENT */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs flex items-center justify-between">
                  <h3 className="font-serif font-bold text-sm text-[#2D2A26]">
                    Flux des réservations pour {selectedHotel.name}
                  </h3>
                  <span className="text-xs text-[#6B6658]">
                    Règle : Validez ("Confirmer") dès que le client a réglé à l'hôtel
                  </span>
                </div>

                {bookings.length === 0 ? (
                  <div className="bg-white p-10 rounded-2xl border border-dashed border-[#E6E2D3] text-center space-y-2">
                    <p className="text-sm font-bold text-[#2D2A26]">Aucune réservation pour cet établissement</p>
                    <p className="text-xs text-[#6B6658]">Les nouvelles demandes apparaîtront ici en temps réel.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-[#E6E2D3] overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9F6] text-[#6B6658] uppercase font-bold border-b border-[#E6E2D3]">
                          <tr>
                            <th className="px-4 py-3">N° / Client</th>
                            <th className="px-4 py-3">Dates & Nuits</th>
                            <th className="px-4 py-3">Chambre</th>
                            <th className="px-4 py-3">Montant</th>
                            <th className="px-4 py-3">Statut actuel</th>
                            <th className="px-4 py-3 text-right">Actions Gestion</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6E2D3]">
                          {bookings.map((b) => (
                            <tr key={b.id} className="hover:bg-[#FAF9F6] transition">
                              <td className="px-4 py-3">
                                <span className="font-mono font-bold text-[#8B5E34] block">{b.booking_number}</span>
                                <span className="font-bold text-[#2D2A26]">{b.guest_name}</span>
                                <span className="text-[11px] text-[#6B6658] block">{b.guest_phone || b.guest_email}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div><strong className="text-[#2D2A26]">{formatDate(b.check_in)}</strong> au <strong className="text-[#2D2A26]">{formatDate(b.check_out)}</strong></div>
                                <span className="text-[#6B6658] text-[11px]">{b.nights_count} nuit(s) • {b.guests_adults} adulte(s)</span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-[#2D2A26]">
                                {b.room_type?.name || 'Chambre'}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-serif font-bold text-[#8B5E34] block">{formatFCFA(b.total_price)}</span>
                                <span className="text-[10px] text-[#6B6658]">Com. 10%: {formatFCFA(b.commission_amount || b.total_price * 0.1)}</span>
                              </td>
                              <td className="px-4 py-3">
                                {b.status === 'confirmed' && (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#ECF3E5] text-[#3F6212] border border-[#D1DBC2]">
                                    Confirmée (Payé)
                                  </span>
                                )}
                                {b.status === 'pending' && (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#F0EDE4] text-[#8B5E34] border border-[#E6E2D3]">
                                    En attente
                                  </span>
                                )}
                                {b.status === 'cancelled' && (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    Annulée
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {b.status === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')}
                                      className="px-2.5 py-1 bg-[#3F6212] hover:bg-[#365314] text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                                      title="Valider le paiement reçu et confirmer"
                                    >
                                      <CheckCircle2 size={12} />
                                      <span>Confirmer paiement</span>
                                    </button>
                                  )}
                                  {b.status !== 'cancelled' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                                      className="px-2.5 py-1 bg-[#FAF9F6] hover:bg-rose-50 hover:text-rose-700 text-[#6B6658] font-bold rounded-lg text-[11px] border border-[#E6E2D3] cursor-pointer"
                                      title="Annuler cette réservation"
                                    >
                                      <XCircle size={12} />
                                      <span>Annuler</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: ROOMS CONFIGURATION */}
            {activeTab === 'rooms' && (
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs flex items-center justify-between">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#2D2A26]">
                      Types de chambres enregistrés ({rooms.length})
                    </h3>
                    <p className="text-xs text-[#6B6658]">Définissez vos tarifs par nuitée en FCFA et les capacités d'accueil</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddRoomOpen(true)}
                    className="px-3.5 py-2 bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <PlusCircle size={15} />
                    <span>Ajouter un type de chambre</span>
                  </button>
                </div>

                {rooms.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-dashed border-[#E6E2D3] text-center space-y-2">
                    <p className="text-sm font-bold text-[#2D2A26]">Aucune chambre créée</p>
                    <p className="text-xs text-[#6B6658]">Ajoutez au moins une chambre pour rendre votre hôtel réservable.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rooms.map((r) => (
                      <div key={r.id} className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-serif font-bold text-base text-[#2D2A26]">{r.name}</h4>
                            <p className="text-xs text-[#6B6658]">{r.bed_type} • Capacité {r.capacity_adults} adulte(s)</p>
                          </div>
                          <span className="text-base font-serif font-bold text-[#8B5E34]">
                            {formatFCFA(r.price_per_night)} / nuit
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6B6658] pt-2 border-t border-[#E6E2D3]">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-[#FAF9F6] border border-[#E6E2D3] px-2 py-0.5 rounded font-semibold text-[#2D2A26]">
                              {r.total_rooms} unité(s) dispo
                            </span>
                            {r.breakfast_included && (
                              <span className="bg-[#ECF3E5] text-[#3F6212] border border-[#D1DBC2] px-2 py-0.5 rounded font-bold">
                                Petit-déjeuner inclus
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setCalendarSelectedRoomId(r.id);
                              setActiveTab('calendar');
                            }}
                            className="px-2.5 py-1 bg-[#FAF9F6] hover:bg-[#F0EDE4] text-[#8B5E34] font-bold rounded-lg border border-[#E6E2D3] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                          >
                            <Calendar size={12} />
                            <span>Gérer calendrier & tarifs</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: CALENDAR & AVAILABILITY */}
            {activeTab === 'calendar' && (
              <RoomAvailabilityCalendar
                rooms={rooms}
                selectedRoomId={calendarSelectedRoomId || (rooms.length > 0 ? rooms[0].id : undefined)}
                onRoomSelect={(id) => setCalendarSelectedRoomId(id)}
              />
            )}
          </>
        )}

      </div>

      {/* MODAL: ADD NEW HOTEL */}
      {isAddHotelOpen && (
        <div className="fixed inset-0 z-50 bg-[#2D2A26]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl border border-[#E6E2D3] max-h-[90vh] overflow-y-auto">
            
            <div className="bg-[#3F6212] text-white p-6 rounded-t-3xl flex items-center justify-between">
              <div>
                <span className="text-xs text-[#E6E2D3] font-bold uppercase tracking-wider">Teranga Booking</span>
                <h3 className="text-lg font-serif font-bold">Inscrire un nouvel établissement</h3>
              </div>
              <button
                onClick={() => setIsAddHotelOpen(false)}
                className="text-[#D1DBC2] hover:text-white font-bold text-sm cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleCreateHotelSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">Nom de l'établissement *</label>
                  <input
                    type="text"
                    required
                    value={newHotelName}
                    onChange={(e) => setNewHotelName(e.target.value)}
                    placeholder="Ex: Hôtel Teranga Lodge Saly"
                    className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">Type d'hébergement *</label>
                  <select
                    value={newHotelCategory}
                    onChange={(e) => setNewHotelCategory(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none font-bold focus:border-[#3F6212]"
                  >
                    <option value="hotel">Hôtel & Resort</option>
                    <option value="lodge">Lodge & Écolodge</option>
                    <option value="campement">Campement touristique</option>
                    <option value="residence">Résidence / Appartement</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">Région du Sénégal *</label>
                  <select
                    value={newHotelRegion}
                    onChange={(e) => setNewHotelRegion(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none font-bold focus:border-[#3F6212]"
                  >
                    {SENEGAL_REGIONS.map((r) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">Ville / Localité *</label>
                  <input
                    type="text"
                    required
                    value={newHotelCity}
                    onChange={(e) => setNewHotelCity(e.target.value)}
                    placeholder="Ex: Saly Portudal, Almadies, Ndangane..."
                    className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#2D2A26] mb-1">Adresse complète *</label>
                <input
                  type="text"
                  required
                  value={newHotelAddress}
                  onChange={(e) => setNewHotelAddress(e.target.value)}
                  placeholder="Ex: Route des Saly Niakh-Niakhal, Face à la mer"
                  className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#2D2A26] mb-1">Description de l'hébergement *</label>
                <textarea
                  rows={3}
                  required
                  value={newHotelDescription}
                  onChange={(e) => setNewHotelDescription(e.target.value)}
                  placeholder="Présentez les points forts de votre établissement, l'accès à la mer, le calme, les spécialités culinaires..."
                  className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">Téléphone de réception *</label>
                  <input
                    type="tel"
                    required
                    value={newHotelPhone}
                    onChange={(e) => setNewHotelPhone(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">Photo principale (URL)</label>
                  <input
                    type="url"
                    value={newHotelPhotoUrl}
                    onChange={(e) => setNewHotelPhotoUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-[#E6E2D3]">
                <button
                  type="button"
                  onClick={() => setIsAddHotelOpen(false)}
                  className="px-4 py-2 text-[#6B6658] font-bold hover:bg-[#FAF9F6] rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreatingHotel}
                  className="px-5 py-2 bg-[#3F6212] hover:bg-[#365314] text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isCreatingHotel ? 'Publication...' : 'Publier mon hébergement'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: ADD NEW ROOM TYPE */}
      {isAddRoomOpen && selectedHotel && (
        <div className="fixed inset-0 z-50 bg-[#2D2A26]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-[#E6E2D3]">
            
            <div className="bg-[#3F6212] text-white p-6 rounded-t-3xl flex items-center justify-between">
              <div>
                <span className="text-xs text-[#E6E2D3] font-bold uppercase">{selectedHotel.name}</span>
                <h3 className="text-lg font-serif font-bold">Ajouter un type de chambre</h3>
              </div>
              <button
                onClick={() => setIsAddRoomOpen(false)}
                className="text-[#D1DBC2] hover:text-white font-bold text-sm cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleCreateRoomSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#2D2A26] mb-1">Nom de la chambre *</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Ex: Chambre Double Supérieure Vue Mer"
                  className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">Prix par nuit (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min={5000}
                    step={1000}
                    value={newRoomPrice}
                    onChange={(e) => setNewRoomPrice(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none font-bold focus:border-[#3F6212]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">Quantité disponible</label>
                  <input
                    type="number"
                    min={1}
                    value={newRoomQty}
                    onChange={(e) => setNewRoomQty(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none font-bold focus:border-[#3F6212]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">Capacité adultes</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#2D2A26] mb-1">Type de lit</label>
                  <input
                    type="text"
                    value={newRoomBedType}
                    onChange={(e) => setNewRoomBedType(e.target.value)}
                    placeholder="1 Grand Lit Double King"
                    className="w-full p-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 font-bold text-[#2D2A26] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRoomBreakfast}
                    onChange={(e) => setNewRoomBreakfast(e.target.checked)}
                    className="w-4 h-4 rounded text-[#3F6212] focus:ring-[#3F6212]"
                  />
                  <span>Petit-déjeuner inclus dans ce tarif</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-[#E6E2D3]">
                <button
                  type="button"
                  onClick={() => setIsAddRoomOpen(false)}
                  className="px-4 py-2 text-[#6B6658] font-bold hover:bg-[#FAF9F6] rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRoom}
                  className="px-5 py-2 bg-[#3F6212] hover:bg-[#365314] text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isCreatingRoom ? 'Ajout...' : 'Créer la chambre'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
