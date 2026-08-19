/**
 * Sunday League — what a club and a player LOOK like.
 *
 * Pure, and deliberately so: no store, no `t()`, no React. Every function here
 * turns data the save already holds into a small description a renderer can
 * draw, and returns the same description for the same input forever. The
 * screens stay logic-free and the specs stay testable without a DOM.
 *
 * WHY THE SEED IS THE CLUB ID AND NOT THE SEASON'S RNG. Club identity in this
 * mode is deliberately season-independent — `generateSundayDivision` splits the
 * "who the club is" stream from the "who is in it" stream precisely so a rival
 * keeps its name and colours across a rollover while its squad re-forms (see
 * the comment block at generation.ts around the two `subSeed` calls). A crest
 * drawn from a running cursor would change shape every time the state was
 * re-derived, which is the one thing a badge must never do. `subSeed(0, id)` is
 * a pure hash of a string that is itself stable for the life of the save.
 *
 * NOTHING HERE IS PERSISTED. Every spec is derived on read, so adding a shape
 * or a pattern is a visual change and never a save-schema change.
 */
import {
  PLAYER_HAIR_COLORS, PLAYER_HAIR_STYLES, PLAYER_SKIN_TONES,
} from '@/config/playerAppearance';
import type { Player, PlayerAppearance } from '@/types/game';
import { subSeed } from './rng';

/** A stable 32-bit hash of any string. `subSeed` from a zero base is exactly
 *  that, and reusing it means one hash function in the mode rather than two. */
export function sundayHash(text: string): number {
  return subSeed(0, text);
}

/**
 * One byte of the hash, as an integer in [0, range).
 *
 * Callers pass DISTINCT byte offsets (0, 8, 16, 24) so the choices they drive
 * are independent. Overlapping offsets would correlate them — a club whose
 * crest is a shield always getting hoops — which is exactly the sort of thing
 * that reads as a bug and is impossible to find.
 */
function byteOf(hash: number, offset: number, range: number): number {
  if (range <= 1) return 0;
  return ((hash >>> offset) & 0xff) % range;
}

/** A field of the face, from its own labelled hash. Deriving each field from a
 *  fresh hash rather than from a slice of one keeps eight choices independent
 *  when there are only four bytes to go round. */
function faceField(id: string, field: string, range: number): number {
  return sundayHash(`${id}:${field}`) % range;
}

/** Perceived luminance (0-1) of a hex colour, Rec. 601. Mirrors the one inside
 *  `PlayerAvatar`, which is not exported. */
function luminance(hex: string): number {
  const num = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(num)) return 0.5;
  return (((num >> 16) & 0xff) * 0.299 + ((num >> 8) & 0xff) * 0.587 + (num & 0xff) * 0.114) / 255;
}

/** Two colours a five-a-side pitch could tell apart at twenty yards. */
function readableTogether(a: string, b: string): boolean {
  return Math.abs(luminance(a) - luminance(b)) >= 0.18;
}

// ── Crests ──────────────────────────────────────────────────────────────────

/**
 * The outline. Sunday clubs do not have badges — they have whatever the bloke
 * at the print shop had a template for — so the four shapes are the four
 * things a printed patch actually looks like, not heraldry.
 */
export type SundayCrestShape = 'disc' | 'shield' | 'roundel' | 'pennant';

/** How the two colours are divided inside that outline. */
export type SundayCrestDivider = 'none' | 'halves' | 'band' | 'chevron' | 'quarters';

export interface SundayCrestSpec {
  shape: SundayCrestShape;
  divider: SundayCrestDivider;
  /** The hash everything above was drawn from. Exposed so a renderer can take
   *  further stable decisions (a rotation, a stitch offset) without re-hashing
   *  and without inventing a second seed. */
  seedHash: number;
}

const CREST_SHAPES: readonly SundayCrestShape[] = ['disc', 'shield', 'roundel', 'pennant'];
const CREST_DIVIDERS: readonly SundayCrestDivider[] = ['none', 'halves', 'band', 'chevron', 'quarters'];

/**
 * The crest for a club, from its id and its colours.
 *
 * The colours are not decoration on this call: a divider only means anything
 * if the two colours can be told apart, so a club whose secondary sits on top
 * of its primary gets `none` and keeps a legible solid patch instead of a
 * shape with an invisible seam through it.
 */
export function sundayCrestSpec(
  clubId: string,
  color: string,
  secondaryColor: string,
): SundayCrestSpec {
  const seedHash = sundayHash(clubId);
  const shape = CREST_SHAPES[byteOf(seedHash, 0, CREST_SHAPES.length)];
  const divider = readableTogether(color, secondaryColor)
    ? CREST_DIVIDERS[byteOf(seedHash, 8, CREST_DIVIDERS.length)]
    : 'none';
  return { shape, divider, seedHash };
}

// ── Kits ────────────────────────────────────────────────────────────────────

/** What is printed on the shirt. Five patterns because that is what a Sunday
 *  kit catalogue offers. */
export type SundayKitPattern = 'solid' | 'stripes' | 'hoops' | 'halves' | 'sash';

export interface SundayKitSpec {
  /** The shirt. */
  body: string;
  /** Sleeves, collar and whatever the pattern is drawn in. */
  trim: string;
  pattern: SundayKitPattern;
  seedHash: number;
}

const KIT_PATTERNS: readonly SundayKitPattern[] = ['solid', 'stripes', 'hoops', 'halves', 'sash'];

/**
 * The kit for a club.
 *
 * Same seed as the crest, so a club's badge and its shirt are drawn from one
 * identity rather than two independent ones — and the same contrast rule: a
 * pattern nobody can see is worse than no pattern, so indistinguishable
 * colours produce a plain shirt.
 */
export function sundayKitSpec(
  color: string,
  secondaryColor: string,
  clubId: string,
): SundayKitSpec {
  const seedHash = sundayHash(clubId);
  const pattern = readableTogether(color, secondaryColor)
    ? KIT_PATTERNS[byteOf(seedHash, 16, KIT_PATTERNS.length)]
    : 'solid';
  return { body: color, trim: secondaryColor, pattern, seedHash };
}

// ── Faces ───────────────────────────────────────────────────────────────────

/**
 * The appearance to draw for a player.
 *
 * Every Sunday player is generated with a persisted `appearance`
 * (`rollAppearance` in generation.ts), which is the one this returns. But the
 * field is OPTIONAL on `Player` — a ringer built by an older path, a save
 * migrated from before the field existed, or an elite-game player wandering
 * into a shared component can all arrive without one. Rather than render a
 * blank, the fallback is derived from a hash of the player's id: stable across
 * reloads and rollovers for the same reason the crest is, and different for
 * every man.
 */
export function sundayFaceSpec(player: Pick<Player, 'id' | 'appearance'>): PlayerAppearance {
  if (player.appearance) return player.appearance;
  const id = player.id || 'unknown';
  return {
    skinTone: faceField(id, 'skin', PLAYER_SKIN_TONES.length),
    hairStyle: faceField(id, 'hair', PLAYER_HAIR_STYLES.length),
    hairColor: faceField(id, 'hairColor', PLAYER_HAIR_COLORS.length),
    height: faceField(id, 'height', 3),
    build: faceField(id, 'build', 3),
    facialHair: faceField(id, 'beard', 5),
    // Most people are not wearing anything, which is what the generator's own
    // weighting says too (`accessory: rng.chance(0.15) ? … : 0`) — matched
    // here rather than rolled uniformly, so a fallback squad does not turn up
    // in headbands.
    accessory: faceField(id, 'accessoryRoll', 20) < 3 ? faceField(id, 'accessory', 4) + 1 : 0,
    bootColor: faceField(id, 'boots', 4),
  };
}
