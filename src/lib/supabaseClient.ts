import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve from Vite env, Next.js style env, or persisted admin settings
function getEnvOrStored(key: string, storedKey: string): string {
  const envVal = (import.meta as any).env?.[key] || '';
  if (envVal && !envVal.includes('YOUR_SUPABASE') && !envVal.includes('MY_')) {
    return envVal;
  }
  try {
    const stored = localStorage.getItem(storedKey);
    if (stored) return stored;
  } catch {
    // ignore
  }
  return '';
}

export function getResolvedSupabaseCredentials(): { url: string; anonKey: string } {
  const url =
    getEnvOrStored('VITE_SUPABASE_URL', 'vi_custom_supabase_url') ||
    getEnvOrStored('NEXT_PUBLIC_SUPABASE_URL', 'vi_custom_supabase_url');
  const anonKey =
    getEnvOrStored('VITE_SUPABASE_ANON_KEY', 'vi_custom_supabase_anon_key') ||
    getEnvOrStored('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'vi_custom_supabase_anon_key');

  return { url, anonKey };
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getResolvedSupabaseCredentials();

  const isConfigured = Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    !url.includes('YOUR_SUPABASE') &&
    !url.includes('YOUR_PROJECT_ID')
  );

  if (!isConfigured) {
    return null;
  }

  if (cachedClient && lastUrl === url && lastKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    lastUrl = url;
    lastKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
}

export const isSupabaseConfigured: boolean = Boolean(getSupabaseClient());
export const supabase: SupabaseClient | null = getSupabaseClient();

export function saveCustomSupabaseConfig(url: string, anonKey: string) {
  try {
    localStorage.setItem('vi_custom_supabase_url', url.trim());
    localStorage.setItem('vi_custom_supabase_anon_key', anonKey.trim());
    cachedClient = null;
    lastUrl = '';
    lastKey = '';
  } catch {
    // ignore
  }
}

export function clearCustomSupabaseConfig() {
  try {
    localStorage.removeItem('vi_custom_supabase_url');
    localStorage.removeItem('vi_custom_supabase_anon_key');
    cachedClient = null;
    lastUrl = '';
    lastKey = '';
  } catch {
    // ignore
  }
}

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  url: string;
  hasAnonKey: boolean;
}

export function getSupabaseStatus(): SupabaseConfigStatus {
  const { url, anonKey } = getResolvedSupabaseCredentials();
  const client = getSupabaseClient();
  return {
    isConfigured: Boolean(client),
    url: url ? url : 'Not Configured (Using Built-in Atomic DB)',
    hasAnonKey: Boolean(anonKey),
  };
}
