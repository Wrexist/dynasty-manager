/**
 * Ballon d'Or Night — the 10→1 reveal.
 *
 * Pins: the order cards are turned (10th first, winner last, top 10 only),
 * how each rank is revealed, the per-career/per-season "watched" flag, the
 * ceremony flow (intro → deck → turn → next, skip to the finale), and that
 * neither the season summary nor the Ballon d'Or page names the winner until
 * the night has been watched.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BallonDorCeremony } from '@/components/game/ballonDor/BallonDorCeremony';
import BallonDor from '@/pages/BallonDor';
import SeasonSummary from '@/pages/SeasonSummary';
import { useGameStore } from '@/store/gameStore';
import {
  ceremonyOrder, revealStyleFor, ceremonyCareerKey, hasSeenCeremony, markCeremonySeen,
} from '@/utils/ballonDorCeremony';
import type { BallonDOrEntry, SeasonHistory } from '@/types/game';

function entry(rank: number): BallonDOrEntry {
  return {
    playerId: `p${rank}`, playerName: `Player Rank${rank}`, clubName: rank === 4 ? 'MINE' : 'OTH',
    clubColor: '#123456', position: 'ST', overall: 95 - rank, age: 27, rank,
    score: 100 - rank, goals: 30 - rank, assists: 10, appearances: 38, avgRating: 7.5,
  };
}
const RANKING = Array.from({ length: 25 }, (_, i) => entry(i + 1));

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(s => ({ careerId: 'career-test', activeSlot: 1, settings: { ...s.settings, hidePageHints: true } }));
});
afterEach(cleanup);

describe('ceremonyOrder', () => {
  it('deals the top 10 from 10th to the winner', () => {
    expect(ceremonyOrder(RANKING).map(e => e.rank)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });
  it('tolerates an unsorted or short ranking', () => {
    const shuffled = [entry(3), entry(1), entry(2)];
    expect(ceremonyOrder(shuffled).map(e => e.rank)).toEqual([3, 2, 1]);
    expect(ceremonyOrder([])).toEqual([]);
    expect(ceremonyOrder(undefined)).toEqual([]);
  });
});

describe('revealStyleFor', () => {
  it('flips 10–4 fast, slows the podium, walks the winner out', () => {
    for (let r = 10; r >= 4; r--) expect(revealStyleFor(r)).toBe('quick');
    expect(revealStyleFor(3)).toBe('podium');
    expect(revealStyleFor(2)).toBe('podium');
    expect(revealStyleFor(1)).toBe('winner');
  });
});

describe('watched flag', () => {
  it('is per career and per season', () => {
    markCeremonySeen('career-a', 2);
    expect(hasSeenCeremony('career-a', 2)).toBe(true);
    expect(hasSeenCeremony('career-a', 3)).toBe(false);
    expect(hasSeenCeremony('career-b', 2)).toBe(false);
  });
  it('falls back to the save slot for a pre-careerId save', () => {
    expect(ceremonyCareerKey('abc', 2)).toBe('abc');
    expect(ceremonyCareerKey(null, 2)).toBe('slot-2');
  });
});

describe('BallonDorCeremony', () => {
  function renderCeremony(onFinish = vi.fn(), onClose = vi.fn()) {
    render(
      <BallonDorCeremony season={3} ranking={RANKING} players={{}} playerClubName="MINE" onFinish={onFinish} onClose={onClose} />,
    );
    return { onFinish, onClose };
  }
  const stage = () => screen.getAllByRole('button').find(b => b.getAttribute('tabindex') === '0')!;

  it('opens on the title and keeps every name sealed', () => {
    renderCeremony();
    expect(screen.getAllByText('Ballon d’Or Night').length).toBeGreaterThan(0);
    expect(screen.queryByText('Player Rank1')).toBeNull();
    expect(screen.queryByText('Player Rank10')).toBeNull();
  });

  it('turns 10th first, then moves to 9th — and never shows the winner early', async () => {
    renderCeremony();
    fireEvent.click(stage());                    // intro → deck
    expect(await screen.findByText('No. 10')).toBeTruthy();
    expect(screen.queryByText('Player Rank10')).toBeNull();   // face-down: sealed
    fireEvent.click(stage());                    // turn 10th
    expect(screen.getAllByText('Player Rank10').length).toBeGreaterThan(0);
    fireEvent.click(stage());                    // next card
    expect(await screen.findByText('No. 9')).toBeTruthy();
    expect(screen.queryByText('Player Rank1')).toBeNull();
  });

  it('marks your own finisher', async () => {
    renderCeremony();
    fireEvent.click(stage());
    for (const rank of [10, 9, 8, 7, 6, 5]) {
      await screen.findByText(`No. ${rank}`);
      fireEvent.click(stage());                  // turn
      fireEvent.click(stage());                  // next
    }
    await screen.findByText('No. 4');
    fireEvent.click(stage());                    // turn 4th (club MINE)
    expect(await screen.findByText('Your player')).toBeTruthy();
  });

  it('skip goes to the finale with the winner and the whole top 10, and finishes once', () => {
    const { onFinish, onClose } = renderCeremony();
    fireEvent.click(screen.getByRole('button', { name: 'Skip to the winner' }));
    expect(screen.getAllByText('Player Rank1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Player Rank10').length).toBeGreaterThan(0);
    expect(screen.queryByText('Player Rank11')).toBeNull();
    expect(onFinish).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'See full rankings' }));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('with no ranking renders nothing', () => {
    const { container } = render(
      <BallonDorCeremony season={1} ranking={[]} players={{}} playerClubName="" onFinish={() => {}} onClose={() => {}} />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('no spoilers before the night', () => {
  const history = (): SeasonHistory => ({
    season: 3, position: 5, points: 60, won: 17, drawn: 9, lost: 12, goalsFor: 55, goalsAgainst: 44,
    topScorer: { name: 'Someone', goals: 12 }, boardVerdict: 'good', ballonDOrRanking: RANKING,
  } as unknown as SeasonHistory);

  it('the Ballon d’Or page seals the latest season until it is watched', async () => {
    useGameStore.setState({ seasonHistory: [history()] });
    render(<MemoryRouter><BallonDor /></MemoryRouter>);
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(screen.getByRole('button', { name: /Start the ceremony/ })).toBeTruthy();
    expect(screen.queryByText(/Player Rank1\b/)).toBeNull();
    cleanup();

    markCeremonySeen('career-test', 3);
    render(<MemoryRouter><BallonDor /></MemoryRouter>);
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(screen.queryByRole('button', { name: /Start the ceremony/ })).toBeNull();
    expect(screen.getAllByText('Player Rank1').length).toBeGreaterThan(0);
  });

  it('the season summary shows the sealed teaser, not the winner', async () => {
    useGameStore.setState({ seasonHistory: [history()], season: 4 });
    render(<MemoryRouter><SeasonSummary /></MemoryRouter>);
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(screen.getByRole('button', { name: /Reveal the top 10/ })).toBeTruthy();
    expect(screen.queryByText('Player Rank1')).toBeNull();
  });
});
