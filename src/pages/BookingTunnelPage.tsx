import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Building2, CalendarDays, CheckCircle2, ChevronLeft, CreditCard, Loader2, LockKeyhole, Mail, Phone, ShieldCheck, UserRound, Users, BedDouble, Info } from 'lucide-react';
import { Lodging, RoomType, Booking } from '@/src/types';
import { createBooking, checkRoomAvailabilityRPC, calculateStayPricing } from '@/src/lib/supabase/api';
import { formatFCFA, formatDate, generateBookingNumber } from '@/src/lib/formatters';
import { useAuth } from '@/src/context/AuthContext';
import confetti from 'canvas-confetti';

interface BookingTunnelPageProps {
  hotel: Lodging;
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

type Pricing = {
  totalPrice: number;
  averageNightlyPrice: number;
  hasSpecialRates: boolean;
  nightlyBreakdown: { date: string; price: number; isOverride: boolean; roomsAvailable: number }[];
};

const fieldClass = 'w-full min-w-0 rounded-xl border border-[#DDDCD2] bg-white px-4 py-3.5 text-sm text-[#30352F] outline-none transition focus:border-[#284C3B] focus:ring-2 focus:ring-[#284C3B]/10';

export const BookingTunnelPage: React.FC<BookingTunnelPageProps> = ({
  hotel, roomType, checkIn, checkOut, adults, children, roomsCount, nightsCount,
  totalPrice: initialTotalPrice, onBack, onViewBookings,
}) => {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [minAvailableRooms, setMinAvailableRooms] = useState(0);
  const [pricingVerified, setPricingVerified] = useState(false);
  const [stayPricing, setStayPricing] = useState<Pricing>({
    totalPrice: initialTotalPrice,
    averageNightlyPrice: roomType.price_per_night,
    hasSpecialRates: false,
    nightlyBreakdown: [],
  });

  useEffect(() => {
    if (profile?.full_name) setFullName(prev => prev || profile.full_name || '');
    if (profile?.email || user?.email) setEmail(prev => prev || profile?.email || user?.email || '');
    if (profile?.phone) setPhone(prev => prev || profile.phone || '');
  }, [profile, user]);

  useEffect(() => {
    let active = true;
    setIsCheckingAvailability(true);
    setIsAvailable(false);
    setPricingVerified(false);
    setErrorMsg(null);
    Promise.all([
      checkRoomAvailabilityRPC(roomType.id, checkIn, checkOut, roomsCount),
      calculateStayPricing(roomType, checkIn, checkOut, roomsCount),
    ]).then(([availability, pricing]) => {
      if (!active) return;
      if (availability.error) throw availability.error;
      setIsAvailable(Boolean(availability.isAvailable));
      setMinAvailableRooms(availability.minAvailable || 0);
      setStayPricing({
        totalPrice: pricing.totalPrice,
        averageNightlyPrice: pricing.averageNightlyPrice,
        hasSpecialRates: pricing.hasSpecialRates,
        nightlyBreakdown: pricing.nightlyBreakdown,
      });
      setPricingVerified(true);
    }).catch(err => {
      if (!active) return;
      console.error('Availability/pricing verification error:', err);
      setIsAvailable(false);
      setPricingVerified(false);
      setMinAvailableRooms(0);
      setErrorMsg('Impossible de vérifier la disponibilité ou le tarif. Revenez à la sélection et réessayez.');
    }).finally(() => { if (active) setIsCheckingAvailability(false); });
    return () => { active = false; };
  }, [roomType, checkIn, checkOut, roomsCount]);

  const effectiveTotalPrice = pricingVerified ? stayPricing.totalPrice : initialTotalPrice;
  const validStay = roomsCount > 0 && nightsCount > 0 && adults > 0 && checkIn < checkOut && effectiveTotalPrice > 0;
  const canSubmit = isAvailable && pricingVerified && !isCheckingAvailability && validStay && !isSubmitting;
  // Commission interne : ne s'ajoute jamais au prix payé par le voyageur.
  const commissionRate = hotel.commission_rate ?? 0.1;
  const commissionAmount = Math.round(effectiveTotalPrice * commissionRate);

  const handleSubmitBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setErrorMsg(null);
    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    if (!cleanFullName || !cleanEmail || !cleanPhone) {
      setErrorMsg('Renseignez votre nom, votre adresse email et votre téléphone.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Veuillez saisir une adresse email valide.');
      return;
    }
    if (!canSubmit) {
      setErrorMsg('La disponibilité et le tarif doivent être vérifiés avant l’envoi de la demande.');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const availability = await checkRoomAvailabilityRPC(roomType.id, checkIn, checkOut, roomsCount);
      if (availability.error) throw new Error('Impossible de vérifier la disponibilité. Réessayez.');
      if (!availability.isAvailable) {
        setIsAvailable(false);
        setMinAvailableRooms(availability.minAvailable || 0);
        throw new Error('Cette offre n’est plus disponible aux dates sélectionnées.');
      }
      // Le tarif affiché et enregistré provient de la même vérification du séjour.
      const refreshedPrice = await calculateStayPricing(roomType, checkIn, checkOut, roomsCount);
      if (!Number.isFinite(refreshedPrice.totalPrice) || refreshedPrice.totalPrice <= 0) {
        throw new Error('Le tarif ne peut pas être confirmé pour ce séjour.');
      }
      if (refreshedPrice.totalPrice !== effectiveTotalPrice) {
        setStayPricing({
          totalPrice: refreshedPrice.totalPrice,
          averageNightlyPrice: refreshedPrice.averageNightlyPrice,
          hasSpecialRates: refreshedPrice.hasSpecialRates,
          nightlyBreakdown: refreshedPrice.nightlyBreakdown,
        });
        throw new Error('Le tarif du séjour a changé. Vérifiez le nouveau montant puis envoyez à nouveau votre demande.');
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
        guest_name: cleanFullName,
        guest_email: cleanEmail,
        guest_phone: cleanPhone,
        special_requests: specialRequests.trim() || null,
        status: 'pending',
        payment_status: 'on_site_unpaid',
      });
      if (error) throw error;
      if (!data) throw new Error('La demande a été envoyée, mais sa confirmation technique est indisponible. Vérifiez vos réservations avant de réessayer.');
      setConfirmedBooking(data);
      try { confetti({ particleCount: 65, spread: 65, origin: { y: 0.65 } }); } catch { /* Effet visuel facultatif. */ }
    } catch (err: unknown) {
      console.error('Booking submission error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Impossible d’enregistrer la demande. Réessayez.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (confirmedBooking) {
    return (
      <main className="min-h-screen bg-[#F7F5EF] px-4 py-10 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="relative overflow-hidden rounded-[28px] bg-[#1B382D] px-6 py-10 text-center text-white sm:px-12">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/15"><CheckCircle2 size={34} /></div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E9E2D5]">Demande enregistrée</p>
            <h1 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">Votre séjour se prépare.</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/80">Votre demande a été transmise à {hotel.name}. L'établissement doit encore la confirmer.</p>
          </section>
          <section className="space-y-6 rounded-[26px] border border-[#E9E2D5] bg-white p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E9E2D5] pb-5">
              <div><p className="text-xs text-[#74786F]">Référence de la demande</p><p className="mt-1 break-all font-mono text-lg font-bold text-[#284C3B]">{confirmedBooking.booking_number}</p></div>
              <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">En attente de confirmation</span>
            </div>
            <h2 className="font-serif text-2xl text-[#30352F]">{hotel.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#F7F5EF] p-4"><p className="text-xs text-[#74786F]">Arrivée</p><p className="mt-1 font-semibold">{formatDate(checkIn)}</p><p className="mt-1 text-xs text-[#74786F]">À partir de {hotel.check_in_time || '14:00'}</p></div>
              <div className="rounded-2xl bg-[#F7F5EF] p-4"><p className="text-xs text-[#74786F]">Départ</p><p className="mt-1 font-semibold">{formatDate(checkOut)}</p><p className="mt-1 text-xs text-[#74786F]">Jusqu'à {hotel.check_out_time || '12:00'}</p></div>
            </div>
            <p className="text-sm text-[#5D645B]">{roomType.name} · {roomsCount} chambre{roomsCount > 1 ? 's' : ''} · {nightsCount} nuit{nightsCount > 1 ? 's' : ''}</p>
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#E9E2D5] pt-5"><div><p className="text-xs text-[#74786F]">Montant du séjour</p><p className="font-serif text-2xl font-bold text-[#284C3B]">{formatFCFA(confirmedBooking.total_price)}</p></div><span className="text-xs text-[#74786F]">Paiement non encore enregistré</span></div>
            <div className="flex gap-3 rounded-2xl bg-[#F0F4EE] p-4 text-sm leading-6 text-[#284C3B]"><ShieldCheck className="mt-0.5 shrink-0" size={20}/><p>Il ne s'agit pas encore d'une réservation confirmée. Le paiement et les conditions applicables seront précisés par l'établissement.</p></div>
            <button type="button" onClick={onViewBookings} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#284C3B] px-5 py-4 font-semibold text-white hover:bg-[#1B382D]">Consulter mes réservations <ArrowRight size={18}/></button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-0 bg-[#F7F5EF] pb-20 text-[#30352F]">
      <header className="relative bg-[#1B382D] px-4 pb-12 pt-6 text-white sm:pb-16 sm:pt-9">
        <div className="mx-auto max-w-6xl">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-white/80 transition hover:text-white"><ChevronLeft size={17}/> Modifier mon séjour</button>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
            <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#D4C39E]">TerangaSN · Étape 2 sur 2</p><h1 className="max-w-xl font-serif text-3xl leading-tight sm:text-5xl">Votre séjour, en toute clarté.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-white/75">Vérifiez votre sélection et transmettez votre demande à l'établissement.</p></div>
            <div className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs text-white/90"><LockKeyhole size={15}/> Informations transmises de façon sécurisée</div>
          </div>
        </div>
      </header>
      <div className="relative z-10 mx-auto -mt-5 grid max-w-6xl min-w-0 gap-6 px-4 lg:grid-cols-12 lg:gap-8">
        <section className="min-w-0 space-y-5 lg:col-span-7">
          {(!isAvailable && !isCheckingAvailability) && (
            <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={20} className="shrink-0"/><div><p className="font-semibold">Disponibilité non confirmée</p><p className="mt-1">Cette offre est indisponible ou sa disponibilité n'a pas pu être vérifiée. Vous pouvez modifier votre sélection.</p><button type="button" onClick={onBack} className="mt-2 font-semibold underline">Modifier mes dates</button></div></div>
          )}
          <form onSubmit={handleSubmitBooking} className="space-y-6 rounded-[26px] border border-[#E9E2D5] bg-white p-5 shadow-sm sm:p-8">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9F0E9] text-[#284C3B]"><UserRound size={21}/></span><div><h2 className="font-serif text-2xl font-semibold">Vos coordonnées</h2><p className="mt-1 text-sm text-[#74786F]">Pour que l'établissement puisse vous contacter à propos de votre demande.</p></div></div>
            {errorMsg && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={18} className="shrink-0"/>{errorMsg}</div>}
            <div><label htmlFor="booking-name" className="mb-2 block text-sm font-semibold">Nom et prénom <span className="text-rose-600">*</span></label><input id="booking-name" autoComplete="name" required maxLength={150} className={fieldClass} placeholder="Votre nom complet" value={fullName} onChange={e => setFullName(e.target.value)}/></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0"><label htmlFor="booking-email" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Mail size={15}/> Adresse email *</label><input id="booking-email" type="email" autoComplete="email" required maxLength={254} className={fieldClass} placeholder="vous@exemple.sn" value={email} onChange={e => setEmail(e.target.value)}/></div>
              <div className="min-w-0"><label htmlFor="booking-phone" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Phone size={15}/> Téléphone *</label><input id="booking-phone" type="tel" autoComplete="tel" required maxLength={30} className={fieldClass} placeholder="+221 77 000 00 00" value={phone} onChange={e => setPhone(e.target.value)}/></div>
            </div>
            <div><label htmlFor="booking-requests" className="mb-2 block text-sm font-semibold">Une demande particulière ? <span className="font-normal text-[#74786F]">Facultatif</span></label><textarea id="booking-requests" rows={4} maxLength={1500} className={fieldClass} placeholder="Heure d'arrivée prévue, lit bébé, accessibilité…" value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}/><p className="mt-2 text-xs text-[#74786F]">Les demandes particulières dépendent des possibilités de l'établissement.</p></div>
            <div className="flex items-start gap-3 rounded-2xl bg-[#F0F4EE] p-4"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#284C3B]"/><p className="text-sm leading-6 text-[#365345]">Votre demande sera enregistrée <strong>en attente de confirmation</strong>. Aucun paiement en ligne n'est effectué sur cette page.</p></div>
            <button id="submit-booking-action-btn" type="submit" disabled={!canSubmit} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#284C3B] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#1B382D] disabled:cursor-not-allowed disabled:opacity-50">{isCheckingAvailability || isSubmitting ? <Loader2 className="animate-spin" size={19}/> : <ArrowRight size={19}/>} {isCheckingAvailability ? 'Vérification du séjour…' : isSubmitting ? 'Enregistrement en cours…' : !canSubmit ? 'Disponibilité non confirmée' : 'Envoyer ma demande de réservation'}</button>
            <p className="text-center text-xs leading-5 text-[#74786F]">Vous ne serez pas débité en envoyant cette demande.</p>
          </form>
        </section>
        <aside className="min-w-0 lg:col-span-5"><div className="space-y-5 rounded-[26px] border border-[#E9E2D5] bg-white p-5 shadow-sm sm:p-7 lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl font-semibold">Votre séjour</h2><span className="rounded-full bg-[#F0F4EE] px-3 py-1 text-xs font-semibold text-[#284C3B]">Récapitulatif</span></div>
          <div className="flex min-w-0 gap-4 border-b border-[#E9E2D5] pb-5"><img className="h-24 w-24 shrink-0 rounded-2xl object-cover" src={hotel.photos?.[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80'} alt={hotel.name}/><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-[#7B806E]">{hotel.region}</p><h3 className="mt-1 break-words font-serif text-lg font-semibold">{hotel.name}</h3><p className="mt-1 break-words text-xs text-[#74786F]">{hotel.address}</p></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#F7F5EF] p-3"><p className="flex items-center gap-1 text-xs text-[#74786F]"><CalendarDays size={13}/> Arrivée</p><p className="mt-2 text-sm font-bold">{formatDate(checkIn)}</p></div><div className="rounded-2xl bg-[#F7F5EF] p-3"><p className="flex items-center gap-1 text-xs text-[#74786F]"><CalendarDays size={13}/> Départ</p><p className="mt-2 text-sm font-bold">{formatDate(checkOut)}</p></div></div>
          <div className="space-y-3 text-sm"><div className="flex items-start gap-3"><BedDouble size={18} className="mt-0.5 shrink-0 text-[#284C3B]"/><div><p className="font-semibold">{roomType.name}</p><p className="text-xs text-[#74786F]">{roomsCount} chambre{roomsCount > 1 ? 's' : ''} · {nightsCount} nuit{nightsCount > 1 ? 's' : ''}</p></div></div><div className="flex items-center gap-3"><Users size={18} className="shrink-0 text-[#284C3B]"/><p>{adults} adulte{adults > 1 ? 's' : ''}{children > 0 ? ` · ${children} enfant${children > 1 ? 's' : ''}` : ''}</p></div></div>
          {isCheckingAvailability ? <p className="flex items-center gap-2 text-xs text-[#74786F]"><Loader2 size={15} className="animate-spin"/> Vérification du tarif et des disponibilités…</p> : isAvailable && pricingVerified ? <p className="flex items-center gap-2 text-xs text-[#284C3B]"><CheckCircle2 size={16}/> Disponibilité vérifiée au moment de la consultation</p> : <p className="flex items-center gap-2 text-xs text-rose-700"><AlertCircle size={16}/> Disponibilité non confirmée</p>}
          {isAvailable && minAvailableRooms > 0 && minAvailableRooms <= 3 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{minAvailableRooms} chambre{minAvailableRooms > 1 ? 's' : ''} disponible{minAvailableRooms > 1 ? 's' : ''} au minimum sur la période consultée.</p>}
          {pricingVerified && stayPricing.hasSpecialRates && <p className="rounded-xl bg-[#F7F5EF] px-3 py-2 text-xs text-[#5D645B]">Des tarifs particuliers s'appliquent à certaines nuits de votre séjour.</p>}
          {pricingVerified && stayPricing.nightlyBreakdown.length > 0 && <details className="rounded-xl border border-[#E9E2D5] p-3 text-xs"><summary className="cursor-pointer font-semibold text-[#284C3B]">Voir le détail des nuits</summary><div className="mt-3 max-h-44 space-y-2 overflow-y-auto">{stayPricing.nightlyBreakdown.map((night, index) => <div key={`${night.date}-${index}`} className="flex justify-between gap-3"><span>Nuit du {formatDate(night.date)}{night.isOverride ? ' · tarif spécial' : ''}</span><span className="shrink-0 font-semibold">{formatFCFA(night.price)}</span></div>)}</div></details>}
          <div className="space-y-2 border-t border-[#E9E2D5] pt-5"><div className="flex flex-wrap items-end justify-between gap-3"><span className="font-semibold">Total du séjour</span><strong className="font-serif text-2xl text-[#284C3B]">{formatFCFA(effectiveTotalPrice)}</strong></div><p className="flex items-start gap-2 text-xs leading-5 text-[#74786F]"><Info size={14} className="mt-0.5 shrink-0"/> Montant du séjour calculé selon les tarifs disponibles. Les modalités de paiement seront précisées par l'établissement.</p></div>
          <div className="flex gap-2 rounded-xl border border-[#E9E2D5] p-3 text-xs text-[#5D645B]"><CreditCard size={17} className="shrink-0 text-[#284C3B]"/><span>Aucun paiement en ligne requis pour transmettre cette demande.</span></div>
        </div></aside>
      </div>
    </main>
  );
};

export default BookingTunnelPage;
