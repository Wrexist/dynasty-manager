/**
 * MatchDay's live clock relies on two engine guarantees about event minutes:
 *
 *  1. First-half stoppage time is stored at minute 45 (the "45+2" label rides
 *     on `displayMinute`). If a 45+1 event were stored as 46, the second-half
 *     key-moment check — which matches `e.minute === minute` across every
 *     event of the match — would re-fire a first-half goal conceded / red card
 *     / injury on the first tick of the second half.
 *  2. Minutes never decrease through the array, across halves and extra time.
 *     The ticker advances a forward-only cursor while
 *     `allEvents[cursor].minute <= next`; a first-half 47 ahead of a
 *     second-half 46 would hold second-half events back a minute.
 *
 * Both hold because simulateHalf clamps stoppage minutes to the nominal end.
 * These tests pin that clamp so it can't be dropped without MatchDay breaking.
 */
import { describe, it, expect } from 'vitest';
import { simulateHalf } from '@/engine/match';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { Club, MatchEvent } from '@/types/game';
import { SECOND_HALF_SEGMENTS } from '@/config/matchEngine';
import { withSeededRandom } from './helpers/seasonFixtures';

function makeClub(id: string): Club {
  return {
    id, name: id, shortName: id.slice(0, 3).toUpperCase(),
    color: '#fff', secondaryColor: '#000',
    budget: 50_000_000, wageBill: 200_000,
    reputation: 70, facilities: 5, youthRating: 5, fanBase: 5, boardPatience: 60,
    playerIds: [], formation: '4-3-3', lineup: [], subs: [],
    divisionId: 'eng',
  };
}

function setup() {
  const homeClub = makeClub('home');
  const awayClub = makeClub('away');
  const homeSquad = generateSquad('home', 70, 1);
  const awaySquad = generateSquad('away', 70, 1);
  homeClub.playerIds = homeSquad.map(p => p.id);
  awayClub.playerIds = awaySquad.map(p => p.id);
  const { lineup: homePlayers } = selectBestLineup(homeSquad, '4-3-3');
  const { lineup: awayPlayers } = selectBestLineup(awaySquad, '4-3-3');
  homeClub.lineup = homePlayers.map(p => p.id);
  awayClub.lineup = awayPlayers.map(p => p.id);
  return { homeClub, awayClub, homePlayers, awayPlayers };
}

function expectNonDecreasing(events: MatchEvent[]) {
  for (let i = 1; i < events.length; i++) {
    expect(events[i].minute).toBeGreaterThanOrEqual(events[i - 1].minute);
  }
}

describe('stoppage-time event minutes', () => {
  it('first-half stoppage events are stored at 45 and the half_time marker closes the half', () => {
    let sawStoppageEvent = false;
    for (let seed = 1; seed <= 40; seed++) {
      withSeededRandom(seed, () => {
        const { homeClub, awayClub, homePlayers, awayPlayers } = setup();
        const h1 = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45, undefined, undefined, undefined, 'home');
        for (const ev of h1.events) expect(ev.minute).toBeLessThanOrEqual(45);
        expect(h1.events[h1.events.length - 1].type).toBe('half_time');
        if (h1.events.some(e => e.displayMinute?.startsWith('45+') && e.type !== 'half_time')) sawStoppageEvent = true;
      });
    }
    // The sample must actually exercise stoppage time, or the loop above proves nothing.
    expect(sawStoppageEvent).toBe(true);
  });

  it('minutes never decrease across the first half, a segmented second half and extra time', () => {
    for (let seed = 1; seed <= 20; seed++) {
      withSeededRandom(seed, () => {
        const { homeClub, awayClub, homePlayers, awayPlayers } = setup();
        let state = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45, undefined, undefined, undefined, 'home');
        const firstHalfCount = state.events.length;
        // Mirror MatchDay: the second half is simulated segment by segment.
        let from = 46;
        for (const boundary of SECOND_HALF_SEGMENTS) {
          state = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, from, boundary, undefined, undefined, undefined, 'home', state);
          from = boundary + 1;
        }
        for (const ev of state.events.slice(firstHalfCount)) {
          expect(ev.minute).toBeGreaterThanOrEqual(45);
          expect(ev.minute).toBeLessThanOrEqual(90);
        }
        state = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 91, 120, undefined, undefined, undefined, 'home', state);
        expectNonDecreasing(state.events);
      });
    }
  });
});
