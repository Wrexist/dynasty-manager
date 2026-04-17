import { describe, it, expect } from 'vitest';
import { CORNER_ROUTINES, FREE_KICK_ROUTINES, DEFAULT_SET_PIECE_ROUTINES } from '@/config/setPieces';
import { getCornerRoutine, getFreeKickRoutine, applyCornerHeaderBias } from '@/utils/setPieces';
import type { Club } from '@/types/game';

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'c',
    name: 'Test Club',
    shortName: 'TST',
    color: '#fff',
    secondaryColor: '#000',
    budget: 1_000_000,
    wageBill: 0,
    reputation: 3,
    facilities: 5,
    youthRating: 5,
    fanBase: 5,
    boardPatience: 70,
    playerIds: [],
    formation: '4-4-2',
    lineup: [],
    subs: [],
    divisionId: 'eng',
    ...overrides,
  } as Club;
}

describe('setPieces', () => {
  describe('CORNER_ROUTINES', () => {
    it('defines all four corner variants', () => {
      expect(Object.keys(CORNER_ROUTINES)).toEqual(
        expect.arrayContaining(['near-post-flick', 'far-post-delivery', 'short-corner', 'driven-low']),
      );
    });

    it('short-corner trades goal chance for possession (goalChanceMult < 1)', () => {
      expect(CORNER_ROUTINES['short-corner'].goalChanceMult).toBeLessThan(1.0);
    });

    it('near-post-flick biases toward physical headers', () => {
      expect(CORNER_ROUTINES['near-post-flick'].physicalBias).toBeGreaterThan(0);
    });

    it('far-post-delivery is the neutral default (goalChanceMult = 1.0, physicalBias = 0)', () => {
      const d = CORNER_ROUTINES['far-post-delivery'];
      expect(d.goalChanceMult).toBe(1.0);
      expect(d.physicalBias).toBe(0);
    });
  });

  describe('FREE_KICK_ROUTINES', () => {
    it('defines all four free-kick variants', () => {
      expect(Object.keys(FREE_KICK_ROUTINES)).toEqual(
        expect.arrayContaining(['curled-direct', 'driven-power', 'short-pass', 'dummy-run']),
      );
    });

    it('curled-direct is friendliest to the designated taker (negative thresholdShift)', () => {
      expect(FREE_KICK_ROUTINES['curled-direct'].thresholdShift).toBeLessThan(0);
    });

    it('short-pass favours indirect play', () => {
      expect(FREE_KICK_ROUTINES['short-pass'].favourIndirect).toBe(true);
      expect(FREE_KICK_ROUTINES['short-pass'].goalChanceMult).toBeLessThan(1.0);
    });
  });

  describe('DEFAULT_SET_PIECE_ROUTINES', () => {
    it('defaults to far-post-delivery + curled-direct', () => {
      expect(DEFAULT_SET_PIECE_ROUTINES).toEqual({ corner: 'far-post-delivery', freeKick: 'curled-direct' });
    });
  });

  describe('getCornerRoutine / getFreeKickRoutine', () => {
    it('returns default when club has no routines set', () => {
      const c = makeClub();
      expect(getCornerRoutine(c).label).toBe('Far Post Delivery');
      expect(getFreeKickRoutine(c).label).toBe('Curled Direct');
    });

    it('returns selected corner routine', () => {
      const c = makeClub({ setPieceRoutines: { corner: 'short-corner', freeKick: 'driven-power' } });
      expect(getCornerRoutine(c).label).toBe('Short Corner');
      expect(getFreeKickRoutine(c).label).toBe('Driven Power');
    });

    it('falls back to default on unknown routine id', () => {
      const c = makeClub({ setPieceRoutines: { corner: 'nonexistent' as 'short-corner', freeKick: 'ghost' as 'curled-direct' } });
      expect(getCornerRoutine(c).label).toBe('Far Post Delivery');
      expect(getFreeKickRoutine(c).label).toBe('Curled Direct');
    });
  });

  describe('applyCornerHeaderBias', () => {
    it('returns base weight when bias is zero', () => {
      expect(applyCornerHeaderBias(100, 80, 60, 0)).toBe(100);
    });

    it('positive physicalBias rewards physical-heavy players', () => {
      const strong = applyCornerHeaderBias(100, 85, 60, 0.2);
      const skilled = applyCornerHeaderBias(100, 65, 80, 0.2);
      expect(strong).toBeGreaterThan(skilled);
    });

    it('negative physicalBias rewards shooters', () => {
      const strong = applyCornerHeaderBias(100, 85, 60, -0.2);
      const skilled = applyCornerHeaderBias(100, 65, 80, -0.2);
      expect(skilled).toBeGreaterThan(strong);
    });

    it('never returns a weight below 1 (floor)', () => {
      expect(applyCornerHeaderBias(5, 20, 95, 1.0)).toBeGreaterThanOrEqual(1);
    });
  });
});
