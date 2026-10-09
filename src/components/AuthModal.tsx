import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail, Phone, UserRound, X } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import type { UserRole } from '@/src/types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  /** Conservé pour la compatibilité avec App.tsx. L'inscription reste un compte voyageur. */
  initialRole?: UserRole;
  onSuccess?: () => void;
}

type Mode = 'signin' | 'signup';

function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message || '');
  const message = raw.toLowerCase();
  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) return 'Adresse e-mail ou mot de passe incorrect.';
  if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) return 'Votre adresse e-mail n’est pas encore confirmée. Consultez votre boîte de réception.';
  if (message.includes('already registered') || message.includes('already been registered')) return 'Un compte existe déjà avec cette adresse e-mail.';
  if (message.includes('password should be at least') || message.includes('weak_password')) return 'Votre mot de passe ne respecte pas les exigences de sécurité.';
  if (message.includes('invalid email') || message.includes('email address')) return 'Veuillez saisir une adresse e-mail valide.';
  if (message.includes('rate limit') || message.includes('too many requests')) return 'Trop de tentatives. Réessayez dans quelques instants.';
  if (message.includes('network') || message.includes('fetch')) return 'Connexion au serveur impossible. Vérifiez votre connexion Internet.';
  return raw || 'Une erreur est survenue. Veuillez réessayer.';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen, onClose, initialMode = 'signin', onSuccess,
}) => {
  const { signIn, signUp, isConfigured } = useAuth();
  const headingId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeRequestRef = useRef(0);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isOpen) {
      activeRequestRef.current += 1;
      return;
    }
    setMode(initialMode);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setPhone('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setLoading(false);
    setErrorMsg('');
    setSuccessMsg('');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusId = window.setTimeout(() => emailRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusId);
      document.body.style.overflow = previousOverflow;
      activeRequestRef.current += 1;
    };
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter(element => element.getClientRects().length > 0);
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const switchMode = (next: Mode) => {
    if (loading || next === mode) return;
    setMode(next);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setErrorMsg('');
    setSuccessMsg('');
  };
  const close = () => {
    if (loading) return;
    setPassword('');
    setConfirmPassword('');
    setErrorMsg('');
    setSuccessMsg('');
    onClose();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setErrorMsg('');
    setSuccessMsg('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    if (!password) {
      setErrorMsg('Veuillez saisir votre mot de passe.');
      return;
    }
    if (mode === 'signup') {
      if (!cleanName) { setErrorMsg('Veuillez saisir votre nom complet.'); return; }
      if (password.length < 6) { setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.'); return; }
      if (password !== confirmPassword) { setErrorMsg('Les deux mots de passe ne correspondent pas.'); return; }
    }
    if (!isConfigured) {
      setErrorMsg('La connexion à Supabase n’est pas encore configurée.');
      return;
    }
    const request = ++activeRequestRef.current;
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(cleanEmail, password);
        if (error) throw error;
        if (activeRequestRef.current !== request) return;
        setPassword('');
        onSuccess?.();
        onClose();
      } else {
        const { error } = await signUp(cleanEmail, password, cleanName, cleanPhone);
        if (error) throw error;
        if (activeRequestRef.current !== request) return;
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
        setSuccessMsg('Inscription enregistrée. Vérifiez votre boîte e-mail si une confirmation est demandée, puis connectez-vous.');
        // Ne pas appeler onSuccess ici : l'inscription ne garantit pas une session ouverte.
      }
    } catch (error: unknown) {
      if (activeRequestRef.current === request) setErrorMsg(authErrorMessage(error));
    } finally {
      if (activeRequestRef.current === request) setLoading(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-[#DCD7CB] bg-white py-3 pl-11 pr-4 text-sm text-[#30352F] outline-none transition placeholder:text-[#969C94] focus:border-[#284C3B] focus:ring-2 focus:ring-[#284C3B]/10 disabled:cursor-not-allowed disabled:bg-[#F7F5EF]';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-[#30352F]';

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-[#13281F]/65 p-0 backdrop-blur-[3px] sm:items-center sm:p-5"
      onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={headingId}
        className="relative flex max-h-[95dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-3xl border border-[#E9E2D5] bg-[#FFFEFB] shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl">
        <div className="relative shrink-0 border-b border-[#E9E2D5] bg-[#F7F5EF] px-5 pb-5 pt-6 sm:px-7">
          <button type="button" onClick={close} disabled={loading} aria-label="Fermer la fenêtre"
            className="absolute right-4 top-4 rounded-full p-2 text-[#687067] transition hover:bg-[#E9E2D5] disabled:opacity-40"><X size={19} /></button>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#284C3B]">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#284C3B] font-serif font-bold text-white">T</span>
            Teranga<span className="-ml-2 text-[#B79B69]">SN</span>
          </div>
          <h2 id={headingId} className="pr-7 font-serif text-2xl font-bold tracking-tight text-[#1B382D]">
            {mode === 'signin' ? 'Heureux de vous revoir' : 'Bienvenue chez TerangaSN'}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#687067]">
            {mode === 'signin' ? 'Connectez-vous pour retrouver vos séjours et vos favoris.' : 'Créez votre compte pour découvrir et réserver vos prochains séjours.'}
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 border-b border-[#E9E2D5] bg-white p-1.5" role="tablist" aria-label="Connexion ou inscription">
          <button type="button" role="tab" aria-selected={mode === 'signin'} disabled={loading} onClick={() => switchMode('signin')}
            className={`rounded-lg py-2.5 text-sm font-semibold transition ${mode === 'signin' ? 'bg-[#284C3B] text-white' : 'text-[#687067] hover:bg-[#F7F5EF]'}`}>Connexion</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} disabled={loading} onClick={() => switchMode('signup')}
            className={`rounded-lg py-2.5 text-sm font-semibold transition ${mode === 'signup' ? 'bg-[#284C3B] text-white' : 'text-[#687067] hover:bg-[#F7F5EF]'}`}>Inscription</button>
        </div>

        <form onSubmit={submit} noValidate className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {mode === 'signup' && (
            <div className="rounded-xl border border-[#DCE8DE] bg-[#F1F6F1] px-3 py-3 text-xs leading-relaxed text-[#284C3B]">
              <span className="inline-flex items-center gap-1.5 font-bold"><CheckCircle2 size={15} /> Un seul compte, plusieurs possibilités</span>
              <p className="mt-1">Voyagez avec votre compte. Vous pourrez ensuite demander l'accès hôte depuis « Devenir hôte ».</p>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-full-name" className={labelClass}>Nom complet</label>
              <div className="relative"><UserRound size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C947F]" />
                <input id="auth-full-name" autoComplete="name" type="text" value={fullName} onChange={event => setFullName(event.target.value)} disabled={loading} required maxLength={120} placeholder="Prénom et nom" className={inputClass} />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className={labelClass}>Adresse e-mail</label>
            <div className="relative"><Mail size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C947F]" />
              <input id="auth-email" ref={emailRef} autoComplete="email" type="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} disabled={loading} required placeholder="vous@exemple.com" className={inputClass} />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <div className="mb-1.5 flex items-center justify-between"><label htmlFor="auth-phone" className={labelClass}>Téléphone</label><span className="text-xs text-[#687067]">Facultatif</span></div>
              <div className="relative"><Phone size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C947F]" />
                <input id="auth-phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} disabled={loading} placeholder="+221 77 123 45 67" className={inputClass} />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-password" className={labelClass}>Mot de passe</label>
            <div className="relative"><LockKeyhole size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C947F]" />
              <input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} disabled={loading} required placeholder="Votre mot de passe" className={`${inputClass} pr-12`} />
              <button type="button" disabled={loading} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShowPassword(value => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#687067] hover:text-[#284C3B]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {mode === 'signup' && <p className="mt-1.5 text-xs text-[#687067]">6 caractères minimum.</p>}
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-confirm-password" className={labelClass}>Confirmer le mot de passe</label>
              <div className="relative"><LockKeyhole size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C947F]" />
                <input id="auth-confirm-password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={loading} required placeholder="Saisissez-le à nouveau" className={`${inputClass} pr-12 ${confirmPassword && confirmPassword !== password ? '!border-rose-400' : ''}`} />
                <button type="button" disabled={loading} aria-label={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'} onClick={() => setShowConfirmPassword(value => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#687067] hover:text-[#284C3B]">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {confirmPassword && (confirmPassword === password ?
                <p className="mt-1.5 flex items-center gap-1 text-xs text-[#284C3B]"><CheckCircle2 size={13} /> Les mots de passe correspondent.</p> :
                <p className="mt-1.5 text-xs text-rose-700">Les mots de passe ne correspondent pas.</p>)}
            </div>
          )}

          {errorMsg && <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{errorMsg}</span></div>}
          {successMsg && <div role="status" className="flex items-start gap-2.5 rounded-xl border border-[#CFE3D3] bg-[#F1F6F1] p-3 text-sm text-[#284C3B]"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /><span>{successMsg}</span></div>}

          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#284C3B] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#1B382D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B79B69] disabled:cursor-wait disabled:opacity-60">
            {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
            {loading ? (mode === 'signin' ? 'Connexion en cours…' : 'Création du compte…') : (mode === 'signin' ? 'Se connecter' : 'Créer mon compte')}
          </button>
          {mode === 'signup' && <p className="text-center text-xs leading-relaxed text-[#687067]">En créant votre compte, vous acceptez les conditions d'utilisation et la politique de confidentialité de TerangaSN.</p>}
          <p className="pb-1 text-center text-sm text-[#687067]">
            {mode === 'signin' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
            <button type="button" disabled={loading} onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} className="font-bold text-[#284C3B] hover:underline disabled:opacity-50">
              {mode === 'signin' ? 'S’inscrire' : 'Se connecter'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
