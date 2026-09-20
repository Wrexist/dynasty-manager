import { beforeEach, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/store/helpers/persistence';

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

it('caps a session and enforces six hours between displays', async () => {
  const { claimPackUpsell } = await import('@/utils/packUpsell');
  expect(claimPackUpsell(86400_000)).toBe(true);
  expect(claimPackUpsell(86400_000 + 7 * 3600_000)).toBe(false);
  vi.resetModules();
  const next = await import('@/utils/packUpsell');
  expect(next.claimPackUpsell(86400_000 + 5 * 3600_000)).toBe(false);
  expect(next.claimPackUpsell(86400_000 + 6 * 3600_000)).toBe(true);
});

it('caps daily displays across reloads, fails closed on corrupt storage, and respects rollback', async () => {
  const { claimPackUpsell } = await import('@/utils/packUpsell');
  localStorage.setItem(STORAGE_KEYS.PACK_DEAL_UPSELL, JSON.stringify({ day: 1, count: 2, last: 86400_000 }));
  expect(claimPackUpsell(86400_000 + 7 * 3600_000)).toBe(false);
  expect(claimPackUpsell(0)).toBe(false);
  localStorage.setItem(STORAGE_KEYS.PACK_DEAL_UPSELL, 'broken');
  expect(claimPackUpsell(2 * 86400_000)).toBe(false);
});
