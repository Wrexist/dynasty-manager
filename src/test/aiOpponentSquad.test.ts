/**
 * The AI side of the USER's match picks its squad the way it does against
 * anyone else.
 *
 * `playCurrentMatchImpl` / `playFirstHalfImpl` built both sides from
 * `club.lineup`. For an AI club that field is only written at game start and
 * season end, so the user always faced a stale August XI (gaps filled in squad
 * list order, ignoring position), while the same club fielded its real best XI
 * in every AI-vs-AI fixture via `pickAiMatchSquad`. `buildMatchSquad` routes the
 * AI side through `pickAiMatchSquad` and keeps the manager's selection for the
 * user's club.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { buildMatchSquad, buildPlayerMatchXI } from '@/store/slices/orchestration/matchActions';
import { pickAiMatchSquad } from '@/store/slices/orchestration/helpers';
import type { Club, Player } from '@/types/game';

const CLUB_ID = 'celtic';

function aiClub(): Club {
  const s = useGameStore.getState();
  return Object.values(s.clubs).find(c => c.id !== s.playerClubId && c.playerIds.length >= 22)!;
}

describe('buildMatchSquad', () => {
  beforeEach(() => { useGameStore.getState().initGame(CLUB_ID); });

  it('ignores an AI club\'s stale saved XI and fields its best available side', () => {
    const s = useGameStore.getState();
    const club = aiClub();
    const squad = club.playerIds.map(id => s.players[id]).filter(Boolean);
    // A stale XI: the eleven WORST players, the shape club.lineup takes after
    // a season of transfers and form it never saw.
    const worst = [...squad].sort((a, b) => a.overall - b.overall).slice(0, 11).map(p => p.id);
    const stale: Club = { ...club, lineup: worst, subs: [] };

    const { xi, bench } = buildMatchSquad(stale, s.players, s.week, s.playerClubId);
    const expected = pickAiMatchSquad(stale, s.players, s.week);
    expect(xi.map(p => p.id)).toEqual(expected.xi.map(p => p.id));
    expect(bench.map(p => p.id)).toEqual(expected.bench.map(p => p.id));

    const avg = (ps: Player[]) => ps.reduce((t, p) => t + p.overall, 0) / ps.length;
    expect(avg(xi)).toBeGreaterThan(avg(worst.map(id => s.players[id])));
    // Pre-fix path, for contrast: the stale XI is what took the field.
    expect(buildPlayerMatchXI(stale, s.players, s.week).map(p => p.id)).toEqual(worst);
  });

  it('never fields an injured or suspended AI player', () => {
    const s = useGameStore.getState();
    const club = aiClub();
    const players = { ...s.players };
    const [a, b] = club.lineup;
    players[a] = { ...players[a], injured: true, injuryWeeks: 5 };
    players[b] = { ...players[b], suspendedUntilWeek: s.week + 2 };
    const { xi, bench } = buildMatchSquad(club, players, s.week, s.playerClubId);
    expect(xi).toHaveLength(11);
    const ids = [...xi, ...bench].map(p => p.id);
    expect(ids).not.toContain(a);
    expect(ids).not.toContain(b);
  });

  it('keeps the manager\'s own selection for the user\'s club', () => {
    const s = useGameStore.getState();
    const club = s.clubs[s.playerClubId];
    const { xi, bench } = buildMatchSquad(club, s.players, s.week, s.playerClubId);
    expect(xi.map(p => p.id)).toEqual(buildPlayerMatchXI(club, s.players, s.week).map(p => p.id));
    const named = new Set(club.subs);
    expect(bench.every(p => named.has(p.id))).toBe(true);
  });

  it('the user can still kick off against an AI club', () => {
    expect(useGameStore.getState().playFirstHalf()).not.toBeNull();
  });
});
