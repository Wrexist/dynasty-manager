import { describe, it, expect } from 'vitest';
import { evaluateHighStakes } from '@/utils/highStakesMatch';
import { SIX_POINTER_TOP_N } from '@/config/teamTalk';

const base = {
  derbyIntensity: 0,
  isKnockout: false,
  isLeagueMatch: true,
  homeClubId: 'a',
  awayClubId: 'b',
  leagueTable: [] as { clubId: string }[],
};

// A 20-team table a..t
const table = Array.from({ length: 20 }, (_, i) => ({ clubId: String.fromCharCode(97 + i) }));

describe('evaluateHighStakes', () => {
  it('flags a derby', () => {
    const r = evaluateHighStakes({ ...base, derbyIntensity: 3 });
    expect(r.highStakes).toBe(true);
    expect(r.reason).toBe('derby');
  });

  it('flags a knockout tie', () => {
    const r = evaluateHighStakes({ ...base, isKnockout: true, isLeagueMatch: false });
    expect(r.highStakes).toBe(true);
    expect(r.reason).toBe('knockout');
  });

  it('flags a top-of-table six-pointer (both clubs in the top N)', () => {
    // a = 1st, b = 2nd — both inside the top N.
    const r = evaluateHighStakes({ ...base, homeClubId: 'a', awayClubId: 'b', leagueTable: table });
    expect(r.highStakes).toBe(true);
    expect(r.reason).toBe('six-pointer');
  });

  it('flags a relegation six-pointer (both clubs in the bottom N)', () => {
    // s = 19th, t = 20th — both in the bottom N.
    const r = evaluateHighStakes({ ...base, homeClubId: 's', awayClubId: 't', leagueTable: table });
    expect(r.highStakes).toBe(true);
    expect(r.reason).toBe('six-pointer');
  });

  it('is NOT a six-pointer when only one club is near the top', () => {
    // a = 1st (top), but the opponent sits mid-table.
    const midClubId = table[SIX_POINTER_TOP_N + 2].clubId;
    const r = evaluateHighStakes({ ...base, homeClubId: 'a', awayClubId: midClubId, leagueTable: table });
    expect(r.highStakes).toBe(false);
    expect(r.reason).toBeNull();
  });

  it('does not apply the six-pointer rule to non-league matches', () => {
    const r = evaluateHighStakes({ ...base, isLeagueMatch: false, homeClubId: 'a', awayClubId: 'b', leagueTable: table });
    expect(r.highStakes).toBe(false);
  });

  it('returns not-high-stakes for a plain mid-table league match', () => {
    const r = evaluateHighStakes({ ...base, homeClubId: table[9].clubId, awayClubId: table[10].clubId, leagueTable: table });
    expect(r.highStakes).toBe(false);
    expect(r.reason).toBeNull();
  });
});
