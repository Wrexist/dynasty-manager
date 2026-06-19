# Retention Features — Audit & Improvement Plan

> Covers the 8 commits on `claude/game-retention-strategy-9wdyz7` (daily streak,
> World Cup festival, notifications, Dynasty Legacy, lineup fix, audit + polish).
> Last reviewed 2026-06-19.

---

## 1. Audit result — correctness

**No critical bugs outstanding.** Every feature passed full preflight (lint +
typecheck + 1800+ tests + build + size budget). Issues found during review were
fixed in-branch:

| Fixed | Where | Severity |
|---|---|---|
| `selectBestLineup` fielded 10 when squad shape ≠ formation | `playerGen.ts` | High |
| Same fix mis-ordered lineup vs formation slots (chemistry maps by index) → reworked to in-place backfill | `playerGen.ts` | Medium |
| Daily-reward auto-close timer could `setState` after unmount | `DailyRewardModal.tsx` | Minor |
| Notification toggle didn't reconcile with a revoked OS permission | `SettingsPage.tsx` | Minor |
| Festival banner shown over first-launch onboarding | `FestivalBanner.tsx` | Polish |
| Stale OS reminders could fire on cold start / after data wipe | `main.tsx`, `SettingsPage.tsx` | Polish |
| Next-tier progress hint on the Legacy hero | `managerLegacy.ts`, `DynastyLegacy.tsx` | Polish |

### Verified-correct (not bugs)
- **Dynasty Legacy summing is sound.** Prestige resets `seasonHistory`/
  `managerStats` via `initGame`, so the `prestige-<ts>` snapshot and the
  post-prestige `slot-N` entry cover disjoint seasons — no double-count.
- **Account-deletion compliance holds** — all new device-global keys are
  `dynasty-*` prefixed, so `deleteAllDynastyData` sweeps them; OS reminders are
  now cancelled there too.
- **No save-schema migration** anywhere — all new state is device-global
  localStorage. `CURRENT_VERSION` stays 72.
- **No eager-bundle regression** — the Capacitor plugins and the Legacy/Festival
  pages are dynamically imported.

### Known limitation (documented, not a regression)
- **New Game overwrites a slot's Hall record.** Hall entries key on
  `slot-${activeSlot}` at season-end, so starting a fresh career in a used slot
  replaces the prior career's record (it was already the Hall's behaviour).
  Dynasty Legacy therefore reflects *recorded* dynasties, not literally every
  career ever. Fix is in §3 (P2).

---

## 2. P0 — Ship & verify (no more code needed)
- [ ] **Open the PR** (`pull/new/claude/game-retention-strategy-9wdyz7`).
- [ ] **Label the PR** `type:new` / `type:highlight` so the auto-changelog
      surfaces these in the in-app "What's New".
- [ ] **Trigger a TestFlight build** — the ONLY way to verify native
      notifications (permission prompt + delivery). Manual test script:
  1. Settings → Reminders → enable → confirm OS prompt → grant.
  2. Background the app → confirm 3 reminders scheduled (streak/festival/nudge).
  3. Foreground → confirm they're cancelled.
  4. Revoke in iOS Settings → reopen app Settings → toggle should read OFF.

---

## 3. P1 — High-value, low-risk improvements (build next)

### 3.1 Persistent streak indicator (retention multiplier)
The streak only appears in the once-daily modal; if dismissed it's invisible.
A **flame + count in the TopBar** (Duolingo pattern) keeps the streak
top-of-mind, which is the actual loss-aversion driver. Pure-client, reads
`readDailyStreak()`. *Est: small.*

### 3.2 Surface the lifetime tier (identity flex)
Show the `LegacyTier` badge on the main menu / Dashboard header. Players who see
"Legendary" next to their name have a reason to keep climbing. *Est: small.*

### 3.3 Streak milestones + celebration
Reward 7/30/100-day streaks with a bigger payout and a confetti moment (reuse
`components/game/pack/` confetti). Adds a goal gradient to the daily loop.
*Est: small–medium.*

### 3.4 Modal sequencing (polish)
The daily-reward modal auto-opens on Dashboard mount; if a press conference or
weekly digest is also pending they stack. Add a tiny priority gate so only one
blocking overlay shows at a time. *Est: small.*

### 3.5 Analytics instrumentation (can't improve what you don't measure)
Wire `utils/analytics.ts` events: `daily_streak_claim`, `festival_checkin`,
`festival_tier_claim`, `legacy_view`, `reminders_enabled`. Feed the D1/D7/D30
funnel from the roadmap §7. *Est: small.*

---

## 4. P2 — Larger features that extend this foundation

### 4.1 Gameplay-driven Festival Points
Today the festival is check-in-only. Award points for wins/clean sheets *during
the event window* via a guarded hook after the existing objective evaluation in
`weekAdvance.ts`. Deferred from v1 to protect the game loop — do it deliberately
with tests. Makes the event reward *playing*, not just *opening*. *Est: medium.*

### 4.2 Manager Pass (monetization-safe season track)
Generalise the `liveEvents` tier-track into a season-long **Manager Pass** (free
+ Pro lanes, cosmetic/XP only — never sim). Reuses the festival UI and the
device-global progress pattern. The roadmap's strongest monetization lever.
*Est: medium.*

### 4.3 True lifetime Hall (fix §1 limitation)
On New Game into a used slot, archive the old `slot-N` entry under a unique id
(as prestige already does) before it's overwritten, so Dynasty Legacy is truly
all-time. Touches `resetGame` — small but needs a migration-free archival step
+ tests. *Est: small–medium.*

### 4.4 Richer Dynasty Legacy
Most-decorated club, favourite formation, a milestone timeline, per-competition
trophy breakdown, and a shareable "legacy card" image (ties into the existing
`CinematicCapturePage`/marketing kit). *Est: medium.*

### 4.5 Cosmetic festival/streak rewards
Festival tiers and streak milestones currently grant XP only. Add cosmetic
unlocks (event kit/badge, streak flame colours) via the existing cosmetics
catalog — entitlement-safe, no consumables. *Est: medium.*

---

## 5. P3 — Cleanliness / optimization
- [ ] Extract `localDateKey`/`daysBetween` into `utils/dateKey.ts` — `liveEvents`
      currently imports them from `dailyStreak`, an odd dependency direction.
- [ ] Group the device-global engagement state (streak, live-event,
      notifications opt-in) behind one `utils/engagement/` module for clarity.
- [ ] Smoke-render tests for `DailyRewardModal`, `FestivalHub`, `DynastyLegacy`
      to guard against future regressions (logic is covered; render isn't).
- [ ] Verify the new framer-motion bits (infinite streak-pill pulse, festival
      progress bar) fully honour `settings.reducedMotion` / perf-mode.
- [ ] Gate `dynasty-legacy` in `DRAWER_PROGRESSIVE_SCREENS` (season ≥ 1) for
      consistency with `hall-of-managers` (season ≥ 2), or intentionally keep it
      always-visible with its empty state.

---

## 6. Suggested next slice
Bundle **§3.1 (TopBar streak) + §3.2 (tier badge) + §3.5 (analytics)** into one
"Visibility & Instrumentation" pass — all pure-client, fully testable, and they
make the work already shipped *visible* and *measurable*, which is where the
retention actually compounds. Then tackle **§4.2 Manager Pass** as the next
headline.
