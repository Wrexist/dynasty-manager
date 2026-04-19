/**
 * Central typed registry for branded game assets.
 *
 * Pattern: every asset id maps to an { url?, fallback, alt, aspect } entry.
 * `url` is OPTIONAL — if undefined, or if the image errors at load, the
 * consuming `<AssetImage>` renders the `fallback` Lucide component instead.
 * This means the scaffolding can ship BEFORE the art does; once a designer
 * drops a file into `src/assets/.../X.svg` we just flip its `url` here.
 *
 * To activate an asset:
 *   1. Drop the file under `src/assets/{category}/{id}.{svg,png,webp}`.
 *   2. Import it at the top of this file:
 *        `import championsCupUrl from './trophies/champions-cup.svg';`
 *   3. Set the corresponding entry's `url` to that import.
 * That's it — `AssetImage` handles responsive sizing + fade-in + error
 * fallback uniformly for every consumer.
 */

import { Trophy, Award, Shield, User, Shirt, Glasses, UserCircle, Briefcase, Sparkles, Globe, Eye, Flame, GraduationCap, Compass, Users, Goal, ShoppingBag, Mail, Wrench, HeartHandshake } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface AssetEntry {
  id: string;
  url?: string;
  fallback: LucideIcon;
  alt: string;
  /** width:height ratio — used to reserve space and prevent CLS. Default 1:1. */
  aspect?: [number, number];
}

// ── Trophies / competitions ──────────────────────────────────────────────────

export type CupAssetId =
  | 'dynasty-cup'
  | 'league-cup'
  | 'champions-cup'
  | 'shield-cup'
  | 'conference-cup'
  | 'domestic-super-cup'
  | 'continental-super-cup'
  | 'league-championship';

export const TROPHIES: Record<CupAssetId, AssetEntry> = {
  'champions-cup':       { id: 'champions-cup',       fallback: Trophy, alt: 'Champions Cup trophy',          aspect: [100, 140] },
  'shield-cup':          { id: 'shield-cup',          fallback: Trophy, alt: 'Shield Cup trophy',             aspect: [100, 140] },
  'conference-cup':      { id: 'conference-cup',      fallback: Trophy, alt: 'Conference Cup trophy',         aspect: [100, 140] },
  'league-cup':          { id: 'league-cup',          fallback: Trophy, alt: 'League Cup trophy',             aspect: [100, 140] },
  'dynasty-cup':         { id: 'dynasty-cup',         fallback: Trophy, alt: 'Dynasty Cup trophy',            aspect: [100, 140] },
  'domestic-super-cup':  { id: 'domestic-super-cup',  fallback: Trophy, alt: 'Domestic Super Cup trophy',     aspect: [100, 140] },
  'continental-super-cup': { id: 'continental-super-cup', fallback: Trophy, alt: 'Continental Super Cup trophy', aspect: [100, 140] },
  'league-championship': { id: 'league-championship', fallback: Award,  alt: 'League Championship trophy',    aspect: [100, 140] },
};

/** Map the app's human-readable competition names → trophy asset ids. */
export function getCupAssetId(competitionName: string | undefined): CupAssetId | null {
  const base = competitionName?.split(' — ')[0];
  switch (base) {
    case 'Dynasty Cup':             return 'dynasty-cup';
    case 'League Cup':              return 'league-cup';
    case 'Champions Cup':           return 'champions-cup';
    case 'Shield Cup':              return 'shield-cup';
    case 'Conference Cup':          return 'conference-cup';
    case 'Super Cup':               return 'domestic-super-cup';
    case 'Continental Super Cup':   return 'continental-super-cup';
    default:                        return null;
  }
}

// ── Division crests ──────────────────────────────────────────────────────────

/** Division asset ids. Keyed by tier (1–4) rather than LeagueId so the
 *  mapping works for any country's pyramid. */
export type DivisionAssetId = 'div-1' | 'div-2' | 'div-3' | 'div-4' | 'placeholder';

export const DIVISIONS: Record<DivisionAssetId, AssetEntry> = {
  'div-1':       { id: 'div-1',       fallback: Shield, alt: 'Tier 1 division crest', aspect: [1, 1] },
  'div-2':       { id: 'div-2',       fallback: Shield, alt: 'Tier 2 division crest', aspect: [1, 1] },
  'div-3':       { id: 'div-3',       fallback: Shield, alt: 'Tier 3 division crest', aspect: [1, 1] },
  'div-4':       { id: 'div-4',       fallback: Shield, alt: 'Tier 4 division crest', aspect: [1, 1] },
  'placeholder': { id: 'placeholder', fallback: Shield, alt: 'Club crest',            aspect: [1, 1] },
};

/** Map a division tier (1–4) to its asset id. */
export function getDivisionAssetId(tier: number | undefined): DivisionAssetId {
  if (tier === 1) return 'div-1';
  if (tier === 2) return 'div-2';
  if (tier === 3) return 'div-3';
  if (tier === 4) return 'div-4';
  return 'placeholder';
}

// ── Manager avatars (cosmetic IDs match the existing monetization catalogue) ─

export type AvatarAssetId =
  | 'avatar-classic'
  | 'avatar-tracksuit'
  | 'avatar-tactical'
  | 'avatar-veteran'
  | 'avatar-modern'
  | 'avatar-youth'
  | 'avatar-continental'
  | 'avatar-stoic'
  | 'avatar-fiery'
  | 'avatar-professor'
  | 'avatar-pioneer'
  | 'avatar-legend';

export const AVATARS: Record<AvatarAssetId, AssetEntry> = {
  'avatar-classic':     { id: 'avatar-classic',     fallback: User,           alt: 'Classic manager avatar',      aspect: [1, 1] },
  'avatar-tracksuit':   { id: 'avatar-tracksuit',   fallback: Shirt,          alt: 'Tracksuit manager avatar',    aspect: [1, 1] },
  'avatar-tactical':    { id: 'avatar-tactical',    fallback: Glasses,        alt: 'Tactical manager avatar',     aspect: [1, 1] },
  'avatar-veteran':     { id: 'avatar-veteran',     fallback: UserCircle,     alt: 'Veteran manager avatar',      aspect: [1, 1] },
  'avatar-modern':      { id: 'avatar-modern',      fallback: Briefcase,      alt: 'Modern manager avatar',       aspect: [1, 1] },
  'avatar-youth':       { id: 'avatar-youth',       fallback: Sparkles,       alt: 'Young manager avatar',        aspect: [1, 1] },
  'avatar-continental': { id: 'avatar-continental', fallback: Globe,          alt: 'Continental manager avatar',  aspect: [1, 1] },
  'avatar-stoic':       { id: 'avatar-stoic',       fallback: Eye,            alt: 'Stoic manager avatar',        aspect: [1, 1] },
  'avatar-fiery':       { id: 'avatar-fiery',       fallback: Flame,          alt: 'Fiery manager avatar',        aspect: [1, 1] },
  'avatar-professor':   { id: 'avatar-professor',   fallback: GraduationCap,  alt: 'Professor manager avatar',    aspect: [1, 1] },
  'avatar-pioneer':     { id: 'avatar-pioneer',     fallback: Compass,        alt: 'Pioneer manager avatar',      aspect: [1, 1] },
  'avatar-legend':      { id: 'avatar-legend',      fallback: Award,          alt: 'Legend manager avatar',       aspect: [1, 1] },
};

// ── Empty-state illustrations ────────────────────────────────────────────────

export type EmptyStateAssetId = 'transfers' | 'scouting' | 'youth' | 'inbox' | 'staff';

export const EMPTY_STATES: Record<EmptyStateAssetId, AssetEntry> = {
  'transfers': { id: 'transfers', fallback: ShoppingBag,    alt: 'Transfer market illustration', aspect: [240, 180] },
  'scouting':  { id: 'scouting',  fallback: Compass,        alt: 'Scouting illustration',        aspect: [240, 180] },
  'youth':     { id: 'youth',     fallback: Sparkles,       alt: 'Youth academy illustration',   aspect: [240, 180] },
  'inbox':     { id: 'inbox',     fallback: Mail,           alt: 'Inbox illustration',           aspect: [240, 180] },
  'staff':     { id: 'staff',     fallback: HeartHandshake, alt: 'Staff illustration',           aspect: [240, 180] },
};

// ── Misc branded surfaces ────────────────────────────────────────────────────

export const HERO: AssetEntry = {
  id: 'title-bg',
  fallback: Goal,             // never rendered — the TitleScreen handles the no-url case directly
  alt: 'Dynasty Manager title background',
  aspect: [3, 2],
};

export const WORDMARK: AssetEntry = {
  id: 'wordmark',
  fallback: Users,            // unused — title screen draws the text lockup when no image
  alt: 'Dynasty Manager',
  aspect: [1200, 400],
};

// ── Position archetypes (for tactics / squad filters) ────────────────────────

export type PositionAssetId = 'gk' | 'def' | 'mid' | 'fwd';

export const POSITIONS: Record<PositionAssetId, AssetEntry> = {
  'gk':  { id: 'gk',  fallback: Shield,   alt: 'Goalkeeper',  aspect: [1, 1] },
  'def': { id: 'def', fallback: Shield,   alt: 'Defender',    aspect: [1, 1] },
  'mid': { id: 'mid', fallback: Compass,  alt: 'Midfielder',  aspect: [1, 1] },
  'fwd': { id: 'fwd', fallback: Goal,     alt: 'Forward',     aspect: [1, 1] },
};

// ── Wrench: placeholder so importing module doesn't warn about unused symbol
//    in test + future consumers (removed when feature assets land).
void Wrench;
