# Dynasty Manager — Product Roadmap

> Authored 2026-06-21 against app **v1.1.1** (save schema v71), live on the iOS App
> Store (id 6760918006). This roadmap consolidates `docs/retention-roadmap.md`,
> `docs/online-mode-plan.md`, the World Cup / immersive-match plans, and the
> open-issue findings from `AUDIT_REPORT.md`, `AUDIT-2026-06-03.md`,
> `UX_POLISH_REPORT.md`, and the release/balance/pitch audits.
>
> **Source of truth is the code.** Many MEDIUM/LOW audit items below are flagged
> "verify" because audit "Wave" summaries claimed fixes that were never
> re-confirmed against live code. Every such item must be re-checked at the
> file:line before it is closed — do not assume.

---

## 0. Where the game is right now

**Shipped and solid:** 4 playable modes (Sandbox, Manager Career, Challenges,
World Cup), a deep event-based match engine + live MatchDay with a 2.5D
Canvas/Pixi pitch, full RevenueCat monetization (Pro subs + one-time + cosmetic
packs + consumable player packs), national teams & continental competitions,
career depth (job market, interviews, board), progression (talent tree,
achievements, records, Hall of Managers), narrative (storylines, press, weekly
digest), and a shipped retention v1 (daily streak, daily challenge, push
notifications, Dynasty Legacy, World Cup Festival). ~57 pages, ~90 components.

**Disabled / absent:** Online multiplayer (UI stub, no backend), ads (AdMob
removed after the TestFlight crash — stubbed, documented re-enable path),
cloud save / accounts / cross-device sync (none — saves are device-local), and
user-generated content (no custom clubs/leagues).

**The one time-critical fact:** the real **2026 World Cup is happening now**
(Jun–Jul 2026). World Cup mode exists and is the single highest-leverage
marketing asset the game has — but only for the next few weeks. Anything that
makes WC mode shine or sharpens WC ASO beats almost everything else on timing.

---

## 1. Strategy & guiding pillars

1. **Don't ship on top of broken money or broken saves.** Revenue-loss and
   data-corruption bugs gate every feature release. Hardening is track 0.
2. **Respect the player's time; make consequences stick.** This is the
   anti-FM26 positioning from the retention roadmap. Daily loop + dynasty
   legacy are the retention spine.
3. **Ride the World Cup now.** Timeliness > polish for the WC window.
4. **Single-player excellence first; online is a parallel, backend-gated bet.**
   The match engine is non-deterministic, so true shared leagues require
   server-side sim — that's a real infra project, not a feature toggle.
5. **Every persisted-shape change bumps `CURRENT_VERSION` + migration.** No
   exceptions.

---

## 2. Release train (overview)

| Release | Theme | Window | Gate |
|---|---|---|---|
| **v1.1.2 — Hardening** | Fix revenue/save/UX-blocker bugs | ✅ verified done 2026-06-21; residual checks closed 2026-06-27 | P0/P1 list §3 closed |
| **v1.1.3 — World Cup Live** | WC polish + ASO refresh while tournament is on | **NOW — top priority** | Ship before WC final |
| **v1.2 — Dynasty Legacy** | Meta-progression depth, retention v2 | ~3–5 weeks | §5 exit criteria |
| **v1.3 — Identity & Immersion** | Create-a-Club, Manager RPG, match-view polish | ~6–8 weeks | §6 exit criteria |
| **v1.4 — Content & Balance** | Storyline/press/objective depth, balance pass | parallel/ongoing | §7 exit criteria |
| **v2.0 — Online (Slice 1→3)** | Accounts → cloud save → async leagues → H2H | parallel, backend-gated | §8 exit criteria |

Tracks **0 (hardening)**, **4 (content/balance)**, and **online (v2.0)** run
**in parallel** with the feature releases, not strictly after them.

---

## 3. TRACK 0 — Hardening (gates all releases) — v1.1.2

> **VERIFIED 2026-06-21 against live code — this track is essentially DONE.**
> Every P0 and P1 item below was re-checked at the cited file:line and found
> **already fixed**, each with an in-code comment describing the exact bug. The
> source audits (`AUDIT_REPORT.md` 2026-06-10 and earlier) are stale; the
> retention/World-Cup work since carried the hardening in. Evidence:
> - P0#1 Android key — `purchases.ts:26-34` per-platform `resolveApiKey`, returns
>   `null` (not test key) in prod, Sentry-reports; `android-build.yml:36` sets the
>   Android secret. **FIXED.**
> - P0#2 Consumable durability — `PacksPage.tsx:385` writes pending-credit before
>   StoreKit; `:136-159` mount reconciler; `:395,418` keeps marker on block. **FIXED.**
> - P0#3 Loan wipe — `seasonEnd.ts:506-509` force-returns loans before wiping
>   `activeLoans`. **FIXED.**
> - P1#4 Squad-picker deadlock — `NationalSquadPicker.tsx:85-103,168,204` extras
>   logic + `pickedPlayers.length` gate. **FIXED.**
> - P1#5 Trial eligibility — `SubscribeOnboarding.tsx:109` `trialEligible =
>   subscription == null` gates caption/CTA/toast. **FIXED.**
> - P1#6 Double-advance — `Dashboard.tsx:1072` `.finally()` resets `isAdvancing`. **FIXED.**
> - P1#7 Continental finals — `continental.ts:236,254-264` `round !== 'F'` guard +
>   final branch sets `winnerId`. **FIXED.**
> - P1#8 Promotion rep — `seasonEnd.ts:1593-1596` gates on `promotionSpots`. **FIXED.**
> - P1#9 Loan counter — `loanSlice.ts:746` `acceptLoanCounter`, wired
>   `LoanNegotiation.tsx:111`. **FIXED.**
> - P1#10 Sub/optimize false-success — `SubstitutionSheet.tsx:346` handles
>   `proRequired`; autoFill dedups swaps. **FIXED.**
> - P1#11 mononyms — `playerGen.ts:339` keeps mononym in `lastName` only. **FIXED.**
>
> **Residual checks — CLOSED 2026-06-27 (both non-issues, verified at file:line):**
> - (a) weeks 1–3 friendly/league "double-booking" — **not a bug, intended design.**
>   League fixtures legitimately start week 1 (`league.ts:216`, gap=1 for a
>   20-team league) and friendlies are weeks 1–3 (`league.ts:236`); they run
>   *alongside* by design (the pre-season news at `initGame.ts:387` says so).
>   The player plays the higher-priority friendly (`matchActions.ts:413` chain),
>   and `weekAdvance.ts:1069-1149` auto-sims the orphaned league fixture and posts
>   a "League Fixture Auto-Simulated" inbox notice, so the club never ends the
>   season a game short. No "league begins week 4" copy exists anywhere. Locked
>   with a regression test in `orchestrationSlice.test.ts`.
> - (b) Dashboard "Season Race / League Pos" division-scoping — **correct.**
>   State `leagueTable` is division-scoped at every assignment
>   (`initGame.ts:265` = `divisionTables[playerDivision]`, `weekAdvance.ts:1517`
>   = `divisionClubs[playerDiv]`, `matchProcessing.ts:188` = `divClubIds`), so
>   the Dashboard ranks within the player's division, not all 92 English clubs.

The original shipblocker list is retained below for traceability. Order =
revenue → data → UX-blocker → gameplay integrity.

### P0 — Revenue loss / data corruption / dead-end
1. **Android ships a hardcoded RevenueCat test key** — `src/utils/purchases.ts:21`
   + missing secret in `android-build.yml`. 100% of Android real purchases
   bypass RevenueCat. Fix: per-platform keys (`appl_`/`goog_`), add CI secret,
   throw at build if missing in prod.
2. **Consumable pack purchase not crash-durable** — `PacksPage.tsx:323`,
   `purchases.ts:80`. No persisted pending-credit between StoreKit charge and
   in-memory grant → crash in payment window loses real money. Fix: persist
   `{productId,tierKey,ts}` before purchase; clear after `openPack` + save
   flush; reconcile on launch.
3. **Loan returns wiped at season end** — `seasonEnd.ts` loan handling. Unexpired
   loans dropped; borrower keeps player free → corruption + exploit. Fix: return
   unexpired loans or extend past season boundary.
4. **NationalSquadPicker confirm deadlock** — `NationalSquadPicker.tsx:74–114`.
   `pickedIds` seeded unfiltered; injured/deleted picks counted but invisible →
   "23/23" with 22 visible, can't proceed. Fix: base block on
   `pickedPlayers.length`, mirror `NationalTeamPage` extras logic.
5. **Free-trial copy/toast shown to ineligible users** — `SubscribeOnboarding.tsx:91,163`.
   Lapsed subscriber sees "3-day trial", charged full, sees false success →
   Apple 3.1.2(c) risk. Fix: gate on RevenueCat trial-eligibility check (or at
   minimum `subscription == null`).

### P1 — Gameplay integrity / retention / trust
6. **Advance-week double-fire** — `Dashboard.tsx:1037`. `setIsAdvancing(false)`
   runs synchronously, not in `.finally()` of awaited `advanceWeek()` → fast tap
   double-processes income/stats. Fix: move into `.finally()`.
7. **Continental AI finals never resolve** — `continental.ts:229`. Generic leg-1
   branch fires for the Final too; `winnerId` never set → tournament hangs. Fix:
   check `round === 'F'` first.
8. **Career promotion/relegation reputation only fires in bottom division** —
   `seasonEnd.ts:1486,1491` (gated on `replacedSlots>0`). Winning the
   Championship never increments `promotionsWon`/`REP_PROMOTION`. Fix: gate on
   `leagueInfo.promotionSpots`/`relegationSpots`.
9. **Loan counter-offer acceptance always fails** — `LoanNegotiation.tsx:91`,
   `loanSlice.ts:548`. Re-calling `requestLoan()` trips dedupe guard → dead-end.
   Fix: dedicated `acceptLoanCounter(id)`.
10. **Substitution confirm + Optimize Lineup show false success** —
    `SubstitutionSheet.tsx:182,316`. `makeMatchSub` silently no-ops at max/stale;
    `autoFillTeam` returns `{proRequired}` ignored for free users. Fix: return
    booleans; toast/close only on success; route non-Pro to ProUpsell.
11. **Onboarding/early-game UX cluster** (`UX_POLISH_REPORT` P1):
    - Weeks 1–3 double-booked: friendlies + league fixtures both start week 1,
      contradicting "league begins week 4" copy (`league.ts:150`,
      `generateFriendlies.ts`).
    - Match results not persisted until week advance — reload loses played match
      (`orchestrationSlice.ts` autosave).
    - Dashboard "Season Race"/"League Pos" rank vs all 92 English clubs, not the
      division.
    - "Getting Started" checklist shows 0/2 for 3 items, never progresses
      (`OnboardingChecklist.tsx`).
    - Mononym players render doubled ("Isco Isco"); league-table names truncate
      with no ellipsis.
12. **Post-advance modal pile-up + MatchDay re-render jank** (UX_POLISH A1/A2,
    HIGH): digest/achievements/celebration fire in one commit (haptics for
    invisible modals); MatchDay re-renders ~1,700 lines 50×/sec at instant speed.
    Fix: single post-advance presentation queue; `memo(CommentaryRow)`, memoized
    row array, window to last N rows.

**Exit criteria (v1.1.2):** items 1–11 verified-and-fixed with tests; 12 at
least mitigated. New save migration (v72+) where shape changes (loan return,
subbedOut persistence). `npm run preflight` green.

---

## 4. v1.1.3 — World Cup Live (ride the real tournament)

Ship while the real WC is on air. Small, high-timeliness items only.

- **ASO refresh** — lead title/subtitle/screenshots with "World Cup 2026",
  keywords (`world cup`, `world cup game`, `world cup manager`, `2026`). Marketing
  kit drafts already exist in `marketing/` + `docs/world-cup-update-plan.md`.
- **WC intro sequence** (trophy/flag/bracket-forming splash) + **trophy-lift
  celebration screen** on winning the final.
- **Golden Boot & WC awards** (Player of Tournament, Young Player) on the result
  screen.
- **Group-draw ceremony** (tappable reveal) + **swipeable knockout bracket**.
- **Shareable WC result card** (branded image export → organic UA loop).
- **World Cup wall / record book** (honours: every WC won, best finish, top
  scorers).

**Exit criteria:** ASO live; intro + trophy-lift + awards + shareable card
shipped. Anything not ready by the WC final slips to the evergreen backlog (WC
mode is permanent; only the *marketing window* is time-boxed).

---

## 5. v1.2 — Dynasty Legacy (retention v2)

From `docs/retention-audit-and-plan.md` P1/P2. Builds on shipped retention v1.

**P1 (high-value, low-risk):**
- Persistent streak indicator (flame + count in TopBar) with 7/30/100-day
  milestone celebrations.
- Surface lifetime Dynasty tier badge on Dashboard + main menu.
- **Modal sequencing / priority gate** (one blocking overlay at a time — folds
  into the §3.12 presentation queue).
- **Analytics instrumentation**: `daily_streak_claim`, `festival_checkin`,
  `festival_tier_claim`, `legacy_view`, `reminders_enabled`; wire D1/D7/D30
  funnel. (Prereq for measuring everything else.)

**P2 (features):**
- **Manager Pass** (free + Pro track, season-long cosmetic/XP rewards) — new
  monetization surface; must obey entitlement invariants (no sim effects).
- **True lifetime Hall of Managers** — archive entries before New Game overwrite.
- **Richer Dynasty Legacy** — most-decorated club, favourite formation, milestone
  timeline, per-competition trophy breakdown, shareable legacy card.
- **Gameplay-driven Festival Points** (wins/clean sheets during event window via
  a `weekAdvance` hook).
- **Cosmetic festival/streak rewards** via the existing cosmetics catalog.

**Cleanliness (P3):** extract `localDateKey`/`daysBetween` → `utils/dateKey.ts`;
group device-global engagement state behind one module; render tests for
DailyRewardModal/FestivalHub/DynastyLegacy; verify reduced-motion honoured.

**Exit criteria:** streak + tier surfaced; Manager Pass live; lifetime Hall
fixed; analytics funnel reporting D1/D7/D30.

---

## 6. v1.3 — Identity & Immersion

Tier B from the retention roadmap + the immersive-match plan's optional polish.

- **Create-a-Club / Custom Club editor** — name, colours, badge, stadium,
  starting tier. (Persisted-shape change → migration.)
- **Manager RPG depth** — deeper ManagerCreation; personality traits that
  measurably affect press/board/player reactions; reputation arc.
- **New-Game-Plus / prestige** — cosmetic unlocks + perks + Hall entries carry
  forward.
- **Immersive match view finish**:
  - Verify Phases 1–5 on-device (choreographer, Canvas/Pixi renderer, goal
    moments, realism pass are marked DONE — confirm tuning).
  - Optional pre-match walkout / half-time tactical board / full-time beat.
  - Pitch fixes still open: penalty arc is a full circle (should be a segment);
    first-match coach-marks for Pitch/Split/Log + shouts + speed-cycle.
  - **Phase 4 "Stunning" WebGL tier** (bloom, displacement turf, GPU particles)
    — deferred; gate on whether Phase 1–5 feedback justifies the bundle cost.
  - **Audio** (opt-in crowd/whistle/roar, lazy, muted by default) — BLOCKED on a
    sound-setting shape change + audio assets; scope it here or punt.
- **Women's football** (rosters, ladder, WC narrative tie-in) — large; only if
  v1.2/v1.3 land on schedule.

**Exit criteria:** Create-a-Club shippable with migration; match view verified
AAA on a real device; coach-marks + penalty-arc fixed.

---

## 7. TRACK 4 — Content & Balance (parallel, ongoing)

> **VERIFIED 2026-06-21:** the "thin content" audit findings are also stale.
> Live counts: **15 storyline chains** (`storylineChains.ts`, audit said 4),
> **27 weekly-objective templates** (`weeklyObjectives.ts:440`, audit said 16),
> and press-conference content well past the "12 questions" claim. Content is in
> decent shape — treat the items below as *enrichment*, not gap-filling, and
> prioritise the finance-math/balance items (which weren't part of the content
> expansion) over adding still more chains.

Thin content is the long-campaign retention killer. Run continuously.

- **Storyline chains**: 15 → 20+ (media scandals, rivalry, holdouts, injury
  crises, takeover, protests, cup momentum, foreign integration, coaching
  conflict, stadium expansion). Fix dead-end on `requiredPrevChoice: 0`.
- **Press conferences**: 12 → 25–30 context-aware questions.
- **Weekly objectives**: 16 → 26+ templates, more conditional (derby win, cup
  progression, youth debut, financial targets).
- **Finance math unification** (trust bugs): league-position prize breakdown vs
  paid amount disagree (`financeHelpers.ts:76` vs `weekAdvance.ts:2056`);
  merchandise ops double-counted (`financeHelpers.ts:87,108`); route everything
  through one shared prize fn + `formatMoney()` everywhere ("£4266K/w" → "£4.3M/w",
  fix "£-12.3M" negatives).
- **Balance**: training gains have no potential cap (+OVR forever,
  `training.ts:83`); training streaks ratchet with no decay; training-preview
  overstates 1.5–3×; academy prospects carry inflated value post age-override;
  staff bonus ignores morale/traits; Ballon d'Or GK ×3.5 leftover. Verify
  market-churn and EFL-goals trends with a 15-season fixed-seed sim before
  acting.
- **Achievement/narrative reachability**: confirm Fortress/Invincible/World
  Beater, Club Legend (uses season-scoped appearances — should be career+season),
  and challenge `extraData` wiring are actually fixed.

---

## 8. TRACK ONLINE — v2.0 (parallel, backend-gated)

From `docs/online-mode-plan.md`. The match engine uses `Math.random()`, so any
shared standings require **server-side simulation**. Ship in independently
valuable slices; do not block on the whole thing.

- **Slice 1 — Accounts + Cloud Save (effort M, ship first, standalone value):**
  Sign in with Apple (anonymous-first + upgrade), Settings "Back up / Restore",
  account deletion (Apple 5.1.1(v)), privacy-label update. This alone fixes the
  "device-local saves" risk and is worth shipping by itself.
- **Slice 2 — Async Online Leagues (effort L):** create league → invite code;
  human + AI clubs in one league; **server-side fixture resolution** (Edge
  Function); realtime standings push; no inter-human transfers in v1.
- **Slice 3 — Head-to-Head Challenges (effort M):** async single-match duels,
  squad/formation picker, friend or global queue, leaderboards.

**Until then:** keep the Online ModeSelect card honest — either hide it or route
to a "coming soon / roadmap" card instead of a dead-end toast.

**Exit criteria per slice:** Slice 1 = cloud backup/restore + account deletion
pass Apple review. Slice 2 = a 3-human league completes a season server-side.
Slice 3 = matchmaking + leaderboard live.

---

## 9. TRACK DEBT — Tech debt (continuous, opportunistic)

- **Oversized files** via `/refactor`: `weekAdvance.ts` (~3,094 LOC),
  `Dashboard.tsx` (~2,192), `match.ts`, `seasonEnd.ts`, `MatchDay.tsx`,
  `matchActions.ts`, `saveMigration.ts`.
- **Test gaps**: slice-direct tests (transfer/loan/orchestration), a full
  game-loop integration test, untested utils (`playerGen`, `aiSimulation`,
  `autoFillLineup`, `weeklyObjectives`).
- **Perf levers**: backdrop-blur is the #1 mobile cost (~118 instances — lower
  default blur, drop `saturate-150`, remove blur from fixed bars); restore scroll
  position on tab switch; idle-poll re-renders (SaveStatusIndicator 15s, Packs
  30s) → lazy minute-boundary ticks; list virtualization on Transfer/Squad.
- **Hygiene**: direct `localStorage` in `orchestrationSlice`/`hallOfManagers`
  (route through `persistence.ts`, tighten ESLint); dead shadcn toast system;
  main chunk ~1.03 MB raw (run `npm run analyze`, chase eager leaks); hidden
  sourcemaps; chunk-load retry on lazy routes.

---

## 10. Ads (deferred, documented)

AdMob was removed after it crashed TestFlight (the build-136 saga). `ads.ts` is a
stub with a documented re-enable path; `AdRewardButton` and pack ad-slots gate on
`NATIVE_ADS_READY = false`. **Do not re-enable until** the ATT/SKAN flow is
verified on a device build and the crash root cause is confirmed fixed. Reward
config (budget boost, double XP, season bonus, per-season limits) is retained for
that future turn-on. Low priority vs Pro/packs revenue.

---

## 11. Cross-cutting guardrails (every release)

- `package.json.version` must never regress below the top `whatsNew.ts` entry —
  the CI marketing-version guard fails the TestFlight build otherwise.
- Merging ≠ shipping: TestFlight is `workflow_dispatch` only. After fixing a
  user-visible bug, tell the user the build must be manually triggered + wait
  ~15 min, and confirm the new CFBundleVersion is higher.
- Entitlement invariants are inviolable: `isPro()` is the only Pro source of
  truth; never check sub SKUs against `entitlements`; never persist consumables
  as entitlements; never reintroduce the hosted paywall (3.1.2(c)); monetization
  never touches sim params.
- Any persisted-shape change → bump `CURRENT_VERSION` + migration step + test.

---

## 12. Sequenced "do this next" list

> **Re-sequenced after 2026-06-21 verification.** Track 0 hardening is done, so
> the World Cup window is now the genuine #1.

1. **v1.1.3 World Cup Live** — ASO refresh + intro/trophy-lift/awards/shareable
   card. *Time-boxed by the real tournament; the single highest-leverage thing
   on the board right now.*
2. ~~Confirm the two §3 residual checks~~ — **done 2026-06-27.** Both were
   non-issues (intended friendly/league co-existence with auto-sim; division-
   scoped Season Race); Track 0 is now fully closed. See §3.
3. **v1.2 Dynasty Legacy P1** — streak/tier surfacing + **analytics funnel**
   (so v1.2+ is measurable). The funnel is the prerequisite for knowing whether
   anything after this works.
4. **Online Slice 1 (cloud save/accounts)** — start in parallel; biggest
   standalone risk reduction (device-local saves are the real exposure now that
   the bug list is clean).
5. **v1.2 P2 (Manager Pass, lifetime Hall, richer legacy)** + finance-math
   unification (the genuinely-open balance/trust items).
6. **v1.3 Identity** (Create-a-Club, Manager RPG, match-view finish).
7. **Online Slice 2/3**, debt refactors, balance pass — ongoing.

---

*Roadmap status: this file is the living plan. As items ship, mark them in the
relevant `docs/*-plan.md`, append release-note bullets via
`npm run whats-new -- <category> "..."`, and keep the §0 state snapshot honest.*
