import * as Sentry from '@sentry/react';
import { Capacitor } from '@capacitor/core';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { readSaveSlot } from '@/store/helpers/persistence';
import { backupSlot } from './cloudSave';

// Sign in with Apple (Online Slice 1, phase 1b).
//
// WHY THIS MATTERS: anonymous auth is device-local — on reinstall or a new
// device a fresh anonymous user is minted and the old cloud backup (stored
// under the old uid) becomes unreachable. Signing in with Apple gives the
// player a durable identity their backups follow, which is what makes "restore
// on a new device" actually work.
//
// API NOTE: the `@capacitor-community/apple-sign-in` authorize() options +
// response shape and Supabase's signInWithIdToken({ provider, token, nonce })
// signature were verified against the installed package type definitions
// (apple-sign-in 7.1.0, @supabase/auth-js). The nonce direction is confirmed
// correct: Apple receives the HASHED nonce (so it appears hashed in the token),
// Supabase receives the RAW nonce and hashes it to compare against the token
// claim. What still needs an on-device pass is the runtime wiring + your Apple
// provider config (bundle id / VITE_APPLE_CLIENT_ID, redirect URI, the Supabase
// Apple provider). The surface is dark until VITE_SUPABASE_* + VITE_APPLE_CLIENT_ID
// are set and it runs on a real iOS device, so it can't regress current builds.

// Read env inside functions (not at module load) so it's stubbable in tests and
// never stale.
const supabaseUrl = () => import.meta.env.VITE_SUPABASE_URL as string | undefined;
const appleClientId = () => import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;

export type AuthProvider = 'anonymous' | 'apple';
export interface AuthInfo {
  signedIn: boolean;
  provider: AuthProvider | null;
  email?: string;
}

export type SignInReason = 'unconfigured' | 'unavailable' | 'cancelled' | 'error';
export interface SignInResult {
  ok: boolean;
  reason?: SignInReason;
}

/** Native Sign in with Apple is only meaningful on a real iOS build with the
 *  backend + Apple client id configured. Web/Android/dev are anonymous-only. */
export function appleSignInAvailable(): boolean {
  if (!isSupabaseConfigured() || !appleClientId()) return false;
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
}

/** Current cloud auth state. `anonymous` = a device-local guest identity;
 *  `apple` = a durable signed-in identity; null = no session / unconfigured. */
export async function getAuthInfo(): Promise<AuthInfo> {
  if (!isSupabaseConfigured()) return { signedIn: false, provider: null };
  const client = await getSupabase();
  if (!client) return { signedIn: false, provider: null };
  try {
    const { data: { session } } = await client.auth.getSession();
    const user = session?.user;
    if (!user) return { signedIn: false, provider: null };
    const isAnon = (user as { is_anonymous?: boolean }).is_anonymous === true;
    return { signedIn: true, provider: isAnon ? 'anonymous' : 'apple', email: user.email ?? undefined };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'cloudAuth.getAuthInfo' } });
    return { signedIn: false, provider: null };
  }
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function makeNonce(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Carry the player's current local saves to whatever identity is now active —
 *  used right after a successful upgrade so backups land under the Apple uid.
 *  Best-effort; the local saves are the source of truth either way. */
async function migrateLocalSaves(): Promise<void> {
  for (const slot of [1, 2, 3]) {
    if (readSaveSlot(slot)) {
      try { await backupSlot(slot); } catch { /* best-effort */ }
    }
  }
}

/** Sign in with Apple and upgrade the session to a durable identity.
 *
 *  Nonce flow: a random raw nonce is generated; its SHA-256 is handed to Apple
 *  (so it appears, hashed, in the returned identity token), and the RAW nonce
 *  is handed to Supabase, which verifies SHA-256(raw) matches the token claim.
 *  This binds the token to this request and is the standard native-Apple flow. */
export async function signInWithApple(): Promise<SignInResult> {
  const url = supabaseUrl();
  const clientId = appleClientId();
  if (!isSupabaseConfigured() || !clientId || !url) return { ok: false, reason: 'unconfigured' };
  const client = await getSupabase();
  if (!client) return { ok: false, reason: 'unavailable' };
  try {
    const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
    const rawNonce = makeNonce();
    const hashedNonce = await sha256Hex(rawNonce);
    const result = await SignInWithApple.authorize({
      clientId,
      redirectURI: `${url}/auth/v1/callback`,
      scopes: 'email name',
      nonce: hashedNonce,
    });
    const idToken = result?.response?.identityToken;
    if (!idToken) return { ok: false, reason: 'error' };
    const { error } = await client.auth.signInWithIdToken({ provider: 'apple', token: idToken, nonce: rawNonce });
    if (error) return { ok: false, reason: 'error' };
    await migrateLocalSaves();
    return { ok: true };
  } catch (err) {
    // The plugin throws on user cancellation (ASAuthorizationError.canceled,
    // code 1001) — surface that quietly rather than as an error.
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('cancel') || (err as { code?: string })?.code === '1001') {
      return { ok: false, reason: 'cancelled' };
    }
    Sentry.captureException(err, { tags: { context: 'cloudAuth.signInWithApple' } });
    return { ok: false, reason: 'error' };
  }
}

/** Sign out of the cloud session. Best-effort; never throws. */
export async function signOutCloud(): Promise<void> {
  const client = await getSupabase();
  if (!client) return;
  try { await client.auth.signOut(); } catch { /* best-effort */ }
}
