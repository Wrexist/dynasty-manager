# Dynasty Manager — Full Codebase Audit

> Generated 2026-06-10 against app v1.0.13 / save schema v71.
> Method: 14 parallel section audits covering all hand-written source (~139K LOC).
> Severity: **CRITICAL** = crash / save corruption / revenue loss · **HIGH** = broken feature / wrong sim results · **MEDIUM** = edge-case bug / UX defect · **LOW** = quality / improvement.

---

## Section 11: App shell, career/meta pages, hooks
*(App.tsx, main.tsx, TitleScreen, ModeSelect, ClubSelection, ManagerCreation, ManagerProfile, ChallengePicker, JobMarket, CareerOverview, NationalTeamPage, NationalSquadPicker, InternationalTournament, BallonDor, HallOfManagers, PerksPage, PrestigePage, PacksPage, ShopPage, SubscribeOnboarding, SettingsPage, HelpPage, WhatsNewPage, NotFound, CinematicCapturePage, all 11 hooks)*

**Overall:** Well-defended shell — hydration race is gated, `isPro()` discipline holds everywhere, zero direct localStorage, hooks are clean. Risk concentrates in two monetization seams (consumable credit durability, trial messaging) plus state-trap edge cases in NationalSquadPicker and career negotiation UIs.

### CRITICAL
- **C1. Consumable pack purchase not crash-durable — paid credit can vanish.** `src/pages/PacksPage.tsx:323-343`. Flow is `await purchaseConsumable(...)` → `openPack(tierKey, { skipPayment: true })` with no persisted pending-credit record. (a) App killed after StoreKit charge but before `openPack` → consumables never appear in entitlements → nothing to reconcile on relaunch, money gone. (b) `openPack` succeeds but writes only to memory; autosave fires on `advanceWeek`, not pack open → crash loses paid players while consumable stays consumed. In-session `paidButRejected` handling (`packsSlice.ts:217-237`) covers eligibility rejection but not process death. **Fix:** persist `{ productId, tierKey, timestamp }` pending-credit flag (via persistence helpers) *before* `purchaseConsumable`; clear only after `openPack` + forced save flush; re-grant unconsumed credit on app start. Force a save immediately after paid `openPack`.

### HIGH
- **H1. Free-trial copy shown to trial-ineligible users; success toast asserts trial started regardless of reality.** `src/pages/SubscribeOnboarding.tsx:91, 421-423, 163-169`. Trial eligibility never checked — lapsed subscriber sees "3-day free trial included", is charged full price immediately (intro offers are once per Apple ID), then sees "3-Day Trial Started!". Local `startFreeTrial()` correctly no-ops, but UI lies. Apple 3.1.2(c) exposure given this screen exists because of a prior rejection. **Fix:** gate trial caption/CTA/toast on RevenueCat `checkTrialOrIntroductoryPriceEligibility` (or at minimum `monetization.subscription == null`).
- **H2. NationalSquadPicker counts invisible players — confirm flow can deadlock.** `src/pages/NationalSquadPicker.tsx:74-80, 83-90, 113-114, 328, 150, 186`. Eligible pool = top 50 excluding injured, but `pickedIds` is seeded unfiltered from `nationalTeam.squad`. A picked player who got injured / fell out of top 50 / was deleted is counted but never rendered: user sees "23/23" with 22 visible checks and can't deselect the hidden one; with a dead ID, all adds blocked while confirm demands a 23rd visible player. Only escape is "Clear". NationalTeamPage solves this with its `extras` append (`NationalTeamPage.tsx:93-104`); the picker doesn't. **Fix:** mirror the extras logic; base add-block on `pickedPlayers.length` not `pickedIds.size`.

### MEDIUM
- **M1. Deep-link/refresh onboarding silently defaults to save slot 1 — possible save overwrite.** `src/pages/ClubSelection.tsx:129` (`(location.state)?.slot || 1`), `ModeSelect.tsx:65`, `ManagerCreation.tsx:50`. Completing onboarding without nav state calls `saveGame(1)` and overwrites slot 1 with no warning. **Fix:** redirect to `/` when `location.state?.slot` is absent.
- **M2. No chunk-load retry on lazy routes** — `src/App.tsx:17-23`. Stale web deploy → rejected dynamic import → error screen with no retry. **Fix:** retry helper with one guarded `window.location.reload()` on chunk-load failure.
- **M3. ShopPage mixes localized store prices with hardcoded USD in same panel.** `src/pages/ShopPage.tsx:234-239, 555, 345, 391, 394`; `BUNDLE_SAVINGS_PCT`/`ANNUAL_SAVINGS_PCT` (`:56, :63`) computed from USD config can misstate savings under regional tiers. **Fix:** derive comparisons from fetched `storePrices`; hide strikethrough/captions when only USD fallbacks exist.
- **M4. JobMarket counter-salary resync can exceed slider max after a board counter.** `src/pages/JobMarket.tsx:398-403` resyncs to `offer.salary * 1.15` but slider max is `initialSalary * 1.4` (`:434`); after a board counter ≥ ~1.22× initial, state exceeds max — thumb renders clamped while real value is higher; Submit sends an over-cap counter, burning a negotiation round. **Fix:** clamp the resync with `Math.min(..., maxSalary)`.
- **M5. Accepting a job offer at/after retirement age silently no-ops.** `src/pages/JobMarket.tsx:49-51` → `careerSlice.ts:294`. Accept button enabled, tap does nothing, no toast. **Fix:** surface rejection or filter/disable offers at retirement age.
- **M6. NationalTeamPage allows saving a squad below 11 players (or fully cleared).** `src/pages/NationalTeamPage.tsx:254-265, 310-313, 493-503`. >23 ceiling enforced, no minimum. NEEDS VERIFICATION: how weekAdvance's international sim handles a short/empty `nationalTeam.lineup`. **Fix:** warn or block "Done" when squad < 11.
- **M7. ManagerCreation nests interactive controls inside a `<button>`.** `src/pages/ManagerCreation.tsx:516-660` — invalid HTML; VoiceOver/keyboard accessibility hazard. **Fix:** card as `div role="button"` or move negotiation panel outside (as JobMarket does).

### LOW
- **L1. Dead shadcn toast system with `TOAST_REMOVE_DELAY = 1000000`.** `src/hooks/use-toast.ts:6` — nothing outside `components/ui/toaster.tsx` imports it; all app toasts use Sonner. `<Toaster />` at `App.tsx:66` renders an eternally empty list. Remove the mount + hook (or fix delay).
- **L2. `handleSubscribe` lacks the re-entrancy guard `handleRestore` has.** `SubscribeOnboarding.tsx:139` vs `:184`. Add `if (purchasing || restoring) return;`. Also `handleSkip` (`:208-212`) sets `SUBSCRIBE_ONBOARDING_SEEN` twice (harmless).
- **L3. Settings "Load Game" ignores `loadGame()` result** (`SettingsPage.tsx:411`) — failed load gives zero feedback. Also `handleRestorePurchases` (`:160`) swallows errors without Sentry; raw string keys at `:468-469` instead of `STORAGE_KEYS`.
- **L4. Render-phase side effect in consent init.** `App.tsx:56-60` — `refreshAnalyticsConsent()` inside `useState` initializer + redundant mount effect. Also TitleScreen is the only route without a scoped ErrorBoundary (`App.tsx:76`).
- **L5. Unreachable branch in `WhatsNewPage.handleBack`.** `WhatsNewPage.tsx:89-93` — `!standalone && gameStarted` can never execute. Delete.
- **L6. `main.tsx` ↔ `TitleScreen` circular import.** `main.tsx:24,31` / `TitleScreen.tsx:12`. Move `saveStorageReady`/`signalReady` into a standalone module.
- **L7. `useFinanceBreakdown` recomputes full breakdown every render** (`useFinanceBreakdown.ts:41-54`, no `useMemo`; selector subscribes to 14 slices). Wrap in `useMemo`.
- **L8. ManagerProfile blank-screen edge + chart clipping.** `ManagerProfile.tsx:76-84` returns bare `null` in career mode without careerManager; `:205` hardcodes YAxis domain `[1, 20]` — positions 21–24 plot off-scale.
- **L9. HelpPage content stale.** `HelpPage.tsx:10` says "30 European leagues" (now 45/37 countries); `:22` says "7 formations" (10 exist).
- **L10. PacksPage minor:** `handleSellAll` `setBusy` never renders (synchronous; comment's double-tap rationale wrong, actual protection is empty `opening.players`); daily free pack keys off device-local date — clock rollback re-grants (free tier only).
- **L11. ChallengePicker fixed-club path lacks error handling its sibling has.** `ChallengePicker.tsx:43-56` vs `:58-70` — no try/catch/loading/queueMicrotask; a throw hits route ErrorBoundary instead of toast.
- **L12. PrestigePage confirm dialog is a raw fixed overlay** (`PrestigePage.tsx:136-155`) — no Escape/focus trap/backdrop dismiss for the most destructive action in the game. Use `ConfirmDialog`.
- **L13. ShopPage "Starter Kit – Limited Offer" is the regular Manager Pack at regular price.** `ShopPage.tsx:252-275` vs `config/monetization.ts:62-68, 308-313` — synthetic countdown urgency; reputational/App-Store-scrutiny risk.

### eslint-disable verification
- `TitleScreen.tsx:48` and `:85` — safe (extraneous-dep cache-busters, intentional).
- `JobMarket.tsx:402` — disable itself fine; the bug it sits next to is M4's missing clamp.
- `SubscribeOnboarding.tsx:231` — safe; reactive input `storePrices` is in deps.

### Verified clean
`isPro()` checks only one-time SKUs + `subscription.expiresAt`; no sub-SKU-vs-entitlements check anywhere in section; no `presentPaywall`; Apple disclosures present; trial-restart abuse guard confirmed (`monetizationSlice.ts:188`); hydration race closed; double-tap purchase guards in PacksPage/ShopPage; hooks clean (focus trap/scroll lock cleanups, no whole-store subscriptions, `useSwipeGesture` no passive-listener issue).

---

## Section 10: System pages (Transfers, Scouting, Youth, Facilities, Finance, Merch, Board, Club, Cups, Continental, SuperCup, LeagueTable, TeamDetail, Calendar, Inbox, SeasonSummary, TrophyCabinet)

**Overall:** Good. Null-guard discipline strong; every economic action traced re-validates inside the store, so double-tap double-processing isn't possible. No CRITICAL issues. Real problems: two silently dead features, a direct Zustand mutation in render, several stale/contradictory displays.

### HIGH
- **H1. SeasonSummary near-miss banners ("SO CLOSE!" / "GREAT ESCAPE!") are dead code.** `src/pages/SeasonSummary.tsx:53-77`. `nearMiss` reads `leagueTable`, but `seasonEnd.ts:821,1188` replaces it with a fresh zero-point table in the same `set()` that opens this screen — `gap ≤ 0` always → always `null`. Also a logic flaw: "survived" case measures gap to the team *above*, not to the first team below the drop line. **Fix:** snapshot final-table gaps into `SeasonHistory` at season end; compute survival vs the team below.
- **H2. FacilitiesPage upgrade-completion ripple + max-level CelebrationModal are unreachable.** `src/pages/FacilitiesPage.tsx:37-71, 287-293`. Upgrades complete only inside `advanceWeek()` (`weekAdvance.ts:1929-1957`), invokable only from other screens; FacilitiesPage is always unmounted at completion and `prevUpgradeRef` initializes to the already-null value on remount — the transition is never observed. **Fix:** persist a "last completed upgrade" marker in the facilities slice; consume/clear on mount. (The line-63 eslint-disable itself is safe.)

### MEDIUM
- **M1. ContinentalPage in-place `.sort()` mutates store state during render.** `src/pages/ContinentalPage.tsx:122-127` — `tournament.groups.sort(...)` reorders the live state array (persisted into the save). No downstream order-dependence today, so latent. **Fix:** `[...tournament.groups].sort(...)`.
- **M2. Inbox "Unread only": opening a message makes it vanish mid-read.** `src/pages/InboxPage.tsx:191-193, 225-228` — `toggleExpand` marks read; filter recomputes and unmounts the message immediately. **Fix:** exempt the expanded id, or mark read on collapse.
- **M3. ClubPage + YouthAcademy facility displays read static club fields upgrades never update.** `ClubPage.tsx:169-181`, `YouthAcademy.tsx:140-151` — show `club.facilities`/`club.youthRating`, but upgrades mutate only the `facilities` slice (`weekAdvance.ts:1940-1951`). £10M of upgrades, bars frozen at day-one values (YouthAcademy is internally contradictory — `:160` reads the slice). **Fix:** read the `facilities` slice on both pages.
- **M4. SuperCupPage hardcoded labels wrong for two cases.** `SuperCupPage.tsx:41, 79` — continental Super Cup is Champions-winner vs Shield-winner (labeled "League Champion"/"Cup Winner"); domestic double case away is the league runner-up (`seasonEnd.ts:887-918`). **Fix:** derive labels from `match.type`.
- **M5. MerchandisePage unlock text says "or" but check is AND.** `MerchandisePage.tsx:445-451` vs `utils/merchandise.ts:60-70`; `digital_global` has two requirements (`config/merchandise.ts:55`). **Fix:** join with "and".
- **M6. TransferPage loan buy fee computed inline, duplicating slice logic.** `TransferPage.tsx:902, 910` vs `loanSlice.ts:389` (hardcoded 1.2 instead of config constant). Agree today; drift = confirm dialog quotes different fee than charged. **Fix:** shared `getLoanBuyFee()` util; slice uses config constant.
- **M7. LeagueTable un-cleaned `setTimeout` runs heavy league init after unmount; double-select queues duplicate inits.** `LeagueTable.tsx:155-166` — no cleanup, no in-flight guard. **Fix:** timeout id in ref, clear on unmount, guard with `isLoading`.

### LOW
- **L1.** `ScoutingPage.tsx:247` — `assignScout` result ignored; success toast on silent no-op at max assignments (`systemsSlice.ts:279`). Make it return `{success}`, gate the toast.
- **L2.** `ScoutingPage.tsx:124` — `reports.slice(0, 10)` silently truncates; reports 11+ invisible, no "more" indicator.
- **L3.** `TransferPage.tsx:507` vs `:163-164` — market stats show raw `freeAgents.length` while the tab filters by reputation gate; counts disagree.
- **L4.** `TransferPage.tsx:226-233` — missing player on stale offer skips the large-fee confirm gate entirely (store re-validates, but the "cannot be undone" confirm is bypassed).
- **L5.** `YouthAcademy.tsx:140` vs `:148` — inconsistent fallbacks: text says 0/10 while 5 bars light when club missing.
- **L6.** `FinancePage.tsx:88-89, 99, 134, 152` — inline money formatting instead of `formatMoney()`; negatives render "£-12.3M".
- **L7.** `FacilitiesPage.tsx:315, 331` — per-stand revenue formula in JSX disagrees with real `utils/facilities.ts:5-8` math (floor of average); figures don't sum to the real total.
- **L8.** `MerchandisePage.tsx:132` — unguarded `MERCH_CAMPAIGNS[type].label` (save with removed campaign type would crash); `:64-74` action results discarded — silent failures.
- **L9.** `CupPage.tsx:17-19` / `LeagueCupPage.tsx:18-20` — legacy played-draw fallback names the away team winner; bias to `null` instead.
- **L10.** `CalendarView.tsx:489, 598, 699` — `currentWeekRef` assigned to every current-week entry; auto-scroll centers the last row, not the first.
- **L11.** `InboxPage.tsx:406-435` — storyline `stepChoiceMap` skip-detection likely mislabels "Chose:" for chains with consecutive conditional steps. NEEDS VERIFICATION against `storylineChains.ts`.

### Verified clean
Transfer/loan/merch/facility actions store-revalidated against double-tap; qualification-zone math 1-based and consistent; `entry.form` ordering correct; League Cup week labels cover all rounds; GlassPanel adds proper a11y roles when clickable.

---

## Section 8: Monetization, packs & platform utils (purchases.ts, monetization.ts, config/monetization+packs, packGeneration, communityPackPool, ads, analytics, sentry, appReview, narratives/objectives/events, misc utils)

**Overall:** The five critical monetization invariants all hold at their enforcement points (verified across 30+ call sites). No CRITICAL findings, but `purchases.ts` has three HIGH money-path defects, plus a cluster of MEDIUM latent traps one refactor away from real revenue bugs.

### HIGH
- **H1. User-cancel and "charged but zero entitlements mapped" are indistinguishable (`[]`).** `src/utils/purchases.ts:153-157, 112-115`. `purchaseProduct` returns `[]` for both cancel and success-with-unmapped-entitlements (subs deliberately excluded from the fallback at `:292-298`). Both callers (`SubscribeOnboarding.tsx:145-149`, `ShopPage.tsx:121-125`) treat `[]` as cancel → a *charged* subscriber is told "No charge was made" and gets no Pro until a later background sync. **Fix:** discriminated union `{ cancelled } | { granted }`; on empty grant after a real transaction, run post-purchase sync instead of the cancel toast.
- **H2. Silent fallback to hardcoded test API key — live in Android builds.** `src/utils/purchases.ts:21` — `import.meta.env.VITE_REVENUECAT_API_KEY || 'test_CBbg…'`. `ios-testflight.yml:87` sets the secret; **`android-build.yml` does not** → every Android AAB ships the test key; all real purchases dead on Android. Single key also used for both platforms (RC requires per-platform keys). **Fix:** throw at build time when missing in prod; select `appl_`/`goog_` by platform; add secret to Android workflow.
- **H3. `NATIVE_MONETIZATION_READY` kill-switch turns purchases into free grants on device.** `src/utils/purchases.ts:89-93, 125-127` — mock-success branch fires on `!isNativePlatform() || !NATIVE_MONETIZATION_READY`. Flag is `true` today (`:24`), but flipping it during an incident grants permanent free entitlements + free packs to every user. **Fix:** mock only on `!isNativePlatform()`; on device with monetization disabled, return cancel/failure.

### MEDIUM
- **M1. `mapEntitlements` emits active subscription SKUs, which callers persist into `monetization.entitlements`.** `purchases.ts:260-301`; persisted via `SubscribeOnboarding.tsx:152`, `GameShell.tsx:202`, `ShopPage.tsx:108`. `isPro()` is safe, but `hasProduct()`/`getPurchaseCount()` report a lapsed sub as owned, and any future entitlement-iterating code reproduces the exact lapsed-subscriber bug invariant 1 exists to prevent. **Fix:** filter subscription-type products out of the entire `mapEntitlements` result.
- **M2. No persisted pending-grant for consumables** (same finding as Section 11 C1, from the wrapper side). `purchases.ts:80-121`. **Fix:** `pendingConsumable` key via persistence.ts before `purchasePackage`, cleared after pack commit, reconciled at app start.
- **M3. Malformed `expiresAt` grants permanent Pro.** `utils/monetization.ts:13-16` — `''` treated as lifetime; `new Date('garbage') < new Date()` is false (NaN), so unparseable dates never expire. **Fix:** only `null` = lifetime; invalid/empty = expired + re-sync.
- **M4. Init-timeout race causes double-`configure` and false failures.** `purchases.ts:43-69` — 5s race nulls `initPromise` while native configure may still complete; retry re-configures (RC warns against). **Fix:** track dispatched vs confirmed; poll `Purchases.isConfigured()` on retry.
- **M5. Cancel detection shape NEEDS VERIFICATION.** `purchases.ts:113-114, 154-155` — checks `error.userCancelled || code === 'PURCHASE_CANCELLED'`; some plugin versions use numeric-string `code` + `readableErrorCode = 'PURCHASE_CANCELLED_ERROR'`. If mismatched in v12.3.2, every cancel shows a scary failure toast + Sentry noise. Verify against installed plugin; add `readableErrorCode`.
- **M6. Synthetic cup/continental matches (`events: []`, no `stats`) corrupt weekly-objective evaluation.** `utils/weeklyObjectives.ts:463-491` — `no-cards` auto-completes free (empty `.some()` → false → true); `late-drama`/`comeback-win`/`youth-scorer`/`high-possession` impossible via those matches. **Fix:** thread real events/stats, or require non-empty event source for `no-cards`.
- **M7. Dead `xpEarned` return + contradictory comments = double-pay trap.** `weeklyObjectives.ts:552-578, 594-621` — base XP computed/returned but discarded (`weekAdvance.ts:2379`); actually paid on claim (`featureSlice.ts:158-180`) + month-end net (`weekAdvance.ts:2422-2427`). Docstrings describe the old auto-grant flow. **Fix:** delete `xpEarned`; rewrite comments.
- **M8. 'Club Legend' and farewell stats use season-scoped `appearances`.** `utils/playerNarratives.ts:21-23, 104-123` — `appearances` resets each season (`seasonEnd.ts:545,581`); Club Legend demands 50+ apps in a *single* season + 5 seasons tenure — nearly unobtainable; farewell shows final-season stats only. **Fix:** use `careerAppearances + appearances`.

### LOW
- `purchases.ts:398-423` — `startEntitlementListener` TOCTOU race can leak a native listener; `stopEntitlementListener` invokes remover unguarded.
- `purchases.ts:313` — `extractSubscriptionInfo` only recognizes entitlements named `'pro'`/`'dynasty_pro'`; dashboard mismatch = paying subscribers get no Pro. NEEDS VERIFICATION vs live RC dashboard.
- Web/dev mock asymmetry: mock annual purchase grants entitlement only (no SubscriptionInfo) → dev shows "Welcome to Pro!" with Pro locked. Synthesize a SubscriptionInfo for sub SKUs in the mock.
- `storylines.ts:35` + effect literals — hardcoded balance values in logic file; no duplicate-trigger memory (`weekAdvance.ts:1623` passes no history) — same storyline can repeat consecutive weeks.
- `randomEvents.ts:76-77, 91, 116` — inline floors/caps unconfigured; `sponsor_bonus` pays 10% of current budget → compounds for rich clubs.
- `playerNarratives.ts:3, 96-98` — 'Captain Fantastic' tag defined with a strength bonus but never assigned anywhere (dead content).
- `weeklyObjectives.ts:377-385` — 'youth-scorer' counts only `type === 'goal'`, missing penalty/header/free-kick goal types; use `GOAL_SHOT_TYPES` (not GOAL_SCORING_TYPES — own goals carry the opponent defender's playerId, `engine/match.ts:1536`).
- `config/packs.ts` design notes: rarity-band clamping pins values (a "silver" roll in a bronze pack is always exactly 68); pity counter (threshold 8) is global across tiers and ignores tier ceiling → ~every 4 days of free opens guarantees an 80–89 card, undercutting the $2.99 Gold pack's 78+ guarantee. Confirm intended.
- `communityPackPool.ts:164-169` — `needsRefill` ignores its `cpPool` param (dead arg); cursor never wraps — pool shrinks permanently at exhaustion. Caller re-shuffle NEEDS VERIFICATION.
- `weekPreview.ts:165` — hardcoded 46-week default for `totalWeeks`.
- `uiHelpers.ts:300` — duplicate `SK` alternative in `CLUB_SUFFIX_RE`.
- `sentry.ts:90-95` — `beforeBreadcrumb` scrubs only `data`, not `message`; console-breadcrumb integration could forward name-bearing strings.
- `purchases.ts:222` — statement jammed onto signature line (cosmetic).

### Verified clean
`ads.ts` stub correct; `analytics.ts` consent gate airtight; `appReview.ts`, `haptics.ts`, all misc utils clean; rarity weights sum to 1.0 across all six tiers; guaranteed floors enforced (`packGeneration.ts:73-96`); no direct localStorage; no eager community-pack imports in this set.

---

## Section 7: Squad/economy utils (transfers, contracts, training, youth, scouting, staff, chemistry, facilities, merchandising, finance helpers, auto-fill lineup, etc.)

**Overall:** Good shape — config-driven, no in-place mutation of store state, money math guarded. Problems cluster in the finance *display* layer (drifted from authoritative budget math) and index-aligned APIs broken by `filter(Boolean)`.

### HIGH
- **H1. League-position prize in finance breakdown disagrees with money actually paid.** `src/utils/financeHelpers.ts:76-77` computes `(tableLen + 1 − pos) * PRIZE_PER_RANK` with no tier scaling; authoritative `weekAdvance.ts:2056-2059` uses `(POSITION_PRIZE_MAX_RANK − pos) * PRIZE_PER_RANK * tierPrizeScale` (t2 0.35 / t3 0.12 / t4 0.05). Tier-4 club sees a line ~20× larger than reality. **Fix:** one shared prize function used by both.
- **H2. Merchandise operating costs double-counted in breakdown.** `financeHelpers.ts:87, 108` — `calculateWeeklyMerchRevenue` already returns net of operating costs; breakdown uses net as income *and* adds a separate ops expense line. Displayed net understates the real weekly delta every week. **Fix:** gross income + ops expense, or drop the expense line.
- **H3. Training gains have no `potential` cap — +12 OVR/season indefinitely.** `src/utils/training.ts:83-124` — never reads `player.potential`; a 30yo at 80/80 keeps climbing every season, making potential meaningless and inflating values (`training.ts:141`). Contradicts the documented dev model; long-save inflation vector. **Fix:** damp `gainChance` by potential gap (or hard-stop at potential).

### MEDIUM
- **M1. Academy prospects keep market value computed for the wrong age (up to ~2.7× inflated).** `utils/youth.ts:39` — age forced to 16/17 after pricing at rolled age (17–33); never recomputed until promotion (`transferMarketGen.ts:98-107` does this correctly). **Fix:** `recomputePlayerValueOnly(player)` after the age override.
- **M2. Chemistry formation-slot adjacency breaks on index misalignment.** `utils/chemistry.ts:43-44` maps `players[i]` → `FORMATION_POSITIONS[i]`, but `LineupEditor.tsx:106-107` / `TacticsPage.tsx:112,121` pass `filter(Boolean)`-compacted arrays — one stale ID shifts every later player onto the wrong slot → wrong links, wrong match chemistry bonus (engine tolerates partial lineups, so reachable). `autoFillLineup.ts:836-849` already works around exactly this. **Fix:** accept `(Player | null)[]` and skip nulls without compacting.
- **M3. squadInsights has the same index-alignment assumption.** `utils/squadInsights.ts:59-103` + `LineupEditor.tsx:175` — wrong-position warnings and unit averages mis-attribute after a gap. Same fix as M2.
- **M4. Training streaks ratchet forever.** `utils/training.ts:244-249` — only increments, nothing decays/drains (sole consumer `weekAdvance.ts:898`); comment claims drain logic that doesn't exist. Eventually every focused module sits at max → permanent 1.4× unlock. **Fix:** decay non-dominant streaks.
- **M5. Training effectiveness preview overstates gain chance ~1.5–3×.** `utils/training.ts:361` — omits diminishing-returns factor (`:94`), personality multiplier, per-attribute day split; `fitnessImpact` (`:371`) omits recovery-facility bonus. **Fix:** fold those factors into the preview.
- **M6. `getStaffBonus` picks staff by raw quality, ignoring traits/morale.** `utils/staff.ts:140` — sorts by `quality`, returns `getEffectiveQuality` of that winner; a demoralized q8 beats a motivated q7-with-trait (effective ~9.6). **Fix:** sort by `getEffectiveQuality`.

### LOW
- **L1.** `scouting.ts:58,63` — noise ranges asymmetric (−3..+2, −6..+5) vs documented ±3/±6; systematic under-estimation. Use range+1.
- **L2.** `contracts.ts:214` — `playerMood` no 100 ceiling (floor only); >100 leaks into displays.
- **L3.** `transferTalk.ts:16` — hardcoded `loyalty / 20` duplicates `PERSONALITY_TRAIT_MAX`.
- **L4.** `transferMarketGen.ts:26-39` — hardcoded position-distribution table belongs in config; name `POSITION_WEIGHTS` shadows a different constant in `config/playerGeneration.ts`.
- **L5.** `transferMarketGen.ts:73-77` — doc claims interpolation; implementation is clamped lookup with dead `?? 1.0` fallback.
- **L6.** `transferMarketGen.ts:311-312` — legacy listings carried across a season boundary get negative `weeksListed`, lingering on the market most of the new season.
- **L7.** `autoFillContext.ts:86-92` — `hasMatchNextWeek` ignores League Cup ties; congestion rotation doesn't fire ahead of LC matches.
- **L8.** `transferOffers.ts:55-66` — `getMaxFreeAgentOverall`/`calculateSigningBonus` re-implemented inline in `transferSlice.ts:605-611`; drift hazard. Have the slice call the utils.
- **L9.** `autoFillLineup.ts:1031,1154` — backup-GK bench priority requires a natural GK already in XI; injury-ravaged squads can crowd the real GK off the bench.
- **L10.** `scoutingReport.ts:63-65` — keeper assessment uses `gks[0]` (playerIds order), not the starting GK.
- **L11.** `chemistry.ts:49-75` — one adjacent pair can stack all four link types (0.08 of the 0.12 global cap); balance concentration hazard. Nationality strength-1 branch effectively dead.

### Verified clean
`playerEconomics.ts` single-source pricing (no double rarity), `playerRarity.ts`, `facilities.ts`, `merchandise.ts`, `personality.ts`, `formationLines.ts`, `formGuide.ts`, `realPlayerPicker.ts`, `nationality.ts`, `playerDisplay.ts`; contract-expiry semantics consistent everywhere (no off-by-one); `hungarianAssignment` correct incl. degenerate case; no XI/bench duplicates possible from autoFill.

---

## Section 12: Interactive components (negotiations, lineup editor, sub sheet, shootout, brackets, nav, press, perks, sponsors)

**Overall:** Good shape — store actions defensive, `filter(Boolean)` near-universal, modal hygiene mostly present. Serious problems are feature-level dead ends and false feedback, not crashes.

### HIGH
- **H1. Accepting a loan counter-offer always fails (dead-end state machine).** `LoanNegotiation.tsx:91-107` — `handleAcceptCounter` re-calls `requestLoan(...)`, but the persisted counter (`loanSlice.ts:620-634`, `status: 'counter'`) trips `requestLoan`'s dedupe guard (`loanSlice.ts:548-549`) → deterministic "Request Rejected". Revise→Submit hits the same guard. Only escape is Dismiss on TransferPage. **Fix:** dedicated `acceptLoanCounter(requestId)` store action (or have `requestLoan` consume the matching counter).
- **H2. In-match "Optimize Lineup" silently no-ops for non-Pro users, then claims "Lineup already optimal".** `SubstitutionSheet.tsx:316-456` — `autoFillTeam()` returns `{ changes: 0, proRequired: true }` (`clubSlice.ts:51-59`); component never checks `proRequired` → false toast, paywalled feature with no upsell. **Fix:** check `proRequired`; gate behind `isPro` or show ProUpsell like TacticsPage.
- **H3. Substitution confirm shows "Sub made" success even when the sub didn't happen.** `SubstitutionSheet.tsx:182-195` — `makeMatchSub` silently no-ops at max subs / stale out-player / suspended in-player (`matchSlice.ts:191-198`); component unconditionally toasts success, closes, fires `onSubMade?.()`. **Fix:** return boolean from `makeMatchSub`; only toast/close on success; disable flow at 0 remaining.
- **H4. Moving a starter into an empty formation slot silently does nothing.** `LineupEditor.tsx:186-237` — no branch for (lineup → empty slot); fires haptic, calls `updateLineup` with unchanged arrays, clears selection. User cannot fill a hole with a starter. **Fix:** add the missing branch.

### MEDIUM
- **M1. Full bench silently drops the displaced starter to reserves.** `LineupEditor.tsx:236` — reserve swapped into XI → `newSubs` length MAX+1 → `slice(0, MAX_SUBS)` truncates the just-demoted starter with no feedback. **Fix:** toast or evict lowest-rated instead.
- **M2. TransferNegotiation acceptance % computed from hardcoded constants in the component and diverges from real odds.** `TransferNegotiation.tsx:22-27, 99` — re-implements config values as literals; ignores strike penalty (`transferSlice.ts:270-271`) and `transfer_shark` perk. Store already returns true `acceptChance` (`transferSlice.ts:236`), fetched but never displayed. **Fix:** render the store value; delete the local interpolation.
- **M3. Submit gate blocks the Galactico perk's budget headroom.** `TransferNegotiation.tsx:744` — CTA disabled when `budgetAfter < 0`, but the store accepts up to `budget * 1.2` for Galactico (`transferSlice.ts:254-256, 298-300`). Perk benefit dead in the primary buy flow. **Fix:** evaluation returns galactico-aware cap; gate on that.
- **M4. WeeklyDigest writes store state directly via `useGameStore.setState({ weeklyDigest: null })`.** `WeeklyDigest.tsx:84-86` — bypasses slice layer (project rule); also makes the `AnimatePresence mode="wait"` exit animation dead code (`:90, :138`). **Fix:** `dismissWeeklyDigest()` action.
- **M5. SponsorshipPanel "Offer pending — tap to review" on a row that isn't tappable.** `SponsorshipPanel.tsx:228-233` — panel has no onClick; only the small Review button works. **Fix:** add panel onClick.
- **M6. Injured/suspended bench players swappable into XI; GK-less lineup saves without warning.** `LineupEditor.tsx:137-144` — reserves filtered for fitness but `subs` array isn't; `updateLineup` (`clubSlice.ts:36-43`) does zero validation. NEEDS VERIFICATION whether match start auto-repairs; editor-side UX gap regardless. **Fix:** warn on placing unavailable player / missing GK.

### LOW
- **L1.** `PenaltyShootout.tsx:9-38` — duplicate SVG gradient ids per mark; hoist into shared defs / `useId()`.
- **L2.** `SessionRecap.tsx:59-61` — hand-rolled ordinal yields "21th"–"23th"; use existing `getSuffix`.
- **L3.** `PostMatchPopup.tsx:72-81` — ratings filtered twice with identical predicate.
- **L4.** `WeeklyDigest.tsx:96-100, 240-243` — name-keyed grouping + React keys; identical names merge/duplicate keys. Key on playerId.
- **L5.** `SponsorOfferSheet.tsx:73-84` — stepper delta renders "+-2 seasons"; sign-aware prefix/color needed.
- **L6.** `LoanNegotiation.tsx:310-313` — "Option to Buy" toggle described as "Obligatory purchase" (field is `obligatoryBuyFee`); copy wrong.
- **L7.** `SubstitutionSheet.tsx:230` — pitch Y-mapping diverged from LineupEditor's updated constants; same formation looks squashed in-match. Share constants.
- **L8.** Modal hygiene: Transfer/IncomingOffer/Loan/ContractNegotiation lack `useFocusTrap`; WeeklyDigest/SessionRecap lack `useScrollLock` (iOS background scroll).
- **L9.** `NationalTeamOfferModal.tsx:57-62` — icon-only close, no aria-label, ~20px target.
- **L10.** `OnboardingChecklist.tsx:268-304` — `<button>` direct children of `<ul>`; wrap in `<li>`.
- **L11.** `TopBar.tsx:20-30` / `MoreDrawer.tsx:124-133` — always-mounted nav subscribes to whole `clubs` record (756) + `fixtures`; re-renders on any mutation. Narrow selectors / memoized derivations.
- **L12.** `GroupTable.tsx:118, 133, 184` — hardcoded 4-team-group assumptions; derive from `standings.length`.
- **L13.** `ContractNegotiation.tsx:59, 360-363` — `gap = currentWage / demandedWage` unguarded → "Infinity% of demand" (slider block guards it; readout doesn't).
- **L14.** `TalentTree.tsx:322-335` — `drag="y"` on an `overflow-y-auto` sheet; drag vs native scroll conflict. NEEDS on-device VERIFICATION.

### Verified clean
Double-submit guards in ContractNegotiation/BoardPitch/PressConference/TalentTree/PostMatchPopup-rewind; `executeTransfer`/`acceptIncomingOfferAtFee` re-validate budget/window/squad-size before money moves; TransferApproach synthetic listing mirrors store premium exactly.

---

## Section 4: Feature slices + store helpers (systems, feature, sponsor, merchandise, monetization, nationalTeam, career, packs slices; persistence, idbStorage, matchProcessing, development, rosterOps)

**Overall:** Monetization core invariants hold where they matter most; persistence layer well-designed; `rosterOps.ts` clean. Real problems: a consumable-SKU entitlement leak through restore, a return-shape mismatch writing `undefined` into persisted state, and career-mode state leaks when changing clubs.

### HIGH
- **H1. Consumable pack SKUs persisted into `monetization.entitlements` via restore/sync.** `monetizationSlice.ts:14-67` — neither `grantEntitlement` nor `restoreEntitlements` filters product IDs; packs are `type: 'one_time'` (`config/monetization.ts:100-127`) and `purchases.ts:292-298` includes every non-subscription product from `allPurchasedProductIdentifiers` (records consumables forever). `GameShell.tsx:199-212` restores on every load → any past pack buyer permanently carries the SKU in entitlements. Violates the stated invariant; not yet a free-pack faucet (packsSlice requires live `purchaseConsumable`), but `hasProduct()`/`getPurchaseCount()` are polluted and any future entitlement check on pack SKUs = instant infinite-pack revenue bug. Also `SubscribeOnboarding.tsx:152` grants sub SKUs into entitlements. **Fix:** filter consumable + subscription IDs in both slice actions — make the slice the defense-in-depth boundary.
- **H2. `processMatchResult` early-return shapes omit `xpGain`/`updatedRivalries`/`leaguePosition` → `undefined` written into persisted state.** `matchProcessing.ts:46-61, 120`; callers at `matchActions.ts:675-1606` write `rivalries: processed.updatedRivalries` unconditionally → persisted `rivalries` becomes `undefined` when the guard fires (reachable today via virtual continental/friendly opponents). Also `applyDoubleXP` (`monetizationSlice.ts:234-241`): `undefined <= 0` is false → `grantXP(prog, undefined)` → `xp: NaN` in `managerProgression` (`managerPerks.ts:108-117`), freezing level-ups (dormant while ads off). **Fix:** return complete shapes (`xpGain: 0`, `updatedRivalries: state.rivalries || {}`); harden `applyDoubleXP` with `Number.isFinite`.
- **H3. Same-league job moves carry old club's sponsor deals, facilities, youth academy, merchandise, finance history.** `careerSlice.ts:354-460` — same-league branch of `moveToNewClub` resets transfers/scouting/staff/training/board but not `sponsorDeals`/`sponsorOffers`/`merchandise`/`facilities`/`youthAcademy`/`financeHistory`/`tacticalPresets` (different-league branch clean only because `initGame` rebuilds, `initGame.ts:484-546`). Old sponsors keep paying the new club; maxed facilities transfer to a minnow; old academy prospects promotable into the new club. **Fix:** reset all of it from the new club's data in the same-league branch.

### MEDIUM
- **M1. Season counter can regress when an unemployed manager takes a different-league job.** `careerSlice.ts:464-465` — `continuedSeason = (lastEntry?.endSeason || 0) + 1`, but seasons keep advancing during unemployment; manager who left in S3 and signs in S5 gets `season: 4` — game clock moves backwards, corrupting history ordering, contract endSeasons, Hall records. **Fix:** `Math.max(lastEntry.endSeason + 1, state.season)`.
- **M2. Player development has no hard potential ceiling.** `development.ts:28-48` — growth chance positive even at `potentialGap ≤ 0`; only brake is `MAX_SEASON_GROWTH = 12`/season; high-minutes youngsters overshoot potential by up to ~12 OVR/season until 24. (Pairs with Section 7 H3 — training has the same gap.) **Fix:** zero growth chance at `overall >= potential`.
- **M3. Uncapped narrative morale-loss reduction can invert defeat penalties.** `matchProcessing.ts:123-132, 149-151` — reduction summed across all 11 (Veteran Leader +2 / One-Club Man +1 each) added raw to −10; 5–6 tagged players → losses morale-neutral or positive. Win side capped at +5; loss side uncapped — asymmetry bug. **Fix:** cap at ~6.
- **M4. Hydration can clobber a newer in-session save.** `persistence.ts:72-100` — `hydrateOneSlot` unconditionally assigns IDB data over `memSlots[slot]`; a `writeSaveSlot` racing the async hydrate gets overwritten with stale disk data, then rotated into the backup slot — both recovery layers burned. **Fix:** skip assignment when `memSlots[slot] !== null`.
- **M5. `loadTacticalPreset` changes formation without rebuilding the lineup.** `systemsSlice.ts:54-64` vs canonical `clubSlice.setFormation` (re-runs `selectBestLineup`). Loading 3-5-2 over a 4-4-2 lineup maps the same 11 IDs onto wrong slots → out-of-position penalties silently degrading results. **Fix:** re-run `selectBestLineup` when formation differs.
- **M6. Quick-sell + free-agent re-sign value loop.** `packsSlice.ts:618-744` (esp. `:727`) — quick-sell credits 65% of value AND pushes player into `freeAgents`; `signFreeAgent` charges only a signing bonus → sell £15M pull for £9.75M, re-sign for a fraction, keep both. Partially mitigated by free-agent OVR rep cap. **Fix:** don't add quick-sold players to freeAgents (or re-sign cooldown).
- **M7. `undoLastQuickSell` can silently revert unrelated actions.** `packsSlice.ts:694-763` — restores 17 state slices wholesale guarded only by week/season + player-still-free-agent; intervening actions (release, offers) get reverted while `seasonTotalExpenses` keeps their charges. **Fix:** invalidate snapshot on any other roster-mutating action (as `openPack` already does).
- **M8. Contract acceptance can drive budget negative with no check.** `featureSlice.ts:490-495` — `budget -= agentFee + loyaltyBonus` with no affordability guard (siblings `renewStaffContract`/`terminateSponsorDeal` refuse when unaffordable). **Fix:** pre-check and surface "can't afford agent fee".

### LOW
- **L1.** Hardcoded balance values in slices: `featureSlice.ts:260` (1.5× saga fee), `:340-341` (wageSplit 50), `:547` (morale −8), `:187-188`; `systemsSlice.ts:18-19` (spotlight constants, duplicated as raw `2` in `seasonEnd.ts:1215` — drift hazard); `packsSlice.ts:637` (0.65 quick-sell), `:319` (200-record cap). Move to config.
- **L2.** `dailyPackOpens` device-local date (`packsSlice.ts:53-59`) — clock-forward re-grants daily packs; free tier only.
- **L3.** Dead `currency` purchase path (`packsSlice.ts:88-90, 141-144, 259, 280-281`) — every tier `price: 0`; branch unreachable. Wire or delete.
- **L4.** `openPack` overwrites `lastMatchXPGain` with pack XP (`packsSlice.ts:481`) — double-XP ad reward would double pack XP instead of the match. Dormant; separate the field before ads re-enable.
- **L5.** `quickSellPackedPlayer` doesn't bump `managerStats.totalEarned` (`packsSlice.ts:723-737`) — career earnings under-report.
- **L6.** `replaceInjuredInternationalPlayer` lacks existence/uniqueness validation (`nationalTeamSlice.ts:231-242`) — duplicate ID can enter squad/lineup.
- **L7.** `markCoachTaskComplete` hardcodes `length === 7` (`featureSlice.ts:151`) — drift hazard with `COACH_TASK_XP`.
- **L8.** `generateStarterOffers` doc/code drift (`sponsorSlice.ts:420-447`) — comment says 2× expiry, code does +3.
- **L9.** Saga sale buyer pays nothing (`featureSlice.ts:270-287`) — fee credited to seller, never debited from AI buyer; money created.
- **L10.** `resignFromClub` leaves departed club without `aiManagerProfile` (`careerSlice.ts:300-352`) — club sims managerless until season end.
- **L11.** Duplicate raw key literals (`persistence.ts:387, 585`) — reference `STORAGE_KEYS` registry.
- **L12.** IDB handle permanently dead after `versionchange`/`blocked` (`idbStorage.ts:41-45`) — `dbPromise` caches closed handle; all IDB ops silently no-op for the session. Reset `dbPromise = null` in `onversionchange`.
- **L13.** `deleteAllDynastyData` IDB wipe fire-and-forget (`persistence.ts:610-615`) — race with post-deletion writes. Await it in the Apple deletion flow.
- **L14.** `promoteYouth` missing club guard (`systemsSlice.ts:327-328`) — `{...undefined}` → `.playerIds.length` throws. Every sibling guards; add it.
- **L15.** Shared default-state references (`monetizationSlice.ts:11`) — shallow copy of `DEFAULT_MONETIZATION_STATE` aliases nested arrays; one accidental push corrupts the module default. Also `adRewardsClaimed` keys accumulate forever (unbounded save growth).
- **L16.** `startChallenge`/`moveToNewClub` treat `initGame` as synchronous (`featureSlice.ts:660-698`, `careerSlice.ts:470-479`) — if Community Pack threading reaches these paths, post-init reads run against pre-init state. Convert to async when CP lands.

### Verified clean
`isPro()`/trial-restart guards confirmed; pity logic coherent and fully migrated; sponsor week/season processing avoids stale-match double-count; `writeSaveSlot` ordering correct (memory → IDB → best-effort LS); `rosterOps.ts` solid (detach-before-place, comprehensive reference purge).

---

## Section 3: Core slices (gameStore, storeTypes, core/club/transfer/loan/match/cup slices)

**Overall:** Transfer/sale money math solid; Zustand spread discipline excellent (no mutation bugs). The systemic weakness is the **loan system's interaction with everything else**, plus a fully dead buy action stranding a purchasable perk.

### CRITICAL
- **C1. Loans that outlive the season silently become free permanent transfers.** `loanSlice.ts:271-278` (`processLoanReturns`) only returns loans where `elapsed >= durationWeeks`; season-end caller (`seasonEnd.ts:500`) then wipes `activeLoans: []` (`seasonEnd.ts:1301`) and the aging loop resets `onLoan: false` while keeping `clubId` = borrower (`seasonEnd.ts:583`). `LOAN_REQUEST_MAX_DURATION = 46` (`config/transfers.ts:134`) means any loan started after week 1 can cross season end. Both directions: your player loaned out in the winter window is **permanently lost for zero fee with zero notification**; conversely borrow any 90-OVR star on a cheap long loan and own them free at season end — exploitable asset dupe. **Fix:** `processLoanReturns(forceAll)` called by season end before clearing `activeLoans`.

### HIGH
- **H1. Loan counter-offer acceptance always fails** (store side of Section 12 H1). `loanSlice.ts:548-549` dedupe guard blocks the re-request that `LoanNegotiation.tsx:99` makes to accept; no `acceptLoanCounter` action exists and accepted path never clears the counter record. Counter branch functionally dead. **Fix:** treat a matching/better re-request as deterministic acceptance and clear the record.
- **H2. Buying a player who is on loan: fee paid, player later confiscated.** `transferSlice.ts:290-408` — no buy path checks `player.onLoan`, and `updatedPlayer` doesn't clear loan fields or purge `activeLoans`. Reachable: AI lists X → user requests loan (no `listedForSale` gate) → accepted path doesn't remove the market listing → user buys X at full price → X arrives `onLoan: true`, wageBill double-counts, and when the stale LoanDeal expires X is handed back to `loan.fromClubId` — **fee paid, player lost**. **Fix:** reject `executeTransfer` when `onLoan` (mirror `executeSale`'s guard at `transferSlice.ts:81`); accepted loan path filters `transferMarket`.
- **H3. Deadline Dealer perk + career negotiation buy-discount are dead code.** `transferSlice.ts:410-427` — `makeOffer` is the only place applying `careerFeeDiscount` and `deadlineDealerMult`, but it has zero callers outside tests; live UI uses `makeOfferWithNegotiation` (applies only `transfer_shark`). Players pay 400 XP for a tier-3 perk with no effect. **Fix:** move both terms into `makeOfferWithNegotiation`'s effective asking price; delete `makeOffer`.

### MEDIUM
- **M1. `rewindMatch` restores only a partial snapshot.** `matchSlice.ts:46-64` — restores fixtures/tables/players/boardConfidence but not `managerStats`, `managerProgression`, `careerTimeline`, `rivalries`, `pairFamiliarity`, `clubPowerRankings`, `sessionStats`, `messages`, `pendingPressConference` (all written by `playCurrentMatch`, `matchActions.ts:789-807`); stale `matchShouts` carry into the replay; mid-match subs persist (clubs not snapshotted). Replay double-counts everything. **Fix:** extend the snapshot + reset match-scoped fields.
- **M2. `recallLoan`/`terminateLoan`/`buyLoanedPlayer` crash on loans referencing deleted clubs.** `loanSlice.ts:138-139, 393, 447-448` — `{...state.clubs[id]}` with no existence check → `{}.playerIds.length` throws. Clubs are deleted (`seasonEnd.ts:310`, `promotionRelegation.ts:230/299`); `processLoanReturns` guards this exact case. **Fix:** bail + drop the loan when either club id is missing.
- **M3. Loan-in paths bypass challenge restrictions and squad caps.** `loanSlice.ts:527-610, 183-262` — `requestLoan` has no `checkChallengeBlock` (defeats `noTransfers`/`youthOnly` challenges) and no `MAX_SQUAD_SIZE` check; `respondToLoanOffer` accept path lacks the `MIN_SQUAD_SIZE` guard `loanOut` has. **Fix:** add all three guards.
- **M4. `executeSale` merch-dip update resurrects a purged signature drop.** `transferSlice.ts:143-146, 155-164` — `merchDipUpdate.merchandise` built from original state and spread after `...purged`, overwriting the null; selling your signature-drop star leaves an active drop referencing a departed player. **Fix:** build from `purged.merchandise ?? state.merchandise`.
- **M5. `processLoanReturns` orphans players instead of free-agenting them.** `loanSlice.ts:298-300, 339-341` — missing-club branch sets `clubId: ''` but never appends to `freeAgents`; player becomes invisible/unsignable forever. Inner re-check at `:337-342` is dead code. **Fix:** collect orphans into `freeAgents`; delete dead lines.
- **M6. `selectPlayer`/`selectClub` never update `previousScreen`, breaking back navigation.** `coreSlice.ts:90-101` — `TopBar.tsx:76`/`PlayerDetail.tsx:159` special-case `previousScreen === 'team-detail'`, a value that can never occur. League → club → player → Back lands on Squad. **Fix:** record `previousScreen` in both actions.
- **M7. `listPlayerForSale` allows duplicate listings and listing loaned-in players.** `transferSlice.ts:429-468` — no already-listed guard (doubles AI offer generation); loaned-in players pass the ownership check, producing dead-end offers bounced by `executeSale`. **Fix:** early-return on `listedForSale || already-in-market || onLoan`.

### LOW
- **L1.** Dead state `trainingFocus`/`setTrainingFocus` (`clubSlice.ts:16,91`, `storeTypes.ts:40,259`) — no callers; yet `Dashboard.tsx:1266` renders it (permanently 'fitness'), lying whenever the real schedule differs. Remove; derive from `training.schedule`.
- **L2.** Hardcoded balance values: `transferSlice.ts:421-422` (career discount 0.005, deadline 0.8, window weeks 8/24), `loanSlice.ts:389` (1.2 vs config), `loanSlice.ts:514-520` (evaluateLoanRequest thresholds), `coreSlice.ts:31` (46), `matchSlice.ts:213` (45).
- **L3.** `evaluateOffer` UI preview ignores `transfer_shark` discount and the `isExternalPlayer` sell-on exclusion (`transferSlice.ts:227-244` vs `:266, :341`) — preview disagrees with the real roll.
- **L4.** Substituted players can re-enter the match (`matchSlice.ts:200` appends `outId` back to subs; nothing tracks subbed-off) — illegal sub possible. Track `subbedOffIds`.
- **L5.** Cross-season loan elapsed math uses global `TOTAL_WEEKS` (`loanSlice.ts:132,272`) — moot until C1 is fixed by carryover; then off-by-up-to-8-weeks.
- **L6.** `updateLineup` accepts arbitrary IDs without validation (`clubSlice.ts:36-43`); also `autoFillTeam`'s `state.week !== undefined` always true (dead condition, `clubSlice.ts:77`).

### Verified clean
`gameStore.ts` composition (no duplicate keys); `cupSlice.ts` state-only as documented; `storeTypes.ts` — every declared field initialized in exactly one slice; only dead declarations are the ones flagged above.

---

## Section 9: Core gameplay pages (Dashboard, MatchDay, MatchPrep, MatchReview, GameShell, SquadPage, TacticsPage, PlayerDetail, ComparisonPage, TrainingPage, StaffPage)

**Overall:** Good shape for a 9.5K-LOC UI layer — selector discipline, timer cleanup, `filter(Boolean)` hygiene consistently applied; match ticker carefully optimized. Serious problems concentrate in cross-cutting flows.

### HIGH
- **H1. Stoppage-time events never render in MatchDay; on-screen final score can be wrong.** `MatchDay.tsx:421-439` — ticker caps at `maxMin` 45/90/120 and transitions phase without flushing remaining events, but the engine records minutes past nominal end (`engine/match.ts:936, 1242, 1655`). A 90+2' winner never appears; `liveStats`/ScoreHeader under-count; at phase `'post'` the header contradicts PostMatchPopup. Same for HT recap and ET. **Fix:** flush all remaining events on the final tick (or clamp engine event minutes).
- **H2. Locked-speed upsell tap at half-time abandons the match in progress.** `MatchDay.tsx:1070-1075, 1197-1202` — `onLockedSelect={() => setScreen('shop')}` unmounts MatchDay; cleanup wipes `halfTimeState` (`orchestrationSlice.ts:961-1011`) — the entire played half is discarded. Defeats the navigation lock everything else honors. **Fix:** inline ProUpsell at HT/ET instead of navigation.
- **H3. "Skip to Next Match" has no in-flight guard — concurrent `advanceWeek` double-processing.** `Dashboard.tsx:1068-1082` — handler never sets `isAdvancing`; `advanceToNextMatch` is an async loop of up to 5 awaited `advanceWeek()` calls with no re-entrancy guard. Double-tap or tapping main Advance during the loop = the exact stale-`get()` race the code comment warns about (double income/training). **Fix:** set/clear `isAdvancing` like the main button + store-level in-flight flag.
- **H4. Penalty-shootout wins display as "DRAW" in MatchReview.** `MatchReview.tsx:168-170, 233, 840-849` — won/drew/lost computed purely from goals; `match.penaltyShootout` (stored at `matchActions.ts:1561,1599`) never read. A cup final won on pens shows amber "DRAW" + "board expects improvement" copy; `'penalty_shootout'` also missing from `HIGHLIGHT_TYPES`. **Fix:** derive result from shootout score when present.

### MEDIUM
- **M1. Persisted Pro match speed not clamped for non-Pro users.** `MatchDay.tsx:146` — lapsed subscriber with saved Turbo/Instant gets Pro-speed playback until touching the control. **Fix:** clamp initial state via `isPro`.
- **M2. Virtual-club opponents render degraded/false data in MatchPrep.** `MatchPrep.tsx:72-77, 123-124, 136-139, 173` — "0 OVR vs 0 OVR / Even Match", empty Key Threats, blank formation, foreign opponent shown bottom of your league table. **Fix:** detect virtual opponents and hide/replace widgets.
- **M3. "Negotiate Renewal" silently does nothing when negotiations locked.** `PlayerDetail.tsx:966-977` — result discarded; SquadPage handles the same action with an error toast (`SquadPage.tsx:187-194`). **Fix:** reuse that pattern.
- **M4. One `showAllDev` state drives two unrelated collapsibles.** `TrainingPage.tsx:65, 189, 196, 651, 693`. **Fix:** split the state.

### LOW
- **L1.** `MatchDay.tsx:474-477` eslint-disable verified SAFE (with the caveat nothing else may write `settings.matchSpeed` mid-match).
- **L2.** `resumeExtraTime`/`handlePenalties` lack the `resumingRef` double-tap guard `resumeSecondHalf` has (`MatchDay.tsx:276-290`) — double-fire re-simulates ET / re-rolls shootout.
- **L3.** `FormationPicker` declared inside component body (`MatchDay.tsx:708-726`) — remount trap.
- **L4.** `Dashboard.tsx:1047-1062` — `.finally()` chain rejects unhandled → duplicate Sentry noise on failed advance.
- **L5.** `Dashboard.tsx:652` — `lineupIncomplete` counts dangling IDs while MatchDay's gate counts resolvable players; attention dot can claim a complete XI MatchDay rejects. Use `filter(id => !!players[id])`.
- **L6.** `Dashboard.tsx:462-471` — achievement progress reads `getState()` during render, stale until next advance (deliberate per comment; noting).
- **L7.** `StaffPage.tsx:179` — hardcoded `6` duplicates `STAFF_MARKET_REFRESH_COOLDOWN` (slice uses the constant); desync hazard.
- **L8.** `TrainingPage.tsx:571-572` — `squadPlayers.sort(...)` mutates the memoized array during render.
- **L9.** `ComparisonPage.tsx:16-17` — stale selected-player IDs after a sale → chart vanishes with no explanation.
- **L10.** `GameShell.tsx:288-291` — scroll restoration clamped by Suspense fallback on cold chunk load; re-apply after resolve.
- **L11.** `MatchReview.tsx:866` — non-reactive `getState().preMatchLeaguePosition` read during render.
- **L12.** `PlayerDetail.tsx:921` — injury return week clamped to `totalWeeks`; show "next season" instead.

### Extraction candidates
Dashboard (2,192 LOC): celebrations/achievement queue → `useDashboardCelebrations`; Coach Checklist, Monthly Objectives, Achievements-in-progress, competition status → components; unify duplicate fixture scans; drop one of the two redundant "Last Result" cards. MatchDay: extract `TeamTalkPanel` (~60 lines duplicated at HT/ET). MatchReview: Key Highlights IIFE (~220 lines) → component.

### Verified safe
Match ticker lifecycle/timer cleanup; double-submit of match results (multiple guards); navigation lock (except H2); substitution gating consistent with store; all pages use `useShallow`/primitive selectors.

---

