import { createClient } from '@supabase/supabase-js';

// Environment variable retrieval (supports Vite & Next.js conventions)
const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) || {};
const envUrl = metaEnv?.VITE_SUPABASE_URL || 
               metaEnv?.NEXT_PUBLIC_SUPABASE_URL || 
               (typeof window !== 'undefined' ? localStorage.getItem('TERANGA_SUPABASE_URL') : null);

const envAnonKey = metaEnv?.VITE_SUPABASE_ANON_KEY || 
                   metaEnv?.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                   (typeof window !== 'undefined' ? localStorage.getItem('TERANGA_SUPABASE_ANON_KEY') : null);

// Placeholder default if not yet supplied to avoid crashing on module load
export const defaultSupabaseUrl = envUrl || 'https://placeholder.supabase.co';
export const defaultSupabaseKey = envAnonKey || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  envUrl && 
  envAnonKey && 
  envUrl !== 'https://your-project.supabase.co' && 
  envUrl !== 'https://placeholder.supabase.co' &&
  !envAnonKey.includes('your-anon-key')
);

export const supabase = createClient(defaultSupabaseUrl, defaultSupabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

/**
 * Update Supabase connection dynamically (saves to localStorage for live testing)
 */
export function saveSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('TERANGA_SUPABASE_URL', url.trim());
    localStorage.setItem('TERANGA_SUPABASE_ANON_KEY', key.trim());
    window.location.reload();
  }
}

/**
 * Clear custom Supabase connection
 */
export function clearSupabaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('TERANGA_SUPABASE_URL');
    localStorage.removeItem('TERANGA_SUPABASE_ANON_KEY');
    window.location.reload();
  }
}
