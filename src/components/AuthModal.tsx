import React, { useEffect, useState } from 'react';

import {
  X,
  Mail,
  Lock,
  User,
  Phone,
  Building2,
  Compass,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

import { useAuth } from '@/src/context/AuthContext';
import { UserRole } from '@/src/types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  initialRole?: UserRole;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  initialRole = 'traveler',
  onSuccess,
}) => {
  const { signIn, signUp, isConfigured } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [role, setRole] = useState<UserRole>(initialRole);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  /*
   * Synchronise le modal lorsque Navbar/App
   * demande une nouvelle ouverture avec un autre mode.
   */
  useEffect(() => {
    if (!isOpen) return;

    setMode(initialMode);
    setRole(initialRole);
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(false);
  }, [isOpen, initialMode, initialRole]);

  /*
   * Nettoyage des messages lorsqu'on change
   * entre connexion et inscription.
   */
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg('');
    setSuccessMsg('');
  }, [mode, isOpen]);

  if (!isOpen) {
    return null;
  }

  const resetMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setPhone('');
    resetMessages();
  };

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setPassword('');
    setConfirmPassword('');
    resetMessages();
  };

  const getErrorMessage = (error: any): string => {
    const message = String(error?.message || '').toLowerCase();

    if (
      message.includes('invalid login credentials') ||
      message.includes('invalid credentials')
    ) {
      return 'Adresse e-mail ou mot de passe incorrect.';
    }

    if (
      message.includes('email not confirmed') ||
      message.includes('email_not_confirmed')
    ) {
      return 'Votre adresse e-mail n’est pas encore confirmée. Vérifiez votre boîte mail.';
    }

    if (
      message.includes('user already registered') ||
      message.includes('already registered') ||
      message.includes('already been registered')
    ) {
      return 'Un compte existe déjà avec cette adresse e-mail.';
    }

    if (message.includes('password should be at least')) {
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    }

    if (
      message.includes('invalid email') ||
      message.includes('email address')
    ) {
      return 'Veuillez saisir une adresse e-mail valide.';
    }

    if (
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return 'Trop de tentatives. Veuillez patienter quelques instants avant de réessayer.';
    }

    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('failed to fetch')
    ) {
      return 'Impossible de contacter le serveur. Vérifiez votre connexion Internet.';
    }

    return error?.message || 'Une erreur est survenue. Veuillez réessayer.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    resetMessages();

    const cleanEmail = email.trim();
    const cleanFullName = fullName.trim();
    const cleanPhone = phone.trim();

    /*
     * Vérifications communes.
     */
    if (!cleanEmail) {
      setErrorMsg('Veuillez saisir votre adresse e-mail.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    if (!password) {
      setErrorMsg('Veuillez saisir votre mot de passe.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    /*
     * Validation spécifique à l'inscription.
     */
    if (mode === 'signup') {
      if (!cleanFullName) {
        setErrorMsg('Veuillez saisir votre nom complet.');
        return;
      }

      if (!cleanPhone) {
        setErrorMsg('Veuillez saisir votre numéro de téléphone.');
        return;
      }

      if (!confirmPassword) {
        setErrorMsg('Veuillez confirmer votre mot de passe.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMsg('Les deux mots de passe ne correspondent pas.');
        return;
      }
    }

    if (!isConfigured) {
      setErrorMsg(
        'La connexion à Supabase n’est pas encore configurée.'
      );
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        await signIn(cleanEmail, password);

        setSuccessMsg('Connexion réussie.');

        if (onSuccess) {
          onSuccess();
        }

        /*
         * Petite temporisation pour permettre à l'interface
         * de mettre à jour l'état utilisateur avant fermeture.
         */
        setTimeout(() => {
          resetForm();
          onClose();
        }, 300);
      } else {
        /*
         * Le signUp de AuthContext retourne uniquement { error }.
         */
        await signUp(
          cleanEmail,
          password,
          cleanFullName,
          cleanPhone,
          role
        );

        setSuccessMsg(
          'Compte créé avec succès ! Vous pouvez maintenant vous connecter.'
        );

        setMode('signin');
        setPassword('');
        setConfirmPassword('');

        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error: any) {
      console.error('Erreur Auth:', error);
      setErrorMsg(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;

    resetForm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative border-b border-gray-100 px-6 py-5">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>

          <div className="pr-10">
            <h2 className="text-xl font-bold text-gray-900">
              {mode === 'signin'
                ? 'Bienvenue sur TerangaSN'
                : 'Créer votre compte'}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {mode === 'signin'
                ? 'Connectez-vous pour gérer vos réservations.'
                : 'Créez votre compte pour réserver vos séjours.'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-gray-100">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            disabled={loading}
            className={`px-4 py-3 text-sm font-semibold transition ${
              mode === 'signin'
                ? 'border-b-2 border-emerald-600 text-emerald-700'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Se connecter
          </button>

          <button
            type="button"
            onClick={() => switchMode('signup')}
            disabled={loading}
            className={`px-4 py-3 text-sm font-semibold transition ${
              mode === 'signup'
                ? 'border-b-2 border-emerald-600 text-emerald-700'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            S’inscrire
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[75vh] overflow-y-auto px-6 py-6"
        >
          {/* Role */}
          {mode === 'signup' && (
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Type de compte
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('traveler')}
                  disabled={loading}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    role === 'traveler'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Compass size={20} />

                  <div>
                    <div className="text-sm font-semibold">
                      Voyageur
                    </div>

                    <div className="text-xs text-gray-500">
                      Réserver un séjour
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  disabled={loading}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    role === 'owner'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Building2 size={20} />

                  <div>
                    <div className="text-sm font-semibold">
                      Hôtelier
                    </div>

                    <div className="text-xs text-gray-500">
                      Gérer un établissement
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Full name */}
          {mode === 'signup' && (
            <div className="mb-4">
              <label
                htmlFor="auth-full-name"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Nom complet
              </label>

              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="auth-full-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Votre nom complet"
                  autoComplete="name"
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-100"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="mb-4">
            <label
              htmlFor="auth-email"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Adresse e-mail
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@email.com"
                autoComplete="email"
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Phone */}
          {mode === 'signup' && (
            <div className="mb-4">
              <label
                htmlFor="auth-phone"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Téléphone
              </label>

              <div className="relative">
                <Phone
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="auth-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+221 77 123 45 67"
                  autoComplete="tel"
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-100"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div className="mb-4">
            <label
              htmlFor="auth-password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Mot de passe
            </label>

            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={
                  mode === 'signin'
                    ? 'current-password'
                    : 'new-password'
                }
                minLength={6}
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-100"
              />
            </div>

            {mode === 'signup' && (
              <p className="mt-1 text-xs text-gray-400">
                Minimum 6 caractères.
              </p>
            )}
          </div>

          {/* Confirm password */}
          {mode === 'signup' && (
            <div className="mb-5">
              <label
                htmlFor="auth-confirm-password"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Confirmer le mot de passe
              </label>

              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="auth-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="••••••••"
                  autoComplete="new-password"
                  minLength={6}
                  disabled={loading}
                  className={`w-full rounded-xl border py-3 pl-10 pr-4 text-sm outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                    confirmPassword &&
                    password !== confirmPassword
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                      : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-100'
                  }`}
                />
              </div>

              {confirmPassword &&
                password === confirmPassword && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 size={13} />
                    Les mots de passe correspondent.
                  </div>
                )}
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0"
              />

              <span>{successMsg}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2
                  size={18}
                  className="animate-spin"
                />

                {mode === 'signin'
                  ? 'Connexion...'
                  : 'Création du compte...'}
              </>
            ) : mode === 'signin' ? (
              'Se connecter'
            ) : (
              'Créer mon compte'
            )}
          </button>

          {/* Terms */}
          {mode === 'signup' && (
            <p className="mt-4 text-center text-xs leading-relaxed text-gray-400">
              En créant un compte, vous acceptez les conditions
              d’utilisation et la politique de confidentialité de
              TerangaSN.
            </p>
          )}

          {/* Bottom switch */}
          <div className="mt-5 text-center text-sm text-gray-500">
            {mode === 'signin' ? (
              <>
                Vous n’avez pas encore de compte ?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  disabled={loading}
                  className="font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  S’inscrire
                </button>
              </>
            ) : (
              <>
                Vous avez déjà un compte ?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  disabled={loading}
                  className="font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Se connecter
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;