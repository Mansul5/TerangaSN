import React, { useEffect, useState } from 'react';
import { 
  MapPin, 
  Heart, 
  Share2, 
  ShieldCheck, 
  Calendar, 
  Users, 
  Bed, 
  ChevronLeft, 
  Star, 
  Sparkles, 
  Clock, 
  Phone, 
  Mail, 
  MessageSquarePlus, 
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { Hotel, RoomType, Review } from '@/src/types';
import { 
  fetchHotelById, 
  fetchHotelRooms, 
  fetchHotelReviews, 
  submitReview, 
  toggleFavorite,
  calculateStayPricing,
  checkRoomAvailabilityRPC
} from '@/src/lib/supabase/api';
import { formatFCFA, formatDistance, getRatingLabel, getCategoryLabel, formatDate, calculateNights } from '@/src/lib/formatters';
import { BadgeEquipement } from '@/src/components/BadgeEquipement';
import { RoomCard } from '@/src/components/RoomCard';
import { ReviewCard } from '@/src/components/ReviewCard';
import { InteractiveMap } from '@/src/components/InteractiveMap';
import { useAuth } from '@/src/context/AuthContext';

interface HotelDetailPageProps {
  hotelId: string;
  searchParams?: {
    checkIn?: string;
    checkOut?: string;
    adults?: number;
    children?: number;
    rooms?: number;
  };
  onBack: () => void;
  onProceedToBooking: (bookingPayload: {
    hotel: Hotel;
    roomType: RoomType;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    roomsCount: number;
    nightsCount: number;
    totalPrice: number;
  }) => void;
  onAuthRequired: () => void;
}

export const HotelDetailPage: React.FC<HotelDetailPageProps> = ({
  hotelId,
  searchParams,
  onBack,
  onProceedToBooking,
  onAuthRequired,
}) => {
  const { user } = useAuth();
  
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected Room and booking dates
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [checkIn, setCheckIn] = useState<string>(searchParams?.checkIn || new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [checkOut, setCheckOut] = useState<string>(searchParams?.checkOut || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
  const [adults, setAdults] = useState<number>(searchParams?.adults || 2);
  const [children, setChildren] = useState<number>(searchParams?.children || 0);
  const [roomsCount, setRoomsCount] = useState<number>(searchParams?.rooms || 1);

  // Gallery active photo
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Review Form State
  const [isReviewFormOpen, setIsReviewFormOpen] = useState<boolean>(false);
  const [reviewRating, setReviewRating] = useState<number>(9);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewGuestName, setReviewGuestName] = useState<string>(user?.email?.split('@')[0] || '');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);
  const [reviewSuccess, setReviewSuccess] = useState<boolean>(false);

  // Dynamic Room Availability and Pricing Map
  const [roomPricingMap, setRoomPricingMap] = useState<Record<string, {
    totalPrice: number;
    averageNightlyPrice: number;
    hasSpecialRates: boolean;
    isAvailable: boolean;
    minAvailable?: number;
  }>>({});

  const nightsCount = calculateNights(checkIn, checkOut);

  // Compute pricing and availability for all rooms whenever dates or rooms change
  useEffect(() => {
    if (!rooms.length || !checkIn || !checkOut) return;

    let isMounted = true;
    async function loadPricingAndAvailability() {
      const results: Record<string, any> = {};
      for (const room of rooms) {
        try {
          const [pricing, isAvail] = await Promise.all([
            calculateStayPricing(room, checkIn, checkOut, roomsCount),
            checkRoomAvailabilityRPC(room.id, checkIn, checkOut, roomsCount),
          ]);
          results[room.id] = {
            totalPrice: pricing.totalPrice,
            averageNightlyPrice: pricing.averageNightlyPrice,
            hasSpecialRates: pricing.hasSpecialRates,
            isAvailable: isAvail,
            minAvailable: pricing.minAvailable,
          };
        } catch {
          results[room.id] = {
            totalPrice: room.price_per_night * nightsCount * roomsCount,
            averageNightlyPrice: room.price_per_night,
            hasSpecialRates: false,
            isAvailable: true,
          };
        }
      }
      if (isMounted) {
        setRoomPricingMap(results);
      }
    }

    loadPricingAndAvailability();
    return () => { isMounted = false; };
  }, [rooms, checkIn, checkOut, roomsCount, nightsCount]);

  useEffect(() => {
    async function loadHotelDetails() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const [hotelRes, roomsRes, reviewsRes] = await Promise.all([
          fetchHotelById(hotelId),
          fetchHotelRooms(hotelId),
          fetchHotelReviews(hotelId),
        ]);

        if (hotelRes.error || !hotelRes.data) {
          setErrorMsg('Impossible de charger les détails de cet établissement.');
        } else {
          setHotel(hotelRes.data);
          setRooms(roomsRes.data || []);
          setReviews(reviewsRes.data || []);
          if (roomsRes.data && roomsRes.data.length > 0) {
            setSelectedRoom(roomsRes.data[0]);
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Erreur inconnue');
      } finally {
        setIsLoading(false);
      }
    }

    loadHotelDetails();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [hotelId]);

  const handleFavoriteToggle = async () => {
    if (!user) {
      onAuthRequired();
      return;
    }
    const { isFavorite: updated } = await toggleFavorite(user.id, hotelId);
    setIsFavorite(updated);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onAuthRequired();
      return;
    }
    try {
      setReviewSubmitting(true);
      const { data, error } = await submitReview({
        hotel_id: hotelId,
        user_id: user.id,
        rating: reviewRating,
        comment: reviewComment,
        guest_name: reviewGuestName || 'Voyageur',
      });

      if (error) throw error;
      setReviewSuccess(true);
      setReviewComment('');
      setTimeout(() => {
        setIsReviewFormOpen(false);
        setReviewSuccess(false);
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l’envoi de votre avis');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleProceed = () => {
    if (!hotel || !selectedRoom) return;
    const pricing = roomPricingMap[selectedRoom.id];
    if (pricing && !pricing.isAvailable) {
      alert('Cette chambre n\'est plus disponible pour les dates sélectionnées.');
      return;
    }
    const totalPrice = pricing?.totalPrice || (selectedRoom.price_per_night * nightsCount * roomsCount);
    onProceedToBooking({
      hotel,
      roomType: selectedRoom,
      checkIn,
      checkOut,
      adults,
      children,
      roomsCount,
      nightsCount,
      totalPrice,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-[#3F6212] mx-auto" size={36} />
          <p className="text-sm font-semibold text-[#6B6658]">Chargement de l'établissement...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !hotel) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] py-16 px-4 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-[#F0EDE4] text-[#8B5E34] rounded-full flex items-center justify-center mx-auto">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-serif font-bold text-[#2D2A26]">Établissement non trouvé</h2>
        <p className="text-sm text-[#6B6658]">{errorMsg || 'Cet hôtel n’existe pas ou a été supprimé.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-[#3F6212] text-white rounded-xl font-bold text-xs hover:bg-[#365314] transition cursor-pointer"
        >
          Retour aux résultats
        </button>
      </div>
    );
  }

  const photos = hotel.photos && hotel.photos.length > 0
    ? hotel.photos
    : ['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80'];

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-24">
      
      {/* Top Breadcrumb & Actions Bar */}
      <div className="bg-white border-b border-[#E6E2D3] sticky top-16 z-30 px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#2D2A26] hover:text-[#3F6212] transition cursor-pointer"
          >
            <ChevronLeft size={18} />
            <span>Tous les hébergements</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFavoriteToggle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6E2D3] text-xs font-semibold hover:bg-[#F0EDE4] transition cursor-pointer"
            >
              <Heart size={14} className={isFavorite ? 'fill-[#8B5E34] text-[#8B5E34]' : 'text-[#6B6658]'} />
              <span>{isFavorite ? 'Enregistré' : 'Sauvegarder'}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6E2D3] text-xs font-semibold hover:bg-[#F0EDE4] transition cursor-pointer"
            >
              <Share2 size={14} className="text-[#6B6658]" />
              <span>{copiedLink ? 'Lien copié !' : 'Partager'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('rooms-selection-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs hidden sm:block cursor-pointer"
            >
              Réserver maintenant
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        
        {/* HOTEL HEADER INFO */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="bg-[#ECF3E5] text-[#3F6212] text-xs font-bold px-2.5 py-0.5 rounded-md uppercase border border-[#D1DBC2]">
              {getCategoryLabel(hotel.category)}
            </span>
            <span className="text-xs text-[#8C887D]">•</span>
            <span className="text-xs text-[#6B6658] font-medium">
              Sénégal • {hotel.region} • {hotel.city}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#2D2A26] tracking-tight">
                {hotel.name}
              </h1>
              <p className="flex items-center gap-1.5 text-xs sm:text-sm text-[#6B6658] mt-1">
                <MapPin size={15} className="text-[#8B5E34] shrink-0" />
                <span>{hotel.address}</span>
                {hotel.distance_beach_m !== null && (
                  <span className="text-[#3F6212] font-semibold ml-2">
                    ({formatDistance(hotel.distance_beach_m)} de la plage)
                  </span>
                )}
              </p>
            </div>

            {/* Rating Box */}
            <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-[#E6E2D3] shadow-xs shrink-0">
              <div className="text-right">
                <p className="text-sm font-bold text-[#2D2A26]">
                  {getRatingLabel(hotel.rating || 8.5)}
                </p>
                <p className="text-xs text-[#8C887D]">
                  {hotel.reviews_count > 0 ? `${hotel.reviews_count} avis vérifiés` : 'Nouveau sur Teranga'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#3F6212] text-white font-black text-lg flex items-center justify-center shadow-xs">
                {hotel.rating && hotel.rating > 0 ? hotel.rating.toFixed(1) : '8.5'}
              </div>
            </div>
          </div>
        </div>

        {/* PHOTO GALLERY */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[380px] sm:h-[480px]">
          {/* Main Large Photo */}
          <div className="lg:col-span-8 h-full rounded-2xl overflow-hidden shadow-xs bg-[#2D2A26] relative">
            <img
              src={photos[activePhotoIdx]}
              alt={hotel.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 bg-[#2D2A26]/80 backdrop-blur-xs text-white text-xs px-3 py-1.5 rounded-lg font-semibold">
              Photo {activePhotoIdx + 1} sur {photos.length}
            </div>
          </div>

          {/* Thumbnail Grid */}
          <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-2.5 overflow-y-auto">
            {photos.map((imgUrl, idx) => (
              <div
                key={idx}
                onClick={() => setActivePhotoIdx(idx)}
                className={`h-28 lg:h-36 rounded-xl overflow-hidden cursor-pointer transition-all border-2 ${
                  activePhotoIdx === idx ? 'border-[#3F6212] ring-2 ring-[#3F6212]/20' : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                <img src={imgUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* TWO COLUMNS: DETAILS & HIGHLIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Description & Amenities */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Description card */}
            <div className="bg-white p-6 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-4">
              <h3 className="text-lg font-serif font-bold text-[#2D2A26]">À propos de l'établissement</h3>
              <p className="text-sm text-[#2D2A26] leading-relaxed whitespace-pre-line">
                {hotel.description}
              </p>

              {/* Checkin / Checkout info */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#E6E2D3] text-xs">
                <div className="flex items-center gap-2 text-[#2D2A26]">
                  <Clock size={16} className="text-[#3F6212] shrink-0" />
                  <div>
                    <span className="font-bold">Arrivée :</span> à partir de {hotel.check_in_time || '14:00'}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[#2D2A26]">
                  <Clock size={16} className="text-[#8B5E34] shrink-0" />
                  <div>
                    <span className="font-bold">Départ :</span> jusqu'à {hotel.check_out_time || '12:00'}
                  </div>
                </div>
              </div>
            </div>

            {/* Amenities Grid */}
            <div className="bg-white p-6 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-4">
              <h3 className="text-lg font-serif font-bold text-[#2D2A26]">Équipements & Services</h3>
              <div className="flex flex-wrap gap-2">
                {hotel.amenities?.map((amenity) => (
                  <BadgeEquipement key={amenity} id={amenity} size="lg" />
                ))}
              </div>
            </div>

            {/* ROOM SELECTION SECTION */}
            <div id="rooms-selection-section" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-serif font-bold text-[#2D2A26]">
                    Disponibilités & Chambres
                  </h3>
                  <p className="text-xs text-[#6B6658]">
                    Sélectionnez la formule qui vous convient pour {nightsCount} nuit{nightsCount > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {rooms.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-[#E6E2D3] text-center space-y-2">
                  <p className="text-sm font-bold text-[#2D2A26]">Aucun type de chambre enregistré pour cet hôtel</p>
                  <p className="text-xs text-[#6B6658]">L'hôtelier n'a pas encore ajouté ses chambres.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      nightsCount={nightsCount}
                      isSelected={selectedRoom?.id === room.id}
                      onSelect={(r) => setSelectedRoom(r)}
                      pricing={roomPricingMap[room.id]}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* REVIEWS SECTION */}
            <div className="bg-white p-6 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-serif font-bold text-[#2D2A26]">Avis des voyageurs</h3>
                  <p className="text-xs text-[#6B6658]">{reviews.length} avis vérifiés</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsReviewFormOpen(!isReviewFormOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ECF3E5] text-[#3F6212] hover:bg-[#DCE9CF] rounded-lg text-xs font-bold transition cursor-pointer border border-[#D1DBC2]"
                >
                  <MessageSquarePlus size={14} />
                  <span>Donner mon avis</span>
                </button>
              </div>

              {/* Review Form */}
              {isReviewFormOpen && (
                <form onSubmit={handleReviewSubmit} className="bg-[#FAF9F6] p-4 rounded-xl border border-[#E6E2D3] space-y-3">
                  <h4 className="text-xs font-bold text-[#2D2A26] uppercase tracking-wider">
                    Partagez votre expérience sur cet établissement
                  </h4>

                  {reviewSuccess && (
                    <div className="p-3 bg-[#ECF3E5] border border-[#D1DBC2] text-[#3F6212] text-xs rounded-lg font-bold">
                      Avis soumis avec succès ! Il sera publié après modération.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#2D2A26] mb-1">Votre nom</label>
                      <input
                        type="text"
                        required
                        value={reviewGuestName}
                        onChange={(e) => setReviewGuestName(e.target.value)}
                        placeholder="Ex: Awa Ndiaye"
                        className="w-full text-xs px-3 py-2 bg-white border border-[#E6E2D3] rounded-lg outline-none focus:border-[#3F6212]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#2D2A26] mb-1">Note globale (/10)</label>
                      <select
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                        className="w-full text-xs px-3 py-2 bg-white border border-[#E6E2D3] rounded-lg outline-none font-bold text-[#2D2A26] focus:border-[#3F6212]"
                      >
                        <option value={10}>10 - Exceptionnel</option>
                        <option value={9}>9 - Fabuleux</option>
                        <option value={8}>8 - Très bien</option>
                        <option value={7}>7 - Bien</option>
                        <option value={6}>6 - Agréable</option>
                        <option value={5}>5 - Moyen</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2D2A26] mb-1">Votre commentaire</label>
                    <textarea
                      required
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Accueil chaleureux, cadre paisible face à la mer..."
                      className="w-full text-xs p-3 bg-white border border-[#E6E2D3] rounded-lg outline-none focus:border-[#3F6212]"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsReviewFormOpen(false)}
                      className="px-3 py-1.5 text-xs text-[#6B6658] font-bold hover:bg-[#F0EDE4] rounded-lg cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={reviewSubmitting}
                      className="px-4 py-1.5 bg-[#3F6212] hover:bg-[#365314] text-white text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      {reviewSubmitting ? 'Envoi...' : 'Publier mon avis'}
                    </button>
                  </div>
                </form>
              )}

              {/* Reviews List */}
              {reviews.length === 0 ? (
                <p className="text-xs text-[#8C887D] italic">
                  Aucun avis pour le moment. Soyez le premier à partager votre expérience !
                </p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((rev) => (
                    <ReviewCard key={rev.id} review={rev} />
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Sticky Booking Widget & Map */}
          <div className="lg:col-span-4 space-y-6 sticky top-32">
            
            {/* Booking Summary Box */}
            <div className="bg-white p-5 rounded-2xl border-2 border-[#3F6212] shadow-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E6E2D3]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#3F6212]">
                  Récapitulatif séjour
                </span>
                <span className="text-xs font-bold text-[#8B5E34] bg-[#F0EDE4] px-2 py-0.5 rounded border border-[#E6E2D3]">
                  {nightsCount} nuit{nightsCount > 1 ? 's' : ''}
                </span>
              </div>

              {/* Dates Modification */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-[#E6E2D3]">
                  <label htmlFor="detail-check-in-input" className="text-[10px] text-[#6B6658] font-bold uppercase block">Arrivée</label>
                  <input
                    id="detail-check-in-input"
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full font-bold text-[#2D2A26] bg-transparent outline-none cursor-pointer"
                  />
                </div>
                <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-[#E6E2D3]">
                  <label htmlFor="detail-check-out-input" className="text-[10px] text-[#6B6658] font-bold uppercase block">Départ</label>
                  <input
                    id="detail-check-out-input"
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full font-bold text-[#2D2A26] bg-transparent outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Selected Room Details */}
              {selectedRoom ? (
                <div className="bg-[#ECF3E5] p-3.5 rounded-xl border border-[#D1DBC2] space-y-1">
                  <p className="text-[11px] font-bold text-[#3F6212] uppercase">Chambre sélectionnée :</p>
                  <p className="text-xs font-bold text-[#2D2A26]">{selectedRoom.name}</p>
                  <p className="text-xs text-[#8B5E34] font-semibold">
                    {formatFCFA(roomPricingMap[selectedRoom.id]?.averageNightlyPrice || selectedRoom.price_per_night)} / nuit
                  </p>
                  {roomPricingMap[selectedRoom.id]?.hasSpecialRates && (
                    <span className="inline-block text-[10px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded">
                      Tarif saisonnier appliqué
                    </span>
                  )}
                  {roomPricingMap[selectedRoom.id]?.isAvailable === false && (
                    <p className="text-xs font-bold text-rose-700 mt-1">
                      ⚠️ Non disponible pour ces dates
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#8B5E34] bg-[#F0EDE4] p-2.5 rounded-xl border border-[#E6E2D3]">
                  Veuillez choisir une chambre dans la liste ci-contre.
                </p>
              )}

              {/* Price calculation */}
              {selectedRoom && (
                <div className="pt-2 border-t border-[#E6E2D3] space-y-1">
                  <div className="flex justify-between text-xs text-[#6B6658]">
                    <span>Pour {nightsCount} nuit{nightsCount > 1 ? 's' : ''} ({roomsCount} ch.)</span>
                    <span>
                      {formatFCFA(roomPricingMap[selectedRoom.id]?.totalPrice || (selectedRoom.price_per_night * nightsCount * roomsCount))}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2">
                    <span className="text-sm font-serif font-bold text-[#2D2A26]">Total à régler sur place :</span>
                    <span className="text-xl font-serif font-bold text-[#8B5E34]">
                      {formatFCFA(roomPricingMap[selectedRoom.id]?.totalPrice || (selectedRoom.price_per_night * nightsCount * roomsCount))}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8C887D]">Taxes et frais inclus • Aucun débit en ligne</p>
                </div>
              )}

              {/* CTA Button */}
              <button
                type="button"
                id="proceed-to-booking-btn"
                disabled={!selectedRoom || roomPricingMap[selectedRoom.id]?.isAvailable === false}
                onClick={handleProceed}
                className="w-full py-3.5 bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] text-white font-extrabold text-sm rounded-xl transition shadow-xs hover:shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {roomPricingMap[selectedRoom?.id || '']?.isAvailable === false ? (
                  <span>Non disponible pour ces dates</span>
                ) : (
                  <span>Confirmer & Réserver</span>
                )}
              </button>

              <div className="flex items-center gap-2 text-xs text-[#6B6658] pt-1">
                <ShieldCheck size={16} className="text-[#3F6212] shrink-0" />
                <span>Paiement direct à l'hôtel à l'arrivée</span>
              </div>
            </div>

            {/* Location & Interactive Mini Map */}
            <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] shadow-xs space-y-3">
              <h4 className="font-serif font-bold text-sm text-[#2D2A26] flex items-center gap-1.5">
                <MapPin size={16} className="text-[#8B5E34]" />
                <span>Emplacement</span>
              </h4>
              <p className="text-xs text-[#6B6658]">{hotel.address}, {hotel.city}</p>
              <div className="h-44 rounded-xl overflow-hidden border border-[#E6E2D3]">
                <InteractiveMap
                  hotels={[hotel]}
                  selectedHotelId={hotel.id}
                  onSelectHotel={() => {}}
                  className="h-full w-full"
                />
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
