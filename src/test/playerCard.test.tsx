import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PlayerCard } from '@/components/game/PlayerCard';
import { TierBorderFrame } from '@/components/game/TierBorderFrame';
import { getPlayerTier, getTierGlowStyle } from '@/utils/uiHelpers';
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

describe('getPlayerTier null-safety', () => {
  it('returns Common tier when overall is null', () => {
    expect(getPlayerTier(null).key).toBe('common');
  });

  it('returns Common tier when overall is undefined', () => {
    expect(getPlayerTier(undefined).key).toBe('common');
  });

  it('returns Common tier when overall is NaN', () => {
    expect(getPlayerTier(Number.NaN).key).toBe('common');
  });

  it('returns Common tier when overall is negative', () => {
    expect(getPlayerTier(-5).key).toBe('common');
  });
});

describe('getTierGlowStyle', () => {
  it('returns a boxShadow for Legendary tier', () => {
    expect(getTierGlowStyle(getPlayerTier(95))).toBeDefined();
    expect(getTierGlowStyle(getPlayerTier(95))?.boxShadow).toMatch(/^0 0/);
  });

  it('returns a boxShadow for Gold tier', () => {
    expect(getTierGlowStyle(getPlayerTier(85))).toBeDefined();
  });

  it('returns undefined for Silver, Bronze, Common', () => {
    expect(getTierGlowStyle(getPlayerTier(75))).toBeUndefined();
    expect(getTierGlowStyle(getPlayerTier(65))).toBeUndefined();
    expect(getTierGlowStyle(getPlayerTier(45))).toBeUndefined();
  });
});

describe('TierBorderFrame', () => {
  it('sets data-tier based on the overall rating', () => {
    const { container } = render(
      <TierBorderFrame overall={86}>
        <span>content</span>
      </TierBorderFrame>,
    );
    expect(container.querySelector('[data-tier="gold"]')).not.toBeNull();
  });

  it('applies a gradient background via inline style', () => {
    const { container } = render(
      <TierBorderFrame overall={72}>
        <span>content</span>
      </TierBorderFrame>,
    );
    const wrapper = container.querySelector('[data-tier="silver"]') as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.style.background).toMatch(/linear-gradient/);
  });

  it('omits the glow boxShadow when glow=false', () => {
    const { container } = render(
      <TierBorderFrame overall={92} glow={false}>
        <span>content</span>
      </TierBorderFrame>,
    );
    const wrapper = container.querySelector('[data-tier="legendary"]') as HTMLElement;
    expect(wrapper.style.boxShadow).toBe('');
  });

  it('applies the glow boxShadow on Legendary when glow=true', () => {
    const { container } = render(
      <TierBorderFrame overall={92} glow>
        <span>content</span>
      </TierBorderFrame>,
    );
    const wrapper = container.querySelector('[data-tier="legendary"]') as HTMLElement;
    expect(wrapper.style.boxShadow).toContain('0 0 10px');
  });

  it('falls back to Common when overall is missing', () => {
    const { container } = render(
      <TierBorderFrame>
        <span>content</span>
      </TierBorderFrame>,
    );
    expect(container.querySelector('[data-tier="common"]')).not.toBeNull();
  });
});

describe('PlayerCard tier border integration', () => {
  it('renders a Gold border for an 85 OVR starter', () => {
    const { container } = render(
      <PlayerCard
        player={makePlayer({ overall: 85 })}
        position="CM"
        variant="starter"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(container.querySelector('[data-tier="gold"]')).not.toBeNull();
  });

  it('renders a Bronze border for a 62 OVR bench player', () => {
    const { container } = render(
      <PlayerCard
        player={makePlayer({ overall: 62 })}
        position="CB"
        variant="bench"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(container.querySelector('[data-tier="bronze"]')).not.toBeNull();
  });

  it('does not apply the red warning border regardless of fitness/chem state', () => {
    const { container } = render(
      <PlayerCard
        player={makePlayer({ overall: 75, fitness: 20 })}
        position="CM"
        variant="starter"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(container.querySelector('.border-red-500\\/40')).toBeNull();
  });
});
