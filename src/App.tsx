/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { Navbar } from '@/src/components/Navbar';
import { Footer } from '@/src/components/Footer';
import { AuthModal } from '@/src/components/AuthModal';
import { HomePage } from '@/src/pages/HomePage';
import { SearchResultsPage } from '@/src/pages/SearchResultsPage';
import { HotelDetailPage } from '@/src/pages/HotelDetailPage';
import { BookingTunnelPage } from '@/src/pages/BookingTunnelPage';
import { TravelerDashboardPage } from '@/src/pages/TravelerDashboardPage';
import { HotelierDashboardPage } from '@/src/pages/HotelierDashboardPage';
import { AdminDashboardPage } from '@/src/pages/AdminDashboardPage';
import { SupportCenterPage } from '@/src/pages/SupportCenterPage';
import { BecomeHostPage } from '@/src/pages/BecomeHostPage';
import { HostTermsPage } from '@/src/pages/HostTermsPage';
import { TermsPage } from '@/src/pages/TermsPage';
import { PrivacyPolicyPage } from '@/src/pages/PrivacyPolicyPage';
import { HostOnboardingPage } from '@/src/pages/HostOnboardingPage';
import type { HostOnboardingData } from '@/src/pages/HostOnboardingPage';
import type { Lodging, RoomType, SearchFilters, UserRole } from '@/src/types';
import { supabase } from '@/src/lib/supabase/client';

const VIEW_KEY = 'terangasn.currentView.v1';
const DASHBOARD_TAB_KEY = 'terangasn.travelerTab.v1';
const RESTORABLE_VIEWS = new Set(['home', 'search', 'hotel-detail', 'traveler-dashboard', 'become-host', 'terms', 'privacy-policy', 'host-terms', 'host-terms-public', 'host-onboarding', 'hotelier-dashboard', 'admin-dashboard']);
const readSavedView = (): string => {
  try {
    const saved = window.sessionStorage.getItem(VIEW_KEY);
    return saved && RESTORABLE_VIEWS.has(saved) ? saved : 'home';
  } catch { return 'home'; }
};

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
  const { user, role, hasHostAccess, hasAdminStaffAccess, isLoading, refreshProfile } = useAuth();
  const [currentView, setCurrentView] = useState<string>(readSavedView);
  const viewScrollPositions = useRef(new Map<string, number>());
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState<Partial<SearchFilters>>({ ...DEFAULT_FILTERS });
  const [bookingPayload, setBookingPayload] = useState<BookingPayload | null>(null);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>(() => {
    try {
      const saved = window.sessionStorage.getItem(DASHBOARD_TAB_KEY);
      return saved === 'favorites' || saved === 'profile' ? saved : 'bookings';
    } catch { return 'bookings'; }
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [authModalRole, setAuthModalRole] = useState<UserRole>('traveler');
  const [pendingHostOnboarding, setPendingHostOnboarding] = useState<HostOnboardingData | null>(null);
  const [hostOnboardingMode, setHostOnboardingMode] = useState<HostMode>('first-host');
  const [hostAuthPending, setHostAuthPending] = useState(false);
  const [hostSubmissionError, setHostSubmissionError] = useState<string | null>(null);
  const [hostSubmitting, setHostSubmitting] = useState(false);

  // Restaurer la navigation de cet onglet après F5, sans stocker de données sensibles.
  useEffect(() => {
    try { window.sessionStorage.setItem(VIEW_KEY, currentView); } catch { /* stockage indisponible */ }
  }, [currentView]);
  useEffect(() => {
    try { window.sessionStorage.setItem(DASHBOARD_TAB_KEY, dashboardTab); } catch { /* stockage indisponible */ }
  }, [dashboardTab]);

  const hasAdminConsoleAccess = role === 'admin' || hasAdminStaffAccess;
  const isAdminView = currentView === 'admin-dashboard' && hasAdminConsoleAccess;

  // Les données du parcours restent disponibles localement pendant la soumission.
  void pendingHostOnboarding;

  const navigateToView = (view: string) => {
    if (view === currentView) return;
    viewScrollPositions.current.set(currentView, window.scrollY);
    setCurrentView(view);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: viewScrollPositions.current.get(currentView) || 0,
        behavior: 'auto',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentView]);

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin', targetRole: UserRole = 'traveler') => {
    setAuthModalMode(mode);
    setAuthModalRole(targetRole);
    setIsAuthModalOpen(true);
  };

  // Reprendre le parcours hôte après authentification, sans créer un compte owner.
  useEffect(() => {
    if (!hostAuthPending || !user || isAuthModalOpen) return;
    setHostAuthPending(false);
    navigateToView('host-terms');
  }, [hostAuthPending, user, isAuthModalOpen]);

  useEffect(() => {
    if (hasAdminStaffAccess && currentView !== 'admin-dashboard') {
      navigateToView('admin-dashboard');
    }
  }, [hasAdminStaffAccess, currentView]);

  // Les transitions de rôle peuvent arriver pendant que l'utilisateur est dans un espace protégé.
  useEffect(() => {
    if (isLoading) return;
    if (currentView === 'admin-dashboard' && !hasAdminConsoleAccess) navigateToView('home');
    if (currentView === 'hotelier-dashboard' && !hasHostAccess) navigateToView(user ? 'become-host' : 'home');
  }, [currentView, role, hasAdminConsoleAccess, hasHostAccess, user, isLoading]);

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
    if (view === 'support-center' && !user) {
      handleOpenAuth('signin');
      return;
    }
    if (view === 'hotelier-dashboard' && !hasHostAccess) {
      navigateToView('become-host');
      return;
    }
    if (view === 'traveler-dashboard' && !user) {
      handleOpenAuth('signin');
      return;
    }
    navigateToView(view);
  };

  const handleSearchFromHome = (filters: Partial<SearchFilters>) => {
    setSearchFilters({ ...DEFAULT_FILTERS, ...filters });
    navigateToView('search');
  };

  const handleSearchFiltersChange = useCallback((filters: Partial<SearchFilters>) => {
    setSearchFilters(previous => ({ ...previous, ...filters }));
  }, []);

  const handleSelectRegionFromHome = (regionName: string) => {
    setSearchFilters({ ...DEFAULT_FILTERS, destination: regionName });
    navigateToView('search');
  };

  const handleSelectHotel = (hotelId: string) => {
    setSelectedHotelId(hotelId);
    navigateToView('hotel-detail');
  };

  const handleProceedToBooking = (payload: BookingPayload) => {
    setBookingPayload(payload);
    navigateToView('booking-tunnel');
  };

  const handleStartHostJourney = () => {
    if (!user) {
      setHostAuthPending(true);
      handleOpenAuth('signup');
      return;
    }
    setHostAuthPending(false);
    navigateToView('host-terms');
  };

  const handleAcceptHostTerms = () => {
    if (!user) {
      setHostAuthPending(true);
      handleOpenAuth('signin');
      return;
    }
    setHostOnboardingMode('first-host');
    setHostSubmissionError(null);
    navigateToView('host-onboarding');
  };

  const handleAddLodging = () => {
    if (!user || !hasHostAccess) {
      handleNavigate('become-host');
      return;
    }
    setHostOnboardingMode('add-lodging');
    setHostSubmissionError(null);
    navigateToView('host-onboarding');
  };

  const handleCompleteHostOnboarding = async (data: HostOnboardingData) => {
    if (hostSubmitting) return;
    setHostSubmissionError(null);
    if (hostOnboardingMode === 'add-lodging' && !hasHostAccess) {
      setHostSubmissionError('Accès hôte requis pour ajouter un établissement.');
      return;
    }
    if (!user) {
      setHostSubmissionError('Votre session a expiré. Connectez-vous puis réessayez.');
      return;
    }
    if (!data.lodgingType) {
      setHostSubmissionError('Veuillez sélectionner un type d’hébergement.');
      return;
    }
    if (!data.lodgingName.trim() || !data.region.trim() || !data.city.trim() || !data.address.trim()) {
      setHostSubmissionError('Veuillez renseigner le nom, la région, la ville et l’adresse de l’établissement.');
      return;
    }

    setHostSubmitting(true);
    try {
      if (hostOnboardingMode === 'add-lodging') {
        // Un nouvel établissement est uniquement créé comme brouillon.
        // Le quota et les transitions de statut sont imposés par les triggers Supabase.
        const { error: createError } = await supabase.from('hotels').insert({
          owner_id: user.id,
          name: data.lodgingName.trim(),
          category: data.lodgingType,
          region: data.region.trim(),
          city: data.city.trim(),
          address: data.address.trim(),
          description: data.description.trim(),
          status: 'draft',
        });
        if (createError) throw createError;
        setPendingHostOnboarding(null);
        navigateToView('hotelier-dashboard');
        return;
      }

      // Activation initiale inchangée : le RPC crée le premier établissement.
      const { error } = await supabase.rpc('activate_host_standard', {
        p_lodging_name: data.lodgingName.trim(),
        p_category: data.lodgingType,
        p_region: data.region.trim(),
        p_city: data.city.trim(),
        p_address: data.address.trim(),
        p_description: data.description.trim(),
      });
      if (error) throw error;
      setPendingHostOnboarding(data);
      await refreshProfile();
      navigateToView('hotelier-dashboard');
    } catch (error) {
      console.error('Activation hôte impossible :', error);
      setHostSubmissionError(error instanceof Error ? error.message : (typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : 'Impossible d’enregistrer l’établissement. Veuillez réessayer.'));
    } finally {
      setHostSubmitting(false);
    }
  };

  return (
    <div className={`flex flex-col bg-[#F7F5EF] font-sans text-[#30352F] antialiased selection:bg-[#284C3B] selection:text-white ${isAdminView ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {!isAdminView && <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAuth={handleOpenAuth}
      />}

      <main id="main-content" className={`min-w-0 flex-1 ${isAdminView ? 'min-h-0 overflow-hidden' : ''}`}>
        {currentView === 'home' && (
          <HomePage
            onSearch={handleSearchFromHome}
            onSelectHotel={handleSelectHotel}
            onSelectRegion={handleSelectRegionFromHome}
            onOpenAuth={() => handleOpenAuth('signin')}
          />
        )}

        {currentView === 'search' && (
          <SearchResultsPage
            initialFilters={searchFilters}
            onFiltersChange={handleSearchFiltersChange}
            onSelectHotel={handleSelectHotel}
            onAuthRequired={() => handleOpenAuth('signin')}
            onOpenSupabaseModal={() => {}}
          />
        )}

        {currentView === 'hotel-detail' && !selectedHotelId && (
          <HomePage onSearch={handleSearchFromHome} onSelectHotel={handleSelectHotel} onSelectRegion={handleSelectRegionFromHome} onOpenAuth={() => handleOpenAuth('signin')} />
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
            onBack={() => navigateToView('search')}
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
            onBack={() => navigateToView('hotel-detail')}
            onViewBookings={() => {
              setDashboardTab('bookings');
              navigateToView('traveler-dashboard');
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

        {currentView === 'support-center' && user && (
          <SupportCenterPage onBack={() => handleNavigate('home')} />
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
            onBack={() => navigateToView('become-host')}
            onContinue={handleAcceptHostTerms}
          />
        )}

        {currentView === 'terms' && (
          <TermsPage
            onBack={() => navigateToView('home')}
            onHostTerms={() => navigateToView('host-terms-public')}
          />
        )}

        {currentView === 'privacy-policy' && (
          <PrivacyPolicyPage onBack={() => navigateToView('home')} />
        )}

        {currentView === 'host-terms-public' && (
          <HostTermsPage
            readOnly
            onBack={() => navigateToView('terms')}
            onContinue={() => navigateToView('home')}
          />
        )}

        {currentView === 'host-onboarding' && (
          <div>
            {hostSubmissionError && (
              <div role="alert" className="mx-auto mt-5 max-w-4xl rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                <strong>Création non terminée :</strong> {hostSubmissionError}
              </div>
            )}
            {hostSubmitting && (
              <p role="status" className="mx-auto mt-3 max-w-4xl px-4 text-sm text-[#3F6212]">Enregistrement sécurisé en cours…</p>
            )}
            <HostOnboardingPage
              mode={hostOnboardingMode}
              onBack={() => navigateToView(hostOnboardingMode === 'add-lodging' ? 'hotelier-dashboard' : 'host-terms')}
              onComplete={handleCompleteHostOnboarding}
            />
          </div>
        )}

        {currentView === 'hotelier-dashboard' && !isLoading && hasHostAccess && (
          <HotelierDashboardPage
            onAddLodging={handleAddLodging}
            onOpenAuth={() => handleOpenAuth('signin')}
            onOpenSupabaseModal={() => {}}
          />
        )}

        {currentView === 'admin-dashboard' && !isLoading && hasAdminConsoleAccess && (
          <AdminDashboardPage
            onOpenAuth={() => handleOpenAuth('signin')}
            onOpenSupabaseModal={() => {}}
            onReturnToSite={() => handleNavigate('home')}
          />
        )}
      </main>

      {!isAdminView && <Footer
        onSelectRegion={handleSelectRegionFromHome}
        onNavigate={handleNavigate}
      />}

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
