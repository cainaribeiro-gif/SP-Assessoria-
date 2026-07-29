import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClientInstance: SupabaseClient | null = null;

export function getServerSupabaseClient(): SupabaseClient | null {
  if (adminClientInstance) return adminClientInstance;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    return null;
  }

  try {
    adminClientInstance = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    return adminClientInstance;
  } catch (err) {
    console.error("[Supabase Admin] Error initializing admin client:", err);
    return null;
  }
}
