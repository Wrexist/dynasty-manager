/**
 * The Clubhouse — the ground, the boards on its fence, and the books.
 *
 * WHAT THIS FILE IS FOR. The screen's whole claim is that the picture is the
 * save: a club that owns floodlights has floodlights drawn, and a club that
 * owns nothing does not. A scene that renders the same marks whichever club is
 * loaded would look exactly as good in a screenshot and mean nothing, so the
 * cases below buy an upgrade through the real store action and assert that the
 * drawing changed — not that a component rendered.
 *
 * The other three things it pins are the ones the redesign could plausibly
 * break: the four Clubhouse-only actions must stay reachable (`buySundayUpgrade`,
 * `mothballSundayUpgrade`, `acceptSundaySponsor`, `declineSundaySponsor` exist
 * on no other screen), the before/after numbers must be the ones the buy action
 * will actually deliver, and the ten upgrade rows must not put a button inside
 * a button.
 *
 * STORE WRITES ARE ASYNC. `sundaySlice` dynamic-imports its action module so
 * the mode stays off the eager bundle, so every tap resolves a promise before
 * it reaches the store — see `tap` below and the same note in
 * `sundayTeamsheetBoard.test.tsx`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SundayClubhouse from '@/pages/SundayClubhouse';
import { useGameStore } from '@/store/gameStore';
import { SUNDAY_CLUB_ID, SUNDAY_UPGRADES, sundayUpgradeCost } from '@/config/sundayLeague';
import { sundayKitSpec } from '@/utils/sunday/visuals';
import { sundayUpgradePreview } from '@/utils/sunday/view';
import type { SundaySponsorDeal } from '@/types/game';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

const SEED = 4471;

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

const sunday = () => useGameStore.getState().sunday!;
const tap = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

/** Enough in the bank and enough standing that nothing is gated. */
async function makeRich() {
  await act(async () => {
    useGameStore.setState({
      sunday: { ...sunday(), balance: 20000, reputation: 60 },
    });
  });
}

/** The scene, as a string of SVG. The scene is `role="img"`; its hit targets
 *  are ordinary buttons stacked over it and are read separately. */
const sceneMarkup = () => screen.getByRole('img', { name: /ground/i }).outerHTML;

/** The upgrade row's disclosure button, by the label it announces. */
const row = (name: string) => screen.getAllByRole('button', { name: new RegExp(`^${name} —`) });

describe('the Clubhouse draws the club it has, not a picture of a club', () => {
  it('logs nothing and nests no button inside a button', () => {
    const { container } = render(<SundayClubhouse />);
    expect(errors, errors.join('\n')).toEqual([]);
    for (const button of container.querySelectorAll('button')) {
      expect(button.querySelector('button'), 'a button inside a button').toBeNull();
    }
  });

  /**
   * The bug this pins: a scene that is a fixed illustration. Buying the
   * floodlights has to put floodlights on the drawing, and the assertion is on
   * the SVG's own marks rather than on a class name, so it fails if the pylons
   * stop being drawn for any reason at all.
   */
  it('puts the floodlights up when the floodlights are bought', async () => {
    await makeRich();
    const { rerender } = render(<SundayClubhouse />);
    const before = sceneMarkup();

    await act(async () => { await useGameStore.getState().buySundayUpgrade('floodlights'); });
    rerender(<SundayClubhouse />);
    const after = sceneMarkup();

    expect(sunday().upgrades.find(u => u.id === 'floodlights')?.level).toBe(1);
    expect(after).not.toBe(before);
    // The pylon masts are the only paths that climb to y=26 from the ground.
    expect(before).not.toContain('M33 90 L35 26');
    expect(after).toContain('M33 90 L35 26');
  });

  it('hangs one shirt on the line per level of kit', async () => {
    await makeRich();
    const { rerender } = render(<SundayClubhouse />);
    const shirts = () => (sceneMarkup().match(/l-4 3 2 3 2-1v9h10v-9/g) ?? []).length;

    expect(shirts()).toBe(0);
    for (const expected of [1, 2, 3]) {
      await act(async () => { await useGameStore.getState().buySundayUpgrade('kit'); });
      rerender(<SundayClubhouse />);
      expect(shirts(), `after buying kit level ${expected}`).toBe(expected);
    }
  });

  /**
   * The strip in the identity panel has to be THIS club's strip: the two
   * colours out of the save and the pattern `sundayKitSpec` derives from the
   * club id. A kit drawn in a house palette would look just as good and would
   * be the same kit for every club in the mode.
   */
  it('hangs the club\'s own strip, in the club\'s own colours', () => {
    const { container } = render(<SundayClubhouse />);
    const kit = container.querySelector('svg[aria-label*="kit"]')!;
    expect(kit, 'no kit drawn').not.toBeNull();
    const markup = kit.outerHTML;
    expect(markup).toContain(sunday().identity.color);
    expect(markup).toContain(sunday().identity.secondaryColor);

    const spec = sundayKitSpec(sunday().identity.color, sunday().identity.secondaryColor, SUNDAY_CLUB_ID);
    const PATTERN_MARK: Record<string, RegExp> = {
      stripes: /<rect[^>]*x="17\.5"/,
      hoops: /<rect[^>]*y="13"/,
      halves: /<rect[^>]*x="32"[^>]*width="28"/,
      sash: /<path[^>]*d="M 8 50 L 30 4/,
    };
    for (const [pattern, mark] of Object.entries(PATTERN_MARK)) {
      expect(mark.test(markup), `${pattern} drawn but the spec says ${spec.pattern}`)
        .toBe(pattern === spec.pattern);
    }
  });

  /** Every upgrade in the catalogue is somewhere on the ground and reachable
   *  by name, or the scene is lying about being the whole club. */
  it('gives every upgrade a hit target on the ground', () => {
    render(<SundayClubhouse />);
    for (const u of SUNDAY_UPGRADES) {
      // Two: the hotspot over the drawing and the row in the list under it.
      expect(row(u.name).length, u.name).toBe(2);
    }
  });
});

describe('an upgrade row shows the change, not a claim about it', () => {
  it('quotes the pitch quality the purchase will actually produce', async () => {
    await makeRich();
    render(<SundayClubhouse />);
    const preview = sundayUpgradePreview(sunday(), useGameStore.getState().week, 'pitch');
    const change = preview.changes.find(c => c.stat === 'pitch')!;
    expect(change.to).toBeGreaterThan(change.from);

    await tap(row('Pitch Maintenance')[1]);
    expect(screen.getByText(String(change.from))).toBeTruthy();
    expect(screen.getByText(String(change.to))).toBeTruthy();

    // …and the number it promised is the number the club ends up with.
    await act(async () => { await useGameStore.getState().buySundayUpgrade('pitch'); });
    const after = sundayUpgradePreview(sunday(), useGameStore.getState().week, 'pitch');
    expect(after.changes.find(c => c.stat === 'pitch')!.from).toBe(change.to);
  });

  it('prices the buy button with the same figure the till charges', async () => {
    await makeRich();
    render(<SundayClubhouse />);
    await tap(row('Decent Match Balls')[1]);
    const cost = sundayUpgradeCost('balls', 0);
    const buy = screen.getByRole('button', { name: new RegExp(`Buy · £${cost}`) });

    const before = sunday().balance;
    await tap(buy);
    expect(sunday().balance).toBe(before - cost);
  });

  it('keeps selling reachable, and lighter than buying', async () => {
    await makeRich();
    await act(async () => { await useGameStore.getState().buySundayUpgrade('nets'); });
    render(<SundayClubhouse />);
    await tap(row('Goal Nets')[1]);

    const sell = screen.getByRole('button', { name: /Sell it back/ });
    // A link, not a slab: the buy button is the only LiquidButton in the row.
    expect(sell.className).toContain('underline');
    expect(sell.className).not.toContain('w-full');

    await tap(sell);
    expect(sunday().upgrades.find(u => u.id === 'nets')).toBeUndefined();
  });
});

describe('sponsors are boards, and the offer is the decision', () => {
  const OFFER = {
    id: 'offer-1',
    name: 'Nazir Kebab House',
    blurb: 'Open until three on a Sunday.',
    weekly: 24,
    signOn: 96,
    expiresSeason: 2,
    condition: 'goals' as const,
    conditionText: 'Score 25 league goals this season.',
    conditionProgress: 10,
    conditionTarget: 25,
  };

  it('signs a deal and paints it on a board', async () => {
    await act(async () => {
      useGameStore.setState({
        sunday: { ...sunday(), sponsorOffers: [{ ...OFFER, expiresWeek: 4 }] },
      });
    });
    render(<SundayClubhouse />);
    await tap(screen.getByRole('tab', { name: /Sponsors/ }));

    expect(screen.getByText(OFFER.blurb)).toBeTruthy();
    await tap(screen.getByRole('button', { name: /Sign it/ }));

    expect(sunday().sponsors.map(d => d.name)).toContain(OFFER.name);
    // Progress reads against the target, and is announced as a measurement
    // rather than carried by the width of a coloured bar.
    const meter = screen.getByRole('meter', { name: OFFER.conditionText });
    expect(meter.getAttribute('aria-valuenow')).toBe(String(OFFER.conditionProgress));
    expect(meter.getAttribute('aria-valuemax')).toBe(String(OFFER.conditionTarget));
  });

  it('turns one down without signing it', async () => {
    await act(async () => {
      useGameStore.setState({
        sunday: { ...sunday(), sponsorOffers: [{ ...OFFER, expiresWeek: 4 }] },
      });
    });
    render(<SundayClubhouse />);
    await tap(screen.getByRole('tab', { name: /Sponsors/ }));
    await tap(screen.getByRole('button', { name: /Turn it down/ }));

    expect(sunday().sponsorOffers).toHaveLength(0);
    expect(sunday().sponsors).toHaveLength(0);
  });

  it('paints a live deal on the perimeter of the ground', async () => {
    const deal: SundaySponsorDeal = { ...OFFER, id: 'deal-1' };
    await act(async () => {
      useGameStore.setState({ sunday: { ...sunday(), sponsors: [deal] } });
    });
    render(<SundayClubhouse />);
    expect(sceneMarkup()).toContain(deal.name.slice(0, 14).toUpperCase());
  });
});

describe('the books are one ledger', () => {
  it('lists every week in a single panel, newest first', async () => {
    const weeks = [1, 2, 3];
    await act(async () => {
      useGameStore.setState({
        sunday: {
          ...sunday(),
          ledger: weeks.map(week => ({
            season: 1, week, balance: 300 - week * 20,
            lines: [{ kind: 'subs' as const, amount: 40, label: `Match fees week ${week}` }],
          })),
        },
      });
    });
    const { container } = render(<SundayClubhouse />);
    await tap(screen.getByRole('tab', { name: /The books/ }));

    for (const week of weeks) expect(screen.getByText(`Match fees week ${week}`)).toBeTruthy();
    // Newest first: week 3's line precedes week 1's in document order.
    const text = container.textContent ?? '';
    expect(text.indexOf('Match fees week 3')).toBeLessThan(text.indexOf('Match fees week 1'));
    // Two panels on the tab — the totals and the ledger — not one per week.
    expect(container.querySelectorAll('.glass-surface').length).toBeLessThanOrEqual(3);
  });
});
