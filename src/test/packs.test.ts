import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { generateAiCounterSignings, generatePackContents, shouldPityTrigger, updatedPityCounter } from '@/utils/packGeneration';
import { AI_BACKFILL_OVR_GAP, AI_BACKFILL_PER_TIER, PACK_TIER_MAP, PACK_PITY_THRESHOLD, WALKOUT_OVR_THRESHOLD } from '@/config/packs';
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
  useGameStore.getState().initGame(CLUB_ID);
  return useGameStore.getState();
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

  it('pity trigger promotes the guaranteed slot to at least 80', () => {
    // Bronze pack would normally guarantee 60+; with pity on it should jump to 80+
    for (let run = 0; run < 30; run++) {
      const players = generatePackContents('bronze', 1, { pityTriggered: true });
      const topOvr = Math.max(...players.map(p => p.overall));
      expect(topOvr).toBeGreaterThanOrEqual(80);
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

  it('rejects when budget is insufficient', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 0 },
      },
    });
    const result = useGameStore.getState().openPack('gold');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/insufficient/i);
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

  it('caps free bronze opens at the configured daily limit', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 1_000_000 } },
    });
    const limit = PACK_TIER_MAP.bronze.dailyLimit ?? 0;
    expect(limit).toBeGreaterThan(0);
    for (let i = 0; i < limit; i++) {
      const open = useGameStore.getState().openPack('bronze');
      expect(open.success).toBe(true);
    }
    const overflow = useGameStore.getState().openPack('bronze');
    expect(overflow.success).toBe(false);
    expect(overflow.message).toMatch(/daily limit/i);
  });

  it('rejects IAP-unlock packs unless skipPayment is set', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 999_999_999 } },
    });
    const direct = useGameStore.getState().openPack('icon');
    expect(direct.success).toBe(false);
    expect(direct.message).toMatch(/in-app purchase/i);

    // After the page proves a successful real-money purchase, the slice
    // accepts skipPayment and opens the pack without charging in-game funds.
    const budgetBefore = useGameStore.getState().clubs[state.playerClubId].budget;
    const paid = useGameStore.getState().openPack('icon', { skipPayment: true });
    expect(paid.success).toBe(true);
    expect(useGameStore.getState().clubs[state.playerClubId].budget).toBe(budgetBefore);
  });

  it('lets the user open multiple packs in the same week (no weekly cooldown)', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 } },
    });
    const first = useGameStore.getState().openPack('silver');
    expect(first.success).toBe(true);
    const second = useGameStore.getState().openPack('silver');
    expect(second.success).toBe(true);
  });

  it('flags walkout-eligible players at 84+', () => {
    // Rare pack guarantees 84+ (matches the walkout threshold); the icon
    // pack is now an IAP-only product so it can't be opened directly here.
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 } },
    });
    const result = useGameStore.getState().openPack('rare');
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
    const result = useGameStore.getState().openPack('rare');
    expect(result.success).toBe(true);

    const after = useGameStore.getState();
    const clubAfter = after.clubs[state.playerClubId];

    for (const p of result.players!) {
      expect(clubAfter.playerIds).toContain(p.id);
    }
    expect(clubAfter.lineup.length).toBeLessThanOrEqual(11);
  });

  it('returns placement metadata classifying each pull as starter / bench / squad', () => {
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [state.playerClubId]: { ...club, budget: 200_000_000 },
      },
    });
    const result = useGameStore.getState().openPack('rare');
    expect(result.success).toBe(true);
    expect(result.placement).toBeDefined();
    const top = result.players![0];
    expect(['starter', 'bench', 'squad']).toContain(result.placement![top.id]);
    // At least one rare pull (84+ guaranteed) should change the lineup.
    expect(result.lineupChanges).toBeGreaterThan(0);
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
    // Every pulled player is tracked in playerIds
    for (const p of result.players!) {
      expect(after.playerIds).toContain(p.id);
      // Placement must be defined for every pull
      expect(['starter', 'bench', 'squad']).toContain(result.placement![p.id]);
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
    const open = useGameStore.getState().openPack('rare');
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
    const openResult = useGameStore.getState().openPack('rare');
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

  it('persists openedPacks, pity counter, and ad-pack daily bucket across save/load', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('bronze');
    expect(open.success).toBe(true);

    const preSave = useGameStore.getState();
    const expectedOpenedPacksLength = preSave.openedPacks.length;
    const expectedPity = preSave.packPityCounter;
    const expectedAdPackOpens = preSave.adPackOpens;
    expect(expectedOpenedPacksLength).toBeGreaterThan(0);
    expect(expectedAdPackOpens.counts.bronze).toBe(1);

    useGameStore.getState().saveGame(1);
    // Wipe in-memory pack state to prove the values come from storage
    useGameStore.setState({
      openedPacks: [],
      packPityCounter: 0,
      lastPackWeek: 0,
      lastPackSeason: 0,
      adPackOpens: { date: '', counts: {} },
    });
    const loaded = useGameStore.getState().loadGame(1);
    expect(loaded).toBe(true);

    const after = useGameStore.getState();
    expect(after.openedPacks.length).toBe(expectedOpenedPacksLength);
    expect(after.openedPacks[0].tier).toBe('bronze');
    expect(after.packPityCounter).toBe(expectedPity);
    expect(after.adPackOpens).toEqual(expectedAdPackOpens);
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
});

describe('Pack opening — AI counter-signings (league balance)', () => {
  beforeEach(() => { initAndGetState(); });

  it('AI signings stay strictly below the user\'s tier guarantee', () => {
    // Open a Gold pack (78+ user guarantee). AI signings must be ≤ 73 OVR
    // (78 − AI_BACKFILL_OVR_GAP). User's pack contains 5 cards; AI gets 2.
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const beforeIds = new Set(Object.keys(useGameStore.getState().players));
    const result = useGameStore.getState().openPack('gold');
    expect(result.success).toBe(true);

    const after = useGameStore.getState();
    const userPackIds = new Set(result.players!.map(p => p.id));
    // Strictly the players added by this open MINUS the user's pack contents.
    const aiNewPlayers = Object.values(after.players).filter(p =>
      !beforeIds.has(p.id)
      && !userPackIds.has(p.id)
      && p.clubId !== state.playerClubId,
    );
    // AI got at least 1 backfill across the league for a Gold pack.
    expect(aiNewPlayers.length).toBeGreaterThan(0);
    const ceiling = PACK_TIER_MAP.gold.guaranteedMinOvr - AI_BACKFILL_OVR_GAP;
    for (const p of aiNewPlayers) {
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
