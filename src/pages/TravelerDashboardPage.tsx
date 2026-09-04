import React, { useEffect, useState } from 'react';
import { 
  Calendar, 
  Heart, 
  MessageSquare, 
  User, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Phone, 
  Mail, 
  ExternalLink,
  ShieldCheck,
  Building2,
  Trash2
} from 'lucide-react';
import { Booking, Favorite, Review, Profile } from '@/src/types';
import { fetchUserBookings, fetchUserFavorites, toggleFavorite } from '@/src/lib/supabase/api';
import { formatFCFA, formatDate } from '@/src/lib/formatters';
import { useAuth } from '@/src/context/AuthContext';
import { HotelCard } from '@/src/components/HotelCard';

interface TravelerDashboardPageProps {
  initialTab?: 'bookings' | 'favorites' | 'profile';
  onSelectHotel: (hotelId: string) => void;
  onOpenAuth: () => void;
}

export const TravelerDashboardPage: React.FC<TravelerDashboardPageProps> = ({
  initialTab = 'bookings',
  onSelectHotel,
  onOpenAuth,
}) => {
  const { user, profile, updateProfile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'bookings' | 'favorites' | 'profile'>(initialTab);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Profile Edit State
  const [fullName, setFullName] = useState<string>(profile?.full_name || '');
  const [phone, setPhone] = useState<string>(profile?.phone || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  const loadUserData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [bookingsRes, favsRes] = await Promise.all([
        fetchUserBookings(user.id),
        fetchUserFavorites(user.id),
      ]);
      setBookings(bookingsRes.data || []);
      setFavorites(favsRes.data || []);
    } catch (err) {
      console.error('Failed to load user dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileSuccessMsg(null);
    try {
      const { error } = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      if (error) throw error;
      setProfileSuccessMsg('Profil mis à jour avec succès !');
      setTimeout(() => setProfileSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] bg-[#FAF9F6] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-[#E6E2D3] shadow-xs text-center max-w-md space-y-4">
          <div className="w-14 h-14 bg-[#ECF3E5] text-[#3F6212] rounded-2xl flex items-center justify-center mx-auto">
            <User size={28} />
          </div>
          <h2 className="text-xl font-serif font-bold text-[#2D2A26]">Espace Voyageur</h2>
          <p className="text-xs text-[#6B6658]">
            Connectez-vous pour consulter vos réservations d'hôtels au Sénégal et vos établissements favoris.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full py-3 bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs cursor-pointer transition"
          >
            Se connecter ou Créer un compte
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#ECF3E5] text-[#3F6212] border border-[#D1DBC2]">
            <CheckCircle2 size={14} className="text-[#3F6212]" />
            <span>Confirmée (Paiement reçu)</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={14} className="text-rose-600" />
            <span>Annulée</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F0EDE4] text-[#2D2A26]">
            <span>Séjour effectué</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F0EDE4] text-[#8B5E34] border border-[#E6E2D3]">
            <Clock size={14} className="text-[#8B5E34]" />
            <span>En attente de confirmation hôtel</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-20">
      
      {/* Header Banner */}
      <div className="bg-[#3F6212] text-white px-4 sm:px-6 py-8 shadow-xs border-b border-[#365314]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#E6E2D3] uppercase tracking-widest block mb-1">
              Espace Personnel Voyageur
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold">
              Bonjour, {profile?.full_name || user.email?.split('@')[0]} !
            </h1>
            <p className="text-xs text-[#D1DBC2] mt-1">
              Gérez vos séjours, vos favoris et vos informations personnelles au Sénégal
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-[#2D450D] p-3 rounded-2xl border border-[#4D7C0F] text-xs">
            <div className="text-center px-2">
              <span className="font-extrabold text-white text-base block">{bookings.length}</span>
              <span className="text-[#D1DBC2] text-[10px]">Réservations</span>
            </div>
            <div className="h-6 w-px bg-[#4D7C0F]" />
            <div className="text-center px-2">
              <span className="font-extrabold text-white text-base block">{favorites.length}</span>
              <span className="text-[#D1DBC2] text-[10px]">Favoris</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container with Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex border border-[#E6E2D3] gap-4 text-xs sm:text-sm font-bold bg-white px-6 pt-3 rounded-2xl shadow-xs">
          <button
            type="button"
            id="traveler-tab-bookings"
            onClick={() => setActiveTab('bookings')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'bookings'
                ? 'border-[#3F6212] text-[#3F6212]'
                : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
            }`}
          >
            <Calendar size={16} />
            <span>Mes Réservations ({bookings.length})</span>
          </button>
          
          <button
            type="button"
            id="traveler-tab-favorites"
            onClick={() => setActiveTab('favorites')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'favorites'
                ? 'border-[#3F6212] text-[#3F6212]'
                : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
            }`}
          >
            <Heart size={16} />
            <span>Mes Favoris ({favorites.length})</span>
          </button>

          <button
            type="button"
            id="traveler-tab-profile"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#3F6212] text-[#3F6212]'
                : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
            }`}
          >
            <User size={16} />
            <span>Mon Profil</span>
          </button>
        </div>

        {/* TAB 1: BOOKINGS */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="bg-white p-12 rounded-2xl border border-[#E6E2D3] text-center space-y-3">
                <Loader2 className="animate-spin text-[#3F6212] mx-auto" size={32} />
                <p className="text-xs font-semibold text-[#6B6658]">Chargement de vos réservations...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="bg-white p-10 rounded-2xl border border-dashed border-[#E6E2D3] text-center space-y-3">
                <Calendar size={32} className="text-[#8C887D] mx-auto" />
                <h3 className="text-base font-serif font-bold text-[#2D2A26]">Aucune réservation pour le moment</h3>
                <p className="text-xs text-[#6B6658] max-w-sm mx-auto">
                  Découvrez les hébergements disponibles à Dakar, Saly, Cap Skirring ou Saint-Louis et effectuez votre première réservation sans prépaiement !
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E6E2D3] shadow-xs hover:shadow-sm transition space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6E2D3]">
                      <div>
                        <span className="text-[10px] text-[#8C887D] font-bold uppercase block">Numéro de réservation</span>
                        <span className="text-base font-serif font-bold text-[#8B5E34] font-mono">
                          {booking.booking_number}
                        </span>
                      </div>
                      <div>{getStatusBadge(booking.status)}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-6 space-y-1">
                        <h4 className="text-base font-serif font-bold text-[#2D2A26]">
                          {booking.hotel?.name || 'Hôtel au Sénégal'}
                        </h4>
                        <p className="text-xs text-[#6B6658] flex items-center gap-1">
                          <MapPin size={13} className="text-[#8B5E34]" />
                          <span>{booking.hotel?.city}, {booking.hotel?.region}</span>
                        </p>
                        <p className="text-xs text-[#2D2A26] font-semibold pt-1">
                          Formule : {booking.room_type?.name || 'Chambre'} ({booking.nights_count} nuit{booking.nights_count > 1 ? 's' : ''})
                        </p>
                      </div>

                      <div className="md:col-span-3 space-y-1 text-xs text-[#6B6658] bg-[#FAF9F6] p-3 rounded-xl border border-[#E6E2D3]">
                        <div><span className="text-[#8C887D]">Arrivée :</span> <strong className="text-[#2D2A26]">{formatDate(booking.check_in)}</strong></div>
                        <div><span className="text-[#8C887D]">Départ :</span> <strong className="text-[#2D2A26]">{formatDate(booking.check_out)}</strong></div>
                      </div>

                      <div className="md:col-span-3 text-right space-y-1">
                        <span className="text-[10px] text-[#8C887D] uppercase font-bold block">Montant à régler sur place</span>
                        <span className="text-lg font-serif font-bold text-[#8B5E34] block">
                          {formatFCFA(booking.total_price)}
                        </span>
                        <span className="text-[11px] text-[#3F6212] font-semibold flex items-center justify-end gap-1">
                          <ShieldCheck size={13} />
                          <span>Paiement à l'arrivée</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FAVORITES */}
        {activeTab === 'favorites' && (
          <div>
            {isLoading ? (
              <div className="bg-white p-12 rounded-2xl border border-[#E6E2D3] text-center space-y-3">
                <Loader2 className="animate-spin text-[#3F6212] mx-auto" size={32} />
                <p className="text-xs font-semibold text-[#6B6658]">Chargement de vos favoris...</p>
              </div>
            ) : favorites.length === 0 ? (
              <div className="bg-white p-10 rounded-2xl border border-dashed border-[#E6E2D3] text-center space-y-3">
                <Heart size={32} className="text-[#8C887D] mx-auto" />
                <h3 className="text-base font-serif font-bold text-[#2D2A26]">Aucun favori enregistré</h3>
                <p className="text-xs text-[#6B6658] max-w-sm mx-auto">
                  Cliquez sur le cœur d'un hôtel pour l'enregistrer dans votre liste de souhaits.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {favorites.map((fav) => (
                  fav.hotel ? (
                    <HotelCard
                      key={fav.id}
                      hotel={fav.hotel}
                      isFavoriteInitial={true}
                      onSelect={onSelectHotel}
                    />
                  ) : null
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROFILE */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl bg-white p-6 sm:p-8 rounded-3xl border border-[#E6E2D3] shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-serif font-bold text-[#2D2A26]">Informations de profil</h3>
              <p className="text-xs text-[#6B6658]">
                Vos informations serviront à pré-remplir vos réservations.
              </p>
            </div>

            {profileSuccessMsg && (
              <div className="p-3 bg-[#ECF3E5] border border-[#D1DBC2] text-[#3F6212] text-xs rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-1">
                  Adresse email
                </label>
                <input
                  type="email"
                  disabled
                  value={user.email || ''}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#FAF9F6] text-[#6B6658] border border-[#E6E2D3] rounded-xl cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-1">
                  Nom complet
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Awa Diop"
                  className="w-full text-xs px-3.5 py-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2A26] mb-1">
                  Numéro de téléphone (Sénégal)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+221 77 123 45 67"
                  className="w-full text-xs px-3.5 py-2.5 bg-white border border-[#E6E2D3] rounded-xl outline-none focus:border-[#3F6212]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-6 py-2.5 bg-[#3F6212] hover:bg-[#365314] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition disabled:opacity-50"
                >
                  {isUpdatingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

    </div>
  );
};
