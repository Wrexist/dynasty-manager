/**
 * The squad — fifteen people, rendered.
 *
 * The redesign turned a table into a stack of cards, which puts three things at
 * risk that a type-check cannot see:
 *
 *   1. the join. The list must show exactly the men `sundaySquadView` returns —
 *      no more (a dangling id rendered blank) and no fewer;
 *   2. the authored voice. A memory is written by the simulation and is the
 *      reason the screen is not a spreadsheet. It must reach the DOM WHOLE.
 *      `line-clamp` is CSS and is fine; a `.slice(0, 60)` in a card is not,
 *      which is precisely what a "less text" pass is tempted to add;
 *   3. the two actions that live only here. `releaseSundayPlayer` is reachable
 *      from nowhere else in the mode at all, and losing it to a redesign is
 *      silent — nothing breaks, the button is simply gone.
 *
 * Plus the hygiene the hub's own render test pins: nothing logged, and no
 * button nested inside a button (React warns, the inner control is unreachable
 * by keyboard, and one tap does two things).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SundaySquad from '@/pages/SundaySquad';
import { useGameStore } from '@/store/gameStore';
import { en } from '@/i18n/locales/en';
import { getSundayArchetype, SUNDAY_MEMORY_LEGENDARY_WEIGHT } from '@/config/sundayLeague';
import { sundaySquadView, sundayTopMemories } from '@/utils/sunday/view';
import { sundayRatingTier } from '@/utils/sunday/visuals';
import type { SundayMemory } from '@/types/game';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

const SEED = 4242;

/** The three the collapsed card summarises, in the order it draws them. */
const MOOD_FITNESS_FORM = [
  en['sunday.squad.happiness'], en['sunday.squad.fitness'], en['sunday.squad.form'],
] as const;

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

/** The card for a given player id — the button's parent, which is the shell
 *  `SundayPlayerCard` draws and the element the detail panel is appended to. */
function cardFor(playerId: string): HTMLElement {
  const s = useGameStore.getState();
  const p = s.players[playerId];
  const button = screen.getByRole('button', { name: new RegExp(`${p.firstName} ${p.lastName}`) });
  return button.parentElement as HTMLElement;
}

/** Open that card and hand it back. */
function openCard(playerId: string): HTMLElement {
  const card = cardFor(playerId);
  fireEvent.click(within(card).getAllByRole('button')[0]);
  return card;
}

describe('SundaySquad renders the people', () => {
  it('logs nothing and nests no button inside a button', () => {
    const { container } = render(<SundaySquad />);
    expect(errors, errors.join('\n')).toEqual([]);
    expect(container.querySelectorAll('button button')).toHaveLength(0);
  });

  it('shows one card per man the shared view returns, and no others', () => {
    const s = useGameStore.getState();
    const rows = sundaySquadView(s.sunday!, s.players);
    expect(rows.length).toBeGreaterThan(10);

    render(<SundaySquad />);
    // One disclosure control per man.
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(rows.length);
    for (const { member, player } of rows) {
      expect(screen.getByText(`${player.firstName} ${player.lastName}`), player.id).toBeTruthy();
      // His identity: position, archetype and weekday job on one line.
      const arch = getSundayArchetype(member.archetype);
      expect(
        screen.getAllByText(`${player.position} · ${arch.name} · ${member.job}`).length,
        player.id,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * The one visual thing that cannot be derived (see `shirtNumber`'s docblock).
   * Every man wears his own, and the list draws it.
   */
  it('puts every squad number on the list, uniquely', () => {
    const s = useGameStore.getState();
    const numbers = s.sunday!.squad.map(m => m.shirtNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    render(<SundaySquad />);
    for (const n of numbers) expect(screen.getAllByText(String(n)).length).toBeGreaterThan(0);
  });

  /**
   * The collapsed card has to summarise what expanding holds. Before the
   * redesign it showed a name and a pill, so opening one was a lucky dip.
   */
  it('summarises mood, fitness and form on every collapsed card', () => {
    const s = useGameStore.getState();
    const rows = sundaySquadView(s.sunday!, s.players);
    render(<SundaySquad />);
    for (const label of MOOD_FITNESS_FORM) {
      expect(screen.getAllByRole('meter', { name: label })).toHaveLength(rows.length);
    }
    // …reading, on each man's own card, the values the state holds for him.
    for (const { member, player } of rows) {
      const card = cardFor(player.id);
      const mood = within(card).getByRole('meter', { name: en['sunday.squad.happiness'] });
      expect(mood.getAttribute('aria-valuenow'), player.id).toBe(String(Math.round(member.happiness)));
      const fitness = within(card).getByRole('meter', { name: en['sunday.squad.fitness'] });
      expect(fitness.getAttribute('aria-valuenow'), player.id).toBe(String(Math.round(player.fitness)));
      const form = within(card).getByRole('meter', { name: en['sunday.squad.form'] });
      expect(form.getAttribute('aria-valuenow'), player.id).toBe(String(Math.round(player.form)));
    }
  });

  /**
   * …AND SAYS IT IN GLYPHS.
   *
   * The three meters are right; the three WORDS beside them were not, because
   * they were the same three words on all fifteen rows — measured, most of why
   * a pass that set out to cut copy took this screen from 925 to 1364
   * characters on the glass. The words are gone from the row and the glyph
   * carries them.
   *
   * WHAT MUST NOT GO WITH THEM is the label a screen reader reads: `Meter`
   * keeps `label` as the meter's `aria-label`, so the element still announces
   * "Mood 72" rather than a naked "72". This test is the thing standing
   * between "fewer characters" and "fewer characters for sighted users only".
   */
  it('drops the repeated words from the row but not from the accessible name', () => {
    const s = useGameStore.getState();
    const rows = sundaySquadView(s.sunday!, s.players);
    render(<SundaySquad />);

    for (const { player } of rows) {
      const card = cardFor(player.id);
      for (const label of MOOD_FITNESS_FORM) {
        // Not printed on the row — fifteen times three words is the bug.
        expect(within(card).queryAllByText(label), `${player.id} ${label}`).toHaveLength(0);
        // Still the meter's name, and still paired with its own value.
        const meter = within(card).getByRole('meter', { name: label });
        expect(meter.getAttribute('aria-label'), `${player.id} ${label}`).toBe(label);
        expect(meter.getAttribute('aria-valuenow'), `${player.id} ${label}`).toBeTruthy();
        // AND ON THE GLYPH. The meter sits inside the disclosure button, and a
        // button is named from its CONTENT — the meter is flattened into that
        // name and contributes its value but not its label, so without this
        // the card would announce "… 59 74 81 61 Available" and the three
        // words would be lost to anyone who tabs to the row rather than
        // exploring inside it. Measured in Chrome over CDP: with it, the
        // card's accessible name is byte-identical to the words-on-the-row
        // version it replaced.
        const named = card.querySelector(`[role="img"][aria-label="${label}"]`);
        expect(named, `${player.id} ${label} glyph is unnamed`).toBeTruthy();
      }
    }
  });

  /** The word survives where it is drawn ONCE — on the one open card. */
  it('still writes Mood out in full inside the panel that opens', () => {
    const rows = sundaySquadView(useGameStore.getState().sunday!, useGameStore.getState().players);
    render(<SundaySquad />);
    const card = openCard(rows[0].player.id);
    expect(within(card).getAllByText(en['sunday.squad.happiness']).length).toBeGreaterThan(0);
  });

  it('colours a rating by the modes own ladder, not the house one', () => {
    const s = useGameStore.getState();
    const rows = sundaySquadView(s.sunday!, s.players);
    render(<SundaySquad />);
    // Nobody in this world reaches the house `>= 80 emerald` threshold, so if
    // the card ever went back to it every number here would be muted.
    expect(rows.every(r => r.player.overall < 80)).toBe(true);
    const tiers = new Set(rows.map(r => sundayRatingTier(r.player.overall)));
    expect(tiers.size, 'a squad should not be one flat colour').toBeGreaterThan(1);
  });

  it('opens one card at a time', () => {
    const s = useGameStore.getState();
    const rows = sundaySquadView(s.sunday!, s.players);
    render(<SundaySquad />);

    openCard(rows[0].player.id);
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
    openCard(rows[1].player.id);
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(rows.length - 1);
  });

  /**
   * ★-ONLY ACTIONS. The armband is also on the teamsheet; the release is on no
   * other screen in the mode. Both have to survive every redesign of this page.
   */
  it('keeps the armband and the release reachable', async () => {
    const s = useGameStore.getState();
    const rows = sundaySquadView(s.sunday!, s.players);
    render(<SundaySquad />);

    // Somebody who is not already wearing it — the generator hands the armband
    // out at setup, and his button reads "Captain" rather than offering it.
    const target = rows.find(r => r.player.id !== s.sunday!.captainId)!;
    const card = openCard(target.player.id);
    expect(within(card).getByRole('button', { name: en['sunday.squad.release'] })).toBeTruthy();
    const armband = within(card).getByRole('button', { name: en['sunday.sheet.makeCaptain'] });

    // The store action is async — the whole mode is a lazily-imported chunk.
    fireEvent.click(armband);
    await waitFor(() => expect(useGameStore.getState().sunday!.captainId).toBe(target.player.id));
  });

  it('asks before releasing anyone', () => {
    const s = useGameStore.getState();
    const rows = sundaySquadView(s.sunday!, s.players);
    const victim = rows[0].player;
    render(<SundaySquad />);

    const card = openCard(victim.id);
    fireEvent.click(within(card).getByRole('button', { name: en['sunday.squad.release'] }));
    // The confirm names him rather than asking a generic question — and until
    // it is answered, he is still on the books.
    expect(screen.getByText(`Tell ${victim.firstName} ${victim.lastName} he is not needed?`)).toBeTruthy();
    expect(useGameStore.getState().sunday!.squad.some(m => m.playerId === victim.id)).toBe(true);
  });
});

/**
 * The voice. Memories are written by the simulation; the card is only allowed
 * to order them and put them on a screen.
 */
describe('SundaySquad renders a man\'s story whole', () => {
  const memory = (over: Partial<SundayMemory>): SundayMemory => ({
    kind: 'motm',
    season: 1,
    week: 3,
    weight: 4,
    text: 'Ran the midfield on a pitch that was mostly standing water, and did not stop talking about it for a month.',
    ...over,
  });

  beforeEach(() => {
    const s = useGameStore.getState();
    const sunday = s.sunday!;
    // Six, so the cap is exercised as well as the ordering.
    const memories: SundayMemory[] = [
      memory({ weight: 2, week: 1, text: 'Made his debut against the Ship Inn.' }),
      memory({ weight: SUNDAY_MEMORY_LEGENDARY_WEIGHT, week: 9, kind: 'cup-hero', text: 'Won the cup tie on his own in the last ten minutes.' }),
      memory({ weight: 3, week: 4, kind: 'first-goal', text: 'Scored his first for the club.' }),
      memory({ weight: 5, week: 6, kind: 'hat-trick', text: 'Three goals, and he only turned up at ten past.' }),
      memory({ weight: 1, week: 2, kind: 'bad-day', text: 'A truly abject afternoon at the back.' }),
      memory({ weight: 1, week: 7, kind: 'red-card', text: 'Sent off for talking.' }),
    ];
    useGameStore.setState({
      sunday: {
        ...sunday,
        squad: sunday.squad.map((m, i) => (i === 0 ? { ...m, memories } : m)),
      },
    });
  });

  it('prints every memory it shows in full, heaviest first', () => {
    const s = useGameStore.getState();
    const member = s.sunday!.squad[0];
    const shown = sundayTopMemories(member, 5);
    expect(shown).toHaveLength(5);
    // Heaviest first, and ties broken on recency.
    expect(shown[0].weight).toBe(SUNDAY_MEMORY_LEGENDARY_WEIGHT);
    expect(shown.map(m => m.weight)).toEqual([...shown.map(m => m.weight)].sort((a, b) => b - a));
    const dropped = sundayTopMemories(member, 6)[5];

    render(<SundaySquad />);
    const card = openCard(member.playerId);

    for (const mem of shown) {
      // Whole sentence, not a truncation.
      expect(within(card).getByText(new RegExp(escapeRe(mem.text))), mem.text).toBeTruthy();
    }
    // The one it did not have room for is genuinely absent rather than clipped.
    expect(within(card).queryByText(new RegExp(escapeRe(dropped.text)))).toBeNull();
  });

  it('badges the afternoon the club still talks about', () => {
    const member = useGameStore.getState().sunday!.squad[0];
    render(<SundaySquad />);
    const card = openCard(member.playerId);
    expect(within(card).getByText(new RegExp(en['sunday.story.legendary']))).toBeTruthy();
  });

  it('says so plainly when a man has no story yet', () => {
    const member = useGameStore.getState().sunday!.squad[1];
    expect(member.memories).toHaveLength(0);
    render(<SundaySquad />);
    const card = openCard(member.playerId);
    expect(within(card).getByText(en['sunday.bio.noStory'])).toBeTruthy();
  });

  /**
   * Decoration must be ABSENT under reduced motion, not merely still:
   * `MotionConfig reducedMotion="always"` stops transforms and leaves paint
   * alone, so the shirt-number watermark on the open card has to not render.
   */
  it('does not paint the shirt-number watermark under reduced motion', () => {
    const member = useGameStore.getState().sunday!.squad[0];
    const number = String(member.shirtNumber);
    const countNumber = (root: HTMLElement) =>
      within(root).queryAllByText(number).length;

    const withMark = render(<SundaySquad />);
    const openCardWith = openCard(member.playerId);
    const before = countNumber(openCardWith);
    // The badge on the portrait plus the watermark behind the blurb.
    expect(before).toBe(2);
    withMark.unmount();

    useGameStore.setState({
      settings: { ...useGameStore.getState().settings, reducedMotion: true },
    });
    render(<SundaySquad />);
    expect(countNumber(openCard(member.playerId))).toBe(1);
  });

  it('shows his archetype blurb — character, not a category label', () => {
    const member = useGameStore.getState().sunday!.squad[0];
    render(<SundaySquad />);
    const card = openCard(member.playerId);
    expect(within(card).getByText(getSundayArchetype(member.archetype).blurb)).toBeTruthy();
  });
});
