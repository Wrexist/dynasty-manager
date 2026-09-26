/**
 * Builders for RevenueCat payloads in the shape the Capacitor bridge delivers,
 * shared by the IAP lifecycle and matrix suites. The SDK mock itself stays in
 * each test file — `vi.mock` factories are hoisted above imports.
 */
import type { ProductId } from '@/types/game';

export const DAY = 24 * 60 * 60 * 1000;

export const iso = (ms: number) => new Date(ms).toISOString();

/** Rejections exactly as the iOS bridge sends them:
 *  `call.reject(message, "\(error.code)", nsError)` — numeric code as a string. */
export const STORE_ERRORS = {
  /** PURCHASE_CANCELLED_ERROR — the player dismissed the sheet. */
  cancel: { message: 'Purchase was cancelled.', code: '1' },
  /** PAYMENT_PENDING_ERROR — Ask to Buy / SCA. */
  pending: { message: 'The payment is pending.', code: '20' },
  /** STORE_PROBLEM_ERROR — the store failed the transaction. */
  storeProblem: { message: 'There was a problem with the App Store.', code: '2' },
} as const;

export interface EntitlementOpts {
  expiresInDays?: number | null;
  isActive?: boolean;
  periodType?: string;
  billingIssue?: boolean;
  unsubscribed?: boolean;
}

/** A RevenueCat `pro` entitlement unlocked by `productId`. */
export function proEntitlement(productId: ProductId | string, opts: EntitlementOpts = {}) {
  const { expiresInDays = 30, isActive = true, periodType = 'NORMAL', billingIssue = false, unsubscribed = false } = opts;
  return {
    identifier: 'pro',
    isActive,
    willRenew: !unsubscribed,
    periodType,
    productIdentifier: productId,
    productPlanIdentifier: null,
    expirationDate: expiresInDays == null ? null : iso(Date.now() + expiresInDays * DAY),
    billingIssueDetectedAt: billingIssue ? iso(Date.now() - DAY) : null,
    unsubscribeDetectedAt: unsubscribed ? iso(Date.now() - DAY) : null,
  };
}

/** A CustomerInfo payload. `all` defaults to `active`. */
export function customer(opts: {
  active?: Record<string, unknown>;
  all?: Record<string, unknown>;
  purchased?: string[];
} = {}) {
  const active = opts.active ?? {};
  return {
    entitlements: { active, all: opts.all ?? active },
    allPurchasedProductIdentifiers: opts.purchased ?? [],
    activeSubscriptions: [],
    originalAppUserId: '$RCAnonymousID:test',
    nonSubscriptionTransactions: [],
  };
}
