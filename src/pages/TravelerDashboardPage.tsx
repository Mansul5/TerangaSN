import React, { useEffect, useState } from 'react';

import {
  Calendar,
  Heart,
  User,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  ShieldCheck,
  Building2,
  ChevronRight,
  Eye,
  X,
  Users,
  BedDouble,
  CreditCard,
  Ban,
  RefreshCw,
  LogOut,
} from 'lucide-react';

import { Booking, Favorite } from '@/src/types';

import {
  fetchUserBookings,
  fetchUserFavorites,
  updateBookingStatus,
} from '@/src/lib/supabase/api';

import { formatFCFA, formatDate } from '@/src/lib/formatters';
import { useAuth } from '@/src/context/AuthContext';
import { HotelCard } from '@/src/components/HotelCard';

interface TravelerDashboardPageProps {
  initialTab?: 'bookings' | 'favorites' | 'profile';
  onSelectHotel: (hotelId: string) => void;
  onOpenAuth: () => void;
}

const getInitials = (
  name?: string | null,
  email?: string | null
) => {
  const value = (name || email || 'U').trim();
  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
};

const getStatusLabel = (status: Booking['status']) => {
  switch (status) {
    case 'confirmed':
      return 'Confirmée';
    case 'cancelled':
      return 'Annulée';
    case 'completed':
      return 'Terminée';
    case 'pending':
      return 'En attente';
    default:
      return status;
  }
};

const getCancellationPolicyLabel = (policy?: string) => {
  switch (policy) {
    case 'free_cancellation':
      return 'Annulation gratuite';
    case 'flexible':
      return 'Annulation flexible';
    case 'non_refundable':
      return 'Non remboursable';
    default:
      return 'Politique non précisée';
  }
};

const statusStyles = {
  confirmed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: CheckCircle2,
  },
  cancelled: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: XCircle,
  },
  completed: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: CheckCircle2,
  },
  pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: Clock,
  },
};

export function TravelerDashboardPage({
  initialTab = 'bookings',
  onSelectHotel,
  onOpenAuth,
}: TravelerDashboardPageProps) {
  const {
    user,
    profile,
    updateProfile,
    signOut,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'bookings' | 'favorites' | 'profile'
  >(initialTab);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [selectedBooking, setSelectedBooking] =
    useState<Booking | null>(null);

  const [bookingToCancel, setBookingToCancel] =
    useState<Booking | null>(null);

  const [isCancelling, setIsCancelling] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [fullName, setFullName] = useState(
    profile?.full_name || ''
  );

  const [phone, setPhone] = useState(
    profile?.phone || ''
  );

  const [isUpdatingProfile, setIsUpdatingProfile] =
    useState(false);

  const [profileSuccessMsg, setProfileSuccessMsg] =
    useState<string | null>(null);

  // Synchronise l'onglet avec les navigations venant du Navbar.
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Synchronise les champs du profil lorsque le profil arrive depuis AuthContext.
  useEffect(() => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
  }, [profile]);

  const loadUserData = async () => {
    if (!user) {
      setBookings([]);
      setFavorites([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setDashboardError(null);

    try {
      const [bookingsResult, favoritesResult] =
        await Promise.all([
          fetchUserBookings(user.id),
          fetchUserFavorites(user.id),
        ]);

      if (bookingsResult.error) {
        throw bookingsResult.error;
      }

      if (favoritesResult.error) {
        throw favoritesResult.error;
      }

      setBookings(bookingsResult.data || []);
      setFavorites(favoritesResult.data || []);
    } catch (error: any) {
      console.error(
        'Erreur chargement dashboard:',
        error
      );

      setDashboardError(
        error?.message ||
          'Impossible de charger vos informations pour le moment.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [user?.id]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsUpdatingProfile(true);
    setProfileSuccessMsg(null);
    setDashboardError(null);

    try {
      const { error } = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
      });

      if (error) {
        throw error;
      }

      setProfileSuccessMsg(
        'Votre profil a été mis à jour avec succès.'
      );

      setTimeout(() => {
        setProfileSuccessMsg(null);
      }, 4000);
    } catch (error: any) {
      console.error(
        'Erreur mise à jour profil:',
        error
      );

      setDashboardError(
        error?.message ||
          'Impossible de mettre à jour votre profil.'
      );
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await signOut();

    if (error) {
      setDashboardError(
        error?.message ||
          'Impossible de vous déconnecter.'
      );
    }
  };

  const canCancelBooking = (booking: Booking) => {
    if (
      booking.status !== 'pending' &&
      booking.status !== 'confirmed'
    ) {
      return false;
    }

    // Une réservation en attente peut être annulée.
    // Pour une réservation confirmée, la politique
    // "non_refundable" bloque l'annulation depuis cet espace.
    // Le schéma actuel ne possède pas de champ indiquant
    // une deadline précise d'annulation.
    if (
      booking.status === 'confirmed' &&
      booking.room_type?.cancellation_policy ===
        'non_refundable'
    ) {
      return false;
    }

    return true;
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel || !user) return;

    setIsCancelling(true);
    setDashboardError(null);

    try {
      const { error } = await updateBookingStatus(
        bookingToCancel.id,
        'cancelled'
      );

      if (error) {
        throw error;
      }

      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === bookingToCancel.id
            ? {
                ...booking,
                status: 'cancelled',
              }
            : booking
        )
      );

      setSelectedBooking((currentBooking) =>
        currentBooking?.id === bookingToCancel.id
          ? {
              ...currentBooking,
              status: 'cancelled',
            }
          : currentBooking
      );

      setBookingToCancel(null);

      setActionMessage(
        `La réservation ${bookingToCancel.booking_number} a été annulée.`
      );

      setTimeout(() => {
        setActionMessage(null);
      }, 5000);
    } catch (error: any) {
      console.error(
        'Erreur annulation réservation:',
        error
      );

      setDashboardError(
        error?.message ||
          'Impossible d’annuler cette réservation.'
      );
    } finally {
      setIsCancelling(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-5">
            <User size={30} />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Votre espace voyageur
          </h1>

          <p className="text-gray-600 mb-6">
            Connectez-vous pour retrouver vos réservations,
            vos favoris et gérer votre profil.
          </p>

          <button
            onClick={onOpenAuth}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  const renderStatusBadge = (
    status: Booking['status']
  ) => {
    const config =
      statusStyles[status] || statusStyles.pending;

    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}
      >
        <Icon size={14} />
        {getStatusLabel(status)}
      </span>
    );
  };

  const renderPaymentStatus = (
    paymentStatus: Booking['payment_status']
  ) => {
    if (paymentStatus === 'on_site_paid') {
      return (
        <span className="text-emerald-700 font-medium">
          Payé sur place
        </span>
      );
    }

    return (
      <span className="text-gray-700 font-medium">
        Paiement sur place
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                {getInitials(
                  profile?.full_name,
                  profile?.email
                )}
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Bienvenue
                </p>

                <h1 className="text-2xl font-bold text-gray-900">
                  {profile?.full_name || 'Voyageur'}
                </h1>

                <p className="text-sm text-gray-500 mt-1">
                  Gérez vos séjours et votre compte
                </p>
              </div>
            </div>

            <button
              onClick={loadUserData}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  isLoading ? 'animate-spin' : ''
                }
              />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      {/* Messages */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        {dashboardError && (
          <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">
            <AlertCircle
              size={20}
              className="shrink-0 mt-0.5"
            />

            <div className="flex-1">
              <p className="font-semibold">
                Une erreur est survenue
              </p>

              <p className="text-sm mt-1">
                {dashboardError}
              </p>
            </div>

            <button
              onClick={() => setDashboardError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {actionMessage && (
          <div className="mb-4 flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
            <CheckCircle2 size={20} />

            <p className="font-medium text-sm">
              {actionMessage}
            </p>
          </div>
        )}
      </div>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-6 overflow-hidden">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex items-center gap-2 px-5 py-4 font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'bookings'
                  ? 'text-emerald-700 border-emerald-600'
                  : 'text-gray-500 border-transparent hover:text-gray-800'
              }`}
            >
              <Calendar size={18} />
              Mes réservations

              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                {bookings.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex items-center gap-2 px-5 py-4 font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'favorites'
                  ? 'text-emerald-700 border-emerald-600'
                  : 'text-gray-500 border-transparent hover:text-gray-800'
              }`}
            >
              <Heart size={18} />
              Mes favoris

              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                {favorites.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-5 py-4 font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'text-emerald-700 border-emerald-600'
                  : 'text-gray-500 border-transparent hover:text-gray-800'
              }`}
            >
              <User size={18} />
              Mon profil
            </button>
          </div>
        </div>

        {/* BOOKINGS */}
        {activeTab === 'bookings' && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Mes réservations
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Retrouvez ici tous vos séjours.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 flex flex-col items-center justify-center">
                <Loader2
                  size={32}
                  className="animate-spin text-emerald-600 mb-3"
                />

                <p className="text-gray-500">
                  Chargement de vos réservations...
                </p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Calendar
                    size={28}
                    className="text-gray-400"
                  />
                </div>

                <h3 className="font-bold text-lg text-gray-900">
                  Aucune réservation
                </h3>

                <p className="text-gray-500 mt-2 mb-5">
                  Vous n’avez pas encore effectué de réservation.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => {
                  const hotel = booking.hotel;
                  const roomType = booking.room_type;

                  return (
                    <article
                      key={booking.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="p-5">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                          <div className="flex gap-4 min-w-0">
                            <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                              {hotel?.photos?.[0] ? (
                                <img
                                  src={hotel.photos[0]}
                                  alt={hotel.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <Building2 size={28} />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                {renderStatusBadge(
                                  booking.status
                                )}

                                <span className="text-xs text-gray-500">
                                  #{booking.booking_number}
                                </span>
                              </div>

                              <h3 className="font-bold text-lg text-gray-900 truncate">
                                {hotel?.name || 'Hébergement'}
                              </h3>

                              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                                <MapPin size={15} />

                                <span>
                                  {hotel?.city || 'Ville'}
                                  {hotel?.region
                                    ? `, ${hotel.region}`
                                    : ''}
                                </span>
                              </div>

                              <p className="text-sm text-gray-600 mt-2">
                                {roomType?.name || 'Chambre'}
                              </p>
                            </div>
                          </div>

                          <div className="lg:text-right shrink-0">
                            <p className="text-sm text-gray-500">
                              Total
                            </p>

                            <p className="text-xl font-bold text-gray-900">
                              {formatFCFA(
                                booking.total_price
                              )}
                            </p>

                            <p className="text-xs mt-1">
                              {renderPaymentStatus(
                                booking.payment_status
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-100">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              Arrivée
                            </p>

                            <p className="text-sm font-semibold text-gray-900">
                              {formatDate(
                                booking.check_in
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              Départ
                            </p>

                            <p className="text-sm font-semibold text-gray-900">
                              {formatDate(
                                booking.check_out
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              Durée
                            </p>

                            <p className="text-sm font-semibold text-gray-900">
                              {booking.nights_count}{' '}
                              {booking.nights_count > 1
                                ? 'nuits'
                                : 'nuit'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 mb-1">
                              Voyageurs
                            </p>

                            <p className="text-sm font-semibold text-gray-900">
                              {booking.guests_adults +
                                booking.guests_children}{' '}
                              {booking.guests_adults +
                                booking.guests_children >
                              1
                                ? 'personnes'
                                : 'personne'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mt-5">
                          <button
                            onClick={() =>
                              setSelectedBooking(booking)
                            }
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold transition-colors"
                          >
                            <Eye size={17} />
                            Voir les détails
                          </button>

                          {canCancelBooking(booking) && (
                            <button
                              onClick={() =>
                                setBookingToCancel(booking)
                              }
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold transition-colors"
                            >
                              <Ban size={17} />
                              Annuler
                            </button>
                          )}

                          {hotel?.id && (
                            <button
                              onClick={() =>
                                onSelectHotel(hotel.id)
                              }
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-emerald-700 hover:bg-emerald-50 font-semibold transition-colors"
                            >
                              Voir l’hôtel
                              <ChevronRight size={17} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* FAVORITES */}
        {activeTab === 'favorites' && (
          <section>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                Mes favoris
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Les hébergements que vous avez sauvegardés.
              </p>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 flex flex-col items-center">
                <Loader2
                  size={32}
                  className="animate-spin text-emerald-600 mb-3"
                />

                <p className="text-gray-500">
                  Chargement de vos favoris...
                </p>
              </div>
            ) : favorites.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-4">
                  <Heart
                    size={28}
                    className="text-pink-500"
                  />
                </div>

                <h3 className="font-bold text-lg text-gray-900">
                  Aucun favori
                </h3>

                <p className="text-gray-500 mt-2">
                  Ajoutez des hébergements à vos favoris
                  pour les retrouver facilement ici.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {favorites.map((favorite) => (
                  <HotelCard
                    key={favorite.id}
                    hotel={favorite.hotel!}
                    isFavoriteInitial={true}
                    onSelect={onSelectHotel}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* PROFILE */}
        {activeTab === 'profile' && (
          <section className="max-w-3xl">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                Mon profil
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Gérez vos informations personnelles.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-gray-100">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold">
                    {getInitials(
                      profile?.full_name,
                      profile?.email
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {profile?.full_name || 'Voyageur'}
                    </h3>

                    <p className="text-sm text-gray-500 mt-1">
                      Compte voyageur
                    </p>

                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                      <ShieldCheck
                        size={16}
                        className="text-emerald-600"
                      />
                      Compte authentifié
                    </div>
                  </div>
                </div>

                <div className="space-y-5 mt-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Adresse e-mail
                    </label>

                    <div className="relative">
                      <Mail
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="email"
                        value={
                          profile?.email ||
                          user.email ||
                          ''
                        }
                        disabled
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500"
                      />
                    </div>

                    <p className="text-xs text-gray-400 mt-2">
                      L’adresse e-mail utilisée pour votre connexion
                      ne peut pas être modifiée ici.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nom complet
                    </label>

                    <div className="relative">
                      <User
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="text"
                        value={fullName}
                        onChange={(event) =>
                          setFullName(
                            event.target.value
                          )
                        }
                        placeholder="Votre nom complet"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Téléphone
                    </label>

                    <div className="relative">
                      <Phone
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="tel"
                        value={phone}
                        onChange={(event) =>
                          setPhone(
                            event.target.value
                          )
                        }
                        placeholder="+221 ..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {profileSuccessMsg && (
                  <div className="mt-5 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                    <CheckCircle2 size={18} />
                    {profileSuccessMsg}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isUpdatingProfile}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isUpdatingProfile && (
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                    )}

                    {isUpdatingProfile
                      ? 'Enregistrement...'
                      : 'Enregistrer les modifications'}
                  </button>

                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold transition-colors"
                  >
                    <LogOut size={18} />
                    Déconnexion
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* BOOKING DETAILS MODAL */}
      {selectedBooking && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedBooking(null);
            }
          }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Détails de la réservation
                </h3>

                <p className="text-xs text-gray-500 mt-1">
                  #{selectedBooking.booking_number}
                </p>
              </div>

              <button
                onClick={() =>
                  setSelectedBooking(null)
                }
                className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-32 h-28 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {selectedBooking.hotel?.photos?.[0] ? (
                    <img
                      src={
                        selectedBooking.hotel
                          .photos[0]
                      }
                      alt={
                        selectedBooking.hotel.name
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Building2 size={32} />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="mb-2">
                    {renderStatusBadge(
                      selectedBooking.status
                    )}
                  </div>

                  <h4 className="text-xl font-bold text-gray-900">
                    {selectedBooking.hotel?.name ||
                      'Hébergement'}
                  </h4>

                  <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                    <MapPin size={15} />

                    {selectedBooking.hotel?.city ||
                      'Ville'}

                    {selectedBooking.hotel?.region
                      ? `, ${selectedBooking.hotel.region}`
                      : ''}
                  </div>

                  {selectedBooking.hotel?.phone && (
                    <a
                      href={`tel:${selectedBooking.hotel.phone}`}
                      className="inline-flex items-center gap-2 text-sm text-emerald-700 font-medium mt-2"
                    >
                      <Phone size={15} />
                      {selectedBooking.hotel.phone}
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Calendar size={17} />
                    <span className="text-sm">
                      Arrivée
                    </span>
                  </div>

                  <p className="font-semibold text-gray-900">
                    {formatDate(
                      selectedBooking.check_in
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Calendar size={17} />
                    <span className="text-sm">
                      Départ
                    </span>
                  </div>

                  <p className="font-semibold text-gray-900">
                    {formatDate(
                      selectedBooking.check_out
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Clock size={17} />
                    <span className="text-sm">
                      Durée
                    </span>
                  </div>

                  <p className="font-semibold text-gray-900">
                    {selectedBooking.nights_count}{' '}
                    {selectedBooking.nights_count > 1
                      ? 'nuits'
                      : 'nuit'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Users size={17} />
                    <span className="text-sm">
                      Voyageurs
                    </span>
                  </div>

                  <p className="font-semibold text-gray-900">
                    {selectedBooking.guests_adults}{' '}
                    adulte
                    {selectedBooking.guests_adults > 1
                      ? 's'
                      : ''}

                    {selectedBooking.guests_children > 0 &&
                      ` + ${selectedBooking.guests_children} enfant${
                        selectedBooking.guests_children > 1
                          ? 's'
                          : ''
                      }`}
                  </p>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-900">
                    Hébergement
                  </h4>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <BedDouble size={16} />
                      Chambre
                    </span>

                    <span className="text-sm font-semibold text-gray-900 text-right">
                      {selectedBooking.room_type?.name ||
                        'Chambre'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-500">
                      Nombre de chambres
                    </span>

                    <span className="text-sm font-semibold text-gray-900">
                      {selectedBooking.rooms_count}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-500">
                      Politique d’annulation
                    </span>

                    <span className="text-sm font-semibold text-gray-900 text-right">
                      {getCancellationPolicyLabel(
                        selectedBooking.room_type
                          ?.cancellation_policy
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-900">
                    Paiement
                  </h4>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <CreditCard size={16} />
                      Total
                    </span>

                    <span className="text-lg font-bold text-gray-900">
                      {formatFCFA(
                        selectedBooking.total_price
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-500">
                      État du paiement
                    </span>

                    <span className="text-sm">
                      {renderPaymentStatus(
                        selectedBooking.payment_status
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {(selectedBooking.guest_name ||
                selectedBooking.guest_email ||
                selectedBooking.guest_phone) && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <h4 className="font-semibold text-gray-900">
                      Informations du voyageur
                    </h4>
                  </div>

                  <div className="p-4 space-y-3">
                    {selectedBooking.guest_name && (
                      <div className="flex items-center gap-3">
                        <User
                          size={17}
                          className="text-gray-400"
                        />

                        <span className="text-sm text-gray-700">
                          {selectedBooking.guest_name}
                        </span>
                      </div>
                    )}

                    {selectedBooking.guest_email && (
                      <div className="flex items-center gap-3">
                        <Mail
                          size={17}
                          className="text-gray-400"
                        />

                        <span className="text-sm text-gray-700 break-all">
                          {selectedBooking.guest_email}
                        </span>
                      </div>
                    )}

                    {selectedBooking.guest_phone && (
                      <div className="flex items-center gap-3">
                        <Phone
                          size={17}
                          className="text-gray-400"
                        />

                        <span className="text-sm text-gray-700">
                          {selectedBooking.guest_phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedBooking.special_requests && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                  <h4 className="font-semibold text-amber-900 mb-2">
                    Demandes particulières
                  </h4>

                  <p className="text-sm text-amber-800">
                    {selectedBooking.special_requests}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                {selectedBooking.hotel?.id && (
                  <button
                    onClick={() => {
                      setSelectedBooking(null);

                      onSelectHotel(
                        selectedBooking.hotel!.id
                      );
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold"
                  >
                    Voir l’hôtel
                  </button>
                )}

                {canCancelBooking(
                  selectedBooking
                ) && (
                  <button
                    onClick={() =>
                      setBookingToCancel(
                        selectedBooking
                      )
                    }
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    <Ban size={18} />
                    Annuler la réservation
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL CONFIRMATION */}
      {bookingToCancel && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertCircle size={28} />
            </div>

            <h3 className="text-xl font-bold text-gray-900">
              Annuler cette réservation ?
            </h3>

            <p className="text-gray-600 text-sm mt-3 leading-6">
              Vous êtes sur le point d’annuler la réservation{' '}
              <strong>
                #{bookingToCancel.booking_number}
              </strong>{' '}
              pour{' '}
              <strong>
                {bookingToCancel.hotel?.name ||
                  'cet hébergement'}
              </strong>.
            </p>

            {bookingToCancel.room_type
              ?.cancellation_policy ===
              'free_cancellation' && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                La chambre utilise une politique
                d’annulation gratuite.
              </div>
            )}

            {bookingToCancel.room_type
              ?.cancellation_policy ===
              'flexible' && (
              <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                La chambre utilise une politique
                d’annulation flexible.
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={() =>
                  setBookingToCancel(null)
                }
                disabled={isCancelling}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold disabled:opacity-50"
              >
                Garder la réservation
              </button>

              <button
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
              >
                {isCancelling && (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                )}

                {isCancelling
                  ? 'Annulation...'
                  : 'Confirmer l’annulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TravelerDashboardPage;