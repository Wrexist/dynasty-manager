/**
 * Presentation-layer guardrails (Phase 5).
 *
 * These cover the four classes of bug the audit found in the "feel" layer,
 * all of which passed every existing test:
 *   - the Weekly Digest interrupting on weeks with nothing to act on;
 *   - continental silverware producing no ceremony at all;
 *   - celebration dedupe keys being thrown away on navigation;
 *   - the curated live-event list rotting into permanently-dead code.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { isWeeklyDigestSignificant, type WeeklyDigestSummary } from '@/config/ui';
import { detectTrophyMoments } from '@/utils/celebrations';
import type { LeagueTableEntry } from '@/types/game';
import { SPECIAL_EVENTS } from '@/config/liveEvents';
import { getUpcomingSpecialEvent } from '@/utils/liveEvents';
import { QUESTIONS, generatePressConference, resetPressConferenceMemory, PRESS_RECENT_MEMORY } from '@/data/pressConferences';

// ── Weekly digest significance ──

const quietWeek = (over: Partial<WeeklyDigestSummary> = {}): WeeklyDigestSummary => ({
  injuriesThisWeek: [],
  recoveriesThisWeek: [],
  offersReceived: 0,
  moraleChange: 0,
  scoutReportsCompleted: 0,
  contractWarnings: [],
  objectiveProgress: [{ completed: false }, { completed: false }],
  ...over,
});

describe('isWeeklyDigestSignificant', () => {
  it('does not interrupt on a week with nothing to act on', () => {
    expect(isWeeklyDigestSignificant(quietWeek())).toBe(false);
  });

  it('does not interrupt for a small morale drift alone', () => {
    expect(isWeeklyDigestSignificant(quietWeek({ moraleChange: 3 }))).toBe(false);
    expect(isWeeklyDigestSignificant(quietWeek({ moraleChange: -4 }))).toBe(false);
  });

  it.each<[string, Partial<WeeklyDigestSummary>]>([
    ['an injury', { injuriesThisWeek: ['Kane'] }],
    ['a recovery', { recoveriesThisWeek: ['Kane'] }],
    ['a transfer offer', { offersReceived: 1 }],
    ['an expiring contract', { contractWarnings: ['Kane'] }],
    ['a scout report', { scoutReportsCompleted: 1 }],
    ['a completed objective', { objectiveProgress: [{ completed: true }] }],
    ['a big morale swing up', { moraleChange: 9 }],
    ['a big morale swing down', { moraleChange: -12 }],
  ])('interrupts for %s', (_label, over) => {
    expect(isWeeklyDigestSignificant(quietWeek(over))).toBe(true);
  });

  it('is false for a missing digest', () => {
    expect(isWeeklyDigestSignificant(null)).toBe(false);
    expect(isWeeklyDigestSignificant(undefined)).toBe(false);
  });
});

// ── Trophy ceremonies ──

const ME = 'my-club';
/** A table where nobody has clinched, so the league never contaminates a test. */
const openTable: LeagueTableEntry[] = [
  { clubId: ME, played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 1, goalsAgainst: 0, points: 3 },
  { clubId: 'rival', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 1, goalsAgainst: 0, points: 3 },
] as LeagueTableEntry[];

const detect = (over: Record<string, string | null> = {}) => detectTrophyMoments({
  playerClubId: ME,
  clubName: 'My Club',
  leagueTable: openTable,
  cupWinnerId: null,
  leagueCupWinnerId: null,
  ...over,
});

describe('detectTrophyMoments', () => {
  it('fires a ceremony for the Champions Cup — the pinnacle achievement', () => {
    const moments = detect({ championsCupWinnerId: ME });
    expect(moments).toHaveLength(1);
    expect(moments[0].id).toBe('championsCup');
    // Prestige-scaled copy, not the generic "have lifted the Cup" line.
    expect(moments[0].subtitle).toMatch(/Champions Cup/);
  });

  it.each(['shieldCup', 'conferenceCup', 'domesticSuperCup', 'continentalSuperCup'] as const)(
    'fires a ceremony for %s',
    (id) => {
      const moments = detect({ [`${id}WinnerId`]: ME });
      expect(moments.map(m => m.id)).toEqual([id]);
    },
  );

  it('ignores trophies won by other clubs', () => {
    expect(detect({
      championsCupWinnerId: 'rival',
      cupWinnerId: 'rival',
      leagueCupWinnerId: 'rival',
      shieldCupWinnerId: 'rival',
      conferenceCupWinnerId: 'rival',
      domesticSuperCupWinnerId: 'rival',
      continentalSuperCupWinnerId: 'rival',
    })).toEqual([]);
  });

  it('still fires the shipped domestic ceremonies', () => {
    expect(detect({ cupWinnerId: ME }).map(m => m.id)).toEqual(['cup']);
    expect(detect({ leagueCupWinnerId: ME }).map(m => m.id)).toEqual(['leagueCup']);
  });

  it('emits a treble in prestige order so the biggest trophy plays first', () => {
    const moments = detect({ championsCupWinnerId: ME, cupWinnerId: ME, leagueCupWinnerId: ME });
    expect(moments.map(m => m.id)).toEqual(['championsCup', 'cup', 'leagueCup']);
  });

  it('produces a unique dedupe id per trophy', () => {
    const moments = detect({
      championsCupWinnerId: ME, shieldCupWinnerId: ME, conferenceCupWinnerId: ME,
      cupWinnerId: ME, leagueCupWinnerId: ME,
      domesticSuperCupWinnerId: ME, continentalSuperCupWinnerId: ME,
    });
    const ids = moments.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Celebration dedupe (survives navigation, expires by season) ──

describe('recordCelebrationKeys', () => {
  beforeEach(() => {
    useGameStore.setState({ celebrationDedupe: { season: 1, keys: [] } });
  });

  it('returns a key once and never again in the same season', () => {
    const { recordCelebrationKeys } = useGameStore.getState();
    expect(recordCelebrationKeys(1, ['Top of the Table!'])).toEqual(['Top of the Table!']);
    expect(recordCelebrationKeys(1, ['Top of the Table!'])).toEqual([]);
    expect(recordCelebrationKeys(1, ['Top of the Table!'])).toEqual([]);
  });

  it('survives a simulated Dashboard unmount/remount', () => {
    const { recordCelebrationKeys } = useGameStore.getState();
    expect(recordCelebrationKeys(1, ['trophy-league'])).toHaveLength(1);
    // The old bug: dedupe lived in a useRef, and GameShell unmounts Dashboard on
    // every navigation. Re-reading the action from the store is exactly what a
    // remounted component does — the key must still be remembered.
    expect(useGameStore.getState().recordCelebrationKeys(1, ['trophy-league'])).toEqual([]);
  });

  it('deduplicates within a single call', () => {
    const { recordCelebrationKeys } = useGameStore.getState();
    expect(recordCelebrationKeys(1, ['a', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('resets the bucket when the season changes', () => {
    const { recordCelebrationKeys } = useGameStore.getState();
    recordCelebrationKeys(1, ['trophy-league']);
    expect(recordCelebrationKeys(2, ['trophy-league'])).toEqual(['trophy-league']);
    expect(useGameStore.getState().celebrationDedupe.keys).toEqual(['trophy-league']);
    expect(useGameStore.getState().celebrationDedupe.season).toBe(2);
  });

  it('keeps unrelated keys from the same season', () => {
    const { recordCelebrationKeys } = useGameStore.getState();
    recordCelebrationKeys(3, ['a']);
    recordCelebrationKeys(3, ['b']);
    expect(useGameStore.getState().celebrationDedupe.keys).toEqual(['a', 'b']);
  });
});

// ── Press-conference variety ──

describe('generatePressConference', () => {
  beforeEach(() => resetPressConferenceMemory());

  it('never asks the same question twice in a row', () => {
    let previous = '';
    for (let i = 0; i < 60; i++) {
      const press = generatePressConference('post_win');
      expect(press.question).not.toBe(previous);
      previous = press.question;
    }
  });

  it('cycles through more than one question across a run of the same context', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(generatePressConference('post_loss').question);
    expect(seen.size).toBeGreaterThan(2);
  });

  it('keeps the recency window smaller than every question pool', () => {
    // A memory >= pool size would exclude every option and defeat the buffer.
    for (const [context, pool] of Object.entries(QUESTIONS)) {
      expect(pool.length, `${context} pool`).toBeGreaterThan(PRESS_RECENT_MEMORY);
    }
  });

  it('still returns a well-formed conference with the Pro option', () => {
    const press = generatePressConference('post_win', true);
    expect(press.options.length).toBe(4);
    expect(press.hasProOption).toBe(true);
  });
});

// ── Live events ──

describe('SPECIAL_EVENTS', () => {
  it('has forward-dated events so the "next event" teaser is not dead code', () => {
    // The bug: the list held only the 2026 World Cup (ended 2026-07-19), so
    // getUpcomingSpecialEvent returned null forever.
    const dayAfterWorldCup = new Date('2026-07-20T12:00:00');
    expect(SPECIAL_EVENTS.filter(e => e.start > '2026-07-19').length).toBeGreaterThanOrEqual(2);
    expect(getUpcomingSpecialEvent(dayAfterWorldCup, 45)).not.toBeNull();
  });

  it('every event has a sane window and an ascending reward track', () => {
    for (const e of SPECIAL_EVENTS) {
      expect(e.start, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.end, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.end > e.start, `${e.id} window`).toBe(true);
      expect(e.tiers.length, e.id).toBeGreaterThan(0);
      for (let i = 1; i < e.tiers.length; i++) {
        expect(e.tiers[i].points, `${e.id} tier ${i}`).toBeGreaterThan(e.tiers[i - 1].points);
      }
    }
  });

  it('has unique event ids (progress is namespaced by id)', () => {
    const ids = SPECIAL_EVENTS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
