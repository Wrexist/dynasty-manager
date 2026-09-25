/**
 * Regression: the odds sheet must disclose the roll the generator performs.
 *
 * A one-card pack (Legends) never rolls the rarity table — its only random
 * card is the guaranteed slot, drawn across the band. The sheet used to pick
 * its layout from `cards + bonusCards === 1`, so any bonus on a one-card pack
 * flipped it back to a per-card rarity table for a roll that never happens
 * (Guideline 3.1.1 disclosure). It keys on the generation model now.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PackOddsSheet } from '@/components/game/pack/PackOddsSheet';
import { PACK_TIER_MAP } from '@/config/packs';

afterEach(cleanup);

describe('PackOddsSheet disclosure model', () => {
  it.each([0, 1, 3])('Legends with %i bonus card(s) shows the band, never a rarity table', (bonusCards) => {
    render(<PackOddsSheet tier={PACK_TIER_MAP.icon} bonusCards={bonusCards} onClose={vi.fn()} />);
    expect(screen.queryByText('Chance per card')).toBeNull();
    expect(screen.getAllByText(/drawn from every real player in that range/).length).toBeGreaterThan(0);
  });

  it('a multi-card pack still publishes its per-card rarity table', () => {
    render(<PackOddsSheet tier={PACK_TIER_MAP.rare} bonusCards={1} onClose={vi.fn()} />);
    expect(screen.getByText('Chance per card')).toBeInTheDocument();
  });
});
