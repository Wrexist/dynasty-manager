/**
 * Changing formation during a live match re-shapes the XI on the pitch — it
 * must not swap players. `setFormation` re-picks the best XI from the whole
 * squad, which is right before kickoff; mid-match it handed the manager free,
 * uncounted substitutions (the second half resumes from `club.lineup`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { Player } from '@/types/game';

const CLUB = 'arsenal';

describe('formation change during a live match', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
  });

  it('keeps the same eleven players, only re-slotted', { timeout: 60_000 }, () => {
    // Bench a strong player so a fresh best-XI pick would bring him back on.
    const s0 = useGameStore.getState();
    const club = s0.clubs[CLUB];
    const star = club.lineup.map(id => s0.players[id]).filter((p): p is Player => !!p && p.position !== 'GK')
      .sort((a, b) => b.overall - a.overall)[0];
    const sub = club.subs.find(id => s0.players[id]?.position === star.position) ?? club.subs[0];
    useGameStore.getState().updateLineup(club.lineup.map(id => (id === star.id ? sub : id)), [...club.subs.filter(id => id !== sub), star.id]);

    expect(useGameStore.getState().playFirstHalf()).toBeTruthy();
    const kickoffXI = new Set(useGameStore.getState().clubs[CLUB].lineup);
    expect(kickoffXI.has(star.id)).toBe(false);

    const next = useGameStore.getState().clubs[CLUB].formation === '4-3-3' ? '4-4-2' : '4-3-3';
    useGameStore.getState().setFormation(next);
    const after = useGameStore.getState().clubs[CLUB];
    expect(after.formation).toBe(next);
    expect(new Set(after.lineup)).toEqual(kickoffXI);

    // And the second half is played by them: the benched star never acts.
    const result = useGameStore.getState().playSecondHalf(90)!;
    expect(result).toBeTruthy();
    const acted = result.events.filter(e => e.minute > 45 && e.type !== 'substitution' && (e.playerId === star.id || e.assistPlayerId === star.id));
    expect(acted).toEqual([]);
  });

  it('before kickoff it still picks the best XI for the new shape', () => {
    const before = new Set(useGameStore.getState().clubs[CLUB].lineup);
    const next = useGameStore.getState().clubs[CLUB].formation === '3-5-2' ? '4-4-2' : '3-5-2';
    useGameStore.getState().setFormation(next);
    const after = useGameStore.getState().clubs[CLUB];
    expect(after.lineup).toHaveLength(11);
    expect(after.formation).toBe(next);
    expect(before.size).toBe(11);
  });
});

describe('Optimize Lineup during a live match', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
    const s = useGameStore.getState();
    useGameStore.setState({ monetization: { ...s.monetization, entitlements: ['com.dynastymanager.pro'] } });
  });

  it('chooses only from the matchday squad — a reserve off the bench never comes on', { timeout: 60_000 }, () => {
    const s0 = useGameStore.getState();
    const club = s0.clubs[CLUB];
    const matchday = new Set([...club.lineup, ...club.subs]);
    const reserveId = club.playerIds.find(id => !matchday.has(id) && s0.players[id]?.position !== 'GK');
    expect(reserveId).toBeTruthy();
    const r = s0.players[reserveId!];
    // Make him the best player at the club: a whole-squad pick would start him.
    useGameStore.setState({ players: { ...s0.players, [r.id]: { ...r, overall: 99, injured: false } } });

    expect(useGameStore.getState().playFirstHalf()).toBeTruthy();
    const before = useGameStore.getState().clubs[CLUB];
    const beforeSet = new Set([...before.lineup, ...before.subs]);
    const res = useGameStore.getState().autoFillTeam();
    expect(res.proRequired).toBeFalsy();
    const after = useGameStore.getState().clubs[CLUB];
    expect(after.lineup).not.toContain(r.id);
    expect(after.subs).not.toContain(r.id);
    // Same matchday squad, just redistributed.
    expect(new Set([...after.lineup, ...after.subs])).toEqual(beforeSet);
  });
});
