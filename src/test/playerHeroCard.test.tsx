import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerHeroCard } from '@/components/game/PlayerHeroCard';
import { getStableJerseyNumber, getPlayerTier } from '@/utils/uiHelpers';
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

describe('getPlayerTier', () => {
  it('returns Legendary at 90+', () => {
    expect(getPlayerTier(93).key).toBe('legendary');
    expect(getPlayerTier(93).label).toBe('Legendary');
  });

  it('returns Gold at 80-89', () => {
    expect(getPlayerTier(86).key).toBe('gold');
    expect(getPlayerTier(86).label).toBe('Gold');
  });

  it('returns Silver at 70-79', () => {
    expect(getPlayerTier(75).key).toBe('silver');
    expect(getPlayerTier(75).label).toBe('Silver');
  });

  it('returns Bronze at 60-69', () => {
    expect(getPlayerTier(65).key).toBe('bronze');
    expect(getPlayerTier(65).label).toBe('Bronze');
  });

  it('returns Common below 60', () => {
    expect(getPlayerTier(45).key).toBe('common');
    expect(getPlayerTier(45).label).toBe('Common');
  });
});

describe('PlayerHeroCard tier border + badge', () => {
  it('renders the tier label badge for a Gold player', () => {
    render(<PlayerHeroCard player={makePlayer({ overall: 86, potential: 90 })} club={makeClub()} />);
    expect(screen.getByLabelText('tier Gold')).toBeInTheDocument();
  });

  it('renders Bronze label and data-tier attribute for a 65 OVR player', () => {
    const { container } = render(
      <PlayerHeroCard player={makePlayer({ overall: 65, potential: 70 })} club={makeClub()} />,
    );
    expect(screen.getByLabelText('tier Bronze')).toBeInTheDocument();
    expect(container.querySelector('[data-tier="bronze"]')).not.toBeNull();
  });

  it('renders Legendary label for a 92 OVR player', () => {
    render(<PlayerHeroCard player={makePlayer({ overall: 92, potential: 92 })} club={makeClub()} />);
    expect(screen.getByLabelText('tier Legendary')).toBeInTheDocument();
  });
});
