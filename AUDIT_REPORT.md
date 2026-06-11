# Dynasty Manager — Full Codebase Audit

> Generated 2026-06-10 against app v1.0.13 / save schema v71.
> Method: 14 section audits covering all hand-written source (~139K LOC), each verified against surrounding code; one CRITICAL was empirically reproduced against the real store.
> Severity: **CRITICAL** = crash / save corruption / revenue loss / core content unreachable · **HIGH** = broken feature / wrong sim results · **MEDIUM** = edge-case bug / UX defect · **LOW** = quality / improvement.
> Totals: **~295 findings — 4 CRITICAL · 44 HIGH · 92 MEDIUM · ~155 LOW.**

---

# Executive Summary

> **Status update (Waves 1 + 2 complete on this branch):** All four CRITICALs are
> fixed — C1 competition-calendar scaling (`getCompetitionCalendar` +
> continental catch-up recovery + odd-team fixture span + scaled transfer
> windows), C2 double season-end (`runPostSeasonTail`), C3 loan returns
> forced at season end, C4 crash-durable pack credits. Also fixed: the
> purchases.ts trio (cancel-vs-charged, kill-switch grants, test API key +
> Android workflow), entitlement filtering (S4-H1/S8-M1/M3), season-end
> message wipe (S2-H2), prize-table misallocation (S2-H5), skip-to-next-match
> continental hang + week-advance re-entrancy (S1-H3/S9-H3), Conference Cup
> mislabel in weekAdvance (S1-M1).
>
> **Wave 2 (match correctness):** all five S5 engine HIGHs — penalty awarded
> against the fouling side (S5-H5), red-card/injury disadvantage carried
> across half-time/ET (S5-H1), relative injury band (S5-H2), `subbedOut`
> persisted on HalfState so AI subs can't resurrect in ET (S5-H4, save
> schema → v72), assists filtered to available players (S5-H3) — plus the
> inverted season-1 defense boost (S5-M1). Shootout results now classify as
> wins/losses with real drawn scorelines (S2-M3 — including a previously
> unknown bug: instant-sim cup ties decided on penalties were never recorded
> at all), interactive continental group/leg-1 draws no longer go to ET
> (S2-H1), chemistry survives season end (S2-H3 UUID key parsing), the
> League Cup runs a real power-of-two bracket with a contested final
> (S2-H4), continental coefficients decay for non-participants (S6-H3), and
> development + training stop at the potential ceiling (S4-M2/S7-H3).
> New suites: `competitionCalendar.test.ts`, `leagueCupBracket.test.ts`.
>
> **Wave 3 (player-facing truth + dead content):** stoppage-time events now
> render and the half-time/ET locked-speed tap no longer abandons the match
> (S9-H1/H2, plus the persisted-Pro-speed clamp S9-M1); shootout results
> display as VICTORY/DEFEAT ON PENALTIES in MatchReview (S9-H4); FlagIcon's
> imperative DOM fallback replaced with declarative state (S13-H1);
> Fortress/Invincible Run/World Beater achievements are obtainable (S6-H1/H2,
> `won` flag on NT knockout results under v72) and the fortress/goal-machine/
> promotion-express challenges finally receive their extraData (S14-H2);
> the three Formation Master formations have engine identity (S5-M10), AI
> reactive tactics actually fire (S5-M2), Deadline Dealer + career
> negotiation discount apply on the live offer path with makeOffer deleted
> (S3-H3), and in-match Optimize Lineup surfaces its Pro gate instead of a
> false "already optimal" toast (S12-H2).
>
> Remaining open items continue below — largely MEDIUM/LOW: UI drift
> (finance breakdown S7-H1/H2 is the biggest open HIGH), loan flow dead
> ends (S3-H1/H2, S12-H1), national-squad picker deadlock (S11-H2), trial
> messaging (S11-H1), and the wide LOW backlog.

## The four CRITICALs

1. **The competition calendar is hardcoded to a 46-week season; 40 of 45 leagues are shorter — cup finals and continental knockouts silently never happen.** (Section 14) `CUP_WEEKS` (R1=4 … F=43, `data/cup.ts:15-23`) and continental weeks (`config/continental.ts:62-78`) are fixed, while `state.totalWeeks` is per-league (18–58). The Dashboard force-ends the season at `week > totalWeeks` and `endSeasonImpl` never resolves pending ties. Premier League (38 wks): cup SF plays, the final never; continental runs strand at the QF (leg 2 = week 39) and the tournament hangs with `winnerId: null`. In 18-week leagues not a single cup match is ever played and the winter transfer window never opens. Downstream: both Super Cups never created, cup-winner qualification paths never fire, Ballon d'Or cup bonuses dead, 2 challenges unwinnable outside 5 leagues. **Fix:** scale competition weeks to `totalWeeks` at draw time, or keep ticking weeks past the last fixture until live competitions resolve.

2. **Completing an international tournament ends the brand-new season instantly — empirically reproduced.** (Section 2) `finalizeSeason` rolls the season, then runs the tournament; on completion `advanceInternationalWeekImpl` calls `endSeasonImpl` *again* on the fresh season. Reproduced: season 1 + World Cup → `season=3`, phantom history entry with 0 played, double aging, double contract decrement, promotion/relegation decided off an all-zero table. Affects every save where the manager holds a national-team job.

3. **Loans that outlive the season silently become free permanent transfers.** (Section 3) Season end wipes `activeLoans` without returning unexpired loans; the borrower keeps the player. Your star loaned out in the winter window is permanently lost for £0 — or exploit it: borrow a 90-OVR on a long loan and own him free at season end. Compounded by Section 2-H2 (the season-end messages that might have surfaced it are also being deleted).

4. **Paid consumable pack purchases are not crash-durable.** (Sections 11 + 8) No persisted pending-credit record exists between the StoreKit charge and the in-memory grant, and packs never appear in RevenueCat entitlements — app death in that window (or before the next autosave, which only fires on `advanceWeek`) loses real money with no recovery or reconciliation path.

## Highest-impact HIGHs (fix-first shortlist)

- **Revenue/IAP:** Android CI builds shipped a hardcoded RevenueCat *test* key (✅ **fixed on this branch** — per-platform keys, loud failure; you still must add the `goog_` key as the `VITE_REVENUECAT_API_KEY_ANDROID` secret). Cancel-vs-charged ambiguity in `purchaseProduct` tells charged subscribers "No charge was made" (S8-H1). The `NATIVE_MONETIZATION_READY` kill-switch would turn purchases into free permanent grants if ever flipped (S8-H3). Consumable + subscription SKUs leak into persisted `entitlements` via restore (S4-H1) — not yet exploitable, one refactor away. Trial copy shown to trial-ineligible users with a false "Trial Started!" toast — Apple 3.1.2(c) exposure (S11-H1).
- **Match engine correctness:** penalties awarded to the fouling team (S5-H5); red-card strength penalty resets at half-time/ET (S5-H1); non-foul injuries mathematically impossible in derbies/bad weather (S5-H2); AI subbed-off players resurrect in extra time (S5-H4); assists credited to sent-off players (S5-H3).
- **Season end:** all season-end inbox messages wiped every season (S2-H2); chemistry pair-familiarity wiped every season by a UUID-parsing bug (S2-H3); League Cup bracket degenerates into byes — final never played, prize money skipped (S2-H4); season prize money distributed against the wrong tables — promoted champions get ~2% instead of 30% (S2-H5).
- **Tournament hangs (besides the calendar):** interactive continental group/leg-1 draws incorrectly go to ET, and a group shootout strands the match → tournament freezes (S2-H1); "Skip to Next Match" ignores continental fixtures and can skip-and-hang the group stage (S1-H3); plus no in-flight guard → double `advanceWeek` processing (S9-H3).
- **Match UX lying to the player:** stoppage-time events (e.g. a 90+2' winner) never render and the on-screen score can be wrong (S9-H1); cup finals won on penalties display as "DRAW" with "board expects improvement" copy (S9-H4); half-time upsell tap silently abandons the half played so far (S9-H2).
- **Dead paid/progression features:** Deadline Dealer perk + career negotiation discount apply only in a function with zero live callers (S3-H3); the 3 perk-unlocked formations have no engine identity (S5-M10); AI reactive tactics dead on every path (S5-M2); in-match Optimize Lineup silently no-ops for free users with a false "already optimal" toast (S12-H2).
- **Unobtainable content:** Fortress, Invincible Run, World Beater achievements (S6-H1/H2); 'fortress', 'goal-machine', 'promotion-express' challenges never receive the data they check (S14-H2); 'Great Escape' is broken in both directions (S14-M1).
- **Stability:** FlagIcon's imperative DOM fallback arms a `removeChild` crash on every flag when offline (S13-H1); odd-team leagues (aus/tur) lose their last two rounds beyond `totalWeeks` (S14-H1); loan buy/list/counter flows have dead ends and a fee-paid-player-confiscated path (S3-H1/H2, S12-H1).
- **Economy drift:** finance breakdown UI disagrees with actually-paid prize money by up to ~20× in lower tiers and double-counts merch costs (S7-H1/H2); training has no potential ceiling — +12 OVR/season forever (S7-H3 + S4-M2); continental coefficients never decay for non-participants (S6-H3).

## Cross-cutting themes

1. **Fixed-week constants vs per-league `totalWeeks`** — the calendar CRITICAL plus windows, board reviews, international breaks, vacancy expiry, storyline triggers (S14-M4, S6-L8). One conversion layer (`scaleWeek(totalWeeks)`) fixes a dozen findings.
2. **Instant-sim vs interactive match paths diverge** — ET exemptions, shootout classification, prize hooks (S2-H1/M3, S9-H4). Unify result processing through one function that takes `penaltyShootout` into account.
3. **Index-aligned APIs broken by `filter(Boolean)`** — chemistry links and squad insights mis-attribute every player after a stale ID (S7-M2/M3); `autoFillLineup` already documents the workaround.
4. **UI re-implementing store math** — acceptance odds, loan buy fees, prize lines, staff cooldowns, training previews all drift from the authoritative calculation (S12-M2, S10-M6, S7-H1/M5, S9-L7). Export the store/util function and render its output.
5. **Entitlement hygiene** — `isPro()` discipline holds everywhere today, but consumable/sub SKUs leaking into `entitlements` and the kill-switch mock are one change away from revenue bugs. Make the slice filter what it persists (defense-in-depth).
6. **State leakage across lifecycles** — new game/reset/prestige/same-league job moves carry NT state, perk flags, sponsors, facilities, finance history (S2-M2, S1-H4, S4-H3).
7. **Hardcoded balance values** in slices/engine/utils despite the config rule (~20 findings) — sweep them into `src/config/`.
8. **Silent no-op handlers** — actions that fail without feedback (sub confirm, renewals, scout assign, job accept at retirement age) erode trust; make slice actions return results and toast failures.

## Suggested fix order

- **Wave 1 (data integrity + revenue):** C1 calendar scaling · C2 double season-end · C3 loan returns · C4 pending-credit persistence + the purchases.ts trio (H1/H3/M1/M3) · S2-H2 message wipe · S2-H5 prize tables · S1-H3/S9-H3 skip guards.
- **Wave 2 (sim correctness):** S5 engine fixes (penalty side, red-card strengths, injury band, ET resurrection, assists) · S2-H3 chemistry wipe · S2-H4 League Cup bracket · S6-H3 coefficients · training/development potential cap.
- **Wave 3 (player-facing truth):** S9-H1/H4/H2 MatchDay/Review fixes · shootout classification (S2-M3) · S13-H1 FlagIcon · unobtainable achievements/challenges · dead perks/formations/reactive AI.
- **Wave 4:** the MEDIUM/LOW backlog — UI drift, dead code deletion, a11y, perf nits, config sweeps.

A regression-test note: the calendar bug survived because `seasonCupProgression.test.ts` checks bracket shape only, and the longevity tests run a 46-week league. Add one short-league (18/22-week) longevity test and one NT-job season-rollover test — those two alone would have caught both CRITICALs 1 and 2.

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

## Section 13: Display components + pack-opening UI (pack/, icons/, error boundaries, SaveRecoveryDialog, AnalyticsConsentModal, ~50 display components)

**Overall:** Good shape — the pack-opening flow is crash-safe by design (players persisted in `openPack` before the overlay mounts; skip/double-complete guarded; reduced-motion paths terminate). Issues: one real crash vector (FlagIcon), a paid-flow modal violating its own dismissal contract, a silently dead feature prop, and animation-hygiene/a11y nits.

### HIGH
- **H1. FlagIcon error fallback mutates React-managed DOM → unmount crash on offline/CDN failure.** `FlagIcon.tsx:44-50, 67-74` — `onError` does `e.target.replaceWith(...)` with a hand-created node; React later calls `removeChild` on a node that's no longer a child → `NotFoundError`. FlagIcon renders on every PlayerCard/CommentaryRow and loads from flagcdn.com — **airplane mode arms hundreds of these**; next navigation away from squad/match trips an error boundary. **Fix:** declarative error state (`useState` + fallback render), exactly like `PackArt.tsx` already does.

### MEDIUM
- **M1. PurchaseModal dismissable mid-purchase via backdrop tap and X button**, contradicting its own "loading blocks dismissal" contract (`PurchaseModal.tsx:57, 78-85` — Escape and Cancel do respect it). No revenue lost (completion still restores entitlements; double-purchase blocked), but the modal vanishes mid-StoreKit-transaction with a surprise toast later. **Fix:** gate backdrop/X on `!loading`.
- **M2. `placement` prop plumbed into PackOpeningOverlay but never used** — slice computes starter/bench/squad placement on every open (`packsSlice.ts:485-501`), page passes it (`PacksPage.tsx:662`), overlay destructure omits it (`PackOpeningOverlay.tsx:86`). Documented badge feature silently missing. **Fix:** render the placement chip or delete the plumbing.
- **M3. WalkoutStadium camera flashes re-roll `Math.random()` on every typewriter keystroke** (`WalkoutStadium.tsx:105-127`; re-renders every ~45ms during name typing) — 16 infinite framer animations restarted dozens of times/sec during the flagship paid cinematic. **Fix:** `useMemo` the specs + `memo()` the component (pattern exists in `ParticleDrift`).
- **M4. FinanceBreakdownSheet runs the full finance breakdown on every Dashboard render even while closed** (`FinanceBreakdownSheet.tsx:17-54`, permanently mounted at `Dashboard.tsx:2187`). **Fix:** `if (!open) return null` before computing.
- **M5. PackStadium motes + overlay charge particles re-roll randoms per re-render** (`PackStadium.tsx:115-130`, `PackOpeningOverlay.tsx:891-914, 966-990`) — particles teleport mid-flight on every card-reveal tap; the file documents the correct `useMemo` pattern for `foilShreds`. **Fix:** memoize.

### LOW
- **L1.** `AttributePill` RAF cleanup dead code (`WalkoutReveal.tsx:182-203`) — `cancelAnimationFrame` returned from the setTimeout callback where it's discarded.
- **L2.** `PageErrorBoundary` retry counter never resets; raw `error.message` shown in production (`PageErrorBoundary.tsx:27-35, 44`; root boundary correctly DEV-gates it).
- **L3.** `game/ErrorBoundary.tsx:51-55` also shows raw `error.message` in production.
- **L4.** `PackArt` error state never resets on `src` change (`PackArt.tsx:27-28`) — latent footgun.
- **L5.** Pack reveal screen-reader announcer picks highest-index revealed, not most recent (`PackOpeningOverlay.tsx:389-397`) — out-of-order reveals never announced.
- **L6.** `ReputationBadge.tsx:21` — `border-current/20 bg-current/10` likely not generated by Tailwind v3 (opacity modifiers on currentColor); badge renders untinted. NEEDS VERIFICATION in built CSS.
- **L7.** CelebrationModal/AchievementUnlockModal close buttons: ~20px targets, no aria-label (`CelebrationModal.tsx:129-134`, `AchievementUnlockModal.tsx:105-110`; StorylineModal does it right).
- **L8.** `GemRevealModal` — Escape kills an in-progress transfer negotiation (`useEscapeClose` stays armed while negotiation overlay shown); also `useGameStore.setState` called directly from the component (`GemRevealModal.tsx:40-42, 71-81`).
- **L9.** `AdRewardButton` — `setClaiming(false)` after unmount in ad path; Pro double-tap can consume two season claims (`AdRewardButton.tsx:51-59`); dormant while ads off. Add a `claimingRef` guard.
- **L10.** `PageHint` exit animation unreachable (`PageHint.tsx:33-41`) — `return null` removes the AnimatePresence subtree before exit plays.
- **L11.** `AchievementUnlockModal.Sparkle` dead tier logic + per-render randoms (`AchievementUnlockModal.tsx:22-29`; same in `CelebrationModal.tsx:41-46`).
- **L12.** Duplicate SVG gradient ids in card icons (`PlayerAvatar.tsx:292, 319`) — use `useId()` like `PremiumSparkle`.
- **L13.** `AnimatedNumber` snaps on rapid value changes (`AnimatedNumber.tsx:15-21`) — new tween starts from previous target, not displayed value.

### Verified clean
Pack grant safety (commit-before-cinematic — skip/Escape/crash/force-quit cannot lose or dupe a pull); walkout queue races guarded; tier mapping aligned (no wrong-rarity walkouts); `AdRewardButton` uses `isPro()` only; no component touches `monetization.entitlements` directly.

---

## Section 6: World/season utils (saveMigration, playerGen, promotionRelegation, international, managerCareer, continental, ballonDor, awards, records, achievements, aiSimulation, etc.)

**Overall:** Battle-hardened layer — migration chain complete (1→71, all 70 steps present, terminal step matches `CURRENT_VERSION`), loader correctly gates on `migrationError`/`validateSaveShape`. Real problems: two provably unobtainable achievements, a coefficient decay bug, a migration-default contradiction that can duplicate real players. No CRITICALs.

### HIGH
- **H1. "Fortress" (unbeaten-10) and "Invincible Run" (unbeaten-20) achievements are permanently unobtainable.** `achievements.ts:53-64` requires `entry.form.length >= 10/20`, but the table builder caps `form` at 5 (`data/league.ts:316`). A silver and a gold achievement no player can ever earn. **Fix:** track an `unbeatenRun` counter instead of `form`.
- **H2. "World Beater" (international tournament win) unobtainable, twice over.** `achievements.ts:199-203` requires `round === 'Final'`, but rounds are recorded as `'R16'|'QF'|'SF'|'F'` (`weekAdvance.ts:327`); and a final won on penalties fails `goalsFor > goalsAgainst`. **Fix:** check `'F'` + handle shootout wins.
- **H3. Continental coefficient points never decay for non-participating clubs.** `continentalCoefficients.ts:81-99` — prune loop rebuilds `seasonPoints` for all clubs but recomputes `points` only for this season's participants; a club that stops qualifying keeps its old high total frozen forever, permanently inflating its league's spot allocation via `leagueRanking.ts:51-57`. **Fix:** recompute `points` from pruned `seasonPoints` for every club.

### MEDIUM
- **M1. v67→v68 migration fallback contradicts v60→v61's design and can duplicate real players.** `saveMigration.ts:1138-1141` defaults `lastSeedSeason: 0` + `usedFcIds: []` (v60 deliberately used `99` to avoid retro-injecting FAs); a community-pack save in season 2+ passes the seed gate (`weekAdvance.ts:3039`) and re-injects FC26 free agents that may already exist → duplicate real players. **Fix:** use `lastSeedSeason: 99`; reconstruct `usedFcIds` from existing players' `fcId`s.
- **M2. Ballon d'Or ghost elite entries can duplicate real in-game players.** `ballonDor.ts:126-230` — skips loaded clubs but never dedupes by `fcId`/name; sign Mbappé into your league and the ceremony shows him twice (real + synthetic PSG ghost with fabricated stats). **Fix:** skip templates whose fcId/name matches an in-game player.
- **M3. Replacement-club name duplicates guaranteed within ~2 seasons.** `promotionRelegation.ts:343-356` — pools of 3 names cycle via `counter % pool.length` while season-1 replacements may still be in the division; module-level counters also reset on app restart. **Fix:** filter pool against current club names; expand pools.
- **M4. Ephemeral continental squads permanently claim real players from the session pool.** `continental.ts:476-525` — `generateSquad` claims templates in the module-level registry (`realPlayerPicker.ts:50`, never released); each virtual-club tie removes real players from later persistent generation, and the same virtual opponent fields different players in leg 1 vs leg 2. **Fix:** `claim: false` option for ephemeral use + cache the squad per tie.
- **M5. v22→v23 wiped saves surface as a scary "corrupt save" recovery prompt** instead of a clean restart (`saveMigration.ts:325-347` sets `gameStarted: false` but loader's `validateSaveShape` fails on missing `playerClubId` → `validation_failed`). Pattern matters for future clean-break migrations. **Fix:** loader treats post-migration `gameStarted === false` as "no game".

### LOW
- **L1.** Migrations 9/21/30 lack the null-entry guards their siblings have (`saveMigration.ts:138-150, 311-322, 455-467`) — a single null map entry aborts the whole migration.
- **L2.** v70→v71 `{...obj}` can spread a primitive surviving `??` (`saveMigration.ts:1170-1173`) — corrupt-save-only.
- **L3.** `playerGen.ts:348-379` — `potential < overall` possible for real templates lacking `pot` (latent; all current data ships `pot`). Clamp after the override.
- **L4.** `playerGen.ts:466-472` — filler age reassigned after generation leaves stale potential gap (cosmetic).
- **L5.** `promotionRelegation.ts:154-158` — under-promotion config drift unguarded (all current configs balance; add invariant test).
- **L6.** `promotionRelegation.ts:226-236` — false "league size drift" Sentry warning when the player's club is spared replacement; subtract `actuallyReplaced.length`.
- **L7.** `aiSimulation.ts:488-509` — wage-bill leak on mis-declared external seller; `detachPlayerFromAllClubs` doesn't touch `wageBill`, so the true owner keeps a phantom wage forever.
- **L8.** `managerCareer.ts:254-259, 538-544, 632-638` — offer/vacancy expiry wraps on the league's `totalWeeks` (38) instead of the global 46 — offers survive ~double the configured duration.
- **L9.** `negotiateSalary` lacks the accepted/final status guard `negotiateContract` has (`managerCareer.ts:323-375` vs `:956-958`). NEEDS VERIFICATION of UI gating.
- **L10.** Compromise bonuses paired by array index, not condition (`managerCareer.ts:1016-1021`).
- **L11.** Broken ordinals: rank 3 renders "2th - 4th" (`managerCareer.ts:316`).
- **L12.** Ballon d'Or league-title bonus untiered — tier-4 champion gets the full bonus (`ballonDor.ts:404/417, 303`).
- **L13.** "Great Escape" hardcodes `position <= 17` (`achievements.ts:167-168`) — wrong for 18- and 24-team leagues.
- **L14.** `records.ts:71-76` — `[...hallOfFame]` throws if undefined (hand-corrupted saves only); cheap guard.
- **L15.** `records.ts:135-143` — clean-sheet record chase displays a fabricated receding target (`record: cleanSheets + 3`).
- **L16.** International scheduling weeks hardcoded (47/51; QF/SF/F all share week 51 — `international.ts:230/124/553`).
- **L17.** Hardcoded balance values: AI budget floor (`aiSimulation.ts:224`), career rep thresholds/salaries (`managerCareer.ts:673-692`), expected-position table (`seasonAwards.ts:54`), ephemeral quality formula + wrong docstring (`continental.ts:475-481`).
- **L18.** `updateEloRatings` and `ballonDorBoost` intentionally mutate passed objects (documented) — one careless caller inside `set()` mutates prior state. Worth immutable variants.
- **L19.** `applySeasonTurnover` deletes relegated clubs but leaves players orphaned, relying on seasonEnd to compensate (`promotionRelegation.ts:272-303`) — document or fold in.

### Verified clean
`managerPerks.ts` XP ledger math; `prestige.ts`; `hallOfManagers.ts`; `milestones.ts`; `leagueRanking.ts` (no double-qualification); `playerGen.ts` procedural path (weights sum to 1.0, clamps correct, potential ≥ overall).

---

## Section 5: Match engine (engine/match.ts, helpers, penaltyShootout, substitutionLogic, commentary/display/insights, tactics/teamTalk/keyMoments configs)

**Overall:** Well-architected (config-driven, pure helpers, carried `HalfState`; own-goal stat attribution verified correct). But half-boundary state reconstruction has real bugs, the event-roll band arithmetic breaks the injury system in derby/weather matches, and a penalty goes to the wrong team.

### HIGH
- **H1. Red-card/injury strength penalty silently resets at half-time and extra time.** `engine/match.ts:294-296` — `simulateHalf` computes strengths from the passed full 11-man lineup arrays (store lineup never edited on send-off); H2 (`matchActions.ts:1137`) and ET (`:1324`) pass them again → a team reduced to 10 plays the entire second half at full strength. **Fix:** compute initial strengths from the unavailable-filtered pools.
- **H2. Derby/weather/team-talk foul modifiers consume the entire non-foul injury band.** `engine/match.ts:1382` + `config/matchEngine.ts:125-127` — injury band is only [foul-end, 0.81); any derby (+0.06+), rain (+0.04), snow (+0.06), or Motivate (+0.05) pushes the foul threshold past 0.81 → **non-foul injuries cannot occur in derbies or bad weather**; "Calm" (−0.10) nearly doubles them. **Fix:** make the injury band relative to foul-end.
- **H3. Assists credited to sent-off/injured/subbed-out players.** `engine/match.ts:1147, 1324, 1341` — all three `pickAssist` calls pass the unfiltered squad; a minute-20 red card can assist a minute-80 goal, persisting into season stats. **Fix:** pass the unavailable-filtered pool.
- **H4. AI tactically-substituted players resurrect in extra time.** `engine/match.ts:410, 1605, 1624` + `matchActions.ts:1308-1324` — tactical-sub outs live only in the local `unavailable` set, not persisted `HalfState`; ET rebuilds from `sentOff + injured` only and the store lineup re-supplies the subbed-out starter while `subbedIn` keeps the replacement → AI plays ET with up to 11+N players. **Fix:** persist `subbedOut` on `HalfState`.
- **H5. Penalties awarded to the team that committed the foul.** `engine/match.ts:1496-1522` — fouler charged to the event team, but the `PENALTY_FROM_FOUL_CHANCE` follow-up draws the taker from the *same* squad and credits the same team's goals; the comment describes the opposite. **Fix:** draw taker from `oppSquad`, credit the opposite side.

### MEDIUM
- **M1. `FIRST_MATCH_DEFENSE_BOOST` sign inverted.** `engine/match/helpers.ts:276-277` — subtracting the boost inside the opponent-damping parenthesis makes the season-1 "help" *increase the opponent's attack* ~1.5%. **Fix:** flip the sign (both occurrences).
- **M2. AI reactive tactics are dead code.** `engine/match.ts:966-987, 1814-1819` — gates require `!homeTactics`/`!awayTactics`, but every path passes tactics (every club has an `aiManagerProfile` since `initGame.ts:248`) → minute-60/75 reactivity and `ai_tactical_change` events never fire. **Fix:** gate on "not the player's club".
- **M3. Mid-match strength recomputes drop `currentSeason`** (10 call sites) — chemistry seasonal component and season-1 boosts vanish at the first card/injury/sub. **Fix:** pass it through.
- **M4. H1 stoppage minutes collide with H2 minutes (46–52)** — H2 `calcStoppageTime` double-counts H1-stoppage events; duplicate minute labels; the "+X added time" event is typed `half_time`, suppressing the real Half Time divider. **Fix:** displayMinute/offset + dedicated `added_time` type.
- **M5. Second half emits a "HALF TIME"-labeled event at minute 90** (`engine/match.ts:958-963` + `matchEventDisplay.ts:29`). Same fix as M4.
- **M6. Abandoned-match forfeit leaves contradictory events/stats.** `engine/match.ts:919-935` — score rewritten but goal events kept; scorers keep goals that no longer exist in the final score. **Fix:** strip forfeiting side's goal events.
- **M7. GK stats and save chance ignore GK unavailability.** `engine/match.ts:378-390, 1289-1290, 1344-1349` — injured/sent-off GK keeps accruing saves; backup GK never records any; save chance unchanged. **Fix:** resolve active GK from filtered squad; recompute on GK change.
- **M8. Team-talk `defenseMod` is just an attack buff.** `engine/match.ts:302-310` — both mods multiply own scalar strength; "Calm" grants +6% attack and zero defensive effect. **Fix:** apply defenseMod to the opponent's strength like `MENTALITY_DEFENSE_MOD`.
- **M9. Pressing intensity never affects fouls — dead config.** `helpers.ts:198` + `matchEngine.ts:91-92` — `foulMod` computed, never read. High pressing has zero card risk. **Fix:** add event team's foulMod into the foul band (after fixing H2).
- **M10. The 3 perk-unlocked formations have no engine profile.** `matchEngine.ts:81-88, 251-259` cover 7 of 10 formations; `4-5-1`, `4-1-2-1-2`, `3-4-1-2` fall through `|| 0` — a paid-progression unlock with zero tactical identity. **Fix:** add entries.
- **M11. Smart-sub recommendations use stale pre-match fitness and ignore red cards.** `substitutionLogic.ts:4-14` + `SubstitutionSheet.tsx:142` — in-match fitness is available via `event.playerFitness` but unused; "tired (x%)" reasons wrong all match. **Fix:** accept matchFitness + sentOffIds params.
- **M12. Half-time-subbed-out starters get no rating or match-history record.** `engine/match.ts:1713-1717` — roster built from passed lineups + engine subs only; an H1 double-scorer rested at HT vanishes from ratings/history while keeping season goals. **Fix:** derive roster from `state.playerEvents` keys.
- **M13. Corner goals add no xG.** `engine/match.ts:1306-1336` — shots/SoT/goals incremented, xG not. Corner-scoring teams systematically over-perform xG in insights. **Fix:** add corner-derived xG.

### LOW
- **L1.** Hardcoded engine balance values (weather shifts, tempo mods, width corner bonus, mentality shot shift, skill-moves bonus, FK thresholds — `match.ts:202, 1055-1056, 1106-1108, 1117, 1207`).
- **L2.** `full_time` marker hardcoded minute 90 (`match.ts:1701`) — wrong after ET/long stoppage.
- **L3.** Exhaustion rating penalty reads pre-match fitness (`match.ts:1749`) instead of `state.playerFitness`.
- **L4.** `enrichDescription` appends goal context to VAR-disallowed goals (`matchCommentary.ts:86-91`).
- **L5.** Formation fit lets one versatile player satisfy all 10 slots (`helpers.ts:162-173`) — overstates a 0.25 bonus for thin squads.
- **L6.** Team-talk foul modifier applies to both teams (`match.ts:1382`).
- **L7.** AI bench GK can come on as an outfielder (`match.ts:131-186` — bench side not filtered).
- **L8.** VAR momentum reversal can over-correct when the goal swing was clamped (`match.ts:1261-1263`).
- **L9.** Perf: `homeAvail()`/`awayAvail()` re-materialized ~6×/minute + per-minute spreads (`match.ts:1005, 1083-1094`) — millions of short-lived arrays per `advanceWeek` across ~450 AI matches. Hoist + invalidate on roster events.

### Verified clean
`penaltyShootout.ts` (early-termination, sudden-death, watchdog cap all correct); own-goal stat attribution (never credited to the defender); substitution-event `assistPlayerId` overload can't leak into stats; `matchSpeed/keyMoments/halftimeAnalysis/matchEventDisplay/matchInsights` clean; weight math division-safe.

---

## Section 1: Game loop (weekAdvance.ts, orchestration/helpers.ts, orchestrationSlice.ts)

**Overall:** Disciplined copy-on-write (zero mutation violations found); cup-week choreography constants verified against `cup.ts`; `matchSubsUsed` reset correct; no player-club wage double-payment. Real issues: two dead/broken Community-Pack mechanisms, a week-skip path that can hang a continental tournament, and state bleed in `resetGame`.

### HIGH
- **H1. Community-Pack S2/S3 free-agent seeding is unreachable — never fires.** `weekAdvance.ts:3034-3040` requires `cpSeedState.week === 1`, but the block runs after `set({ week: newWeek })` so `week` is always ≥ 2 (season-end paths return before reaching it). 35 of the 85 planned marquee FA seeds (`config/aiSimulation.ts:106-110`) silently never happen — the CP free-agent pool starves. **Fix:** drop the `week === 1` check (the `lastSeedSeason < season` gate is already idempotent).
- **H2. CP market rotation can resurrect already-signed real players (duplicates).** `weekAdvance.ts:2963, 3019-3021` — rotation unconditionally frees the first 20 listings' fcIds from `usedFcIds`, but `marketListings` is never pruned on purchase (verified: no writes in transferSlice) and the orphan-deletion loop only removes players still listed. A signed player keeps existing while his fcId is freed → a later draw issues a second copy of the same real player. **Fix:** only free fcIds whose player record was actually deleted; prune `marketListings` on purchase.
- **H3. `advanceToNextMatch` ignores continental matches and can permanently hang a tournament.** `orchestrationSlice.ts:521-548` — `hasMatchThisWeek` checks friendlies/league/cup/league-cup/super-cups but not champions/shield/conference group matchdays or KO legs (Dashboard's `useCurrentMatch` does). In fixture-gap weeks the skip loop advances through a continental week; `groupWeeks[md-1] === week` never matches again and the whole group stage freezes for the season with no orphan recovery — the documented `cup.ts` failure, reachable from a UI button. **Fix:** include all three tournaments via `findTournamentMatch`.
- **H4. `resetGame` leaks national-team state into a brand-new game.** `orchestrationSlice.ts:1027-1080` omits `nationalTeam`, `internationalTournament`, `managerNationality`, `nationalTeamOffer`, `showNationalTeamOffer`, `activeInterview` (initGame doesn't write them either). New game inherits an old NT job with dead player IDs; season end schedules a tournament for the stale nationality. Soft-breaks (`?.`-guarded). **Fix:** add the six fields to `resetGame` (and initGame as belt-and-braces).

### MEDIUM
- **M1. Conference Cup victory labeled "Shield Cup".** `weekAdvance.ts:1399` two-way ternary over a three-value union — wrong trophy name in message + permanent career milestone. **Fix:** three-way map.
- **M2. International group-stage opponent strength inverted.** `weekAdvance.ts:142-144` — `0.7 - points * 0.02` makes opponents weaker the more group points they have (9-point leader sims at 0.52, 0-point minnow at 0.7). **Fix:** scale up with points or use a real seeding value.
- **M3. Loan playing-time condition appears inverted.** `weekAdvance.ts:2273` — player *better* than the loan club gets the LOW play chance; over-qualified loanees should be guaranteed starters. NEEDS VERIFICATION on design intent. **Fix:** flip the comparison.
- **M4. Deadline-day bargains and scouted listings never expire and can duplicate live listings.** `weekAdvance.ts:1832-1833, 1878-1883` — no `listedWeek`/`listedSeason` stamps (`processListingExpiry` keeps unstamped listings forever); bargains accumulate ~6/season with frozen prices and survive the player's later release; dedupe only against own batch. **Fix:** stamp both + check live market.
- **M5. Save hash recorded even when both disk writes fail** — "Save Now" can later report success without persisting. `orchestrationSlice.ts:344-345` sets `lastSavedHash` regardless of `lsOk`/idb result; identical payload then short-circuits to `'saved'`. Partially self-healing via the failure inbox message, but its weekly de-dupe leaves a window. **Fix:** commit the hash only on success; clear it in the idb-failure handler.
- **M6. `loadGame` builds the league table from every loaded club in the world.** `orchestrationSlice.ts:747-748` — multi-league saves get hundreds of zero-point foreign clubs in `leagueTable` until the next advance; Dashboard position and session snapshot wrong, egregiously early-season. **Fix:** pass `divisionClubs[playerDivision]` like weekAdvance does.
- **M7. Prestige silently disables Community Pack.** `orchestrationSlice.ts:1181` — `initGame(newClubId)` passes no options; CP defaults false. Prestiging a CP save reverts the world to fictional players. **Fix:** pass `{ communityPackEnabled: get().communityPackEnabled }` (mind the synchronous prestige-bonus guard at `:1140-1191`).

### LOW
- **L1.** Dead unemployed-manager branch (`weekAdvance.ts:2827-2844`) — unreachable duplicate desperation-vacancy generator that also omits fields the live version includes. Delete.
- **L2.** Hardcoded balance values: knockout NT strength formula (`weekAdvance.ts:303-308` — group-stage twin was config-ified), home bonus 0.08 (`:149`), desperation salary 1500 (`:567`).
- **L3.** Weekly filler message always fires once inbox hits the 200 cap (`weekAdvance.ts:2461-2462` length-diff check) — count appends explicitly.
- **L4.** `sessionStats.xpEarned` omits achievement XP (`weekAdvance.ts:2448` vs `:2382-2384`) — session recap under-reports.
- **L5.** All 23 NT squad members earn caps + fitness cost per match (`weekAdvance.ts:211-221, 341-351` iterate squad, not lineup).
- **L6.** `initializeLeague` catch-up sims record no player stats (`orchestrationSlice.ts:487-502`) — mid-season-initialized leagues show 0 appearances/goals for the init season, skewing the cross-league BdO pipeline.
- **L7.** AI bench scorers get goals but never appearances (`helpers.ts:104-160` — appearance tracking iterates first 11 only).
- **L8.** Player's super cup never resolved if its exact week passes unplayed (`weekAdvance.ts:1269, 1296` — no `t.week <= week` orphan recovery like cup/league-cup have).

### Verified clean
`matchSubsUsed` reset every tick; player's own match never simmed except the documented orphan case; cup/continental week constants agree with `cup.ts`; no direct localStorage; zero Zustand mutation violations; `unlockPerk` XP spend correct (implicit via spent-perks subtraction); no player-club double-payment in `processAIWeekly`.

---

## Section 2: Season end, match actions, game init (seasonEnd.ts, matchActions.ts, initGame.ts, tournaments.ts)

**Overall:** Largely well-defended (consistent `filter(Boolean)`, spread-before-write, ephemeral-club hygiene), but hides one empirically-confirmed catastrophic flow bug and a cluster of season-end regressions that silently destroy player-visible state every season. The interactive match path diverges from instant-sim in two places that corrupt continental tournaments.

### CRITICAL
- **C1. Completing an international tournament ends the brand-new season instantly — phantom seasons, double aging, promotion/relegation off a 0-0 table.** `seasonEnd.ts:1361-1414` + `weekAdvance.ts:522, 109`. `finalizeSeason` commits the rollover (season=N+1, week=1) *first*, then starts the tournament and returns; when the tournament finishes, `advanceInternationalWeekImpl` calls `endSeasonImpl` again on the freshly-reset season. **Empirically reproduced:** end of season 1 with an NT job → World Cup → one week later `season=3`, a phantom `SeasonHistory {season: 2, pts: 0, played: 0}`, season-2 continental chained. Players age twice, contracts decrement twice, freshly promoted clubs are instantly relegated off the all-zero table, possible spurious sacking. The early return also skips the career end-of-season block and the autosave. **Fix:** remove the `endSeasonImpl` calls at `weekAdvance.ts:522/109`; make tournament completion resume the already-rolled season (running the skipped career tail + autosave) — or intercept before `finalizeSeason` commits.

### HIGH
- **H1. Interactive continental group/leg-1 draws go to extra time; group shootouts strand the match → tournament hang.** `matchActions.ts:1143` — drawn cup-flagged matches go to ET unless `isAggregateDecided`, which returns false for group matches and leg 1 (legitimate draws). Instant-sim exempts these (`matchActions.ts:548-563`); the interactive path doesn't. ET winners corrupt group standings/aggregates; group penalties hit a handler that only processes knockouts (`:319`) → match never marked played → group stage hangs (weekAdvance never AI-sims the player's continental match). Leg-1 pens set `tie.winnerId` prematurely, cancelling leg 2. **Fix:** replicate the instant path's exemptions at line 1143.
- **H2. Every season end silently deletes all season-end inbox messages.** `seasonEnd.ts:1157` — `processSponsorSeasonEnd` returns a list built from pre-endSeason messages and the assignment *replaces* the locally accumulated `newMessages`: Promoted!/Relegated, Ballon d'Or, "Season N Begins", continental qualification, NT retirements, staff walk-aways, youth intake — all discarded; only sponsor messages survive. **Fix:** return/append only the new sponsor messages.
- **H3. Pair-familiarity (chemistry) wiped to empty every season — prune can't parse UUID keys.** `seasonEnd.ts:1286-1294` — keys are `${uuidA}-${uuidB}`; `key.split('-')` yields fragments of the first UUID, never matching surviving ids → every entry pruned, all chemistry resets each season, contradicting the comment's intent. **Fix:** `key.slice(0, 36)`/`key.slice(37)` (with fallback for `u_…` ids) or a safe separator.
- **H4. League Cup bracket degenerates into cascading byes — the final is never played and the winner's prize money is skipped.** `tournaments.ts:24-59, 101-147` — inverted start-round heuristic (20 clubs → 'R1', 7 rounds when 5 suffice), no power-of-two normalization: the de-facto final is the QF at week 24; the week-40 "Final" is a pre-played bye that weekAdvance crowns, and since prize money is only paid when the player plays the F round (`matchActions.ts:296-298`), a bye-final "winner" gets the trophy message with no money. The main cup was explicitly rewritten to fix exactly this (`cup.ts:36-39`). **Fix:** port `generateCupDraw`'s prelim-round approach.
- **H5. Season prize money/reputation distributed against the wrong tables — promoted champions get the bottom share.** `seasonEnd.ts:768-792` — reward loop iterates post-turnover memberships but builds tables from completed-season fixtures; a promoted club ranks last with 0 games (~2% of the *new* league's pool) instead of taking the 30% winner's share of the league it actually won. Hits ~4-6 clubs per country every season + reputation drift. **Fix:** distribute using `finalDivisionTables` (already built at `:248-256`).

### MEDIUM
- **M1. NT pool players deleted by the free-agent purge, leaving dangling `poolPlayerIds`.** `seasonEnd.ts:934-939` — purge of `clubId === ''` players has no NT exemption (the earlier orphan prune does); pool silently empties between tournament years. **Fix:** extend the condition with `!ntPoolIds.has(pid)`.
- **M2. `initGame` never resets NT or once-per-season perk fields (and `resetGame` doesn't either) — cross-save leakage.** `initGame.ts:466-586` — `nationalTeam`, `internationalTournament`, `managerNationality`, `nationalTeamOffer`, `showNationalTeamOffer`, `galacticoUsedThisSeason`, `invincibleUsedThisSeason`, `activeInterview` set by neither; new saves inherit an old NT job (feeding C1) and disabled Invincible/Galactico for season 1; prestige path inherits everything. **Fix:** add to initGame's `set()` (canonical new-world writer).
- **M3. Penalty-shootout results classified inconsistently between instant and interactive paths.** `matchActions.ts:583-595` vs `:1550-1560` — instant adds a phantom +1 goal (tie score no longer matches player stats); interactive passes the real draw so a cup final won on pens yields draw-level board confidence/morale/W-D-L. **Fix:** pass shootout `winnerId` into `processMatchResult`; drop the +1 hack.
- **M4. `avoid_relegation` contract bonus always pays in upper tiers — even when actually relegated.** `seasonEnd.ts:1545` uses `replacedSlots` (0 except bottom tier) → condition always true. Line 1521 already computes the correct count; reuse it.
- **M5. Conference Cup match messages labeled "Shield Cup".** `matchActions.ts:641` — same two-way ternary as the weekAdvance instance. Add the third arm.

### LOW
- **L1.** Extra time grants a full fresh substitution allowance (`matchActions.ts:1148` resets `matchSubsUsed: 0`) instead of the conventional +1.
- **L2.** Onboarding message says "default 4-4-2" but every club initializes to 4-3-3 (`initGame.ts:388` vs `:223, 243`).
- **L3.** Division-by-zero → NaN budget if a division ever has exactly 1 club (`seasonEnd.ts:781`).
- **L4.** Fallback path pushes onto a possibly store-shared division array in place (`seasonEnd.ts:386-388`) — copy before push.
- **L5.** Instant-sim crash path strands ephemeral continental clubs in state (`matchActions.ts:499-501` commits before the try; `cleanupAbandonedMatch` early-returns in the instant-sim state). Make cleanup unconditional in the error path.
- **L6.** `playSecondHalfImpl`/`playExtraTimeImpl` soft-lock on `return null` for <7 players (`matchActions.ts:1103, 1295`) — no resume path; route through `cleanupAbandonedMatch`. NEEDS VERIFICATION whether the HT lineup editor can drop below 7.

### Interactions with already-filed items
C1 also overrides `currentScreen: 'season-summary'` → in tournament seasons the SeasonSummary dead-banner issue is superseded (summary skipped entirely). H2 compounds the loan-permanence CRITICAL by deleting the messages that would have surfaced it. Performance: no material O(n²) — loaded world is one country.

---

## Section 14: Data + config (league/cup/continental data, nations, challenges, types/game.ts, all 25 config files, generated-data import discipline)

**Overall:** Static data layer in very good shape — counts verified exactly (45 leagues / 37 countries / 756 clubs, zero duplicate IDs), referential integrity holds, bracket math sound, generated-data import discipline clean. One severe structural problem: the fixed competition calendar vs per-league season lengths.

### CRITICAL
- **C1. Fixed competition calendar vs per-league `totalWeeks` kills cup finals, League Cup finals, and continental knockouts in most leagues.** `data/cup.ts:15-23` (CUP_WEEKS R1=4 … F=43), `config/continental.ts:62-78` (LC final 40, continental QF2=39/SF=41-42/F=44), vs `initGame.ts:467` (`totalWeeks = league.totalWeeks || 46`) and `Dashboard.tsx:605-611, 910-921` (season force-ends at `week > totalWeeks`; `endSeasonImpl` never resolves pending ties). Verified `totalWeeks` distribution: 18×2, 22×9, 24×1, 26×5, 30×8, 34×8, 36×1, 38×5, 42×1, 46×3, 58×2. Consequences: **Cup Final unreachable in 40/45 leagues** (PL plays the SF at week 36, final never; `cupResult` records "Semi-Finals" even for the SF winner); LC Final unreachable in 39/45 (in 22-week leagues the LC dies after one round); **continental runs strand at the QF even in 38-week top-5 leagues** — tournament hangs with `winnerId: null`. In 18-week leagues (cro, irl) not a single cup match is ever played and the winter window (weeks 20–24) never opens. Downstream: both Super Cups never created (`seasonEnd.ts:891, 907-908`), cup-winner → Conference Cup qualification never fires (`:861-869`), final prize/coefficient/reputation rewards never pay, Ballon d'Or cup bonuses dead, 'cup-specialist'/'double-winner' challenges unwinnable outside 5 leagues. No test covers calendar-vs-totalWeeks (cup tests check bracket shape only). **Fix:** scale competition weeks to the league calendar at draw time (preserving collision-avoidance ordering), or keep ticking weeks past the last fixture until live competitions resolve; update the cup.ts choreography comment with the chosen invariant.

### HIGH
- **H1. Odd-team-count leagues lose their last two rounds.** `data/league.ts:150-197, 205` — bye-round circle schedule spans `2n` weeks but `matchWeeks = 2*(n-1)` (wrong for odd n) and no rescale triggers: aus (13 teams, totalWeeks 24 → fixtures at weeks 25–26) and tur (19, 36 → weeks 37–38) lock the dashboard with 1–2 rounds unplayed; standings computed from an incomplete fixture set. **Fix:** span = `hasBye ? 2*n : 2*(n-1)`; bump those leagues' totalWeeks.
- **H2. Three of ten challenges are mathematically unwinnable.** `data/challenges.ts:137-159` — 'fortress'/'goal-machine'/'promotion-express' require `extraData` (homeUnbeaten/leagueGoals/divisionId) that the only call site never passes (`seasonEnd.ts:1129`; `checkChallengeFailed` likewise, `weekAdvance.ts:2255`) — always false, auto-fail at 0 seasons remaining, including a player who actually got promoted. **Fix:** thread the three values from state (all derivable).

### MEDIUM
- **M1. 'The Great Escape' broken in both directions.** `challenges.ts:141` — `position <= 17` trivially true in 10–18-team leagues (auto-win); the advertised "start week 23 with 15 points" constraint is not implemented anywhere (`featureSlice.ts:660-698` applies only budgetModifier). **Fix:** scale target to league size; implement or delete the mid-season text.
- **M2. Cosmetic relegation in single-tier leagues.** arg (2 spots), bra (4), kor (1), sau (3) — no tier 2, `replacedSlots: 0` → `applyPromotionRelegation` does nothing; the table shows a relegation zone and board/press treat bottom-3 as a battle, but finishing last has zero consequence. **Fix:** zero `relegationSpots` or set `replacedSlots`.
- **M3. Conference Cup winner announced as "Shield Cup Winners!"** (`weekAdvance.ts:1399` — same finding as S1-M1; masked by C1 in short leagues, live in 46/58-week saves).
- **M4. Fixed-week features silently dead in short leagues** (same root as C1): winter window (18-week leagues: never opens; 22-week: 3 weeks with deadline day at season end), `INTERNATIONAL_BREAK_WEEKS [10,24,38]`, `BOARD_REVIEW_WEEKS [15,30]`, `STAFF_MARKET_REFRESH_WEEK 23`, `CAMPAIGN_END_OF_SEASON_MIN_WEEK 38`, contract warnings to week 35, 'captain-retirement' storyline (`week >= 25`). **Fix:** derive from `totalWeeks`.

### LOW
- **L1.** `data/leagueConstants.ts` entirely dead (zero imports; duplicates the live `LEAGUE_REGIONS` in `leagues/index.ts:89-95` — drift trap). Delete.
- **L2.** Dead legacy continental exports (`continental.ts:53-58, 9-10`) — stale "kept for references" comment. Delete.
- **L3.** `BALLON_DOR_ELITE_CLUB_BONUS` doc block says 60/45/30/18; values are 90/65/45/28 (`gameBalance.ts:765-805`). Update comment.
- **L4.** `buildVirtualClubsForLeague` sorts `CLUBS_BY_LEAGUE[leagueId]` in place (`continentalDraw.ts:25-26`) — permanently reorders shared module data after the first draw; tolerated today, latent footgun. Copy first.
- **L5.** UI copy hardcodes 20-team assumptions (`HELP_TEXTS.transferWindow`, 'invincibles' "38-match season", `challenges.ts:24`); `ui.ts:14` ≥70 tier is `sky` while CLAUDE.md says "primary" (doc drift).

### Verified clean (with evidence)
- **Generated-data import discipline CLEAN — the Vite build warning is benign:** both access wrappers lazy-load internally via dynamic `import()` (`playerTemplatesAccess.ts:39`, `nationalPlayerPoolAccess.ts:61`) with only type-level top-level deps; zero non-type static imports of the heavy modules anywhere; communityPack loads only via `await import(...)`. Eager bundle unaffected.
- Counts: 45/45 leagues, 37 unique countries, 756/756 unique club IDs; tier structure matches docs; all 60 derby club references resolve; tier links satisfy `relegationSpots == promotionSpots + 1 playoff winner` everywhere; prize money strictly descending across tiers.
- continentalDraw: 32-team integrity, 4 pots × 8, one club per pot per group, dup prevention verified; valid double round-robin template.
- cup.ts bracket math: non-power-of-2 via single prelim round, final always on 'F', byes pre-marked.
- types/game.ts: 45/45 unique GameScreens; 10/10 formations × 11 slots; navigation DETAIL_SCREENS ↔ BACK_TARGET 1:1; press contexts and storyline chain IDs fully matched; 51 nations confirmed.
- Config barrel: no duplicate exported names across 15 star-exported modules.

### NEEDS VERIFICATION (cross-scope)
Whether `BALLON_DOR_DIVISION_BONUS` tier keys use a custom quality-tier mapping in `utils/ballonDor.ts` vs `LeagueInfo.tier`; whether MatchReview's post-match `advanceWeek()` can tick exactly one week past `totalWeeks` (would let the week-39 AI continental QF2 sim once, never the player's own tie).

---

*End of report — 14 of 14 sections complete.*

