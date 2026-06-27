/**
 * cloudSave — backup/restore logic verified against a mocked Supabase client.
 * (No live backend in CI; provisioning + true end-to-end is documented in
 * docs/cloud-save-setup.md.) Asserts the storage paths, the empty-slot guard,
 * the corrupt-download guard that must NOT clobber a good local save, and the
 * round-trip into the local slot.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock the env-gated client so the util thinks the backend is configured. ──
const uploads: { path: string; body: string }[] = [];
const removed: string[] = [];
const invokes: string[] = [];
const store = new Map<string, string>();
let signInCalls = 0;
let currentSession: { user: { id: string } } | null = null;

vi.mock('@/utils/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: async () => ({
    auth: {
      getSession: async () => ({ data: { session: currentSession } }),
      signInAnonymously: async () => {
        signInCalls++;
        currentSession = { user: { id: 'user-123' } };
        return { data: { user: currentSession.user }, error: null };
      },
      signOut: async () => { currentSession = null; return { error: null }; },
    },
    functions: {
      invoke: async (name: string) => {
        invokes.push(name);
        return { data: { ok: true }, error: null };
      },
    },
    storage: {
      from: () => ({
        upload: async (path: string, body: Blob) => {
          uploads.push({ path, body: await body.text() });
          store.set(path, await body.text());
          return { error: null };
        },
        download: async (path: string) => {
          const v = store.get(path);
          if (v == null) return { data: null, error: { message: 'not found' } };
          return { data: { text: async () => v }, error: null };
        },
        remove: async (paths: string[]) => {
          for (const p of paths) { removed.push(p); store.delete(p); }
          return { data: paths, error: null };
        },
      }),
    },
  }),
}));

import { backupSlot, restoreSlot, deleteCloudSaves, deleteAccount, isCloudConfigured } from '@/utils/cloudSave';
import { readSaveSlot, writeSaveSlot, __resetSaveStorageForTests } from '@/store/helpers/persistence';

const SAVE = JSON.stringify({ playerClubId: 'arsenal', season: 3, week: 12, gameMode: 'sandbox', version: 71, clubs: { arsenal: { name: 'Arsenal' } } });

beforeEach(() => {
  uploads.length = 0;
  removed.length = 0;
  invokes.length = 0;
  store.clear();
  signInCalls = 0;
  currentSession = null;
  __resetSaveStorageForTests();
});

describe('cloudSave', () => {
  it('reports configured when the backend is mocked present', () => {
    expect(isCloudConfigured()).toBe(true);
  });

  it('backs up a slot to <uid>/slot_<n> with a meta sidecar', async () => {
    writeSaveSlot(2, SAVE);
    const r = await backupSlot(2);
    expect(r.ok).toBe(true);
    expect(uploads.map(u => u.path)).toEqual(['user-123/slot_2', 'user-123/slot_2.meta']);
    expect(uploads[0].body).toBe(SAVE);
    // Meta is derived from the save for the Settings list.
    expect(r.meta).toMatchObject({ slot: 2, clubName: 'Arsenal', season: 3, week: 12, gameMode: 'sandbox', schemaVersion: 71 });
  });

  it('refuses to back up an empty slot', async () => {
    const r = await backupSlot(1);
    expect(r).toEqual({ ok: false, reason: 'empty' });
    expect(uploads).toHaveLength(0);
  });

  it('round-trips: restore overwrites the local slot with the cloud blob', async () => {
    writeSaveSlot(1, SAVE);
    await backupSlot(1);
    // Local slot diverges (as it would on a different device / older save).
    writeSaveSlot(1, JSON.stringify({ playerClubId: 'spurs', season: 1, week: 1 }));

    const r = await restoreSlot(1);
    expect(r.ok).toBe(true);
    expect(readSaveSlot(1)).toBe(SAVE);
  });

  it('reports not_found when restoring a slot with no cloud backup', async () => {
    const r = await restoreSlot(3);
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects a corrupt download WITHOUT clobbering the good local save', async () => {
    writeSaveSlot(1, SAVE);
    // Poison the cloud blob for this slot (valid JSON, but not a save).
    store.set('user-123/slot_1', '{"not":"a save"}');
    const r = await restoreSlot(1);
    expect(r).toEqual({ ok: false, reason: 'corrupt' });
    expect(readSaveSlot(1)).toBe(SAVE); // local save untouched
  });

  it('bootstraps an anonymous session on first use', async () => {
    writeSaveSlot(1, SAVE);
    await backupSlot(1);
    expect(signInCalls).toBe(1);
  });

  it('deleteCloudSaves removes every slot + meta object for the current user', async () => {
    writeSaveSlot(1, SAVE);
    await backupSlot(1); // creates a session and uploads slot_1 + .meta
    expect(store.has('user-123/slot_1')).toBe(true);

    const r = await deleteCloudSaves();
    expect(r.ok).toBe(true);
    // All 6 candidate paths (3 slots × {blob, meta}) are removed.
    expect(removed).toEqual([
      'user-123/slot_1', 'user-123/slot_1.meta',
      'user-123/slot_2', 'user-123/slot_2.meta',
      'user-123/slot_3', 'user-123/slot_3.meta',
    ]);
    expect(store.has('user-123/slot_1')).toBe(false);
  });

  it('deleteCloudSaves is a no-op (and never signs in) when there is no session', async () => {
    const r = await deleteCloudSaves();
    expect(r.ok).toBe(true);
    expect(signInCalls).toBe(0); // must not mint a throwaway user just to delete
    expect(removed).toHaveLength(0);
  });

  it('deleteAccount invokes the delete-account function and signs out', async () => {
    writeSaveSlot(1, SAVE);
    await backupSlot(1); // establishes a session
    const r = await deleteAccount();
    expect(r.ok).toBe(true);
    expect(invokes).toEqual(['delete-account']);
    expect(currentSession).toBeNull(); // signed out afterwards
  });

  it('deleteAccount is a no-op (no function call) when there is no session', async () => {
    const r = await deleteAccount();
    expect(r.ok).toBe(true);
    expect(invokes).toHaveLength(0);
    expect(signInCalls).toBe(0);
  });
});
