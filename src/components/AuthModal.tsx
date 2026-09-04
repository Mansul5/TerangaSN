import React, { useState } from 'react';
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
  CheckCircle2
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
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const { error } = await signUp(email, password, fullName, phone, role);
        if (error) throw error;
        setSuccessMsg('Compte créé avec succès !');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue lors de l’authentification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#2D2A26]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-[#E6E2D3] overflow-hidden relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FAF9F6] hover:bg-[#F0EDE4] text-[#6B6658] hover:text-[#2D2A26] flex items-center justify-center transition cursor-pointer z-10 border border-[#E6E2D3]"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="bg-[#3F6212] text-white p-6 pb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
            <span className="text-xs font-bold tracking-wider uppercase text-[#E6E2D3]">
              Teranga Booking Sénégal
            </span>
          </div>
          <h3 className="text-xl font-serif font-bold">
            {mode === 'signin' ? 'Connexion à votre compte' : 'Créer votre compte'}
          </h3>
          <p className="text-xs text-[#D1DBC2] mt-1">
            {mode === 'signin' 
              ? 'Accédez à vos réservations, favoris et établissements au Sénégal' 
              : 'Rejoignez la communauté de voyageurs et hôteliers du Sénégal'}
          </p>
        </div>

        {/* Auth Mode Toggle */}
        <div className="flex border-b border-[#E6E2D3] bg-[#FAF9F6] text-xs font-bold">
          <button
            type="button"
            onClick={() => { setMode('signin'); setErrorMsg(null); }}
            className={`flex-1 py-3 text-center transition cursor-pointer border-b-2 ${
              mode === 'signin'
                ? 'border-[#3F6212] text-[#3F6212] bg-white'
                : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
            }`}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMsg(null); }}
            className={`flex-1 py-3 text-center transition cursor-pointer border-b-2 ${
              mode === 'signup'
                ? 'border-[#3F6212] text-[#3F6212] bg-white'
                : 'border-transparent text-[#6B6658] hover:text-[#2D2A26]'
            }`}
          >
            S'inscrire
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-[#ECF3E5] border border-[#D1DBC2] text-[#3F6212] text-xs rounded-xl flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Role selector on Signup */}
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#2D2A26]">
                Type de compte
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('traveler')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                    role === 'traveler'
                      ? 'border-[#3F6212] bg-[#ECF3E5] text-[#2D2A26] ring-1 ring-[#3F6212]'
                      : 'border-[#E6E2D3] hover:bg-[#FAF9F6] text-[#6B6658]'
                  }`}
                >
                  <Compass size={18} className={role === 'traveler' ? 'text-[#3F6212]' : 'text-[#8C887D]'} />
                  <div>
                    <p className="text-xs font-bold text-[#2D2A26]">Voyageur</p>
                    <p className="text-[10px] text-[#6B6658]">Réserver des séjours</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                    role === 'owner'
                      ? 'border-[#8B5E34] bg-[#F0EDE4] text-[#2D2A26] ring-1 ring-[#8B5E34]'
                      : 'border-[#E6E2D3] hover:bg-[#FAF9F6] text-[#6B6658]'
                  }`}
                >
                  <Building2 size={18} className={role === 'owner' ? 'text-[#8B5E34]' : 'text-[#8C887D]'} />
                  <div>
                    <p className="text-xs font-bold text-[#2D2A26]">Hôtelier / Gérant</p>
                    <p className="text-[10px] text-[#6B6658]">Publier hébergement</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Full name on Signup */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-[#2D2A26] mb-1">
                Nom complet
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-[#E6E2D3] rounded-xl focus-within:border-[#3F6212]">
                <User size={16} className="text-[#8C887D] shrink-0" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Fatou Diallo ou Moussa Ndiaye"
                  className="w-full text-xs text-[#2D2A26] bg-transparent outline-none"
                />
              </div>
            </div>
          )}

          {/* Email field */}
          <div>
            <label className="block text-xs font-bold text-[#2D2A26] mb-1">
              Adresse email
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-[#E6E2D3] rounded-xl focus-within:border-[#3F6212]">
              <Mail size={16} className="text-[#8C887D] shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre.email@exemple.sn"
                className="w-full text-xs text-[#2D2A26] bg-transparent outline-none"
              />
            </div>
          </div>

          {/* Phone field on Signup */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-[#2D2A26] mb-1">
                Numéro de téléphone (Sénégal)
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-[#E6E2D3] rounded-xl focus-within:border-[#3F6212]">
                <Phone size={16} className="text-[#8C887D] shrink-0" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+221 77 123 45 67"
                  className="w-full text-xs text-[#2D2A26] bg-transparent outline-none"
                />
              </div>
            </div>
          )}

          {/* Password field */}
          <div>
            <label className="block text-xs font-bold text-[#2D2A26] mb-1">
              Mot de passe
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-[#E6E2D3] rounded-xl focus-within:border-[#3F6212]">
              <Lock size={16} className="text-[#8C887D] shrink-0" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Au moins 6 caractères"
                className="w-full text-xs text-[#2D2A26] bg-transparent outline-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="auth-submit-btn"
            disabled={loading}
            className="w-full py-3 bg-[#3F6212] hover:bg-[#365314] active:bg-[#2D450D] text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Chargement...</span>
              </>
            ) : mode === 'signin' ? (
              <span>Se connecter</span>
            ) : (
              <span>Créer mon compte {role === 'owner' ? 'Hôtelier' : 'Voyageur'}</span>
            )}
          </button>

          <p className="text-[11px] text-center text-[#8C887D]">
            En continuant, vous acceptez les conditions d'utilisation de Teranga Booking Sénégal.
          </p>
        </form>

      </div>
    </div>
  );
};
