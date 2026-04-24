import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Player } from '@/types/game';
import { PlayerCard, PLAYER_CARD_SIZE_PX, type PlayerCardSize } from '@/components/game/PlayerCard';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p-1',
    firstName: 'Lionel',
    lastName: 'Messi',
    age: 36,
    nationality: 'Argentina',
    position: 'RW',
    attributes: { pace: 80, shooting: 92, passing: 90, defending: 40, physical: 65, mental: 95 },
    overall: 91,
    potential: 91,
    clubId: 'c1',
    wage: 500000,
    value: 50_000_000,
    contractEnd: 2028,
    fitness: 90,
    morale: 85,
    form: 78,
    injured: false,
    injuryWeeks: 0,
    goals: 20,
    assists: 15,
    appearances: 30,
    careerGoals: 900,
    careerAssists: 500,
    careerAppearances: 1000,
    yellowCards: 2,
    redCards: 0,
    ...overrides,
  } as Player;
}

describe('PlayerCard', () => {
  describe('size presets', () => {
    const sizes: PlayerCardSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

    it.each(sizes)('renders at size "%s" without crashing', (size) => {
      const { container } = render(
        <PlayerCard player={makePlayer()} size={size} interactive="none" />,
      );
      // Each preset maps to a documented pixel width on the root.
      const root = container.querySelector('[aria-label]') as HTMLElement;
      expect(root).toBeTruthy();
      expect(root.style.width).toBe(`${PLAYER_CARD_SIZE_PX[size]}px`);
    });
  });

  describe('aria-label', () => {
    it('includes name, overall, and the cycle hint for interactive="cycle"', () => {
      render(<PlayerCard player={makePlayer()} interactive="cycle" />);
      const root = screen.getByRole('button');
      expect(root.getAttribute('aria-label')).toBe(
        'Lionel Messi, 91 overall. Showing stats. Tap to cycle stat views.',
      );
    });

    it('uses the "Open details" hint for interactive="detail"', () => {
      render(<PlayerCard player={makePlayer()} interactive="detail" />);
      expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
        'Lionel Messi, 91 overall. Open details.',
      );
    });

    it('omits interaction hints when interactive="none"', () => {
      const { container } = render(
        <PlayerCard player={makePlayer()} interactive="none" />,
      );
      const root = container.querySelector('[aria-label]') as HTMLElement;
      // No role → not a button; aria-label is the bare identity string.
      expect(root.getAttribute('role')).toBeNull();
      expect(root.getAttribute('aria-label')).toBe('Lionel Messi, 91 overall.');
      expect(root.getAttribute('tabindex')).toBeNull();
    });
  });

  describe('cycle interaction', () => {
    it('advances the view on click and updates the aria-label', () => {
      render(<PlayerCard player={makePlayer()} interactive="cycle" />);
      const root = screen.getByRole('button');
      expect(root.getAttribute('aria-label')).toContain('Showing stats');

      fireEvent.click(root);
      expect(root.getAttribute('aria-label')).toContain('Showing profile');

      fireEvent.click(root);
      expect(root.getAttribute('aria-label')).toContain('Showing condition');

      // Wraps back to stats
      fireEvent.click(root);
      expect(root.getAttribute('aria-label')).toContain('Showing stats');
    });

    it('advances the view on Enter and Space keydown', () => {
      render(<PlayerCard player={makePlayer()} interactive="cycle" />);
      const root = screen.getByRole('button');

      fireEvent.keyDown(root, { key: 'Enter' });
      expect(root.getAttribute('aria-label')).toContain('Showing profile');

      fireEvent.keyDown(root, { key: ' ' });
      expect(root.getAttribute('aria-label')).toContain('Showing condition');
    });

    it('clamps the cycle to 2 views when showConditionView=false', () => {
      render(
        <PlayerCard player={makePlayer()} interactive="cycle" showConditionView={false} />,
      );
      const root = screen.getByRole('button');

      fireEvent.click(root);
      expect(root.getAttribute('aria-label')).toContain('Showing profile');

      // With 2 views, a second tap should wrap back to stats — not land on condition.
      fireEvent.click(root);
      expect(root.getAttribute('aria-label')).toContain('Showing stats');
      expect(root.getAttribute('aria-label')).not.toContain('condition');
    });
  });

  describe('detail interaction', () => {
    it('calls onDetailClick with the player on click', () => {
      const onDetailClick = vi.fn();
      const player = makePlayer();
      render(
        <PlayerCard player={player} interactive="detail" onDetailClick={onDetailClick} />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onDetailClick).toHaveBeenCalledTimes(1);
      expect(onDetailClick).toHaveBeenCalledWith(player);
    });

    it('is a no-op when onDetailClick is not provided', () => {
      render(<PlayerCard player={makePlayer()} interactive="detail" />);
      // Should not throw on click.
      fireEvent.click(screen.getByRole('button'));
    });
  });

  describe('compact mode', () => {
    it('downgrades interactive="cycle" to non-interactive', () => {
      const { container } = render(
        <PlayerCard player={makePlayer()} interactive="cycle" compact size="sm" />,
      );
      const root = container.querySelector('[aria-label]') as HTMLElement;
      expect(root.getAttribute('role')).toBeNull();
      expect(root.getAttribute('tabindex')).toBeNull();
    });

    it('preserves interactive="detail" when compact', () => {
      const onDetailClick = vi.fn();
      render(
        <PlayerCard
          player={makePlayer()}
          interactive="detail"
          compact
          size="sm"
          onDetailClick={onDetailClick}
        />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onDetailClick).toHaveBeenCalledOnce();
    });
  });

  describe('dismiss button', () => {
    it('renders with a player-named aria-label when onDismiss is provided', () => {
      render(
        <PlayerCard player={makePlayer()} interactive="none" onDismiss={() => {}} />,
      );
      expect(screen.getByLabelText('Release Lionel Messi')).toBeTruthy();
    });

    it('uses a custom dismissLabel when provided', () => {
      render(
        <PlayerCard
          player={makePlayer()}
          interactive="none"
          onDismiss={() => {}}
          dismissLabel="Quick-sell (1 week severance)"
        />,
      );
      expect(screen.getByLabelText('Quick-sell (1 week severance)')).toBeTruthy();
    });

    it('calls onDismiss but does not trigger parent cycle', () => {
      const onDismiss = vi.fn();
      render(
        <PlayerCard player={makePlayer()} interactive="cycle" onDismiss={onDismiss} />,
      );
      // Card root carries the "Tap to cycle" hint; dismiss button is a sibling.
      const root = screen.getByRole('button', { name: /Tap to cycle stat views/ });
      const before = root.getAttribute('aria-label');

      fireEvent.click(screen.getByLabelText('Release Lionel Messi'));

      expect(onDismiss).toHaveBeenCalledOnce();
      // The parent click handler should not have advanced the view.
      expect(root.getAttribute('aria-label')).toBe(before);
    });
  });
});
