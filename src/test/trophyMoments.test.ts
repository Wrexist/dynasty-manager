/**
 * Trophy-moment detection (G4). Pure mapping from confirmed state to ceremony
 * triggers — the audio/visual is wired in the component; here we only assert
 * the detection + the conservative clinch maths.
 */
import { describe, it, expect } from 'vitest';
import { detectTrophyMoments, isLeagueTitleClinched } from '@/utils/celebrations';
import type { LeagueTableEntry } from '@/types/game';

/** Minimal table entry — detection only reads clubId / played / points. */
function entry(clubId: string, points: number, played: number): LeagueTableEntry {
  return {
    clubId, played, points,
    won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
    goalDifference: 0, form: [], cleanSheets: 0,
  };
}

// A 4-team league → 6 games each (2 * (4 - 1)).
describe('isLeagueTitleClinched', () => {
  it('is false when the player is not top', () => {
    const table = [entry('rival', 40, 6), entry('me', 30, 6)];
    expect(isLeagueTitleClinched('me', table)).toBe(false);
  });

  it('is false mid-season when a chaser can still catch up', () => {
    // 4-team league → 6 games each. rival on 15 with 2 to play → ceiling 21 > 20.
    const table = [entry('me', 20, 5), entry('rival', 15, 4), entry('c', 5, 6), entry('d', 3, 6)];
    expect(isLeagueTitleClinched('me', table)).toBe(false);
  });

  it('is true once no chaser can reach the leader on points', () => {
    // Final day: me 21 (6 played), best rival ceiling 18 (6 played) → clinched.
    const table = [entry('me', 21, 6), entry('rival', 18, 6), entry('c', 10, 6), entry('d', 4, 6)];
    expect(isLeagueTitleClinched('me', table)).toBe(true);
  });

  it('is conservative on an exact points tie (never a false clinch)', () => {
    const table = [entry('me', 18, 6), entry('rival', 18, 6)];
    expect(isLeagueTitleClinched('me', table)).toBe(false);
  });

  it('returns false for degenerate tables', () => {
    expect(isLeagueTitleClinched('me', [])).toBe(false);
    expect(isLeagueTitleClinched('me', [entry('me', 3, 1)])).toBe(false);
    expect(isLeagueTitleClinched('me', [entry('other', 3, 1), entry('x', 0, 1)])).toBe(false);
  });
});

describe('detectTrophyMoments', () => {
  const base = {
    playerClubId: 'me',
    clubName: 'My FC',
    leagueTable: [entry('rival', 40, 6), entry('me', 20, 6)], // not clinched
    cupWinnerId: null as string | null,
    leagueCupWinnerId: null as string | null,
  };

  it('emits nothing with no silverware', () => {
    expect(detectTrophyMoments(base)).toEqual([]);
  });

  it('emits a cup moment only when the player is the cup winner', () => {
    expect(detectTrophyMoments({ ...base, cupWinnerId: 'rival' })).toEqual([]);
    const got = detectTrophyMoments({ ...base, cupWinnerId: 'me' });
    expect(got.map(m => m.id)).toEqual(['cup']);
    expect(got[0].subtitle).toContain('My FC');
  });

  it('emits a league-cup moment for the player', () => {
    expect(detectTrophyMoments({ ...base, leagueCupWinnerId: 'me' }).map(m => m.id)).toEqual(['leagueCup']);
  });

  it('emits a double (league + cup) when both are confirmed', () => {
    const got = detectTrophyMoments({
      ...base,
      leagueTable: [entry('me', 21, 6), entry('rival', 18, 6)], // clinched
      cupWinnerId: 'me',
    });
    expect(got.map(m => m.id)).toEqual(['league', 'cup']);
  });
});
