/**
 * Audit finding 1.12 — "manager contracts expire a season early; league moves
 * skip a season", and Phase 7's request for "a career integration test
 * (… contract length is honoured)".
 *
 * `finalizeSeason` commits `season: newSeason` BEFORE `runPostSeasonTail` runs,
 * so an expiry check written against the live `season` fires a year early: a
 * 3-year deal signed in season 1 terminated at the end of season 2. The same
 * off-by-one inflated the history stamping that `moveToNewClub` reads, losing a
 * full season on every league change.
 *
 * The tail now compares against `completedSeason`. These tests pin the boundary
 * from both sides, because an off-by-one is invisible unless you check the season
 * before expiry as well as the season of expiry.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { createDefaultManager } from '@/utils/managerCareer';
import type { CareerManager } from '@/types/game';

const CLUB_ID = 'celtic';

function careerManagerWithContract(endSeason: number): CareerManager {
  return {
    ...createDefaultManager('Contract Tester', 'England', 40, []),
    contract: { clubId: CLUB_ID, salary: 5000, startSeason: 1, endSeason, bonuses: [] },
    careerHistory: [{
      clubId: CLUB_ID, clubName: 'Celtic', startSeason: 1, endSeason: null, reason: null,
    }] as CareerManager['careerHistory'],
  };
}

/** Play out the current season and roll it over. */
async function finishSeason() {
  const total = useGameStore.getState().totalWeeks || 38;
  for (let w = 0; w < total + 8; w++) {
    const st = useGameStore.getState();
    if (st.week > total) break;
    await st.advanceWeek();
    useGameStore.getState().playCurrentMatch();
  }
  await useGameStore.getState().endSeason();
}

describe('career contracts — length is honoured to the season it says', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('a deal running to season 3 survives the end of season 2', async () => {
    useGameStore.setState({
      gameMode: 'career',
      careerManager: careerManagerWithContract(3),
      season: 2,
    });

    await finishSeason();

    const cm = useGameStore.getState().careerManager!;
    // Season 2 has just completed; the deal runs through season 3, so the
    // manager must still be under contract at the same club. The bug expired it
    // here, one season early.
    expect(cm.contract, 'contract expired a season early').not.toBeNull();
    expect(cm.contract!.clubId).toBe(CLUB_ID);
    expect(cm.contract!.endSeason).toBe(3);
    expect(
      cm.careerHistory.some(e => e.reason === 'contract_expired'),
      'history recorded an expiry that had not happened',
    ).toBe(false);
  });

  it('the same deal is resolved at the end of season 3, not before', async () => {
    useGameStore.setState({
      gameMode: 'career',
      careerManager: careerManagerWithContract(3),
      season: 3,
    });

    await finishSeason();

    const cm = useGameStore.getState().careerManager!;
    // At the end of the contract's final season the deal must be dealt with —
    // either renewed (the board extends) or expired into the job market. What
    // must NOT happen is it silently rolling on unchanged.
    const renewed = cm.contract !== null && cm.contract.endSeason > 3;
    const expired = cm.contract === null
      || cm.careerHistory.some(e => e.reason === 'contract_expired');
    expect(
      renewed || expired,
      `contract neither renewed nor expired at its final season (endSeason=${cm.contract?.endSeason})`,
    ).toBe(true);
  });

  it('the open career-history entry is stamped with the season actually completed', async () => {
    // The off-by-one also inflated history stamping, which `moveToNewClub`
    // reads — losing a season on every league change. Any stamped endSeason
    // must never be in the future relative to the season just played.
    useGameStore.setState({
      gameMode: 'career',
      careerManager: careerManagerWithContract(6),
      season: 2,
    });
    const playedSeason = useGameStore.getState().season;

    await finishSeason();

    const cm = useGameStore.getState().careerManager!;
    for (const entry of cm.careerHistory) {
      if (entry.endSeason == null) continue;
      expect(
        entry.endSeason,
        `history entry stamped season ${entry.endSeason} after completing ${playedSeason}`,
      ).toBeLessThanOrEqual(playedSeason);
    }
  });
});
