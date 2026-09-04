import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  MapPin, 
  Calendar, 
  Users, 
  Bed, 
  Clock, 
  ChevronLeft, 
  AlertCircle, 
  Loader2, 
  Phone, 
  Mail, 
  User, 
  FileText,
  Building2,
  Sparkles,
  ArrowRight,
  Lock,
  Tag
} from 'lucide-react';
import { Hotel, RoomType, Booking } from '@/src/types';
import { createBooking, checkRoomAvailabilityRPC, calculateStayPricing } from '@/src/lib/supabase/api';
import { formatFCFA, formatDate, generateBookingNumber } from '@/src/lib/formatters';
import { useAuth } from '@/src/context/AuthContext';
import confetti from 'canvas-confetti';

interface BookingTunnelPageProps {
  hotel: Hotel;
  roomType: RoomType;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomsCount: number;
  nightsCount: number;
  totalPrice: number;
  onBack: () => void;
  onViewBookings: () => void;
}

export const BookingTunnelPage: React.FC<BookingTunnelPageProps> = ({
  hotel,
  roomType,
  checkIn,
  checkOut,
  adults,
  children,
  roomsCount,
  nightsCount,
  totalPrice: initialTotalPrice,
  onBack,
  onViewBookings,
}) => {
  const { user, profile } = useAuth();

  // Guest details form state
  const [fullName, setFullName] = useState<string>(profile?.full_name || '');
  const [email, setEmail] = useState<string>(profile?.email || user?.email || '');
  const [phone, setPhone] = useState<string>(profile?.phone || '');
  const [specialRequests, setSpecialRequests] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Dynamic Stay Pricing & RPC Availability State
  const [isCheckingAvailability, setIsCheckingAvailability] = useState<boolean>(true);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [minAvailableRooms, setMinAvailableRooms] = useState<number>(roomType.total_rooms || 1);
  const [stayPricing, setStayPricing] = useState<{
    totalPrice: number;
    averageNightlyPrice: number;
    hasSpecialRates: boolean;
    nightlyBreakdown: { date: string; price: number; isOverride: boolean; roomsAvailable: number }[];
  }>({
    totalPrice: initialTotalPrice,
    averageNightlyPrice: roomType.price_per_night,
    hasSpecialRates: false,
    nightlyBreakdown: [],
  });

  // Check Availability RPC and Calculate Stay Pricing
  useEffect(() => {
    async function verifyAvailabilityAndPricing() {
      setIsCheckingAvailability(true);
      try {
        const [availRes, pricingRes] = await Promise.all([
          checkRoomAvailabilityRPC(roomType.id, checkIn, checkOut, roomsCount),
          calculateStayPricing(roomType, checkIn, checkOut, roomsCount),
        ]);

        setIsAvailable(availRes.isAvailable);
        setMinAvailableRooms(availRes.minAvailable);
        setStayPricing({
          totalPrice: pricingRes.totalPrice,
          averageNightlyPrice: pricingRes.averageNightlyPrice,
          hasSpecialRates: pricingRes.hasSpecialRates,
          nightlyBreakdown: pricingRes.nightlyBreakdown,
        });
      } catch (err) {
        console.warn('Availability verification warning:', err);
      } finally {
        setIsCheckingAvailability(false);
      }
    }

    verifyAvailabilityAndPricing();
  }, [roomType.id, checkIn, checkOut, roomsCount]);

  const effectiveTotalPrice = stayPricing.totalPrice > 0 ? stayPricing.totalPrice : initialTotalPrice;

  // Commission calculation (10% by default)
  const commissionRate = hotel.commission_rate || 0.10;
  const commissionAmount = Math.round(effectiveTotalPrice * commissionRate);

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // 1. Mandatory Pre-Booking Validation: Check availability via Postgres RPC
      const { isAvailable: canBook, error: checkErr } = await checkRoomAvailabilityRPC(
        roomType.id,
        checkIn,
        checkOut,
        roomsCount
      );

      if (checkErr) {
        console.warn('RPC check warning:', checkErr);
      }

      if (!canBook) {
        setIsAvailable(false);
        throw new Error("Plus de disponibilité pour ces dates. Ce type de chambre est complet ou indisponible sur la période demandée.");
      }

      const bookingNumber = generateBookingNumber();

      const { data, error } = await createBooking({
        booking_number: bookingNumber,
        hotel_id: hotel.id,
        room_type_id: roomType.id,
        user_id: user?.id || null,
        check_in: checkIn,
        check_out: checkOut,
        guests_adults: adults,
        guests_children: children,
        rooms_count: roomsCount,
        nights_count: nightsCount,
        total_price: effectiveTotalPrice,
        commission_amount: commissionAmount,
        guest_name: fullName.trim(),
        guest_email: email.trim(),
        guest_phone: phone.trim(),
        special_requests: specialRequests.trim() || null,
        status: 'pending',
        payment_status: 'on_site_unpaid',
      });

      if (error) throw error;

      setConfirmedBooking(data || {
        id: 'tmp-id',
        booking_number: bookingNumber,
        hotel_id: hotel.id,
        room_type_id: roomType.id,
        user_id: user?.id || null,
        check_in: checkIn,
        check_out: checkOut,
        guests_adults: adults,
        guests_children: children,
        rooms_count: roomsCount,
        nights_count: nightsCount,
        total_price: effectiveTotalPrice,
        commission_amount: commissionAmount,
        guest_name: fullName,
        guest_email: email,
        guest_phone: phone,
        special_requests: specialRequests,
        status: 'pending',
        payment_status: 'on_site_unpaid',
        created_at: new Date().toISOString(),
      });

      // Trigger celebratory confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

    } catch (err: any) {
      console.error('Booking submission error:', err);
      setErrorMsg(err.message || 'Impossible d’enregistrer la réservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS CONFIRMATION VIEW
  if (confirmedBooking) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] py-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Header Banner */}
          <div className="bg-[#3F6212] text-white p-8 rounded-3xl shadow-sm text-center space-y-3">
            <div className="w-16 h-16 bg-white text-[#3F6212] rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 size={36} />
            </div>
            <span className="inline-block bg-[#365314] px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
              Réservation Enregistrée avec Succès
            </span>
            <h1 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight">
              Merci pour votre réservation, {confirmedBooking.guest_name} !
            </h1>
            <p className="text-sm text-[#D1DBC2] max-w-xl mx-auto">
              Votre demande a bien été transmise à l'établissement <span className="font-bold text-white">{hotel.name}</span>.
            </p>
          </div>

          {/* Booking Confirmation Card */}
          <div className="bg-white rounded-3xl border border-[#E6E2D3] shadow-xs p-6 sm:p-8 space-y-6">
            
            {/* Number and Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6E2D3]">
              <div>
                <span className="text-xs text-[#6B6658] font-semibold block">Numéro de confirmation</span>
                <span className="text-xl sm:text-2xl font-serif font-bold text-[#8B5E34] font-mono tracking-wider">
                  {confirmedBooking.booking_number}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#F0EDE4] text-[#8B5E34] border border-[#E6E2D3] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
                  <span>Statut : En attente de confirmation hôtel</span>
                </span>
              </div>
            </div>

            {/* Stay Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-3">
                <h4 className="font-serif font-bold text-[#2D2A26] flex items-center gap-2">
                  <Building2 size={16} className="text-[#3F6212]" />
                  <span>Détails de l'hébergement</span>
                </h4>
                <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#E6E2D3] space-y-2 text-xs">
                  <p className="font-serif font-bold text-sm text-[#2D2A26]">{hotel.name}</p>
                  <p className="text-[#6B6658]">{hotel.address}, {hotel.city} ({hotel.region})</p>
                  <p className="text-[#2D2A26] font-semibold pt-1">
                    Chambre : <span className="text-[#3F6212]">{roomType.name}</span>
                  </p>
                  <p className="text-[#8C887D]">
                    {adults} Adulte{adults > 1 ? 's' : ''} {children > 0 ? `• ${children} Enfant(s)` : ''} • {roomsCount} Chambre(s)
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-serif font-bold text-[#2D2A26] flex items-center gap-2">
                  <Calendar size={16} className="text-[#3F6212]" />
                  <span>Dates du séjour ({nightsCount} nuits)</span>
                </h4>
                <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#E6E2D3] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B6658]">Arrivée :</span>
                    <span className="font-bold text-[#2D2A26]">{formatDate(checkIn)} (dès {hotel.check_in_time || '14:00'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B6658]">Départ :</span>
                    <span className="font-bold text-[#2D2A26]">{formatDate(checkOut)} (jusqu'à {hotel.check_out_time || '12:00'})</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#E6E2D3]">
                    <span className="font-bold text-[#2D2A26]">Montant total à régler :</span>
                    <span className="font-serif font-bold text-[#8B5E34] text-sm">{formatFCFA(effectiveTotalPrice)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment on Site Notice */}
            <div className="bg-[#ECF3E5] border border-[#D1DBC2] p-4 rounded-2xl flex items-start gap-3">
              <ShieldCheck size={24} className="text-[#3F6212] shrink-0 mt-0.5" />
              <div className="text-xs text-[#2D2A26] space-y-1">
                <p className="font-bold text-[#3F6212]">Instructions de paiement sur place au Sénégal :</p>
                <p className="text-[#2D2A26] leading-relaxed">
                  Aucun montant n'a été débité en ligne. Vous réglerez directement la somme de <strong className="text-[#8B5E34] font-bold">{formatFCFA(effectiveTotalPrice)}</strong> à l'hôtel lors de votre séjour (en espèces, Orange Money, Wave ou carte bancaire selon les moyens acceptés par l'établissement).
                </p>
                <p className="text-[#6B6658]">
                  L'hôtel passera ensuite votre réservation en statut "Confirmée" (Confirmed).
                </p>
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-[#E6E2D3]">
              <button
                type="button"
                onClick={onViewBookings}
                className="w-full sm:w-auto px-6 py-3 bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Accéder à mes réservations</span>
                <ArrowRight size={16} />
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // BOOKING FORM VIEW
  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-24">
      
      {/* Top Header */}
      <div className="bg-[#3F6212] text-white px-4 sm:px-6 py-6 shadow-xs border-b border-[#365314]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-[#D1DBC2] hover:text-white transition cursor-pointer"
          >
            <ChevronLeft size={18} />
            <span>Modifier la sélection</span>
          </button>
          <div className="text-right">
            <span className="text-xs text-[#E6E2D3] font-bold uppercase tracking-wider block">Étape 2 sur 2</span>
            <h2 className="text-lg font-serif font-bold text-white">Finaliser votre réservation</h2>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        
        {/* Availability Warning if unavailable */}
        {!isAvailable && !isCheckingAvailability && (
          <div className="mb-6 p-5 bg-rose-50 border-2 border-rose-300 rounded-3xl text-rose-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
            <Lock size={22} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-900 text-sm">
                Plus de disponibilité pour ces dates
              </p>
              <p className="leading-relaxed text-rose-800">
                Ce type de chambre (<span className="font-bold">{roomType.name}</span>) n'a plus assez d'unités libres entre le <strong>{formatDate(checkIn)}</strong> et le <strong>{formatDate(checkOut)}</strong>. Veuillez choisir une autre date ou un autre type d'hébergement.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-rose-900 underline hover:no-underline cursor-pointer"
              >
                <span>Changer mes dates ou ma chambre</span>
                <ChevronLeft size={14} className="rotate-180" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Guest Information Form */}
          <div className="lg:col-span-7 space-y-6">
            
            <form onSubmit={handleSubmitBooking} className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E6E2D3] shadow-xs space-y-6">
              <div>
                <h3 className="text-xl font-serif font-bold text-[#2D2A26] tracking-tight">
                  Informations du voyageur principal
                </h3>
                <p className="text-xs text-[#6B6658] mt-1">
                  Ces coordonnées seront directement transmises à l'hôtel pour votre accueil.
                </p>
              </div>

              {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-1.5">
                  Nom et prénom complet *
                </label>
                <div className="flex items-center gap-2 px-3.5 py-3 bg-white border border-[#E6E2D3] rounded-xl focus-within:border-[#3F6212]">
                  <User size={18} className="text-[#8C887D] shrink-0" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Cheikh Anta Diop"
                    className="w-full text-xs sm:text-sm font-semibold text-[#2D2A26] bg-transparent outline-none"
                  />
                </div>
              </div>

              {/* Email & Phone Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1.5">
                    Adresse email de contact *
                  </label>
                  <div className="flex items-center gap-2 px-3.5 py-3 bg-white border border-[#E6E2D3] rounded-xl focus-within:border-[#3F6212]">
                    <Mail size={18} className="text-[#8C887D] shrink-0" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="cheikh@exemple.sn"
                      className="w-full text-xs sm:text-sm font-semibold text-[#2D2A26] bg-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2D2A26] mb-1.5">
                    Numéro de téléphone (Sénégal) *
                  </label>
                  <div className="flex items-center gap-2 px-3.5 py-3 bg-white border border-[#E6E2D3] rounded-xl focus-within:border-[#3F6212]">
                    <Phone size={18} className="text-[#8C887D] shrink-0" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+221 77 000 00 00"
                      className="w-full text-xs sm:text-sm font-semibold text-[#2D2A26] bg-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Special Requests */}
              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-1.5">
                  Demandes particulières (facultatif)
                </label>
                <textarea
                  rows={3}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Heure d'arrivée estimée, besoin d'un lit bébé, lit double plutôt que lits jumeaux..."
                  className="w-full text-xs p-3.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                />
              </div>

              {/* Payment on Site Notice */}
              <div className="p-4 bg-[#ECF3E5] border border-[#D1DBC2] rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-[#3F6212] font-bold text-xs sm:text-sm">
                  <ShieldCheck size={20} className="text-[#3F6212] shrink-0" />
                  <span>Aucun paiement en ligne requis pour cette réservation</span>
                </div>
                <p className="text-xs text-[#2D2A26] leading-relaxed">
                  Le paiement complet de <strong className="text-[#8B5E34] font-bold">{formatFCFA(effectiveTotalPrice)}</strong> se fera directement à votre arrivée à l'hôtel selon les modalités de l'établissement (espèces en FCFA, Wave, Orange Money ou carte).
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="submit-booking-action-btn"
                disabled={isSubmitting || !isAvailable || isCheckingAvailability}
                className="w-full py-4 bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] text-white font-extrabold text-sm sm:text-base rounded-2xl transition shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCheckingAvailability ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Vérification de la disponibilité...</span>
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Enregistrement de la réservation...</span>
                  </>
                ) : !isAvailable ? (
                  <span>Plus de disponibilité pour ces dates</span>
                ) : (
                  <span>Confirmer ma réservation (Paiement sur place)</span>
                )}
              </button>
            </form>

          </div>

          {/* RIGHT: Stay Summary Card */}
          <div className="lg:col-span-5 space-y-6 sticky top-20">
            
            <div className="bg-white p-6 rounded-3xl border border-[#E6E2D3] shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#E6E2D3]">
                <h3 className="font-serif font-bold text-base text-[#2D2A26]">
                  Récapitulatif de votre séjour
                </h3>
                {isCheckingAvailability && (
                  <span className="text-[10px] text-[#8C887D] flex items-center gap-1 font-semibold">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Vérif...</span>
                  </span>
                )}
              </div>

              {/* Hotel snippet */}
              <div className="flex gap-3">
                <img
                  src={hotel.photos?.[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80'}
                  alt={hotel.name}
                  className="w-20 h-20 rounded-xl object-cover shrink-0"
                />
                <div>
                  <span className="text-[10px] font-bold text-[#3F6212] uppercase bg-[#ECF3E5] px-2 py-0.5 rounded border border-[#D1DBC2]">
                    {hotel.region}
                  </span>
                  <h4 className="font-serif font-bold text-sm text-[#2D2A26] mt-1 line-clamp-1">{hotel.name}</h4>
                  <p className="text-xs text-[#6B6658] line-clamp-1">{hotel.address}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2 bg-[#FAF9F6] p-3 rounded-2xl text-xs border border-[#E6E2D3]">
                <div>
                  <span className="text-[#6B6658] text-[10px] font-bold uppercase block">Arrivée</span>
                  <span className="font-bold text-[#2D2A26]">{formatDate(checkIn)}</span>
                </div>
                <div>
                  <span className="text-[#6B6658] text-[10px] font-bold uppercase block">Départ</span>
                  <span className="font-bold text-[#2D2A26]">{formatDate(checkOut)}</span>
                </div>
              </div>

              {/* Room details */}
              <div className="space-y-2 text-xs text-[#6B6658]">
                <div className="flex justify-between">
                  <span className="font-bold text-[#2D2A26]">Chambre sélectionnée :</span>
                  <span className="text-[#3F6212] font-semibold">{roomType.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Capacité :</span>
                  <span>{adults} adulte(s) {children > 0 ? `• ${children} enfant(s)` : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span>Durée :</span>
                  <span>{nightsCount} nuit{nightsCount > 1 ? 's' : ''}</span>
                </div>
                {minAvailableRooms > 0 && minAvailableRooms <= 3 && (
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                    <Sparkles size={13} className="shrink-0" />
                    <span>Forte demande : seulement {minAvailableRooms} chambre(s) restante(s)</span>
                  </div>
                )}
              </div>

              {/* Pricing breakdown with overrides */}
              <div className="pt-3 border-t border-[#E6E2D3] space-y-2 text-xs">
                {stayPricing.hasSpecialRates && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                    <span className="font-bold flex items-center gap-1 text-amber-800">
                      <Tag size={13} />
                      <span>Tarifs saisonniers appliqués sur vos dates</span>
                    </span>
                    <p className="text-[10px] text-amber-700">
                      Certaines nuitées bénéficient d'un tarif ajusté pour la période.
                    </p>
                  </div>
                )}

                {/* Night-by-night breakdown if detailed */}
                {stayPricing.nightlyBreakdown && stayPricing.nightlyBreakdown.length > 0 && (
                  <div className="space-y-1 py-1 max-h-32 overflow-y-auto">
                    {stayPricing.nightlyBreakdown.map((n, i) => (
                      <div key={i} className="flex justify-between text-[11px] text-[#6B6658]">
                        <span>Nuit du {formatDate(n.date)} :</span>
                        <span className="font-semibold text-[#2D2A26]">
                          {formatFCFA(n.price)}
                          {n.isOverride && <span className="ml-1 text-[9px] text-[#8B5E34] font-bold">(Tarif spécial)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-2 border-t border-[#E6E2D3]">
                  <div>
                    <span className="text-sm font-serif font-bold text-[#2D2A26] block">Total du séjour</span>
                    <span className="text-[10px] text-[#8C887D]">Taxes et frais inclus ({roomsCount} ch.)</span>
                  </div>
                  <span className="text-2xl font-serif font-bold text-[#8B5E34]">
                    {formatFCFA(effectiveTotalPrice)}
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>

    </div>
  );
};
