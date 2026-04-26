import type { Position } from '@/types/game';
import type { PlayerTemplate } from '@/data/playerTemplates';
import { NATIONAL_PLAYER_POOL } from '@/data/nationalPlayerPool';

/**
 * FC25/FC26 pool labels often differ from the in-game canonical
 * nationality. Look up both forms when fetching the pool so a Dutch
 * player generated with `nationality: 'Netherlands'` still pulls from
 * the FC25 'Holland' bucket.
 */
const POOL_NATIONALITY_ALIASES: Record<string, string[]> = {
  Netherlands: ['Netherlands', 'Holland'],
  Holland: ['Netherlands', 'Holland'],
  'Ivory Coast': ['Ivory Coast', "Côte d'Ivoire"],
  "Côte d'Ivoire": ['Ivory Coast', "Côte d'Ivoire"],
  'South Korea': ['South Korea', 'Korea Republic'],
  'Korea Republic': ['South Korea', 'Korea Republic'],
  USA: ['USA', 'United States'],
  'United States': ['USA', 'United States'],
  Ireland: ['Ireland', 'Republic of Ireland'],
  'Republic of Ireland': ['Ireland', 'Republic of Ireland'],
  Czechia: ['Czechia', 'Czech Republic'],
  'Czech Republic': ['Czechia', 'Czech Republic'],
};

/**
 * Whether `templateNat` denotes the same real-world nation as
 * `gameNat` under the FC26 ↔ in-game alias map. Used to decide
 * when to canonicalize a real player's nationality (alias case)
 * versus preserving it (the picker fell back to a different nation).
 */
export function isNationalityAliasOf(templateNat: string, gameNat: string): boolean {
  if (templateNat === gameNat) return true;
  const aliases = POOL_NATIONALITY_ALIASES[gameNat];
  return aliases ? aliases.includes(templateNat) : false;
}

// Two-set registry. fcId-backed templates claim by id only — without
// this, two unrelated FC26 entries that happen to share a name (and
// FC26 has many such pairs, e.g. multiple "Vinicius"/"Lucas" players)
// would mutually block each other. Templates with no fcId fall back
// to name-based claiming so legacy CLUB_TEMPLATES entries still
// prevent the picker from re-handing the same person.
const claimedFcIds = new Set<string>();
const claimedNames = new Set<string>();

// Memoised "all nationalities merged" pool for the global-fallback path.
// Cleared on resetRealPlayerClaims so dev tools / tests that mutate
// NATIONAL_PLAYER_POOL between resets see fresh data on next call.
let allPoolsCache: PlayerTemplate[] | null = null;

function nameKey(fn: string, ln: string): string {
  return `${fn.toLowerCase()}|${ln.toLowerCase()}`;
}

export function resetRealPlayerClaims(): void {
  claimedFcIds.clear();
  claimedNames.clear();
  // Drop the merged-pool memo too so any test or dev tool that mutates
  // NATIONAL_PLAYER_POOL between resets sees the fresh data on next call.
  allPoolsCache = null;
}

export function claimRealPlayer(t: { fcId?: string; fn: string; ln: string }): void {
  if (t.fcId) {
    claimedFcIds.add(t.fcId);
    return;
  }
  claimedNames.add(nameKey(t.fn, t.ln));
}

export function claimByName(fn: string, ln: string): void {
  claimedNames.add(nameKey(fn, ln));
}

function isClaimed(t: PlayerTemplate): boolean {
  if (t.fcId && claimedFcIds.has(t.fcId)) return true;
  // Name-based claims block by name even for fcId-backed candidates,
  // so a CLUB_TEMPLATES entry without a stable fcId can still keep
  // "their" person out of other clubs' filler slots.
  return claimedNames.has(nameKey(t.fn, t.ln));
}

const POSITION_FALLBACK: Record<Position, Position[]> = {
  GK: [],
  CB: ['LB', 'RB', 'CDM'],
  LB: ['CB', 'LM'],
  RB: ['CB', 'RM'],
  CDM: ['CM', 'CB'],
  CM: ['CDM', 'CAM'],
  CAM: ['CM', 'LM', 'RM'],
  LM: ['LW', 'CAM', 'LB'],
  RM: ['RW', 'CAM', 'RB'],
  LW: ['LM', 'ST', 'CAM'],
  RW: ['RM', 'ST', 'CAM'],
  ST: ['CAM', 'LW', 'RW'],
};

function dedupKey(t: PlayerTemplate): string {
  return t.fcId ? `id:${t.fcId}` : `n:${nameKey(t.fn, t.ln)}`;
}

function dedupedPool(aliases: string[]): PlayerTemplate[] {
  const merged: PlayerTemplate[] = [];
  const seen = new Set<string>();
  for (const alias of aliases) {
    const pool = NATIONAL_PLAYER_POOL[alias];
    if (!pool) continue;
    for (const t of pool) {
      const k = dedupKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(t);
    }
  }
  return merged;
}

function poolFor(nationality: string): PlayerTemplate[] {
  const aliases = POOL_NATIONALITY_ALIASES[nationality] ?? [nationality];
  return dedupedPool(aliases);
}

function poolForAll(): PlayerTemplate[] {
  if (allPoolsCache) return allPoolsCache;
  allPoolsCache = dedupedPool(Object.keys(NATIONAL_PLAYER_POOL));
  return allPoolsCache;
}

export interface PickRealPlayerOptions {
  /** Inclusive lower OVR bound. Used so weak clubs don't snatch elite players. */
  minOvr?: number;
  /** Inclusive upper OVR bound. */
  maxOvr?: number;
}

function inOvrRange(t: PlayerTemplate, opts?: PickRealPlayerOptions): boolean {
  if (opts?.minOvr !== undefined && t.ovr < opts.minOvr) return false;
  if (opts?.maxOvr !== undefined && t.ovr > opts.maxOvr) return false;
  return true;
}

function pickFromList(list: PlayerTemplate[]): PlayerTemplate | null {
  if (list.length === 0) return null;
  const choice = list[Math.floor(Math.random() * list.length)];
  claimRealPlayer(choice);
  return choice;
}

function tryPickFromPool(
  pool: PlayerTemplate[],
  position: Position,
  options?: PickRealPlayerOptions,
): PlayerTemplate | null {
  if (pool.length === 0) return null;

  const tryPhase = (matches: (t: PlayerTemplate) => boolean): PlayerTemplate | null => {
    const inBand = pool.filter((t) => matches(t) && !isClaimed(t) && inOvrRange(t, options));
    return pickFromList(inBand);
  };

  const strict = tryPhase((t) => t.pos === position);
  if (strict) return strict;

  const alt = tryPhase((t) => Boolean(t.altPos?.includes(position)));
  if (alt) return alt;

  for (const fallbackPos of POSITION_FALLBACK[position] ?? []) {
    const fb = tryPhase((t) => t.pos === fallbackPos || Boolean(t.altPos?.includes(fallbackPos)));
    if (fb) return fb;
  }

  return null;
}

/**
 * Pick a real FC26 player template for the given position that hasn't
 * been claimed yet, biased toward `preferredNationality` for variety
 * but spilling over to any nation when the preferred one has nobody
 * left in the requested OVR window.
 *
 * The OVR window is treated as a hard requirement — we do NOT fall
 * back to "any rating", because that re-introduces the weak-clubs-
 * sign-elite-keepers problem. Callers are expected to fall through to
 * procedural generation when this returns null.
 */
export function pickUnclaimedRealPlayer(
  preferredNationality: string,
  position: Position,
  options?: PickRealPlayerOptions,
): PlayerTemplate | null {
  const preferred = tryPickFromPool(poolFor(preferredNationality), position, options);
  if (preferred) return preferred;
  return tryPickFromPool(poolForAll(), position, options);
}
