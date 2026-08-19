/**
 * The player's own match must always be startable.
 *
 * REPORTED FROM A LIVE SAVE. Feyenoord, season 4 week 16, League Cup at home to
 * a PSV carrying 8 injured in a 22-man squad: tapping Kick Off did nothing at
 * all — no match, no toast, no navigation — and Instant Sim was dead the same
 * way, so the save could not be advanced past that fixture.
 *
 * Both `playFirstHalfImpl` and `playCurrentMatchImpl` topped the XI up from the
 * squad and then returned `null` on `< AI_MIN_MATCH_PLAYERS`. `pickAiMatchSquad`
 * has had an emergency tier for exactly this since the forfeit fix — a thin
 * squad in an injury crisis fields who it has rather than forfeiting — and the
 * player's own club now gets the same rule via `buildPlayerMatchXI`.
 *
 * `emergencyXiKeepsTheFixturePlayable` is the test that fails against the
 * pre-fix code.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { buildPlayerMatchXI } from '@/store/slices/orchestration/matchActions';
import { AI_MIN_MATCH_PLAYERS } from '@/config/aiSimulation';
import type { Club, Player } from '@/types/game';

const CLUB_ID = 'manchester-city';

function player(id: string, over: Partial<Player> = {}): Player {
  return {
    id, name: id, firstName: id, lastName: id, age: 25, position: 'CM',
    overall: 70, potential: 75, clubId: 'c', value: 1, wage: 1, contractEnd: 2030,
    morale: 70, fitness: 100, form: 7, injured: false, injuryWeeks: 0,
    nationality: 'England', attributes: {}, ...over,
  } as unknown as Player;
}

function club(players: Player[], over: Partial<Club> = {}): Club {
  return {
    id: 'c', name: 'C', shortName: 'C', color: '#fff', formation: '4-4-2',
    playerIds: players.map(p => p.id),
    lineup: players.slice(0, 11).map(p => p.id),
    subs: players.slice(11, 18).map(p => p.id),
    ...over,
  } as unknown as Club;
}

function byId(players: Player[]): Record<string, Player> {
  return Object.fromEntries(players.map(p => [p.id, p]));
}

describe('buildPlayerMatchXI', () => {
  it('fields eleven fit men from the whole squad, not just the named bench', () => {
    // The reported shape: 22 registered, 8 injured, and the injuries land on the
    // saved XI and the named bench alike.
    const squad = Array.from({ length: 22 }, (_, i) => player(`p${i}`, { injured: i % 3 === 0 }));
    const injuredCount = squad.filter(p => p.injured).length;
    expect(injuredCount).toBeGreaterThanOrEqual(7);

    const xi = buildPlayerMatchXI(club(squad), byId(squad), 16);

    expect(xi).toHaveLength(11);
    expect(xi.every(p => !p.injured)).toBe(true);
    expect(new Set(xi.map(p => p.id)).size).toBe(11);
  });

  it('keeps the manager\'s saved XI order when everyone in it is available', () => {
    const squad = Array.from({ length: 20 }, (_, i) => player(`p${i}`));
    const xi = buildPlayerMatchXI(club(squad), byId(squad), 1);
    expect(xi.map(p => p.id)).toEqual(squad.slice(0, 11).map(p => p.id));
  });

  it('emergencyXiKeepsTheFixturePlayable: covers from the injury list rather than field fewer than seven', () => {
    // 18 registered, 14 of them injured — four fit men. Pre-fix this returned 4
    // and the caller's `< 7` guard turned it into a null, i.e. a dead button.
    const squad = Array.from({ length: 18 }, (_, i) => player(`p${i}`, {
      injured: i >= 4,
      injuryDetails: i >= 4 ? ({ weeksRemaining: 20 - i } as Player['injuryDetails']) : undefined,
    }));
    const xi = buildPlayerMatchXI(club(squad), byId(squad), 1);

    expect(xi).toHaveLength(AI_MIN_MATCH_PLAYERS);
    // The four fit players first, then the least-injured cover.
    expect(xi.slice(0, 4).every(p => !p.injured)).toBe(true);
    const cover = xi.slice(4);
    expect(cover.every(p => p.injured)).toBe(true);
    const weeks = cover.map(p => p.injuryDetails?.weeksRemaining ?? 0);
    expect([...weeks].sort((a, b) => a - b)).toEqual(weeks);
  });

  it('never fields a player who is out on loan, not even as emergency cover', () => {
    const squad = Array.from({ length: 18 }, (_, i) => player(`p${i}`, {
      injured: i >= 3 && i < 12,
      onLoan: i >= 12,
    }));
    const xi = buildPlayerMatchXI(club(squad), byId(squad), 1);
    expect(xi.every(p => !p.onLoan)).toBe(true);
    expect(xi.length).toBeGreaterThanOrEqual(AI_MIN_MATCH_PLAYERS);
  });
});

describe('the player can always kick off', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('starts the match with an opponent in an injury crisis', async () => {
    // Walk to the player's next league fixture.
    let opponentId = '';
    for (let i = 0; i < 8 && !opponentId; i++) {
      const s = useGameStore.getState();
      const fx = s.fixtures.find(m => m.week === s.week && !m.played && (m.homeClubId === CLUB_ID || m.awayClubId === CLUB_ID));
      if (fx) { opponentId = fx.homeClubId === CLUB_ID ? fx.awayClubId : fx.homeClubId; break; }
      await useGameStore.getState().advanceWeek();
    }
    expect(opponentId).toBeTruthy();

    // Injure all but three of the opponent's squad, the way four seasons of the
    // never-healing-injuries bug left the division.
    const state = useGameStore.getState();
    const opponent = state.clubs[opponentId];
    const players = { ...state.players };
    opponent.playerIds.slice(3).forEach((id, i) => {
      players[id] = { ...players[id], injured: true, injuryWeeks: 4, injuryDetails: { weeksRemaining: 4 + i } as Player['injuryDetails'] };
    });
    useGameStore.setState({ players });

    const halfState = useGameStore.getState().playFirstHalf();
    expect(halfState).not.toBeNull();
  }, 60_000);
});
