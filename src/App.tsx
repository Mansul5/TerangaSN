/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';
import { AuthModal } from '@/src/components/AuthModal';
import { SupabaseSetupModal } from '@/src/components/SupabaseSetupModal';
import { HomePage } from '@/src/pages/HomePage';
import { SearchResultsPage } from '@/src/pages/SearchResultsPage';
import { HotelDetailPage } from '@/src/pages/HotelDetailPage';
import { BookingTunnelPage } from '@/src/pages/BookingTunnelPage';
import { TravelerDashboardPage } from '@/src/pages/TravelerDashboardPage';
import { HotelierDashboardPage } from '@/src/pages/HotelierDashboardPage';
import { AdminDashboardPage } from '@/src/pages/AdminDashboardPage';
import { BecomeHostPage } from '@/src/pages/BecomeHostPage';
import { HostTermsPage } from '@/src/pages/HostTermsPage';
import { HostOnboardingPage } from '@/src/pages/HostOnboardingPage';
import type { HostOnboardingData } from '@/src/pages/HostOnboardingPage';
import type { Lodging, RoomType, SearchFilters, UserRole } from '@/src/types';

type DashboardTab = 'bookings' | 'favorites' | 'profile';
type HostMode = 'first-host' | 'add-lodging';
type BookingPayload = {
  hotel: Lodging;
  roomType: RoomType;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomsCount: number;
  nightsCount: number;
  totalPrice: number;
};

const DEFAULT_FILTERS: Partial<SearchFilters> = {
  destination: '', checkIn: '', checkOut: '', adults: 2, children: 0, rooms: 1,
};

function MainApp() {
  const { user, role } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState<Partial<SearchFilters>>({ ...DEFAULT_FILTERS });
  const [bookingPayload, setBookingPayload] = useState<BookingPayload | null>(null);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('bookings');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [authModalRole, setAuthModalRole] = useState<UserRole>('traveler');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [pendingHostOnboarding, setPendingHostOnboarding] = useState<HostOnboardingData | null>(null);
  const [hostOnboardingMode, setHostOnboardingMode] = useState<HostMode>('first-host');
  const [hostAuthPending, setHostAuthPending] = useState(false);

  // Les informations d'onboarding sont temporaires : aucune écriture Supabase ici.
  void pendingHostOnboarding;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentView, selectedHotelId]);

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin', targetRole: UserRole = 'traveler') => {
    setAuthModalMode(mode);
    setAuthModalRole(targetRole);
    setIsAuthModalOpen(true);
  };

  // Reprendre le parcours hôte après authentification, sans créer un compte owner.
  useEffect(() => {
    if (!hostAuthPending || !user || isAuthModalOpen) return;
    setHostAuthPending(false);
    setCurrentView('host-terms');
  }, [hostAuthPending, user, isAuthModalOpen]);

  const handleNavigate = (view: string, data?: any) => {
    if (view === 'traveler-dashboard' && data?.tab) {
      const tab = data.tab;
      if (tab === 'bookings' || tab === 'favorites' || tab === 'profile') setDashboardTab(tab);
    }
    if (view === 'search') {
      // Une navigation sans filtres réutilise la recherche ; avec filtres, on les fusionne.
      if (data) setSearchFilters(previous => ({ ...previous, ...data }));
    }
    // Les accès sensibles doivent aussi être protégés par les pages et les règles RLS.
    if (view === 'admin-dashboard' && role !== 'admin') {
      if (!user) handleOpenAuth('signin');
      return;
    }
    if (view === 'hotelier-dashboard' && role !== 'owner' && role !== 'admin') {
      setCurrentView('become-host');
      return;
    }
    if (view === 'traveler-dashboard' && !user) {
      handleOpenAuth('signin');
      return;
    }
    setCurrentView(view);
  };

  const handleSearchFromHome = (filters: Partial<SearchFilters>) => {
    setSearchFilters({ ...DEFAULT_FILTERS, ...filters });
    setCurrentView('search');
  };

  const handleSelectRegionFromHome = (regionName: string) => {
    setSearchFilters({ ...DEFAULT_FILTERS, destination: regionName });
    setCurrentView('search');
  };

  const handleSelectHotel = (hotelId: string) => {
    setSelectedHotelId(hotelId);
    setCurrentView('hotel-detail');
  };

  const handleProceedToBooking = (payload: BookingPayload) => {
    setBookingPayload(payload);
    setCurrentView('booking-tunnel');
  };

  const handleStartHostJourney = () => {
    if (!user) {
      setHostAuthPending(true);
      handleOpenAuth('signup');
      return;
    }
    setHostAuthPending(false);
    setCurrentView('host-terms');
  };

  const handleAcceptHostTerms = () => {
    if (!user) {
      setHostAuthPending(true);
      handleOpenAuth('signin');
      return;
    }
    setHostOnboardingMode('first-host');
    setCurrentView('host-onboarding');
  };

  const handleAddLodging = () => {
    if (!user || (role !== 'owner' && role !== 'admin')) {
      handleNavigate('become-host');
      return;
    }
    setHostOnboardingMode('add-lodging');
    setCurrentView('host-onboarding');
  };

  const handleCompleteHostOnboarding = (data: HostOnboardingData) => {
    setPendingHostOnboarding(data);
    // Sans persistance ni activation réelle du rôle hôte, ne pas afficher
    // un tableau de bord comme si l'hébergement avait été enregistré.
    // L'utilisateur revient à la page de présentation du parcours hôte.
    setCurrentView(role === 'owner' || role === 'admin' ? 'hotelier-dashboard' : 'become-host');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F5EF] font-sans text-[#30352F] antialiased selection:bg-[#284C3B] selection:text-white">
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAuth={handleOpenAuth}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
      />

      <main id="main-content" className="min-w-0 flex-1">
        {currentView === 'home' && (
          <HomePage
            onSearch={handleSearchFromHome}
            onSelectHotel={handleSelectHotel}
            onSelectRegion={handleSelectRegionFromHome}
            onOpenAuth={() => handleOpenAuth('signin')}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />
        )}

        {currentView === 'search' && (
          <SearchResultsPage
            initialFilters={searchFilters}
            onSelectHotel={handleSelectHotel}
            onAuthRequired={() => handleOpenAuth('signin')}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />
        )}

        {currentView === 'hotel-detail' && selectedHotelId && (
          <HotelDetailPage
            hotelId={selectedHotelId}
            searchParams={{
              checkIn: searchFilters.checkIn,
              checkOut: searchFilters.checkOut,
              adults: searchFilters.adults,
              children: searchFilters.children,
              rooms: searchFilters.rooms,
            }}
            onBack={() => setCurrentView('search')}
            onProceedToBooking={handleProceedToBooking}
            onAuthRequired={() => handleOpenAuth('signin')}
          />
        )}

        {currentView === 'booking-tunnel' && bookingPayload && (
          <BookingTunnelPage
            hotel={bookingPayload.hotel}
            roomType={bookingPayload.roomType}
            checkIn={bookingPayload.checkIn}
            checkOut={bookingPayload.checkOut}
            adults={bookingPayload.adults}
            children={bookingPayload.children}
            roomsCount={bookingPayload.roomsCount}
            nightsCount={bookingPayload.nightsCount}
            totalPrice={bookingPayload.totalPrice}
            onBack={() => setCurrentView('hotel-detail')}
            onViewBookings={() => {
              setDashboardTab('bookings');
              setCurrentView('traveler-dashboard');
            }}
          />
        )}

        {currentView === 'traveler-dashboard' && (
          <TravelerDashboardPage
            key={`traveler-${dashboardTab}`}
            initialTab={dashboardTab}
            onSelectHotel={handleSelectHotel}
            onOpenAuth={() => handleOpenAuth('signin')}
          />
        )}

        {currentView === 'become-host' && (
          <BecomeHostPage
            isAuthenticated={Boolean(user)}
            onStart={handleStartHostJourney}
            onSignIn={() => {
              setHostAuthPending(true);
              handleOpenAuth('signin');
            }}
          />
        )}

        {currentView === 'host-terms' && (
          <HostTermsPage
            onBack={() => setCurrentView('become-host')}
            onContinue={handleAcceptHostTerms}
          />
        )}

        {currentView === 'host-onboarding' && (
          <HostOnboardingPage
            mode={hostOnboardingMode}
            onBack={() => setCurrentView(hostOnboardingMode === 'add-lodging' ? 'hotelier-dashboard' : 'host-terms')}
            onComplete={handleCompleteHostOnboarding}
          />
        )}

        {currentView === 'hotelier-dashboard' && (
          <HotelierDashboardPage
            onAddLodging={handleAddLodging}
            onOpenAuth={() => handleOpenAuth('signin')}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />
        )}

        {currentView === 'admin-dashboard' && (
          <AdminDashboardPage
            onOpenAuth={() => handleOpenAuth('signin')}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />
        )}
      </main>

      <Footer
        onSelectRegion={handleSelectRegionFromHome}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          // Si l'utilisateur ferme sans se connecter, annuler la reprise hôte.
          if (!user) setHostAuthPending(false);
        }}
        initialMode={authModalMode}
        initialRole={authModalRole}
      />

      <SupabaseSetupModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
