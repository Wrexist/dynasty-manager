/**
 * UI Helper Functions
 * Centralized color/rating logic used across pages and components.
 */

import { PlayerAttributes, Position } from '@/types/game';
import { FAN_CONFIDENCE_FAN_WEIGHT, FAN_CONFIDENCE_BOARD_WEIGHT } from '@/config/gameBalance';
import {
  RATING_COLOR_THRESHOLDS,
  STAT_BAR_THRESHOLDS,
  CONFIDENCE_COLOR_THRESHOLDS,
  FAN_CONFIDENCE_THRESHOLDS,
  FITNESS_COLOR_THRESHOLDS,
  FITNESS_HEX_THRESHOLDS,
  MATCH_RATING_THRESHOLDS,
  MOOD_COLOR_THRESHOLDS,
  POTENTIAL_COLOR_THRESHOLDS,
  PLAYER_TIER_THRESHOLDS,
  type PlayerTier,
} from '@/config/ui';

/** Get top 3 highest attributes from a player's attribute set */
export function getTop3Attributes(attrs: PlayerAttributes): { label: string; value: number }[] {
  const entries = [
    { label: 'PAC', value: attrs.pace },
    { label: 'SHO', value: attrs.shooting },
    { label: 'PAS', value: attrs.passing },
    { label: 'DEF', value: attrs.defending },
    { label: 'PHY', value: attrs.physical },
    { label: 'MEN', value: attrs.mental },
  ];
  return entries.sort((a, b) => b.value - a.value).slice(0, 3);
}

/** Get text color class for an overall/attribute value (80=emerald, 70=primary, 60=amber) */
export function getRatingColor(value: number): string {
  for (const t of RATING_COLOR_THRESHOLDS) {
    if (value >= t.min) return t.textClass;
  }
  return 'text-muted-foreground';
}

/** Get a hex color matching the player-rating tier (for inline style borders/strokes). */
export function getRatingHex(value: number | undefined): string {
  if (value == null) return '#6b7280';
  if (value >= 80) return '#34d399';
  if (value >= 70) return '#38bdf8';
  if (value >= 60) return '#fbbf24';
  return '#6b7280';
}

/** Resolve the player tier (Legendary/Gold/Silver/Bronze/Common) for an overall rating. */
export function getPlayerTier(overall: number | null | undefined): PlayerTier {
  if (overall == null || !Number.isFinite(overall) || overall < 0) {
    return PLAYER_TIER_THRESHOLDS[PLAYER_TIER_THRESHOLDS.length - 1];
  }
  for (const t of PLAYER_TIER_THRESHOLDS) {
    if (overall >= t.min) return t;
  }
  return PLAYER_TIER_THRESHOLDS[PLAYER_TIER_THRESHOLDS.length - 1];
}

/**
 * Tier-themed shield artwork for the player-card background layer. Seven
 * bands over six PNGs so Gold and Legendary each split into "standard" and
 * "premium" artwork, keeping top-end pulls visually distinct from 80-rated
 * cards. Common tier reuses the Bronze shield under a desaturate filter so we
 * don't need a seventh asset.
 */
export interface PlayerCardArt {
  src: string;
  filter?: string;
}

export function getPlayerCardArt(overall: number | null | undefined): PlayerCardArt {
  if (overall == null || !Number.isFinite(overall)) {
    return { src: '/player-cards/bronze.webp', filter: 'grayscale(1) brightness(0.55)' };
  }
  if (overall >= 90) return { src: '/player-cards/icon.webp' };
  if (overall >= 85) return { src: '/player-cards/premium.webp' };
  if (overall >= 80) return { src: '/player-cards/gold.webp' };
  if (overall >= 70) return { src: '/player-cards/silver.webp' };
  if (overall >= 60) return { src: '/player-cards/bronze.webp' };
  return { src: '/player-cards/bronze.webp', filter: 'grayscale(1) brightness(0.55)' };
}

/**
 * Build a 3-stop 135deg linear-gradient CSS string from a tier palette.
 * Shared primitive for both {@link getTierBorderStyle} (50% mid-stop for a
 * balanced border) and the pack surfaces (`packHelpers.tierGradient`,
 * 45% mid-stop for a slightly punchier face). Using one helper keeps the
 * tier colour definitions authoritative in {@link PLAYER_TIER_THRESHOLDS}.
 */
export function buildTierGradient(tier: PlayerTier, midStopPercent = 50): string {
  return `linear-gradient(135deg, ${tier.gradientFrom} 0%, ${tier.gradientVia} ${midStopPercent}%, ${tier.gradientTo} 100%)`;
}

/** Inline-style gradient stroke for a tier border wrapper (clean, non-blurred). */
export function getTierBorderStyle(tier: PlayerTier): { background: string } {
  return { background: buildTierGradient(tier, 50) };
}

/**
 * Subtle outer glow for premium tiers (Gold, Legendary). Returns a boxShadow
 * style fragment, or `undefined` for lower tiers. Keeps the halo tight so
 * it reads as polish, not neon.
 */
export function getTierGlowStyle(tier: PlayerTier): { boxShadow: string } | undefined {
  if (tier.key === 'legendary') {
    return { boxShadow: `0 0 7px ${tier.gradientVia}66, 0 0 2px ${tier.gradientVia}` };
  }
  if (tier.key === 'gold') {
    return { boxShadow: `0 0 6px ${tier.gradientVia}4D` };
  }
  return undefined;
}

/**
 * @deprecated Use getPlayerTier + the gradient-border wrapper pattern instead.
 * Retained as a no-op so older callers don't crash; returns empty class string.
 */
export function getTierGlowClass(_overall: number): string {
  return '';
}

/** Deterministic 1–99 jersey number derived from a player id (stable across renders). */
export function getStableJerseyNumber(playerId: string): number {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 99) + 1;
}

/** Get background color class for a stat bar percentage */
export function getStatBarColor(pct: number): string {
  for (const t of STAT_BAR_THRESHOLDS) {
    if (pct >= t.min) return t.bgClass;
  }
  return 'bg-destructive';
}

/** Get text + bg color classes for board confidence value */
export function getConfidenceColor(value: number): { textClass: string; bgClass: string } {
  for (const t of CONFIDENCE_COLOR_THRESHOLDS) {
    if (value >= t.min) return { textClass: t.textClass, bgClass: t.bgClass };
  }
  return { textClass: 'text-destructive', bgClass: 'bg-destructive' };
}

/** Get text color class for fan confidence (uses higher thresholds than board confidence) */
export function getFanConfidenceColor(value: number): string {
  for (const t of FAN_CONFIDENCE_THRESHOLDS) {
    if (value >= t.min) return t.textClass;
  }
  return 'text-destructive';
}

/** Get background color class for fitness/morale bars */
export function getFitnessColor(value: number): string {
  for (const t of FITNESS_COLOR_THRESHOLDS) {
    if (value >= t.min) return t.bgClass;
  }
  return 'bg-destructive';
}

/** Get hex color string for fitness (SVG rendering on pitch views) */
export function getFitnessHexColor(fitness: number): string {
  const threshold = FITNESS_HEX_THRESHOLDS.find(t => fitness >= t.min);
  return threshold?.color || FITNESS_HEX_THRESHOLDS[FITNESS_HEX_THRESHOLDS.length - 1].color;
}

/** Get text color class for match rating (8+=emerald, 6+=primary, else amber) */
export function getMatchRatingColor(rating: number): string {
  for (const t of MATCH_RATING_THRESHOLDS) {
    if (rating >= t.min) return t.textClass;
  }
  return 'text-amber-400';
}

/** Get bg + text classes for a position badge (GK=amber, DEF=sky, MID=emerald, ATT=rose) */
export function posBadgeColor(pos: Position): string {
  const base =
    'bg-gradient-to-b ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.2)]';
  if (pos === 'GK') return `${base} from-amber-400/30 to-amber-600/15 text-amber-200 ring-amber-400/35`;
  if (['CB', 'LB', 'RB'].includes(pos)) return `${base} from-sky-400/30 to-sky-600/15 text-sky-200 ring-sky-400/35`;
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return `${base} from-emerald-400/30 to-emerald-600/15 text-emerald-200 ring-emerald-400/35`;
  return `${base} from-rose-400/30 to-rose-600/15 text-rose-200 ring-rose-400/35`;
}

/** Get combined bg + text classes for a rating badge (e.g. 'bg-emerald-500/20 text-emerald-400') */
export function getRatingBadgeClasses(value: number): string {
  for (const t of RATING_COLOR_THRESHOLDS) {
    if (value >= t.min) return `${t.bgClass}/20 ${t.textClass}`;
  }
  return 'bg-muted/50 text-muted-foreground';
}

/** Get risk level string for board confidence */
export function getConfidenceRisk(value: number): 'safe' | 'warning' | 'danger' {
  if (value >= 60) return 'safe';
  if (value >= 30) return 'warning';
  return 'danger';
}

/** Get text color class for player mood */
export function getMoodColor(mood: number): string {
  for (const t of MOOD_COLOR_THRESHOLDS) {
    if (mood >= t.min) return t.textClass;
  }
  return 'text-destructive';
}

/** Get mood label ('Positive', 'Cautious', 'Frustrated') */
export function getMoodLabel(mood: number): string {
  for (const t of MOOD_COLOR_THRESHOLDS) {
    if (mood >= t.min) return t.label;
  }
  return 'Frustrated';
}

/** Get potential badge classes + label for scouting/youth */
export function getPotentialInfo(value: number): { bgClass: string; fillClass: string; textClass: string; label: string } {
  for (const t of POTENTIAL_COLOR_THRESHOLDS) {
    if (value >= t.min) return { bgClass: t.bgClass, fillClass: t.fillClass, textClass: t.textClass, label: t.label };
  }
  return { bgClass: 'bg-muted/50 text-muted-foreground', fillClass: 'text-muted-foreground', textClass: 'text-muted-foreground', label: 'Average' };
}

/** Calculate fan confidence from fanBase and boardConfidence using config weights */
export function getFanConfidence(fanBase: number, boardConfidence: number): number {
  return Math.min(100, Math.round(fanBase * FAN_CONFIDENCE_FAN_WEIGHT + boardConfidence * FAN_CONFIDENCE_BOARD_WEIGHT));
}

// ── Negotiation Chance Helpers ──

export function getChanceColor(chance: number): string {
  if (chance >= 0.7) return 'text-emerald-400';
  if (chance >= 0.35) return 'text-amber-400';
  return 'text-red-400';
}

export function getChanceBarColor(chance: number): string {
  if (chance >= 0.7) return 'bg-emerald-500';
  if (chance >= 0.35) return 'bg-amber-500';
  return 'bg-red-500';
}

export function getChanceLabel(chance: number): string {
  if (chance >= 0.7) return 'Very Likely';
  if (chance >= 0.35) return 'Possible';
  if (chance >= 0.08) return 'Unlikely';
  return 'Very Unlikely';
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function areColorsSimilar(c1: string, c2: string, threshold = 80): boolean {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) < threshold;
}

// ── Club Display Names ──

const CLUB_PREFIX_RE = /^(?:1\.\s*)?(?:FC|SC|AC|AS|SL|SK|NK|BSC|TSG|VfB|VfL|SV|SSC|US|RC|CF|CD|SD|RCD|CA|AEK|OGC|SM|Bayer|Borussia|Sporting|Stade)\s+/i;
const CLUB_SUFFIX_RE = /\s+(?:FC|SC|CF|SK|FK|BK|IF|FF|SK|United|City)$/i;

/** Special-case overrides for clubs whose auto-derived name is awkward */
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  'BSC Young Boys': 'Young B.',
  'Grasshopper Club Zürich': 'Grasshop',
  'Bayer 04 Leverkusen': 'Leverku',
  'Borussia Dortmund': 'Dortmund',
  'Borussia Mönchengladbach': 'Gladbac',
  'RB Leipzig': 'Leipzig',
  'Paris Saint-Germain': 'PSG',
  'Olympique de Marseille': 'Marseil',
  'Olympique Lyonnais': 'Lyon',
  'AS Saint-Étienne': 'St-Étien',
  'Stade Rennais': 'Rennes',
  'West Ham United': 'West Ham',
  'Aston Villa': 'A. Villa',
  'Manchester United': 'Man Utd',
  'Manchester City': 'Man City',
  'Tottenham Hotspur': 'Tottenha',
  'Crystal Palace': 'C.Palace',
  'Nottingham Forest': 'Nott For',
  'Sheffield United': 'Sheff U',
  'Newcastle United': 'Newcastl',
  'Wolverhampton Wanderers': 'Wolves',
  'Brighton & Hove Albion': 'Brighton',
  'Leicester City': 'Leiceste',
  'AFC Bournemouth': 'Bournemo',
  'Real Sociedad': 'R.Socied',
  'Atlético Madrid': 'Atlético',
  'Athletic Club': 'Athletic',
  'Rayo Vallecano': 'Rayo',
  'Celta de Vigo': 'Celta',
  'Deportivo Alavés': 'Alavés',
  'Inter Milan': 'Inter',
  'AC Milan': 'Milan',
  'SSC Napoli': 'Napoli',
  'Hellas Verona': 'Verona',
  'Red Bull Salzburg': 'Salzburg',
  'Rapid Wien': 'Rapid',
  'Sturm Graz': 'Sturm',
  'Austria Wien': 'Austria',
  'FC Lausanne-Sport': 'Lausanne',
  'Sporting CP': 'Sporting',
  'Sporting Braga': 'Braga',
  'Vitória SC': 'Vitória',
  'Stade Brestois 29': 'Brest',
  'Angers SCO': 'Angers',
  'Le Havre AC': 'Le Havre',
  'Ipswich Town': 'Ipswich',
  'Queens Park Rangers': 'QPR',
  'Heart of Midlothian': 'Hearts',
  'Ross County': 'Ross Co.',
  'Dundee United': 'Dundee U',
};

/**
 * Derive a short, recognizable display name (max `maxLen` chars) from a club's
 * full name. Strips common prefixes/suffixes and picks the most recognizable word.
 */
export function getClubDisplayName(fullName: string, maxLen = 7): string {
  if (!fullName || fullName === '?') return '?';

  // Check overrides first
  const override = DISPLAY_NAME_OVERRIDES[fullName];
  if (override) return override;

  // Strip prefixes and suffixes
  let name = fullName.replace(CLUB_PREFIX_RE, '').replace(CLUB_SUFFIX_RE, '').trim();
  if (!name) name = fullName; // Fallback if stripping removed everything

  if (name.length <= maxLen) return name;

  // Multi-word: pick the longest word that fits
  const words = name.split(/[\s-]+/);
  if (words.length > 1) {
    const best = words
      .filter(w => w.length <= maxLen)
      .sort((a, b) => b.length - a.length)[0];
    if (best) return best;
  }

  // Single long word: truncate
  return name.slice(0, maxLen);
}
