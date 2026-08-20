/**
 * The League screen — the table, the news from elsewhere, and the cup.
 *
 * WHAT THIS PINS. The table is the one place in the mode where what the player
 * reads and what the season rollover acts on MUST be the same object, so the
 * cases below compare the rendered rows against `buildSundayTable` directly
 * rather than against a fixture. If the screen ever starts re-deriving the
 * standings itself, this fails.
 *
 * The news strip is the risk the strip itself introduces: a line about another
 * club is a sentence nobody can check, and the temptation is to make one up.
 * Every assertion here checks the claim against `state.fixtures` — the heaviest
 * win really was the heaviest, the leader really does lead on that many points,
 * and the player's own match is never reported back to him.
 *
 * The cup case pins the flattening: one glass surface for the whole ladder, not
 * one per round.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import SundayTable from '@/pages/SundayTable';
import { useGameStore } from '@/store/gameStore';
import { buildSundayTable } from '@/utils/sunday/season';
import { sundayLeagueBuzz } from '@/utils/sunday/view';
import type { Match } from '@/types/game';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

/** Chosen, not arbitrary: with the deterministic scores in `playWeeks` this
 *  seed's division produces a heaviest win, a three-match run and a clear
 *  leader by week six, so the news-strip cases below cannot pass vacuously. */
const SEED = 4471;
const WEEKS = 6;

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

const state = () => useGameStore.getState();
const tap = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

/**
 * Play out the first `weeks` weeks of the division with deterministic scores.
 *
 * Deliberately NOT the match engine: `engine/match.ts` calls `Math.random()`
 * 54 times, and a news strip asserted against an unseeded simulation is a
 * flake generator. A pure hash of the fixture id gives every run the same
 * table, which is what these cases are about.
 */
async function playWeeks(weeks: number) {
  const hash = (text: string) => {
    let n = 0;
    for (const ch of text) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
    return n;
  };
  const fixtures: Match[] = state().fixtures.map(m => (m.week > weeks ? m : {
    ...m, played: true, homeGoals: hash(m.id) % 5, awayGoals: hash(`${m.id}a`) % 4,
  }));
  await act(async () => { useGameStore.setState({ fixtures, week: weeks + 1 }); });
}

const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('the Sunday table is the table the season is judged on', () => {
  it('logs nothing and nests no button inside a button', async () => {
    await playWeeks(WEEKS);
    const { container } = render(<SundayTable />);
    expect(errors, errors.join('\n')).toEqual([]);
    for (const button of container.querySelectorAll('button')) {
      expect(button.querySelector('button'), 'a button inside a button').toBeNull();
    }
  });

  it('renders one row per club, in buildSundayTable order, with its record', async () => {
    await playWeeks(WEEKS);
    const expected = buildSundayTable(state().fixtures, state().sunday!.divisionClubIds);
    render(<SundayTable />);

    const rows = tableRows();
    expect(rows).toHaveLength(expected.length);
    for (const [i, want] of expected.entries()) {
      const club = state().clubs[want.clubId];
      const text = rows[i].textContent ?? '';
      expect(text, `row ${i + 1}`).toContain(club.shortName);
      expect(text, `row ${i + 1} record`).toContain(`${want.won}-${want.drawn}-${want.lost}`);
      expect(text, `row ${i + 1} points`).toContain(String(want.points));
    }
  });

  /** Form is the column the redesign added; it has to be the SAME five results
   *  the table builder capped, letters and all, not a re-derivation. */
  it('shows each club its own last five, newest last', async () => {
    await playWeeks(WEEKS);
    const expected = buildSundayTable(state().fixtures, state().sunday!.divisionClubIds);
    render(<SundayTable />);

    const rows = tableRows();
    for (const [i, want] of expected.entries()) {
      expect(want.form.length).toBeLessThanOrEqual(5);
      const pills = within(rows[i]).getByLabelText(want.form.join(', '));
      expect(pills.textContent, `row ${i + 1} form`).toBe(want.form.join(''));
    }
  });
});

describe('the news strip reports things that happened', () => {
  it('never reports the manager his own result', async () => {
    await playWeeks(WEEKS);
    const s = state();
    render(<SundayTable />);
    const strip = screen.getByText(/Elsewhere/i).closest('div')!;

    const mine = s.fixtures.filter(
      m => m.played && (m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId),
    );
    expect(mine.length).toBeGreaterThan(0);
    const own = s.clubs[s.playerClubId].shortName;
    // The leader line is the one exception a club can earn on merit, and even
    // that is skipped for the player's own club by `sundayLeagueBuzz`.
    for (const line of within(strip).queryAllByRole('listitem')) {
      expect(line.textContent, line.textContent ?? '').not.toContain(`${own} beat`);
      expect(line.textContent, line.textContent ?? '').not.toContain(`${own} have won`);
    }
  });

  it('quotes the leader and the points the table actually gives them', async () => {
    await playWeeks(WEEKS);
    const s = state();
    const top = buildSundayTable(s.fixtures, s.sunday!.divisionClubIds)[0];
    const lines = sundayLeagueBuzz(s.sunday!, s.clubs, s.fixtures, s.playerClubId);
    const leader = lines.find(l => l.kind === 'leader');
    expect(leader, 'the chosen seed should produce a leader line').toBeTruthy();

    render(<SundayTable />);
    expect(screen.getByText(leader!.text)).toBeTruthy();
    expect(leader!.text).toContain(s.clubs[top.clubId].shortName);
    expect(leader!.text).toContain(String(top.points));
  });

  it('only calls a win the heaviest when no other win that week was bigger', async () => {
    await playWeeks(WEEKS);
    const s = state();
    const lines = sundayLeagueBuzz(s.sunday!, s.clubs, s.fixtures, s.playerClubId);
    const heaviest = lines.find(l => l.kind === 'heaviest');
    expect(heaviest, 'the chosen seed should produce a heaviest-win line').toBeTruthy();

    const latest = Math.max(...s.fixtures.filter(m => m.played).map(m => m.week));
    const margins = s.fixtures
      .filter(m => m.played && m.week === latest
        && m.homeClubId !== s.playerClubId && m.awayClubId !== s.playerClubId)
      .map(m => Math.abs(m.homeGoals - m.awayGoals));
    const claimed = heaviest!.text.match(/(\d+)-(\d+)/)!;
    expect(Number(claimed[1]) - Number(claimed[2])).toBe(Math.max(...margins));
    render(<SundayTable />);
    expect(screen.getByText(heaviest!.text)).toBeTruthy();
  });

  it('counts a run off the same form the table shows', async () => {
    await playWeeks(WEEKS);
    const s = state();
    const streak = sundayLeagueBuzz(s.sunday!, s.clubs, s.fixtures, s.playerClubId)
      .find(l => l.kind === 'streak');
    expect(streak, 'the chosen seed should produce a streak line').toBeTruthy();

    const claimed = Number(streak!.text.match(/won (\d+) in a row/)![1]);
    const row = buildSundayTable(s.fixtures, s.sunday!.divisionClubIds)
      .find(r => streak!.text.startsWith(s.clubs[r.clubId].shortName))!;
    let run = 0;
    for (let i = row.form.length - 1; i >= 0 && row.form[i] === 'W'; i--) run++;
    expect(run).toBe(claimed);
  });

  /**
   * The upset line is the one that makes a factual claim ABOUT THE TABLE as
   * well as about a result, so it gets its own seed: nothing else in the suite
   * produces one, and a case that silently returns proves nothing.
   */
  it('measures an upset against the table as it stands', async () => {
    useGameStore.getState().resetGame();
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: 1234 });
    await playWeeks(7);
    const s = state();
    const upset = sundayLeagueBuzz(s.sunday!, s.clubs, s.fixtures, s.playerClubId)
      .find(l => l.kind === 'upset');
    expect(upset, 'seed 1234 should produce an upset line').toBeTruthy();

    const table = buildSundayTable(s.fixtures, s.sunday!.divisionClubIds);
    const pos = new Map(table.map((r, i) => [r.clubId, i + 1]));
    const [, winner, score, gap] =
      upset!.text.match(/^(.+?) beat .+? (\d+-\d+)\. (\d+) places/)!;

    // By club ID, not by short name: two clubs in one division can share a
    // short name ("Crown" and "Crown"), and matching on the printed word would
    // measure the gap for the wrong pair.
    const latest = Math.max(...s.fixtures.filter(m => m.played).map(m => m.week));
    const candidates = s.fixtures.filter(m => {
      if (!m.played || m.week !== latest) return false;
      const won = m.homeGoals > m.awayGoals ? m.homeClubId : m.awayClubId;
      const printed = `${Math.max(m.homeGoals, m.awayGoals)}-${Math.min(m.homeGoals, m.awayGoals)}`;
      return s.clubs[won]?.shortName === winner && printed === score;
    });
    expect(candidates.length).toBeGreaterThan(0);
    const gaps = candidates.map(m => {
      const homeWon = m.homeGoals > m.awayGoals;
      const won = homeWon ? m.homeClubId : m.awayClubId;
      const lost = homeWon ? m.awayClubId : m.homeClubId;
      return (pos.get(won) ?? 0) - (pos.get(lost) ?? 0);
    });
    expect(gaps).toContain(Number(gap));

    render(<SundayTable />);
    expect(screen.getByText(upset!.text)).toBeTruthy();
  });

  it('says nothing at all before a ball is kicked', () => {
    render(<SundayTable />);
    expect(screen.queryByText(/Elsewhere/i)).toBeNull();
  });
});

describe('the cup ladder is one surface', () => {
  it('draws every tie in a single panel', async () => {
    const cup = state().sunday!.cup;
    if (!cup) return;
    const { container } = render(<SundayTable />);
    await tap(screen.getByRole('tab', { name: /Cup/ }));

    // One glass surface for the whole competition — it used to be one for the
    // name plus one per round.
    expect(container.querySelectorAll('.glass-surface')).toHaveLength(1);
    for (const tie of cup.ties) {
      const home = state().clubs[tie.homeClubId];
      const away = state().clubs[tie.awayClubId];
      const items = screen.getAllByRole('listitem')
        .filter(li => li.textContent?.includes(home.shortName) && li.textContent?.includes(away.shortName));
      expect(items.length, `${home.shortName} v ${away.shortName}`).toBeGreaterThan(0);
    }
  });
});
