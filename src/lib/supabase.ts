import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseCredentials() {
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem("supabase_url") || "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem("supabase_anon_key") || "";
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || localStorage.getItem("supabase_service_role_key") || "";
  return { url, anonKey, serviceRoleKey };
}

export function saveSupabaseCredentials(url: string, anonKey: string, serviceRoleKey: string = "") {
  if (url) localStorage.setItem("supabase_url", url.trim());
  else localStorage.removeItem("supabase_url");

  if (anonKey) localStorage.setItem("supabase_anon_key", anonKey.trim());
  else localStorage.removeItem("supabase_anon_key");

  if (serviceRoleKey) localStorage.setItem("supabase_service_role_key", serviceRoleKey.trim());
  else localStorage.removeItem("supabase_service_role_key");

  // Reset client instance so it re-initializes
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
    supabaseInstance = createClient(url, anonKey);
    return supabaseInstance;
  } catch (err) {
    console.error("[Supabase] Error initializing client:", err);
    return null;
  }
}
