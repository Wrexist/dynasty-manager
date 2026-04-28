import type { Club, Player, PlayerAttributes, Position, PackTierKey, PackRarityWeights } from '@/types/game';
import { generatePlayer, calculateOverall } from '@/utils/playerGen';
import { pick, clamp } from '@/utils/helpers';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';
import { recomputeDerivedEconomics } from '@/utils/playerEconomics';
import {
  PACK_TIER_MAP,
  PACK_POSITION_POOL,
  PACK_PITY_THRESHOLD,
  PACK_RARITY_BANDS,
  AI_BACKFILL_PER_TIER,
  AI_BACKFILL_OVR_GAP,
  AI_BACKFILL_OVR_SPREAD,
} from '@/config/packs';

function pickRarity(weights: PackRarityWeights): keyof PackRarityWeights {
  const total = weights.common + weights.bronze + weights.silver + weights.gold + weights.legendary;
  let r = Math.random() * total;
  if ((r -= weights.legendary) <= 0) return 'legendary';
  if ((r -= weights.gold) <= 0) return 'gold';
  if ((r -= weights.silver) <= 0) return 'silver';
  if ((r -= weights.bronze) <= 0) return 'bronze';
  return 'common';
}

/** Max reroll attempts for the pack-player fit loop. Wider than the old
 *  value (6) so the proportional-scale fallback only fires in truly
 *  adversarial cases. */
const MAX_FIT_REROLLS = 20;

/** Scale every attribute by the given ratio so the derived overall lands
 *  on target. Mirrors the pattern playerGen.ts uses to cap star/veteran
 *  overalls after a boost. Mutates `attrs` in place and returns it. */
function scaleAttributes(attrs: PlayerAttributes, ratio: number): PlayerAttributes {
  for (const key of Object.keys(attrs) as (keyof PlayerAttributes)[]) {
    attrs[key] = clamp(Math.floor(attrs[key] * ratio));
  }
  return attrs;
}

/** Generate a single player inside the pack's OVR band at a given rarity rung.
 *  When `respectTierCeiling` is true (default), the player's OVR is capped by
 *  `tier.ovrMax` — a bronze pack never hands out a gold card even if the
 *  rarity bucket rolls "silver". When false (pity-triggered guaranteed slot),
 *  we allow the roll to push above the tier ceiling.
 *
 *  Flow:
 *    1. Roll a player at a target quality inside [lo, hi].
 *    2. Reroll up to MAX_FIT_REROLLS times if the derived overall falls
 *       outside the window.
 *    3. If still out of range, proportionally scale attributes until the
 *       derived overall fits — this keeps attributes consistent with the
 *       card's displayed overall (the match engine reads attributes, not
 *       overall, so leaving them desynced would inflate performance).
 *    4. Recompute wage and value against the final overall. */
function rollPackPlayer(
  position: Position,
  tierKey: PackTierKey,
  season: number,
  minOvr: number,
  maxOvr: number,
  respectTierCeiling = true,
): Player {
  const tier = PACK_TIER_MAP[tierKey];
  const ceiling = respectTierCeiling ? tier.ovrMax : 99;
  let lo = Math.max(tier.ovrMin, Math.min(minOvr, ceiling));
  let hi = Math.max(lo, Math.min(Math.max(maxOvr, minOvr), ceiling));
  if (hi < lo) { const tmp = lo; lo = hi; hi = tmp; }
  const target = lo + Math.floor(Math.random() * (hi - lo + 1));

  let player = generatePlayer(position, target, '', season);
  let derived = calculateOverall(player.attributes, player.position);
  for (let i = 0; i < MAX_FIT_REROLLS && (derived < lo || derived > hi); i++) {
    player = generatePlayer(position, target, '', season);
    derived = calculateOverall(player.attributes, player.position);
  }

  // Rare fallback: proportionally scale attributes so derived overall fits.
  // Loop bounded because integer rounding can cause small oscillations; we
  // give up after a few iterations and accept the last shape.
  if (derived > hi) {
    const attrs = { ...player.attributes };
    for (let i = 0; i < 6 && derived > hi; i++) {
      scaleAttributes(attrs, (hi - 0.5) / derived);
      derived = calculateOverall(attrs, player.position);
    }
    player.attributes = attrs;
  } else if (derived < lo) {
    const attrs = { ...player.attributes };
    for (let i = 0; i < 6 && derived < lo; i++) {
      scaleAttributes(attrs, (lo + 0.5) / derived);
      derived = calculateOverall(attrs, player.position);
    }
    player.attributes = attrs;
  }
  player.overall = clamp(derived, lo, hi);

  // Pack-pulled players run through the shared economics helper so the
  // walkout reveal carries the right rarity/value/wage premium.
  recomputeDerivedEconomics(player);
  // Potential floors at overall — never below.
  if (player.potential < player.overall) player.potential = player.overall;
  return player;
}

export interface PackContentsOptions {
  /** When true, the guaranteed slot is promoted to min 80 OVR (pity hit). */
  pityTriggered?: boolean;
}

/** Generate the full set of players contained in a pack. The first card is
 *  always the guaranteed-rare slot; the remaining cards roll per the tier's
 *  rarity weights. All generated players have clubId = '' — the slice will
 *  finalize clubId on assignment. */
export function generatePackContents(
  tierKey: PackTierKey,
  season: number,
  opts: PackContentsOptions = {},
): Player[] {
  const tier = PACK_TIER_MAP[tierKey];
  const players: Player[] = [];

  // ── Guaranteed slot ──
  // Pity lifts the floor to at least 80 AND lets the roll exceed the tier's
  // normal ceiling — that's the whole point of the pity bonus.
  const pityOn = !!opts.pityTriggered;
  const guaranteedMin = pityOn
    ? Math.max(tier.guaranteedMinOvr, 80)
    : tier.guaranteedMinOvr;
  const guaranteedMax = pityOn
    ? Math.max(guaranteedMin + 8, 89)
    : Math.max(guaranteedMin, tier.ovrMax);
  const guaranteedPosition = pick(PACK_POSITION_POOL);
  players.push(rollPackPlayer(guaranteedPosition, tierKey, season, guaranteedMin, guaranteedMax, !pityOn));

  // ── Remaining cards: weighted rarity roll ──
  for (let i = 1; i < tier.cards; i++) {
    const rarity = pickRarity(tier.rarity);
    const [rMin, rMax] = PACK_RARITY_BANDS[rarity];
    const position = pick(PACK_POSITION_POOL);
    players.push(rollPackPlayer(position, tierKey, season, rMin, rMax));
  }

  // Shuffle so the guaranteed card isn't always first in the reveal order
  // (keeps suspense; user doesn't know which one is the guaranteed pull).
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  return players;
}

export interface AiBackfillResult {
  /** Map of clubId → newly added Player ids. Slice uses this to update
   *  each club's playerIds + wageBill. */
  perClub: Record<string, Player[]>;
}

/** League-balance counter-signings. When the user opens a pack of `tierKey`,
 *  a small number of AI clubs each get one new player at strictly lower OVR
 *  than the user's guaranteed pull. This stops the user's pack acquisitions
 *  from making the rest of the league trivially weak.
 *
 *  Always-on, conservative defaults:
 *   - Total AI signings ≤ user's pack cards − 1 (user always gets more)
 *   - Each AI signing OVR ≤ tier.guaranteedMinOvr − AI_BACKFILL_OVR_GAP
 *     (user always gets the higher-rated cards)
 *   - Skips the player's own club, clubs already at MAX_SQUAD_SIZE, and
 *     any club not in the same playerDivision (keeps the boost local). */
export function generateAiCounterSignings(
  tierKey: PackTierKey,
  clubs: Record<string, Club>,
  playerClubId: string,
  playerDivision: string,
  season: number,
): AiBackfillResult {
  const tier = PACK_TIER_MAP[tierKey];
  const slots = AI_BACKFILL_PER_TIER[tierKey] || 0;
  if (slots === 0) return { perClub: {} };

  // Eligible AI clubs: same division, not the player, room on roster.
  const eligible = Object.values(clubs).filter(c =>
    c.id !== playerClubId
    && c.divisionId === playerDivision
    && c.playerIds.length < MAX_SQUAD_SIZE,
  );
  if (eligible.length === 0) return { perClub: {} };

  // OVR window: never above (user guarantee − GAP), down by SPREAD.
  const ceiling = Math.max(40, tier.guaranteedMinOvr - AI_BACKFILL_OVR_GAP);
  const floor = Math.max(40, ceiling - AI_BACKFILL_OVR_SPREAD);

  // Reputation-weighted pick: better clubs win the "auction" more often.
  // Without replacement so the same club doesn't get two AI signings from
  // a single player open.
  const pool = [...eligible];
  const chosen: Club[] = [];
  for (let i = 0; i < slots && pool.length > 0; i++) {
    const totalWeight = pool.reduce((s, c) => s + Math.max(1, c.reputation || 0), 0);
    let roll = Math.random() * totalWeight;
    let pickIdx = 0;
    for (let j = 0; j < pool.length; j++) {
      roll -= Math.max(1, pool[j].reputation || 0);
      if (roll <= 0) { pickIdx = j; break; }
    }
    chosen.push(pool.splice(pickIdx, 1)[0]);
  }

  const perClub: Record<string, Player[]> = {};
  for (const club of chosen) {
    const target = floor + Math.floor(Math.random() * (ceiling - floor + 1));
    const position = pick(PACK_POSITION_POOL);
    let player = generatePlayer(position, target, club.id, season);
    let derived = calculateOverall(player.attributes, player.position);
    // One reroll if extreme variance pushes us over the ceiling.
    if (derived > ceiling) {
      player = generatePlayer(position, target, club.id, season);
      derived = calculateOverall(player.attributes, player.position);
    }
    player.overall = clamp(derived, floor, ceiling);
    recomputeDerivedEconomics(player);
    if (player.potential < player.overall) player.potential = player.overall;
    player.joinedSeason = season;
    perClub[club.id] = [player];
  }
  return { perClub };
}

/** Should pity kick in on the next open? */
export function shouldPityTrigger(pityCounter: number): boolean {
  return pityCounter >= PACK_PITY_THRESHOLD;
}

/** Update pity counter based on a set of opened players.
 *  Resets on any 80+ pull, otherwise increments by 1. */
export function updatedPityCounter(pityCounter: number, players: Player[]): number {
  const gotGold = players.some(p => p.overall >= 80);
  if (gotGold) return 0;
  return pityCounter + 1;
}
