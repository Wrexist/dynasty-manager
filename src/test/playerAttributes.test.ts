import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setSubscriberAttributes } = vi.hoisted(() => ({
  setSubscriberAttributes: vi.fn(async (_attrs: Record<string, string | null>) => true),
}));
vi.mock('@/utils/purchases', () => ({ setSubscriberAttributes }));

import {
  foldEvent,
  toAttributes,
  clearedAttributes,
  recordPlayerStat,
  clearPlayerStatAttributes,
  __resetPlayerStatsForTests,
  type PlayerStatsRecord,
} from '@/utils/playerAttributes';
import {
  track,
  setAnalyticsSink,
  refreshAnalyticsConsent,
  _resetAnalyticsCacheForTests,
  type AnalyticsPayload,
} from '@/utils/analytics';
import { STORAGE_KEYS, writeAnalyticsConsent } from '@/store/helpers/persistence';

function ev(event: AnalyticsPayload['event'], data: AnalyticsPayload['data']): AnalyticsPayload {
  return { event, data, timestamp: 0, appVersion: '1.7.0', sessionId: 's' };
}

function fold(events: AnalyticsPayload[]): PlayerStatsRecord {
  return events.reduce<PlayerStatsRecord>((r, e) => foldEvent(r, e), {});
}

describe('playerAttributes', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetAnalyticsCacheForTests();
    __resetPlayerStatsForTests();
    setSubscriberAttributes.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetPlayerStatsForTests();
    _resetAnalyticsCacheForTests();
    localStorage.clear();
  });

  describe('foldEvent', () => {
    it('counts sessions, distinct active days and the D1/D7 return flags', () => {
      const r = fold([
        ev('app_open', { daysSinceInstall: 0 }),
        ev('app_open', { daysSinceInstall: 0 }),
        ev('app_open', { daysSinceInstall: 1 }),
        ev('app_open', { daysSinceInstall: 8 }),
      ]);
      expect(r).toMatchObject({ sessions: 4, activeDays: 3, lastOpenDay: 8, returnedD1: true, returnedD7: true });
    });

    it('does not set the return flags for a day-0-only player', () => {
      const r = fold([ev('app_open', { daysSinceInstall: 0 })]);
      expect(r.returnedD1).toBeUndefined();
      expect(r.returnedD7).toBeUndefined();
    });

    it('tracks career progress, best finish and the commerce funnel', () => {
      const r = fold([
        ev('game_started', { gameMode: 'career', division: 'eng1', communityPackEnabled: true }),
        ev('game_progress', { season: 1, week: 12, matchesPlayed: 11 }),
        ev('game_progress', { season: 1, week: 5, matchesPlayed: 4 }), // an older save loaded
        ev('season_completed', { season: 1, finalPosition: 7, division: 'eng1' }),
        ev('season_completed', { season: 2, finalPosition: 3, division: 'eng1' }),
        ev('paywall_viewed', { surface: 'shop', trialEligible: true }),
        ev('purchase_initiated', { productId: 'com.dynastymanager.pack.gold', surface: 'packs' }),
        ev('purchase_cancelled', { productId: 'com.dynastymanager.pack.gold', surface: 'packs' }),
        ev('pack_opened', { tierKey: 'gold', method: 'iap', pityTriggered: false }),
        ev('pack_opened', { tierKey: 'daily', method: 'free', pityTriggered: false }),
      ]);
      expect(r).toMatchObject({
        gamesStarted: 1, gameMode: 'career', division: 'eng1',
        currentSeason: 1, currentWeek: 5, matchesPlayed: 11,
        seasonsCompleted: 2, bestFinish: 3,
        paywallViews: 1, paywallSurface: 'shop',
        purchaseAttempts: 1, purchasesCancelled: 1, lastProduct: 'com.dynastymanager.pack.gold',
        packsPaid: 1, packsFree: 1,
      });
    });

    it('ignores events it does not aggregate', () => {
      const prev: PlayerStatsRecord = { sessions: 2 };
      expect(foldEvent(prev, ev('save_loaded', { slot: 1 }))).toBe(prev);
    });

    it('never forwards identifying fields such as a nation pick', () => {
      const r = fold([ev('world_cup_started', { nation: 'brazil' })]);
      expect(Object.values(toAttributes(r))).not.toContain('brazil');
    });
  });

  describe('attributes', () => {
    it('stringifies set fields and omits unset ones', () => {
      expect(toAttributes({ sessions: 3, returnedD1: true })).toEqual({ sessions: '3', returned_d1: 'true' });
    });

    it('clears every key it can write, within RevenueCat\'s 50-key cap', () => {
      const all = toAttributes(fold([
        ev('app_open', { daysSinceInstall: 9 }),
        ev('game_started', { gameMode: 'sandbox', division: 'eng1', communityPackEnabled: false }),
      ]));
      const cleared = clearedAttributes();
      for (const key of Object.keys(all)) expect(cleared).toHaveProperty(key, null);
      expect(Object.keys(cleared).length).toBeLessThanOrEqual(50);
    });
  });

  describe('runtime', () => {
    it('persists and pushes one debounced write for a burst of events', async () => {
      recordPlayerStat(ev('app_open', { daysSinceInstall: 0 }));
      recordPlayerStat(ev('market_viewed', { featuredTier: 'gold', weeklyBonusAvailable: true, streak: 1 }));
      expect(setSubscriberAttributes).not.toHaveBeenCalled();
      await vi.runAllTimersAsync();
      expect(setSubscriberAttributes).toHaveBeenCalledTimes(1);
      expect(setSubscriberAttributes).toHaveBeenCalledWith(expect.objectContaining({ sessions: '1', market_views: '1' }));
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYER_STATS)!)).toMatchObject({ sessions: 1, marketViews: 1 });
    });

    it('opt-out cancels the pending push and deletes the keys', async () => {
      recordPlayerStat(ev('app_open', { daysSinceInstall: 0 }));
      clearPlayerStatAttributes();
      await vi.runAllTimersAsync();
      expect(setSubscriberAttributes).toHaveBeenCalledTimes(1);
      expect(setSubscriberAttributes).toHaveBeenCalledWith(clearedAttributes());
    });

    it('is the default analytics sink, and the opt-out stops it', async () => {
      setAnalyticsSink(null);
      refreshAnalyticsConsent();
      track('market_viewed', { featuredTier: 'gold', weeklyBonusAvailable: false, streak: 0 });
      await vi.runAllTimersAsync();
      expect(setSubscriberAttributes).toHaveBeenCalledTimes(1);

      writeAnalyticsConsent('denied');
      refreshAnalyticsConsent();
      track('market_viewed', { featuredTier: 'gold', weeklyBonusAvailable: false, streak: 0 });
      await vi.runAllTimersAsync();
      expect(setSubscriberAttributes).toHaveBeenCalledTimes(1);
    });
  });
});
