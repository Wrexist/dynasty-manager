/**
 * Community-pack RUNTIME path through advanceWeek — the season-start FA-pool
 * seed (Phase E.7). Like the market refresh, this lives inside the weekAdvance
 * game loop and was only exercised by a skip-gated diagnostic, never the normal
 * suite. It fires on the first regular tick of season 2+ (CP_FA_SEED_COUNT_BY_
 * SEASON), gated by cpPool.lastSeedSeason < season.
 *
 * To avoid advancing a whole season, we jump the game to the start of season 2
 * (lastSeedSeason still 1) and advance one week. This both closes the coverage
 * gap and is the safety net guarding the extraction of this block.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { CP_FA_SEED_COUNT_BY_SEASON } from '@/config/aiSimulation';

const CLUB_ID = 'celtic';

describe('community pack — FA pool season-start seed during advanceWeek', () => {
  it('seeds free agents at the start of season 2 and is idempotent', async () => {
    await useGameStore.getState().initGame(CLUB_ID, { communityPackEnabled: true });

    // Jump to the very start of season 2 with the S2 seed not yet applied.
    const s0 = useGameStore.getState();
    useGameStore.setState({ season: 2, cpPool: { ...s0.cpPool, lastSeedSeason: 1 } });

    const faBefore = useGameStore.getState().freeAgents.length;
    const usedBefore = useGameStore.getState().cpPool.usedFcIds.length;
    expect(CP_FA_SEED_COUNT_BY_SEASON[2]).toBeGreaterThan(0);

    await useGameStore.getState().advanceWeek();
    useGameStore.getState().playCurrentMatch();

    const s1 = useGameStore.getState();
    // The seed fired: marker advanced, free agents + used fcIds grew.
    expect(s1.cpPool.lastSeedSeason).toBe(2);
    expect(s1.freeAgents.length).toBeGreaterThan(faBefore);
    expect(s1.cpPool.usedFcIds.length).toBeGreaterThan(usedBefore);
    // No duplicate fcIds introduced.
    expect(new Set(s1.cpPool.usedFcIds).size).toBe(s1.cpPool.usedFcIds.length);
    // Newly seeded players are unattached free agents.
    const seededId = s1.freeAgents[s1.freeAgents.length - 1];
    expect(s1.players[seededId]?.clubId).toBe('');

    // Idempotent: advancing again in the same season does not re-seed. (Free
    // agents drift a little from normal AI churn, but never by another full
    // seed batch.)
    const faAfterFirst = s1.freeAgents.length;
    await useGameStore.getState().advanceWeek();
    useGameStore.getState().playCurrentMatch();
    expect(useGameStore.getState().cpPool.lastSeedSeason).toBe(2);
    expect(useGameStore.getState().freeAgents.length).toBeLessThan(faAfterFirst + CP_FA_SEED_COUNT_BY_SEASON[2]);
  });
});
