import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { User, Session } from '@supabase/supabase-js';

import {
  supabase,
  isSupabaseConfigured,
} from '@/src/lib/supabase/client';
import { TERMS_VERSION } from '@/src/lib/legal';

import { Profile, UserRole } from '@/src/types';

interface AuthResult {
  error: Error | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole;
  hasHostAccess: boolean;
  hasAdminStaffAccess: boolean;
  adminStaffPermissions: string[];
  adminStaffPresence: 'online' | 'away';

  isLoading: boolean;
  isConfigured: boolean;

  signIn: (
    email: string,
    password: string
  ) => Promise<AuthResult>;

  /**
   * Une inscription classique crée toujours un compte voyageur.
   *
   * Le rôle hôte ne doit pas être choisi pendant l'inscription.
   * Il sera activé plus tard via le parcours "Devenir hôte".
   */
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string | undefined,
    acceptedTerms: boolean
  ) => Promise<AuthResult>;

  signOut: () => Promise<AuthResult>;

  updateProfile: (
    updates: Partial<Profile>
  ) => Promise<AuthResult>;

  refreshProfile: () => Promise<void>;
  setAdminStaffPresence: (preference: 'online' | 'away') => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasHostAccess, setHasHostAccess] = useState(false);
  const [hasAdminStaffAccess, setHasAdminStaffAccess] = useState(false);
  const [adminStaffPermissions, setAdminStaffPermissions] = useState<string[]>([]);
  const [adminStaffPresence, setAdminStaffPresenceState] = useState<'online' | 'away'>('online');
  const adminStaffPresenceRef = useRef<'online' | 'away'>('online');

  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Récupère le profil public correspondant
   * à l'utilisateur Supabase Auth.
   */
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      if (!isSupabaseConfigured) {
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn(
            'Error fetching profile from Supabase:',
            error.message
          );

          return null;
        }

        return data ? (data as Profile) : null;
      } catch (err) {
        console.error('Failed to load profile:', err);
        return null;
      }
    },
    []
  );

  // L'habilitation hôte est distincte du rôle administratif.
  // Une ligne d'abonnement atteste de l'activation, même si l'abonnement
  // n'est plus actif : les restrictions commerciales sont gérées ailleurs.
  const fetchHostAccess = useCallback(async (userId: string): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    try {
      const { data, error } = await supabase
        .from('owner_subscriptions')
        .select('owner_id')
        .eq('owner_id', userId)
        .limit(1);
      if (error) {
        console.warn('Impossible de vérifier l’activation hôte :', error.message);
        return false;
      }
      return Boolean(data?.length);
    } catch (error) {
      console.warn('Impossible de vérifier l’activation hôte :', error);
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const clearStaffAccess = () => {
      setHasAdminStaffAccess(false);
      setAdminStaffPermissions([]);
      setAdminStaffPresenceState('online');
      adminStaffPresenceRef.current = 'online';
    };

    if (!user || !isSupabaseConfigured) {
      clearStaffAccess();
      return () => { active = false; };
    }

    const initializeStaffAccess = async () => {
      try {
        const { error: claimError } = await supabase.rpc('claim_admin_staff_invite');
        if (claimError) throw claimError;
        const { data, error } = await supabase.rpc('get_my_admin_staff_access');
        if (error) throw error;
        if (!active) return;

        const permissions = Array.isArray(data?.permissions)
          ? data.permissions.filter((permission: unknown): permission is string => typeof permission === 'string')
          : [];
        const isActiveStaff = data?.account_status === 'active';
        const preference = data?.presence_preference === 'away' ? 'away' : 'online';
        setHasAdminStaffAccess(isActiveStaff);
        setAdminStaffPermissions(isActiveStaff ? permissions : []);
        if (isActiveStaff) {
          setAdminStaffPresenceState(preference);
          adminStaffPresenceRef.current = preference;
          const { error: presenceError } = await supabase.rpc('update_admin_staff_presence', {
            p_preference: preference,
          });
          if (presenceError) console.warn('Impossible de mettre à jour la présence équipe :', presenceError.message);
          if (!active) return;
          heartbeat = setInterval(() => {
            void supabase.rpc('update_admin_staff_presence', { p_preference: adminStaffPresenceRef.current })
              .then(({ error: presenceUpdateError }) => {
                if (presenceUpdateError) console.warn('Heartbeat équipe impossible :', presenceUpdateError.message);
              });
          }, 60_000);
        }
      } catch (error) {
        if (!active) return;
        clearStaffAccess();
        console.warn('Impossible de vérifier les accès équipe :', error);
      }
    };

    void initializeStaffAccess();
    return () => {
      active = false;
      if (heartbeat) clearInterval(heartbeat);
    };
  }, [user?.id]);

  const setAdminStaffPresence = useCallback(async (preference: 'online' | 'away'): Promise<AuthResult> => {
    if (!user || !hasAdminStaffAccess) return { error: new Error('Accès collaborateur requis.') };
    const { error } = await supabase.rpc('update_admin_staff_presence', { p_preference: preference });
    if (error) return { error };
    adminStaffPresenceRef.current = preference;
    setAdminStaffPresenceState(preference);
    return { error: null };
  }, [user, hasAdminStaffAccess]);

  /**
   * Recharge le profil de l'utilisateur connecté.
   */
  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setHasHostAccess(false);
      return;
    }

    const [refreshedProfile, refreshedHostAccess] = await Promise.all([
      fetchProfile(user.id), fetchHostAccess(user.id),
    ]);
    setProfile(refreshedProfile);
    setHasHostAccess(refreshedHostAccess);
  }, [user, fetchProfile, fetchHostAccess]);

  // Les événements SIGNED_IN peuvent être émis quand un onglet reprend le focus.
  // Un renouvellement de token ne doit pas réinitialiser les droits ni l'interface.
  const currentUserIdRef = useRef<string | null>(null);
  const authGenerationRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let startupComplete = false;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const applySession = async (nextSession: Session | null, force = false) => {
      if (!mounted) return;
      const nextId = nextSession?.user?.id ?? null;
      const previousId = currentUserIdRef.current;
      const identityChanged = previousId !== nextId;
      const generation = ++authGenerationRef.current;

      // Ne pas invalider le profil / rôle lors d'un simple renouvellement de session.
      setSession(nextSession);
      if (!identityChanged && !force) return;

      currentUserIdRef.current = nextId;
      setUser(nextSession?.user ?? null);
      if (!nextId) {
        setProfile(null);
        setHasHostAccess(false);
        setHasAdminStaffAccess(false);
        setAdminStaffPermissions([]);
        return;
      }

      if (identityChanged) {
        // Changement réel de compte : les droits de l'ancien compte ne doivent pas survivre.
        setProfile(null);
        setHasHostAccess(false);
        setHasAdminStaffAccess(false);
        setAdminStaffPermissions([]);
      }

      const [freshProfile, freshHostAccess] = await Promise.all([
        fetchProfile(nextId),
        fetchHostAccess(nextId),
      ]);
      if (!mounted || authGenerationRef.current !== generation) return;

      // Une panne réseau ponctuelle lors d'une reprise d'onglet ne doit pas effacer
      // un profil valide. Un changement de compte a déjà vidé l'ancien profil.
      if (freshProfile) setProfile(freshProfile);
      setHasHostAccess(freshHostAccess);
    };

    const finishStartup = () => {
      if (!mounted) return;
      startupComplete = true;
      setIsLoading(false);
    };

    const initialize = async () => {
      if (!isSupabaseConfigured) {
        await applySession(null);
        finishStartup();
        return;
      }
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn('Initialisation de session Supabase :', error.message);
        await applySession(data.session);
      } catch (error) {
        // Ne pas déconnecter l'utilisateur à cause d'une erreur réseau temporaire.
        console.warn('Session Supabase temporairement indisponible :', error);
      } finally {
        finishStartup();
      }
    };

    // Supabase conseille de ne pas effectuer de requêtes Supabase awaitées
    // directement dans onAuthStateChange (risque de blocage du verrou auth).
    // L'écouteur reste synchrone ; les lectures de profil sont différées.
    const subscription = isSupabaseConfigured
      ? supabase.auth.onAuthStateChange((event, nextSession) => {
          if (!mounted) return;
          if (event === 'TOKEN_REFRESHED') {
            setSession(nextSession);
            return;
          }
          if (event === 'INITIAL_SESSION' && !startupComplete) return;
          if (pendingTimer !== null) clearTimeout(pendingTimer);
          pendingTimer = setTimeout(() => {
            pendingTimer = null;
            if (!mounted) return;
            void applySession(nextSession).catch(error => {
              console.warn('Synchronisation de session :', error);
            });
          }, 0);
        }).data.subscription
      : null;

    void initialize();
    return () => {
      mounted = false;
      authGenerationRef.current += 1;
      if (pendingTimer !== null) clearTimeout(pendingTimer);
      subscription?.unsubscribe();
    };
  }, [fetchProfile, fetchHostAccess]);

  /**
   * Connexion par e-mail + mot de passe.
   */
  const signIn = async (
    email: string,
    password: string
  ): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          'La connexion à Supabase n’est pas encore configurée.'
        ),
      };
    }

    try {
      setIsLoading(true);

      const cleanEmail = email.trim().toLowerCase();

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        return { error };
      }

      currentUserIdRef.current = data.user?.id ?? null;
      setSession(data.session ?? null);
      setUser(data.user ?? null);

      if (data.user) {
        const [userProfile, hostAccess] = await Promise.all([
          fetchProfile(data.user.id), fetchHostAccess(data.user.id),
        ]);
        setProfile(userProfile);
        setHasHostAccess(hostAccess);
      } else {
        setProfile(null);
        setHasHostAccess(false);
        setHasAdminStaffAccess(false);
        setAdminStaffPermissions([]);
      }

      return { error: null };
    } catch (err: any) {
      return {
        error:
          err instanceof Error
            ? err
            : new Error(
                'Une erreur est survenue pendant la connexion.'
              ),
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Création d'un compte TerangaSN.
   *
   * IMPORTANT :
   * Une inscription classique crée TOUJOURS un compte voyageur.
   *
   * Le même compte pourra ensuite activer ses fonctionnalités
   * hôte depuis le parcours "Devenir hôte".
   */
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string | undefined,
    acceptedTerms: boolean
  ): Promise<AuthResult> => {
    if (!acceptedTerms) {
      return { error: new Error('Vous devez accepter les conditions d’utilisation pour créer un compte.') };
    }

    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          'La connexion à Supabase n’est pas encore configurée.'
        ),
      };
    }

    try {
      setIsLoading(true);

      const cleanEmail = email.trim().toLowerCase();
      const cleanFullName = fullName.trim();
      const cleanPhone = phone?.trim() ?? '';

      const accountRole: UserRole = 'traveler';

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,

        options: {
          data: {
            full_name: cleanFullName,
            phone: cleanPhone || null,
            role: accountRole,
            terms_accepted_at: new Date().toISOString(),
            terms_version: TERMS_VERSION,
          },
        },
      });

      if (error) {
        return { error };
      }

      if (!data.user) {
        return {
          error: new Error(
            'Impossible de créer le compte pour le moment.'
          ),
        };
      }

      /**
       * On garantit l'existence du profil public.
       *
       * Pour l'instant on conserve la structure actuelle de la table
       * profiles. La future activation hôte sera adaptée lorsque nous
       * travaillerons sur la structure Supabase finale.
       */
      const now = new Date().toISOString();

      const profilePayload = {
        id: data.user.id,
        email: cleanEmail,
        full_name: cleanFullName,
        phone: cleanPhone || null,
        role: accountRole,
        created_at: now,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload);

      if (profileError) {
        /**
         * Le compte Auth peut malgré tout avoir été créé.
         * On ne supprime donc surtout pas automatiquement
         * l'utilisateur Auth ici.
         */
        console.warn(
          'Profile table insert warning:',
          profileError.message
        );
      }

      const savedProfile = await fetchProfile(data.user.id);

      const fallbackProfile: Profile = {
        id: data.user.id,
        email: cleanEmail,
        full_name: cleanFullName,
        phone: cleanPhone || null,
        role: accountRole,
        avatar_url: null,
        created_at: now,
      };

      setProfile(savedProfile ?? fallbackProfile);
      setHasHostAccess(data.session ? await fetchHostAccess(data.user.id) : false);

      /**
       * Si la confirmation e-mail est désactivée dans Supabase,
       * signUp peut fournir directement une session.
       *
       * Si la confirmation e-mail est activée, session sera null :
       * le compte existe mais l'utilisateur devra confirmer son e-mail
       * avant d'obtenir une session.
       */
      if (data.session) {
        currentUserIdRef.current = data.user.id;
        setSession(data.session);
        setUser(data.user);
      }

      return { error: null };
    } catch (err: any) {
      return {
        error:
          err instanceof Error
            ? err
            : new Error(
                'Une erreur est survenue pendant la création du compte.'
              ),
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Déconnexion.
   */
  const signOut = async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      currentUserIdRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setHasHostAccess(false);
      setHasAdminStaffAccess(false);
      setAdminStaffPermissions([]);

      return { error: null };
    }

    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        return { error };
      }

      currentUserIdRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setHasHostAccess(false);

      return { error: null };
    } catch (err: any) {
      return {
        error:
          err instanceof Error
            ? err
            : new Error(
                'Une erreur est survenue pendant la déconnexion.'
              ),
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Mise à jour du profil.
   *
   * Le rôle n'est volontairement PAS modifiable depuis cette
   * fonction générique. Cela évite qu'un utilisateur puisse
   * simplement s'attribuer le rôle "owner" depuis l'interface.
   *
   * L'activation hôte aura son propre flux sécurisé.
   */
  const updateProfile = async (
    updates: Partial<Profile>
  ): Promise<AuthResult> => {
    if (!user) {
      return {
        error: new Error('Non connecté'),
      };
    }

    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          'La connexion à Supabase n’est pas encore configurée.'
        ),
      };
    }

    try {
      const {
        role: _ignoredRole,
        id: _ignoredId,
        created_at: _ignoredCreatedAt,
        ...safeUpdates
      } = updates;

      const { error } = await supabase
        .from('profiles')
        .update({
          ...safeUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        return { error };
      }

      const refreshedProfile = await fetchProfile(user.id);

      if (refreshedProfile) {
        setProfile(refreshedProfile);
      }

      return { error: null };
    } catch (err: any) {
      return {
        error:
          err instanceof Error
            ? err
            : new Error(
                'Une erreur est survenue pendant la mise à jour du profil.'
              ),
      };
    }
  };

  /**
   * Compatibilité avec l'architecture actuelle.
   *
   * À terme, le compte ne devra probablement plus être pensé
   * comme "traveler OU owner", mais comme un compte utilisateur
   * pouvant posséder des capacités hôte supplémentaires.
   *
   * Nous ferons cette évolution avec le schéma Supabase final.
   */
  const role: UserRole = profile?.role || 'traveler';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        hasHostAccess,
        hasAdminStaffAccess,
        adminStaffPermissions,
        adminStaffPresence,

        isLoading,
        isConfigured: isSupabaseConfigured,

        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshProfile,
        setAdminStaffPresence,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
};