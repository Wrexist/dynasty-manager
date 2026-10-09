/**
 * The substitution sheet's two clean steps: pick who comes off (the bench
 * becomes a choice, best fit first and marked Recommended, each with a plain
 * fit tag), pick who comes on (a card with just rating, energy and fit), and
 * confirm — the sub is made at once, the swap plays, and the sheet closes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { SubstitutionSheet } from '@/components/game/SubstitutionSheet';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('substitution sheet flow', () => {
  beforeEach(() => {
    // Pin the world: unpinned, CI sometimes rolled a bench with no one who can
    // cover the first outfield slot, so nothing was marked Recommended.
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(1));
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame('arsenal');
    useGameStore.setState({ matchSubsUsed: 0 });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('pre-picked player: the bench is a ranked choice with fit tags, best first', () => {
    const s = useGameStore.getState();
    const club = s.clubs[s.playerClubId];
    const outId = club.lineup.find(id => s.players[id]?.position !== 'GK')!;
    render(<SubstitutionSheet open onOpenChange={() => {}} preSelectedOutId={outId} matchMinute={60} homeGoals={0} awayGoals={0} />);
    const picks = screen.getAllByRole('button', { name: /^Bring on / });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0].getAttribute('aria-label')).toMatch(/recommended/);
    expect(picks.filter(b => /recommended/.test(b.getAttribute('aria-label') || ''))).toHaveLength(1);
    // Every option says how it fits the slot.
    for (const b of picks) expect(b.getAttribute('aria-label')).toMatch(/Natural fit|Can play there|Out of position/);
  });

  it('confirm makes the sub immediately, then closes after the swap plays', async () => {
    const s = useGameStore.getState();
    const club = s.clubs[s.playerClubId];
    const outId = club.lineup.find(id => s.players[id]?.position !== 'GK')!;
    const onOpenChange = vi.fn();
    const onSubMade = vi.fn();
    render(<SubstitutionSheet open onOpenChange={onOpenChange} onSubMade={onSubMade} preSelectedOutId={outId} matchMinute={60} homeGoals={0} awayGoals={0} />);
    const first = screen.getAllByRole('button', { name: /^Bring on / })[0];
    const inName = first.getAttribute('aria-label')!;
    fireEvent.click(first);
    // The confirm card replaces the pitch once its exit fade finishes.
    expect(await screen.findByText(/^Rating/)).toBeTruthy();
    expect(screen.getByText(/^Energy/)).toBeTruthy();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /confirm sub/i }));
    // The store has the sub straight away…
    const after = useGameStore.getState();
    expect(after.matchSubsUsed).toBe(1);
    expect(after.clubs[after.playerClubId].lineup).not.toContain(outId);
    expect(inName).toBeTruthy();
    // …the buttons lock while the swap plays, and the sheet closes after it.
    expect((screen.getByRole('button', { name: /confirm sub/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(800); });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubMade).toHaveBeenCalledTimes(1);
  });
});
