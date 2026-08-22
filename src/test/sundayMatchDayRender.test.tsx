/**
 * Match Day — the screen, rendered, plus the timeline it is now built on.
 *
 * WHAT THIS PINS. Four things the Phase-5 pass introduced or corrected, each of
 * which is invisible to every other suite in the project because none of them
 * renders this page:
 *
 *   1. THE TIMELINE IS THE EVENT LIST. One row per event the noticeboard would
 *      carry, in order, with a running score that cannot drift from the
 *      narrative's — both walk the engine's own `clubId`-on-the-goal
 *      accounting, and if they ever disagree the screen contradicts itself.
 *   2. WEATHER ONLY WHERE IT EXISTS. It is rolled inside `prepareSundayMatch`,
 *      after the ringer draws, so a briefing that shows a weather badge is
 *      showing an invention. This asserts the absence.
 *   3. THE EXPLANATORY COPY IS GONE FROM THE DICTIONARY, not merely unrendered
 *      — a key nothing reads comes back the moment somebody needs a sentence.
 *   4. A CUP FINAL DOES NOT LOOK LIKE A TUESDAY. The tier's rim and chip are
 *      the only thing that says so before a ball is kicked.
 *
 * STORE WRITES ARE ASYNC. `sundaySlice` dynamic-imports its implementation, so
 * every action is awaited before the state it produced is read.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SundayMatchDay from '@/pages/SundayMatchDay';
import { SundayTimeline } from '@/components/game/sunday/SundayTimeline';
import { SundayBriefing } from '@/components/game/sunday/SundayBriefing';
import { buildSundayTimeline } from '@/utils/sunday/timeline';
import { useGameStore } from '@/store/gameStore';
import { SUNDAY_TIER_RIM } from '@/config/sundayIcons';
import { en } from '@/i18n/locales/en';
import type { MatchEvent, Player, SundayTimelineEntry } from '@/types/game';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

const SEED = 8181;

let consoleError: ReturnType<typeof vi.spyOn>;
let errors: string[];

beforeEach(async () => {
  errors = [];
  consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

afterEach(() => { consoleError.mockRestore(); });

// ── The timeline, as data ───────────────────────────────────────────────────

const ev = (over: Partial<MatchEvent> & Pick<MatchEvent, 'minute' | 'type' | 'clubId'>): MatchEvent =>
  ({ description: '', ...over }) as MatchEvent;

const player = (id: string, firstName: string): Player =>
  ({ id, firstName, lastName: 'X' }) as Player;

describe('buildSundayTimeline', () => {
  const US = 'us';
  const THEM = 'them';
  const players = {
    a: player('a', 'Aaron'), b: player('b', 'Baz'), c: player('c', 'Connor'), d: player('d', 'Dec'),
  };

  const events: MatchEvent[] = [
    ev({ minute: 3, type: 'kickoff', clubId: US }),
    ev({ minute: 10, type: 'goal', clubId: US, playerId: 'a', assistPlayerId: 'b' }),
    ev({ minute: 22, type: 'shot_saved', clubId: THEM, playerId: 'c' }),
    ev({ minute: 30, type: 'yellow_card', clubId: US, playerId: 'b' }),
    ev({ minute: 45, type: 'goal', clubId: THEM, playerId: 'c' }),
    ev({ minute: 60, type: 'header_goal', clubId: THEM, playerId: 'd' }),
    ev({ minute: 70, type: 'substitution', clubId: US, playerId: 'b', assistPlayerId: 'a' }),
    ev({ minute: 88, type: 'red_card', clubId: US, playerId: 'a', displayMinute: '88' }),
  ];

  it('carries one row per event on the noticeboard, in order, and nothing else', () => {
    const rows = buildSundayTimeline({ events, clubId: US, isHome: true, players });
    // kickoff and shot_saved are the feed's business, not the sheet's; the
    // half-time break is inserted where the narrative puts its `HT x-y`.
    expect(rows.map(r => r.kind)).toEqual([
      'goal', 'yellow', 'goal', 'break', 'goal', 'sub', 'red',
    ]);
    expect(rows.map(r => r.at)).toEqual([10, 30, 45, 45, 60, 70, 88]);
  });

  it('runs the score the way the narrative runs it, from the club that gained', () => {
    const rows = buildSundayTimeline({ events, clubId: US, isHome: true, players });
    expect(rows.map(r => `${r.home}-${r.away}`)).toEqual([
      '1-0', '1-0', '1-1', '1-1', '1-2', '1-2', '1-2',
    ]);
    // Away, the same events read the other way round — and the final row still
    // agrees with the scoreline the header prints.
    const away = buildSundayTimeline({ events, clubId: US, isHome: false, players });
    expect(away.map(r => `${r.home}-${r.away}`)).toEqual([
      '0-1', '0-1', '1-1', '1-1', '2-1', '2-1', '2-1',
    ]);
  });

  it('names the man off the players map it was handed, guests included', () => {
    const rows = buildSundayTimeline({ events, clubId: US, isHome: true, players });
    const goal = rows.find(r => r.kind === 'goal')!;
    expect(goal.name).toBe('Aaron');
    expect(goal.second).toBe('Baz');
    // A substitution is `playerId` on, `assistPlayerId` off — the engine's own
    // convention, which the row must not invert.
    const sub = rows.find(r => r.kind === 'sub')!;
    expect(sub.name).toBe('Baz');
    expect(sub.second).toBe('Aaron');
  });

  it('files an own goal under whoever gained by it, as the engine does', () => {
    const rows = buildSundayTimeline({
      // The engine credits the BENEFITING club and names the opposing defender.
      events: [ev({ minute: 20, type: 'own_goal', clubId: 'us', playerId: 'c' })],
      clubId: 'us', isHome: true, players,
    });
    expect(rows[0].kind).toBe('own-goal');
    expect(rows[0].ours).toBe(true);
    expect(rows[0].name).toBe('Connor');
    expect(`${rows[0].home}-${rows[0].away}`).toBe('1-0');
  });

  it('adds the shootout as a final row when a cup tie went to penalties', () => {
    const rows = buildSundayTimeline({
      events: [], clubId: 'us', isHome: true, players, shootout: { home: 4, away: 3 },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('shootout');
    expect(rows[0].ours).toBe(true);
    expect(`${rows[0].home}-${rows[0].away}`).toBe('4-3');
  });
});

// ── The timeline, rendered ──────────────────────────────────────────────────

describe('SundayTimeline renders a match, not a log', () => {
  const rows: SundayTimelineEntry[] = [
    { minute: '10', at: 10, kind: 'goal', ours: true, name: 'Aaron', second: 'Baz', home: 1, away: 0 },
    { minute: '30', at: 30, kind: 'yellow', ours: false, name: 'Connor', second: null, home: 1, away: 0 },
    { minute: '', at: 45, kind: 'break', ours: false, name: null, second: null, home: 1, away: 0 },
    { minute: '60', at: 60, kind: 'red', ours: true, name: 'Baz', second: null, home: 1, away: 0 },
  ];

  it('draws one row per entry, in order', () => {
    render(<SundayTimeline rows={rows} us="US" them="THEM" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(rows.length);
    expect(items[0].textContent).toContain('Aaron');
    expect(items[1].textContent).toContain(en['sunday.timeline.booked']);
    expect(items[2].textContent).toContain(en['sunday.match.halfTime']);
    expect(items[3].textContent).toContain(en['sunday.timeline.sentOff']);
  });

  it('prints the running score on the rows that changed it, and only those', () => {
    render(<SundayTimeline rows={rows} us="US" them="THEM" />);
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('1-0');
    // A booking does not move the scoreboard, so it must not carry one.
    expect(items[1].textContent).not.toContain('1-0');
    expect(items[3].textContent).not.toContain('1-0');
  });

  it('falls back to the side when the engine attributed the event to nobody', () => {
    render(<SundayTimeline
      rows={[{ minute: '5', at: 5, kind: 'goal', ours: false, name: null, second: null, home: 0, away: 1 }]}
      us="Dog & Duck"
      them="Old Oak"
    />);
    expect(screen.getByRole('listitem').textContent).toContain('Old Oak');
  });

  it('renders nothing at all for an empty list', () => {
    const { container } = render(<SundayTimeline rows={[]} us="US" them="THEM" />);
    expect(container.firstChild).toBeNull();
  });
});

// ── The screen ──────────────────────────────────────────────────────────────

const briefingProps = {
  tier: 'routine' as const,
  tierLabel: '',
  stakes: null,
  opponentName: 'Old Oak',
  opponentColor: '#f00',
  opponentSecondaryColor: '#fff',
  position: 3,
  tableSize: 8,
  form: [] as const,
  dangerName: null,
  dangerGoals: 0,
  styleLine: null,
  counterLine: null,
  rivalryLine: null,
  namedCount: 11,
  minToPlay: 7,
  adjustments: [],
  isHome: true,
  pitch: 38,
  pitchCondition: 'good',
  recall: null,
  milestone: null,
};

describe('SundayMatchDay', () => {
  it('renders the briefing without invalid DOM', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    render(<SundayMatchDay />);
    const nesting = errors.filter(e => /validateDOMNesting/.test(e));
    expect(nesting, nesting.join('\n')).toEqual([]);
  });

  /**
   * THE ABSENCE IS THE ASSERTION. Weather is rolled in `prepareSundayMatch`
   * from the match-week stream AFTER the ringer draws, so before kick-off there
   * is no weather to show and a badge would be a fabrication. The four
   * conditions are the whole vocabulary, so their absence is checkable.
   */
  it('never shows weather before the match that produced it', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    const { container } = render(<SundayMatchDay />);
    expect(useGameStore.getState().sunday!.lastMatch).toBeNull();
    for (const word of ['clear', 'rain', 'wind', 'snow']) {
      expect(container.textContent, word).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
    }
  });

  it('shows the weather the report wrote down, once there is a report', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    await useGameStore.getState().arriveSundayMatch();
    const report = await useGameStore.getState().playSundayMatch();
    expect(report).not.toBeNull();
    // Persisted on the report, so it survives the reload that wipes
    // `currentMatchResult` — which is where this used to be read from.
    expect(report!.weather).not.toBeNull();
    useGameStore.setState({ currentMatchResult: null });

    const { container } = render(<SundayMatchDay />);
    expect(container.textContent).toContain(report!.weather!.weather);
  });

  it('writes a timeline onto the report the events came from', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    await useGameStore.getState().arriveSundayMatch();
    const report = await useGameStore.getState().playSundayMatch();
    expect(report).not.toBeNull();
    expect(Array.isArray(report!.timeline)).toBe(true);
    // Every goal in the scoreline is a row, and the last scoring row agrees
    // with the score the header will print.
    const goals = report!.timeline.filter(r => r.kind === 'goal' || r.kind === 'own-goal');
    expect(goals).toHaveLength(report!.goalsFor + report!.goalsAgainst);
    if (goals.length) {
      const last = goals[goals.length - 1];
      const [ours, theirs] = report!.home ? [last.home, last.away] : [last.away, last.home];
      expect(ours).toBe(report!.goalsFor);
      expect(theirs).toBe(report!.goalsAgainst);
    }
  });

  /** The reveal is the point of the screen; the header must not give it away. */
  it('does not print the score while the match is still being watched', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    await useGameStore.getState().arriveSundayMatch();
    const { halfTime, report } = await useGameStore.getState().playSundayFirstHalf();
    // A side that cannot be split is played whole; that path has nothing to
    // pin here, so the assertion only runs on a real pause.
    if (!halfTime || report) return;

    render(<SundayMatchDay />);
    // Nothing has been revealed yet on this mount, so the scoreboard is still
    // a fixture, not a result — even though the first half has been played and
    // its score is sitting in state one property away.
    expect(screen.getByText(en['sunday.match.vs'])).toBeTruthy();
    const score = `${halfTime.goalsFor}-${halfTime.goalsAgainst}`;
    const reversed = `${halfTime.goalsAgainst}-${halfTime.goalsFor}`;
    for (const s of new Set([score, reversed])) {
      expect(screen.queryAllByText(s), s).toEqual([]);
    }
  });

  it('prints the score once the afternoon is over', async () => {
    await useGameStore.getState().autoPickSundayTeamsheet();
    await useGameStore.getState().arriveSundayMatch();
    const report = await useGameStore.getState().playSundayMatch();
    expect(report).not.toBeNull();
    render(<SundayMatchDay />);
    const score = report!.home
      ? `${report!.goalsFor}-${report!.goalsAgainst}`
      : `${report!.goalsAgainst}-${report!.goalsFor}`;
    // The header and the last scoring row of the match sheet both carry it,
    // which is the point: they are two views of one number.
    expect(screen.getAllByText(score).length).toBeGreaterThan(0);
    expect(screen.queryByText(en['sunday.match.vs'])).toBeNull();
  });
});

describe('the tier is visible before a ball is kicked', () => {
  it('gives a cup final a different treatment from a wet Tuesday', () => {
    expect(SUNDAY_TIER_RIM.routine).toBe('');
    expect(SUNDAY_TIER_RIM['cup-final']).not.toBe(SUNDAY_TIER_RIM.decider);
    expect(SUNDAY_TIER_RIM['cup-final']).not.toBe(SUNDAY_TIER_RIM.routine);
    expect(SUNDAY_TIER_RIM.derby).not.toBe(SUNDAY_TIER_RIM.cup);
  });

  it('names the afternoon on a chip, and says nothing at all on a routine one', () => {
    const { container, rerender } = render(<SundayBriefing {...briefingProps} />);
    expect(container.textContent).not.toContain('Final');

    rerender(<SundayBriefing
      {...briefingProps}
      tier="cup-final"
      tierLabel="Final"
      stakes="The final. One afternoon, one cup, no next week."
    />);
    expect(screen.getByText('Final')).toBeTruthy();
    expect(screen.getByText(/One afternoon, one cup/)).toBeTruthy();
  });

  it('says the pitch in the same words the post-match panel uses', () => {
    render(<SundayBriefing {...briefingProps} />);
    expect(screen.getByText('good')).toBeTruthy();
    expect(screen.getByText('(38)')).toBeTruthy();
  });
});

describe('the explanatory copy is gone from the dictionary, not merely unrendered', () => {
  /**
   * A key that still exists is a key somebody re-adds a sentence to. These five
   * were 395 characters of interface explanation on one screen; each is now a
   * button affordance, a drawn comparison, or a panel that shows the thing it
   * was describing.
   */
  it.each([
    'sunday.arrival.gateHint',
    'sunday.arrival.hireHint',
    'sunday.arrival.playShortHint',
    'sunday.match.halfTimeHint',
  ])('%s no longer exists', key => {
    expect(Object.prototype.hasOwnProperty.call(en, key)).toBe(false);
  });

  it('keeps the one that reports a state change, and keeps it short', () => {
    // A half-time decision silently disappearing is something the manager has
    // to be told about; killing this would be lying by omission.
    expect(en['sunday.match.resumed'].length).toBeLessThanOrEqual(56);
  });
});
