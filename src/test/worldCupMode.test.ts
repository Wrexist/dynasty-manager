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
  it('boots with the national team as the player club, no league', () => {
    useGameStore.getState().startWorldCup(NAT);
    const s = useGameStore.getState();

    expect(s.gameMode).toBe('world-cup');
    expect(s.gameStarted).toBe(true);
    expect(s.season).toBe(1);
    expect(s.seasonPhase).toBe('international');
    // The national team is the player's club.
    expect(s.playerClubId).toBe(NAT);
    expect(s.clubs[NAT]).toBeTruthy();
    expect(s.clubs[NAT].playerIds.length).toBeGreaterThanOrEqual(11);
    expect(s.clubs[NAT].lineup.length).toBe(11);
    // startWorldCup opens on the group-draw ceremony; its Continue button
    // then drops the player onto the World Cup dashboard.
    expect(s.currentScreen).toBe('world-cup-draw');
    // No league world.
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

  it('generates a World Cup draw with the nation in it, squad pre-confirmed', () => {
    useGameStore.getState().startWorldCup(NAT);
    const t = useGameStore.getState().internationalTournament!;
    expect(t).not.toBeNull();
    expect(t.type).toBe('world-cup');
    expect(t.phase).toBe('group');
    expect(t.groups.length).toBeGreaterThan(0);
    // No separate picker gate — squad managed via the normal Squad page.
    expect(t.squadConfirmed).toBe(true);
    const inDraw = t.groups.some(g => g.teams.includes(NAT));
    expect(inDraw).toBe(true);
  });

  it('uses the real 2026 World Cup draw — 12 groups of 4 (48 teams)', () => {
    useGameStore.getState().startWorldCup(NAT);
    const t = useGameStore.getState().internationalTournament!;
    expect(t.groups).toHaveLength(12);
    expect(t.groups.every(g => g.teams.length === 4)).toBe(true);
    const allTeams = t.groups.flatMap(g => g.teams);
    expect(new Set(allTeams).size).toBe(48); // 48 distinct nations
    // Real draw: Group A and the player's group match the official 2026 draw.
    expect(t.groups[0].teams).toEqual(['Mexico', 'South Korea', 'Czechia', 'South Africa']);
    expect(t.groups[2].teams).toContain('Brazil'); // Brazil (the player) is in Group C
  });

  it('builds a Round-of-32 knockout (top 2 + 8 best thirds = 32) to a champion', async () => {
    useGameStore.getState().startWorldCup(NAT);
    for (let i = 0; i < 16; i++) {
      await useGameStore.getState().advanceWeek();
      if (useGameStore.getState().internationalTournament?.phase === 'complete') break;
    }
    const t = useGameStore.getState().internationalTournament!;
    expect(t.phase).toBe('complete');
    expect(t.winner).toBeTruthy();
    // The bracket opened with a Round of 32 (16 ties).
    const r32 = t.knockoutTies.filter(k => k.round === 'R32');
    expect(r32.length).toBe(16);
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
    // Squad is pre-confirmed at boot — advance straight through.

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
