# Pack Store Deals — design spec

> Status: **draft for review** · 2026-09-20
> Author: Claude (brainstormed with the project owner)
> Visual references: `.superpowers/brainstorm/531136-1789913114/content/store-layout.html`,
> `upsell-popup-v2.html`
> Supersedes nothing. Rides the version *after* the pending App Store candidate.

## 1. Goal

Turn the Market's pack screen from a static catalogue into a live store:

1. All six packs permanently purchasable — Bronze, Silver, Gold (free/ad), Premium Gold,
   Rare Gold, Icon (IAP).
2. Three limited-time **deal slots** on top, each offering the same SKU at the same price
   with **bonus cards**, on real, non-resettable deadlines.
3. Clean upsell popups that surface a live deal at high-intent moments, hard-capped so they
   cannot become noise.
4. Disclose pack odds before purchase (Apple Guideline 3.1.1).

### Non-goals

- No new App Store products. All four existing consumable SKUs are reused as-is.
- No price discounts. Consumables have no in-app offer mechanism; a fake "was/now" price
  would be a false claim. Bonus content is the only honest lever.
- No change to rarity weights, guaranteed floors, or pity maths.
- No monetization influence on simulation outcomes (standing project rule).

## 2. Catalogue and deal slots

`PackTierKey` and all six `PACK_TIERS` entries are unchanged. One new config block in
`src/config/packs.ts`:

```ts
export interface PackDealSlot {
  id: 'flash' | 'focus' | 'daily';
  windowMs: number;
  bonusCards: number;
  /** Paid tiers only. Free tiers must never appear here. */
  pool: PackTierKey[];
}

/** Paid tiers only. Free tiers must never be added here. */
export const PAID_DEAL_POOL: PackTierKey[] = ['gold', 'premium', 'rare', 'icon'];

export const PACK_DEAL_SLOTS: PackDealSlot[] = [
  { id: 'flash', windowMs: 4 * 60 * 60 * 1000,  bonusCards: 3, pool: PAID_DEAL_POOL },
  { id: 'focus', windowMs: 12 * 60 * 60 * 1000, bonusCards: 2, pool: PAID_DEAL_POOL },
  { id: 'daily', windowMs: 24 * 60 * 60 * 1000, bonusCards: 1, pool: PAID_DEAL_POOL },
];
```

Shorter window ⇒ larger bonus. Pool excludes `bronze` and `silver` (no SKU, and a bonus on
a free pack is free value).

### Rotation maths — `src/utils/packDeals.ts` (new, pure)

```ts
export interface ActiveDeal {
  slotId: PackDealSlot['id'];
  tierKey: PackTierKey;
  bonusCards: number;
  endsAt: number;      // epoch ms
  remainingMs: number;
}

export function getActiveDeals(now: number): ActiveDeal[];
export function getDealForTier(tierKey: PackTierKey, now: number): ActiveDeal | null;
export function formatDealRemaining(ms: number): string;   // '3h 24m', '9m 12s'
```

- `cycleIndex = Math.floor(now / slot.windowMs)`
- `tier = pool[(cycleIndex * 3 + slotIndex) % pool.length]` — multiplier coprime with
  `pool.length` so consecutive cycles rotate, and slots stay decorrelated.
- `endsAt = (cycleIndex + 1) * slot.windowMs`
- No randomness, no storage. Same clock ⇒ same deals for everyone ⇒ support can reproduce
  any report from a timestamp.

### Clock source

`now` **must** come from the existing monotonic high-water clock used by the daily pack
allowance (`observeClock` / `CLOCK_HIGH_WATER` in `store/helpers/persistence.ts`), never
`Date.now()` directly.

- Winding the clock back cannot re-arm a consumed or expired deal.
- Winding it forward skips ahead permanently and **cannot be undone**.

**Accepted tradeoff:** a player can jump their clock forward to hunt a larger bonus. It is
one-way, self-punishing, and capped at +3 cards. Document it in the module header, in the
same style as the existing accepted-tradeoff notes.

## 3. Bonus application

- `bonusCards = tier.cards + deal.bonusCards` (Rare Gold: 5 → 8 in the 4h slot).
- The bonus applies **only to a paid (IAP) open** of the deal tier while the window is live.
  Free and ad opens keep using the existing `freeOpenOverride` — the free daily Gold does
  **not** inherit a deal bonus.
- Bonus resolution goes through `resolvePackTier()` so the badge the player saw and the
  contents they receive cannot disagree.
- `generatePackContents` gains a `cardsOverride` parameter. Rarity weights, `guaranteedMinOvr`,
  and the pity counter are untouched. Pity still increments once per pack, not per card.
- **Expiry during purchase:** if a window closes between render and tap, the open proceeds at
  the standard contents and the UI toasts *"Deal ended — opened the standard pack."* The app
  never charges for an advertised bonus it will not deliver.

## 4. Purchase integrity

`PendingPackCredit` (device-local, `store/helpers/persistence.ts`) gains:

```ts
bonusCards?: number;   // absent on legacy records ⇒ treated as 0
dealSlotId?: string;   // diagnostics only
```

Locked at charge time: pay inside a window and the bonus is delivered even if the credit is
redeemed after expiry. Legacy records without the field resolve to 0 — no migration, no
save-schema change.

## 5. Store UI (layout A — approved)

Order on `PacksPage`:

1. Status row (unchanged) + daily reset chip.
2. **"Limited deals" rail** — three compact deal cards, one per slot. Each shows tier name,
   `+N CARDS` badge, remaining time, and price. Live countdown on each.
3. **"All packs"** — the existing 3-column grid, all six tiers, always purchasable.
4. Guarantee tracker, recent pulls (unchanged).

Deal card contents:

- Tier name + rarity gradient (from `tierGradient`).
- `+N CARDS` badge, and the honest arithmetic: `8 cards · normally 5`.
- Countdown from `endsAt`, refreshed by a new `useCountdown(targetMs)` hook
  (`src/hooks/`), paused while the document is hidden, matching the existing timer pattern
  in `PacksPage`.
- CTA gated on `packSkuPurchasable(productId)` immediately before purchase — the same guard
  that fixed the build-174 dead-CTA rejection.
- When a window closes the card re-renders as the standard pack. There is no state where a
  deal CTA is shown but not honoured.

## 6. Upsell popups

One component, `PackDealUpsell`, two modes:

- `mode="single"` → centered glass card (one deal expiring)
- `mode="multiple"` → bottom sheet listing the live deals (two or more)

Built from `PurchaseModal`'s pattern: portal, focus trap, `useScrollLock`, Escape, backdrop
tap, `aria-modal`, reduced-motion aware spring-in. All decorative motion returns `null` under
`useReducedMotionPref()` or performance mode.

### Triggers (event-driven)

| Trigger | Fires when |
|---|---|
| `dealExpiring` | A deal has ≤60 min left and the player is not in MatchDay or onboarding |
| `postOpen` | A free/ad pack open just completed and a deal is live |
| `postWin` | A match was won and no upsell has shown today |
| `creditWaiting` | An unclaimed paid-pack credit exists (service message, not a sell) |

### Caps (hard)

- 1 upsell per foreground session (foreground session = app foregrounded until it next
  backgrounds; a new session starts on the next foreground)
- 2 per day, using the same monotonic day index as the daily pack allowance
- ≥6h between any two
- Never on MatchDay, never during onboarding, never in the first career week
  (`season === 1 && week <= 2`)
- Always dismissible; dismissal is recorded against the caps

Caps live in a device-scoped record under a new `STORAGE_KEYS` entry
(`PACK_DEAL_UPSELL`), patterned on `DAILY_PACK_OPENS`. Nothing enters the save file.

### Copy rules

- Every number shown (bonus size, remaining time, odds) is computed at render time from
  config and the clock. No hand-typed figures.
- No countdown may be shown for a deadline the app does not enforce. When a timer reads
  zero, the offer is gone.

## 7. Odds disclosure — `PackOddsSheet`

New sheet, opened by an `Odds` affordance on each paid pack card and from the purchase
confirmation, before payment.

- Per-rarity percentage for the tier actually about to be opened (via `resolvePackTier`, so
  free-ad and paid odds each show their own), stated as **per card**.
- Guaranteed floor and card count, including the active bonus when one applies.
- Closes the Guideline 3.1.1 gap: paid randomised packs must disclose odds before purchase.

## 8. Analytics

New events in `src/utils/analytics.ts` (contract file — extend the union):

`pack_deal_viewed` · `pack_deal_opened` `{slotId,tierKey,bonusCards}` ·
`pack_upsell_shown` `{trigger}` · `pack_upsell_dismissed` `{trigger}` ·
`pack_odds_viewed` `{tierKey}`

> Reminder: analytics has **no transport by design** (local-only). These events exist for
> local debugging and Sentry breadcrumbs. Do not build a funnel that expects data, and do
> not treat any conversion figure as measured.

## 9. Files

**New:** `src/utils/packDeals.ts` · `src/hooks/useCountdown.ts` ·
`src/components/game/pack/PackDealCard.tsx` · `PackDealUpsell.tsx` · `PackOddsSheet.tsx`

**Modified:** `src/config/packs.ts` · `src/types/game.ts` (deal types, analytics union) ·
`src/store/slices/packsSlice.ts` · `src/utils/packGeneration.ts` ·
`src/utils/packCreditRecovery.ts` · `src/store/helpers/persistence.ts` (new storage key) ·
`src/pages/PacksPage.tsx` · `src/components/game/pack/PackShopCard.tsx`

**No change:** `utils/saveMigration.ts` — the save schema stays at the current version.

## 10. Testing

- `packDeals.test.ts` (new): window boundaries at exact ms edges; determinism for a fixed
  timestamp; slot decorrelation; countdown formatting; high-water clock blocks rollback;
  deal rotates on the boundary.
- `packs.test.ts` (extend): bonus applies on paid open only; free open of a deal tier gets no
  bonus; card count is `cards + bonusCards`; pity unchanged; window expiry mid-tap falls back
  to standard contents.
- `packCreditRecovery.test.ts` (extend): a credit charged inside a window delivers its bonus
  after expiry; legacy credit with no `bonusCards` delivers the standard pack.
- Render/a11y: `PackDealUpsell` focus trap, Escape, cap enforcement; `PackOddsSheet` content
  matches the tier's effective weights.
- Manual: change the device clock forward and back; confirm no free bonus re-arm.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Popup fatigue → 1-star reviews | 1/session, 2/day, 6h gap, dismissal respected |
| Dead-CTA rejection (build 174 history) | Availability probe immediately before every purchase; standard-pack fallback on expiry |
| False urgency claim (2.3.1 / 3.1.2) | Every timer is a real, enforced deadline; no reset-on-open |
| Undisclosed loot-box odds (3.1.1) | `PackOddsSheet` ships with this work |
| Free value leak via bonus on free opens | Deal pool is paid-tier only; bonus applies to IAP opens only |
| Clock-forward bonus hunting | One-way high-water clock, capped at +3 cards, accepted and documented |
| Purchase interruption losing a bonus | Bonus locked into `PendingPackCredit` at charge time |

## 12. Rollout

Ships **after** the pending App Store candidate passes device testing — this changes pack
contents, store copy, and adds UI, which would invalidate that device pass. Needs its own
version bump and `npm run whats-new:seal`.

Estimated effort: **7–8 hours** across two sessions (config + maths ~1h, slice/credit/
generation ~1.5h, store UI ~2h, popups ~1.5h, odds sheet ~0.5h, tests + preflight ~1.5h).
