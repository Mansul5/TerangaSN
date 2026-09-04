import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Heart, 
  Calendar, 
  LogOut, 
  ShieldAlert, 
  Database, 
  ChevronDown, 
  Menu, 
  X,
  Compass,
  Sparkles,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { UserRole } from '@/src/types';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, data?: any) => void;
  onOpenAuth: (mode?: 'signin' | 'signup', role?: UserRole) => void;
  onOpenSupabaseModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenAuth,
  onOpenSupabaseModal,
}) => {
  const { user, profile, role, signOut, isConfigured } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setIsUserMenuOpen(false);
    onNavigate('home');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E6E2D3] shadow-xs">
      {/* Top Banner: Country branding & Quick info */}
      <div className="bg-[#F0EDE4] border-b border-[#E6E2D3] px-4 py-1.5 text-[11px] font-medium text-[#6B6658]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-bold text-[#3F6212]">
              🇸🇳 Teranga Booking
            </span>
            <span className="hidden sm:inline text-[#8C887D]">• Les meilleurs hôtels, lodges & résidences au Sénégal</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSupabaseModal}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                isConfigured 
                  ? 'bg-[#ECF3E5] text-[#3F6212] border border-[#D1DBC2]' 
                  : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
              }`}
            >
              <Database size={12} />
              <span>{isConfigured ? 'Supabase Connecté' : 'Config Supabase'}</span>
            </button>
            <div className="flex items-center gap-1 px-2.5 py-0.5 bg-[#E6E2D3]/60 rounded-full text-[#6B6658]">
              <span>XOF</span>
              <span className="font-bold text-[#2D2A26]">FCFA</span>
            </div>
            <span className="text-[#2D2A26] font-bold">FR</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 cursor-pointer group"
          id="navbar-brand-logo"
        >
          <div className="w-10 h-10 rounded-xl bg-[#8B5E34] text-white font-serif font-bold text-xl flex items-center justify-center shadow-sm group-hover:bg-[#724b29] transition-colors">
            T
          </div>
          <div>
            <span className="text-2xl font-serif font-bold tracking-tight text-[#8B5E34] flex items-center gap-0.5">
              Teranga<span className="text-[#3F6212]">Booking</span>
            </span>
            <span className="block text-[10px] uppercase tracking-widest text-[#8C887D] font-bold">
              Hôtels & Séjours au Sénégal
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => onNavigate('home')}
            className={`transition cursor-pointer ${
              currentView === 'home' 
                ? 'text-[#3F6212] font-bold border-b-2 border-[#3F6212] pb-1' 
                : 'text-[#6B6658] hover:text-[#3F6212]'
            }`}
          >
            Accueil
          </button>
          <button
            onClick={() => onNavigate('search', { destination: '' })}
            className={`transition cursor-pointer ${
              currentView === 'search' 
                ? 'text-[#3F6212] font-bold border-b-2 border-[#3F6212] pb-1' 
                : 'text-[#6B6658] hover:text-[#3F6212]'
            }`}
          >
            Hébergements
          </button>

          {/* Hotelier portal shortcut */}
          <button
            onClick={() => {
              if (!user) {
                onOpenAuth('signup', 'owner');
              } else {
                onNavigate('hotelier-dashboard');
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#3F6212] border border-[#3F6212] hover:bg-[#ECF3E5] transition cursor-pointer"
          >
            <Building2 size={14} />
            <span>Devenir Hôte</span>
          </button>

          {/* Admin shortcut if role is admin */}
          {role === 'admin' && (
            <button
              onClick={() => onNavigate('admin-dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#8B5E34] bg-[#F0EDE4] hover:bg-[#E6E2D3] border border-[#D9D5C3] transition cursor-pointer"
            >
              <ShieldAlert size={14} />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* User Account Controls */}
        <div className="flex items-center gap-3">
          
          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                id="user-menu-trigger-btn"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2.5 bg-[#F0EDE4] hover:bg-[#E6E2D3] px-3 py-1.5 rounded-xl transition cursor-pointer border border-[#E6E2D3]"
              >
                <div className="w-8 h-8 rounded-full bg-[#3F6212] text-white font-extrabold text-xs flex items-center justify-center">
                  {profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : user.email?.substring(0, 2).toUpperCase()}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-bold text-[#2D2A26] line-clamp-1">
                    {profile?.full_name || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-[#6B6658] capitalize">
                    {role === 'owner' ? 'Hôtelier' : role === 'admin' ? 'Administrateur' : 'Voyageur'}
                  </p>
                </div>
                <ChevronDown size={14} className="text-[#6B6658]" />
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white text-[#2D2A26] rounded-2xl shadow-xl border border-[#E6E2D3] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-[#E6E2D3]">
                    <p className="text-xs font-bold text-[#2D2A26] truncate">
                      {profile?.full_name || 'Utilisateur'}
                    </p>
                    <p className="text-[11px] text-[#6B6658] truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#ECF3E5] text-[#3F6212]">
                      Rôle: {role}
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { onNavigate('traveler-dashboard', { tab: 'bookings' }); setIsUserMenuOpen(false); }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-[#2D2A26] hover:bg-[#F0EDE4] flex items-center gap-2.5"
                    >
                      <Calendar size={15} className="text-[#3F6212]" />
                      <span>Mes réservations</span>
                    </button>
                    <button
                      onClick={() => { onNavigate('traveler-dashboard', { tab: 'favorites' }); setIsUserMenuOpen(false); }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-[#2D2A26] hover:bg-[#F0EDE4] flex items-center gap-2.5"
                    >
                      <Heart size={15} className="text-[#8B5E34]" />
                      <span>Mes favoris</span>
                    </button>
                    <button
                      onClick={() => { onNavigate('traveler-dashboard', { tab: 'profile' }); setIsUserMenuOpen(false); }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-[#2D2A26] hover:bg-[#F0EDE4] flex items-center gap-2.5"
                    >
                      <User size={15} className="text-[#6B6658]" />
                      <span>Mon profil</span>
                    </button>
                  </div>

                  {/* Role Specific Shortcuts */}
                  {(role === 'owner' || role === 'admin') && (
                    <div className="py-1 border-t border-[#E6E2D3] bg-[#FAF9F6]">
                      <button
                        onClick={() => { onNavigate('hotelier-dashboard'); setIsUserMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-xs font-bold text-[#8B5E34] hover:bg-[#F0EDE4] flex items-center gap-2.5"
                      >
                        <Building2 size={15} className="text-[#8B5E34]" />
                        <span>Espace Hôtelier</span>
                      </button>
                    </div>
                  )}

                  {role === 'admin' && (
                    <div className="py-1 border-t border-[#E6E2D3] bg-[#FAF9F6]">
                      <button
                        onClick={() => { onNavigate('admin-dashboard'); setIsUserMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-xs font-bold text-[#3F6212] hover:bg-[#F0EDE4] flex items-center gap-2.5"
                      >
                        <ShieldAlert size={15} className="text-[#3F6212]" />
                        <span>Espace Admin</span>
                      </button>
                    </div>
                  )}

                  <div className="py-1 border-t border-[#E6E2D3]">
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5"
                    >
                      <LogOut size={15} />
                      <span>Déconnexion</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                id="navbar-signin-btn"
                onClick={() => onOpenAuth('signin')}
                className="px-4 py-2 bg-[#3F6212] text-white hover:bg-[#365314] font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer shadow-xs"
              >
                Connexion
              </button>
              <button
                type="button"
                id="navbar-signup-btn"
                onClick={() => onOpenAuth('signup')}
                className="px-4 py-2 bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer shadow-xs hidden sm:block"
              >
                S'inscrire
              </button>
            </div>
          )}

          {/* Mobile menu hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg bg-[#F0EDE4] text-[#2D2A26] md:hidden hover:bg-[#E6E2D3] transition"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-[#E6E2D3] px-4 py-4 space-y-2">
          <button
            onClick={() => { onNavigate('home'); setIsMobileMenuOpen(false); }}
            className="w-full text-left py-2 px-3 rounded-lg text-sm font-semibold hover:bg-[#F0EDE4] text-[#2D2A26]"
          >
            Accueil
          </button>
          <button
            onClick={() => { onNavigate('search', { destination: '' }); setIsMobileMenuOpen(false); }}
            className="w-full text-left py-2 px-3 rounded-lg text-sm font-semibold hover:bg-[#F0EDE4] text-[#2D2A26]"
          >
            Hébergements
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              if (!user) onOpenAuth('signup', 'owner');
              else onNavigate('hotelier-dashboard');
            }}
            className="w-full text-left py-2 px-3 rounded-lg text-sm font-bold text-[#3F6212] hover:bg-[#ECF3E5] flex items-center gap-2"
          >
            <Building2 size={16} />
            <span>Devenir Hôte</span>
          </button>
          {role === 'admin' && (
            <button
              onClick={() => { onNavigate('admin-dashboard'); setIsMobileMenuOpen(false); }}
              className="w-full text-left py-2 px-3 rounded-lg text-sm font-bold text-[#8B5E34] hover:bg-[#F0EDE4] flex items-center gap-2"
            >
              <ShieldAlert size={16} />
              <span>Administration</span>
            </button>
          )}
          <button
            onClick={() => { onOpenSupabaseModal(); setIsMobileMenuOpen(false); }}
            className="w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-[#3F6212] hover:bg-[#ECF3E5] flex items-center gap-2"
          >
            <Database size={16} />
            <span>Configuration Supabase</span>
          </button>
        </div>
      )}
    </header>
  );
};
