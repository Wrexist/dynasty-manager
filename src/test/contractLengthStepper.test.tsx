/**
 * ContractNegotiation's contract-length stepper is reachable and named.
 *
 * The −/+ buttons were 24px (`w-6 h-6`) icon-only glyphs with no accessible
 * name — under the 44px tap floor and announced to VoiceOver as "button".
 * They are now 44px hit areas around a compact chip, labelled, and the value
 * between them is a polite live region so a change is announced.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { ContractNegotiation } from '@/components/game/ContractNegotiation';
import { CONTRACT_MAX_YEARS, CONTRACT_MIN_YEARS } from '@/config/contracts';

const CLUB_ID = 'manchester-city';

function stageNegotiation(contractYears: number) {
  const s = useGameStore.getState();
  const p = s.players[s.clubs[CLUB_ID].playerIds[0]];
  useGameStore.setState({
    activeNegotiation: {
      id: 'neg-test',
      playerId: p.id,
      type: 'renewal',
      offeredWage: p.wage,
      demandedWage: p.wage,
      agentFee: 0,
      loyaltyBonus: 0,
      contractYears,
      playerAge: p.age,
      round: 1,
      status: 'in_progress',
      playerMood: 60,
    },
  });
}

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
});
afterEach(cleanup);

describe('ContractNegotiation contract-length stepper', () => {
  it('names both buttons and gives them 44px hit areas', () => {
    stageNegotiation(3);
    render(<ContractNegotiation />);
    for (const name of ['Shorter contract', 'Longer contract']) {
      const b = screen.getByRole('button', { name });
      expect(b).toHaveClass('w-11', 'h-11');
      expect(b).toHaveAttribute('type', 'button');
    }
  });

  it('steps the length and announces the new value', () => {
    stageNegotiation(3);
    render(<ContractNegotiation />);
    fireEvent.click(screen.getByRole('button', { name: 'Longer contract' }));
    const value = screen.getByText('4 yrs');
    expect(value).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('button', { name: 'Shorter contract' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shorter contract' }));
    expect(screen.getByText('2 yrs')).toBeTruthy();
  });

  it('disables each end of the range', () => {
    stageNegotiation(CONTRACT_MIN_YEARS);
    const { unmount } = render(<ContractNegotiation />);
    expect(screen.getByRole('button', { name: 'Shorter contract' })).toBeDisabled();
    unmount();
    stageNegotiation(CONTRACT_MAX_YEARS);
    render(<ContractNegotiation />);
    expect(screen.getByRole('button', { name: 'Longer contract' })).toBeDisabled();
  });

  it('gives the cancel X a 44px hit area', () => {
    stageNegotiation(3);
    render(<ContractNegotiation />);
    expect(screen.getByRole('button', { name: 'Cancel negotiation' })).toHaveClass('min-w-11', 'min-h-11');
  });
});
