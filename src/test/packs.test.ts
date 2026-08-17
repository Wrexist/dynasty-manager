import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { writeDailyPackOpens, currentDayIndex } from '@/store/helpers/persistence';
import { generateAiCounterSignings, generatePackContents, shouldPityTrigger, updatedPityCounter } from '@/utils/packGeneration';
import { AI_BACKFILL_OVR_GAP, AI_BACKFILL_PER_TIER, PACK_TIER_MAP, PACK_PITY_THRESHOLD, PACK_PITY_MAX_OVERSHOOT, WALKOUT_OVR_THRESHOLD, resolvePackTier } from '@/config/packs';
import type { Club, PackTierKey } from '@/types/game';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';
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
        const players = generatePackContents(tier.key, 1);
        const topOvr = Math.max(...players.map(p => p.overall));
        expect(topOvr).toBeGreaterThanOrEqual(tier.guaranteedMinOvr);
      }
    }
  });

  it('keeps all generated players inside the tier OVR band', () => {
    for (const tier of Object.values(PACK_TIER_MAP)) {
      for (let run = 0; run < 20; run++) {
        const players = generatePackContents(tier.key, 1);
        for (const p of players) {
          expect(p.overall).toBeLessThanOrEqual(tier.ovrMax);
        }
      }
    }
  });

  it('pity lifts the guaranteed slot above the tier ceiling but stays tied to the tier', () => {
    // Pity used to ignore the tier ceiling outright, so one free Bronze in nine
    // could produce an 89 — better than the $6.99 Rare Gold guarantee. It must
    // still be a visible reward (above the tier's own ceiling) without turning
    // a free pack into a gold mine.
    for (const tier of Object.values(PACK_TIER_MAP)) {
      const cap = tier.ovrMax + PACK_PITY_MAX_OVERSHOOT;
      let sawImprovement = false;
      for (let run = 0; run < 40; run++) {
        const players = generatePackContents(tier.key, 1, { pityTriggered: true });
        const topOvr = Math.max(...players.map(p => p.overall));
        expect(topOvr, `${tier.key} pity pull ${topOvr} exceeded cap ${cap}`).toBeLessThanOrEqual(cap);
        expect(topOvr).toBeGreaterThanOrEqual(tier.guaranteedMinOvr);
        if (topOvr > tier.ovrMax) sawImprovement = true;
      }
      expect(sawImprovement, `${tier.key} pity never beat its normal ceiling`).toBe(true);
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

describe('Pack opening — free vs paid odds', () => {
  it('a free Gold open cannot exceed the free ceiling', () => {
    const paid = PACK_TIER_MAP.gold;
    const free = resolvePackTier(paid, true);
    expect(free.ovrMax).toBeLessThan(paid.ovrMax);
    for (let run = 0; run < 60; run++) {
      const players = generatePackContents('gold', 1, { freeOpen: true });
      for (const p of players) {
        expect(p.overall).toBeLessThanOrEqual(free.ovrMax);
      }
      expect(Math.max(...players.map(p => p.overall))).toBeGreaterThanOrEqual(free.guaranteedMinOvr);
    }
  });

  it('a paid Gold open keeps the full guarantee — nobody\'s purchase got worse', () => {
    const paid = PACK_TIER_MAP.gold;
    for (let run = 0; run < 60; run++) {
      const players = generatePackContents('gold', 1, { freeOpen: false });
      expect(Math.max(...players.map(p => p.overall))).toBeGreaterThanOrEqual(paid.guaranteedMinOvr);
      for (const p of players) expect(p.overall).toBeLessThanOrEqual(paid.ovrMax);
    }
  });

  it('defaults to PAID odds when the caller omits freeOpen', () => {
    // Failing open to the weaker odds would silently short-change purchases,
    // which is the more damaging direction to get wrong.
    const paid = PACK_TIER_MAP.gold;
    let sawAbovefreeCeiling = false;
    const freeCeiling = resolvePackTier(paid, true).ovrMax;
    for (let run = 0; run < 80 && !sawAbovefreeCeiling; run++) {
      const players = generatePackContents('gold', 1);
      if (players.some(p => p.overall > freeCeiling)) sawAbovefreeCeiling = true;
    }
    expect(sawAbovefreeCeiling).toBe(true);
  });

  it('free odds make 80+ markedly rarer without making it impossible', () => {
    // The point of the change: the free daily Gold was handing out ~2.3 cards
    // at 80+ every single day, which outran the transfer market as a route to
    // a squad. It should still be possible — just not a firehose.
    const RUNS = 300;
    let freeGold = 0;
    let paidGold = 0;
    for (let i = 0; i < RUNS; i++) {
      freeGold += generatePackContents('gold', 1, { freeOpen: true }).filter(p => p.overall >= 80).length;
      paidGold += generatePackContents('gold', 1, { freeOpen: false }).filter(p => p.overall >= 80).length;
    }
    const freePerOpen = freeGold / RUNS;
    const paidPerOpen = paidGold / RUNS;
    expect(freePerOpen, `free 80+/open was ${freePerOpen.toFixed(2)}`).toBeLessThan(1.2);
    expect(freePerOpen).toBeGreaterThan(0);
    expect(paidPerOpen, 'paid opens must stay clearly more rewarding').toBeGreaterThan(freePerOpen * 1.5);
  });

  it('tiers with no free override are identical on both paths', () => {
    for (const tier of Object.values(PACK_TIER_MAP)) {
      if (tier.freeOpenOverride) continue;
      expect(resolvePackTier(tier, true)).toBe(tier);
    }
  });

  it('AI counter-signings stay below the FREE guarantee on a free open', () => {
    // The AI ceiling is derived from the user's guarantee. If a free Gold open
    // lowered the user's card but not the AI's, the league would out-sign the
    // player off their own pack.
    const free = resolvePackTier(PACK_TIER_MAP.gold, true);
    const clubs: Record<string, Club> = {
      me: { id: 'me', divisionId: 'd1', playerIds: [], reputation: 50, wageBill: 0 } as unknown as Club,
      rival: { id: 'rival', divisionId: 'd1', playerIds: [], reputation: 70, wageBill: 0 } as unknown as Club,
      other: { id: 'other', divisionId: 'd1', playerIds: [], reputation: 60, wageBill: 0 } as unknown as Club,
    };
    for (let run = 0; run < 30; run++) {
      const { perClub } = generateAiCounterSignings('gold', clubs, 'me', 'd1', 1, true);
      for (const players of Object.values(perClub)) {
        for (const p of players) {
          expect(p.overall).toBeLessThan(free.guaranteedMinOvr);
        }
      }
    }
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
    const result = useGameStore.getState().openPack('bronze');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/squad space/i);
  });

  it('deducts budget, adds players to roster, and logs an opened pack record', () => {
    // Silver is currency-unlock — bronze is now a free ad pack and no
    // longer deducts in-game budget, so this ledger test moved to silver.
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

    const result = useGameStore.getState().openPack('silver');
    expect(result.success).toBe(true);
    expect(result.players).toBeDefined();
    expect(result.players).toHaveLength(PACK_TIER_MAP.silver.cards);

    const after = useGameStore.getState();
    const clubAfter = after.clubs[state.playerClubId];
    expect(clubAfter.budget).toBe(budgetBefore - PACK_TIER_MAP.silver.price);
    expect(clubAfter.playerIds.length).toBe(squadBefore + PACK_TIER_MAP.silver.cards);
    for (const p of result.players!) {
      expect(clubAfter.playerIds).toContain(p.id);
      expect(after.players[p.id]).toBeDefined();
      expect(after.players[p.id].clubId).toBe(state.playerClubId);
    }
    expect(after.openedPacks.length).toBeGreaterThan(0);
    expect(after.openedPacks[0].tier).toBe('silver');
  });

  it('does not deduct in-game budget for free (ad-unlock) bronze packs', () => {
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...club, budget: 5_000_000 } },
    });
    const budgetBefore = useGameStore.getState().clubs[state.playerClubId].budget;
    const result = useGameStore.getState().openPack('bronze');
    expect(result.success).toBe(true);
    const after = useGameStore.getState();
    expect(after.clubs[state.playerClubId].budget).toBe(budgetBefore);
  });

  it('caps bronze opens at free + ad daily limits combined', () => {
    // Trim the default squad to a known small size so 4 bronze packs
    // (3 cards each = 12 players) don't bump up against MAX_SQUAD_SIZE.
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    const trimmedIds = club.playerIds.slice(0, 20);
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...club, playerIds: trimmedIds, budget: 1_000_000 },
      },
    });
    const freeCap = PACK_TIER_MAP.bronze.freeDailyLimit ?? 0;
    const adCap = PACK_TIER_MAP.bronze.adDailyLimit ?? 0;
    expect(freeCap + adCap).toBeGreaterThan(0);

    // First open uses today's free allowance.
    for (let i = 0; i < freeCap; i++) {
      const open = useGameStore.getState().openPack('bronze', { method: 'free' });
      expect(open.success).toBe(true);
      expect(open.method).toBe('free');
    }
    // Subsequent opens fall back to ad (page would have shown a rewarded
    // ad before calling). skipPayment mirrors the page's contract.
    for (let i = 0; i < adCap; i++) {
      const open = useGameStore.getState().openPack('bronze', { method: 'ad', skipPayment: true });
      expect(open.success).toBe(true);
      expect(open.method).toBe('ad');
    }
    // After both caps are hit, additional opens are blocked.
    const overflow = useGameStore.getState().openPack('bronze', { method: 'ad', skipPayment: true });
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
    const result = useGameStore.getState().openPack('bronze');
    expect(result.success).toBe(true);
    for (const p of result.players!) {
      expect(p.overall).toBeLessThanOrEqual(PACK_TIER_MAP.bronze.ovrMax);
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
    const result = useGameStore.getState().openPack('bronze');
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

    const result = useGameStore.getState().openPack('bronze');
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
    const openResult = useGameStore.getState().openPack('bronze');
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
    const open = useGameStore.getState().openPack('bronze');
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
    const open = useGameStore.getState().openPack('bronze');
    expect(open.success).toBe(true);

    const preSave = useGameStore.getState();
    const expectedOpenedPacksLength = preSave.openedPacks.length;
    const expectedPity = preSave.packPityCounter;
    const expectedDailyOpens = preSave.dailyPackOpens;
    expect(expectedOpenedPacksLength).toBeGreaterThan(0);
    // Bronze's first daily open is `free`, so the free bucket should be 1.
    expect(expectedDailyOpens.free.bronze).toBe(1);

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
    expect(after.openedPacks[0].tier).toBe('bronze');
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
    const result = useGameStore.getState().openPack('bronze');
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
    // Trim squad so 4 bronze packs (12 cards) don't bump MAX_SQUAD_SIZE.
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...club, playerIds: club.playerIds.slice(0, 20), budget: 1_000_000 },
      },
    });
    // Burn through every free + ad open for bronze, then ask if more
    // are available. canOpenPack with no method picks the next-cheapest
    // available — once both caps hit, that's `null` and the slice
    // surfaces a "no opens available" message.
    const freeCap = PACK_TIER_MAP.bronze.freeDailyLimit ?? 0;
    const adCap = PACK_TIER_MAP.bronze.adDailyLimit ?? 0;
    for (let i = 0; i < freeCap; i++) {
      const open = useGameStore.getState().openPack('bronze', { method: 'free' });
      expect(open.success).toBe(true);
    }
    for (let i = 0; i < adCap; i++) {
      const open = useGameStore.getState().openPack('bronze', { method: 'ad', skipPayment: true });
      expect(open.success).toBe(true);
    }
    const can = useGameStore.getState().canOpenPack('bronze');
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
    const result = useGameStore.getState().openPack('gold');
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
    const result = useGameStore.getState().openPack('bronze');
    expect(result.success).toBe(true);
    const xpAfter = useGameStore.getState().managerProgression.xp || 0;
    expect(xpAfter).toBe(xpBefore);
  });
});
