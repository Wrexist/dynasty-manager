import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  track,
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
