import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/src/lib/supabase/client';
import { Profile, UserRole } from '@/src/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone: string, role?: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Error fetching profile from Supabase:', error.message);
        // Fallback profile if record does not exist yet
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.error('Failed to load profile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    if (p) setProfile(p);
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        if (!isSupabaseConfigured) {
          setIsLoading(false);
          return;
        }

        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            const userProfile = await fetchProfile(initialSession.user.id);
            if (mounted) {
              setProfile(userProfile);
            }
          }
        }
      } catch (error) {
        console.error('Supabase auth initialization error:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const userProfile = await fetchProfile(newSession.user.id);
        if (mounted) setProfile(userProfile);
      } else {
        if (mounted) setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        setUser(data.user);
        const p = await fetchProfile(data.user.id);
        setProfile(p);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    fullName: string, 
    phone: string, 
    role: UserRole = 'traveler'
  ) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            role: role,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Upsert into public.profiles table explicitly to guarantee presence
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: email.trim(),
            full_name: fullName.trim(),
            phone: phone.trim(),
            role: role,
            created_at: new Date().toISOString(),
          });

        if (profileError) {
          console.warn('Profile table insert warning:', profileError.message);
        }

        const p = await fetchProfile(data.user.id);
        setProfile(p || {
          id: data.user.id,
          email: email.trim(),
          full_name: fullName.trim(),
          phone: phone.trim(),
          role: role,
          avatar_url: null,
          created_at: new Date().toISOString()
        });
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      return { error: error || null };
    } catch (err: any) {
      return { error: err };
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Non connecté') };
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
