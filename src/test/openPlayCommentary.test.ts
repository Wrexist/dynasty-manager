import { describe, it, expect } from 'vitest';
import { openPlayLine, openPlayCaptionAt } from '@/utils/openPlayCommentary';
import { buildMatchTimeline } from '@/engine/match/choreography';
import type { Club, Match } from '@/types/game';

function makeClub(id: string, over: Partial<Club> = {}): Club {
  return {
    id, name: id, shortName: id === 'home' ? 'HOM' : 'AWY', color: '#e11d2a', secondaryColor: '#fff',
    budget: 0, wageBill: 0, reputation: 50, facilities: 50, youthRating: 50, fanBase: 1000,
    boardPatience: 50, playerIds: [], formation: '4-3-3',
    lineup: Array.from({ length: 11 }, (_, i) => `${id}-p${i + 1}`), subs: [],
    divisionId: 'epl' as Club['divisionId'], ...over,
  };
}
const makeMatch = (over: Partial<Match> = {}): Match => ({
  id: 'm1', week: 1, homeClubId: 'home', awayClubId: 'away', played: true,
  homeGoals: 0, awayGoals: 0, events: [], ...over,
});

const home = makeClub('home');
const away = makeClub('away');

describe('openPlayLine', () => {
  const base = { matchId: 'm1', minute: 30, teamShort: 'ARS', advancement: 50 };

  it('is deterministic for the same inputs', () => {
    expect(openPlayLine(base)).toBe(openPlayLine(base));
  });

  it('fills {team} and never leaks a {carrier} placeholder when no carrier is known', () => {
    for (let m = 1; m <= 90; m++) {
      const line = openPlayLine({ ...base, minute: m, advancement: (m * 7) % 100 });
      expect(line).not.toContain('{');
      expect(line).not.toContain('}');
    }
  });

  it('uses the carrier surname when supplied (no placeholder, non-empty)', () => {
    const line = openPlayLine({ ...base, carrierName: 'Ødegaard', advancement: 70 });
    expect(line.length).toBeGreaterThan(3);
    expect(line).not.toContain('{');
  });

  it('varies the line across minutes (not one stuck phrase all match)', () => {
    const lines = new Set<string>();
    for (let m = 1; m <= 90; m++) lines.add(openPlayLine({ ...base, minute: m, carrierName: 'Smith', advancement: (m * 13) % 100 }));
    expect(lines.size).toBeGreaterThan(4);
  });
});

describe('openPlayCaptionAt', () => {
  it('returns null before kickoff (minute 0)', () => {
    const tl = buildMatchTimeline(makeMatch(), home, away);
    expect(openPlayCaptionAt(tl, 0, 'HOM', 'AWY')).toBeNull();
  });

  it('produces a synced, placeholder-free line for an open-play minute', () => {
    const tl = buildMatchTimeline(makeMatch(), home, away);
    const cap = openPlayCaptionAt(tl, 30, 'HOM', 'AWY');
    expect(cap).not.toBeNull();
    expect(cap!.minute).toBe("30'");
    expect(cap!.text).not.toContain('{');
    // Names one of the two sides.
    expect(cap!.text.includes('HOM') || cap!.text.includes('AWY')).toBe(true);
  });

  it('is deterministic — same timeline + minute says the same thing', () => {
    const tl = buildMatchTimeline(makeMatch(), home, away);
    expect(openPlayCaptionAt(tl, 44, 'HOM', 'AWY')).toEqual(openPlayCaptionAt(tl, 44, 'HOM', 'AWY'));
  });
});
