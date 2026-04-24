import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Player } from '@/types/game';
import { PackCard } from '@/components/game/pack/PackCard';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p-1',
    firstName: 'Cristiano',
    lastName: 'Ronaldo',
    age: 38,
    nationality: 'Portugal',
    position: 'ST',
    attributes: { pace: 82, shooting: 93, passing: 82, defending: 35, physical: 80, mental: 92 },
    overall: 88,
    potential: 88,
    clubId: 'c1',
    wage: 500000,
    value: 20_000_000,
    contractEnd: 2026,
    fitness: 88,
    morale: 75,
    form: 70,
    injured: false,
    injuryWeeks: 0,
    goals: 25,
    assists: 5,
    appearances: 30,
    careerGoals: 850,
    careerAssists: 240,
    careerAppearances: 1100,
    yellowCards: 1,
    redCards: 0,
    ...overrides,
  } as Player;
}

describe('PackCard', () => {
  describe('face-down state', () => {
    it('is a keyboard-focusable button with a "Tap to reveal" label', () => {
      render(<PackCard player={makePlayer()} revealed={false} onReveal={() => {}} />);
      const btn = screen.getByRole('button', { name: 'Tap to reveal' });
      expect(btn.getAttribute('tabindex')).toBe('0');
    });

    it('calls onReveal when clicked', () => {
      const onReveal = vi.fn();
      render(<PackCard player={makePlayer()} revealed={false} onReveal={onReveal} />);
      fireEvent.click(screen.getByRole('button', { name: 'Tap to reveal' }));
      expect(onReveal).toHaveBeenCalledOnce();
    });

    it('calls onReveal on Enter and Space keydown', () => {
      const onReveal = vi.fn();
      render(<PackCard player={makePlayer()} revealed={false} onReveal={onReveal} />);
      const btn = screen.getByRole('button', { name: 'Tap to reveal' });

      fireEvent.keyDown(btn, { key: 'Enter' });
      fireEvent.keyDown(btn, { key: ' ' });
      expect(onReveal).toHaveBeenCalledTimes(2);
    });

    it('hides the face from AT with aria-hidden while face-down', () => {
      const { container } = render(
        <PackCard player={makePlayer()} revealed={false} onReveal={() => {}} />,
      );
      // The face wrapper carries the face-down aria-hidden flag (true).
      const face = container.querySelector('[aria-hidden="true"]');
      expect(face).toBeTruthy();
    });

    it('is not interactive when onReveal is omitted (already-pulled display mode)', () => {
      const { container } = render(<PackCard player={makePlayer()} revealed={false} />);
      // No role='button' should be present (outer wrapper + buttons inside PlayerCard are face-down hidden).
      expect(container.querySelector('[role="button"]')).toBeNull();
    });
  });

  describe('revealed state', () => {
    it('no longer captures wrapper clicks and passes the face to PlayerCard as cyclable', () => {
      const onReveal = vi.fn();
      render(<PackCard player={makePlayer()} revealed={true} onReveal={onReveal} />);
      // Face is now active; wrapper is no longer a reveal button.
      expect(screen.queryByRole('button', { name: 'Tap to reveal' })).toBeNull();
      // PlayerCard inside is interactive="cycle" — its aria-label carries the cycle hint.
      expect(screen.getByRole('button', { name: /Tap to cycle stat views/ })).toBeTruthy();
    });

    it('renders the quick-release button with a severance-clarifying label when onDismiss is provided', () => {
      const onDismiss = vi.fn();
      render(
        <PackCard
          player={makePlayer()}
          revealed={true}
          onReveal={() => {}}
          onDismiss={onDismiss}
        />,
      );
      const dismiss = screen.getByLabelText('Release Cristiano Ronaldo (1 week severance)');
      fireEvent.click(dismiss);
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it('does not render the dismiss button when revealed but onDismiss is omitted', () => {
      render(<PackCard player={makePlayer()} revealed={true} onReveal={() => {}} />);
      expect(screen.queryByLabelText(/Release Cristiano Ronaldo/)).toBeNull();
    });
  });
});
