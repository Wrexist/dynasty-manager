/**
 * Manager Career × national team — regressions from the 2026-09-25 audit.
 *
 * 1. **An unemployed manager holding the national-team job froze the season.**
 *    `advanceWeekImpl` ran the unemployed branch BEFORE the international
 *    dispatch, and `resignFromClub` / `sackManagerMidSeason` keep the NT job.
 *    When the season ended while out of work, `finalizeSeason` scheduled the
 *    tournament and deferred the post-season tail to its completion — but every
 *    later tick went down the unemployed branch instead, so the tournament never
 *    advanced, `seasonPhase` stayed `'international'` forever, the next season's
 *    league was simulated underneath it, and the deferred tail (ageing, contract
 *    processing) never ran.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { createDefaultManager } from '@/utils/managerCareer';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import type { CareerManager, NationalTeamOffer } from '@/types/game';

const CLUB_ID = 'celtic';
const NATION = 'England';

function unemployedManager(): CareerManager {
  return {
    ...createDefaultManager('NT Tester', NATION, 40, []),
    contract: null,
    unemployedWeeks: 0,
    careerHistory: [{
      clubId: CLUB_ID, clubName: 'Celtic', divisionId: 'sco', startSeason: 1, endSeason: 1,
      reason: 'resigned', bestFinish: 0, titlesWon: 0,
    }],
  };
}

function appointNationalTeam() {
  const offer: NationalTeamOffer = {
    id: 'nt-offer', nationality: NATION, reason: 'initial',
    offerSeason: 1, offerWeek: 1, expiresSeason: 1, expiresWeek: 10, status: 'pending',
  };
  useGameStore.setState({ managerNationality: NATION, nationalTeamOffer: offer });
  useGameStore.getState().acceptNationalTeamOffer();
  expect(useGameStore.getState().nationalTeam).not.toBeNull();
}

beforeEach(async () => {
  __resetAutosaveSchedulerForTests();
  __resetSaveStorageForTests();
  useGameStore.getState().resetGame();
  localStorage.clear();
  await useGameStore.getState().initGame(CLUB_ID);
});

describe('unemployed career manager with the national-team job', () => {
  it('plays the end-of-season tournament through and runs the post-season tail', async () => {
    useGameStore.setState({ gameMode: 'career', careerManager: unemployedManager() });
    appointNationalTeam();

    // Season 1 is a World Cup season: the tick past the final week ends the
    // season and schedules the tournament.
    useGameStore.setState({ week: useGameStore.getState().totalWeeks });
    await useGameStore.getState().advanceWeek();
    const scheduled = useGameStore.getState();
    expect(scheduled.seasonPhase).toBe('international');
    expect(scheduled.internationalTournament).not.toBeNull();
    expect(scheduled.season).toBe(2);
    const ageBefore = scheduled.careerManager!.age;
    const weekBefore = scheduled.week;

    for (let i = 0; i < 40 && useGameStore.getState().seasonPhase === 'international'; i++) {
      // Leave the picker so the loop's auto-confirm escape can lock the squad.
      if (useGameStore.getState().currentScreen === 'national-squad-picker') {
        useGameStore.setState({ currentScreen: 'international-tournament' });
      }
      await useGameStore.getState().advanceWeek();
    }

    const s = useGameStore.getState();
    expect(s.seasonPhase, 'tournament never finished while unemployed').toBe('regular');
    expect(s.internationalTournament).toBeNull();
    // The deferred post-season tail ran exactly once: the manager aged a year.
    expect(s.careerManager!.age).toBe(ageBefore + 1);
    // The club calendar did not run underneath the tournament.
    expect(s.week).toBe(weekBefore);
    expect(s.season).toBe(2);
  });
});
