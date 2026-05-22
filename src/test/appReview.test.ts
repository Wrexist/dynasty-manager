import { describe, it, expect } from 'vitest';
import {
  isReviewWorthyPackTier,
  isCelebratorySeason,
  pickSeasonReviewTrigger,
} from '@/utils/appReview';
import { PACK_TIERS } from '@/config/packs';

describe('isReviewWorthyPackTier', () => {
  it('treats Gold and above as review-worthy', () => {
    for (const tier of ['gold', 'premium', 'rare', 'icon'] as const) {
      expect(isReviewWorthyPackTier(tier)).toBe(true);
    }
  });

  it('never prompts on the free daily Bronze/Silver tiers', () => {
    expect(isReviewWorthyPackTier('bronze')).toBe(false);
    expect(isReviewWorthyPackTier('silver')).toBe(false);
  });

  it('covers every tier defined in pack config', () => {
    for (const tier of PACK_TIERS) {
      expect(typeof isReviewWorthyPackTier(tier.key)).toBe('boolean');
    }
  });
});

describe('isCelebratorySeason', () => {
  it('celebrates a league title', () => {
    expect(isCelebratorySeason({ position: 1 })).toBe(true);
  });

  it('celebrates a promotion', () => {
    expect(isCelebratorySeason({ position: 6, promoted: true })).toBe(true);
  });

  it('celebrates lifting any cup', () => {
    expect(isCelebratorySeason({ position: 9, cupResult: 'Winner' })).toBe(true);
    expect(isCelebratorySeason({ position: 9, championsCupResult: 'Winner' })).toBe(true);
  });

  it('does not celebrate a mid-table season with no silverware', () => {
    expect(isCelebratorySeason({ position: 9, cupResult: 'Semi-final' })).toBe(false);
  });
});

describe('pickSeasonReviewTrigger', () => {
  it('prefers the title trigger over promotion', () => {
    expect(pickSeasonReviewTrigger({ position: 1, promoted: true })).toBe('season-end-title');
  });

  it('uses the promotion trigger when not champions', () => {
    expect(pickSeasonReviewTrigger({ position: 4, promoted: true })).toBe('season-end-promotion');
  });

  it('falls back to the trophy trigger', () => {
    expect(pickSeasonReviewTrigger({ position: 8, cupResult: 'Winner' })).toBe('season-end-trophy');
  });
});
