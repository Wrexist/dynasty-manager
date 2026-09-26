/**
 * Pack guide copy (playthrough 2026-09, R11 — App Store Guideline 3.1.1).
 *
 * Two copy defects on the odds sheet, neither touching an odd or a card:
 *   1. A rarity name changed meaning between packs: the published row read
 *      "Silver (70–74)" on the Daily and "Silver (78–79)" on World Class,
 *      because only the pack-clamped band was printed.
 *   2. With a limited bonus, the box said "4 cards are guaranteed 84+" under a
 *      blurb that says "one card guaranteed 84 or better" — true of different
 *      things (this offer vs the standard pack) with nothing saying so.
 *
 * Everything asserted here is derived from `config/packs.ts`, the same config
 * the generator rolls. The odds themselves are pinned by `packs.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PackOddsSheet } from '@/components/game/pack/PackOddsSheet';
import {
  PACK_TIER_MAP, PACK_STOREFRONT_ORDER, PACK_RARITY_BANDS, WEEKLY_PACK_SKINS, describePackOdds, packRarityLegend,
} from '@/config/packs';

afterEach(cleanup);

const NUMBER_WORD: Record<number, string> = { 1: 'One', 3: 'Three', 5: 'Five' };

describe('odds rows: a rarity name means one band in every pack', () => {
  it('every row carries its rarity and that rarity\'s own band', () => {
    for (const key of PACK_STOREFRONT_ORDER) {
      for (const row of describePackOdds(PACK_TIER_MAP[key])) {
        expect(row.rarity, `${key}: ${row.label}`).toBeDefined();
        const [lo, hi] = PACK_RARITY_BANDS[row.rarity!];
        expect([row.rarityMinOvr, row.rarityMaxOvr]).toEqual([lo, hi]);
        // The label leads with the rung's own band, whatever this pack clamps.
        expect(row.label.startsWith(`${row.rarityName} (${lo}-${hi}`), row.label).toBe(true);
        // And the dealable part sits inside it.
        expect(row.minOvr).toBeGreaterThanOrEqual(lo);
        expect(row.maxOvr).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('the same name never publishes two different bands across the storefront', () => {
    const bands = new Map<string, string>();
    for (const key of PACK_STOREFRONT_ORDER) {
      for (const row of describePackOdds(PACK_TIER_MAP[key])) {
        const band = `${row.rarityMinOvr}-${row.rarityMaxOvr}`;
        expect(bands.get(row.rarityName!) ?? band, `${row.rarityName} in ${key}`).toBe(band);
        bands.set(row.rarityName!, band);
      }
    }
  });

  it('the sheet prints Silver as 70–79 in both the Daily and World Class, and says what each pack deals', () => {
    const [silverLo, silverHi] = PACK_RARITY_BANDS.silver;
    const own = `Silver (${silverLo}–${silverHi} OVR)`;
    for (const key of ['daily', 'rare'] as const) {
      render(<PackOddsSheet tier={PACK_TIER_MAP[key]} onClose={vi.fn()} />);
      const row = describePackOdds(PACK_TIER_MAP[key]).find(r => r.rarity === 'silver')!;
      expect(screen.getByText(own)).toBeInTheDocument();
      expect(screen.getByText(`This pack deals ${row.minOvr}–${row.maxOvr} OVR`)).toBeInTheDocument();
      cleanup();
    }
  });

  it('the rarity key under the table lists every rung from the generator\'s bands', () => {
    render(<PackOddsSheet tier={PACK_TIER_MAP.rare} onClose={vi.fn()} />);
    const key = screen.getByTestId('pack-guide-rarity-key').textContent!;
    for (const r of packRarityLegend()) expect(key).toContain(`${r.name} ${r.minOvr}–${r.maxOvr}`);
  });
});

describe('guarantee box: the standard pack, then the limited bonus', () => {
  it('with a +3 bonus, the standard line matches the blurb and the bonus is its own line', () => {
    const tier = PACK_TIER_MAP.rare;
    render(<PackOddsSheet tier={tier} bonusCards={3} onClose={vi.fn()} />);
    const standard = screen.getByTestId('pack-guide-standard').textContent!;
    expect(standard).toContain(`Standard pack: ${tier.cards} players.`);
    expect(standard).toContain(`1 card is guaranteed ${tier.guaranteedMinOvr}+ OVR.`);
    const bonus = screen.getByTestId('pack-guide-bonus').textContent!;
    expect(bonus).toContain(`+3 extra cards, each guaranteed ${tier.guaranteedMinOvr}+ OVR`);
    expect(bonus).toContain(`${tier.cards + 3} players and 4 guaranteed ${tier.guaranteedMinOvr}+ in this open`);
    // The merged claim that contradicted the blurb is gone.
    expect(screen.queryByText(/4 cards are guaranteed/)).toBeNull();
    // The blurb and the standard line say the same guarantee.
    expect(tier.storeBlurb).toContain(`one card guaranteed ${tier.guaranteedMinOvr} or better`);
    // The legend chance is a chance, and never applies to bonus cards.
    expect(screen.getByText(/Chance the standard pack.s guaranteed card is a/)).toBeInTheDocument();
    expect(screen.getByText(/Bonus cards are never icons/)).toBeInTheDocument();
  });

  it('without a bonus there is no bonus line and no "standard pack" qualifier', () => {
    render(<PackOddsSheet tier={PACK_TIER_MAP.rare} onClose={vi.fn()} />);
    expect(screen.queryByTestId('pack-guide-bonus')).toBeNull();
    expect(screen.getByTestId('pack-guide-standard').textContent).not.toContain('Standard pack');
  });
});

describe('storefront copy states the config it describes', () => {
  const described = PACK_STOREFRONT_ORDER.map(k => PACK_TIER_MAP[k]);

  it('every caption names the card count and (fixed-floor packs) the guaranteed floor', () => {
    for (const tier of described) {
      const caption = tier.storeCaption ?? '';
      expect(caption, tier.key).toMatch(new RegExp(`^${tier.cards} (players|card)\\b`));
      if (!tier.streakOverrides) expect(caption, tier.key).toContain(`${tier.guaranteedMinOvr}+`);
    }
  });

  it('every blurb describes the standard pack: its count, floor and version boost, and no bonus', () => {
    for (const tier of described.filter(t => t.storeBlurb)) {
      const blurb = tier.storeBlurb!;
      if (tier.streakOverrides) continue; // the Daily's floor is the streak ladder, stated in the sheet
      expect(blurb, tier.key).toContain(NUMBER_WORD[tier.cards]);
      expect(blurb, tier.key).toContain(`${tier.guaranteedMinOvr} or better`);
      if (tier.versionBoost) expect(blurb, tier.key).toContain(`+${tier.versionBoost} to every stat`);
      expect(blurb.toLowerCase(), tier.key).not.toContain('bonus');
    }
  });

  it('a promo skin\'s blurb states the boost the promo week actually deals', () => {
    for (const skin of WEEKLY_PACK_SKINS) {
      const tier = PACK_TIER_MAP[skin.tier];
      const boost = (tier.versionBoost ?? 0) + (skin.extraBoost ?? 0);
      expect(skin.blurb, skin.name).toContain(`+${boost} to every stat`);
    }
  });
});
