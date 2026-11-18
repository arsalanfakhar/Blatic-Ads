import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function isAtlasConfigured(): boolean {
  return !!(process.env.ATLAS_SUPABASE_URL && process.env.ATLAS_SUPABASE_SERVICE_KEY);
}

export function atlasClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.ATLAS_SUPABASE_URL;
  const key = process.env.ATLAS_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Atlas connection not configured. Set ATLAS_SUPABASE_URL and ATLAS_SUPABASE_SERVICE_KEY.');
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
