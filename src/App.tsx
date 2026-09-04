/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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

import { Hotel, RoomType, SearchFilters, UserRole } from '@/src/types';

function MainApp() {
  const { isConfigured, user, role } = useAuth();

  // Navigation State
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState<Partial<SearchFilters>>({
    destination: '',
    checkIn: '',
    checkOut: '',
    adults: 2,
    children: 0,
    rooms: 1,
  });

  // Booking Flow State
  const [bookingPayload, setBookingPayload] = useState<{
    hotel: Hotel;
    roomType: RoomType;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    roomsCount: number;
    nightsCount: number;
    totalPrice: number;
  } | null>(null);

  // Traveler Dashboard sub-tab
  const [dashboardTab, setDashboardTab] = useState<'bookings' | 'favorites' | 'profile'>('bookings');

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [authModalRole, setAuthModalRole] = useState<UserRole>('traveler');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentView, selectedHotelId]);

  const handleNavigate = (view: string, data?: any) => {
    if (view === 'traveler-dashboard' && data?.tab) {
      setDashboardTab(data.tab);
    }
    if (view === 'search' && data) {
      setSearchFilters(prev => ({ ...prev, ...data }));
    }
    setCurrentView(view);
  };

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin', targetRole: UserRole = 'traveler') => {
    setAuthModalMode(mode);
    setAuthModalRole(targetRole);
    setIsAuthModalOpen(true);
  };

  const handleSearchFromHome = (filters: any) => {
    setSearchFilters(filters);
    setCurrentView('search');
  };

  const handleSelectRegionFromHome = (regionName: string) => {
    setSearchFilters({ destination: regionName });
    setCurrentView('search');
  };

  const handleSelectHotel = (hotelId: string) => {
    setSelectedHotelId(hotelId);
    setCurrentView('hotel-detail');
  };

  const handleProceedToBooking = (payload: any) => {
    setBookingPayload(payload);
    setCurrentView('booking-tunnel');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#2D2A26] font-sans antialiased selection:bg-[#3F6212] selection:text-white">
      
      {/* Global Navigation Bar */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAuth={handleOpenAuth}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1">
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
            initialTab={dashboardTab}
            onSelectHotel={handleSelectHotel}
            onOpenAuth={() => handleOpenAuth('signin')}
          />
        )}

        {currentView === 'hotelier-dashboard' && (
          <HotelierDashboardPage
            onOpenAuth={() => handleOpenAuth('signin', 'owner')}
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

      {/* Global Footer */}
      <Footer
        onSelectRegion={handleSelectRegionFromHome}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        initialRole={authModalRole}
      />

      {/* Supabase Schema and Helper Modal */}
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
