import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { User, Session } from '@supabase/supabase-js';

import {
  supabase,
  isSupabaseConfigured,
} from '@/src/lib/supabase/client';

import { Profile, UserRole } from '@/src/types';

interface AuthResult {
  error: Error | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole;

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
    phone?: string
  ) => Promise<AuthResult>;

  signOut: () => Promise<AuthResult>;

  updateProfile: (
    updates: Partial<Profile>
  ) => Promise<AuthResult>;

  refreshProfile: () => Promise<void>;
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

  /**
   * Recharge le profil de l'utilisateur connecté.
   */
  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const refreshedProfile = await fetchProfile(user.id);

    setProfile(refreshedProfile);
  }, [user, fetchProfile]);

  /**
   * Initialise la session et écoute ensuite
   * les changements d'authentification Supabase.
   */
  useEffect(() => {
    let mounted = true;

    const loadProfileForSession = async (
      currentSession: Session | null
    ) => {
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (!currentSession?.user) {
        setProfile(null);
        return;
      }

      const userProfile = await fetchProfile(
        currentSession.user.id
      );

      if (!mounted) return;

      setProfile(userProfile);
    };

    const initAuth = async () => {
      try {
        if (!isSupabaseConfigured) {
          if (mounted) {
            setUser(null);
            setSession(null);
            setProfile(null);
          }

          return;
        }

        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn(
            'Supabase session initialization warning:',
            error.message
          );
        }

        await loadProfileForSession(initialSession);
      } catch (error) {
        console.error(
          'Supabase auth initialization error:',
          error
        );

        if (mounted) {
          setUser(null);
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void initAuth();

    if (!isSupabaseConfigured) {
      return () => {
        mounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;

        try {
          await loadProfileForSession(newSession);
        } finally {
          if (mounted) {
            setIsLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

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

      setSession(data.session ?? null);
      setUser(data.user ?? null);

      if (data.user) {
        const userProfile = await fetchProfile(data.user.id);

        setProfile(userProfile);
      } else {
        setProfile(null);
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
    phone: string = ''
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
      const cleanFullName = fullName.trim();
      const cleanPhone = phone.trim();

      const accountRole: UserRole = 'traveler';

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,

        options: {
          data: {
            full_name: cleanFullName,
            phone: cleanPhone || null,
            role: accountRole,
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

      /**
       * Si la confirmation e-mail est désactivée dans Supabase,
       * signUp peut fournir directement une session.
       *
       * Si la confirmation e-mail est activée, session sera null :
       * le compte existe mais l'utilisateur devra confirmer son e-mail
       * avant d'obtenir une session.
       */
      if (data.session) {
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
      setUser(null);
      setSession(null);
      setProfile(null);

      return { error: null };
    }

    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        return { error };
      }

      setUser(null);
      setSession(null);
      setProfile(null);

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

        isLoading,
        isConfigured: isSupabaseConfigured,

        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshProfile,
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