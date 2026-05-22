/**
 * Launch-crash guardrails — AdMob must stay *initialised*, not just linked.
 *
 * The Google Mobile Ads SDK crashed TestFlight builds 134 and 136 on launch:
 * its `GADApplicationVerifyPublisherInitializedCorrectly` check throws an
 * NSException from a libdispatch background block whenever the framework is
 * linked into the binary but `AdMob.initialize()` is never called. The
 * original mistake was shipping the SDK linked-but-dormant.
 *
 * AdMob is now deliberately re-enabled (rewarded video for packs + boosts).
 * The crash class is prevented not by *removing* the SDK but by guaranteeing
 * it is *initialised at startup*. These tests are the brick wall: if a
 * refactor ever links the SDK without wiring `AdMob.initialize()` into the
 * launch path, CI fails before it can ship.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

describe('launch-crash guardrails — AdMob must be initialised, not just linked', () => {
  describe('package manifest', () => {
    it('package.json declares the @capacitor-community/admob dependency', () => {
      const pkg = JSON.parse(read('package.json'));
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      expect(allDeps['@capacitor-community/admob']).toBeDefined();
    });
  });

  describe('startup initialisation wiring', () => {
    it('ads.ts initialises the SDK by calling AdMob.initialize', () => {
      const ads = read('src/utils/ads.ts');
      // The single most important assertion: the linked SDK is started.
      expect(ads).toMatch(/AdMob\.initialize\s*\(/);
      expect(ads).toMatch(/from ['"]@capacitor-community\/admob['"]|import\(['"]@capacitor-community\/admob['"]\)/);
    });

    it('main.tsx calls initAds() during native startup', () => {
      const main = read('src/main.tsx');
      expect(main).toMatch(/initAds\s*\(/);
    });

    it('NATIVE_ADS_READY is true (callsites must offer the ad path)', async () => {
      const { NATIVE_ADS_READY } = await import('@/utils/ads');
      expect(NATIVE_ADS_READY).toBe(true);
    });
  });

  describe('iOS native config', () => {
    const PLIST_PATH = 'ios/App/App/Info.plist';

    it('Info.plist declares GADApplicationIdentifier (SDK is configured)', () => {
      // A missing app identifier is itself a launch-crash trigger on GMA v12+.
      expect(read(PLIST_PATH)).toMatch(/GADApplicationIdentifier/);
    });

    it('Info.plist declares NSUserTrackingUsageDescription (ATT purpose string)', () => {
      // The GMA SDK references the App Tracking Transparency API; App Store
      // review (ITMS-90683) rejects the binary without a purpose string.
      expect(read(PLIST_PATH)).toMatch(/NSUserTrackingUsageDescription/);
    });

    it('Package.swift links the AdMob plugin', () => {
      const pkgSwift = read('ios/App/CapApp-SPM/Package.swift');
      expect(pkgSwift).toMatch(/CapacitorCommunityAdmob/);
    });
  });

  describe('ads.ts runtime behaviour', () => {
    it('initAds() resolves without throwing', async () => {
      const { initAds } = await import('@/utils/ads');
      await expect(initAds()).resolves.toBeUndefined();
    });

    it('showRewardedAd() resolves to a boolean', async () => {
      const { showRewardedAd } = await import('@/utils/ads');
      const result = await showRewardedAd();
      expect(typeof result).toBe('boolean');
    });
  });
});
