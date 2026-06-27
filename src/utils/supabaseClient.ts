import type { SupabaseClient } from '@supabase/supabase-js';

// Lazy, env-gated Supabase client for Cloud Save (Online Slice 1).
//
// The cloud backend is OPTIONAL. When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// are absent — dev, and any production build made before the backend is
// provisioned — `isSupabaseConfigured()` is false and the entire cloud-save
// surface stays dark: the Settings section doesn't render and supabase-js is
// never even imported, so there is zero runtime or bundle cost.
//
// supabase-js is pulled in via dynamic import() so it lands in its own chunk
// and never touches the eager-bundle budget enforced by `npm run size:check`.
// The `import type` above is erased at build time and does not pull the library
// into the graph.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True only when both the URL and the anon key are present. Every cloud-save
 *  entry point gates on this, so the feature is a no-op until provisioned. */
export function isSupabaseConfigured(): boolean {
  return !!(url && anonKey);
}

let clientPromise: Promise<SupabaseClient | null> | null = null;

/** Resolve the singleton Supabase client, lazily importing the SDK on first
 *  use. Returns null when unconfigured or if the SDK fails to load — callers
 *  treat null as "cloud unavailable" and fall back to local-only behaviour. */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(url as string, anonKey as string, {
          auth: { persistSession: true, autoRefreshToken: true },
        }),
      )
      .catch(() => null);
  }
  return clientPromise;
}
