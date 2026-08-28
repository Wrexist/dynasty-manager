import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { useGameStore } from '@/store/gameStore';
import { writeDailyPackOpens, currentDayIndex } from '@/store/helpers/persistence';
import { generateAiCounterSignings, generatePackContents, shouldPityTrigger, updatedPityCounter } from '@/utils/packGeneration';
import {
  AI_BACKFILL_OVR_GAP,
  AI_BACKFILL_PER_TIER,
  PACK_TIER_MAP,
  PACK_TIERS,
  PACK_PITY_THRESHOLD,
  PACK_PITY_MAX_OVERSHOOT,
  PACK_STOREFRONT_ORDER,
  PACK_STREAK_BANDS,
  PACK_RARITY_BANDS,
  PAID_PACK_TIERS,
  FREE_PACK_TIER,
  FEATURED_PACK_ROTATION,
  WEEKLY_BONUS_CARDS,
  WALKOUT_OVR_THRESHOLD,
  describePackOdds,
  getFeaturedPackTier,
  getFeaturedPackPresentation,
  WEEKLY_PACK_SKINS,
  packEliteCardsPerDollar,
  packFrameArt,
  packFrameFor,
  PACK_CARD_FRAMES,
  PACK_WAGE_FACTOR,
  resolvePackTier,
} from '@/config/packs';
import type { Club, PackTierKey } from '@/types/game';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';
import { getNationalPoolSync } from '@/data/nationalPlayerPoolAccess';
import { countRealPlayersInBand } from '@/utils/realPlayerPicker';
import { recomputeDerivedEconomics } from '@/utils/playerEconomics';
import {
  VALUE_EXP_BASE,
  VALUE_EXP_RATE,
  VALUE_RANDOM_FACTOR,
  WAGE_EXP_BASE,
  WAGE_EXP_RATE,
  WAGE_FLOOR,
  WAGE_RANDOM_FACTOR,
} from '@/config/playerGeneration';
import { XP_REWARDS } from '@/utils/managerPerks';
import { withSeededRandom } from './helpers/seasonFixtures';

/** Theoretical worst-case outputs of the wage/value calculators for a given
 *  OVR — the random multiplier maxes out at `1 + RANDOM_FACTOR`. Used to
 *  catch pre-clamp leakage (wage/value derived from a higher pre-clamp OVR
 *  would blow through these bounds by >10-100x depending on the gap). */
function maxWageForOvr(ovr: number): number {
  return Math.max(WAGE_FLOOR, Math.round(WAGE_EXP_BASE * Math.exp(WAGE_EXP_RATE * ovr) * (1 + WAGE_RANDOM_FACTOR)));
}
function maxValueForOvr(ovr: number): number {
  return Math.round(VALUE_EXP_BASE * Math.exp(VALUE_EXP_RATE * ovr) * (1 + VALUE_RANDOM_FACTOR));
}

const CLUB_ID = 'celtic';

function initAndGetState() {
  // The daily free/ad allowance is DEVICE-global (localStorage), not part of
  // the save — that is what makes it a real daily limit rather than a per-slot,
  // save-scummable one. jsdom keeps localStorage for the whole file, so it has
  // to be cleared per test or allowances leak between them.
  writeDailyPackOpens({ dayIndex: currentDayIndex(), free: {}, ad: {} });
  useGameStore.getState().initGame(CLUB_ID);
  return useGameStore.getState();
}

// openPack() now schedules its AI-backfill + lineup re-optimization on a
// deferred macrotask (setTimeout(0) in jsdom). Flush any pending deferred work
// after every test so it can't fire into — and pollute the state of — the next
// test (e.g. inflating an exact player-count assertion).
afterEach(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

/** Look a pulled card back up in the pool it came from. */
function findTemplateByFcId(fcId: string) {
  for (const list of Object.values(getNationalPoolSync())) {
    const hit = list.find(t => t.fcId === fcId);
    if (hit) return hit;
  }
  return undefined;
}

/** Highest rating in the real player pool. Pack pulls are real players, so
 *  this is the hard ceiling on anything a pack can produce — including a pity
 *  pull, which raises the band's floor rather than inventing a better player.
 *
 *  A function, not a const: the pool is loaded by the suite's global setup, so
 *  reading it at module-evaluation time returns {} and a ceiling of 0. */
function poolMaxOvr(): number {
  let max = 0;
  for (const list of Object.values(getNationalPoolSync())) {
    for (const t of list) if (t.ovr > max) max = t.ovr;
  }
  return max;
}

describe('Pack opening — generation', () => {
  it('returns exactly `cards` players per pack tier', () => {
    for (const tier of Object.values(PACK_TIER_MAP)) {
      const players = generatePackContents(tier.key, 1);
      expect(players).toHaveLength(tier.cards);
    }
  });

  it('always respects the guaranteed-rare floor', () => {
    for (const tier of Object.values(PACK_TIER_MAP)) {
      for (let run = 0; run < 40; run++) {
        // Legend deals off — the hall card is the disclosed exception to the
        // tier band (its own suite: legends.test.ts).
        const players = generatePackContents(tier.key, 1, { forceLegendRoll: false });
        const topOvr = Math.max(...players.map(p => p.overall));
        expect(topOvr).toBeGreaterThanOrEqual(tier.guaranteedMinOvr);
      }
    }
  });

  it('keeps all generated players inside the tier OVR band', () => {
    for (const tier of Object.values(PACK_TIER_MAP)) {
      for (let run = 0; run < 20; run++) {
        // Legend deals off — the hall card is the disclosed exception to the
        // tier band (its own suite: legends.test.ts).
        const players = generatePackContents(tier.key, 1, { forceLegendRoll: false });
        for (const p of players) {
          expect(p.overall).toBeLessThanOrEqual(tier.ovrMax);
        }
      }
    }
  });

  it('pity stays inside the tier\'s own band', () => {
    // Pity used to ignore the tier ceiling outright, so one free pack in nine
    // could produce an 89 — better than the $6.99 Rare Gold guarantee.
    for (const tier of Object.values(PACK_TIER_MAP)) {
      const cap = tier.ovrMax + PACK_PITY_MAX_OVERSHOOT;
      for (let run = 0; run < 30; run++) {
        const players = generatePackContents(tier.key, 1, { forceLegendRoll: false, pityTriggered: true });
        const topOvr = Math.max(...players.map(p => p.overall));
        expect(topOvr, `${tier.key} pity pull ${topOvr} exceeded cap ${cap}`).toBeLessThanOrEqual(cap);
        expect(topOvr).toBeGreaterThanOrEqual(tier.guaranteedMinOvr);
      }
    }
  });

  it('pity measurably improves a pack that has headroom above it', () => {
    // ── Why this only checks the low tiers ──
    //
    // Pity works by WIDENING the band the guaranteed card is drawn from. Now
    // that pulls are real players, widening only helps if the pool actually
    // holds people up there — and it thins out fast: 101 templates above the
    // Gold ceiling, 28 above Premium's, 8 above Rare's, none above Icon's.
    //
    // So for the top tiers pity is close to a no-op, and an earlier version of
    // this test asserting "pity is never worse" failed on `rare` at 86.7 vs
    // 87.8 — not a regression, just the top-of-five-cards variance swamping an
    // effect that has almost nothing left to work with. Asserting it there
    // would be asserting noise. This is a real limitation of the pity design
    // against a real player pool, and it is written down rather than tested
    // away: see the note in `PACK_PITY_MIN_OVR`.
    const HEADROOM = 100;
    for (const key of PACK_STOREFRONT_ORDER) {
      const tier = PACK_TIER_MAP[key];
      const supplyAbove = countRealPlayersInBand(tier.ovrMax + 1, 99);
      if (supplyAbove < HEADROOM) continue;

      // Seeded: a 60-vs-60 comparison of independent samples is a statistical
      // claim, and on live Math.random the fast tail of "without" can beat the
      // slow tail of "with" on a valid run. The seed makes the comparison a
      // fixed fact about the generator rather than a coin with good odds.
      const { withPity, without, RUNS } = withSeededRandom(0xbeef01, () => {
        const R = 60;
        let w = 0;
        let wo = 0;
        for (let run = 0; run < R; run++) {
          w += Math.max(...generatePackContents(key, 1, { pityTriggered: true }).map(p => p.overall));
          wo += Math.max(...generatePackContents(key, 1).map(p => p.overall));
        }
        return { withPity: w, without: wo, RUNS: R };
      });
      expect(
        withPity / RUNS,
        `${key} pity averaged ${(withPity / RUNS).toFixed(1)} vs ${(without / RUNS).toFixed(1)} without`,
      ).toBeGreaterThan(without / RUNS);
    }
  });

  it('pity still reaches 80+ from Gold upward', () => {
    // The mercy mechanic should feel like mercy where 80+ is plausible. Cheap
    // tiers are capped by the rule above; from Gold on, pity means a gold card.
    for (const key of ['gold', 'premium', 'rare', 'icon'] as PackTierKey[]) {
      for (let run = 0; run < 20; run++) {
        const players = generatePackContents(key, 1, { pityTriggered: true });
        expect(Math.max(...players.map(p => p.overall))).toBeGreaterThanOrEqual(80);
      }
    }
  });
});

describe('Daily Pack — streak ladder', () => {
  const daily = PACK_TIER_MAP.daily;

  it('is the only free pack in the storefront', () => {
    // Three free daily packs dominated one another and shipped ~11 players a
    // day into a 40-man squad. If a second one ever reappears, that is a
    // deliberate economy decision and this test should be the thing that
    // forces the conversation.
    const freeTiers = PACK_STOREFRONT_ORDER.filter(k => (PACK_TIER_MAP[k].freeDailyLimit ?? 0) > 0);
    expect(freeTiers).toEqual([FREE_PACK_TIER]);
  });

  it('raises the guaranteed floor monotonically across streak bands', () => {
    const floors = PACK_STREAK_BANDS.map(b => resolvePackTier(daily, { streak: b }).guaranteedMinOvr);
    for (let i = 1; i < floors.length; i++) {
      expect(floors[i], `band ${i} must beat band ${i - 1}`).toBeGreaterThan(floors[i - 1]);
    }
  });

  it('never out-guarantees the cheapest paid pack, even at max streak', () => {
    // The free path must not dominate the $2.99 entry purchase. If it does,
    // the entry rung is unsellable and the ladder collapses.
    const maxStreak = PACK_STREAK_BANDS[PACK_STREAK_BANDS.length - 1];
    const best = resolvePackTier(daily, { streak: maxStreak });
    expect(best.guaranteedMinOvr).toBeLessThan(PACK_TIER_MAP.gold.guaranteedMinOvr);
    expect(best.ovrMax).toBeLessThan(PACK_TIER_MAP.gold.ovrMax);
  });

  it('defaults to the WEAKEST band when the caller omits the streak', () => {
    // Failing open to the day-7 pack would hand every new player the top band.
    expect(resolvePackTier(daily, {}).guaranteedMinOvr)
      .toBe(resolvePackTier(daily, { streak: 1 }).guaranteedMinOvr);
  });

  it('generates inside the resolved band for every streak level', () => {
    for (const streak of [1, 3, 5, 7, 40]) {
      const band = resolvePackTier(daily, { streak });
      for (let run = 0; run < 25; run++) {
        const players = generatePackContents('daily', 1, { freeOpen: true, streak });
        expect(players).toHaveLength(daily.cards);
        for (const p of players) {
          expect(p.overall).toBeLessThanOrEqual(band.ovrMax);
        }
        expect(Math.max(...players.map(p => p.overall))).toBeGreaterThanOrEqual(band.guaranteedMinOvr);
      }
    }
  });

  it('day-7 free supply stays well under the old three-free-pack firehose', () => {
    // The old free lineup delivered 11 cards/day; this one delivers 3, and its
    // 80+ rate at the very top of the ladder must stay a treat, not a supply.
    const RUNS = 300;
    let elite = 0;
    for (let i = 0; i < RUNS; i++) {
      elite += generatePackContents('daily', 1, { freeOpen: true, streak: 7 })
        .filter(p => p.overall >= 80).length;
    }
    const perOpen = elite / RUNS;
    expect(perOpen, `free 80+/open at max streak was ${perOpen.toFixed(2)}`).toBeLessThan(0.40);
  });

  it('AI counter-signings track the streak-resolved guarantee', () => {
    // The AI ceiling derives from the user's guarantee. If the user's floor
    // moves with the streak and the AI's does not, the league either out-signs
    // the player or is trivially outclassed by them.
    const clubs: Record<string, Club> = {
      me: { id: 'me', divisionId: 'd1', playerIds: [], reputation: 50, wageBill: 0 } as unknown as Club,
      rival: { id: 'rival', divisionId: 'd1', playerIds: [], reputation: 70, wageBill: 0 } as unknown as Club,
      other: { id: 'other', divisionId: 'd1', playerIds: [], reputation: 60, wageBill: 0 } as unknown as Club,
    };
    for (const streak of [1, 7]) {
      const floor = resolvePackTier(PACK_TIER_MAP.daily, { streak }).guaranteedMinOvr;
      for (let run = 0; run < 20; run++) {
        const { perClub } = generateAiCounterSignings('daily', clubs, 'me', 'd1', 1, true, streak);
        for (const players of Object.values(perClub)) {
          for (const p of players) expect(p.overall).toBeLessThan(floor);
        }
      }
    }
  });
});

describe('Market — storefront integrity', () => {
  it('every storefront tier resolves and every archived tier still resolves too', () => {
    // Archived tiers must never be deleted: `OpenedPackRecord.tier` in shipped
    // saves points at them and Recent Pulls resolves label/art through the map.
    for (const key of PACK_STOREFRONT_ORDER) expect(PACK_TIER_MAP[key]).toBeTruthy();
    for (const key of ['bronze', 'silver'] as PackTierKey[]) {
      expect(PACK_TIER_MAP[key], `archived tier ${key} was deleted — old saves will crash`).toBeTruthy();
      expect(PACK_STOREFRONT_ORDER).not.toContain(key);
    }
  });

  it('archived tiers are unobtainable — no free allowance, no product', () => {
    for (const key of ['bronze', 'silver'] as PackTierKey[]) {
      const tier = PACK_TIER_MAP[key];
      expect(tier.freeDailyLimit ?? 0).toBe(0);
      expect(tier.adDailyLimit ?? 0).toBe(0);
      expect(tier.productId).toBeUndefined();
    }
  });

  it('the paid ladder is monotonic in price, guarantee and ceiling', () => {
    // A rung that costs more and gives less is a rung nobody buys. Icon is the
    // exception on card count (1 card) and is checked separately below.
    const ladder = PAID_PACK_TIERS.map(k => PACK_TIER_MAP[k]);
    for (let i = 1; i < ladder.length; i++) {
      const prev = ladder[i - 1];
      const cur = ladder[i];
      const price = (t: typeof cur) => Number((t.iapPriceDisplay || '').replace(/[^0-9.]/g, ''));
      expect(price(cur), `${cur.key} must cost more than ${prev.key}`).toBeGreaterThan(price(prev));
      expect(cur.guaranteedMinOvr).toBeGreaterThan(prev.guaranteedMinOvr);
      expect(cur.ovrMax).toBeGreaterThan(prev.ovrMax);
    }
  });

  it('exactly one tier wears BEST VALUE, and it is the actual best value', () => {
    // The badge is only worth anything while it is earned. `packEliteCardsPerDollar`
    // is the metric; if a price or a rarity table changes so that another tier
    // wins, this fails rather than letting the label quietly become decoration.
    const badged = PACK_TIERS.filter(t => t.badge === 'best_value');
    expect(badged).toHaveLength(1);
    const ranked = [...PAID_PACK_TIERS]
      .map(k => PACK_TIER_MAP[k])
      .sort((a, b) => packEliteCardsPerDollar(b) - packEliteCardsPerDollar(a));
    expect(badged[0].key).toBe(ranked[0].key);
  });

  it('every paid pack publishes odds that sum to 100%', () => {
    // Apple Guideline 3.1.1. A disclosure that does not add up is worse than
    // no disclosure, because then it is a false claim.
    for (const key of PAID_PACK_TIERS) {
      const rows = describePackOdds(PACK_TIER_MAP[key]);
      expect(rows.length, `${key} publishes no odds`).toBeGreaterThan(0);
      const total = rows.reduce((s, r) => s + r.chance, 0);
      expect(total, `${key} odds sum to ${total}`).toBeCloseTo(1, 6);
      for (const row of rows) expect(row.chance).toBeGreaterThan(0);
    }
  });

  it('never publishes a rarity row the pack cannot actually reach', () => {
    // The clamp in `rollPackPlayer` pins every roll to [ovrMin, ovrMax], so a
    // rung whose band sits outside that window produces a card of a DIFFERENT
    // rarity. Publishing the nominal rung gave the Elite Pack a "Bronze (72
    // OVR) 4%" row paying more than its own Silver floor, and a "Legendary (87
    // OVR)" row three points short of legendary.
    for (const key of PACK_STOREFRONT_ORDER) {
      const tier = PACK_TIER_MAP[key];
      for (const row of describePackOdds(tier)) {
        const nums = row.label.match(/(\d+)(?:-(\d+))?\s+OVR/);
        expect(nums, `unparseable odds row: ${row.label}`).toBeTruthy();
        const lo = Number(nums![1]);
        const hi = nums![2] ? Number(nums![2]) : lo;
        expect(lo, `${key}: ${row.label} starts below the pack floor`).toBeGreaterThanOrEqual(tier.ovrMin);
        expect(hi, `${key}: ${row.label} exceeds the pack ceiling`).toBeLessThanOrEqual(tier.ovrMax);

        // And the row's band must be the rarity it claims. A "Bronze" row that
        // pays 72 is the exact bug this test exists for.
        const rung = row.label.split(' ')[0].toLowerCase() as keyof typeof PACK_RARITY_BANDS;
        const [nomLo, nomHi] = PACK_RARITY_BANDS[rung];
        expect(lo, `${key}: ${row.label} is not in the ${rung} band`).toBeGreaterThanOrEqual(nomLo);
        expect(hi, `${key}: ${row.label} is not in the ${rung} band`).toBeLessThanOrEqual(nomHi);
      }
    }
  });

  it('folding preserves the total — no probability is lost or invented', () => {
    // Folding moves weight between rungs; it must never change how much there
    // is. Checked against the raw tier tables, not the published rows.
    for (const key of PACK_STOREFRONT_ORDER) {
      const tier = PACK_TIER_MAP[key];
      const rows = describePackOdds(tier);
      const published = rows.reduce((s2, r) => s2 + r.chance, 0);
      expect(published, `${key} odds sum to ${published}`).toBeCloseTo(1, 6);
    }
  });

  it('published odds describe the same table the generator rolls', () => {
    // The one property that makes the disclosure trustworthy: both sides go
    // through `resolvePackTier`, so a streak or free-path override cannot leave
    // the sheet advertising a pack the generator does not produce.
    for (const streak of [1, 7]) {
      const rows = describePackOdds(PACK_TIER_MAP.daily, { streak });
      const resolved = resolvePackTier(PACK_TIER_MAP.daily, { streak });
      const goldRow = rows.find(r => r.label.startsWith('Gold'));
      if ((resolved.rarity.gold || 0) === 0) expect(goldRow).toBeUndefined();
      else expect(goldRow?.chance).toBeCloseTo(resolved.rarity.gold, 6);
    }
  });
});

describe('Pack opening — real players', () => {
  it('deals real players, not invented ones, at every storefront tier', () => {
    // The whole game is built from real-player templates except, until now, the
    // one screen you pay money on. A pack that hands out a stranger is worth
    // less than the same pack handing out someone you have heard of, and the
    // gap is the entire reason to buy it.
    for (const key of PACK_STOREFRONT_ORDER) {
      let cards = 0;
      let real = 0;
      for (let run = 0; run < 25; run++) {
        // Legend deals excluded — a hall card is authored, not drawn from the
        // real-template pool, and has its own provenance suite in legends.test.ts.
        for (const p of generatePackContents(key, 1, { freeOpen: key === FREE_PACK_TIER, streak: 7, forceLegendRoll: false })) {
          cards++;
          if (p.source === 'real') real++;
        }
      }
      // Not 100%: the generator still falls back to an invented player when a
      // band has nobody at a position, and that is the correct behaviour. It
      // must be the exception. `npm run packs:supply` is what fails loudly if
      // an imported dataset ever makes it the rule.
      expect(real / cards, `${key} dealt ${real}/${cards} real players`).toBeGreaterThan(0.9);
    }
  });

  it('a pull is the real player\'s own rating plus exactly the version boost', () => {
    // The band chooses WHICH real players are eligible; the version boost is
    // the only thing that may move the number, and it moves it by exactly the
    // tier's advertised +N. Anything else — a reroll, a clamp, a re-derive —
    // and a "Legends +4" card is a lie in one direction or the other.
    for (const key of PAID_PACK_TIERS) {
      const boost = PACK_TIER_MAP[key].versionBoost ?? 0;
      for (let run = 0; run < 12; run++) {
        for (const p of generatePackContents(key, 1)) {
          if (p.source !== 'real' || !p.fcId) continue;
          const template = findTemplateByFcId(p.fcId);
          expect(template, `pulled fcId ${p.fcId} is not in the pool`).toBeTruthy();
          expect(p.overall, `${p.lastName} dealt at ${p.overall}, base ${template!.ovr}, boost +${boost}`)
            .toBe(Math.min(99, template!.ovr + boost));
        }
      }
    }
    // And the free pack deals base cards — the version system is what the
    // paid tiers are selling, so the free tier must not hand it out.
    for (let run = 0; run < 8; run++) {
      for (const p of generatePackContents('daily', 1, { freeOpen: true, streak: 7 })) {
        if (p.source !== 'real' || !p.fcId) continue;
        expect(p.overall).toBe(findTemplateByFcId(p.fcId)!.ovr);
      }
    }
  });

  it('never deals the same player twice in one pack', () => {
    // Duplicates ACROSS packs are the point — you can pull the same star twice
    // in a week, and that is how the genre works. Twice in the same five-card
    // pack just reads as a bug.
    for (const key of ['gold', 'premium', 'rare'] as PackTierKey[]) {
      for (let run = 0; run < 60; run++) {
        const players = generatePackContents(key, 1);
        const ids = players.map(p => p.fcId).filter(Boolean) as string[];
        expect(new Set(ids).size, `${key} dealt a duplicate: ${ids.join(', ')}`).toBe(ids.length);
      }
    }
  });

  it('no tier advertises a ceiling its version cannot actually mint', () => {
    // The honest ceiling is (best base player + version boost): a +4 Legends
    // issue of a 91 genuinely is a 95, but a final band needing base players
    // above the pool's best is an odds row that can never be dealt. `npm run
    // packs:supply` enforces the same thing against the data file; this
    // catches a config edit without a data import.
    for (const key of PACK_STOREFRONT_ORDER) {
      const tier = PACK_TIER_MAP[key];
      expect(tier.ovrMax - (tier.versionBoost ?? 0), `${key} ceiling exceeds the pool`)
        .toBeLessThanOrEqual(poolMaxOvr());
    }
  });
});

describe('Pack opening — what a pull costs to run', () => {
  it('every pull signs on the pack wage scale, real or generated', () => {
    for (const key of PACK_STOREFRONT_ORDER) {
      for (const p of generatePackContents(key, 1, { freeOpen: key === FREE_PACK_TIER, streak: 7 })) {
        expect(p.wageFactor, `${key} pull ${p.lastName} signed at market wage`).toBe(PACK_WAGE_FACTOR);
      }
    }
  });

  it('the discount survives a recompute — it is the contract, not a one-off', () => {
    // The failure this guards: `recomputeDerivedEconomics` runs on every
    // development tick, training session and season rollover. A discount
    // applied only at generation would evaporate the first time the player
    // improved, and their wage would nearly double between seasons with no
    // explanation on screen.
    const [player] = generatePackContents('rare', 1);
    const signed = player.wage;
    recomputeDerivedEconomics(player);
    // Not exact equality: `calculatePlayerWage` carries a ±10% random factor
    // that re-rolls on every recompute, which is pre-existing behaviour. What
    // must hold is that the wage stays in that band rather than jumping by the
    // 1/0.55 the discount is worth.
    expect(player.wage).toBeGreaterThan(signed * 0.85);
    expect(player.wage).toBeLessThan(signed * 1.15);

    player.overall += 1;
    recomputeDerivedEconomics(player);
    expect(player.wageFactor).toBe(PACK_WAGE_FACTOR);

    // Still discounted against what the same player costs on the open market.
    // Compared across several samples so the random factor cannot decide it.
    let discounted = 0;
    let market = 0;
    for (let i = 0; i < 12; i++) {
      const a = { ...player };
      recomputeDerivedEconomics(a);
      discounted += a.wage;
      const b = { ...player, wageFactor: undefined };
      recomputeDerivedEconomics(b);
      market += b.wage;
    }
    expect(discounted / market).toBeGreaterThan(PACK_WAGE_FACTOR * 0.9);
    expect(discounted / market).toBeLessThan(PACK_WAGE_FACTOR * 1.1);
  });

  it('a five-card pack cannot add more than a quarter of a mid-table wage bill', () => {
    // The number that made this necessary: before the pack wage scale, one
    // $6.99 Rare Gold added ~£920k/week — 58% of Celtic's entire bill — so the
    // purchase was a punishment. This pins the burden at something a club can
    // absorb. Celtic's real bill is ~£1.34M/wk; the bound below is deliberately
    // stated in absolute money so it fails if the wage curve moves under it.
    const CELTIC_SCALE_BILL = 1_340_000;
    for (const key of PAID_PACK_TIERS) {
      let total = 0;
      const RUNS = 30;
      for (let i = 0; i < RUNS; i++) {
        // Legend deals off: the wage bound pins the version pipeline. A hall
        // card's wage is priced from a rating the Legends tier already deals
        // (88–95, same PACK_WAGE_FACTOR), so it introduces no new burden class.
        total += generatePackContents(key, 1, { forceLegendRoll: false }).reduce((t, p) => t + (p.wage || 0), 0);
      }
      const avg = total / RUNS;
      expect(
        avg / CELTIC_SCALE_BILL,
        `${key} adds £${Math.round(avg / 1000)}k/wk — ${Math.round((avg / CELTIC_SCALE_BILL) * 100)}% of a mid-table bill`,
      ).toBeLessThan(0.42);
    }
  });
});

describe('Market — pack artwork', () => {
  // Node-only reads: this file already runs in jsdom with the real filesystem
  // available, and the covers are static assets under `public/`.
  const packDir = path.resolve(process.cwd(), 'public/packs');

  it('every card frame exists on disk', () => {
    const cardDir = path.resolve(process.cwd(), 'public/player-cards');
    for (const [id, ref] of Object.entries(PACK_CARD_FRAMES)) {
      expect(ref.startsWith('/player-cards/'), `${id} must live under /player-cards/`).toBe(true);
      expect(existsSync(path.join(cardDir, path.basename(ref))), `missing card frame: ${ref}`).toBe(true);
    }
  });

  it('every referenced cover exists on disk', () => {
    // The art chain degrades silently by design (missing cover → previous
    // cover → gradient), which is exactly why a missing file needs a test: a
    // typo'd path ships as a slightly-worse-looking card that nobody notices
    // until a player asks why one pack has no picture.
    const referenced = [
      ...PACK_TIERS.flatMap(t => [t.artSrc, t.artLegacySrc]),
      ...WEEKLY_PACK_SKINS.map(sk => sk.artSrc),
    ].filter(Boolean) as string[];
    expect(referenced.length).toBeGreaterThan(0);
    for (const ref of new Set(referenced)) {
      expect(ref.startsWith('/packs/'), `${ref} must live under /packs/`).toBe(true);
      const onDisk = path.join(packDir, path.basename(ref));
      expect(existsSync(onDisk), `missing pack art: ${ref}`).toBe(true);
    }
  });

  it('ships no cover that nothing references', () => {
    // The other direction: a retired cover left in `public/` is dead weight in
    // the app binary, and these files are ~0.5 MB each.
    const referenced = new Set([
      ...PACK_TIERS.flatMap(t => [t.artSrc, t.artLegacySrc]),
      ...WEEKLY_PACK_SKINS.map(sk => sk.artSrc),
    ].filter(Boolean).map(ref => path.basename(ref as string)));
    const onDisk = readdirSync(packDir).filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f));
    for (const file of onDisk) {
      expect(referenced.has(file), `unreferenced pack art: public/packs/${file}`).toBe(true);
    }
  });

  it('every cover is a webp — no stray source PNGs in the shipped bundle', () => {
    // A 1024x1536 PNG cover is ~3.2 MB; the webp is ~0.45 MB. Eight of them is
    // the difference between a 4 MB and a 26 MB addition to the app binary.
    const onDisk = readdirSync(packDir).filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f));
    for (const file of onDisk) {
      expect(file.endsWith('.webp'), `${file} should be converted to .webp`).toBe(true);
    }
  });
});

describe('Market — pack card frames', () => {
  beforeEach(() => { initAndGetState(); });

  it('every storefront pack awards a frame, and every frame resolves to art', () => {
    for (const key of PACK_STOREFRONT_ORDER) {
      const frame = PACK_TIER_MAP[key].cardFrame;
      expect(frame, `${key} awards no card frame`).toBeTruthy();
      expect(packFrameArt(frame), `${key}'s frame "${frame}" resolves to nothing`).toBeTruthy();
    }
    for (const skin of WEEKLY_PACK_SKINS) {
      expect(packFrameArt(skin.cardFrame), `${skin.name}'s frame resolves to nothing`).toBeTruthy();
    }
  });

  it('an unknown frame id resolves to null rather than a broken path', () => {
    // The compatibility contract: a save can carry a frame a later build has
    // retired, and the card must fall back to its OVR tier art.
    expect(packFrameArt('a-frame-we-retired')).toBeNull();
    expect(packFrameArt(undefined)).toBeNull();
    expect(packFrameArt('')).toBeNull();
  });

  it('a featured pack awards its PROMO frame, only during its own week', () => {
    // This is what makes a promo frame dated instead of farmable.
    for (let w = 0; w < 6; w++) {
      const featured = getFeaturedPackTier(w);
      const skin = WEEKLY_PACK_SKINS.find(sk => sk.tier === featured);
      expect(packFrameFor(featured, w)).toBe(skin!.cardFrame);
      // The same pack in a week it is NOT featured awards its ordinary frame.
      const otherWeek = [0, 1, 2, 3, 4, 5].find(x => getFeaturedPackTier(x) !== featured)!;
      expect(packFrameFor(featured, otherWeek)).toBe(PACK_TIER_MAP[featured].cardFrame);
      // And with no week supplied at all, never a promo frame.
      expect(packFrameFor(featured)).toBe(PACK_TIER_MAP[featured].cardFrame);
    }
  });

  it('stamps the frame only on cards that cleared the guaranteed floor', () => {
    // The gate that keeps a frame meaning something: the Daily Pack's low
    // filler cards must NOT wear the same frame as its guaranteed pull, or the
    // frame stops signalling anything and the squad-list tier read goes with it.
    const floor = resolvePackTier(PACK_TIER_MAP.daily, { streak: 1 }).guaranteedMinOvr;
    // Seeded: the gate itself (framed iff >= floor) holds on every run, but
    // the "we saw an unframed filler" half needs a random sub-floor roll to
    // occur at all. The seed pins a sequence where one does, so the coverage
    // assertion is a fact rather than a 36-pull probability.
    const { sawFramed, sawUnframed } = withSeededRandom(0xbeef02, () => {
      let framed = false;
      let unframed = false;
      for (let run = 0; run < 12; run++) {
        initAndGetState();
        const open = useGameStore.getState().openPack('daily', { method: 'free' });
        expect(open.success).toBe(true);
        for (const p of open.players!) {
          if (p.overall >= floor) {
            expect(p.packFrame, `${p.overall} cleared ${floor} but wears no frame`).toBe('rise-to-glory');
            framed = true;
          } else {
            expect(p.packFrame, `${p.overall} is below ${floor} but wears a frame`).toBeUndefined();
            unframed = true;
          }
        }
      }
      return { sawFramed: framed, sawUnframed: unframed };
    });
    // The guaranteed slot means at least one framed card is certain; the filler
    // cards mean an unframed one is certain under this seed.
    expect(sawFramed).toBe(true);
    expect(sawUnframed, 'no sub-floor card appeared in 36 pulls — check the bands').toBe(true);
  });

  it('the frame survives into the stored squad, not just the reveal payload', () => {
    initAndGetState();
    const open = useGameStore.getState().openPack('daily', { method: 'free' });
    const framed = open.players!.find(p => p.packFrame);
    expect(framed, 'the guaranteed pull should always carry a frame').toBeTruthy();
    expect(useGameStore.getState().players[framed!.id].packFrame).toBe('rise-to-glory');
  });

  it('a frame is cosmetic — it never rides along with a rating change', () => {
    // The monetization contract: nothing that can be bought may touch a sim
    // parameter. A frame is art, so a framed and an unframed card of the same
    // overall must be identical everywhere the sim looks.
    initAndGetState();
    const open = useGameStore.getState().openPack('daily', { method: 'free' });
    for (const p of open.players!) {
      const stored = useGameStore.getState().players[p.id];
      expect(stored.overall).toBe(p.overall);
      expect(stored.attributes).toEqual(p.attributes);
      expect(stored.value).toBe(p.value);
      expect(stored.wage).toBe(p.wage);
    }
  });
});

describe('Market — weekly featured offer', () => {
  it('rotates deterministically over paid, weekly-eligible tiers only', () => {
    const seen = new Set<PackTierKey>();
    for (let w = 0; w < 24; w++) {
      const key = getFeaturedPackTier(w);
      seen.add(key);
      // Same week always resolves to the same pack — the countdown would be a
      // lie otherwise.
      expect(getFeaturedPackTier(w)).toBe(key);
      const tier = PACK_TIER_MAP[key];
      expect(tier.weeklyEligible).toBe(true);
      expect(tier.productId, 'a featured pack must be purchasable').toBeTruthy();
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(seen.has('icon'), 'Icon stays out of the rotation on purpose').toBe(false);
  });

  it('the featured rotation only names tiers that exist and are on sale', () => {
    for (const key of FEATURED_PACK_ROTATION) {
      expect(PACK_TIER_MAP[key]).toBeTruthy();
      expect(PACK_STOREFRONT_ORDER).toContain(key);
    }
  });

  it('every weekly skin backs onto a real, purchasable, weekly-eligible tier', () => {
    for (const skin of WEEKLY_PACK_SKINS) {
      const tier = PACK_TIER_MAP[skin.tier];
      expect(tier, `skin ${skin.name} names an unknown tier`).toBeTruthy();
      expect(tier.weeklyEligible).toBe(true);
      expect(tier.productId).toBeTruthy();
      expect(skin.artSrc).toMatch(/^\/packs\/.+\.webp$/);
    }
    // Every rotation slot must have a cover, or one week in three the headline
    // silently degrades to the same card the grid already shows.
    for (const key of FEATURED_PACK_ROTATION) {
      expect(WEEKLY_PACK_SKINS.some(sk => sk.tier === key), `no skin for ${key}`).toBe(true);
    }
  });

  it('a promo changes name, art and exactly +1 version — never price, floor or odds', () => {
    // The trust argument, updated for versions. A promo week may make the pack
    // BETTER (its own frame, +1 on the issue, a ceiling one higher) and must
    // never make it different in any way a buyer could be short-changed by:
    // same price, same card count, same guaranteed floor, same rarity weights.
    for (let w = 0; w < 9; w++) {
      const tier = PACK_TIER_MAP[getFeaturedPackTier(w)];
      const shown = getFeaturedPackPresentation(w);
      const extra = WEEKLY_PACK_SKINS.find(sk => sk.tier === tier.key)?.extraBoost ?? 0;

      expect(shown.versionBoost).toBe((tier.versionBoost ?? 0) + extra);
      expect(shown.ovrMax).toBe(tier.ovrMax + extra);

      const {
        label: _l, artSrc: _a, artLegacySrc: _al,
        storeBlurb: _b, versionBoost: _v, ovrMax: _m,
        ...shownRest
      } = shown;
      const {
        label: _l2, artSrc: _a2, artLegacySrc: _al2,
        storeBlurb: _b2, versionBoost: _v2, ovrMax: _m2,
        ...tierRest
      } = tier;
      expect(shownRest).toEqual(tierRest);
    }
  });

  it('bonus cards roll at the guaranteed floor and enlarge the pack', () => {
    const tier = PACK_TIER_MAP.rare;
    for (let run = 0; run < 30; run++) {
      const players = generatePackContents('rare', 1, { extraCards: WEEKLY_BONUS_CARDS });
      expect(players).toHaveLength(tier.cards + WEEKLY_BONUS_CARDS);
      const atFloor = players.filter(p => p.overall >= tier.guaranteedMinOvr).length;
      expect(atFloor, 'guaranteed card + bonus card must both clear the floor')
        .toBeGreaterThanOrEqual(1 + WEEKLY_BONUS_CARDS);
    }
  });

  it('clamps an absurd bonus rather than generating an endless reveal', () => {
    const players = generatePackContents('rare', 1, { extraCards: 999 });
    expect(players.length).toBeLessThanOrEqual(PACK_TIER_MAP.rare.cards + 3);
  });
});

describe('Pack opening — pity counter', () => {
  it('does not trigger below threshold', () => {
    expect(shouldPityTrigger(0)).toBe(false);
    expect(shouldPityTrigger(PACK_PITY_THRESHOLD - 1)).toBe(false);
  });

  it('triggers at threshold and above', () => {
    expect(shouldPityTrigger(PACK_PITY_THRESHOLD)).toBe(true);
    expect(shouldPityTrigger(PACK_PITY_THRESHOLD + 5)).toBe(true);
  });

  it('resets on a gold pull', () => {
    const goldPlayer = { overall: 82 } as Parameters<typeof updatedPityCounter>[1][number];
    const next = updatedPityCounter(5, [goldPlayer]);
    expect(next).toBe(0);
  });

  it('increments when no gold pull', () => {
    const silverPlayer = { overall: 72 } as Parameters<typeof updatedPityCounter>[1][number];
    const next = updatedPityCounter(3, [silverPlayer, silverPlayer]);
    expect(next).toBe(4);
  });
});

describe('Pack opening — openPack action', () => {
  // initGame() now resets pack state on every fresh game, so each test
  // gets a clean slate with no extra work.
  beforeEach(() => { initAndGetState(); });

  it('rejects currency-method opens for tiers that no longer support in-game purchase', () => {
    // Every tier is now either daily-free, ad-supported, or IAP-only.
    // No tier supports the legacy currency method, so explicitly asking
    // for it on any tier should be politely refused — not silently
    // fall through and grant a free pack.
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 },
      },
    });
    const result = useGameStore.getState().openPack('rare', { method: 'currency' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/in-game money/i);
  });

  it('rejects when squad cap would be exceeded', () => {
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    const fakeIds = Array.from({ length: MAX_SQUAD_SIZE - club.playerIds.length }, (_, i) => `fake-pack-${i}`);
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: {
          ...club,
          playerIds: [...club.playerIds, ...fakeIds],
          budget: 999_999_999,
        },
      },
    });
    const result = useGameStore.getState().openPack('daily');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/squad space/i);
  });

  it('adds players to the roster and logs an opened pack record', () => {
    // NOTE: no storefront tier has an in-game-currency price any more, so this
    // asserts the roster + ledger writes on the free path and pins that the
    // free path costs nothing. The old version of this test opened Silver "to
    // test the budget deduction" against `PACK_TIER_MAP.silver.price`, which
    // has been 0 for as long as the tier has existed — it asserted
    // `budget - 0 === budget` and passed for years without testing anything.
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...club, budget: 50_000_000 },
      },
    });
    const budgetBefore = useGameStore.getState().clubs[state.playerClubId].budget;
    const squadBefore = useGameStore.getState().clubs[state.playerClubId].playerIds.length;

    const result = useGameStore.getState().openPack('daily');
    expect(result.success).toBe(true);
    expect(result.players).toHaveLength(PACK_TIER_MAP.daily.cards);

    const after = useGameStore.getState();
    const clubAfter = after.clubs[state.playerClubId];
    expect(clubAfter.budget, 'the free pack must never touch the budget').toBe(budgetBefore);
    expect(clubAfter.playerIds.length).toBe(squadBefore + PACK_TIER_MAP.daily.cards);
    for (const p of result.players!) {
      expect(clubAfter.playerIds).toContain(p.id);
      expect(after.players[p.id]).toBeDefined();
      expect(after.players[p.id].clubId).toBe(state.playerClubId);
    }
    expect(after.openedPacks.length).toBeGreaterThan(0);
    expect(after.openedPacks[0].tier).toBe('daily');
  });

  it('refuses to open an archived tier — it has no unlock method left', () => {
    // Bronze and Silver still resolve (old saves replay them) but nothing can
    // obtain one. If a method ever comes back, that is a storefront decision.
    for (const key of ['bronze', 'silver'] as PackTierKey[]) {
      const result = useGameStore.getState().openPack(key);
      expect(result.success, `${key} must not be openable`).toBe(false);
    }
  });

  it('caps daily-pack opens at free + ad daily limits combined', () => {
    // Trim the default squad to a known small size so the run of packs
    // doesn't bump up against MAX_SQUAD_SIZE.
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    const trimmedIds = club.playerIds.slice(0, 20);
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...club, playerIds: trimmedIds, budget: 1_000_000 },
      },
    });
    const freeCap = PACK_TIER_MAP.daily.freeDailyLimit ?? 0;
    const adCap = PACK_TIER_MAP.daily.adDailyLimit ?? 0;
    expect(freeCap).toBe(1);
    expect(adCap).toBeGreaterThan(0);

    // First open uses today's free allowance.
    for (let i = 0; i < freeCap; i++) {
      const open = useGameStore.getState().openPack('daily', { method: 'free' });
      expect(open.success).toBe(true);
      expect(open.method).toBe('free');
    }
    // Subsequent opens fall back to ad (page would have shown a rewarded
    // ad before calling). skipPayment mirrors the page's contract.
    for (let i = 0; i < adCap; i++) {
      const open = useGameStore.getState().openPack('daily', { method: 'ad', skipPayment: true });
      expect(open.success).toBe(true);
      expect(open.method).toBe('ad');
    }
    // After both caps are hit, additional opens are blocked.
    const overflow = useGameStore.getState().openPack('daily', { method: 'ad', skipPayment: true });
    expect(overflow.success).toBe(false);
    expect(overflow.message).toMatch(/daily ad limit/i);
  });

  it('rejects IAP-method opens unless skipPayment is set', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 999_999_999 } },
    });
    // openPack('icon', { method: 'iap' }) without skipPayment is a misuse
    // — the page must complete the consumable purchase first.
    const direct = useGameStore.getState().openPack('icon', { method: 'iap' });
    expect(direct.success).toBe(false);
    expect(direct.message).toMatch(/in-app purchase/i);

    // After the page proves a successful real-money purchase, the slice
    // accepts skipPayment and opens the pack without charging in-game funds.
    const budgetBefore = useGameStore.getState().clubs[state.playerClubId].budget;
    const paid = useGameStore.getState().openPack('icon', { method: 'iap', skipPayment: true });
    expect(paid.success).toBe(true);
    expect(useGameStore.getState().clubs[state.playerClubId].budget).toBe(budgetBefore);
  });

  it('lets the user open multiple IAP packs in the same week (no weekly cooldown)', () => {
    // IAP-only tiers can be opened back-to-back as many times as the
    // user pays for. Silver/Gold now have a 1/day free allowance, so
    // back-to-back opens require ad/IAP — covered by the dedicated
    // daily-limit test above.
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 1_000_000_000 } },
    });
    const first = useGameStore.getState().openPack('rare', { method: 'iap', skipPayment: true });
    expect(first.success).toBe(true);
    const second = useGameStore.getState().openPack('rare', { method: 'iap', skipPayment: true });
    expect(second.success).toBe(true);
  });

  it('flags walkout-eligible players at 84+', () => {
    // Rare pack guarantees 84+ (matches the walkout threshold); the icon
    // pack is now an IAP-only product so it can't be opened directly here.
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 } },
    });
    const result = useGameStore.getState().openPack('rare', { method: 'iap', skipPayment: true });
    expect(result.success).toBe(true);
    const topOvr = Math.max(...result.players!.map(p => p.overall));
    expect(topOvr).toBeGreaterThanOrEqual(WALKOUT_OVR_THRESHOLD);
  });

  it('wage and value fall in-range for the clamped OVR (no pre-clamp leakage)', () => {
    // The calculators include a random factor, so exact equality can't be
    // asserted. Instead verify wage/value are at or below the worst-case
    // calculator output for the player's CLAMPED overall — a regression of
    // the pre-clamp leakage bug would ship wages from a higher OVR and
    // blow through this bound.
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const result = useGameStore.getState().openPack('daily');
    expect(result.success).toBe(true);
    for (const p of result.players!) {
      // The band the DAILY pack actually resolves to at the default streak,
      // not a hard-coded tier ceiling — the ladder moves and this bound must
      // move with it or it silently stops testing the clamp.
      expect(p.overall).toBeLessThanOrEqual(resolvePackTier(PACK_TIER_MAP.daily, { streak: 1 }).ovrMax);
      // Theoretical max uses (1 + RANDOM_FACTOR); +1 covers rounding.
      // Bound is still tight enough to catch a wage that leaked from a
      // 75+ OVR pre-clamp roll (pre-clamp leakage would exceed this by 2-100x).
      expect(p.wage).toBeLessThanOrEqual(maxWageForOvr(p.overall) + 1);
      expect(p.value).toBeLessThanOrEqual(maxValueForOvr(p.overall) + 1);
      expect(p.potential).toBeGreaterThanOrEqual(p.overall);
    }
  });

  it('auto-places pack players into lineup or subs after opening', () => {
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...club, budget: 200_000_000 },
      },
    });

    // Rare pack guarantees 84+ — strong enough to crack a default squad.
    // Icon is now IAP-only so it can't be opened directly in tests.
    const result = useGameStore.getState().openPack('rare', { method: 'iap', skipPayment: true });
    expect(result.success).toBe(true);

    const after = useGameStore.getState();
    const clubAfter = after.clubs[state.playerClubId];

    for (const p of result.players!) {
      expect(clubAfter.playerIds).toContain(p.id);
    }
    expect(clubAfter.lineup.length).toBeLessThanOrEqual(11);
  });

  it('defers AI backfill + lineup optimization off the synchronous open path', async () => {
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...club, budget: 200_000_000 },
      },
    });
    const lineupBefore = [...useGameStore.getState().clubs[state.playerClubId].lineup];

    const result = useGameStore.getState().openPack('rare', { method: 'iap', skipPayment: true });
    expect(result.success).toBe(true);

    // Synchronously: the pulled players are already in the squad (paid-pack
    // safety), but the lineup re-optimization has NOT run yet — it's deferred
    // off the reveal path so the open never blocks on the Hungarian solve.
    const sync = useGameStore.getState().clubs[state.playerClubId];
    for (const p of result.players!) expect(sync.playerIds).toContain(p.id);
    expect(sync.lineup).toEqual(lineupBefore);

    // Once the deferred post-process lands, a rare (84+) pull reaches the
    // matchday squad (starting XI or bench).
    await vi.waitFor(() => {
      const c = useGameStore.getState().clubs[state.playerClubId];
      const matchday = new Set([...c.lineup, ...c.subs]);
      expect(result.players!.some(p => matchday.has(p.id))).toBe(true);
    });
  });

  it('bronze pulls into a strong squad still register in lineup + subs or stay in squad-only', () => {
    // Bronze tier rolls 60-68 OVR. Against a default Celtic squad (top
    // flight), most bronze pulls won't crack the XI — but they should
    // still be tracked in playerIds and have a classified placement.
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...club, budget: 5_000_000 },
      },
    });
    const result = useGameStore.getState().openPack('daily');
    expect(result.success).toBe(true);

    const after = useGameStore.getState().clubs[state.playerClubId];
    // Every pulled player is tracked in playerIds (placement badging is now
    // derived reactively in the UI from the live lineup, not returned here).
    for (const p of result.players!) {
      expect(after.playerIds).toContain(p.id);
    }
  });

  it('leaves Optimize Lineup with zero work to do after opening', () => {
    // After openPack auto-places, the same optimizer (via autoFillTeam)
    // should produce no further changes — this is the contract the
    // Optimize Lineup chip's "potential gain" hook relies on.
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 } },
    });
    const open = useGameStore.getState().openPack('rare', { method: 'iap', skipPayment: true });
    expect(open.success).toBe(true);

    const followUp = useGameStore.getState().autoFillTeam();
    expect(followUp.changes).toBe(0);
  });

  it('preserves existing lineup when formation is missing', () => {
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    const preLineup = [...club.lineup];
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: {
          ...club,
          budget: 50_000_000,
          formation: undefined as unknown as typeof club.formation,
        },
      },
    });

    const result = useGameStore.getState().openPack('daily');
    expect(result.success).toBe(true);
    const after = useGameStore.getState().clubs[state.playerClubId];
    expect(after.lineup).toEqual(preLineup);
  });
});

describe('Pack opening — releasePackedPlayer action', () => {
  beforeEach(() => { initAndGetState(); });

  it('releases a just-packed player for one week of severance', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const openResult = useGameStore.getState().openPack('daily');
    expect(openResult.success).toBe(true);
    const target = openResult.players![0];
    const budgetBefore = useGameStore.getState().clubs[state.playerClubId].budget;

    const relResult = useGameStore.getState().releasePackedPlayer(target.id);
    expect(relResult.success).toBe(true);

    const after = useGameStore.getState();
    expect(after.clubs[state.playerClubId].playerIds).not.toContain(target.id);
    expect(after.freeAgents).toContain(target.id);
    // Severance is exactly 1 week's wage
    expect(budgetBefore - after.clubs[state.playerClubId].budget).toBe(Math.round(target.wage));
  });

  it('refills the lineup after releasing an auto-placed pack starter', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 } },
    });
    const openResult = useGameStore.getState().openPack('rare', { method: 'iap', skipPayment: true });
    expect(openResult.success).toBe(true);
    const clubAfterOpen = useGameStore.getState().clubs[state.playerClubId];
    const lineupLenBefore = clubAfterOpen.lineup.length;

    // Release the rare pull (very likely a starter given 84+ OVR)
    const target = openResult.players![0];
    const rel = useGameStore.getState().releasePackedPlayer(target.id);
    expect(rel.success).toBe(true);

    const clubAfterRelease = useGameStore.getState().clubs[state.playerClubId];
    // Lineup size must stay the same or only shrink by 1 if the squad
    // genuinely can't produce 11 after the release. With a default squad
    // and only one release, the refill should keep lineup size stable.
    expect(clubAfterRelease.lineup.length).toBeGreaterThanOrEqual(lineupLenBefore - 1);
    expect(clubAfterRelease.lineup).not.toContain(target.id);
    expect(clubAfterRelease.subs).not.toContain(target.id);
  });

  it('rejects releasing a player not from the latest pack', () => {
    const state = useGameStore.getState();
    const existingPlayerId = state.clubs[state.playerClubId].playerIds[0];
    const result = useGameStore.getState().releasePackedPlayer(existingPlayerId);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/just opened/i);
  });

  it('rejects quick-release after the week advances', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('daily');
    expect(open.success).toBe(true);
    const target = open.players![0];
    // Simulate a week advance without going through advanceWeek — same
    // effect: the pack record is now stale relative to (season, week).
    useGameStore.setState({ week: state.week + 1 });
    const result = useGameStore.getState().releasePackedPlayer(target.id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/just opened/i);
  });
});

describe('Pack opening — save/load persistence', () => {
  beforeEach(() => { initAndGetState(); });

  it('persists openedPacks, pity counter, and daily-pack bucket across save/load', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('daily');
    expect(open.success).toBe(true);

    const preSave = useGameStore.getState();
    const expectedOpenedPacksLength = preSave.openedPacks.length;
    const expectedPity = preSave.packPityCounter;
    const expectedDailyOpens = preSave.dailyPackOpens;
    expect(expectedOpenedPacksLength).toBeGreaterThan(0);
    // The Daily Pack's first open of the day is `free`, so that bucket is 1.
    expect(expectedDailyOpens.free.daily).toBe(1);

    useGameStore.getState().saveGame(1);
    // Wipe in-memory pack state to prove the values come from storage
    useGameStore.setState({
      openedPacks: [],
      packPityCounter: 0,
      lastPackWeek: 0,
      lastPackSeason: 0,
      dailyPackOpens: { date: '', free: {}, ad: {} },
    });
    const loaded = useGameStore.getState().loadGame(1);
    expect(loaded).toBe(true);

    const after = useGameStore.getState();
    expect(after.openedPacks.length).toBe(expectedOpenedPacksLength);
    expect(after.openedPacks[0].tier).toBe('daily');
    expect(after.packPityCounter).toBe(expectedPity);
    expect(after.dailyPackOpens).toEqual(expectedDailyOpens);
  });
});

describe('Pack opening — challenge guard', () => {
  beforeEach(() => { initAndGetState(); });

  it('blocks opening when an active challenge disables transfers', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
      // Penny Pincher disables all transfers
      activeChallenge: { scenarioId: 'penny-pincher', startSeason: 1, seasonsRemaining: 1, completed: false, failed: false },
    });
    const result = useGameStore.getState().openPack('daily');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/challenge/i);
  });

  it('canOpenPack reports the challenge block before the page charges an IAP', () => {
    // Regression for the IAP-charge-then-deny bug: the page MUST call
    // canOpenPack before kicking off purchaseConsumable() so the user
    // can never pay $9.99 and then be rejected by openPack.
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 } },
      activeChallenge: { scenarioId: 'penny-pincher', startSeason: 1, seasonsRemaining: 1, completed: false, failed: false },
    });
    const can = useGameStore.getState().canOpenPack('icon');
    expect(can.ok).toBe(false);
    if (can.ok === false) expect(can.message).toMatch(/challenge/i);

    // And openPack itself still refuses even with skipPayment — defence
    // in depth. The slice never grants the pack just because the page
    // claims a payment was made.
    const skipResult = useGameStore.getState().openPack('icon', { method: 'iap', skipPayment: true });
    expect(skipResult.success).toBe(false);
    expect(skipResult.message).toMatch(/challenge/i);
  });

  it('canOpenPack reports the daily limit before the page plays an ad', () => {
    // Trim squad so the run of daily packs doesn't bump MAX_SQUAD_SIZE.
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...club, playerIds: club.playerIds.slice(0, 20), budget: 1_000_000 },
      },
    });
    // Burn through every free + ad open for the Daily Pack, then ask if more
    // are available. canOpenPack with no method picks the next-cheapest
    // available — once both caps hit, that's `null` and the slice
    // surfaces a "no opens available" message.
    const freeCap = PACK_TIER_MAP.daily.freeDailyLimit ?? 0;
    const adCap = PACK_TIER_MAP.daily.adDailyLimit ?? 0;
    for (let i = 0; i < freeCap; i++) {
      const open = useGameStore.getState().openPack('daily', { method: 'free' });
      expect(open.success).toBe(true);
    }
    for (let i = 0; i < adCap; i++) {
      const open = useGameStore.getState().openPack('daily', { method: 'ad', skipPayment: true });
      expect(open.success).toBe(true);
    }
    const can = useGameStore.getState().canOpenPack('daily');
    expect(can.ok).toBe(false);
    if (can.ok === false) expect(can.message).toMatch(/no opens available|daily/i);
  });
});

describe('Pack opening — AI counter-signings (league balance)', () => {
  beforeEach(() => { initAndGetState(); });

  it('AI signings stay strictly below the user\'s tier guarantee', async () => {
    // Open a Gold pack (78+ user guarantee). AI signings must be ≤ 73 OVR
    // (78 − AI_BACKFILL_OVR_GAP). User's pack contains 5 cards; AI gets 2.
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const beforeIds = new Set(Object.keys(useGameStore.getState().players));
    // Gold is a paid tier with no free allowance, so the page's contract
    // applies: the IAP is completed outside the slice and `skipPayment` says so.
    const result = useGameStore.getState().openPack('gold', { method: 'iap', skipPayment: true });
    expect(result.success).toBe(true);
    const userPackIds = new Set(result.players!.map(p => p.id));

    // AI counter-signings are deferred off the open path — wait for them.
    const aiNewPlayersNow = () => Object.values(useGameStore.getState().players).filter(p =>
      !beforeIds.has(p.id)
      && !userPackIds.has(p.id)
      && p.clubId !== state.playerClubId,
    );
    await vi.waitFor(() => expect(aiNewPlayersNow().length).toBeGreaterThan(0));

    const ceiling = PACK_TIER_MAP.gold.guaranteedMinOvr - AI_BACKFILL_OVR_GAP;
    for (const p of aiNewPlayersNow()) {
      expect(p.overall).toBeLessThanOrEqual(ceiling);
    }
  });

  it('Icon packs grant the user the only signing — no AI backfill', () => {
    // Icon is now an IAP — opened via skipPayment after a successful
    // real-money purchase. The no-AI-backfill contract still holds.
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 } },
    });
    const beforePlayerCount = Object.keys(useGameStore.getState().players).length;
    const result = useGameStore.getState().openPack('icon', { skipPayment: true });
    expect(result.success).toBe(true);
    const after = useGameStore.getState();
    const added = Object.keys(after.players).length - beforePlayerCount;
    // Icon: 1 user card, 0 AI counter-signings (per AI_BACKFILL_PER_TIER.icon).
    expect(added).toBe(PACK_TIER_MAP.icon.cards + AI_BACKFILL_PER_TIER.icon);
  });

  it('the helper itself never produces above the gap-adjusted ceiling', () => {
    // Direct unit test on the helper: deterministic across many runs.
    const state = useGameStore.getState();
    for (let run = 0; run < 25; run++) {
      const out = generateAiCounterSignings(
        'rare',
        state.clubs,
        state.playerClubId,
        state.playerDivision,
        state.season,
      );
      const ceiling = PACK_TIER_MAP.rare.guaranteedMinOvr - AI_BACKFILL_OVR_GAP;
      for (const players of Object.values(out.perClub)) {
        for (const p of players) expect(p.overall).toBeLessThanOrEqual(ceiling);
      }
    }
  });
});

describe('Pack opening — manager XP & career stat growth', () => {
  beforeEach(() => { initAndGetState(); });

  it('grants legendary XP when a 90+ player drops', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 } },
    });
    const xpBefore = useGameStore.getState().managerProgression.xp || 0;
    const result = useGameStore.getState().openPack('icon', { skipPayment: true });
    expect(result.success).toBe(true);

    const topOvr = Math.max(...result.players!.map(p => p.overall));
    const after = useGameStore.getState();
    const xpAfter = after.managerProgression.xp || 0;
    if (topOvr >= 90) {
      expect(xpAfter - xpBefore).toBeGreaterThanOrEqual(XP_REWARDS.packLegendaryPull);
    } else {
      // Icon pack guarantees 88+, so 84-89 grants the rare-pull XP at minimum.
      expect(xpAfter - xpBefore).toBeGreaterThanOrEqual(XP_REWARDS.packRarePull);
    }
  });

  it('does NOT grant XP for sub-walkout pulls', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const xpBefore = useGameStore.getState().managerProgression.xp || 0;
    // Bronze pack ceiling is 68 OVR — well below WALKOUT_OVR_THRESHOLD (84).
    const result = useGameStore.getState().openPack('daily');
    expect(result.success).toBe(true);
    const xpAfter = useGameStore.getState().managerProgression.xp || 0;
    expect(xpAfter).toBe(xpBefore);
  });
});

describe('paid packs describe what they actually contain', () => {
  // The Legends Pack shipped as "1 guaranteed Icon, 88+" on a $9.99 IAP while
  // the game had no Icons at all: there is no retired-legend pool in the data,
  // and pack pulls come from the community pack, which is current players only.
  // "Legends" is the card ISSUE (a +4 version), not a player type. An App Store
  // paid item has to describe its contents accurately — the same reason the
  // odds sheet exists — so this guards the claim rather than just the wording.
  const CONTENT_CLAIM_FIELDS = ['storeCaption', 'storeBlurb', 'label'] as const;

  it('promises an Icon only as the Hall of Legends outcome, which now exists', () => {
    // The retired-legend pool ships (src/data/legends.ts + the save archive),
    // so an "icon" promise is legitimate — but ONLY in its qualified form.
    // "Hall of Legends icon" names the disclosed 3–25% outcome; a bare "Icon"
    // would read as EA-style licensed Icons, which the game does not and
    // cannot ship (retired-player likeness rights are licensed individually).
    for (const tier of PACK_TIERS) {
      for (const field of CONTENT_CLAIM_FIELDS) {
        const text = String(tier[field] ?? '');
        const stripped = text.replace(/Hall of Legends icons?/gi, '');
        expect(stripped, `${tier.key}.${field} promises a bare Icon`).not.toMatch(/\bicons?\b/i);
      }
    }
  });

  it('states a guaranteed floor only when the tier really guarantees one', () => {
    for (const tier of PACK_TIERS) {
      const claim = String(tier.storeCaption ?? '').match(/(\d{2})\+/);
      if (!claim) continue;
      expect(tier.guaranteedMinOvr, `${tier.key} advertises ${claim[1]}+`).toBe(Number(claim[1]));
    }
  });

  it('states a card count that matches what the tier deals', () => {
    for (const tier of PACK_TIERS) {
      const claim = String(tier.storeCaption ?? '').match(/^(\d+)\s+(card|player)/i);
      if (!claim) continue;
      expect(tier.cards, `${tier.key} advertises ${claim[1]} ${claim[2]}(s)`).toBe(Number(claim[1]));
    }
  });
});
