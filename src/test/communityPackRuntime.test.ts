/**
 * Community-pack RUNTIME path through advanceWeek — the periodic market refresh
 * that rotates external free-agent listings. This block lives inside the
 * weekAdvance game loop and was only exercised by a skip-gated diagnostic
 * (faPoolDiagnostic, describe.skipIf), i.e. NOT by the normal suite. This test
 * drives it in CI: it both closes the coverage gap and is the safety net a
 * future extraction of that block would need.
 *
 * The refresh fires when (week - cpPool.lastMarketRefreshWeek) >= 4; starting
 * from lastMarketRefreshWeek = 0, advancing past week 4 triggers it.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';

const CLUB_ID = 'celtic';

function assertSquadIntegrity() {
  const s = useGameStore.getState();
  for (const club of Object.values(s.clubs)) {
    expect(club.lineup.every(id => !!s.players[id])).toBe(true);
    expect(Number.isFinite(club.budget)).toBe(true);
  }
}

describe('community pack — market refresh during advanceWeek', () => {
  it('rotates the external free-agent market and stays consistent', async () => {
    await useGameStore.getState().initGame(CLUB_ID, { communityPackEnabled: true });
    expect(useGameStore.getState().communityPackEnabled).toBe(true);

    const refreshBefore = useGameStore.getState().cpPool.lastMarketRefreshWeek;
    expect(refreshBefore).toBe(0);

    // Advance past the 4-week refresh cadence (twice).
    for (let i = 0; i < 8; i++) {
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }

    const s = useGameStore.getState();
    // The refresh block must have run at least once and stamped a recent week.
    expect(s.cpPool.lastMarketRefreshWeek).toBeGreaterThanOrEqual(4);
    // It re-stocks the market with external (community-pack) free agents.
    expect(s.transferMarket.some(l => l.externalPlayer)).toBe(true);
    // usedFcIds must not contain duplicates (the dedup/prune bookkeeping).
    const used = s.cpPool.usedFcIds;
    expect(new Set(used).size).toBe(used.length);

    assertSquadIntegrity();
  });
});
