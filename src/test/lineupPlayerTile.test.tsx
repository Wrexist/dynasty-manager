import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LineupPlayerTile } from '@/components/game/LineupPlayerTile';
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
    expect(wrapper.style.boxShadow).toContain('0 0 7px');
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

describe('LineupPlayerTile shield art integration', () => {
  it('renders the premium shield for an 85 OVR starter', () => {
    const { container } = render(
      <LineupPlayerTile
        player={makePlayer({ overall: 85 })}
        position="CM"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(container.querySelector('img[src*="premium.webp"]')).not.toBeNull();
  });

  it('renders the bronze shield for a 62 OVR player', () => {
    const { container } = render(
      <LineupPlayerTile
        player={makePlayer({ overall: 62 })}
        position="CB"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(container.querySelector('img[src*="bronze.webp"]')).not.toBeNull();
  });
});

describe('LineupPlayerTile layout invariants', () => {
  it('uses the xs PlayerCard size (52px wide shield)', () => {
    const { container } = render(
      <LineupPlayerTile
        player={makePlayer()}
        position="CM"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    // The inner PlayerCard sets width via inline style on an element
    // with class aspect-[3/4]; find it and verify the fixed xs width.
    const card = container.querySelector('.aspect-\\[3\\/4\\]') as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(card?.style.width).toBe('52px');
  });

  it('clamps chemistry-link count above 9 to "9+"', () => {
    const { getByText, queryByText } = render(
      <LineupPlayerTile
        player={makePlayer()}
        position="CM"
        isSelected={false}
        chemistryLinkCount={12}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(getByText('9+')).toBeDefined();
    expect(queryByText('12')).toBeNull();
  });

  it('renders a hot-form trend icon when form >= 70', () => {
    const { container } = render(
      <LineupPlayerTile
        player={makePlayer({ form: 85 })}
        position="CM"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(container.querySelector('[aria-label="Hot form"]')).not.toBeNull();
  });

  it('renders a poor-form trend icon when form < 35', () => {
    const { container } = render(
      <LineupPlayerTile
        player={makePlayer({ form: 20 })}
        position="CM"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(container.querySelector('[aria-label="Poor form"]')).not.toBeNull();
  });

  it('renders a nationality flag in the header', () => {
    const { container } = render(
      <LineupPlayerTile
        player={makePlayer({ nationality: 'England' })}
        position="CM"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(container.querySelector('[title="England"]')).not.toBeNull();
  });

  it('omits the chemistry link cluster when chemistryLinkCount is 0', () => {
    const { container } = render(
      <LineupPlayerTile
        player={makePlayer()}
        position="CM"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    // Lucide Link icon gets a `lucide-link` class; should not render when count is 0
    expect(container.querySelector('.lucide-link')).toBeNull();
  });

  it('labels the INJ status pill with a descriptive aria-label for screen readers', () => {
    const { getByLabelText } = render(
      <LineupPlayerTile
        player={makePlayer({ injured: true, injuryWeeks: 3 })}
        position="CM"
        isSelected={false}
        chemistryLinkCount={0}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(getByLabelText('Injured')).toBeDefined();
  });

  it('labels the SUS status pill with a descriptive aria-label when suspended', () => {
    const { getByLabelText } = render(
      <LineupPlayerTile
        player={makePlayer({ suspendedUntilWeek: 10 })}
        position="CM"
        isSelected={false}
        chemistryLinkCount={0}
        week={5}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(getByLabelText('Suspended')).toBeDefined();
  });

  it('labels the chemistry link cluster with its count for screen readers', () => {
    const { getByLabelText } = render(
      <LineupPlayerTile
        player={makePlayer()}
        position="CM"
        isSelected={false}
        chemistryLinkCount={3}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(getByLabelText('3 chemistry links')).toBeDefined();
  });

  it('pluralises correctly for a single chemistry link', () => {
    const { getByLabelText } = render(
      <LineupPlayerTile
        player={makePlayer()}
        position="CM"
        isSelected={false}
        chemistryLinkCount={1}
        onClick={() => { /* noop */ }}
      />,
    );
    expect(getByLabelText('1 chemistry link')).toBeDefined();
  });
});
