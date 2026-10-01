/**
 * Your-goal card celebration (Cards mode): the scorer's card leaves from — and
 * returns to — exactly where his pitch card stands, runs fly → hold → return
 * on the configured clock, finishes once, and a tap or reduced motion cuts it
 * short without skipping the hand-back.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { CardGoalCelebration } from '@/components/game/pitch/CardGoalCelebration';
import { celebrationCardWidth, pitchCardBox, pitchCardPose } from '@/components/game/pitch/pitchGeometry';
import type { PitchHitTarget } from '@/components/game/pitch/PitchCanvas';
import { PITCH_RENDER } from '@/config/pitchChoreography';
import type { Player } from '@/types/game';

vi.mock('@/components/game/PlayerCard', () => ({
  PlayerCard: ({ player }: { player: Player }) => <div data-testid="big-card">{player.overall}</div>,
}));

const scorer = { id: 's', overall: 86, position: 'ST', firstName: 'Erling', lastName: 'Haaland' } as unknown as Player;
const { CARD_GOAL_FLY_MS: FLY, CARD_GOAL_HOLD_MS: HOLD, CARD_GOAL_RETURN_MS: RET, CARD_GOAL_REDUCED_MS: REDUCED } = PITCH_RENDER;

function setup(reducedMotion = false) {
  const onDone = vi.fn();
  const ref = { current: [{ id: 's', x: 120, y: 300, r: 10, team: 'home' }] as PitchHitTarget[] };
  const utils = render(
    <CardGoalCelebration
      player={scorer} hitTargetsRef={ref} width={390} height={480} color="#c8102e" minute="67'"
      assistName="Ødegaard" homeShort="ARS" awayShort="CHE" homeGoals={2} awayGoals={1} scoredByHome
      confettiCount={6} reducedMotion={reducedMotion} onDone={onDone}
    />,
  );
  const root = () => utils.getByTestId('card-goal-celebration');
  return { ...utils, onDone, ref, root };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('card celebration geometry', () => {
  it('starts exactly over the pitch card standing on the target', () => {
    const t = { id: 's', x: 120, y: 300, r: 10 } as PitchHitTarget;
    const cardW = 160;
    const p = pitchCardPose(t, cardW, 390, 480);
    const b = pitchCardBox(t);
    expect(p.scale).toBeCloseTo(b.w / cardW);
    expect(p.x + cardW / 2).toBeCloseTo(b.cx); // same centre
    expect(p.y + (cardW * 1.5) / 2).toBeCloseTo(b.cy);
  });

  it('stands the card and its name label just above the player\'s spot', () => {
    const t = { id: 's', x: 120, y: 300, r: 10 } as PitchHitTarget;
    const b = pitchCardBox(t);
    expect(b.w).toBeCloseTo(t.r * PITCH_RENDER.CARD_TOKEN_R_SCALE);
    expect(b.h).toBeCloseTo(b.w * 1.5);
    expect(b.cx).toBe(t.x);
    // Label bottom = top + card + label (all scaled), sitting LIFT_R*r above the spot.
    const labelBottom = b.y + b.h + PITCH_RENDER.CARD_TOKEN_LABEL_H * b.scale;
    expect(labelBottom).toBeCloseTo(t.y - t.r * PITCH_RENDER.CARD_TOKEN_LIFT_R);
    expect(b.y + b.h).toBeLessThan(t.y); // the card body never covers the spot
  });

  it('falls back to a small card rising from the bottom when the scorer is not on screen', () => {
    const p = pitchCardPose(undefined, 160, 390, 480);
    expect(p.scale).toBeLessThan(0.3);
    expect(p.x + 80).toBeCloseTo(195);
  });

  it('sizes the big card to the width, capped so the text fits', () => {
    expect(celebrationCardWidth(390, 2000)).toBe(Math.round(Math.min(390 * PITCH_RENDER.CARD_GOAL_W_FRAC, 240)));
    const short = celebrationCardWidth(390, 330);
    expect(short * 1.5 + PITCH_RENDER.CARD_GOAL_TEXT_ROOM).toBeLessThanOrEqual(331);
  });
});

describe('CardGoalCelebration', () => {
  it('flies, holds, returns, then finishes exactly once', () => {
    const { root, onDone, getByText, getByTestId } = setup();
    expect(root().dataset.phase).toBe('fly');
    expect(getByTestId('big-card').textContent).toBe('86');
    act(() => { vi.advanceTimersByTime(FLY); });
    expect(root().dataset.phase).toBe('hold');
    expect(getByText('Goal!')).toBeTruthy();
    expect(getByText(/Assist: Ødegaard/)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(HOLD); });
    expect(root().dataset.phase).toBe('return');
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(RET); });
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a tap skips to the flight home — the card still lands before it ends', () => {
    const { root, onDone } = setup();
    act(() => { vi.advanceTimersByTime(FLY + 100); });
    fireEvent.click(root());
    expect(root().dataset.phase).toBe('return');
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(root()); // a second tap mid-return changes nothing
    act(() => { vi.advanceTimersByTime(RET); });
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(FLY + HOLD + RET); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reduced motion: a still card, no flight, no confetti, ends on its own clock', () => {
    const { root, onDone, container } = setup(true);
    expect(root().dataset.phase).toBe('hold');
    expect(container.querySelectorAll('.w-1\\.5.h-full')).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(REDUCED - 1); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
