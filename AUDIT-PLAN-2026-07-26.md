# AUDIT-PLAN-2026-07-26 — Dynasty Manager

> Authored 2026-07-26 against **v1.2.5, save schema v73**, from an 11-agent parallel
> audit (game loop · match engine · economy · UX/mobile · persistence · monetization ·
> depth vs genre · code health · career/NT/WC/challenges · immersion · premium craft ·
> living world). Every claim was verified at `file:line` in live code by the auditing
> agent; the load-bearing revenue and save-integrity claims were re-verified by hand
> before entering this plan.
>
> **Supersedes the open items in `GOALS.md`** (G1–G7 all shipped 2026-07-10 and are
> confirmed still in place — this plan deliberately does not re-plan them; see
> GOALS.md "Corrected record").
>
> Work the phases in order. Mark items done as they ship. Do not let this file rot.
>
> ## STATUS — all phases shipped (21 commits on `claude/game-audit-parallel-agents-ymzznx`)
>
> **Verified 2026-07-27 against the committed branch, nothing in flight:**
> `825 test files · 2,269 tests · 2,265 passed · 0 failed · 4 skipped` (all four
> skips are the env-gated `PERF_AUDIT=1` / balance-report diagnostics, skipped by
> design). Lint: 0 errors, 5 warnings — 4 react-refresh, 1 pre-existing hook-deps
> on `WorldCupDraw` that predates this branch. Build passes; eager first-load
> bundle 518.5 kB gz against a 560 kB budget (41.5 kB headroom). Typecheck clean.
>
> Read the suite result from the JSON summary, not the shell exit code: an
> earlier run in this session reported exit 0 while five tests were failing.
>
> Phases 1, 1A, 1B, 2, 3, 4, 5, 6 and 7 are complete. The three highest-impact
> findings were NOT in the original plan — they surfaced while executing it, and
> each invalidated measurements taken before it:
>
> 1. **65% of AI league fixtures were 3-0 forfeits.** Every AI-sim site built its XI
>    from the first 11 players in raw `playerIds` order, and `isSquadValid` requires a
>    goalkeeper among the starters — 25% of clubs had none in that slice. League
>    tables, promotion, prize money and every balance number measured on a live save
>    were fiction. Fixed to 0% in four measured steps.
> 2. **Squad quality barely affected results.** A measured 19-point OVR gap produced
>    only 59% wins, and a squad +5.4 above its league average finished 20th of 20 —
>    the flattest possible failure for a management game. Now 75% wins at that gap.
> 3. **AI ratings were miscalibrated +1.14 and the development baseline was sampled
>    from them**, so once ratings drove development the player's own squad took a
>    growth PENALTY while every AI squad took a bonus.
>
> Also found while measuring Phase 6: `divisionFixtures` held **83.9 MB of AI match
> events in memory** (1.73 MB persisted) — a regression amplified by fixing the
> forfeits, since AI fixtures stopped being one-event walkovers. Now 1.7 MB.
>
> Fixing the forfeits also completed lower-tier seasons for the first time, which
> exposed (it did not cause) a latent bug: `SeasonTurnover.promotedClubs` mixed
> *arrivals* with *departures* for any middle tier, so the season summary told
> second-tier managers that clubs which had just been promoted away had joined
> them. Split into `promotedOutClubs`, with playoff winners included in it.
>
> **Lesson worth keeping:** four separate times a number taken from a live save was
> wrong because the live save itself was broken (forfeits; a harness that never
> played the player's match; synthetic ratings outnumbering real ones 24:1; 84 MB
> of events hiding behind a 1.7 MB save). Prefer isolated engine measurements, and
> pin them with tests.
>
> A second, smaller lesson from the same run: two failing tests turned out to be
> *encoding the bug as intended behaviour* — a match forfeiting for want of a
> goalkeeper, and a national squad that could never fill 23 shirts. Both were
> deleted and rewritten to assert the behaviour the game actually wants, rather
> than relaxed to fit the code.
>
> ### Known-open, deliberately
> - Foreign leagues have no promotion/relegation (v1 scope).
> - Continental extra time / penalties still use the reputation model — the engine
>   has no 30-minute mode.
> - Audit 6.2 (squad-regen equilibrium flattens leagues) is untouched, and now
>   applies to 4 more leagues.
> - Manager Career job offers became international as an emergent effect of the
>   living world. Reputation-gated and the accept path works; ungated by choice.
> - Existing saves keep their old single-country world; only new dynasties get the
>   living world.

---

## The one-paragraph verdict

The engineering is strong and the feature *inventory* is competitive — 60 pages, 16
slices, 45 leagues, packs, career mode, national teams, a load-bearing 30-perk talent
tree. Three things separate it from premium:

1. **Two save-killing soft-locks and a family of revenue leaks** are live in shipped
   code. These are not polish; they end runs and give Pro away.
2. **Feedback closure.** System after system is built to the point of *display* and
   stops before it changes anything: match ratings drive nothing, yellow cards suspend
   nobody, 44 of ~45 storyline choices resolve to three scalars, in-match decisions
   after minute 45 are theatre, and rivalries you create are cosmetic while rivalries
   you inherit are real. The game presents far more agency than it models.
3. **The world is one country deep and identical every season.** Only the player's
   country is simulated; continental opponents are disposable generated squads. Season 5
   differs from season 1 only in your squad, your perks, and your division.

Fixing (2) is unusually cheap because the content and state already exist — most items
are wiring, not building.

---

## Phase 1 — Stop the bleeding: save-killers and revenue leaks

Nothing else ships before these. Each is either "the player's run ends" or "Pro is free".

### 1.1 National-squad picker can permanently freeze the game loop — **CRITICAL**
`weekAdvance.ts:121-126` force-sets `currentScreen: 'national-squad-picker'` and returns
without advancing while `!tournament.squadConfirmed`. The only unlock is
`confirmNationalSquad`, gated on exactly 23 players meeting position quotas
(`NationalSquadPicker.tsx:204`). The picker's eligible pool
(`NationalSquadPicker.tsx:88-103`) uses exact `nationality ===` (no alias resolution),
applies no fitness/suspension filter, and truncates to the top 50 by overall — so if
that top-50 slice lacks 2 GKs, **Confirm is disabled forever and every Advance Week
snaps back to the picker.** `autoSelectNationalSquad` (`international.ts:672-717`)
returns fewer than 23 without padding, so it can't rescue it either.
- Alias-resolve the picker's pool; guarantee position coverage by appending the best N
  per bucket regardless of the top-50 cut.
- Pad `autoSelectNationalSquad` to 23 by relaxing the fitness filter on a short pass.
- Hard escape in `advanceInternationalWeekImpl`: if quotas are unsatisfiable, auto-confirm
  the best available squad rather than blocking the week.

### 1.2 Retirement has no ending and leaves a broken half-employed save — **CRITICAL**
`careerSlice.ts:618-634` and `weekAdvance.ts:626-634` set `currentScreen:
'hall-of-managers'` and nothing else. `useCareerUnemployed`
(`useGameSelectors.ts:119-124`) returns false once retired, so the retired manager gets
full club tabs for a club they don't manage; `advanceWeekImpl` re-enters the unemployed
branch (`weekAdvance.ts:620`) with weekly "Between Jobs" spam while `respondToJobOffer`
rejects every Accept (`careerSlice.ts:298-300`); after 24 weeks it force-retires again,
bouncing to Hall of Managers on every tick.
- Terminal `careerRetired` flag (persisted → schema bump + migration).
- Retirement/legacy screen with a "New Career" CTA.
- Early-return from `advanceWeekImpl` when retired; gate nav on retirement.

### 1.3 Forced retirement is age-blind and unrecoverable — **HIGH**
`weekAdvance.ts:626-634` retires at 24 unemployed weeks regardless of age (a 40-year-old
gets "retired"), and returns before regenerating vacancies, so nothing is generated
again. Gate on age; otherwise guarantee a desperation offer.

### 1.4 `expiresAt: null` grants permanent Pro to a monthly subscriber — **HIGH** ✅
`monetization.ts:18` — `if (sub.expiresAt == null) return false; // lifetime`. But
`extractSubscriptionInfo` (`purchases.ts:516`) writes `expiresAt:
proEntitlement.expirationDate || null` for **every** tier. A missing/empty
`expirationDate` on an active monthly entitlement (sandbox, some grace/billing-issue
states, promotional entitlements) makes the record permanent: one month paid = Pro for
life, unfixable by later sync because every sync path guards `if (sub) update…`.
Same failure class as the `allPurchasedProductIdentifiers` bug already defended against,
via the date instead of the SKU list.
- Key the non-expiring exemption on **identity** (`tier === 'lifetime'` / one-time
  product id), never on a missing field.
- Anchor recurring tiers with no expiry to a `grantedAt` stamp + tier-length window;
  unanchored → expired (fails closed; sync restores legitimately).

### 1.5 Ads-off turned rewarded-ad bonuses into Pro-only economic buffs — **HIGH** ✅
`AdRewardButton.tsx:36` — `if (!userIsPro && !NATIVE_ADS_READY) return null;` plus the
Pro instant-claim branch at `:44-48`. With `NATIVE_ADS_READY = false` the button is
**Pro-exclusive**, handing paying users, per season: +£500K×2 and +£1M transfer budget,
10 hidden-potential scout reveals, 2 youth previews, 20× double XP — across five screens.
That violates the invariant asserted in both file headers (monetization must never touch
transfer values or any sim parameter), contradicts `PRO_FEATURES` (which contains no
economic perk), and is pay-to-win framing. Fix: `if (!NATIVE_ADS_READY) return null;` for
everyone until ads return.

### 1.6 Save export/import grants arbitrary entitlements — free Pro via shipped UI — **HIGH**
`monetization` (entitlements **and** `subscription`) is persisted in the save slot and
restored verbatim (`orchestrationSlice.ts:995`). `importJsonToSlot`
(`saveBackup.ts:128-167`) sanitises nothing. Exploit: Export Save → edit JSON → add
`"com.dynastymanager.pro"` to `monetization.entitlements` → Import Save → permanent Pro.
`isPersistableEntitlement` is documented as the defence-in-depth boundary and is bypassed
entirely by the load/import path. Fix: strip `monetization` on import and re-derive from
device; longer-term move entitlements/subscription to device-level storage (also fixes
1.7).

### 1.7 Entitlements are slot-scoped → paying users lose Pro offline — **MEDIUM**
Loading a slot saved before purchase replaces in-memory Pro with that slot's stale copy;
recovery depends entirely on `GameShell`'s async RevenueCat sync, which returns `[]`/`null`
on any failure. **A Pro user in airplane mode who loads an older slot loses Pro for the
session** (Turbo/Instant reverts, Optimize Lineup refuses, presets lock). Same root cause
shows the paywall to subscribers on cold launch (`TitleScreen.tsx:101`) and re-arms
`startFreeTrial` on a pre-trial slot.

### 1.8 IndexedDB hydration has no timeout → permanent title-screen hang — **HIGH**
`idbStorage.ts:31-61` resolves only on `onsuccess`/`onerror`/`onblocked`. If
`indexedDB.open` fires no event — a documented iOS WKWebView mode after an app update or
WebView crash with a locked DB — `hydrateSaveStorage()` never resolves and `TitleScreen`'s
`hydrated` stays false forever: three animated skeleton rows, **no Continue, no New Game**,
not fixable by force-quit. Race both `openDB()` (~2s) and `hydratePromise` (~3s) against
timeouts; both layers already degrade to the localStorage mirror.

### 1.9 Migration hardening — **MEDIUM**
- `saveMigration.ts:485-494` (v31→v32) dereferences a possibly-null player while every
  neighbouring migration guards (`:129, :184, :470, :534`). One `null` in `players` throws
  → "Save upgrade failed", and the backup takes the same path so recovery also fails.
  Also audit `:743` (`boardObjectives` assumed array before `.map`).
- `:1299-1330` — `version = (data.version || 1)`. A save with no `version` is driven
  through migration 22, a **deliberate clean break that discards all game state**
  (including `monetization`). Reject non-numeric version as `corrupt` instead.
- The `while (version < CURRENT_VERSION)` loop trusts each step to advance. A step that
  forgets `version: N+1` is an **infinite loop on the main thread** — a hard launch hang,
  not a caught error. Assert monotonic progress.

### 1.10 `attemptSaveRecovery` destroys the primary before the apply can fail — **MEDIUM**
`orchestrationSlice.ts:1111-1116` → `promoteSaveBackup` (`persistence.ts:856-863`)
overwrites the primary **and deletes the backup** before `loadGame` runs. If the apply
throws, both layers are gone. Also `newer_version` should hard-set `canRecover: false` —
today the dialog offers a "recovery" that downgrades the save.

### 1.11 Pre-hydration reads/writes corrupt the storage layer — **MEDIUM**
`readSaveSlot` caches localStorage into `memSlots` as a side effect and `hydrateOneSlot`
skips filled slots, so any pre-hydration read permanently pins that slot to the
localStorage mirror over newer IDB data. Worse, a pre-hydration `writeSaveSlot` sees
`oldMain === null` and **deletes the IDB backup** (`persistence.ts:780`). Reachable via
`migrateLegacySave()` and deep links to `#/select-club` / `#/challenge`.

### 1.12 Manager contracts expire a season early; league moves skip a season — **HIGH**
`finalizeSeason` commits `season: newSeason` (`seasonEnd.ts:1253`) *before*
`runPostSeasonTail(…, season)` (`:1497`), so the expiry check `endSeason <= cs.season`
(`:1724`) fires a year early — a 3-year deal signed in season 1 terminates at the end of
season 2. The same off-by-one inflates history stamping (`:1683, :1717, :1735`), which
`moveToNewClub` then reads (`careerSlice.ts:568`), **losing a full season on every league
change**. Compare against `completedSeason` throughout the tail.

### 1.13 Staff hire silently fails while showing a success toast — **CRITICAL (trust)**
`StaffPage.tsx:545` fires `successToast('Staff Hired', …)` unconditionally;
`hireStaff` (`systemsSlice.ts:111-118`) returns `void` and no-ops on insufficient budget.
The reason exists only in a `title=` attribute (`:587`) — invisible on iOS. Return
`{success, message}`, toast conditionally, render affordability as visible text.

### 1.14 The tutorial gives instructions that cannot be followed — **CRITICAL (trust)**
`OnboardingChecklist.tsx:166-167, 187-189` tell the player to open More → Scouting and
More → Staff. **Neither is in the More drawer** (`MoreDrawer.tsx:46-83`); `scouting`,
`staff`, `training`, `youth-academy`, `packs`, `squad`, `tactics`, `transfers` are all
absent. Two of three onboarding tasks are unfollowable. The drawer's placeholder also says
"Search all features…" while filtering only `drawerSections` — typing "training" returns
nothing. Rewrite the steps to real paths; extend drawer search to `SQUAD_SUB_NAV` +
`MARKET_SUB_NAV` (`config/ui.ts:379-391`).

### 1.15 "Load Game" wipes progress with no confirmation — **CRITICAL (data loss)**
`SettingsPage.tsx:593-606` — bare `onClick` → `loadGame()`. With auto-save off, a mis-tap
discards every week since the last manual save; "Reset Game" is two buttons below and its
"Confirm Reset" (`:639`) has **no description at all**. Add a confirm naming the slot and
`lastSavedAt`, a `Slot N · Club · S# Wk#` header over the button stack, and a real Reset
description.

### 1.16 PostMatchPopup has no height cap and no scroll — possible post-match soft-lock — **HIGH**
`PostMatchPopup.tsx:106-116` — `fixed inset-0 items-center` with `touchAction: 'none'` and
**zero** `max-h`/`overflow-y`. On a short device after a goal-heavy match, "Continue" can
land off-screen and the panel can't be scrolled. Add `max-h-[85vh] overflow-y-auto
overscroll-contain` to the inner panel; move `touchAction: 'none'` to the backdrop.

### 1.17 Money sliders are 6px tall — the core transfer control can't be grabbed — **CRITICAL (usability)**
`h-1.5` on `input[type=range]` at `ListForSaleModal.tsx:174`, `LoanNegotiation.tsx:250,
281, 349`, `IncomingOfferNegotiation.tsx:319`, `TransferNegotiation.tsx:369`,
`ContractNegotiation.tsx:369`. The hit box *is* the element box. `LiquidGlassSlider.tsx`
already does this right. Make the input `h-11` with a transparent track and paint the rail
as an absolute sibling.

---

## Phase 1A — Match engine: the difficulty curve is broken and one dropdown is the difficulty slider

> **These numbers are measured, not derived** — headless vitest runs against
> `src/engine/match.ts` (400–800 samples/cell, cloned identical squads) plus 10-season
> `useGameStore` runs. `docs/balance-report.md`'s claimed PL mean of 2.59 g/m **did not
> reproduce** (measured 2.25, drifting *down* S1→S9).

**Baseline vs real football** (identical ~75-OVR squads, both `balanced`, N=400):

| Metric | Engine | Real |
|---|---|---|
| Goals/match | **1.54** | 2.6–2.9 |
| 0-0 | **25.5%** | ~7–8% |
| Draws | **40%** | ~25% |
| Fouls/match | **9.5** | ~21–22 |
| Yellows/match | **1.47** | ~3.5–4 |
| Penalties/match | **0.785** | ~0.27 |
| **Penalty share of all goals** | **35–40%** | ~9% |

- **1A.1 `all-out-attack` is strictly dominant — CRITICAL.** Mentality's attack modifier is
  applied **twice** (team strength *and* additively to per-shot conversion via
  `GOAL_CHANCE_ATTACK_MOD_SCALE`: +0.175 on a ~0.08 base = **3.2× conversion**) while its
  defensive counterweight is applied **once, damped by `DEFENSE_MODIFIER_SCALE = 0.3`**, and
  never touches the opponent's conversion at all. Measured, identical squads:
  defensive 0.98 pts/g · balanced 1.27 · attacking 1.99 · **all-out-attack 2.33**. You score
  2.9× more **and concede less**. Live, same club, same 4 seasons, only `setTactics` differs:
  balanced → 15th/9th/7th/5th; all-out-attack → 2nd/3rd/**2nd (97pts, 136GF, 21GA)**/6th.
  `meta vs meta` = 8.71 g/m, `bus vs bus` = 0.50 — **no scoring regulator anywhere.**
  `config/keyMoments.ts:49-54` bakes the exploit into the "correct" key-moment answer, and
  `aiManager.ts:171-176` hands the same 3× conversion to any AI two goals down.
  *Fix: pick one channel — drop `GOAL_CHANCE_ATTACK_MOD_SCALE` to ~0.08, or remove `attackMod`
  from `computeStrengths` and add a symmetric `- oppMods.defenseMod * scale` to `goalChance`.*
- **1A.2 `tacticalFamiliarity` is the largest term in the game and only the player gets it —
  CRITICAL.** `famBonus = familiarity * 0.012` (`matchEngine.ts:115`) sits in the same
  parenthesis as `HOME_ADVANTAGE` (1.15). Measured `computeStrengths`: no player club
  `homeStr 114.5`; player at fam 45 → **153.6**; at fam 100 → **201.4** (share 52.5% → 66.0%).
  For scale, all-out-attack with no familiarity is 150.7. **+1.20 dwarfs everything else**
  (mentality ±0.50, formation ±0.10, chemistry 0.08, home 0.15), it reaches 100 by ~week 28 of
  season 1 with zero player input, and AI-vs-AI passes `playerClubId: undefined`
  (`weekAdvance.ts:729,1130`) so **no AI club ever gets it**. Undocumented, permanent, one-sided
  ~2× multiplier. *Fix: multiplier → 0.001 (max +0.10, in line with chemistry), or give AI
  clubs a familiarity value.*
- **1A.3 Penalties are 3× too frequent, supply ~38% of goals, and are awarded inversely to
  quality — CRITICAL.** Fouls go to the **event team**, and the event team is chosen by
  strength share (`match.ts:1180`), so the *better* team fouls more and therefore **concedes
  more penalties**. Measured: elite 88 v weak 52 → pens awarded home 0.276 / away 0.474; the
  weak side's goals are **64–65% penalties**. This is the primary mechanism flattening the
  quality curve — a 52-OVR squad's entire ability to score against an 88-OVR squad is spot
  kicks, a channel that ignores quality completely. *Fix:
  `PENALTY_FROM_FOUL_CHANCE ≈ 0.028`, and allocate fouls to the **defending** side.*
- **1A.4 AI clubs' players never develop or decline — `potential` is meaningless for 755 of 756
  clubs — CRITICAL.** `applyPlayerDevelopment` is inside `playerClub.playerIds.forEach`
  (`weekAdvance.ts:829,900`); `seasonEnd.ts:580-596` only increments age and resets stats.
  Measured 10 seasons: player top-11 OVR edge goes **−4.3 → +0.5 → +5.2** while the league
  loses ~6 OVR and ages 4.4 years. AI wonderkids never become stars (so scouting/potential is
  a player-only mechanic), AI 36-year-olds never decline, and league goals/match sags with it.
  With 1A.2 and `AI_INCOME_MULTIPLIER = 0.85`, **difficulty decays monotonically.** *Fix: a
  cheap season-end growth/decline pass over all clubs (×46-scaled chance).*
- **1A.5 Player ratings barely translate to results — HIGH.** A 21-OVR gap gives the elite side
  only W47/D34/L18. In the live 10-season run a squad **+5.2 OVR above its league average
  finished 11th of 20.** Strength is affine-linear (`avg * (0.7 + fit*0.2 + morale*0.1)`) and
  conversion is a *difference* of two co-varying terms, so the only real channel is event share,
  compressed by the 0.7 constant. `matchBalance.test.ts:89-97` already documents this and
  treats it as acceptable. *Fix: map overall non-linearly (Elo-style) and scale `goalChance` by
  an attack/defense **ratio**.*
- **1A.6 Goalkeeper quality is nearly irrelevant — HIGH.** The goal roll resolves **before** the
  save roll (`match.ts:1242` vs `:1392`), so `oppGKSave` only relabels an already-decided
  non-goal. Measured, only the away GK's attributes changed: attrs 35 → 0.965 conceded/match;
  attrs 99 → 0.780. A **64-point swing buys −19% goals**, and a better keeper makes the
  opponent's shot accuracy look *better*. Signing a world-class keeper is close to a wasted
  transfer.
- **1A.7 Discipline stats are visibly wrong — HIGH.** 9.5 fouls/match (real ~21) → 1.47 yellows
  (real ~3.5–4) with 0.125 reds, a yellow:red ratio of **12:1 against a real ~35:1**. The
  `MatchStats` fouls line (4.7 vs 4.6) will read as obviously broken to any football fan. No
  yellow-accumulation bans (see 2.2), so rotating for discipline is a non-mechanic.
- **1A.8 Under-dispersed and unregulated — HIGH.** 25.5% 0-0, 40% draws, margin ≥4 in only 1.5%;
  total g/m ranges 0.50 → 8.71 purely on tactic selection. The "target 2.6–2.9 PL band"
  documented at `matchEngine.ts:154-158` is an artifact of the AI-manager style mix, not an
  engine property. **Fix 1A.1 before re-tuning `GOAL_CHANCE_ATTACK_MULT`** or you tune against
  a moving base.
- **1A.9 `defensiveLine: high` and `pressingIntensity` are trap options — HIGH.** Measured:
  deep 1.35 / normal 1.40 / **high 1.18** pts/g; pressing 25 → 1.40, 75 → **1.32**.
  `DEFENSIVE_LINE_COUNTER_VULN` only ever feeds the *opponent's* conversion, so a high line has
  literally zero upside and the `counter_attack_goal` flavour it unlocks is cosmetic.
- **1A.10 Tempo is symmetric — your tactic gives the opponent equal extra shots — HIGH.**
  `eventChance = base + (homeMods.shotMod + awayMods.shotMod) * 0.5` (`match.ts:1145-1148`) is a
  single shared probability. Home `fast` → 13.0 vs 12.5 shots and **−0.06 pts/g**. Tempo is a
  "how many goals in this match" dial, not a tactic. *Fix: apply `shotMod` per-side.*
- **1A.11 `getFormationFitBonus` is a set-cover check, not an assignment — MEDIUM.**
  `match/helpers.ts:162-173` asks whether *any* player could fill each slot without consuming
  players. Measured: an optimal 4-3-3 scores 0.250 (the ceiling), a **random 11 still scores
  0.100**. Playing a CB at LW is barely punished, and for normal lineups the term is a constant
  +0.25 on both sides — dead weight.
- **1A.12 Formation is an order of magnitude weaker than mentality — MEDIUM.** Full sweep:
  1.21 (5-3-2) → 1.39 (4-3-3) pts/g, a 0.18 spread against mentality's 1.06 swing.
- **1A.13 Defensive quality frozen at kickoff — MEDIUM.** `match.ts:404-405` computes it once
  from the starting XI while strength and GK save are refreshed on every red card, injury and
  sub. **Losing your best centre-back to a red card does not raise your concession rate.**
- **1A.14 Missing expected events — MEDIUM.** No offside event or stat (offside exists only as
  VAR flavour text), no blocked shots, no cards/offsides/passing in the stats panel. VAR
  effectively never overturns anything (0.08 inside a 0.12 gate = 1 per ~104 goals). Own goals
  0.013/match vs real ~0.04. Auto-simmed shootouts log `takerName: homeName` — **the club
  name** — so they have no takers, no attributes, no player stats.
- **1A.15 Two concrete bugs — HIGH/MEDIUM.**
  - `match.ts:1418`: `perkSetPieceBonus = (isHome && setPieceCoachBonus) ? …` — the bonus is
    derived from the **player's** Set-Piece Coach perk but gated on `isHome`, so **in every away
    fixture the player's paid perk buffs the AI opponent's corners.** Should compare
    `(isHome ? homeClub.id : awayClub.id) === playerClubId`.
  - `match.ts:1431`: corner xG adds `CORNER_GOAL_CHANCE` *after* the gate already passed →
    corner xG under-reported ~3×; `goalkeeper_error` and `own_goal` add no xG at all.
- **1A.16 The test gap that let all of this through — HIGH.** `matchBalance.test.ts:50-154`
  asserts clean sheets 5–75%, draws 10–45%, goals 1.0–3.5, "home wins ≥ 0.9× away wins".
  **Every finding above passes green.** Nothing asserts goals/match against a target band,
  penalty share of goals, fouls/cards per match, tactic-choice win-rate parity, or
  player-vs-league OVR drift.

**Order within this phase is load-bearing:** 1A.1 → 1A.3 → (1A.2 + 1A.4 together) → 1A.5/1A.6 →
only then re-tune `GOAL_CHANCE_ATTACK_MULT`/`FOUL_THRESHOLD`/`CARD_BASE_CHANCE` against
tightened assertions → then 1A.9–1A.12.

*Continental/international paths call the same `simulateHalf`/`simulateMatch`, so 1A.1–1A.6
propagate there unchanged. AI-vs-AI simulation is **consistent** with the player's engine — the
divergence is entirely the player-only bonus stack (familiarity, first-season boost, team talks,
shouts, disciplinarian, set-piece coach), none of which AI clubs receive.*

---

## Phase 1B — Economy: exploits and the broken difficulty curve

> Bookkeeping itself is **solid** — `rosterOps.ts` centralises the seller/buyer/lineup/subs/
> clubId/market cleanup, `executeSale` guards `clubId` and `onLoan`, and `seasonEnd.ts:730-736`
> recalculates every `wageBill` from actual wages each year so drift self-heals. **No
> double-sale, no wage/budget desync, no orphaned roster.** Everything below is pricing,
> balance, and dead surface area.
>
> ⚠ Re-tuning caution carried from the audit: the magnitude figures are derived from config
> constants and league data, not from a running economy. Confirm against `src/test/balance*`
> output before re-tuning — a wrong correction on matchday income starves the top flight.

- **1B.1 The whole difficulty curve is flat — CRITICAL.** `MATCHDAY_INCOME_PER_FAN = 50_000`
  (`gameBalance.ts:183`) multiplies `fanBase`, which is a 0–100 popularity index, not a
  headcount. Average `fanBase` spans PL 53.9 → League Two 41.4 (**30%**) while `averageWage`
  spans £120k → £6k (**20×**). AFC Wimbledon clears ~£2.6M/wk against a ~£150k/wk wage bill
  → **~£110M profit in season 1**, against a whole-league prize pool of £1.5M — roughly what
  Arsenal nets. Fee transfers have **no reputation cap** (only free agents do,
  `transferSlice.ts:685`), so a League Two side buys 85-OVR players in its first window.
  Also matchday pays **every week**, including away games, byes and post-season (no
  home-fixture check at `weekAdvance.ts:2160`), roughly doubling the intended figure.
- **1B.2 Signature drops mispriced ~30× — CRITICAL.** `SIGNATURE_DROP_BONUS_PER_MARKET =
  18_000` (`merchandise.ts:179-187`) with a doc comment assuming marketability "≥10", while
  `getPlayerMarketability` returns 40–150. A marketability-116 striker yields **£6.44M gross
  on a £75k outlay (86×)** — more per week than the club's entire wage bill. ~5 drops/season
  ≈ **£30M for £375k**. Zero test coverage.
- **1B.3 Star-player merch bonus bypasses every scaling term — CRITICAL.**
  `utils/merchandise.ts:121-133` adds `starPlayerBonus` and `signatureBonus` *outside* the
  multiplicative chain, so they ignore league quality, product lines, pricing and campaigns.
  `merchBonus = marketability × 3_000` with an **uncapped** `(goals + assists) × 2` term —
  i.e. **£6,000 of permanent weekly revenue per goal or assist**. Championship top-3 = 
  £723k/wk = 119% of that club's wage bill. And `Math.max(0, …)` means merchandise **can
  never be a net loss** while `financeHelpers.ts:104-109` reports a fabricated gross.
- **1B.4 Listings never expire and freeze their asking price — CRITICAL.**
  `listPlayerForSale` (`transferSlice.ts:530`) stamps no `listedWeek`/`listedSeason`, and
  `processListingExpiry` keeps unstamped listings forever. AI bids anchor to it
  (`ASKING_PRICE_BID_ANCHOR = 0.85`, `transferMarketGen.ts:304-307`), so list at 2× value in
  week 1, and three seasons later — after `VALUE_AGE_MULTIPLIERS` has cut real value to ~20% —
  AI clubs still bid **~8× the player's worth, forever**. No dedupe either, so repeat calls
  stack duplicate listings.
- **1B.5 Sub-£5M flips are clause-free — HIGH.** `executeTransfer` attaches a sell-on clause
  only when the buy fee ≥ `SELL_ON_LOW_FEE_THRESHOLD` (£5M), so every purchase under that
  flips completely clean. AI lists at 1.10–1.55× value and accepts asking price 85% of the
  time; relist at the 2.0× UI max (2.4× with `kingmaker`) → repeatable across 18 spare squad
  slots every window.
- **1B.6 Scouted listings bypass the transfer window entirely — HIGH.**
  `transferSlice.ts:328` — `if (!state.transferWindowOpen && !listing?.scoutedPlayer)`.
  Scouting reaches 85 OVR (`config/scouting.ts:19`) with no reputation gate, so the documented
  "weeks 1–8 and 20–24" constraint is **optional**: keep scouts assigned, sign 85-OVR in week
  30. Sales aren't window-checked *at all*, and offers live 4 weeks past the deadline.
  Secondary leak: scouted players are freshly generated and assigned to a random AI club that
  never held them, yet `executeTransfer:422-424` still credits `oldClub.budget += fee`,
  **minting money for a phantom player**.
- **1B.7 Scouting can be made literally free, and the Watch List leaks the fog — HIGH.**
  Completed assignments are filtered out (`weekAdvance.ts:2007`) *before* the bill is computed
  (`:2178`), so the final week of every assignment is unbilled — and with `scout_network`
  a `domestic` assignment goes 2→0 on its first tick, completing before it is ever billed:
  **£0, repeatable weekly per scout, forever.** Separately `utils/scouting.ts:52-70` carefully
  fogs OVR *and* potential, then the Watch List renders `{player.overall}` and
  `Pot. {player.potential}` **raw** — two taps defeats the whole subsystem.
  `estimatedPotential` is computed at `:67` and thrown away.
- **1B.8 Shortening a sponsor deal buys a risk-free +50% — HIGH.**
  `durationDemand = durationDelta * NEG_DURATION_WEIGHT` is **signed**
  (`sponsorship.ts:276-298`), so cutting seasons credits demand budget: rep-5 + `platinum_fin`
  goes £580k/wk → **£879k/wk accepted on round 1**. Deterministic, bounds shown in the UI
  steppers, and a short deal costs nothing since offers regenerate every 2 weeks and
  `seasonEnd.ts:1266-1267` wipes all cooldowns at rollover.
- **1B.9 One free click permanently buys +20% matchday income — HIGH.** Repo-wide, `fanMood`
  is written only by press-conference effects and the merchandise **pricing tier** — match
  results never touch it. `budget` pricing ratchets mood 50→100 in 25 weeks and holds, worth
  a permanent **+£300k/wk** for ~£8k/wk. `premium` (1.4×) only multiplies the base term, which
  the star bonus dwarfs, so it is strictly dominated and its label is misleading.
  `config/ui.ts:207` tells players "Good results and winning streaks keep fans happy" —
  **both halves are false.**
- **1B.10 Negative budget is consequence-free and FFP is measured two different ways — HIGH.**
  No floor at `weekAdvance.ts:2183`, nothing reacts to insolvency, and `FinancePage.tsx:78`
  promises board intervention that doesn't exist. The engine computes
  `totalExpenses / weeklyIncome` (all costs, merch **net**) while FinancePage computes
  `club.wageBill / weeklyIncome` (player wages only, merch **gross**) against hardcoded
  `70`/`90` instead of config — so players read "62% — Healthy" while the board applies −6
  confidence/week.
- **1B.11 `renewContract` is dead code — MEDIUM.** No non-test caller
  (`transferSlice.ts:763-812`); the live path is `startNegotiation`/`submitWageOffer`
  (`featureSlice.ts:552-645`), which charges only agent + loyalty. So
  `SIGNING_BONUS_WEEKS_PER_YEAR = 12` and the FFP wage warning **never fire in-game**, and
  `agentFee` is computed from the player's *current* wage (`utils/contracts.ts:96-100`), so
  tripling a wage costs the same as not raising it. **Renewals are ~10× cheaper than config
  implies.**
- **1B.12 `galactico` forgives its own overspend — MEDIUM.** `budgetCap = budget * 1.2` then
  `Math.max(0, budget - fee)` (`transferSlice.ts:385-447`) — the perk is meant to put you in
  debt; instead 20% of your budget is a once-a-season gift.
- **1B.13 Loan-out is unreachable; loan durations use the wrong season length — MEDIUM.**
  `loanSlice.ts:140` `loanOut` has **no UI caller**, so the player can never proactively offer
  someone out — and as written it has no acceptance roll or wage-affordability check, so
  wiring it up naively would be exploitable. `:234,388` compute elapsed weeks with the global
  `TOTAL_WEEKS` (46) instead of `state.totalWeeks`, so in a 38-week league a cross-boundary
  loan is credited ~8 extra weeks and **terminates early**.
- **1B.14 Dead and lying upgrade paths — MEDIUM.** `facilities.trainingLevel` has **no
  mechanical effect** (`utils/training.ts:51-57` takes staff bonus + recovery only) while
  `FacilitiesPage.tsx:17` advertises "Better training gains for all players" — levels 5→10
  cost £200M and change nothing. Youth Academy upgrades don't affect intake quality
  (`seasonEnd.ts:1072` reads the static `club.youthRating`, not `facilities.youthLevel`)
  while `FacilitiesPage.tsx:18` claims otherwise. `getStadiumCapacity` is cosmetic. Four staff
  stats (`trainingGains`/`youthPromotions`/`scoutFinds`/`injuriesPrevented`) are rendered at
  `StaffPage.tsx:438-461` and only ever set to 0. `end_of_season_sale` is unreachable in 33 of
  46 leagues (`MIN_WEEK = 38` vs `totalWeeks ≤ 34`), and `kit_launch` is a **guaranteed
  ~£255k loss** for a rep-2 club while the UI advertises "+80%".
- **1B.15 Free labour — MEDIUM.** Firing staff costs nothing (`systemsSlice.ts:149-167`)
  despite a paid renewal fee and despite `releasePlayer` charging full severance. Free agents
  **never refuse** (`transferSlice.ts:669`, no acceptance roll) and the UI floors at 0.7×, so
  every free agent signs at a guaranteed 30% discount — while real contract negotiation *does*
  fail meaningfully. No facility or academy upkeep anywhere.
- **1B.16 Release clauses are a fully dead feature — MEDIUM.** `releaseClause`
  (`types/game.ts:226`) is read at three sites and displayed in two, and **never written by
  any production path** — no player ever has one. Also absent: buy-back clauses, agent fees on
  transfers, squad registration/homegrown quotas, any hard FFP constraint (no embargo, no spend
  cap), separate wage vs transfer budgets, and any request-funds flow. *(Sell-on clauses and
  deadline-day drama are implemented and work.)*
- **1B.17 Youth is NOT a money printer — cleared.** Intake is season-end only, 2–4 prospects,
  capped at `YOUTH_QUALITY_MAX = 65`, and unpromoted prospects are deleted at the next
  rollover. Ceiling is £1–4M/season of zero-basis value against £2–6M/wk of income — real but
  not runaway. One small bug: the academy dev tick (`weekAdvance.ts:2098-2114`) raises
  `overall` without `recomputePlayerValueOnly`, so wage is permanently 5–20% under-priced.

**Fix-five shortlist if budget is tight:** 1B.1 (the difficulty curve) · 1B.2 + 1B.3 (merch) ·
1B.4 (one line, kills the biggest transfer exploit) · 1B.7 (free scouting + fog leak) ·
1B.8 (one clamp).

---

## Phase 2 — Close the feedback loops (the cheap depth)

This phase is where the game stops *presenting* agency and starts *modelling* it. Almost
all of it is wiring existing state, not new systems.

### 2.1 Match ratings must drive development, morale and form — **S, highest ratio in the audit**
Ratings are computed at `match.ts:1889-1928` and used **only** for Ballon d'Or
(`ballonDor.ts:24`). Development reads `p.appearances` only
(`development.ts:39`); morale/form are pure win/draw/loss
(`matchProcessing.ts:163-181`). So man-of-the-match in a defeat takes the same morale hit
as the player sent off, and a 4.0 develops identically to a 9.0. **Watching the match
currently teaches you nothing you can act on.**

### 2.2 Yellow-card accumulation suspensions — **S**
Yellows are tracked (`orchestration/helpers.ts:165-166`) and cause **nothing**; only reds
suspend (`:169`). A 5/10/15-yellow ban makes `pressingIntensity`, `temperament`, the
`disciplinarian` perk and squad depth all matter at once.

### 2.3 Board interaction — the biggest unbuilt interaction surface — **S/M**
`BoardPage.tsx` exposes exactly one action: `resignFromClub`. No request-funds, no
negotiate-objectives, no request-facility-investment, no promises — while
`boardConfidence`, `boardObjectives`, `boardUltimatum` and `budget` all already exist.
`club.boardPatience` is loaded on every club and **never read by the sacking path**
(`weekAdvance.ts:2470-2516` uses global constants), so a patient board sacks you exactly
as fast as an impatient one.

### 2.4 Carry match fitness through the week; track minutes played — **S/M**
The engine models per-minute fatigue (`match.ts:1083-1103`) then throws it away: post-match
drain is a flat `-10` for everyone (`matchProcessing.ts:161-162`), so a 90-minute shift at
high pressing costs the same as an 87th-minute cameo. `grep minutesPlayed` → **zero hits
in `src/`**. Rotation is therefore not a real decision, which under-rewards squad depth,
the bench, medical facilities and the whole fixture-congestion system.

### 2.5 Give storyline choices teeth — **M**
`storylineChains.ts` is 657 lines, 15 chains, ~45 decision points, well written — and
**exactly one option in the file has a real consequence** (`featureSlice.ts:350-493`).
Everything else resolves to three scalars (`:301-323`). Options that promise actions the
game never performs: "Appoint a new captain" (`:43` — there is no captain system), the
entire "Passing the Armband" step (`:584-593`), "Sign an emergency loan" (`:239`), "Put him
on the transfer list" (`:83`), "Tie him to a long contract" (`:122`), "Overhaul the medical
setup" (`:250` — `facilities.medicalLevel` exists), "Present a scholarship contract"
(`:471` — no prospect is created). Trigger conditions are near-vacuous too:
`injury-crisis` fires on `recentLosses >= 1 && week >= 5`, i.e. not on whether an injury
crisis is happening. **Narrative that reads as reactive but isn't is worse than none.**

### 2.6 Captain, vice-captain, squad hierarchy — **S/M, genre-standard and absent**
`captain` exists only as a cosmetic armband index (`types/game.ts:275`) and a narrative
tag. `personality.leadership` feeds only a squad-wide morale sum. Adding captain + a
three-tier hierarchy creates a weekly decision, gives `leadership` a purpose, and unlocks
the storyline steps in 2.5.

### 2.7 Storylines stop firing entirely after ~2–3 seasons — **CRITICAL for a dynasty game**
`completedStorylineChainIds` (`storeTypes.ts:167`) is appended at `weekAdvance.ts:1760`
and **never reset**; completed chains are skipped (`:1815-1817`). 15 chains, one at a time,
25%/week from week 5 → a season burns 6–8, so by season 2–3 `StorylineModal` never appears
again for the rest of a 10-season dynasty. Also `:1816` iterates in fixed array order and
takes the first eligible, and predicates overlap heavily, so **every save tells the same
story in the same order**. Fix: season-scoped cooldown (not a wipe) + pick randomly among
all eligible.

### 2.8 Board objectives never ratchet; there is no medium-term goal — **M**
`generateObjectives` (`orchestration/helpers.ts:210-269`) is a pure function of
`club.reputation`, which moves ±1/season clamped 1–5 (`seasonEnd.ts:801-806`) and saturates
in ~4 seasons. **Season 9's objectives are byte-identical to season 4's.** No stated
ambition exists anywhere: `CareerOverview.tsx` contains zero goal language,
`DynastyLegacy.tsx` is read-only. Short-term (weekly objectives, streaks, daily packs) is
strong and long-term (46 achievements, 30 perks, prestige) is strong — **medium-term is the
hole, and medium-term is what drives return sessions.** Ratchet objectives against the
player's own history; add a visible career ladder wired to existing `reputationTier` /
`legacyScore` / `careerHistory`.

### 2.9 Make the live match actually live — **M/L (expensive; on impact alone it is #1)**
`matchActions.ts:1042` simulates minutes 1–45 in one call, `:1201` does 46–90.
`MatchDay.tsx:556-618` is a ticker revealing a pre-computed array. Therefore: a sub during
second-half playback does **nothing** but change the lineup and fabricate an event; a shout
during the second half does **nothing**; the marquee key-moment overlay is **cosmetic** for
everything after minute 45; a second-half injury skips the auto-sub so you finish a man
down with a decorative substitution. Restructure `simulateHalf` into resumable chunks
bounded at the existing key-moment minutes — this retroactively activates five shipped
features. Two cheap sub-fixes in the same file: `homeMods`/`awayMods` are `const` at
`match.ts:313` and never recomputed, so an AI switch to all-out-attack at minute 75 moves
only strength, not `counterVuln`/`shotMod`/`foulMod`; and defensive quality is computed
once at kickoff (`:404-405`, read at `:1187`), so sending off your best CB doesn't change
the opponent's goal chance.

### 2.10 Emergent rivalries never touch the simulation — **S**
`grudgeLevel` is written (`matchProcessing.ts:311-315`) and read only for display
(`rivalries.ts:147`, `RivalriesPage.tsx:59`, `MatchPrep.tsx:382`, `weekPreview.ts:382`).
Only hardcoded `DERBIES` intensity affects matches — so **rivalries you create are
cosmetic while rivalries you inherit are real.**

### 2.11 Game plans are dead on the Instant Sim path — **S**
`config/gamePlan.ts` is consumed at `matchActions.ts:1041, 1198`, but `simulateMatch` has
no modifier parameter (`match.ts:1942-1959`) and hard-passes `undefined` at `:1982`/`:1998`.
**A Pro feature (instant sim) silently disables a tactical system.**

### 2.12 Challenge integrity — **M**
Completion is evaluated only at season end (`seasonEnd.ts:1149-1196`); mid-season only
checks failure, and only for two scenarios (`weekAdvance.ts:2356-2371`), so a 1-season
"win the cup" challenge stays "Active" for weeks after the cup is won. Advertised
constraints with no code behind them: `promotion-express`'s tier floor, `youth-revolution`'s
all-U23 XI, the "no transfers over £5M" cap. `great-escape` documents a lowest-rep
assignment but only `giant-killer` is force-assigned (`ChallengePicker.tsx:55-59`) — you can
run "The Great Escape" from Manchester City. Failure **removes** restrictions
(`transferSlice.ts:40, 672`, `packsSlice.ts:35` all return allowed once `failed`), so
failing is a reward. `seasonEnd.ts:1182` ignores `addCompletedChallenge`'s newly-added
return, so **XP re-pays on every repeat**. Progress is invisible (`Dashboard.tsx:947-955`
shows only "N season(s) left") and `activeChallenge` is never cleared, so terminal chips
render for the rest of the save. `startChallenge` also inherits the previous session's
`gameMode` (`featureSlice.ts:772-811`), so a challenge after a World Cup renders the WC
dashboard over a club save.

### 2.13 Other confirmed feedback gaps
- Club records are **absent from the club-change reset set** (`careerSlice.ts:506-559`), so
  "all-time club top scorer" bleeds across clubs in career mode; only one record ever
  surfaces as a chase (`records.ts:137` `.slice(0,1)`).
- International match results are a literal coin flip
  (`weekAdvance.ts:157-158`: `Math.random() * 3 * hStr + …`) sitting beside a detailed club
  engine; career NT tournaments never invoke the real engine even though World Cup mode has
  a full live path (`worldCupMatchActions.ts`).
- Shout durations/cooldowns (`matchEngine.ts:407-409`) drive a live indicator but the engine
  never sees a timed effect; `time_waste`'s `stoppageTimeAdd` is discarded
  (`matchActions.ts:401`).
- xG is tautological — `match.ts:1239-1242` accumulates the same number used for the goal
  roll. Possession is invented post-hoc from shot share (`:1846-1853`).
- Formation-fit counts a slot as filled if *any* outfielder in the pool `canPlayPosition`
  (`match/helpers.ts:168-171`), so one utility player satisfies several slots he isn't
  standing in.
- Transfer clauses: `releaseClause` and `sellOnPercentage` exist on `Player`
  (`types/game.ts:226-228`) but can't be negotiated; no installments, buy options, or
  appearance fees.
- 8 of ~45 in-game screens expose **zero** store actions (`CompetitionsPage`,
  `RivalriesPage`, `HallOfManagers`, `ManagerProfile`, `CalendarView`) or only `setScreen`
  (`TrophyCabinet`, `ClubPage`, `DynastyLegacy`).
- `PlayerDetail.tsx:225` tests `personality.temperament < 40` on a **1–20** scale, so
  "Volatile temperament" is listed as a negative for *every player in the game*.

---

## Phase 3 — Career-mode correctness and progression sanity

- **3.1** Unsolicited job offers bypass the reputation gate the interview path enforces —
  `respondToJobOffer` (`careerSlice.ts:283-305`) checks only retirement age while
  `startInterview` requires `vacancy.minReputation` (`:92-94`). Offer generation sorts
  descending by elite weight and picks from the top 10 (`managerCareer.ts:621-629`), which
  is literally Real Madrid / Bayern / Man City tier. **At reputation 250 you cannot
  interview for a Premier League job but can be handed Real Madrid unprompted.** Primary
  progression exploit in career mode.
- **3.2** National-team job cannot be resigned; declining once forfeits it forever.
  No `resignFromNationalTeam` exists; the re-offer path (`seasonEnd.ts:1408-1410`) requires
  `nationalTeamSacked`, which `declineNationalTeamOffer` never sets
  (`nationalTeamSlice.ts:336-351`).
- **3.3** NT sacking heuristic misreads its own round labels — `weekAdvance.ts:557` tests
  `includes('16'|'Quarter'|'Semi'|'Final')` against values actually stored as
  `'R32'|'R16'|'QF'|'SF'|'F'` (`:366`). Only `'R16'` matches, so **losing a continental
  final counts as a group-stage exit** and can get you sacked for "2 consecutive group
  exits".
- **3.4** Desperation vacancies are arbitrary — `weekAdvance.ts:648-668` takes the first two
  clubs in insertion order (possibly a giant) at £1,500 salary. Sort by ascending
  reputation.
- **3.5** Job requirements ignore the club entirely — `getMinReputationForLeague`
  (`managerCareer.ts:676-684`) keys only on league tier, so Real Madrid and Getafe both
  require 500.
- **3.6** Bracket generators silently drop an unpaired winner (`weekAdvance.ts:447-458`,
  `international.ts:637-641`) and an empty round would make `advanceWeek` a permanent no-op
  (`processKnockoutRound:626` → `every()` on `[]` → true). Not reachable at current configs;
  one config change from bricking saves. Give a bye; guard the no-tie case.
- **3.7** Restore Purchases tells subscription-only customers "No Purchases Found"
  (`SettingsPage.tsx:231-247`) — `mapEntitlements` excludes sub SKUs by design, so
  `restorePurchases()` returns `[]`, and the toast fires *before* the sync two lines later
  actually restores Pro. `SubscribeOnboarding.tsx:274-295` already fixed exactly this; the
  Settings copy never got the same treatment. **This is the Restore path an App Review
  tester exercises.**
- **3.8** A failed post-purchase sync leaves annual subscribers on a 7-day local window
  (`SubscribeOnboarding.tsx:224-227` → `startFreeTrial` always writes `FREE_TRIAL_MS`).
- **3.9** `saveTacticalPreset` (`systemsSlice.ts:42-52`) has no `isPro` guard, unlike
  `autoFillTeam` (`clubSlice.ts:47-58`) which re-checks specifically so non-UI callers can't
  bypass the paywall.

---

## Phase 4 — Information architecture and reachability

- **4.1** Training and Staff have effectively **one entry point each** — a horizontally
  scrolling SubNav pill on a different tab, styled like a filter (`config/ui.ts:388-389`).
  `Dashboard.tsx:97-106` `QUICK_LINKS` covers Scouting/Packs/Youth/Facilities and omits
  both. Add both to `QUICK_LINKS` and to a Squad section in `drawerSections`.
- **4.2** The tab named **"Squad" cannot set the lineup and doesn't say where to** —
  `SquadPage.tsx` is a read-only grid with a non-interactive XI/SUB pill (`:490-494`);
  `LineupEditor` lives only in `TacticsPage.tsx:231` and `MatchPrep.tsx:605`, and SquadPage
  has no link to Tactics at all.
- **4.3** `releasePlayer` is **fully implemented and completely unreachable** —
  `transferSlice.ts:722`, typed at `storeTypes.ts:321`, **zero callers** outside the store.
  An aging, overpaid, unsellable player is permanently stuck on the wage bill. "Terminate
  contract" is table stakes in this genre and the logic already exists.
- **4.4** Player comparison can't compare transfer targets and is hidden for a full season —
  `ComparisonPage.tsx:14` builds only from `club.playerIds`, so **the primary use of the
  feature is impossible**; sole entry is More → Career → Compare, gated to season 2
  (`navigation.ts:128`), and nothing in Squad/Transfer/PlayerDetail links to it.
- **4.5** Scouting reports are hard-capped at 10 with "showing 10 of 34" and **no show-all**
  (`ScoutingPage.tsx:125-129`) — reports 11+ are permanently unreachable, with no sort by
  rating/potential and no "recommendation = sign" filter.
- **4.6** BottomNav (`z-50`) renders **above 13 in-page modals** (all also `z-50`, later DOM
  order wins) — `GameShell.tsx:333-366`. A bright interactive nav pill floats over the
  dimmed scrim; tapping it unmounts the host page and **silently discards a live
  negotiation**, and it clips the sticky "Submit Offer" bar. Define a z-band (chrome 50 /
  overlay 70 / toast 9999) or portal overlays to body.
- **4.7** Page-swipe hijacks every horizontal scroll strip — `GameShell.tsx:342` spreads
  `swipeHandlers` on `<main>`; `useSwipeGesture.ts:55-79` never checks whether the touch
  began inside an `overflow-x-auto` element. Scrolling the SubNav to reach Training switches
  the whole screen to Market — the very row that is the only route to Training.
- **4.8** Missing confirms on irreversible actions: `JobMarket.tsx:50` accepting a job **ends
  your tenure** with no confirm (while *resigning* gets one at `:229`) and declining produces
  no toast at all; loan Accept/Reject and "Recall Player" (`TransferPage.tsx:757-775, 869-878`);
  scouting dismiss/cancel (`ScoutingPage.tsx:226-234, 98-104`) discards weeks of spend.
  `settings.confirmAllOffers` currently only affects transfers.

---

## Phase 5 — Feel: premium craft, presentation, accessibility

- **5.1** In-game Reduced Motion / Performance Mode are **ignored by ~20 components, and
  leave frozen confetti on screen.** framer-motion's `useReducedMotion()` reads only the OS
  media query; the store settings are never consulted. Because `App.tsx:64` sets
  `MotionConfig reducedMotion="always"`, transforms are disabled but opacity isn't — so
  `PackConfetti.tsx:31,52` creates up to 60 particles that are painted and **never move**:
  the player sees 60 static coloured squares. The correct pattern already exists at
  `PenaltyShootout.tsx:210` and `MatchDay.tsx:1138`. One shared `useReducedMotionPref()`
  hook + mechanical call-site replacement.
- **5.2** CSS animation loops ignore both triggers — 53 `animate-pulse`/`bounce`/`ping` sites,
  only 7 guarded. Persistent infinite loops in the player's field of view on nav badges
  (`BottomNav.tsx:102-138`), lineup editing (`LineupPlayerTile.tsx:101`, `BenchStrip.tsx:95`),
  `BoardWarning.tsx:93,97`. One global block in `index.css` for both triggers.
- **5.3** **Winning the Champions Cup triggers no ceremony at all.** `detectTrophyMoments`
  (`celebrations.ts:323-342`) checks only league/cup/leagueCup, and `TrophyMoment.id`
  (`:287`) literally cannot express continental silverware. Win the League Cup → gold
  trophy-lift + crowd roar. Win the Champions Cup after a six-season European campaign →
  nothing. Meanwhile `appReview.ts:59-70` counts continental wins as review-worthy.
- **5.4** Promotion and relegation — the emotional peak of a lower-league save — are a static
  text banner (`seasonEnd.ts:412-423`, `SeasonSummary.tsx:117-155`). No trophy lift, no
  confetti, no haptic, no sting. `history.promoted`/`replaced` already exist.
- **5.5** "Top of the Table!" re-fires all season — dedupe lives in a `useRef`
  (`Dashboard.tsx:257`) and `GameShell.tsx:303-305` unmounts Dashboard on every navigation,
  so a title-chasing side sees this full-screen modal ~20+ times a season. Goal/assist
  milestones re-fire the same way. Move the dedupe set into persisted state.
- **5.6** A mandatory scroll-locked modal **every single week, forever, with no opt-out** —
  `weekAdvance.ts:2727` sets `weeklyDigest` unconditionally; `WeeklyDigest.tsx:92-104`
  scroll-locks, haptics and chimes even on weeks with zero injuries, zero offers and zero
  development. ~430 forced dismiss-taps over a 10-season dynasty. **Single
  highest-frequency annoyance in the game.** Gate on significance; add a Settings toggle.
- **5.7** Reward beats are silent while the routine digest chimes — `AchievementUnlockModal`,
  `GemRevealModal`, `DailyRewardModal`, `MidSeasonReport`, `SessionRecap`, `FarewellModal`
  have haptics but no audio, though `sfxChime(big)` and `sfxWhoosh` already exist.
- **5.8** Press-conference questions repeat immediately — bare `pick(pool)` with no recency
  memory over 7–8 questions per context. Effects *are* real (`featureSlice.ts:78-139`), so
  this is variety, not consequence. Ring-buffer the last ~4 per context, mirroring
  `pickFreshLine`.
- **5.9** Match commentary filler pools are thin (4–8 lines each,
  `matchCommentary.ts:100-155`); `pickFreshLine` mitigates within a match but not across
  matches. Doubling the arrays is pure data.
- **5.10** Radix sheet/dialog close buttons are bare 16px icons with no padding
  (`ui/sheet.tsx:60-63`, `ui/dialog.tsx:45-48`) — one edit fixes MoreDrawer,
  SubstitutionSheet, FinanceBreakdownSheet, SponsorOfferSheet, SetPiecePicker. *(Touches
  `ui/*`, which the hard rules protect — needs explicit sign-off.)* Also
  `SetPiecePicker.tsx:142` uses `pb-safe`, **a class defined nowhere**, so the taker list is
  clipped by the home indicator; correct name is `safe-area-bottom`.
- **5.11** Live-match controls are 21–26px at the highest-pressure moment in the app —
  touchline shouts `MatchDay.tsx:1738` (26×26, `gap-1`), mentality `:1690` (~25),
  formation chips `:894` (~21), Pause `:1717` / Speed `:1768` (~26). All tapped while the
  clock runs; `:1743` puts the shout name in `title=`, which does nothing on touch.
- **5.12** Filter/sort/clear-search controls are 14–21px on the two most-used list screens
  (`TransferPage.tsx:415, 445-501`, `SquadPage.tsx:401, 427`, `LeagueTable.tsx:430`).
  `SquadPage.tsx:64` already solves this with `after:absolute after:-inset-2`.
- **5.13** Colour-only status and AT-invisible counts — `StatusPill.tsx:29-38` (26 call
  sites) puts `aria-label` on a plain `<span>`, which AT ignores, so "Suspended until week
  12" is exposed as nothing; `BottomNav.tsx:98-143` badges are unlabelled 8px dots with no
  count while `TopBar.tsx:257` does it correctly; `FormGuide.tsx:39-51` reads as a letter
  salad.
- **5.14** Focus/scroll-lock discipline — four destructive money confirms are bare divs with
  no dialog semantics, focus trap, Escape or scroll lock (`TransferPage.tsx:1035, 1062`,
  `FreeAgentSigningModal.tsx:43`, `MatchPrep.tsx:644`) while a working `ConfirmDialog`
  exists and is used by only 5 pages. Six overlays declare `aria-modal` but never trap
  focus — **worse than omitting it** — including the real-money `PurchaseModal.tsx:69`.
  Eight never call the already-refcounted `useScrollLock`.
- **5.15** Keyboard/switch users cannot set a lineup — empty formation slots are click-only
  divs with no `role`/`tabIndex`/`onKeyDown` (`LineupEditor.tsx:420-427`) while filled slots
  *are* operable, so a player can select but never place.
- **5.16** Empty states, save recency, and two real-money jank paths — bare-string dead ends
  (`ComparisonPage.tsx:19-27`, `StaffPage.tsx:518-522`, `LeagueTable.tsx:280+`,
  `CalendarView.tsx:506` reads as a rendering bug) while a good pattern exists six times
  over; save slots show in-game time but never `lastSavedAt`, so two slots are
  indistinguishable by recency; `ShopPage.tsx:82-90` renders a hardcoded USD fallback then
  visibly swaps to the localized price **on a real-money screen**;
  `useKeyboardInset` has exactly one consumer while six bottom-pinned inputs go unprotected.
- **5.17** `loadClubTemplates()` is fire-and-forget from `TitleScreen.tsx:53` and
  `initGame.ts:142` with `getClubTemplatesSync()` returning EMPTY until it resolves — a
  player on a slow connection who taps New Game fast gets a **procedurally-named squad
  instead of the real roster, permanently baked into the save**, with no spinner and no
  error. *(Promote to Phase 1 if reproducible on a throttled connection.)*
- **5.18** Notification scheduling on iOS likely never completes — `main.tsx:203-223`
  schedules inside the Capacitor `pause` handler, and `notifications.ts:282-301` then makes
  5+ sequential async hops including two lazy chunk imports, with no `beginBackgroundTask`,
  so iOS suspends JS mid-chain; every failure path is a silent catch, and
  `cancelAllEngagementReminders()` runs on both resume **and** cold launch. Net effect is
  plausibly **zero reminders delivered** while looking fully implemented. Needs a device
  test before trusting any of it. Schedule on a foreground trigger instead.
- **5.19** The curated live-event pipeline is empty and permanently so — `SPECIAL_EVENTS`
  (`liveEvents.ts:74`) holds one event, the 2026 World Cup, `end: '2026-07-19'`, which has
  **already expired**, so `getUpcomingSpecialEvent` returns null forever and the teaser is
  dead code. *(Credit: `getActiveLiveEvent` falls back to a deterministic monthly festival,
  so no surface goes empty — the design is genuinely future-proof.)* Ship at least one
  forward-dated event.
- **5.20** Save-size tax on the hot path — `seasonHistory` is never capped
  (`seasonEnd.ts:1261`) and embeds a full `ballonDOrRanking` per season (~4–8 KB/season →
  ~150–250 KB at 30 seasons, serialised on **every autosave**); `adRewardsClaimed`
  (`monetizationSlice.ts:143-152`) is never pruned. Everything else is correctly capped.
- **5.21** `halfTimeState`/`matchPhase` are persisted then unconditionally discarded on load
  (`orchestrationSlice.ts:265-266` vs `:992-993`), with two migrations existing purely to
  keep a field that is thrown away.

---

## Phase 6 — The world (the ceiling on season-to-season novelty)

- **6.1** Only the player's country is simulated — `initGame.ts:209-213` loads clubs via
  `getLeaguesByCountry`. 45 leagues / 37 countries / 756 clubs exist as data; the simulated
  world is **one country deep**. Continental opponents are `createEphemeralClub`
  (`continental.ts:480-486`) — a name plus a squad generated on demand from
  `32 + reputation * 10` and discarded. **Real Madrid in the Champions Cup is not an
  entity**: no history, no transfers, no development. And there are no cross-border
  transfers — you can never buy from Barcelona while managing Arsenal. This is the hard
  ceiling on novelty and on the fantasy the club list is selling.
- **6.2** Leagues converge instead of diverging — squad regen fills gaps at
  `reputation * mult * 0.4 + squadAvg * 0.6` (`seasonEnd.ts:667-676`), so every league
  drifts toward equilibrium.
- **6.3** No world narrative — no rival club's multi-season project, no AI takeover or
  collapse, no persistent manager rivalry, and no AI manager turnover at all
  (`aiManagerProfile` is generated once at `initGame.ts:246`).
- **6.4** Youth and reserve pathway — prospects carry a `developmentScore` that ticks weekly
  (`weekAdvance.ts:2069-2123`) and **never play a match**; there are no reserve/U21 fixtures
  anywhere. Combined with 2.1 (ratings) and 2.4 (minutes), a reserve fixture list turns the
  academy into the deepest long-term loop in the game.
- **6.5** Genre-standard and absent: per-player roles/instructions (five global sliders only),
  international qualifiers and friendlies calendar (tournaments only), assistant-manager/DoF
  delegation (7 staff roles delegate nothing), squad registration rules (no homegrown quota,
  no continental A-list), attendance/crowd/travel in the match model (home advantage is a flat
  1.15 on the home attack term, `matchEngine.ts:118`; `fanBase` never reaches the match),
  referee as an entity (flavour text only), testimonials/club-legend status (display-only tags).

---

## Phase 7 — Verification

- `npm run preflight` green at every commit boundary (lint + typecheck + test + build + size).
- New regression tests for the classes of bug this audit found, which existing tests missed:
  - a challenge table test (start each of the 10, satisfy the condition, assert completion +
    reward paid **once**) — would have caught four Phase 2.12 findings;
  - a career integration test (manager takes an NT job, plays a tournament, contract length
    is honoured) — would have caught 1.12;
  - a national-squad-quota test that asserts the week always advances — 1.1;
  - a save round-trip test that actually round-trips. `longevityStress.test.ts:385-400` is
    **vacuous today**: it stamps `version ?? 1` onto a *current* snapshot, so every run starts
    at v1 and hits the state-discarding migration 22, then asserts only that the result's
    version is a number in range. This is probably why the "13 fields never persisted" class
    of bug survived so long.
  - entitlement tests: null-expiry subscription reads as expired; imported saves cannot
    grant Pro.

---

## Explicitly NOT doing (kept from GOALS.md, still correct)

Server-authoritative online leagues (v2.0) · full i18n string extraction · LOC refactors of
`weekAdvance.ts`/`Dashboard.tsx` for their own sake · raising the eager main-chunk budget ·
the RevenueCat hosted paywall (banned, Apple 3.1.2(c)) · "fixing" the pitch-view speed clamp
(not a broken paid feature — just an uncommunicated cap).

Also declined here: `getCaptureScenario` / `CinematicCapturePage` cleanup (intentionally
dormant per CLAUDE.md).

---

## Verified healthy — do not re-litigate

Stated so a future session doesn't spend budget re-auditing these: the presentation queue
correctly sequences all 14 overlays with no orphans (`utils/presentationQueue.ts`);
`setPackSfxHandler` + `soundEnabled` sync are wired at `main.tsx:55-75`; game plans *are*
applied on the interactive path via `mergeGamePlanMods`; `appReview.ts` throttling (60-day
gap, 4 lifetime, celebratory gating) is exemplary; the pitch renderers thread
`reducedMotion` correctly and are the model the pack components should follow; the
consumable-pack `PENDING_PACK_CREDIT` crash-recovery flow is genuinely well built
(slot-scoped, pre-charge marker, idempotent, throttled Sentry); the club/NT calendar
ordering in `seasonEnd.ts:1482-1494` + `weekAdvance.ts:598-602` is load-bearing and correct;
World Cup mode is playable start to finish with no soft-lock found; the interview flow has
double-click, reroll and vanished-vacancy guards; `moveToNewClub`'s same-league branch
correctly rebuilds club-owned state; `aiSimulation.ts` is a decent AI transfer market
(renewals, listings, bidding wars, tactical drift); the 30-perk talent tree is genuinely
load-bearing across ~45 `hasPerk` sites; monetization invariants 1, 3, 4 and 6 hold
structurally; no free feature is accidentally gated; `redeemCodes.ts` correctly refuses to
grant Pro.

**Monetization invariant 5 — "monetization never touches sim parameters" — is VIOLATED
(1.5) and is the single most important thing in this document to keep fixed.**
