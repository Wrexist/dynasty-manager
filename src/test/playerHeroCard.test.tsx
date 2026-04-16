import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerHeroCard } from '@/components/game/PlayerHeroCard';
import { getStableJerseyNumber, getTierGlowClass } from '@/utils/uiHelpers';
import type { Player, Club } from '@/types/game';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p-test-1',
    firstName: 'Derry',
    lastName: 'Murkin',
    age: 25,
    nationality: 'England',
    position: 'LB',
    attributes: { pace: 70, shooting: 50, passing: 65, defending: 72, physical: 68, mental: 60 },
    overall: 69,
    potential: 74,
    clubId: 'c1',
    wage: 10000,
    value: 5_000_000,
    contractEnd: 2028,
    fitness: 87,
    morale: 59,
    form: 84,
    injured: false,
    injuryWeeks: 0,
    goals: 0,
    assists: 0,
    appearances: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerAppearances: 0,
    yellowCards: 0,
    redCards: 0,
    ...overrides,
  } as Player;
}

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'c1',
    name: 'FC Schalke 04',
    shortName: 'S04',
    color: '#004d9d',
    secondaryColor: '#ffffff',
    ...overrides,
  } as Club;
}

describe('PlayerHeroCard', () => {
  it('renders player name, rating, and club', () => {
    render(<PlayerHeroCard player={makePlayer()} club={makeClub()} />);
    expect(screen.getByText('Derry Murkin')).toBeInTheDocument();
    expect(screen.getByText('69')).toBeInTheDocument();
    expect(screen.getByText('FC Schalke 04')).toBeInTheDocument();
  });

  it('shows potential when higher than overall', () => {
    render(<PlayerHeroCard player={makePlayer({ overall: 69, potential: 74 })} club={makeClub()} />);
    expect(screen.getByText(/Pot 74/)).toBeInTheDocument();
  });

  it('hides potential when equal to overall', () => {
    render(<PlayerHeroCard player={makePlayer({ overall: 80, potential: 80 })} club={makeClub()} />);
    expect(screen.queryByText(/Pot/)).not.toBeInTheDocument();
  });

  it('renders growth arrow with aria-label when growthDelta > 0', () => {
    render(<PlayerHeroCard player={makePlayer({ growthDelta: 2 })} club={makeClub()} />);
    expect(screen.getByLabelText(/growing \+2/)).toBeInTheDocument();
  });

  it('falls back to "Unknown" when club is missing', () => {
    render(<PlayerHeroCard player={makePlayer()} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('exposes a summary aria-label on the panel', () => {
    render(<PlayerHeroCard player={makePlayer()} club={makeClub()} />);
    expect(screen.getByLabelText(/Derry Murkin.*LB.*overall 69.*FC Schalke 04/)).toBeInTheDocument();
  });
});

describe('getStableJerseyNumber', () => {
  it('returns the same number for the same id', () => {
    expect(getStableJerseyNumber('abc')).toBe(getStableJerseyNumber('abc'));
  });

  it('stays within 1..99', () => {
    for (const id of ['a', 'zzz', 'player-42', 'p-test-1', '']) {
      const n = getStableJerseyNumber(id);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(99);
    }
  });
});

describe('getTierGlowClass', () => {
  it('returns gold glow at 80+', () => {
    expect(getTierGlowClass(85)).toMatch(/amber-400/);
  });

  it('returns silver glow at 70-79', () => {
    expect(getTierGlowClass(75)).toMatch(/slate-300/);
  });

  it('returns bronze glow at 60-69', () => {
    expect(getTierGlowClass(65)).toMatch(/amber-700/);
  });

  it('returns empty string below 60', () => {
    expect(getTierGlowClass(45)).toBe('');
  });
});
