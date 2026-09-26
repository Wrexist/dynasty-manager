import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: 'ios',
  native: true,
  configure: vi.fn(),
  collect: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: {
  isNativePlatform: () => mocks.native,
  getPlatform: () => mocks.platform,
} }));
vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: {
    setLogLevel: vi.fn().mockResolvedValue(undefined),
    configure: mocks.configure,
    enableAdServicesAttributionTokenCollection: mocks.collect,
  },
  LOG_LEVEL: { DEBUG: 'DEBUG', INFO: 'INFO' },
}));
vi.mock('@sentry/react', () => ({ captureException: mocks.captureException, captureMessage: vi.fn() }));
vi.mock('@/store/helpers/persistence', () => ({ reanchorClock: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.platform = 'ios';
  mocks.native = true;
  mocks.configure.mockReset().mockResolvedValue(undefined);
  mocks.collect.mockReset().mockResolvedValue(undefined);
});

describe('Apple Ads attribution initialization', () => {
  it('collects once after configuration for concurrent iOS callers', async () => {
    mocks.collect.mockImplementation(async () => {
      expect(mocks.configure).toHaveBeenCalledOnce();
    });
    const { initPurchases } = await import('@/utils/purchases');
    expect(await Promise.all([initPurchases(), initPurchases()])).toEqual([true, true]);
    expect(mocks.collect).toHaveBeenCalledOnce();
  });

  it.each(['android', 'web'])('does not request Apple attribution on %s', async platform => {
    mocks.platform = platform;
    mocks.native = platform !== 'web';
    const { initPurchases } = await import('@/utils/purchases');
    expect(await initPurchases()).toBe(mocks.native);
    expect(mocks.collect).not.toHaveBeenCalled();
  });

  it('keeps purchases ready when attribution fails', async () => {
    const error = new Error('AdServices unavailable');
    mocks.collect.mockRejectedValue(error);
    const { initPurchases } = await import('@/utils/purchases');
    expect(await initPurchases()).toBe(true);
    await vi.waitFor(() => expect(mocks.captureException).toHaveBeenCalledWith(error, {
      tags: { context: 'purchases.appleAdsAttribution' },
    }));
    expect(await initPurchases()).toBe(true);
    expect(mocks.configure).toHaveBeenCalledOnce();
  });

  it('does not wait for attribution to finish before enabling purchases', async () => {
    mocks.collect.mockReturnValue(new Promise(() => {}));
    const { initPurchases } = await import('@/utils/purchases');
    expect(await initPurchases()).toBe(true);
    expect(mocks.collect).toHaveBeenCalledOnce();
  });

  it('does not collect after configuration failure and allows retry', async () => {
    mocks.configure.mockRejectedValueOnce(new Error('offline'));
    const { initPurchases } = await import('@/utils/purchases');
    expect(await initPurchases()).toBe(false);
    expect(mocks.collect).not.toHaveBeenCalled();
    expect(await initPurchases()).toBe(true);
    expect(mocks.collect).toHaveBeenCalledOnce();
  });
});
