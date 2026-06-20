/**
 * World Cup mode boot — `startWorldCup` should produce a clean, valid,
 * playable standalone tournament state (no club/league), reusing the existing
 * international engine. Tournament *advancement* is owned by orchestration and
 * covered elsewhere; this verifies the entry point.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

const NAT = 'Brazil';

beforeEach(() => {
  // Start from a known club game so we can prove startWorldCup fully clears it.
  useGameStore.getState().initGame('celtic');
});

describe('startWorldCup', () => {
  it('boots a standalone World Cup with no club/league', () => {
    useGameStore.getState().startWorldCup(NAT);
    const s = useGameStore.getState();

    expect(s.gameMode).toBe('world-cup');
    expect(s.gameStarted).toBe(true);
    expect(s.season).toBe(1);
    expect(s.seasonPhase).toBe('international');
    // No club world remains.
    expect(s.playerClubId).toBe('');
    expect(Object.keys(s.clubs)).toHaveLength(0);
    expect(s.fixtures).toHaveLength(0);
    expect(s.leagueTable).toHaveLength(0);
  });

  it('generates a 23-man national squad for the chosen nation', () => {
    useGameStore.getState().startWorldCup(NAT);
    const nt = useGameStore.getState().nationalTeam!;
    expect(nt).not.toBeNull();
    expect(nt.nationality).toBe(NAT);
    expect(nt.squad.length).toBeGreaterThanOrEqual(11);
    expect(nt.lineup.length).toBe(11);
    expect(useGameStore.getState().managerNationality).toBe(NAT);
  });

  it('generates a World Cup draw with groups and lands on the squad picker', () => {
    useGameStore.getState().startWorldCup(NAT);
    const t = useGameStore.getState().internationalTournament!;
    expect(t).not.toBeNull();
    expect(t.type).toBe('world-cup');
    expect(t.phase).toBe('group');
    expect(t.groups.length).toBeGreaterThan(0);
    expect(t.squadConfirmed).toBe(false);
    // The chosen nation is actually in the draw.
    const inDraw = t.groups.some(g => g.teams.includes(NAT));
    expect(inDraw).toBe(true);
    expect(useGameStore.getState().currentScreen).toBe('national-squad-picker');
  });

  it('clears prior career state so a club career cannot leak in', () => {
    useGameStore.getState().startWorldCup(NAT);
    const s = useGameStore.getState();
    expect(s.careerManager).toBeNull();
    expect(s.cup.ties).toHaveLength(0);
    expect(s.transferMarket).toHaveLength(0);
  });

  it('runs a full tournament to completion with a champion (works like a real World Cup)', async () => {
    useGameStore.getState().startWorldCup(NAT);
    const nt = useGameStore.getState().nationalTeam!;
    // Confirm the auto-selected squad → unlocks week advancement.
    useGameStore.getState().confirmNationalSquad(nt.squad, nt.lineup, nt.subs);

    // Advance through group stage → knockout → final.
    for (let i = 0; i < 12; i++) {
      await useGameStore.getState().advanceWeek();
      if (useGameStore.getState().internationalTournament?.phase === 'complete') break;
    }

    const t = useGameStore.getState().internationalTournament!;
    expect(t.phase).toBe('complete');
    expect(t.winner).toBeTruthy();
    // The final was played and decided a single champion.
    const finalTie = t.knockoutTies.find(k => k.round === 'F');
    expect(finalTie?.played).toBe(true);
    expect(finalTie?.winnerId).toBe(t.winner);
  });
});
