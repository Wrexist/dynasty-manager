import * as Sentry from '@sentry/react';
import { readSaveSlot, writeSaveSlot } from '@/store/helpers/persistence';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

// Cloud Save (Online Slice 1) — manual Back up / Restore of a save slot.
//
// Storage layout: one private bucket `saves`, each player gets a folder named
// after their auth uid. Per slot we write two objects:
//   <uid>/slot_<n>       — the full raw save string (authoritative blob)
//   <uid>/slot_<n>.meta  — a tiny JSON summary for the Settings list, so we can
//                          show "Arsenal · S3 W12" without downloading the blob.
//
// Auth is anonymous-first: every install silently gets a uid via
// signInAnonymously, so existing players can back up with zero friction. A
// later Sign in with Apple upgrade (phase 1b) keeps the same uid via Supabase
// identity linking, so their backups carry over.
//
// Sync is deliberately MANUAL. The match engine is non-deterministic and there
// are three slots, so a silent auto-merge would be a footgun; the player
// chooses when to push/pull, and a restore validates the download before it
// overwrites the local slot — a corrupt cloud blob never destroys a good local
// save.

const BUCKET = 'saves';
const slotObject = (uid: string, slot: number) => `${uid}/slot_${slot}`;
const metaObject = (uid: string, slot: number) => `${uid}/slot_${slot}.meta`;

export interface CloudSlotMeta {
  slot: number;
  clubName?: string;
  season?: number;
  week?: number;
  gameMode?: string;
  /** Save schema version at backup time (for forward-compat awareness). */
  schemaVersion?: number;
  sizeBytes: number;
  /** ISO timestamp of the backup. */
  updatedAt: string;
}

export type CloudReason = 'unconfigured' | 'unavailable' | 'empty' | 'not_found' | 'corrupt' | 'error';
export interface CloudResult {
  ok: boolean;
  reason?: CloudReason;
  meta?: CloudSlotMeta;
}

/** Whether the cloud backend is configured on this build. */
export function isCloudConfigured(): boolean {
  return isSupabaseConfigured();
}

type Session = { client: NonNullable<Awaited<ReturnType<typeof getSupabase>>>; userId: string };

/** Resolve the client and ensure an (anonymous) session exists. Idempotent —
 *  reuses an existing session, otherwise signs in anonymously. Returns null
 *  when the backend is unconfigured/unreachable. */
async function ensureSession(): Promise<Session | null> {
  const client = await getSupabase();
  if (!client) return null;
  try {
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) return { client, userId: session.user.id };
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) return null;
    return { client, userId: data.user.id };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'cloudSave.ensureSession' } });
    return null;
  }
}

/** Best-effort summary derived from the raw save string. Parse failures yield a
 *  meta with just the size — the blob itself is what matters for restore. */
function deriveMeta(slot: number, raw: string, updatedAt: string): CloudSlotMeta {
  const meta: CloudSlotMeta = { slot, sizeBytes: raw.length, updatedAt };
  try {
    const d = JSON.parse(raw);
    meta.clubName = d?.clubs?.[d?.playerClubId]?.name;
    if (typeof d?.season === 'number') meta.season = d.season;
    if (typeof d?.week === 'number') meta.week = d.week;
    if (typeof d?.gameMode === 'string') meta.gameMode = d.gameMode;
    if (typeof d?.version === 'number') meta.schemaVersion = d.version;
  } catch { /* meta is best-effort */ }
  return meta;
}

/** Upload the given slot's save to the cloud (upsert), plus its meta sidecar. */
export async function backupSlot(slot: number): Promise<CloudResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'unconfigured' };
  const raw = readSaveSlot(slot);
  if (!raw) return { ok: false, reason: 'empty' };
  const ctx = await ensureSession();
  if (!ctx) return { ok: false, reason: 'unavailable' };
  try {
    const main = await ctx.client.storage
      .from(BUCKET)
      .upload(slotObject(ctx.userId, slot), new Blob([raw], { type: 'application/json' }), {
        upsert: true,
        contentType: 'application/json',
      });
    if (main.error) return { ok: false, reason: 'error' };
    const meta = deriveMeta(slot, raw, new Date().toISOString());
    // Meta is non-critical: a failure here still leaves a restorable blob.
    await ctx.client.storage
      .from(BUCKET)
      .upload(metaObject(ctx.userId, slot), new Blob([JSON.stringify(meta)], { type: 'application/json' }), {
        upsert: true,
        contentType: 'application/json',
      });
    return { ok: true, meta };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'cloudSave.backup' } });
    return { ok: false, reason: 'error' };
  }
}

/** Download the cloud save for a slot and write it into the local slot. The
 *  download is validated first — a corrupt blob is rejected WITHOUT touching
 *  the local save. Does not load the game; the caller decides when to load. */
export async function restoreSlot(slot: number): Promise<CloudResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'unconfigured' };
  const ctx = await ensureSession();
  if (!ctx) return { ok: false, reason: 'unavailable' };
  try {
    const dl = await ctx.client.storage.from(BUCKET).download(slotObject(ctx.userId, slot));
    if (dl.error || !dl.data) return { ok: false, reason: 'not_found' };
    const text = await dl.data.text();
    // Validate before overwriting — never clobber a good local save with a
    // corrupt or truncated download.
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !parsed.playerClubId) {
        return { ok: false, reason: 'corrupt' };
      }
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
    writeSaveSlot(slot, text);
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'cloudSave.restore' } });
    return { ok: false, reason: 'error' };
  }
}

/** Delete every cloud object for the current user (all slots + meta sidecars)
 *  and sign out. The cloud half of account deletion (Apple 5.1.1(v)); the local
 *  half is `deleteAllDynastyData()`. Acts only on an EXISTING session — it never
 *  signs in just to delete, so a player who never used cloud backup is a no-op
 *  (nothing of theirs is in the cloud). Best-effort: a failure must not block
 *  the local wipe at the call site. */
export async function deleteCloudSaves(): Promise<CloudResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'unconfigured' };
  const client = await getSupabase();
  if (!client) return { ok: false, reason: 'unavailable' };
  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return { ok: true }; // never backed up — nothing to delete
    const uid = session.user.id;
    const paths = [1, 2, 3].flatMap(slot => [slotObject(uid, slot), metaObject(uid, slot)]);
    const { error } = await client.storage.from(BUCKET).remove(paths);
    if (error) return { ok: false, reason: 'error' };
    try { await client.auth.signOut(); } catch { /* best-effort */ }
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'cloudSave.delete' } });
    return { ok: false, reason: 'error' };
  }
}

/** List the cloud-backed slots (1..3) via their meta sidecars. Slots without a
 *  backup are simply absent from the result. */
export async function listCloudSlots(): Promise<CloudSlotMeta[]> {
  if (!isSupabaseConfigured()) return [];
  const ctx = await ensureSession();
  if (!ctx) return [];
  const out: CloudSlotMeta[] = [];
  for (const slot of [1, 2, 3]) {
    try {
      const dl = await ctx.client.storage.from(BUCKET).download(metaObject(ctx.userId, slot));
      if (dl.data) out.push({ ...(JSON.parse(await dl.data.text()) as CloudSlotMeta), slot });
    } catch { /* not backed up / unreadable — skip */ }
  }
  return out;
}
