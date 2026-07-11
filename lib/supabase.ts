import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

/** Browser-side client (anon key). Used for Realtime subscriptions only. */
export const supabaseBrowser: SupabaseClient = createClient(url, anonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Server-side client. Uses the service role key when available so API routes
 * bypass RLS (the real authorization is enforced in the route handlers via
 * session checks). Falls back to the anon key if no service key is present
 * (e.g. local dev without the secret) — in that case the permissive RLS
 * policies still allow the queries through.
 */
export function supabaseServer(): SupabaseClient {
  return createClient(url, serviceKey || anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseUrl = url;
