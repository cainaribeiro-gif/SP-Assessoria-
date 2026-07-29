import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof window !== 'undefined' ? localStorage.getItem("supabase_url") : "") || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof window !== 'undefined' ? localStorage.getItem("supabase_anon_key") : "") || "";

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("https://")) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export const supabase = supabaseInstance;

export function getSupabaseCredentials() {
  const url = import.meta.env.VITE_SUPABASE_URL || (typeof window !== 'undefined' ? localStorage.getItem("supabase_url") : "") || "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof window !== 'undefined' ? localStorage.getItem("supabase_anon_key") : "") || "";
  const serviceRoleKey = (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : "") || (typeof window !== 'undefined' ? localStorage.getItem("supabase_service_role_key") : "") || "";
  return { url, anonKey, serviceRoleKey };
}

export function saveSupabaseCredentials(url: string, anonKey: string, serviceRoleKey: string = "") {
  if (typeof window === 'undefined') return;
  if (url) localStorage.setItem("supabase_url", url.trim());
  else localStorage.removeItem("supabase_url");

  if (anonKey) localStorage.setItem("supabase_anon_key", anonKey.trim());
  else localStorage.removeItem("supabase_anon_key");

  if (serviceRoleKey) localStorage.setItem("supabase_service_role_key", serviceRoleKey.trim());
  else localStorage.removeItem("supabase_service_role_key");

  supabaseInstance = null;
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(url && anonKey && url.startsWith("https://"));
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey || !url.startsWith("https://")) {
    return null;
  }

  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return supabaseInstance;
  } catch (err) {
    console.error("[Supabase] Error initializing client:", err);
    return null;
  }
}
