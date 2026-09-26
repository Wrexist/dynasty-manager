/**
 * A neutral venue is nobody's home (item 8).
 *
 * `Match.neutral` removes HOME_ADVANTAGE in the engine for finals, Super Cups,
 * the playoff final and tournament matches. `processMatchResult` still keyed
 * Fortress Mentality ("home wins give +3 squad morale") on being the nominal
 * home side, so winning a Cup Final listed as the home team paid the perk at
 * Wembley.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { processMatchResult } from '@/store/helpers/matchProcessing';
import type { Match } from '@/types/game';

const CLUB = 'arsenal';

function moraleAfterHomeWin(neutral: boolean, perk: boolean): number {
  const s = useGameStore.getState();
  const opp = s.fixtures.find(m => m.homeClubId === CLUB || m.awayClubId === CLUB)!;
  const oppId = opp.homeClubId === CLUB ? opp.awayClubId : opp.homeClubId;
  const match: Match = {
    id: 'final', week: s.week, homeClubId: CLUB, awayClubId: oppId,
    played: false, homeGoals: 0, awayGoals: 0, events: [], ...(neutral ? { neutral: true } : {}),
  };
  const result: Match = { ...match, played: true, homeGoals: 2, awayGoals: 0 };
  // A bench player with no rating: only the team-result terms move his morale.
  const benchId = s.clubs[CLUB].playerIds.find(id => !s.clubs[CLUB].lineup.includes(id))!;
  const state = {
    ...s,
    players: { ...s.players, [benchId]: { ...s.players[benchId], morale: 50, personality: undefined } },
    managerProgression: {
      ...s.managerProgression,
      unlockedPerks: perk ? [...s.managerProgression.unlockedPerks, 'fortress_mentality'] : s.managerProgression.unlockedPerks.filter(p => p !== 'fortress_mentality'),
    },
    matchTeamTalk: null,
  } as typeof s;
  const { newPlayers } = processMatchResult(state, match, result, [], () => s.week);
  return newPlayers[benchId].morale;
}

describe('home-venue effects at a neutral ground', () => {
  beforeEach(async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await useGameStore.getState().initGame(CLUB);
  });
  afterEach(() => vi.restoreAllMocks());

  it('Fortress Mentality pays on a win at home', () => {
    expect(moraleAfterHomeWin(false, true)).toBeGreaterThan(moraleAfterHomeWin(false, false));
  });

  it('Fortress Mentality does not pay on a neutral-venue win as the home side', () => {
    expect(moraleAfterHomeWin(true, true)).toBe(moraleAfterHomeWin(true, false));
  });
});
