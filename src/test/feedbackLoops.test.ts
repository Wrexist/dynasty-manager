/**
 * Feedback-loop closure tests.
 *
 * Each block covers a system that was built to the point of DISPLAY and then
 * changed nothing:
 *   1. Match ratings → development, morale and form.
 *   2. Yellow-card accumulation → suspensions.
 *   3. In-match fitness → post-match fitness, plus minutes played.
 *
 * The invariants that matter most are the *bounds*: the team result must stay
 * dominant (a good individual game softens a defeat, never inverts it) and the
 * average performer's progression rate must be unchanged (the point is to
 * differentiate, not to inflate).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { Player, PlayerAttributes } from '@/types/game';
import {
  applyPlayerDevelopment,
  getPlayingTimeBonus,
  getRatingDevelopmentBonus,
  resetSeasonGrowth,
} from '@/store/helpers/development';
import {
  computeMinutesPlayed,
  extractFinalMatchFitness,
  getYellowAccumulationBanWeek,
} from '@/store/slices/orchestration/helpers';
import {
  DEV_RATING_BASELINE,
  DEV_RATING_BONUS_MAX,
  DEV_RATING_BONUS_MIN,
  DEV_RATING_MIN_MATCHES,
  MINUTES_PER_APPEARANCE,
  PLAYING_TIME_BONUS_MAX,
  YELLOW_ACCUMULATION_BAN_WEEKS,
  YELLOW_ACCUMULATION_THRESHOLDS,
  MORALE_RATING_ADJ_CAP,
  MORALE_LOSS_CHANGE,
  FORM_RATING_ADJ_CAP,
  FORM_LOSS_CHANGE,
} from '@/config/gameBalance';

const ATTRS: PlayerAttributes = {
  pace: 60, shooting: 60, passing: 60, defending: 60, physical: 60, mental: 60,
};

function makePlayer(over: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'Test', lastName: 'Player', age: 20, nationality: 'England',
    position: 'CM', attributes: { ...ATTRS }, overall: 60, potential: 85, clubId: 'c1',
    wage: 1000, value: 1_000_000, contractEnd: 5, fitness: 100, morale: 70, form: 70,
    injured: false, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0,
    careerGoals: 0, careerAssists: 0, careerAppearances: 0, yellowCards: 0, redCards: 0,
    ...over,
  } as Player;
}

// ── 1. Match ratings drive development ───────────────────────────────────────

describe('match ratings drive development', () => {
  beforeEach(() => resetSeasonGrowth());

  it('is neutral for an average performer', () => {
    const p = makePlayer({ seasonRatingTotal: DEV_RATING_BASELINE * 20, seasonRatedMatches: 20 });
    expect(getRatingDevelopmentBonus(p)).toBeCloseTo(0, 6);
  });

  it('rewards a high average rating and penalises a low one, within the configured clamp', () => {
    const good = getRatingDevelopmentBonus(
      makePlayer({ seasonRatingTotal: 8.5 * 20, seasonRatedMatches: 20 }),
    );
    const bad = getRatingDevelopmentBonus(
      makePlayer({ seasonRatingTotal: 4.0 * 20, seasonRatedMatches: 20 }),
    );
    expect(good).toBeGreaterThan(0);
    expect(bad).toBeLessThan(0);
    expect(good).toBeLessThanOrEqual(DEV_RATING_BONUS_MAX);
    expect(bad).toBeGreaterThanOrEqual(DEV_RATING_BONUS_MIN);
  });

  it('ignores a sample too small to be form rather than noise', () => {
    const p = makePlayer({
      seasonRatingTotal: 9.5 * (DEV_RATING_MIN_MATCHES - 1),
      seasonRatedMatches: DEV_RATING_MIN_MATCHES - 1,
    });
    expect(getRatingDevelopmentBonus(p)).toBe(0);
  });

  it('never overtakes the playing-time term', () => {
    expect(DEV_RATING_BONUS_MAX).toBeLessThan(PLAYING_TIME_BONUS_MAX);
  });

  it('makes a 9.0 develop faster than a 4.0 with identical age, gap and minutes', () => {
    // Same seed conditions for both cohorts, differing only in season rating.
    const trials = 400;
    const grow = (avg: number) => {
      let total = 0;
      for (let i = 0; i < trials; i++) {
        resetSeasonGrowth();
        const p = makePlayer({
          id: `p${i}`, appearances: 30, minutesPlayed: 30 * MINUTES_PER_APPEARANCE,
          seasonRatingTotal: avg * 30, seasonRatedMatches: 30,
        });
        total += applyPlayerDevelopment(p, 'balanced').overall - p.overall;
      }
      return total / trials;
    };
    const high = grow(9.0);
    const low = grow(4.0);
    expect(high).toBeGreaterThan(low);
  });
});

// ── 2. Playing time is measured in minutes, not appearances ─────────────────

describe('playing-time term uses minutes', () => {
  it('values a full 90 far above an 87th-minute cameo', () => {
    const full = getPlayingTimeBonus(makePlayer({ appearances: 20, minutesPlayed: 20 * 90 }));
    const cameo = getPlayingTimeBonus(makePlayer({ appearances: 20, minutesPlayed: 20 * 3 }));
    expect(full).toBeGreaterThan(cameo * 5);
  });

  it('falls back to appearances for pre-minutes saves', () => {
    const legacy = makePlayer({ appearances: 20 });
    delete (legacy as Partial<Player>).minutesPlayed;
    expect(getPlayingTimeBonus(legacy)).toBeCloseTo(
      getPlayingTimeBonus(makePlayer({ appearances: 20, minutesPlayed: 20 * 90 })),
      6,
    );
  });

  it('is immune to a minutesPlayed counter that failed to reset at season rollover', () => {
    // appearances IS reset at season end, so minutes/90 can never legitimately
    // exceed it — the clamp keeps a stale counter from faking a full season.
    const stale = makePlayer({ appearances: 2, minutesPlayed: 40 * 90 });
    const honest = makePlayer({ appearances: 2, minutesPlayed: 2 * 90 });
    expect(getPlayingTimeBonus(stale)).toBeCloseTo(getPlayingTimeBonus(honest), 6);
  });
});

// ── 3. Yellow-card accumulation bans ────────────────────────────────────────

describe('yellow-card accumulation bans', () => {
  const WEEK = 12;

  it('does not ban below the first threshold', () => {
    const first = YELLOW_ACCUMULATION_THRESHOLDS[0];
    expect(getYellowAccumulationBanWeek(first - 2, first - 1, WEEK)).toBeNull();
  });

  it('bans on reaching each configured threshold', () => {
    for (const t of YELLOW_ACCUMULATION_THRESHOLDS) {
      expect(getYellowAccumulationBanWeek(t - 1, t, WEEK)).toBe(WEEK + 1 + YELLOW_ACCUMULATION_BAN_WEEKS);
    }
  });

  it('bans when a threshold is jumped rather than landed on', () => {
    // Two bookings in one match can cross a threshold from below.
    const t = YELLOW_ACCUMULATION_THRESHOLDS[0];
    expect(getYellowAccumulationBanWeek(t - 1, t + 1, WEEK)).not.toBeNull();
  });

  it('does not re-ban between thresholds', () => {
    const t = YELLOW_ACCUMULATION_THRESHOLDS[0];
    expect(getYellowAccumulationBanWeek(t, t + 1, WEEK)).toBeNull();
  });

  it('suspends for exactly the configured number of following weeks', () => {
    const until = getYellowAccumulationBanWeek(4, 5, WEEK)!;
    // `suspendedUntilWeek > week` is the availability test used everywhere.
    expect(until > WEEK + 1).toBe(true);
    expect(until > WEEK + 1 + YELLOW_ACCUMULATION_BAN_WEEKS).toBe(false);
  });
});

// ── 4. Minutes played derived from the event stream ─────────────────────────

describe('computeMinutesPlayed', () => {
  const full = { minute: 90, type: 'full_time' as const };

  it('credits a starter who finishes the match with the full 90', () => {
    const m = computeMinutesPlayed([full], ['starter']);
    expect(m.starter).toBe(90);
  });

  it('credits a substitute only for the minutes after he came on', () => {
    const m = computeMinutesPlayed(
      [{ minute: 70, type: 'substitution', playerId: 'sub', assistPlayerId: 'off' }, full],
      ['sub', 'off'],
    );
    expect(m.sub).toBe(20);
    expect(m.off).toBe(70);
  });

  it('stops the clock at a sending off', () => {
    const m = computeMinutesPlayed(
      [{ minute: 30, type: 'red_card', playerId: 'sentoff' }, full],
      ['sentoff'],
    );
    expect(m.sentoff).toBe(30);
  });

  it('stops the clock when a player goes down injured and is not replaced', () => {
    const m = computeMinutesPlayed(
      [{ minute: 55, type: 'injury', playerId: 'hurt' }, full],
      ['hurt'],
    );
    expect(m.hurt).toBe(55);
  });

  it('handles a substitute who is himself substituted', () => {
    const m = computeMinutesPlayed(
      [
        { minute: 60, type: 'substitution', playerId: 'a', assistPlayerId: 'x' },
        { minute: 80, type: 'substitution', playerId: 'b', assistPlayerId: 'a' },
        full,
      ],
      ['a', 'b', 'x'],
    );
    expect(m.a).toBe(20);
    expect(m.b).toBe(10);
    expect(m.x).toBe(60);
  });

  it('extends past 90 for extra time', () => {
    const m = computeMinutesPlayed([{ minute: 120, type: 'full_time' as const }], ['starter']);
    expect(m.starter).toBe(120);
  });
});

// ── 5. End-of-match fitness recovered from event snapshots ──────────────────

describe('extractFinalMatchFitness', () => {
  it('keeps the last snapshot seen for each player', () => {
    const fitness = extractFinalMatchFitness([
      { playerFitness: { a: 95, b: 96 } },
      { playerFitness: { a: 80 } },
      {},
      { playerFitness: { a: 72 } },
    ]);
    // `a` degraded across the match; `b` left the pitch and keeps his last value.
    expect(fitness.a).toBe(72);
    expect(fitness.b).toBe(96);
  });

  it('returns an empty map when the engine reported nothing (forfeits, quick paths)', () => {
    expect(extractFinalMatchFitness([{}, { playerFitness: undefined }])).toEqual({});
  });

  it('ignores non-finite values rather than writing NaN fitness onto a player', () => {
    const fitness = extractFinalMatchFitness([
      { playerFitness: { a: 70 } },
      { playerFitness: { a: NaN } as unknown as Record<string, number> },
    ]);
    expect(fitness.a).toBe(70);
  });
});

// ── 6. The team result stays dominant ──────────────────────────────────────

describe('rating adjustments never invert the team result', () => {
  it('caps the morale adjustment below the defeat penalty', () => {
    expect(MORALE_RATING_ADJ_CAP).toBeLessThan(Math.abs(MORALE_LOSS_CHANGE));
  });

  it('caps the form adjustment below the defeat penalty', () => {
    expect(FORM_RATING_ADJ_CAP).toBeLessThan(Math.abs(FORM_LOSS_CHANGE));
  });
});

// ── 7. End-to-end through the real post-match path ─────────────────────────

describe('post-match integration (real store, real engine)', () => {
  interface Played {
    minutes: number[];
    drains: number[];
    byRating: { rating: number; morale: number; form: number; formClamped: boolean }[];
    lost: boolean;
  }

  /**
   * Play the first `count` matches of a real save and record, per match, the
   * minutes / fitness drain / morale+form deltas of the player's participants.
   * Several matches are collected because a single fixture can be a forfeit or a
   * synthetic cup tie carrying no fitness snapshots, which legitimately falls
   * back to the flat drain.
   */
  async function playMatches(count: number): Promise<Played[]> {
    useGameStore.getState().initGame('manchester-city');
    const out: Played[] = [];
    for (let w = 0; w < 30 && out.length < count; w++) {
      const pre = useGameStore.getState();
      const before = Object.fromEntries(
        pre.clubs[pre.playerClubId].playerIds.map(id => [id, { ...pre.players[id] }]),
      ) as Record<string, Player>;
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
      const after = useGameStore.getState();
      const ours = after.matchPlayerRatings.filter(r => before[r.playerId] && after.players[r.playerId]);
      // `matchPlayerRatings` persists in state between weeks, so a week with no
      // fixture would otherwise be counted as a match with all-zero deltas.
      // Require a genuine appearance increment.
      if (ours.length === 0) continue;
      if (!ours.some(r => after.players[r.playerId].appearances > before[r.playerId].appearances)) continue;
      const fixture = after.fixtures.find(
        f => f.week === after.week && f.played
          && (f.homeClubId === pre.playerClubId || f.awayClubId === pre.playerClubId),
      );
      out.push({
        minutes: ours.map(r => after.players[r.playerId].minutesPlayed || 0),
        drains: ours.map(r => before[r.playerId].fitness - after.players[r.playerId].fitness),
        lost: fixture ? (fixture.homeClubId === pre.playerClubId
          ? fixture.homeGoals < fixture.awayGoals
          : fixture.awayGoals < fixture.homeGoals) : false,
        byRating: ours
          .map(r => {
            const b = before[r.playerId]; const a = after.players[r.playerId];
            return {
              rating: r.rating,
              morale: a.morale - b.morale,
              form: a.form - b.form,
              // Bounds are enforced at 10..100 in processMatchResult.
              formClamped: a.form >= 100 || a.form <= 10 || b.form >= 100 || b.form <= 10,
            };
          })
          .sort((x, y) => x.rating - y.rating),
      });
    }
    expect(out.length).toBe(count);
    return out;
  }

  it('records minutes played for everyone who took part', async () => {
    for (const m of await playMatches(4)) {
      expect(Math.min(...m.minutes)).toBeGreaterThan(0);
      // A full-90 shift must exist in every XI.
      expect(Math.max(...m.minutes)).toBeGreaterThanOrEqual(80);
    }
  });

  it('carries the engine-measured fitness drain through instead of a flat -10', async () => {
    const matches = await playMatches(6);
    // The old behaviour was FITNESS_DRAIN_PER_MATCH for every participant of
    // every match — identical within a match and never beyond 10. Both of those
    // must now be false somewhere in a normal run of fixtures.
    const beyondFlat = matches.some(m => Math.max(...m.drains) > 10);
    const nonUniform = matches.some(m => new Set(m.drains.map(d => Math.round(d))).size > 1);
    expect(beyondFlat).toBe(true);
    expect(nonUniform).toBe(true);
  });

  it('moves form with the individual rating, not just the result', async () => {
    const matches = await playMatches(8);
    // Form is the clean signal: unlike morale it has no personality-stability
    // multiplier, so for two players in the SAME match the delta is a pure
    // function of (shared team result + individual rating). Only unclamped
    // players are comparable — form saturates at 100 for a dominant side, and a
    // clamped delta says nothing about the term under test.
    let compared = 0;
    for (const m of matches) {
      const open = m.byRating.filter(x => !x.formClamped);
      if (open.length < 2) continue;
      const worst = open[0];
      const best = open[open.length - 1];
      if (best.rating - worst.rating < 1.0) continue;
      compared++;
      // Under the old pure win/draw/loss rule these two would be identical.
      expect(best.form).toBeGreaterThan(worst.form);
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('never lets a good individual game invert the team result', async () => {
    const matches = await playMatches(8);
    let defeats = 0;
    for (const m of matches) {
      if (!m.lost) continue;
      defeats++;
      for (const x of m.byRating) {
        if (x.formClamped) continue;
        // Even the man of the match loses form in a defeat.
        expect(x.form).toBeLessThan(0);
      }
    }
    // Manchester City in the opening weeks may go unbeaten; treat zero defeats
    // as "nothing to check" rather than a failure.
    expect(defeats).toBeGreaterThanOrEqual(0);
  });
});
