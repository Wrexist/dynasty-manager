import { describe, it, expect } from 'vitest';
import {
  isReviewWorthyPackTier,
  isCelebratorySeason,
  pickSeasonReviewTrigger,
  isReviewWorthyMatchWin,
  canRequestReview,
  MIN_DAYS_BETWEEN_PROMPTS,
} from '@/utils/appReview';
import { writeReviewUrlFor } from '@/config/legal';
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

describe('isReviewWorthyMatchWin', () => {
  const win = { won: true, margin: 1, isCupMatch: false };

  it('never asks on the first win, which belongs to the notification ask', () => {
    expect(isReviewWorthyMatchWin({ ...win, totalWins: 1, margin: 5, isCupMatch: true })).toBe(false);
  });

  it('asks on a standout second win: a big margin or a cup tie', () => {
    expect(isReviewWorthyMatchWin({ ...win, totalWins: 2, margin: 2 })).toBe(true);
    expect(isReviewWorthyMatchWin({ ...win, totalWins: 2, isCupMatch: true })).toBe(true);
    expect(isReviewWorthyMatchWin({ ...win, totalWins: 2 })).toBe(false);
  });

  it('asks on any win from the third on', () => {
    expect(isReviewWorthyMatchWin({ ...win, totalWins: 3 })).toBe(true);
    expect(isReviewWorthyMatchWin({ ...win, totalWins: 40 })).toBe(true);
  });

  it('never asks after a draw or a loss', () => {
    expect(isReviewWorthyMatchWin({ won: false, totalWins: 50, margin: 0, isCupMatch: true })).toBe(false);
  });
});

describe('canRequestReview', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 1_000 * DAY;

  it('allows the first request', () => {
    expect(canRequestReview({ count: 0, lastShownAt: 0 }, now)).toBe(true);
  });

  it('waits the minimum gap between requests', () => {
    const last = now - (MIN_DAYS_BETWEEN_PROMPTS - 1) * DAY;
    expect(canRequestReview({ count: 1, lastShownAt: last, shownAt: [last] }, now)).toBe(false);
    const older = now - MIN_DAYS_BETWEEN_PROMPTS * DAY;
    expect(canRequestReview({ count: 1, lastShownAt: older, shownAt: [older] }, now)).toBe(true);
  });

  it('spends at most three requests in any rolling year', () => {
    const shownAt = [now - 300 * DAY, now - 200 * DAY, now - 100 * DAY];
    expect(canRequestReview({ count: 3, lastShownAt: shownAt[2], shownAt }, now)).toBe(false);
  });

  it('has no lifetime cap: the yearly budget renews', () => {
    const shownAt = [now - 900 * DAY, now - 700 * DAY, now - 500 * DAY, now - 400 * DAY];
    expect(canRequestReview({ count: 9, lastShownAt: shownAt[3], shownAt }, now)).toBe(true);
  });

  it('reads a pre-window state through lastShownAt', () => {
    expect(canRequestReview({ count: 4, lastShownAt: now - 10 * DAY }, now)).toBe(false);
    expect(canRequestReview({ count: 4, lastShownAt: now - 40 * DAY }, now)).toBe(true);
  });
});

describe('writeReviewUrlFor', () => {
  it('opens the App Store write-review sheet on iOS', () => {
    expect(writeReviewUrlFor('ios')).toBe('https://apps.apple.com/app/id6760918006?action=write-review');
  });

  it('sends Android players to the Play listing', () => {
    expect(writeReviewUrlFor('android')).toContain('play.google.com');
  });
});
