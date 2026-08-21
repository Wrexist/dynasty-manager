import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  track,
  trackAppOpen,
  setAnalyticsSink,
  refreshAnalyticsConsent,
  _resetAnalyticsCacheForTests,
  _getSessionIdForTests,
  type AnalyticsPayload,
} from '@/utils/analytics';
import {
  readAnalyticsConsent,
  writeAnalyticsConsent,
  STORAGE_KEYS,
} from '@/store/helpers/persistence';

describe('analytics', () => {
  let captured: AnalyticsPayload[];

  beforeEach(() => {
    localStorage.clear();
    _resetAnalyticsCacheForTests();
    captured = [];
    setAnalyticsSink((p) => { captured.push(p); });
  });

  afterEach(() => {
    localStorage.clear();
    _resetAnalyticsCacheForTests();
  });

  describe('consent gating', () => {
    it('defaults to "unknown" when no consent is stored', () => {
      expect(readAnalyticsConsent()).toBe('unknown');
    });

    it('does not fire events when consent is "unknown"', () => {
      refreshAnalyticsConsent();
      track('game_started', { communityPackEnabled: false, gameMode: 'sandbox', division: 'eng' });
      expect(captured).toHaveLength(0);
    });

    it('does not fire events when consent is "denied"', () => {
      writeAnalyticsConsent('denied');
      refreshAnalyticsConsent();
      track('game_started', { communityPackEnabled: false, gameMode: 'sandbox', division: 'eng' });
      expect(captured).toHaveLength(0);
    });

    it('fires events only after consent is "granted"', () => {
      writeAnalyticsConsent('granted');
      refreshAnalyticsConsent();
      track('game_started', { communityPackEnabled: true, gameMode: 'career', division: 'eng' });
      expect(captured).toHaveLength(1);
      expect(captured[0].event).toBe('game_started');
    });

    it('picks up consent toggling mid-session via refreshAnalyticsConsent', () => {
      refreshAnalyticsConsent();
      track('save_created', { slot: 1, bytes: 100 });
      expect(captured).toHaveLength(0);

      writeAnalyticsConsent('granted');
      refreshAnalyticsConsent();
      track('save_created', { slot: 1, bytes: 100 });
      expect(captured).toHaveLength(1);

      writeAnalyticsConsent('denied');
      refreshAnalyticsConsent();
      track('save_created', { slot: 1, bytes: 100 });
      expect(captured).toHaveLength(1);
    });

    it('uses the expected localStorage key', () => {
      writeAnalyticsConsent('granted');
      expect(localStorage.getItem(STORAGE_KEYS.ANALYTICS_CONSENT)).toBe('granted');
    });
  });

  describe('payload shape', () => {
    beforeEach(() => {
      writeAnalyticsConsent('granted');
      refreshAnalyticsConsent();
    });

    it('stamps every event with app version, timestamp, and session id', () => {
      track('save_loaded', { slot: 2 });
      const [p] = captured;
      expect(p.appVersion).toBeTypeOf('string');
      expect(p.timestamp).toBeGreaterThan(0);
      expect(p.sessionId).toBe(_getSessionIdForTests());
    });

    it('reuses the same session id across calls in one run', () => {
      track('save_loaded', { slot: 1 });
      track('save_loaded', { slot: 2 });
      expect(captured[0].sessionId).toBe(captured[1].sessionId);
    });

    it('carries exactly the data passed by the caller — no extra fields', () => {
      track('season_completed', { season: 3, finalPosition: 4, division: 'eng' });
      expect(captured[0].data).toEqual({ season: 3, finalPosition: 4, division: 'eng' });
    });

    it('accepts every declared event name', () => {
      track('game_started', { communityPackEnabled: false, gameMode: 'sandbox', division: 'eng' });
      track('season_completed', { season: 1, finalPosition: 5, division: 'eng' });
      track('save_created', { slot: 1, bytes: 100 });
      track('save_loaded', { slot: 2 });
      track('community_pack_enabled', {});
      track('community_pack_disabled', {});
      track('crash', { category: 'error_boundary:app' });
      expect(captured.map(p => p.event)).toEqual([
        'game_started',
        'season_completed',
        'save_created',
        'save_loaded',
        'community_pack_enabled',
        'community_pack_disabled',
        'crash',
      ]);
    });
  });

  describe('privacy guarantees', () => {
    beforeEach(() => {
      writeAnalyticsConsent('granted');
      refreshAnalyticsConsent();
    });

    it('never carries a user/manager name field by construction', () => {
      track('game_started', { communityPackEnabled: true, gameMode: 'career', division: 'eng' });
      const keys = Object.keys(captured[0].data);
      const forbidden = ['name', 'managerName', 'firstName', 'lastName', 'email', 'userId'];
      for (const k of forbidden) expect(keys).not.toContain(k);
    });

    it('sink errors do not throw to the caller', () => {
      setAnalyticsSink(() => { throw new Error('sink exploded'); });
      expect(() => track('save_loaded', { slot: 1 })).not.toThrow();
    });
  });

  describe('session id generation', () => {
    it('is non-empty and looks like either a uuid or our fallback', () => {
      const id = _getSessionIdForTests();
      expect(id.length).toBeGreaterThan(5);
      // Either a uuid (crypto.randomUUID) or our s_<ts>_<rand> fallback
      expect(/^[0-9a-f-]{36}$/i.test(id) || /^s_[a-z0-9_]+$/i.test(id)).toBe(true);
    });
  });
  describe('growth funnel events', () => {
    beforeEach(() => {
      writeAnalyticsConsent('granted');
      refreshAnalyticsConsent();
    });

    it('app_open fires once per session with a coarse day bucket', () => {
      const installed = Date.now() - 3 * 86_400_000 - 12;
      trackAppOpen(installed);
      trackAppOpen(installed); // second call in the same session is a no-op
      expect(captured).toHaveLength(1);
      expect(captured[0].event).toBe('app_open');
      expect(captured[0].data.daysSinceInstall).toBe(3);
    });

    it('app_open treats an unknown first-launch stamp as day 0', () => {
      trackAppOpen(0);
      expect(captured).toHaveLength(1);
      expect(captured[0].data.daysSinceInstall).toBe(0);
    });

    it('app_open respects consent like every other event', () => {
      writeAnalyticsConsent('denied');
      refreshAnalyticsConsent();
      trackAppOpen(Date.now());
      expect(captured).toHaveLength(0);
    });

    it('purchase events carry their surface', () => {
      track('purchase_initiated', { productId: 'com.dynastymanager.pro.monthly', surface: 'onboarding' });
      track('purchase_completed', { productId: 'com.dynastymanager.pack.gold', surface: 'packs' });
      track('paywall_viewed', { surface: 'onboarding', trialEligible: true });
      track('paywall_dismissed', { surface: 'onboarding', secondsOnScreen: 42 });
      track('trial_started', { productId: 'com.dynastymanager.pro.monthly', surface: 'onboarding' });
      track('pack_opened', { tierKey: 'gold', method: 'free', pityTriggered: false });
      track('world_cup_started', { nation: 'brazil' });
      track('world_cup_match_completed', { round: 'Group Stage', result: 'W', goalsFor: 2, goalsAgainst: 1 });
      track('world_cup_finished', { placement: 'champion' });
      expect(captured.map(p => p.event)).toEqual([
        'purchase_initiated',
        'purchase_completed',
        'paywall_viewed',
        'paywall_dismissed',
        'trial_started',
        'pack_opened',
        'world_cup_started',
        'world_cup_match_completed',
        'world_cup_finished',
      ]);
    });
  });

  describe('consent survives localStorage eviction (IDB mirror)', () => {
    it('reads back from the mirror when the localStorage key is lost', () => {
      writeAnalyticsConsent('granted');
      // Simulate WKWebView evicting the key under quota pressure.
      localStorage.removeItem(STORAGE_KEYS.ANALYTICS_CONSENT);
      expect(readAnalyticsConsent()).toBe('granted');
    });

    it('still fails safe to unknown when nothing was ever answered', () => {
      _resetAnalyticsCacheForTests();
      expect(readAnalyticsConsent()).toBe('unknown');
    });
  });
});

describe('analytics sink wiring', () => {
  it('setAnalyticsSink(null) restores the default sink', () => {
    writeAnalyticsConsent('granted');
    refreshAnalyticsConsent();
    const seen: AnalyticsPayload[] = [];
    setAnalyticsSink((p) => { seen.push(p); });
    setAnalyticsSink(null);
    // After reset, default is console.info + (maybe) fetch — we just check
    // that calling track() doesn't throw, and our previous sink no longer
    // receives events.
    const spy = vi.spyOn(console, 'info').mockImplementation(() => { /* muted */ });
    track('save_loaded', { slot: 1 });
    expect(seen).toHaveLength(0);
    spy.mockRestore();
  });
});
