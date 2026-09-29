/**
 * The goal celebration and the goal replay must end on their own even though
 * PitchView re-renders every match minute with a FRESH `onDone` arrow.
 *
 * Both effects used to be keyed on `onDone`, so every tick restarted them: at
 * any match speed faster than the overlay's own duration the "GOAL!" card
 * never cleared and the auto-replay looped from its first minute until the
 * player tapped Skip.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { GoalCelebration } from '@/components/game/pitch/GoalCelebration';
import { ReplayOverlay } from '@/components/game/pitch/ReplayOverlay';
import type { MatchTimeline, PitchQuality } from '@/types/game';

const quality = { tier: 'battery', dprCap: 1, trailLen: 0, confetti: 0, weatherScale: 0, gradient: false, vignette: false } as unknown as PitchQuality;
const timeline = { beats: [] } as unknown as MatchTimeline;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

/** Re-render every `tickMs` with a new onDone wrapping the same spy. */
function tickRerenders(rerender: (onDone: () => void) => void, spy: () => void, totalMs: number, tickMs: number) {
  for (let t = 0; t < totalMs; t += tickMs) {
    act(() => { rerender(() => spy()); });
    act(() => { vi.advanceTimersByTime(tickMs); });
  }
}

describe('pitch overlays survive per-minute re-renders', () => {
  it('the goal celebration ends once, on time, at a 1.5s match tick', () => {
    const spy = vi.fn();
    const props = { color: '#f00', text: 'Goal', minute: "12'", homeShort: 'H', awayShort: 'A', homeGoals: 1, awayGoals: 0, scoredByHome: true, confettiCount: 0 };
    const { rerender } = render(<GoalCelebration {...props} onDone={() => spy()} />);
    tickRerenders((onDone) => rerender(<GoalCelebration {...props} onDone={onDone} />), spy, 6000, 1500);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('the goal replay ends once at a 1.5s match tick instead of looping', () => {
    const spy = vi.fn();
    const props = { timeline, quality, homeColor: '#f00', awayColor: '#00f', from: 10, to: 14 };
    const { rerender } = render(<ReplayOverlay {...props} onDone={() => spy()} />);
    tickRerenders((onDone) => rerender(<ReplayOverlay {...props} onDone={onDone} />), spy, 12000, 1500);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
