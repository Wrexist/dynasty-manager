/**
 * A live match is played by ONE XI per side, from kickoff to the final whistle.
 *
 * The second half, extra time and the shootout rebuilt both sides from raw
 * `club.lineup`, while the first half builds them with `buildMatchSquad`
 * (injured / suspended players left out, holes filled). An AI club's
 * `club.lineup` is only written at game start and season end, so after
 * half-time a stale XI took the field: a player the first half had rightly
 * left out as injured played on (audit runs: 5 of 5, one scored), and the
 * user's own injured selection did the same. Kickoff now rewrites the user's
 * lineup to the XI that actually started; the AI side is re-picked the way the
 * first half picked it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { fieldedLineup } from '@/store/slices/orchestration/matchActions';
import type { Player } from '@/types/game';

const CLUB = 'arsenal';

function injure(id: string) {
  const s = useGameStore.getState();
  const p = s.players[id];
  useGameStore.setState({
    players: { ...s.players, [id]: { ...p, injured: true, injuryWeeks: 3, injuryDetails: { type: 'hamstring', weeksRemaining: 3 } as Player['injuryDetails'] } as Player },
  });
}

function opponentId(): string {
  const s = useGameStore.getState();
  const m = s.fixtures.find(f => f.week === s.week && !f.played && (f.homeClubId === CLUB || f.awayClubId === CLUB))!;
  return m.homeClubId === CLUB ? m.awayClubId : m.homeClubId;
}

describe('one XI per side for the whole live match', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
  });

  it('an injured player left out at kickoff never acts in the second half — either side', { timeout: 60_000 }, () => {
    const s0 = useGameStore.getState();
    const mine = s0.clubs[CLUB].lineup[4];
    const oppId = opponentId();
    // The opponent's stale saved XI: injure its first outfielder.
    const theirs = s0.clubs[oppId].lineup.find(id => s0.players[id]?.position !== 'GK')!;
    injure(mine);
    injure(theirs);

    expect(useGameStore.getState().playFirstHalf()).toBeTruthy();
    const lineup = useGameStore.getState().clubs[CLUB].lineup;
    expect(lineup).not.toContain(mine);
    expect(lineup).toHaveLength(11);

    const result = useGameStore.getState().playSecondHalf(90)!;
    expect(result).toBeTruthy();
    const acted = result.events.filter(e => e.minute > 45 && (e.playerId === mine || e.playerId === theirs || e.assistPlayerId === mine || e.assistPlayerId === theirs));
    expect(acted).toEqual([]);
  });

  it('fieldedLineup puts each stand-in in the slot of the player he covers', () => {
    const p = (id: string) => ({ id }) as Player;
    // B (slot 1) and D (slot 3) are out; X and Y cover them, in that order.
    expect(fieldedLineup(['A', 'B', 'C', 'D'], [p('A'), p('C'), p('X'), p('Y')])).toEqual(['A', 'X', 'C', 'Y']);
    // More cover than holes goes on the end; duplicates are dropped.
    expect(fieldedLineup(['A', 'A', 'B'], [p('A'), p('B'), p('Z')])).toEqual(['A', 'B', 'Z']);
  });
});
