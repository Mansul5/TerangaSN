import React, { useEffect, useRef, useState } from 'react';
import {
  Building2, User, Heart, CalendarDays, LogOut, ShieldAlert,
  ChevronDown, Menu, X, Compass, PlusCircle, ArrowRight, Home, Search, LifeBuoy,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import type { UserRole } from '@/src/types';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, data?: any) => void;
  // Le rôle reste accepté pour compatibilité avec App.tsx.
  onOpenAuth: (mode?: 'signin' | 'signup', role?: UserRole) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView, onNavigate, onOpenAuth,
}) => {
  const { user, profile, role, hasHostAccess, signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // L’accès hôte dépend de l’activation effective, indépendamment du rôle admin.
  const isAdmin = role === 'admin';
  const isInHostSpace = currentView === 'hotelier-dashboard';
  const isInTravelerSpace = currentView === 'traveler-dashboard';
  const isInAdminSpace = currentView === 'admin-dashboard';
  const accountLabel = isAdmin ? (hasHostAccess ? 'Administrateur et hôte' : 'Administrateur') : hasHostAccess ? 'Voyageur et hôte' : 'Voyageur';
  const displayName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Mon compte';
  const initials = displayName.split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase() || 'U';

  useEffect(() => {
    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setIsUserMenuOpen(false);
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) setIsMobileMenuOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [currentView, user?.id]);

  const navigate = (view: string, data?: any) => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    onNavigate(view, data);
  };
  const becomeHost = () => navigate('become-host');
  const hostSpace = () => hasHostAccess ? navigate('hotelier-dashboard') : becomeHost();
  const travelerSpace = (tab: 'bookings' | 'favorites' | 'profile' = 'bookings') =>
    navigate('traveler-dashboard', { tab });
  const openAuth = (mode: 'signin' | 'signup') => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    onOpenAuth(mode);
  };
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError('');
    try {
      await signOut();
      navigate('home');
    } catch {
      setSignOutError('Déconnexion impossible. Veuillez réessayer.');
    } finally {
      setSigningOut(false);
    }
  };

  const navLink = (active: boolean) =>
    `rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B79B69] ${
      active ? 'bg-[#EDF2ED] text-[#193E30]' : 'text-[#606960] hover:bg-[#F8F6F1] hover:text-[#193E30]'
    }`;
  const menuItem = 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#30352F] transition hover:bg-[#F7F5EF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B79B69]';

  return (
    <header className="sticky top-0 z-[100] w-full border-b border-[#EAE7DF] bg-[#FFFEFB]/95 shadow-[0_2px_18px_rgba(27,56,45,0.035)] backdrop-blur-xl">
      <div className="hidden border-b border-[#EFECE5] bg-[#F8F6F1] sm:block">
        <div className="mx-auto flex h-7 max-w-7xl items-center justify-between px-6 text-[11px] text-[#687067]">
          <span>🇸🇳 Hébergements et séjours au Sénégal</span>
          <span className="font-semibold">Français · FCFA (XOF)</span>
        </div>
      </div>

      <div className="mx-auto flex h-[76px] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <button id="navbar-brand-logo" type="button" onClick={() => navigate('home')}
          aria-label="TerangaSN — Accueil"
          className="group flex min-w-0 shrink items-center gap-2 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B79B69]">
          <span className="min-w-0">
            <span className="block whitespace-nowrap font-serif text-[26px] font-semibold leading-none tracking-[-0.055em] text-[#193E30] sm:text-[30px]">TerangaSN</span>
            <span className="mt-1 hidden text-[10px] font-medium tracking-[0.08em] text-[#7A8078] lg:block">L'art de séjourner au Sénégal</span>
          </span>
        </button>

        <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
          <button type="button" onClick={() => navigate('home')} aria-current={currentView === 'home' ? 'page' : undefined} className={navLink(currentView === 'home')}>Accueil</button>
          <button type="button" onClick={() => navigate('search', { destination: '' })} aria-current={currentView === 'search' ? 'page' : undefined} className={navLink(currentView === 'search')}>Hébergements</button>
          {hasHostAccess ? (
            <button type="button" onClick={hostSpace} className={navLink(isInHostSpace)}>
              <span className="inline-flex items-center gap-1.5"><Building2 size={15} /> Espace hôte</span>
            </button>
          ) : (
            <button type="button" onClick={becomeHost} className={navLink(currentView === 'become-host')}>
              <span className="inline-flex items-center gap-1.5"><PlusCircle size={15} /> Devenir hôte</span>
            </button>
          )}
          {isAdmin && <button type="button" onClick={() => navigate('admin-dashboard')} className={navLink(isInAdminSpace)}><span className="inline-flex items-center gap-1.5"><ShieldAlert size={15} /> Admin</span></button>}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <div ref={userMenuRef} className="relative">
              <button id="user-menu-trigger-btn" type="button"
                onClick={() => { setIsUserMenuOpen(open => !open); setIsMobileMenuOpen(false); }}
                aria-expanded={isUserMenuOpen} aria-haspopup="menu" aria-label={`Compte de ${displayName}`}
                className="flex items-center gap-2 rounded-full border border-[#E9E5DB] bg-[#F8F6F1] p-1.5 pr-3 transition hover:border-[#B79B69] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B79B69]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#284C3B] text-xs font-bold text-white">{initials}</span>
                <span className="hidden max-w-32 text-left lg:block">
                  <span className="block truncate text-xs font-bold text-[#30352F]">{displayName}</span>
                  <span className="block text-[10px] text-[#687067]">{accountLabel}</span>
                </span>
                <ChevronDown size={15} className={`text-[#687067] transition ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserMenuOpen && (
                <div role="menu" aria-label="Menu du compte" className="absolute right-0 top-full z-[120] mt-2 w-[min(290px,calc(100vw-1.5rem))] rounded-2xl border border-[#E9E2D5] bg-[#FFFEFB] p-2 shadow-[0_18px_50px_rgba(27,56,45,0.12)]">
                  <div className="mb-2 border-b border-[#E9E2D5] px-3 pb-3 pt-2">
                    <p className="truncate text-sm font-bold text-[#1B382D]">{displayName}</p>
                    <p className="truncate text-xs text-[#687067]">{user.email}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#8C744C]">{accountLabel}</p>
                  </div>
                  <button role="menuitem" type="button" onClick={() => travelerSpace('bookings')} className={menuItem}><CalendarDays size={17} className="text-[#284C3B]" /> Mes réservations {isInTravelerSpace && <span className="ml-auto text-xs text-[#8C744C]">•</span>}</button>
                  <button role="menuitem" type="button" onClick={() => travelerSpace('favorites')} className={menuItem}><Heart size={17} className="text-[#284C3B]" /> Mes favoris</button>
                  <button role="menuitem" type="button" onClick={() => travelerSpace('profile')} className={menuItem}><User size={17} className="text-[#284C3B]" /> Mon profil</button>
                  <button role="menuitem" type="button" onClick={() => navigate('support-center')} className={menuItem}><LifeBuoy size={17} className="text-[#284C3B]" /> Centre d’assistance</button>
                  <div className="my-2 border-t border-[#E9E2D5]" />
                  {hasHostAccess ? (
                    <button role="menuitem" type="button" onClick={isInHostSpace ? () => travelerSpace() : hostSpace} className={menuItem}>
                      {isInHostSpace ? <Compass size={17} className="text-[#284C3B]" /> : <Building2 size={17} className="text-[#284C3B]" />}
                      {isInHostSpace ? 'Revenir à mon espace voyageur' : 'Accéder à mon espace hôte'} <ArrowRight size={15} className="ml-auto" />
                    </button>
                  ) : <button role="menuitem" type="button" onClick={becomeHost} className={menuItem}><PlusCircle size={17} className="text-[#284C3B]" /> Devenir hôte</button>}
                  {isAdmin && <button role="menuitem" type="button" onClick={() => navigate('admin-dashboard')} className={menuItem}><ShieldAlert size={17} className="text-[#284C3B]" /> Administration</button>}
                  <div className="my-2 border-t border-[#E9E2D5]" />
                  <button role="menuitem" type="button" onClick={handleSignOut} disabled={signingOut} className={`${menuItem} text-rose-700 disabled:opacity-50`}><LogOut size={17} /> {signingOut ? 'Déconnexion…' : 'Se déconnecter'}</button>
                  {signOutError && <p role="alert" className="px-3 pb-2 text-xs text-rose-700">{signOutError}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button id="navbar-signin-btn" type="button" onClick={() => openAuth('signin')}
                className="rounded-full bg-[#193E30] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1B382D] sm:px-4 sm:text-sm">Connexion</button>
              <button id="navbar-signup-btn" type="button" onClick={() => openAuth('signup')}
                className="hidden rounded-full border border-[#D8DED6] px-4 py-2.5 text-sm font-bold text-[#284C3B] transition hover:bg-[#F7F5EF] sm:block">S'inscrire</button>
            </div>
          )}

          <div ref={mobileMenuRef} className="relative md:hidden">
            <button type="button" onClick={() => { setIsMobileMenuOpen(open => !open); setIsUserMenuOpen(false); }}
              aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={isMobileMenuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E9E2D5] bg-[#F8F6F1] text-[#193E30]">
              {isMobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
            {isMobileMenuOpen && (
              <nav aria-label="Navigation mobile" className="absolute right-0 top-full z-[120] mt-3 w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-[#E9E2D5] bg-[#FFFEFB] p-3 shadow-[0_18px_50px_rgba(27,56,45,0.12)]">
                <button type="button" onClick={() => navigate('home')} className={menuItem}><Home size={18} className="text-[#284C3B]" /> Accueil</button>
                <button type="button" onClick={() => navigate('search', { destination: '' })} className={menuItem}><Search size={18} className="text-[#284C3B]" /> Hébergements</button>
                {user && <button type="button" onClick={() => travelerSpace()} className={menuItem}><Compass size={18} className="text-[#284C3B]" /> Espace voyageur</button>}
                {user && <button type="button" onClick={() => navigate('support-center')} className={menuItem}><LifeBuoy size={18} className="text-[#284C3B]" /> Centre d’assistance</button>}
                <button type="button" onClick={hasHostAccess ? hostSpace : becomeHost} className={menuItem}>
                  {hasHostAccess ? <Building2 size={18} className="text-[#284C3B]" /> : <PlusCircle size={18} className="text-[#284C3B]" />}
                  {hasHostAccess ? 'Espace hôte' : 'Devenir hôte'}
                </button>
                {isAdmin && <button type="button" onClick={() => navigate('admin-dashboard')} className={menuItem}><ShieldAlert size={18} className="text-[#284C3B]" /> Administration</button>}
                {!user && <button type="button" onClick={() => openAuth('signup')} className={`${menuItem} mt-2 border-t border-[#E9E2D5] font-bold text-[#284C3B]`}><User size={18} /> Créer un compte</button>}
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
