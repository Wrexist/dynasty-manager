/**
 * The hub — the mode's home screen, rendered.
 *
 * The redesign moved every number on this screen onto a shared derived view
 * (`sundayClubSummary`, `sundayNewsFeed`, `sundayOppositionCard`,
 * `deriveSundayStakes`) precisely so the hub cannot drift away from the
 * teamsheet and match day the way it had. These cases pin the three things
 * that drift first:
 *
 *   1. the availability counts, which used to be read one way here and another
 *      way by selection (see the `available` / `selectable` split);
 *   2. the primary action, which the shell's week bar also renders and which
 *      must appear exactly once on this screen;
 *   3. the authored voice, which the "less text" work is allowed nowhere near
 *      — every week-log line must still reach the DOM in full.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SundayHub from '@/pages/SundayHub';
import { SundayFixtureHero } from '@/components/game/sunday/SundayFixtureHero';
import { useGameStore } from '@/store/gameStore';
import { en } from '@/i18n/locales/en';
import { findSundayFixture } from '@/store/slices/sunday/matchday';
import { sundayPrimaryAction } from '@/utils/sunday/primaryAction';
import { sundayClubSummary, sundayNewsFeed } from '@/utils/sunday/view';
import type { SundayClubIdentity } from '@/types/game';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

const SEED = 90210;

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

describe('SundayHub renders the club', () => {
  it('logs nothing and nests no button inside a button', () => {
    render(<SundayHub />);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  it('draws both sides of the fixture it is about to play', () => {
    const s = useGameStore.getState();
    const sunday = s.sunday!;
    render(<SundayHub />);

    // The club's FULL name is deliberately absent: `TopBar` already prints it
    // (with the crest and the division) on every Sunday tab, and the old club
    // header repeated all three a thumb below it.
    expect(screen.queryByText(sunday.identity.name)).toBeNull();

    const fixture = findSundayFixture(sunday, s.fixtures, s.week, s.playerClubId);
    expect(fixture, 'a fresh save should have a week-one fixture').toBeTruthy();
    const oppId = fixture!.kind === 'cup'
      ? (fixture!.tie.homeClubId === s.playerClubId ? fixture!.tie.awayClubId : fixture!.tie.homeClubId)
      : (fixture!.match.homeClubId === s.playerClubId ? fixture!.match.awayClubId : fixture!.match.homeClubId);
    // Both sides of the tie, by the short name the crest row prints.
    expect(screen.getByText(s.clubs[oppId].shortName)).toBeTruthy();
    expect(screen.getByText(sunday.identity.shortName)).toBeTruthy();
  });

  /**
   * The bug this pins: the hub summarised availability with the STRICT count
   * (`status === 'available'`) while selection used the loose one
   * (`status !== 'out'`), so it could say "9 available" beside a teamsheet that
   * happily named eleven. `sundayClubSummary` returns both and this screen
   * prints the pair; nothing here may quietly go back to one number.
   */
  it('prints the availability counts the shared summary reports, and no others', () => {
    const s = useGameStore.getState();
    const summary = sundayClubSummary(s.sunday!, s.week);
    render(<SundayHub />);

    expect(screen.getByText(`${summary.available} available`)).toBeTruthy();
    if (summary.doubts > 0) expect(screen.getByText(`${summary.doubts} doubtful`)).toBeTruthy();
    if (summary.out > 0) expect(screen.getByText(`${summary.out} out`)).toBeTruthy();
    // The strict and loose readings differ by the doubts, by definition. If
    // this ever fails the two are no longer two readings of one squad.
    expect(summary.selectable).toBe(summary.available + summary.doubts);
  });

  it('offers the one primary action exactly once', () => {
    const s = useGameStore.getState();
    const fixture = findSundayFixture(s.sunday!, s.fixtures, s.week, s.playerClubId);
    const primary = sundayPrimaryAction(s.sunday!, !!fixture, s.week);
    render(<SundayHub />);

    // Exactly one: the shell's week bar deliberately hides itself on the hub,
    // so a second gold button here would be the duplicate it exists to avoid.
    expect(screen.getAllByRole('button', { name: en[primary.labelKey] })).toHaveLength(1);
  });

  /**
   * The reduction target applies to explanatory chrome, never to voice. These
   * five keys were 535 characters of paragraph under the things they described;
   * they are gone from the dictionary entirely, so they cannot creep back as a
   * `<p>` without someone re-authoring them on purpose.
   */
  it('no longer carries the five hint paragraphs', () => {
    for (const key of [
      'sunday.hub.pitchHint', 'sunday.hub.metersHint', 'sunday.hub.subsHint',
      'sunday.hub.freeWeekBody', 'sunday.hub.seasonOverBody',
    ]) {
      expect(en, `${key} came back`).not.toHaveProperty(key);
    }
  });

  it('renders every week-log line in full', async () => {
    // A played week gives the log something to say.
    await useGameStore.getState().autoPickSundayTeamsheet();
    await useGameStore.getState().advanceWeek();

    const sunday = useGameStore.getState().sunday!;
    const feed = sundayNewsFeed(sunday, 14);
    const weekLines = feed.filter(e => e.kind === 'week');
    expect(weekLines.length, 'the advance should have written a week log').toBeGreaterThan(0);

    render(<SundayHub />);
    // The list shows five before the reveal; every one of those must be the
    // whole line, not an ellipsis. (`line-clamp` is CSS — the text node is
    // complete, which is exactly the property being asserted.)
    for (const entry of feed.slice(0, 5)) {
      // `getAllBy`: two sources can legitimately say the same sentence (a
      // record and the week-log line announcing it), and the assertion is
      // "this line reached the DOM whole", not "exactly once".
      expect(screen.getAllByText(entry.text).length, entry.text).toBeGreaterThan(0);
    }
  });
});

/**
 * The three states the card has to hold. Rendered directly rather than through
 * the hub, because "no fixture" and "season over" are otherwise reachable only
 * by simulating a whole season for a layout assertion.
 */
describe('SundayFixtureHero', () => {
  const identity = {
    name: 'Marsh Lane AFC', shortName: 'Marsh Lane', nickname: 'The Lads',
    color: '#D92B2B', secondaryColor: '#FFFFFF', personality: 'pub',
    venue: 'The Rec', town: 'Ashworth',
  } as SundayClubIdentity;

  const base = {
    identity,
    opposition: null,
    isHome: true,
    tableSize: 8,
    tier: 'routine' as const,
    stakesLine: null,
    derbyName: null,
    contextLabel: 'Div 4 · Week 7/19 · Season 1',
    pitch: 62,
    onCta: () => {},
  };

  it('says there is no fixture, and still offers the week its action', () => {
    render(<SundayFixtureHero {...base} mode="free" ctaLabel={en['sunday.hub.nextWeek']} />);
    expect(screen.getByText(en['sunday.hub.freeWeek'])).toBeTruthy();
    expect(screen.getByRole('button', { name: en['sunday.hub.nextWeek'] })).toBeTruthy();
    // The blank week used to carry 94 characters explaining what a blank week
    // was. The crest, the line and the button say it.
    expect(screen.queryByText(/chase the subs/i)).toBeNull();
  });

  it('says the season is over, and points at the review', () => {
    render(<SundayFixtureHero {...base} mode="seasonOver" ctaLabel={en['sunday.hub.viewSeason']} />);
    expect(screen.getByText(en['sunday.hub.seasonOver'])).toBeTruthy();
    expect(screen.getByRole('button', { name: en['sunday.hub.viewSeason'] })).toBeTruthy();
  });

  /**
   * Decoration must be ABSENT under reduced motion, not merely still:
   * `MotionConfig reducedMotion="always"` stops transforms and leaves paint
   * alone, so a layer that costs anything has to not render.
   */
  it('does not paint the pitch stripes under reduced motion', () => {
    const withStripes = render(
      <SundayFixtureHero {...base} mode="free" ctaLabel="x" />,
    ).container.querySelectorAll('svg rect').length;
    expect(withStripes).toBeGreaterThan(0);

    useGameStore.setState({ settings: { ...useGameStore.getState().settings, reducedMotion: true } });
    const without = render(
      <SundayFixtureHero {...base} mode="free" ctaLabel="x" />,
    ).container.querySelectorAll('svg rect').length;
    expect(without).toBe(0);
  });
});
