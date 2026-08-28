import type { Club, Player, PlayerAttributes, Position, PackTierDefinition, PackTierKey, PackRarityWeights, RetiredLegend } from '@/types/game';
import { generatePlayer, calculateOverall, buildPlayerFromTemplate } from '@/utils/playerGen';
import { pickRealPlayerForPack } from '@/utils/realPlayerPicker';
import { pick, clamp } from '@/utils/helpers';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';
import { recomputeDerivedEconomics } from '@/utils/playerEconomics';
import {
  PACK_TIER_MAP,
  PACK_POSITION_POOL,
  PACK_PITY_THRESHOLD,
  PACK_PITY_MIN_OVR,
  PACK_PITY_MAX_OVERSHOOT,
  PACK_PITY_MIN_BAND,
  PACK_RARITY_BANDS,
  PACK_WAGE_FACTOR,
  resolvePackTier,
  AI_BACKFILL_PER_TIER,
  AI_BACKFILL_OVR_GAP,
  AI_BACKFILL_OVR_SPREAD,
  packLegendChance,
} from '@/config/packs';
import { drawLegend, buildPlayerFromLegend } from '@/utils/legends';

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

/** Hard ceiling on weekly-bonus cards, independent of what config asks for.
 *  A pack is a reveal sequence the player sits through; past a handful of cards
 *  the ceremony becomes a chore. */
const MAX_EXTRA_CARDS = 3;

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
 *  `ceiling` caps the roll and defaults to the tier's own `ovrMax` — a bronze
 *  pack never hands out a gold card even if the rarity bucket rolls "silver".
 *  The pity path raises it slightly (see `PACK_PITY_MAX_OVERSHOOT`); it used to
 *  lift it to 99, which let a free Bronze pack out-pull a paid Rare Gold.
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
  tier: PackTierDefinition,
  season: number,
  minOvr: number,
  maxOvr: number,
  ceiling: number = tier.ovrMax,
  /** fcIds already dealt in THIS pack. Pulling the same player twice in one
   *  five-card pack reads as a bug even in a game where duplicates across
   *  packs are the whole point. */
  taken?: Set<string>,
  /** Version boost this pack issues its cards at. Every band number in this
   *  function is a FINAL rating; the underlying real player is picked at
   *  (final − boost) and dealt with +boost on every attribute. */
  versionBoost = 0,
): Player {
  let lo = Math.max(tier.ovrMin, Math.min(minOvr, ceiling));
  let hi = Math.max(lo, Math.min(Math.max(maxOvr, minOvr), ceiling));
  if (hi < lo) { const tmp = lo; lo = hi; hi = tmp; }

  // ── Real player first ──
  //
  // A pack is the one surface in the game that was handing out invented people.
  // Everything else — squads, the transfer market, free agents — is built from
  // the real-player templates, so the monetised screen was the only place you
  // could not pull a name you recognise. That is backwards.
  //
  // The band selects the player and the player brings his own rating; see
  // `pickRealPlayerForPack` for why pack pulls are allowed to duplicate real
  // players when nothing else in the game is.
  // The player is picked at his BASE rating; the card is issued at final.
  // This is what lets an 88+ pack draw on the 122 players rated 84+ instead
  // of the 28 rated 88+ — the version boost widens the honest supply.
  const baseLo = Math.max(1, lo - versionBoost);
  const baseHi = Math.max(baseLo, hi - versionBoost);
  let template = pickRealPlayerForPack(position, baseLo, baseHi);
  // A few rerolls is plenty: the narrowest band any tier uses still holds
  // dozens of players, and giving up falls through to a fresh invented player
  // rather than dealing a duplicate.
  for (let i = 0; i < 6 && template?.fcId && taken?.has(template.fcId); i++) {
    template = pickRealPlayerForPack(position, baseLo, baseHi);
  }
  if (template && !(template.fcId && taken?.has(template.fcId))) {
    if (template.fcId) taken?.add(template.fcId);
    const real = buildPlayerFromTemplate(template, '', season);
    // ── Issue the pack's version of him ──
    // Flat +boost on every attribute and on overall, the same shape the
    // Ballon d'Or boost uses. The template's own rating is the base; the
    // pack's band numbers are the final. Never scaled or re-derived — a
    // version is the same player, one notch sharper everywhere.
    if (versionBoost > 0) {
      for (const key of Object.keys(real.attributes) as (keyof PlayerAttributes)[]) {
        real.attributes[key] = clamp(real.attributes[key] + versionBoost);
      }
      real.overall = clamp(real.overall + versionBoost);
    }
    if (real.potential < real.overall) real.potential = real.overall;
    // Sign on the pack wage scale, then re-price from the FINAL rating so the
    // wage, value and rarity all belong to the card the player actually holds.
    real.wageFactor = PACK_WAGE_FACTOR;
    recomputeDerivedEconomics(real);
    return real;
  }

  // ── Fallback: an invented player ──
  //
  // Reached when the pool has nobody in this band at this position. It should
  // be rare and the storefront supply guard (`scripts/check-pack-supply.mjs`)
  // exists so an imported dataset that makes it COMMON fails the build rather
  // than quietly filling the Icon Pack with strangers.
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
  // walkout reveal carries the right rarity/value/wage premium. Same contract
  // as a real pull — the discount belongs to the pack, not to the player.
  player.wageFactor = PACK_WAGE_FACTOR;
  recomputeDerivedEconomics(player);
  // Potential floors at overall — never below.
  if (player.potential < player.overall) player.potential = player.overall;
  return player;
}

export interface PackContentsOptions {
  /** When true, the guaranteed slot is promoted toward 80 OVR (pity hit),
   *  bounded by the tier's own ceiling plus `PACK_PITY_MAX_OVERSHOOT`. */
  pityTriggered?: boolean;
  /** True when this open cost the user nothing (free daily or rewarded ad),
   *  which selects the tier's weaker `freeOpenOverride` odds where it has
   *  them. Defaults to false so a caller that forgets it gets the PAID odds
   *  rather than silently under-rewarding a purchase. */
  freeOpen?: boolean;
  /** Consecutive-login streak, which selects the Daily Pack's odds band.
   *  Defaults to 1 (the weakest band) so a caller that forgets it cannot
   *  accidentally hand out the day-7 pack. */
  streak?: number;
  /** Extra cards beyond `tier.cards`, granted by the weekly featured bonus.
   *  Each one rolls at the tier's guaranteed floor — that is precisely what
   *  the offer promises on the card, so it is what the generator delivers. */
  extraCards?: number;
  /** Version boost override. Defaults to the tier's own `versionBoost`; the
   *  slice passes `packVersionBoostFor(tier, currentWeekIndex())` so a promo
   *  week's +1 reaches the cards. Must default from config rather than 0, or
   *  a caller that forgets it silently deals base cards from a paid pack. */
  versionBoost?: number;
  /** The save's Hall of Legends archive (`state.retiredLegends`), merged with
   *  the authored seed set when a legend deal fires. Optional because the
   *  generator must stay callable without a store — an absent archive just
   *  means every legend deal draws from the seeds. */
  legendArchive?: RetiredLegend[];
  /** Test hook: forces the legend roll's outcome. Production callers never
   *  pass it — the roll comes from `packLegendChance(tierKey)`. */
  forceLegendRoll?: boolean;
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
  // A free/ad open resolves to the tier's weaker odds where it defines them;
  // the Daily Pack additionally resolves its streak band. Single resolver, so
  // the odds sheet and the generator can never disagree.
  const resolved = resolvePackTier(PACK_TIER_MAP[tierKey], {
    freeOpen: !!opts.freeOpen,
    streak: opts.streak,
  });
  const versionBoost = opts.versionBoost ?? resolved.versionBoost ?? 0;
  // A promo week's +1 raises the FINAL ceiling with it — the base pick band's
  // top (ovrMax − boost) is unchanged, the issued cards go one higher. Without
  // this, the promo odds sheet (built from the raised presentation) published
  // a top row the generator was mathematically incapable of dealing: during a
  // Golden Era week the guide said "Legendary (90 OVR) 5%" while every card
  // clamped to 89 (audit finding, and the exact false-odds class Guideline
  // 3.1.1 is about).
  const extraOverTier = Math.max(0, versionBoost - (resolved.versionBoost ?? 0));
  const tier = extraOverTier > 0
    ? { ...resolved, ovrMax: resolved.ovrMax + extraOverTier }
    : resolved;
  const players: Player[] = [];

  // ── Guaranteed slot ──
  // Pity aims the floor at PACK_PITY_MIN_OVR, but the roll stays tied to what
  // the pack is worth: at most PACK_PITY_MAX_OVERSHOOT above its own ceiling.
  const pityOn = !!opts.pityTriggered;
  const pityCeiling = tier.ovrMax + PACK_PITY_MAX_OVERSHOOT;
  const guaranteedMin = pityOn
    ? Math.max(tier.guaranteedMinOvr, Math.min(PACK_PITY_MIN_OVR, pityCeiling - PACK_PITY_MIN_BAND))
    : tier.guaranteedMinOvr;
  const guaranteedMax = pityOn
    ? Math.min(Math.max(guaranteedMin + 8, 89), pityCeiling)
    : Math.max(guaranteedMin, tier.ovrMax);
  const taken = new Set<string>();

  // ── Legend deal ──
  // With the tier's published `legendChance`, the guaranteed slot is a Hall
  // of Legends card instead of an active player: a retired great issued at
  // his own peak, NO version boost (the legend IS the version — see the
  // field's doc in types/game.ts). It replaces only the guaranteed slot, so
  // the rarity table for the remaining cards — and therefore the main odds
  // rows — is untouched; the legend chance is disclosed as its own line in
  // the odds sheet. Always satisfies the floor: every legend peaks 88+.
  // Never rolled for a pity open — pity is a promise about the guaranteed
  // slot's rating, and swapping the slot's nature under it muddies both.
  const legendRoll = opts.forceLegendRoll ?? (!pityOn && Math.random() < packLegendChance(tierKey));
  const guaranteedPosition = pick(PACK_POSITION_POOL);
  if (legendRoll) {
    players.push(buildPlayerFromLegend(drawLegend(opts.legendArchive), season));
  } else {
    players.push(rollPackPlayer(
      guaranteedPosition, tier, season, guaranteedMin, guaranteedMax,
      pityOn ? pityCeiling : tier.ovrMax, taken, versionBoost,
    ));
  }

  // ── Weekly bonus cards ──
  // Rolled at the guaranteed floor, matching the offer's wording exactly
  // ("+1 card, guaranteed 84+"). Clamped so a misconfigured bonus can never
  // inflate a pack past a sane size — a pack is a reveal sequence, not a list.
  const extra = Math.max(0, Math.min(Math.floor(opts.extraCards ?? 0), MAX_EXTRA_CARDS));
  for (let i = 0; i < extra; i++) {
    players.push(rollPackPlayer(
      pick(PACK_POSITION_POOL), tier, season, tier.guaranteedMinOvr, tier.ovrMax,
      tier.ovrMax, taken, versionBoost,
    ));
  }

  // ── Remaining cards: weighted rarity roll ──
  for (let i = 1; i < tier.cards; i++) {
    const rarity = pickRarity(tier.rarity);
    const [rMin, rMax] = PACK_RARITY_BANDS[rarity];
    const position = pick(PACK_POSITION_POOL);
    players.push(rollPackPlayer(position, tier, season, rMin, rMax, tier.ovrMax, taken, versionBoost));
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
  freeOpen = false,
  streak?: number,
): AiBackfillResult {
  const tier = resolvePackTier(PACK_TIER_MAP[tierKey], { freeOpen, streak });
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
