import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerStatusBadges } from '@/components/game/PlayerStatusBadges';
import { StatusPill } from '@/components/game/StatusPill';
import { getContractUrgency } from '@/utils/contracts';
import type { Player } from '@/types/game';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p-1',
    firstName: 'Test',
    lastName: 'Player',
    age: 24,
    nationality: 'England',
    position: 'CM',
    attributes: { pace: 70, shooting: 60, passing: 70, defending: 60, physical: 65, mental: 70 },
    overall: 75,
    potential: 80,
    clubId: 'c1',
    wage: 10000,
    value: 5_000_000,
    contractEnd: 2028,
    fitness: 85,
    morale: 70,
    form: 60,
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

describe('PlayerStatusBadges', () => {
  it('renders nothing for a healthy, untagged player on a fresh contract', () => {
    const { container } = render(
      <PlayerStatusBadges player={makePlayer({ contractEnd: 10 })} season={1} week={1} />,
    );
    // Wrapper div renders, but it has zero pill children.
    expect(container.querySelectorAll('span[title]').length).toBe(0);
  });

  it('renders the injury pill with weeks remaining', () => {
    render(
      <PlayerStatusBadges
        player={makePlayer({ injured: true, injuryWeeks: 4 })}
        season={1}
        week={5}
      />,
    );
    expect(screen.getByTitle(/Injured — 4 wk/)).toBeTruthy();
  });

  it('renders the suspension pill only while suspendedUntilWeek is in the future', () => {
    const { rerender } = render(
      <PlayerStatusBadges
        player={makePlayer({ suspendedUntilWeek: 10 })}
        season={1}
        week={8}
      />,
    );
    expect(screen.getByTitle(/Suspended until week 10/)).toBeTruthy();

    rerender(
      <PlayerStatusBadges
        player={makePlayer({ suspendedUntilWeek: 10 })}
        season={1}
        week={10}
      />,
    );
    expect(screen.queryByTitle(/Suspended/)).toBeNull();
  });

  it('suppresses OUT / LOAN / LIST when the player is injured', () => {
    render(
      <PlayerStatusBadges
        player={makePlayer({ injured: true, injuryWeeks: 2, wantsToLeave: true, onLoan: true, listedForSale: true })}
        season={1}
        week={1}
      />,
    );
    expect(screen.getByTitle(/Injured/)).toBeTruthy();
    expect(screen.queryByTitle(/Wants to leave/)).toBeNull();
    expect(screen.queryByTitle(/On loan/)).toBeNull();
    expect(screen.queryByTitle(/Listed for sale/)).toBeNull();
  });

  it('shows the contract-near pill for a contract expiring next season', () => {
    render(
      <PlayerStatusBadges player={makePlayer({ contractEnd: 2 })} season={1} week={1} />,
    );
    expect(screen.getByTitle(/Contract expires/)).toBeTruthy();
  });

  it('omits contract urgency when hideContract is set', () => {
    render(
      <PlayerStatusBadges
        player={makePlayer({ contractEnd: 1 })}
        season={1}
        week={1}
        hideContract
      />,
    );
    expect(screen.queryByTitle(/Contract expires/)).toBeNull();
  });

  it('renders the contextBadge slot above the player-state pills', () => {
    render(
      <PlayerStatusBadges
        player={makePlayer({ injured: true, injuryWeeks: 1 })}
        season={1}
        week={1}
        contextBadge={<StatusPill tone="emerald" label="XI" title="Starting XI" />}
      />,
    );
    // Both pills are present — XI from the slot, INJ from intrinsic state.
    expect(screen.getByTitle('Starting XI')).toBeTruthy();
    expect(screen.getByTitle(/Injured/)).toBeTruthy();
  });
});

describe('getContractUrgency', () => {
  it('returns "expired" when contractEnd is at or before current season', () => {
    expect(getContractUrgency(1, 1)).toBe('expired');
    expect(getContractUrgency(1, 2)).toBe('expired');
  });

  it('returns "near" for a contract within the warning window', () => {
    expect(getContractUrgency(2, 1)).toBe('near');
  });

  it('returns null for a long-dated contract', () => {
    expect(getContractUrgency(10, 1)).toBeNull();
  });
});
