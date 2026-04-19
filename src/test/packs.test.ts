import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { generatePackContents, shouldPityTrigger, updatedPityCounter } from '@/utils/packGeneration';
import { PACK_TIER_MAP, PACK_PITY_THRESHOLD, WALKOUT_OVR_THRESHOLD } from '@/config/packs';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';

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
  beforeEach(() => {
    initAndGetState();
    // initGame() doesn't reset packs-slice state, which persists across tests.
    // Force a clean slate so each test exercises first-open behaviour.
    useGameStore.setState({
      openedPacks: [],
      packPityCounter: 0,
      lastPackWeek: 0,
      lastPackSeason: 0,
    });
  });

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

    const result = useGameStore.getState().openPack('bronze');
    expect(result.success).toBe(true);
    expect(result.players).toBeDefined();
    expect(result.players).toHaveLength(PACK_TIER_MAP.bronze.cards);

    const after = useGameStore.getState();
    const clubAfter = after.clubs[state.playerClubId];
    expect(clubAfter.budget).toBe(budgetBefore - PACK_TIER_MAP.bronze.price);
    expect(clubAfter.playerIds.length).toBe(squadBefore + PACK_TIER_MAP.bronze.cards);
    for (const p of result.players!) {
      expect(clubAfter.playerIds).toContain(p.id);
      expect(after.players[p.id]).toBeDefined();
      expect(after.players[p.id].clubId).toBe(state.playerClubId);
    }
    expect(after.openedPacks.length).toBeGreaterThan(0);
    expect(after.openedPacks[0].tier).toBe('bronze');
  });

  it('enforces one pack per in-game week', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const first = useGameStore.getState().openPack('bronze');
    expect(first.success).toBe(true);

    const second = useGameStore.getState().openPack('bronze');
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/one pack per week/i);
  });

  it('flags walkout-eligible players at 84+', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 } },
    });
    const result = useGameStore.getState().openPack('icon');
    expect(result.success).toBe(true);
    // Icon pack guarantees 88+ which is above walkout threshold
    const topOvr = Math.max(...result.players!.map(p => p.overall));
    expect(topOvr).toBeGreaterThanOrEqual(WALKOUT_OVR_THRESHOLD);
  });
});
