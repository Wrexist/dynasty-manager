/**
 * Cards mode: a player card stands on every published player position and
 * follows it frame by frame; the celebrating scorer's card hides; a spotlit
 * player is flagged for the gold glow.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { PitchCardLayer } from '@/components/game/pitch/PitchCardLayer';
import type { PitchBallScreen, PitchHitTarget } from '@/components/game/pitch/PitchCanvas';
import type { Player } from '@/types/game';

const player = (id: string, overall: number, position = 'CM'): Player => ({ id, overall, position, firstName: id, lastName: id } as unknown as Player);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('PitchCardLayer', () => {
  it('places, hides and spotlights cards from the published targets', () => {
    const ref = { current: [
      { id: 'a', x: 100, y: 200, r: 10, team: 'home', highlighted: true },
      { id: 'b', x: 50, y: 80, r: 10, team: 'away' },
    ] as PitchHitTarget[] };
    const players = { a: player('a', 88), b: player('b', 71, 'GK') };
    const { container, getByText } = render(<PitchCardLayer hitTargetsRef={ref} players={players} homeColor="#ff0000" awayColor="#0000ff" hiddenId="b" />);
    act(() => { vi.advanceTimersByTime(50); });
    act(() => { vi.advanceTimersByTime(50); });
    expect(getByText('88')).toBeTruthy();
    expect(getByText('GK')).toBeTruthy();
    const cards = container.querySelectorAll<HTMLDivElement>('[data-lit]');
    expect(cards).toHaveLength(2);
    const a = [...cards].find(c => c.textContent?.includes('88'))!;
    const b = [...cards].find(c => c.textContent?.includes('71'))!;
    expect(a.dataset.lit).toBe('1');
    expect(a.style.opacity).toBe('1');
    expect(b.style.opacity).toBe('0'); // the celebrating card hides
    expect(a.style.transform).toContain('translate3d(');
    // Lower on screen draws on top.
    expect(Number(a.style.zIndex)).toBeGreaterThan(Number(b.style.zIndex));
  });

  it('labels every card with the player\'s short name, underlined in his kit', () => {
    const ref = { current: [{ id: 'a', x: 100, y: 200, r: 10, team: 'away' }] as PitchHitTarget[] };
    const players = { a: { ...player('a', 84, 'RW'), firstName: 'Vinicius', lastName: 'Jr.' } as Player };
    const { getByText } = render(<PitchCardLayer hitTargetsRef={ref} players={players} homeColor="#ff0000" awayColor="#0000ff" />);
    act(() => { vi.advanceTimersByTime(50); });
    act(() => { vi.advanceTimersByTime(50); });
    const label = getByText('Vinicius'); // suffix-only surname falls back to the first name
    expect(label.parentElement!.style.boxShadow).toContain('#0000ff');
  });

  it('draws the ball above every card, lifted by its arc, and hides it when none is published', () => {
    const ref = { current: [{ id: 'a', x: 100, y: 200, r: 10, team: 'home' }] as PitchHitTarget[] };
    const ballRef = { current: { x: 120, y: 210, r: 6, lift: 8 } as PitchBallScreen | null };
    const { container } = render(<PitchCardLayer hitTargetsRef={ref} ballRef={ballRef} players={{ a: player('a', 80) }} homeColor="#f00" awayColor="#00f" />);
    act(() => { vi.advanceTimersByTime(50); });
    act(() => { vi.advanceTimersByTime(50); });
    const ball = container.querySelector<HTMLDivElement>('.rounded-full[style*="z-index: 100000"]')!;
    expect(ball).toBeTruthy();
    expect(ball.style.opacity).toBe('1');
    expect(ball.style.width).toBe('12px');
    expect(ball.style.transform).toBe('translate3d(114px, 196px, 0)'); // x - r, y - lift - r
    const card = container.querySelector<HTMLDivElement>('[data-lit]')!;
    expect(Number(ball.style.zIndex)).toBeGreaterThan(Number(card.style.zIndex));
    ballRef.current = null;
    act(() => { vi.advanceTimersByTime(50); });
    expect(ball.style.opacity).toBe('0');
  });
});
