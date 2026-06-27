/**
 * cloudAuth — Sign in with Apple wiring, verified against mocked plugin +
 * Supabase client. The high-value assertion is the NONCE direction: Apple must
 * receive the SHA-256 hash of the raw nonce, and Supabase must receive the raw
 * nonce (it re-hashes and compares to the token claim). A mismatch here is a
 * silent "invalid nonce" auth failure on device, so it's worth a unit lock.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

let currentSession: { user: { id: string; is_anonymous?: boolean; email?: string } } | null = null;
const idTokenCalls: { provider: string; token: string; nonce?: string }[] = [];
const authorizeCalls: { nonce?: string }[] = [];
const backupCalls: number[] = [];

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
}));

vi.mock('@capacitor-community/apple-sign-in', () => ({
  SignInWithApple: {
    authorize: async (opts: { nonce?: string }) => {
      authorizeCalls.push({ nonce: opts.nonce });
      return { response: { identityToken: 'apple-id-token', user: 'u', email: null, givenName: null, familyName: null, authorizationCode: 'c' } };
    },
  },
}));

vi.mock('@/utils/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: async () => ({
    auth: {
      getSession: async () => ({ data: { session: currentSession } }),
      signInWithIdToken: async (creds: { provider: string; token: string; nonce?: string }) => {
        idTokenCalls.push(creds);
        currentSession = { user: { id: 'apple-uid', is_anonymous: false, email: 'a@b.c' } };
        return { data: { session: currentSession }, error: null };
      },
      signOut: async () => { currentSession = null; return { error: null }; },
    },
  }),
}));

vi.mock('@/utils/cloudSave', () => ({
  backupSlot: async (slot: number) => { backupCalls.push(slot); return { ok: true }; },
}));

import { signInWithApple, getAuthInfo, appleSignInAvailable } from '@/utils/cloudAuth';
import { writeSaveSlot, __resetSaveStorageForTests } from '@/store/helpers/persistence';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

beforeEach(() => {
  currentSession = null;
  idTokenCalls.length = 0;
  authorizeCalls.length = 0;
  backupCalls.length = 0;
  __resetSaveStorageForTests();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co');
  vi.stubEnv('VITE_APPLE_CLIENT_ID', 'com.dynastymanager.app');
});

describe('cloudAuth — appleSignInAvailable', () => {
  it('is true on native iOS with backend + client id configured', () => {
    expect(appleSignInAvailable()).toBe(true);
  });

  it('is false without an Apple client id', () => {
    vi.stubEnv('VITE_APPLE_CLIENT_ID', '');
    expect(appleSignInAvailable()).toBe(false);
  });
});

describe('cloudAuth — signInWithApple nonce wiring', () => {
  it('hands Apple the hashed nonce and Supabase the raw nonce', async () => {
    const r = await signInWithApple();
    expect(r.ok).toBe(true);
    expect(idTokenCalls).toHaveLength(1);
    expect(authorizeCalls).toHaveLength(1);

    const rawNonce = idTokenCalls[0].nonce!;
    const appleNonce = authorizeCalls[0].nonce!;
    expect(idTokenCalls[0].provider).toBe('apple');
    expect(idTokenCalls[0].token).toBe('apple-id-token');
    // The nonce Apple saw must be the SHA-256 of the raw nonce given to Supabase.
    expect(appleNonce).toBe(await sha256Hex(rawNonce));
    expect(appleNonce).not.toBe(rawNonce);
  });

  it('migrates existing local saves to the new identity after sign-in', async () => {
    writeSaveSlot(1, JSON.stringify({ playerClubId: 'arsenal' }));
    writeSaveSlot(3, JSON.stringify({ playerClubId: 'spurs' }));
    await signInWithApple();
    expect(backupCalls.sort()).toEqual([1, 3]); // only populated slots
  });
});

describe('cloudAuth — getAuthInfo', () => {
  it('reports apple provider for a non-anonymous session', async () => {
    currentSession = { user: { id: 'x', is_anonymous: false, email: 'a@b.c' } };
    expect(await getAuthInfo()).toEqual({ signedIn: true, provider: 'apple', email: 'a@b.c' });
  });

  it('reports anonymous provider for an anonymous session', async () => {
    currentSession = { user: { id: 'x', is_anonymous: true } };
    expect(await getAuthInfo()).toMatchObject({ signedIn: true, provider: 'anonymous' });
  });

  it('reports signed-out when there is no session', async () => {
    currentSession = null;
    expect(await getAuthInfo()).toEqual({ signedIn: false, provider: null });
  });
});
