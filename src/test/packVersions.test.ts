import { describe, it, expect, beforeAll } from 'vitest';
import { generatePackContents } from '@/utils/packGeneration';
import {
  PACK_TIER_MAP,
  PACK_STOREFRONT_ORDER,
  PAID_PACK_TIERS,
  FREE_PACK_TIER,
  WEEKLY_PACK_SKINS,
  getFeaturedPackTier,
  packFrameFor,
  packVersionBoostFor,
  resolvePackTier,
  PACK_WAGE_FACTOR,
} from '@/config/packs';
import type { Player, PlayerAttributes, PackTierKey } from '@/types/game';
import { getNationalPoolSync } from '@/data/nationalPlayerPoolAccess';
import { countRealPlayersInBand } from '@/utils/realPlayerPicker';
import { recomputeDerivedEconomics } from '@/utils/playerEconomics';
import type { PlayerTemplate } from '@/data/playerTemplates';

/** Look a pulled card back up in the pool it came from.
 *
 *  A function, not a module-scope map: the pool is loaded by the suite's global
 *  setup, so anything built at module-evaluation time is built against {}. */
function findTemplateByFcId(fcId: string): PlayerTemplate | undefined {
  for (const list of Object.values(getNationalPoolSync())) {
    const hit = list.find(t => t.fcId === fcId);
    if (hit) return hit;
  }
  return undefined;
}

/** The six axes a version boost moves. `buildPlayerFromTemplate` only adopts
 *  the template's attributes when `pace` is present, and falls back to the
 *  generated value for any individual axis the template omits — so both the
 *  gate and the per-axis skip below are load-bearing, not defensive noise. */
const ATTR_KEYS: (keyof PlayerAttributes)[] = ['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'];

/** Generating packs is the expensive part of this file. One corpus per
 *  storefront tier, built once, shared by every assertion that only needs to
 *  look at pulls. 25 packs is enough for the Icon tier (one card per pack) to
 *  clear the ≥15-sample bar used by the pricing test. */
const PACKS_PER_TIER = 25;
const corpus: Partial<Record<PackTierKey, Player[][]>> = {};

beforeAll(() => {
  for (const key of PACK_STOREFRONT_ORDER) {
    const packs: Player[][] = [];
    for (let run = 0; run < PACKS_PER_TIER; run++) {
      // The free tier is resolved at max streak so it is measured at the band
      // it actually ships at on day 7 — its weakest band would understate it.
      packs.push(generatePackContents(key, 1, key === FREE_PACK_TIER ? { streak: 7 } : {}));
    }
    corpus[key] = packs;
  }
});

/** Every real card the corpus dealt for a tier, paired with its template. */
function realPulls(key: PackTierKey): Array<{ player: Player; template: PlayerTemplate }> {
  const out: Array<{ player: Player; template: PlayerTemplate }> = [];
  for (const pack of corpus[key] ?? []) {
    for (const p of pack) {
      if (p.source !== 'real' || !p.fcId) continue;
      const template = findTemplateByFcId(p.fcId);
      if (template) out.push({ player: p, template });
    }
  }
  return out;
}

describe('Pack versions — the boost reaches the card, not just the badge', () => {
  it('carries the boost on every attribute, not only the overall', () => {
    // The overall is what the reveal shouts; the attributes are what the match
    // engine reads. A version that moved the number but not the six axes would
    // sell a +4 Legends card that plays exactly like the base player — the
    // single most expensive lie the storefront could tell.
    for (const key of PAID_PACK_TIERS) {
      const boost = PACK_TIER_MAP[key].versionBoost ?? 0;
      let checked = 0;
      for (const { player, template } of realPulls(key)) {
        // No `pace` on the template means the player's attributes were rolled,
        // not adopted — there is no base to compare against.
        if (template.pace === undefined) continue;
        for (const attr of ATTR_KEYS) {
          const base = template[attr];
          if (base === undefined) continue;
          expect(
            player.attributes[attr],
            `${key}: ${player.lastName} ${attr} ${player.attributes[attr]}, base ${base}, boost +${boost}`,
          ).toBe(Math.min(99, base + boost));
        }
        checked++;
      }
      expect(checked, `${key} produced too few comparable real pulls`).toBeGreaterThanOrEqual(5);
    }
  });

  it('makes each tier a genuinely different version of the same player', () => {
    // The bands do not overlap — a 68-84 base pull and an 84-91 base pull are
    // never the same person — so "different versions" cannot be observed by
    // pulling. What CAN be pinned is the property that makes them different at
    // all: a strictly increasing, strictly positive ladder. Two equal boosts
    // would make two price points mint the identical card.
    const ladder = PAID_PACK_TIERS.map(k => PACK_TIER_MAP[k].versionBoost ?? 0);
    for (let i = 0; i < ladder.length; i++) {
      expect(ladder[i], `${PAID_PACK_TIERS[i]} issues base cards from a paid pack`).toBeGreaterThan(0);
      if (i > 0) {
        expect(ladder[i], `${PAID_PACK_TIERS[i]} is no better an issue than ${PAID_PACK_TIERS[i - 1]}`)
          .toBeGreaterThan(ladder[i - 1]);
      }
    }
    // And the free tier deals base cards — the version IS the paid product.
    expect(PACK_TIER_MAP[FREE_PACK_TIER].versionBoost ?? 0).toBe(0);

    // Applied to one real template, the ladder produces a strictly better card
    // at every rung: same player, five distinct cards.
    const template = Object.values(getNationalPoolSync())
      .flat()
      .find(t => t.ovr > 0 && t.ovr <= 90);
    expect(template, 'pool has no template to version').toBeTruthy();
    const finals = ladder.map(b => Math.min(99, template!.ovr + b));
    expect(new Set(finals).size).toBe(finals.length);
  });
});

describe('Pack versions — the promo boost is dated', () => {
  it('grants the extra point only in the week the pack is featured, and grants the frame with it', () => {
    // `packVersionBoostFor` and `packFrameFor` must move together: the frame is
    // the claim ("this is a Dynasty card") and the boost is what the claim is
    // worth. A frame without the boost is a lie; a boost without the frame is a
    // promo nobody can prove they were there for.
    const base = PACK_TIER_MAP.rare.versionBoost ?? 0;
    const skin = WEEKLY_PACK_SKINS.find(sk => sk.tier === 'rare');
    expect(skin, 'no weekly skin backs the rare tier').toBeTruthy();

    const featuredWeek = [0, 1, 2, 3, 4, 5].find(w => getFeaturedPackTier(w) === 'rare');
    const otherWeek = [0, 1, 2, 3, 4, 5].find(w => getFeaturedPackTier(w) !== 'rare');
    expect(featuredWeek, 'rare is never featured in the rotation').toBeDefined();
    expect(otherWeek, 'rare is featured every week — the rotation has collapsed').toBeDefined();

    expect(packVersionBoostFor('rare', featuredWeek!)).toBe(base + skin!.extraBoost);
    expect(packFrameFor('rare', featuredWeek!)).toBe(skin!.cardFrame);

    expect(packVersionBoostFor('rare', otherWeek!)).toBe(base);
    expect(packFrameFor('rare', otherWeek!)).toBe(PACK_TIER_MAP.rare.cardFrame);

    // No week supplied at all — a caller that cannot say when the pack was
    // opened must never mint a dated version.
    expect(packVersionBoostFor('rare')).toBe(base);
    expect(packFrameFor('rare')).toBe(PACK_TIER_MAP.rare.cardFrame);
  });
});

describe('Pack versions — pricing follows the final rating', () => {
  it('prices a version above the base card it was minted from', () => {
    // A version card is strictly better than the player's base card, so it must
    // also cost more to own. If wage and value were derived from the template's
    // rating instead of the issued one, a +4 Legends 95 would be paid like a 91
    // — a permanent, compounding discount on the best cards in the game.
    //
    // Aggregate, never per-card: `calculatePlayerWage` rerolls a ±10% random
    // factor on every call, so a single boosted/base pair can invert by chance.
    const pulls = realPulls('icon');
    expect(pulls.length, 'not enough icon pulls to compare').toBeGreaterThanOrEqual(15);

    let boostedWage = 0, boostedValue = 0, baseWage = 0, baseValue = 0;
    for (const { player, template } of pulls) {
      const twin: Player = {
        ...player,
        attributes: { ...player.attributes },
        overall: template.ovr,
        wageFactor: player.wageFactor,
      };
      if (template.pace !== undefined) {
        for (const attr of ATTR_KEYS) {
          const v = template[attr];
          if (v !== undefined) twin.attributes[attr] = v;
        }
      }
      recomputeDerivedEconomics(twin);
      boostedWage += player.wage; boostedValue += player.value;
      baseWage += twin.wage; baseValue += twin.value;
    }
    const n = pulls.length;
    expect(boostedWage / n, 'version wages do not exceed base wages').toBeGreaterThan(baseWage / n);
    expect(boostedValue / n, 'version values do not exceed base values').toBeGreaterThan(baseValue / n);
    // The version is a better card, not a differently-discounted contract.
    for (const { player } of pulls) expect(player.wageFactor).toBe(PACK_WAGE_FACTOR);
  });
});

describe('Pack versions — the advertised band still holds', () => {
  it('never pushes a card past the tier ceiling or the guarantee below its floor', () => {
    // The tier's band numbers are FINAL ratings. The boost is applied after the
    // base player is chosen, so an off-by-one in either direction (subtracting
    // the boost from the wrong end, or forgetting to) shows up here first: as a
    // card above the published ceiling, or a guarantee the pack cannot meet.
    for (const key of PACK_STOREFRONT_ORDER) {
      const tier = key === FREE_PACK_TIER
        ? resolvePackTier(PACK_TIER_MAP[key], { streak: 7 })
        : PACK_TIER_MAP[key];
      const packs = (corpus[key] ?? []).slice(0, 20);
      for (const players of packs) {
        for (const p of players) {
          expect(p.overall, `${key} dealt ${p.lastName} at ${p.overall}, ceiling ${tier.ovrMax}`)
            .toBeLessThanOrEqual(tier.ovrMax);
        }
        const top = Math.max(...players.map(p => p.overall));
        expect(top, `${key} guaranteed slot came in at ${top}, floor ${tier.guaranteedMinOvr}`)
          .toBeGreaterThanOrEqual(tier.guaranteedMinOvr);
      }
    }
  });
});

describe('Pack versions — supply honesty', () => {
  it('has real players behind every paid guarantee once the boost is subtracted', () => {
    // The version system is also the fix for top-end supply thinness: an 88+
    // guarantee draws on the base band 84-91, not the 28 players at 88+. That
    // only holds while the base band is genuinely populated — this is the
    // machine-checked form of "the guarantee has real players behind it", and
    // it fails on a config edit that raises a floor past what the data can back.
    for (const key of PAID_PACK_TIERS) {
      const tier = PACK_TIER_MAP[key];
      const boost = tier.versionBoost ?? 0;
      const supply = countRealPlayersInBand(tier.guaranteedMinOvr - boost, tier.ovrMax - boost);
      expect(
        supply,
        `${key} guarantee ${tier.guaranteedMinOvr}+ is backed by only ${supply} base players in ${tier.guaranteedMinOvr - boost}-${tier.ovrMax - boost}`,
      ).toBeGreaterThanOrEqual(25);
    }
  });
});

describe('promo week — the sheet and the generator agree', () => {
  it('a promo-boosted open can reach, and never exceeds, the raised ceiling', () => {
    // The audit's blocker: the featured presentation raised ovrMax for the
    // sheet while generation clamped to the tier's unraised ceiling, so one
    // week in three the guide published a top odds row ("Legendary (90 OVR)
    // 5%") that the generator was mathematically incapable of dealing. This
    // pins the two together the way the deleted skin-immutability assertion
    // used to, but for the raised band the promo legitimately has.
    for (const skin of WEEKLY_PACK_SKINS) {
      const tier = PACK_TIER_MAP[skin.tier];
      const promoBoost = (tier.versionBoost ?? 0) + (skin.extraBoost ?? 0);
      const raisedCeiling = tier.ovrMax + (skin.extraBoost ?? 0);

      let sawTop = 0;
      const RUNS = 60;
      for (let i = 0; i < RUNS; i++) {
        for (const p of generatePackContents(skin.tier, 1, { versionBoost: promoBoost })) {
          expect(p.overall, `${skin.name} dealt ${p.overall} past its ceiling ${raisedCeiling}`)
            .toBeLessThanOrEqual(raisedCeiling);
          if (p.overall > tier.ovrMax) sawTop++;
        }
      }
      // The raised point must be genuinely reachable, or the promo's top odds
      // row is decoration. The guaranteed slot alone rolls a uniform target
      // across the band, so 60 opens missing it entirely means the clamp is
      // back.
      expect(sawTop, `${skin.name} never dealt above the base ceiling in ${RUNS} opens`).toBeGreaterThan(0);
    }
  });
});
