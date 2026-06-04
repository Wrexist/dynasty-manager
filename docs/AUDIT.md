# Dynasty Manager — Full Audit & Phased Improvement Plan

> **Top priority (per product owner):** the game must feel **instant and smooth** to
> navigate, tap, and scroll. **Phase 0** is dedicated entirely to that.

## How this audit was produced

Five parallel deep-dive audits were run across the codebase (runtime performance,
bundle/data-loading, state & persistence integrity, game-systems correctness, and a
UI/UX sweep of all ~34 pages), then **every load-bearing claim was personally
re-verified in the source**.

**Important:** the automated audits over-reported. Many "critical" findings were
**false positives** that were confirmed working in code and are listed in
[Appendix A: Debunked claims](#appendix-a-debunked-claims-do-not-chase). Treat that
appendix as "already correct — do not touch."

### Status legend
- ✅ **Verified** — confirmed in the actual source (file:line given).
- ⚠️ **Lead** — plausible but **not yet confirmed**; verify before fixing.
- ❌ **Debunked** — claimed by an audit but proven already-correct (see Appendix A).

---

# PHASE 0 — Instant & Smooth (THE priority)

Goal: every tab switch, tap, and scroll feels immediate on a mid-range phone. These
are the highest-leverage changes for perceived performance.

### 0.1 ✅ Reduce backdrop-blur cost (single biggest lever)
- **Evidence:** `src/components/game/GlassPanel.tsx:15` — `LIQUID_GLASS_SURFACE`
  hard-codes `backdrop-blur-2xl backdrop-saturate-150`, and **every** panel app-wide
  uses it. Total `backdrop-blur` layers in `src/`: **~118** (`49× -xl`, `25× -sm`,
  `23× -md`, `15× -2xl`, `6× plain`). `backdrop-filter` is the most expensive thing
  you can stack on mobile WebKit — each layer forces a full-area GPU readback every
  frame it (or anything behind it) repaints. Fixed bars (TopBar/BottomNav/SubNav) with
  blur repaint on **every scroll frame**.
- **Why it hurts navigation:** scrolling a page full of blurred GlassPanels behind a
  blurred TopBar/BottomNav is the classic cause of mobile jank and dropped frames.
- **Fix (in order of impact):**
  1. Lower the GlassPanel default from `backdrop-blur-2xl` → `backdrop-blur-md` (or
     `-lg`). The visual difference at panel scale is minimal; the GPU cost drops sharply.
  2. Drop `backdrop-saturate-150` from the default surface (keep it only on hero/pack
     surfaces). Saturation adds another filter pass.
  3. **Remove blur from the fixed bars** (TopBar, BottomNav, SubNav) — replace with a
     solid/near-solid background (`bg-background/95`) or a top/bottom gradient. Blur on
     a fixed element is the worst case (repaints every scroll frame).
  4. Add a global "performance mode" (see 0.6) that swaps all `backdrop-blur-*` for
     solid translucent backgrounds via a single body class (`.perf-mode .backdrop-blur-*`
     overrides, or a CSS variable the surface reads).
- **Effort:** S–M. **Risk:** Low (visual-only). Verify look at 375px before/after.

### 0.2 ✅ Virtualize / cap the long player lists
- **Evidence:** No virtualization library installed (`package.json` has no
  react-window/virtual/virtuoso). `src/pages/TransferPage.tsx:526` (`listings.map`) and
  `:925` (`freeAgentPlayers.map`) render **every** filtered row, each a `TransferPlayerCard`
  → a full `PlayerCard` (150px, background image) wrapped in a blurred GlassPanel and a
  `motion.div` with `layout="position"` + staggered entrance. With hundreds of market/FA
  players this is hundreds of DOM nodes, images, blur layers, and layout-animated nodes
  mounting at once → slow first paint, janky scroll, laggy filter changes.
- **Fix (pick one; recommend A for speed, B for best UX):**
  - **A. Windowed pagination (no new dep):** render the first N (e.g. 30) and add a
    "Load more" sentinel / `IntersectionObserver` to append the next batch. Smallest change.
  - **B. Virtualize:** add `@tanstack/react-virtual` (tiny) and render only visible rows.
    Best for very long lists. (New dep — discuss per the "no deps without discussing" rule.)
  - In both: gate the `motion.div` entrance + `layout="position"` behind
    `useReducedMotion()` **and** a list-size threshold (e.g. disable layout animation when
    `listings.length > 40`). Animating dozens of reflowing rows is pure main-thread cost.
- **Apply the same pattern** anywhere a full roster renders unbounded: Scouting watch
  lists, Squad grid (⚠️ check `SquadPage.tsx`), league top-scorer lists.
- **Effort:** M. **Risk:** Med (scroll/filter behavior) — test filter + scroll restore.

### 0.3 ✅ Image hygiene in card-heavy lists
- **Evidence:** `src/components/game/CardArtBackground.tsx:59` already sets
  `loading="lazy"` + `decoding="async"` (good). But without 0.2, all off-screen cards are
  still in the DOM, so the browser still queues/keeps their decoded images.
- **Fix:** primarily resolved by 0.2 (only visible cards in DOM). Additionally: ensure a
  cheap solid-color placeholder shows before the art decodes (avoids layout flash), and
  confirm `width/height`/aspect-ratio are set so there's no reflow on load (PlayerCard
  uses `aspect-[3/4]` ✅).
- **Effort:** S. **Risk:** Low.

### 0.4 ✅ Kill idle polling re-renders
- **Evidence:**
  - `src/components/game/SaveStatusIndicator.tsx:43` — `setInterval(... , 15_000)` ticks a
    "saved X ago" label every 15s while idle.
  - `src/pages/PacksPage.tsx:113` — `setInterval(... , 30_000)` re-renders the page to
    update a reset countdown.
  - (`MatchDay.tsx:419` and `PackOpeningOverlay.tsx:221` intervals are intentional and
    scoped to active match/pack — leave them.)
- **Why:** periodic forced re-renders are small but unnecessary background work; on
  low-end devices any avoidable main-thread wake competes with scroll/tap.
- **Fix:** Compute relative time with `Intl.RelativeTimeFormat` on render and only
  re-tick lazily (e.g. a single `setTimeout` to the next minute boundary, cleared on
  unmount). For the Packs countdown, drive the visible timer with CSS or a coarse
  60s tick, and scope it so it only runs while the countdown is on screen.
- **Effort:** S. **Risk:** Low.

### 0.5 ✅ Tighten heavy memo dependencies
- **Evidence:** `src/pages/LeagueTable.tsx:77` computes `topScorers`/`topAssisters` with
  `[players, divisionClubs, selectedDiv]` — it re-filters & double-sorts **all** division
  players whenever **any** player object anywhere changes.
- **Fix:** split the memo — derive the division's player list from
  `[divisionClubs, selectedDiv]` only, then sort from that stable list. Sweep other pages
  for memos/selectors that depend on the whole `players`/`clubs`/`fixtures` objects when
  they only need a slice.
- **Effort:** S. **Risk:** Low.

### 0.6 ✅/NEW Add a "Performance mode" setting (ties 0.1–0.2 together)
- **Context:** `settings.reducedMotion` already exists and is wired globally via
  `MotionConfig` in `src/App.tsx:55` ✅. There is **no** equivalent for visual *effects*
  (blur/shadow/specular).
- **Fix:** add `settings.performanceMode: boolean` (with migration). When on, a single
  body/root class disables backdrop-blur (solid surfaces), drops the GlassPanel specular
  overlay, and forces the list-animation thresholds from 0.2. Default off; auto-suggest on
  for older devices. This gives users (and you) one switch to guarantee smoothness.
- **Effort:** M. **Risk:** Low.

### 0.7 ✅/NEW Scroll-position restoration on tab switch
- **Evidence:** `src/pages/GameShell.tsx:269` mounts each screen fresh and `:274`
  `window.scrollTo(top:0)` on every screen change. Returning to a long list (Market,
  Squad, Inbox) dumps you at the top — feels like a reset, not a return.
- **Fix:** keep a `Record<screen, scrollY>` ref; save on screen-leave, restore on
  screen-enter (instant). Keep top-reset only for genuinely new destinations.
- **Effort:** S. **Risk:** Low.

### 0.8 ⚠️ Reduce decorative DOM per panel
- **Evidence:** `GlassPanel` renders an extra radial-gradient specular `<div>` with
  `mixBlendMode:'screen'` per panel (verify line in `GlassPanel.tsx`). With 50+ panels per
  screen that's 50+ extra blended nodes to paint.
- **Fix:** make the specular overlay opt-in (`showSpecular` prop, default off, or off in
  performance mode). Verify it's actually present before acting.
- **Effort:** S. **Risk:** Low.

**Phase 0 acceptance:** record a before/after scroll + tab-switch on a mid/low-end device
(or Chrome DevTools 4× CPU throttle). Target: no dropped frames on tab switch, smooth
60fps scroll on Market with a full list.

---

# PHASE 1 — Load time & bundle size

The build emits enormous chunks; trimming what's on the **new-game critical path** makes
first load and "New Game" feel instant. (Sizes from the actual production build.)

### 1.1 ✅ Defer / stage the multi-MB data chunks
- **Evidence (build output + `src/store/slices/orchestration/initGame.ts`):**
  - `nationalPlayerPool` ≈ **2.47MB** (405KB gz) — `loadNationalPool()` fired in `initGame`
    (~line 138); only needed for national-team mode.
  - `squad-data` ≈ **2.19MB** (395KB gz) — `loadClubTemplates()` in `initGame` (~line 142).
  - Community Pack `byClub` (≈1.15MB) + `freeAgents` (≈1.88MB) + `cpLeagueSquads` (≈574KB)
    `await`-ed in `initGame` (~lines 165–180) when CP is enabled.
  - These rely on a TitleScreen prefetch (~1.5s) completing before the user taps "New Game"
    — unreliable on slow networks → 200–600ms stalls that read as a freeze.
- **Fix:**
  1. Move `loadNationalPool()` / `loadClubTemplates()` prefetch to **ClubSelection mount**
     (earlier, with more lead time) instead of relying on the Title prefetch race.
  2. Show an explicit **"Generating squads…" loading screen** during `initGame`'s awaits so
     the wait is intentional, not a hang. Track each load and update progress.
  3. **Defer the national pool** until national-team mode is actually entered (it's not
     needed to start a club career).
  4. Split squad templates **per league/tier** so picking a club loads that league's squads,
     not all 92 clubs at once. (Larger change — schedule after 1.1.1–1.1.2.)
- **Effort:** M–L. **Risk:** Med (init flow) — guard with the existing init tests.

### 1.2 ✅ Manually chunk recharts
- **Evidence:** `vite.config.ts` intentionally does **not** chunk recharts (~111KB gz). It
  bloats the first lazy page that imports a chart (Finance/Comparison/ManagerProfile/
  Training/PlayerDetail).
- **Fix:** add `if (id.includes('recharts')) return 'recharts';` to `manualChunks` so it's a
  shared, cached, on-demand chunk.
- **Effort:** S. **Risk:** Low.

### 1.3 ⚠️ Make framer-motion conditional / lazier
- **Evidence:** framer-motion (~126KB gz) is imported at app root (`App.tsx`) + ~33 pages, so
  it's in the eager path even for users who enable reduced motion.
- **Fix (investigate):** keep `MotionConfig` but consider a lazy `LazyMotion` + `domAnimation`
  feature bundle to cut the eager footprint, and/or CSS transitions for trivial
  opacity/scale effects. Measure before committing — this one is effort-sensitive.
- **Effort:** M–L. **Risk:** Med. Verify animations still work.

### 1.4 ✅/NEW Guardrail: forbid direct imports of the giant data files
- **Evidence:** `playerGen.ts`/`realPlayerPicker.ts` correctly import the **lazy accessors**
  (`nationalPlayerPoolAccess.ts`, `playerTemplatesAccess.ts`). A stray direct import of
  `src/data/nationalPlayerPool.ts` or `src/data/squads/*` would silently re-bloat the eager
  bundle.
- **Fix:** add an ESLint `no-restricted-imports` rule banning direct imports of those raw
  data modules outside their accessors. Cheap insurance.
- **Effort:** S. **Risk:** Low.

---

# PHASE 2 — Correctness & robustness (verify-first)

The game-systems audit was unreliable (every high-severity claim I spot-checked was a false
positive — see Appendix A). The items below are the **survivors**: lower-confidence leads
worth a **verification pass** before any change. Do **not** mass-fix; confirm each first.

### 2.1 ⚠️ Forfeit path fitness initialization
- **Claim:** `src/engine/match.ts` forfeit branch (~lines 244–280) may leave `playerFitness`
  empty when a side has 0 players, risking `undefined`→NaN downstream.
- **Action:** write a unit test that simulates a 0-player side; assert no NaN in
  ratings/fitness. Only initialize defensively if the test reproduces a problem.

### 2.2 ⚠️ Fixture regeneration on promotion/relegation
- **Claim:** when the player's club changes division at season end, old-division fixtures may
  linger until regenerated.
- **Action:** add a season-rollover test (promote the player's club) asserting the new
  division's fixtures exist and old ones are cleared. (Likely already handled in `seasonEnd`
  → verify before touching.)

### 2.3 ⚠️ Suspended players in AI lineup selection
- **Claim:** `selectBestLineup`/AI sim filters `injured` but maybe not `suspendedUntilWeek`.
- **Action:** grep `selectBestLineup` + AI sim; add suspension filter only if missing.

### 2.4 ⚠️ League table tie-breakers
- **Claim:** ties resolved by GD then GF only (no head-to-head). Realistic enough; low
  priority. Consider documenting the intended rule rather than changing behavior.

### 2.5 ⚠️ Stale player-ID references after retirement
- **Context:** `transferSlice` already calls `purgePlayerReferences` on sale/release ✅
  (verified). The lead is whether **season-end retirements** purge transient refs
  (`selectedPlayerId`, `transferMarket`, `pendingTransferTalk`, national pools).
- **Action:** add a season-rollover test that retires a listed/selected player and asserts
  no dangling IDs remain. Fix only the specific gaps the test reveals.

### 2.6 ⚠️ `filter(Boolean)` completeness
- **Claim:** a `careerSlice` `.map(id => players[id])` may lack a trailing `.filter(Boolean)`.
- **Action:** grep `\.map(\w*id\w* => .*players\[` across slices; add `.filter(Boolean)` only
  where a deleted ID could realistically appear.

> **Note:** the audit's "CRITICAL direct-mutation" findings in `seasonEnd.ts`/
> `orchestrationSlice.ts` were **verified false** — those `.push()` calls operate on
> freshly-built working copies committed via a single `set()`. Do not "fix" them.

---

# PHASE 3 — UX polish & consistency

Smaller, high-polish wins. Several reported items were already handled (Appendix A); these
are the genuine ones (verify the ⚠️ ones at the listed location first).

### 3.1 ✅ Money formatting consistency
- Sweep for raw numeric money displays; route everything through `formatMoney`. Audit
  flagged `ScoutingPage` tooltips specifically. **Effort:** S.

### 3.2 ✅ Rating-color threshold consistency
- Standardize all rating colors on the shared thresholds in `src/config/ui.ts` /
  `uiHelpers` (some pages use 70+, others 80+). **Effort:** S.

### 3.3 ⚠️ Empty states
- Add helpful empty states where lists can be empty with no guidance — verify each:
  Scouting (no assignments), Inbox (no messages), Comparison (<2 players, exists but minimal).
  **Effort:** S each.

### 3.4 ⚠️ Haptics gaps
- Add `hapticLight()` to interactive controls missing it (reported: Packs replay button,
  Inbox filter toggles, Scouting cancel, LeagueTable row tap). Verify each lacks it first;
  TopBar/BottomNav already have haptics ✅. **Effort:** S.

### 3.5 ⚠️ Accessibility gaps
- Add `aria-label` to icon-only buttons missing them (reported: Packs replay; verify) and
  `aria-label` to club-color indicator divs. Add `autoFocus`/focus management to the Settings
  feedback sheet. **Effort:** S–M.

### 3.6 ⚠️ Mobile layout stress at 375px
- Verify and bound: MatchDay commentary container (`overflow-y-auto`, max-height) and
  LeagueTable column widths (`overflow-x-auto` guard). Confirm modals
  (Celebration/Storyline) respect `safe-area-bottom` above the BottomNav. **Effort:** S–M.

### 3.7 ✅ ModeSelect "Online — Coming Soon" dead-end
- `src/pages/ModeSelect.tsx` Online card is disabled-with-toast. Either hide it until ready or
  route to a proper roadmap card. **Effort:** S.

### 3.8 ⚠️ Settings nits
- `SettingsPage` title variant may miss `max-w-lg mx-auto` on the title-screen variant; the
  `hapticsEnabled !== false` double-negative could be normalized for clarity. Verify lines
  before editing. **Effort:** S.

> Already-correct (do not redo): global reduced-motion wiring, transfer-offer confirmation
> (`confirmAllOffers` setting + auto-confirm on significant offers), `help`/`shop` back
> targets, min-squad sale guards. See Appendix A.

---

# PHASE 4 — Features / improvements (product)

Net-new value, prioritized after the game *feels* great.

### 4.1 Search / sort on big lists
- **Squad:** sort-by dropdown (Overall / Position / Form / Age / Contract).
- **League Table / clubs:** club search box.
- **Scouting watch list:** search + sort.
- Pairs naturally with Phase 0.2 virtualization. **Effort:** M.

### 4.2 Save export / import
- "Export Save" → JSON file; "Import Save" → restore. Great for backups before risky moves
  and for support. Route through the persistence helpers. **Effort:** M.

### 4.3 Squad-depth / weakness insight
- Extend Comparison or add a "squad vs league average by position" view to guide transfers.
  **Effort:** M–L.

### 4.4 Quieter confirmations for irreversible actions
- Quick-sell of pack pulls is immediate; consider a brief undo toast (snackbar) rather than a
  blocking dialog. **Effort:** S–M.

---

# PHASE 5 — Guardrails (lock in the gains)

### 5.1 Performance budget in CI
- Add a bundle-size check (e.g. fail CI if the eager entry chunk grows beyond a threshold) so
  a stray static import can't silently re-bloat startup.

### 5.2 Lint rules
- `no-restricted-imports` for the giant data files (1.4).
- Optional custom rule / code-review checklist item: new `GameState` fields require a
  `saveMigration` step.

### 5.3 Render-hygiene tests
- There's already `renderHygiene.test.ts` — extend it to assert no stray whole-store
  subscriptions creep into hot pages (Market, Squad, Dashboard).

### 5.4 Device QA pass
- Manual smoothness QA at 4× CPU throttle / a real low-end device for: tab switching, Market
  scroll+filter, MatchDay, pack opening. Capture a perf trace as the baseline.

---

# Suggested execution order

1. **Phase 0.1, 0.4, 0.5, 0.7** (quick, high-impact smoothness) → ship, feel the difference.
2. **Phase 0.2** (virtualize/paginate lists) + **0.6** (performance mode) → ship.
3. **Phase 1.1–1.2, 1.4** (load-time + chunking + guardrail) → ship.
4. **Phase 2** verification pass (tests first) → fix only confirmed bugs.
5. **Phase 3** polish sweep → ship.
6. **Phase 4** features, **Phase 5** guardrails ongoing.

Each shippable batch: `npm run preflight` → branch → commit → push → PR link, per repo rules.

---

# Appendix A — Debunked claims (do NOT chase)

These were reported as bugs by the automated audits but were **verified already-correct** in
source. Listed so nobody spends time "fixing" working code.

| Reported as | Reality (verified) |
|---|---|
| CRITICAL: direct state mutation in `seasonEnd.ts` / `orchestrationSlice.ts` (`.push()`) | Operates on **fresh local working copies** (`newClub`, `club`, `leagueClubIds`) committed via one `set()`. Idiomatic & correct. (`orchestrationSlice.ts:454–478`, `seasonEnd.ts:311–334`) |
| HIGH: `endSeason` not triggered when week > totalWeeks | Trigger exists: `weekAdvance.ts:686` `if (newWeek > (state.totalWeeks||TOTAL_WEEKS)) endSeasonImpl(...)` |
| HIGH: `transferWindowOpen` goes stale (not recomputed per week) | Recomputed each advance from `newWeek`: `weekAdvance.ts:1415` |
| HIGH: obligatory loan-buy clause ignored | Fully handled incl. insufficient-funds path: `loanSlice.ts:304–366` |
| MEDIUM: selling can drop squad below minimum | Guarded on every sale/release path: `transferSlice.ts:500, 526, 566, 653` |
| MEDIUM: reduced-motion setting "exists but not enforced" | Wired globally: `App.tsx:55` `MotionConfig reducedMotion={…}` (+ per-component `useReducedMotion`) |
| MEDIUM: `BACK_TARGET` missing `help`/`shop` | Both present: `navigation.ts` (`help→dashboard`, `shop→dashboard`) |
| HIGH: no confirmation for transfer offers | Smart default + opt-in: `TransferPage.tsx:221` auto-confirms significant offers; `confirmAllOffers` setting confirms all |
| LOW: direct `localStorage`/`sessionStorage` outside helpers | None found outside `persistence.ts` (ESLint-enforced) |

---

*Audit methodology note: where an automated finding could not be personally verified, it is
marked ⚠️ "Lead" and paired with a "write a test / confirm at file:line" action rather than a
blind fix. The repo's existing test suite (1,568 passing) and `npm run preflight` should gate
every change.*
