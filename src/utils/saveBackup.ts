// Zero-backend save backup: export/import the active slot's persisted JSON.
//
// The highest-LTV player (ten seasons deep) loses everything on a lost phone
// or an iOS IndexedDB eviction. Until cloud save lands (the larger arc), this
// gives them a manual safety net: dump the exact save bytes to a file they
// control, and restore them into a slot on a new device.
//
// No new native plugins are added (Filesystem/Share are NOT installed and we
// can't add deps), so export uses the web-standard paths that work inside
// WKWebView, in reliability order per platform:
//   1. Web Share API with a File — routes to the iOS share sheet ("Save to
//      Files"/AirDrop/Messages). Best on native.
//   2. Blob + anchor download — reliable on desktop/mobile web browsers.
//   3. Clipboard copy — last-ditch fallback; the user pastes the JSON into
//      Notes or a text file.
import { Capacitor } from '@capacitor/core';
import { readSaveSlot, writeSaveSlot } from '@/store/helpers/persistence';
import { migrateSaveData, validateSaveShape, isSaveFromNewerVersion } from '@/utils/saveMigration';

export type ExportMethod = 'share' | 'download' | 'clipboard';

/** Flat optional shape (matching the codebase's result-object convention, e.g.
 *  `redeemCode`) rather than a discriminated union — the project runs
 *  `strictNullChecks: false`, which does not narrow `{ok:true}|{ok:false}`
 *  reliably. `method` is set when `ok`; `error` when not. */
export interface ExportResult {
  ok: boolean;
  method?: ExportMethod;
  error?: 'no-save' | 'cancelled' | 'unsupported';
}

/** `dynasty-save-slot1-2026-07-10.json` — slot + local calendar day so a
 *  player can keep dated backups and tell them apart. */
export function buildBackupFilename(slot: number, date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `dynasty-save-slot${slot}-${y}-${m}-${d}.json`;
}

async function tryShare(raw: string, filename: string): Promise<ExportResult | null> {
  try {
    if (typeof navigator === 'undefined' || typeof File === 'undefined') return null;
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return null;
    const file = new File([raw], filename, { type: 'application/json' });
    if (!navigator.canShare({ files: [file] })) return null;
    await navigator.share({ files: [file], title: 'Dynasty Manager Backup' });
    return { ok: true, method: 'share' };
  } catch (err) {
    // User dismissed the share sheet — a deliberate cancel, not a failure to
    // fall through from. Anything else: fall through to the next method.
    if (err instanceof DOMException && err.name === 'AbortError') return { ok: false, error: 'cancelled' };
    if (err instanceof Error && err.name === 'AbortError') return { ok: false, error: 'cancelled' };
    return null;
  }
}

function tryDownload(raw: string, filename: string): ExportResult | null {
  try {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke after the click has had a chance to start the download.
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* noop */ } }, 1000);
    return { ok: true, method: 'download' };
  } catch {
    return null;
  }
}

async function tryClipboard(raw: string): Promise<ExportResult | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return null;
    await navigator.clipboard.writeText(raw);
    return { ok: true, method: 'clipboard' };
  } catch {
    return null;
  }
}

/** Export the active slot's raw persisted JSON. Degrades gracefully across
 *  share → download → clipboard, ordered by what's most reliable on the
 *  current platform. Never throws. */
export async function exportSlotJson(slot: number): Promise<ExportResult> {
  const raw = readSaveSlot(slot);
  if (!raw) return { ok: false, error: 'no-save' };
  const filename = buildBackupFilename(slot);

  // Native (WKWebView): the share sheet is the only path that reaches the
  // Files app / AirDrop. Web: an anchor download is the most predictable.
  const shareFirst = Capacitor.isNativePlatform();

  const share = () => tryShare(raw, filename);
  const download = async () => tryDownload(raw, filename);
  const clipboard = () => tryClipboard(raw);

  const order = shareFirst ? [share, download, clipboard] : [download, share, clipboard];
  for (const attempt of order) {
    const res = await attempt();
    if (res) return res; // includes the explicit 'cancelled' from the share sheet
  }
  return { ok: false, error: 'unsupported' };
}

export type ImportError = 'parse' | 'future' | 'migrate' | 'invalid';

/** Flat optional shape (see `ExportResult` note). `slot` is set when `ok`;
 *  `error` + `message` when not. */
export interface ImportResult {
  ok: boolean;
  slot?: number;
  error?: ImportError;
  message?: string;
}

/** Validate an imported JSON string and, if sound, write it to `slot`. Runs
 *  the SAME guards as the normal load path (future-version guard →
 *  migrateSaveData → validateSaveShape) BEFORE touching storage, so a corrupt
 *  or wrong file can never overwrite the target slot. On success the caller
 *  should reload the slot via the normal `loadGame(slot)` path. Never throws. */
export function importJsonToSlot(slot: number, text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'parse', message: "This file isn't a Dynasty Manager save." };
  }

  if (isSaveFromNewerVersion(parsed)) {
    return {
      ok: false,
      error: 'future',
      message: 'This backup was made by a newer version of Dynasty Manager. Update the app, then import again.',
    };
  }

  let migrated: Record<string, unknown>;
  try {
    migrated = migrateSaveData(parsed as Record<string, unknown>);
  } catch {
    return { ok: false, error: 'migrate', message: 'This save could not be upgraded to the current version.' };
  }
  if ((migrated as { migrationError?: boolean }).migrationError) {
    return { ok: false, error: 'migrate', message: 'This save could not be upgraded to the current version.' };
  }

  if (!validateSaveShape(migrated).ok) {
    return { ok: false, error: 'invalid', message: "This file isn't a valid Dynasty Manager save." };
  }

  // Persist the migrated payload (stamped at CURRENT_VERSION) so the slot is
  // immediately current. Gate the backup rotation on the outgoing main's
  // validity, matching the autosave path.
  writeSaveSlot(slot, JSON.stringify(migrated), {
    validateOutgoing: (raw) => {
      try { return validateSaveShape(JSON.parse(raw)).ok === true; }
      catch { return false; }
    },
  });
  return { ok: true, slot };
}
