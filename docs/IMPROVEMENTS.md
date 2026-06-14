# Dynasty Manager — Improvement Backlog

> Consolidated, de-duplicated list of everything worth improving/changing,
> built from a four-way audit (correctness, UX, tech-debt, existing audit docs)
> on 2026-06-14, cross-checked against current source. Supersedes the scattered
> "open items" in `docs/AUDIT.md` / `docs/release-triage.md` for planning.
>
> **Confidence tags:** `[verified]` confirmed in source · `[likely]` high
> confidence, quick to confirm · `[candidate]` flagged by automated audit,
> **must be re-verified before fixing** (the automated correctness pass
> over-reports — its top "economy double-charge" finding was a false positive).
>
> **Health context:** the codebase is in good shape — 0 TODO/FIXME/HACK, 0
> `@ts-ignore`, 11 justified `eslint-disable`s, ~14 prod non-null assertions, 5
> justified prod casts, 105 test files. No P0/P1 shipblockers. This list is
> polish, features, and extraction — not a debt fire.

## Already done (this session — do not re-raise)
Onboarding card auto-dismiss + XP reward · flaky 11v10 test · season-end
`playerDiv` crash · transfer-deadline `totalWeeks` bug · `typecheck` in
preflight + CI · League/Inbox haptics sweep · "Squad vs League" insight panel ·
Online-mode plan (`docs/online-mode-plan.md`). Phase-0 perf (blur/jank/perf-mode),
Squad sort/filter/depth, Packs replay haptics+aria, Scouting cancel haptics,
Scouting/Inbox empty states were already complete before this session.

---

## 1. Correctness / robustness

All `[candidate]` items below come from an automated pass that over-reports —
**verify in source before touching.** Listed so nothing is silently dropped.

- `[candidate]` **Community-pack state captured across an `await import()`** in
  `weekAdvance.ts` (~L2993–3142): `cpState` is read from `get()`, then used after
  the dynamic import + `set()`. Confirm no intervening mutation is lost; if real,
  re-`get()` after the await. Likely benign (single-threaded, no concurrent
  dispatch mid-advance) but worth confirming.
- `[candidate]` **Loan wage accounting asymmetry / inflation** in `loanSlice.ts`
  (~L100, L180–193): `Math.max(0, …)` caps can desync owner/borrower wage bills if
  `wageSplit` is malformed; `safeWageShare` guards exist but don't cover
  out-of-range percentages. Harden `safeWageShare`/`safeWageInverse` to clamp
  split to [0,100]. Low impact.
- `[candidate]` **Continental knockout pairing trusts `winnerId!`**
  (`weekAdvance.ts` ~L397): relies on `filter(Boolean)` to catch an unresolved
  tie rather than asserting resolution upstream. Add an explicit guard so a null
  winner can't enter the next round.
- `[candidate]` **Cup week validity vs compressed schedules** (`cup.ts`): for
  leagues with `totalWeeks < 46`, confirm no round is stamped past the season
  length. The cup-week choreography is load-bearing — verify, don't casually move.
- `[verified, FALSE POSITIVE]` transferSlice "budget double-charge" — checked,
  the sell/buy paths are balanced. No action.
- **Guardrail:** no automated check that a new `GameState` field has a
  `saveMigration` step. Add a review-checklist item or a test that diffs the
  state shape against the migration ladder (`AUDIT 5.2`).

## 2. UX / Accessibility

- `[likely]` **Icon-only buttons missing `aria-label`** (screen-reader gaps):
  `StaffPage.tsx:505` (release staff), `BoardWarning.tsx:101` (dismiss),
  `LineupEditor.tsx:462` (close), `ContractNegotiation.tsx:148` (cancel). Quick wins.
- `[likely]` **Destructive actions without a confirm step:** delete save slot
  (`TitleScreen` `handleDelete` → `resetGame()` on single tap); fire staff
  (`StaffPage` ~L480, no pre-action warning). Add a ConfirmDialog.
- `[likely]` **Mobile 375px stress** (`AUDIT 3.6`): bound MatchDay commentary
  container (max-height/`overflow-y`), LeagueTable column widths
  (`overflow-x-auto`), confirm Celebration/Storyline modals respect
  `safe-area-bottom` above the bottom nav.
- **Empty state:** Comparison page with <2 players (`AUDIT 3.3`) — exists but minimal.
- **Money-formatting consistency** (`AUDIT 3.1`): a few raw numerics bypass
  `formatMoney` (flagged: ScoutingPage tooltips, ManagerCreation offer display).
- **Rating-color threshold consistency** (`AUDIT 3.2`): some surfaces use 70+,
  others 80+ — standardize on the shared `uiHelpers` thresholds.
- **Settings nits** (`AUDIT 3.8`): title-screen variant may miss `max-w-lg mx-auto`;
  normalize the `hapticsEnabled !== false` double-negative; add focus
  management/`autoFocus` to the feedback sheet.
- **Scroll-position restoration on tab switch** (`AUDIT 0.7`): keep
  `Record<screen, scrollY>` and restore on enter instead of always scrolling to top.
- **ModeSelect "Online — Coming Soon"** (`AUDIT 3.7`): currently a toast dead-end.
  Either hide until ready or route to a roadmap card. (See `online-mode-plan.md`.)
- **Quieter pack quick-sell** (`AUDIT 4.4`): replace the immediate/blocking
  confirm with an undo-toast snackbar.

## 3. Performance (Phase-0 lever already done; these are secondary)

- **Virtualize long lists** (`AUDIT 0.2`, effort M): TransferPage
  (`TransferPage.tsx:526,925`), Scouting watch lists, top-scorer lists — windowed
  pagination or `@tanstack/react-virtual`; gate motion entrance behind list-size + reduced-motion.
- **Idle polling re-renders** (`AUDIT 0.4`): `setInterval(15s)` "saved X ago"
  (`SaveStatusIndicator.tsx:43`), `setInterval(30s)` pack countdown
  (`PacksPage.tsx:113`) — pause when off-screen/backgrounded.
- **Split heavy memo** (`AUDIT 0.5`): `topScorers`/`topAssisters` re-filter all
  division players on any player change (`LeagueTable.tsx:77`).
- **GlassPanel specular opt-in** (`AUDIT 0.8`): make the decorative overlay
  `showSpecular` (default off in perf mode).
- **Bundle: move eager data off the boot graph** — dynamic-import
  `pressConferences.ts` (15.5KB gz), `storylineChains.ts` (10.6KB gz); lazy-load
  `nationalPlayerPool` until international screens; longer-term, dynamic
  `generateSquad`/`squad-data` (~360KB gz). Stage `loadNationalPool()`/
  `loadClubTemplates()` to ClubSelection mount with a "Generating squads…" screen (`AUDIT 1.1`).
- **framer-motion lazier** (`AUDIT 1.3`, measure first): `LazyMotion` +
  `domAnimation`, or CSS transitions on hot paths.

## 4. Features (net-new value)

- **Save export/import** (`AUDIT 4.2`, M): "Export Save" → JSON, "Import Save" →
  restore, routed through persistence helpers + migration on restore.
  *Recommended next feature — high value, lower risk than Online.*
- **Search on big lists** (`AUDIT 4.1`, M): club search on League Table; search +
  sort on Scouting watch list. (Squad sort already done.)
- **Online mode** — see `docs/online-mode-plan.md` (3 slices on Supabase; the
  engine's unseeded `Math.random` forces server-authoritative sim).

## 5. Tech debt / testing / guardrails

- **Oversized files needing extraction** (use `/refactor`): `weekAdvance.ts`
  (~3153 LOC, split by phase) and `Dashboard.tsx` (~2195) are the priorities;
  also `match.ts` (~2004), `seasonEnd.ts` (~1732), `MatchDay.tsx` (~1724),
  `matchActions.ts` (~1703), `orchestrationSlice.ts` (~1236),
  `PackOpeningOverlay.tsx` (~1443), `saveMigration.ts` (~1322).
- **Test coverage gaps** — no test file for several large/critical units:
  `weekAdvance.ts` (the game loop!), `loanSlice.ts`, `featureSlice.ts`,
  `careerSlice.ts`, `international.ts`; and page-level behavior for `MatchDay`,
  `TransferPage`, `Dashboard`.
- **Dead data file:** `src/data/communityPack/newLeagues.ts` (~2.0 MB source) has
  zero importers — wire it up or delete (`Triage P2-4`).
- **ESLint import guard:** extend the `no-restricted-imports` ban on giant data
  files to `nationalPlayerPool.ts` / `squads/*` accessors (`AUDIT 1.4/5.2`).
- **CI eager-bundle budget**: already have `size:check`; run `npm run analyze`
  periodically to catch eager imports leaking into `index` (`AUDIT 5.1`).
- **Dependencies:** ~10 safe patch/minor bumps to batch (radix, framer-motion
  12.35→12.38, postcss, zustand, typescript-eslint…) (`Triage P2-7`); and a
  staged major-migration plan (React 19, RR7, Tailwind 4, Vite 8, Vitest 4, TS 6,
  RevenueCat 13) post-release (`Triage P2-6`).
- **`any` cleanups:** 5 in native adapters (`haptics.ts`, `purchases.ts`) — narrow
  Capacitor/RevenueCat interfaces; 12 in `sponsorship.test.ts` (`Triage P2-2/2-3`).
- **Incremental TS strictness:** enable `noUnusedLocals`/`noUnusedParameters`,
  then `strictNullChecks` file-by-file (long game).
- **Generated CP data TS→JSON + typed loader** (~395K LOC) (`Triage P3-3`).

## 6. Balance (report-only — explicitly "don't tune yet")

- Market-churn metric: re-derive the 2.0x threshold or switch to a weekly-delta
  metric (`balanceReport.test.ts:354`).
- L2 goals-per-match downward trend (2.50→1.90) — needs a 15-season seeded sim to
  confirm drift vs noise.
- Loan-news threshold (kept at 70 by design) — revisit only on user reports;
  preferred fix is an aggregated weekly summary.

---

### Suggested order of attack
1. **Save export/import** (feature, high value, M) — recommended next.
2. **A11y aria-labels + destructive-action confirms** (S, user-trust, quick).
3. **Verify & close the `[candidate]` correctness items** (de-risk).
4. **Extract `weekAdvance.ts`** + add its first test (biggest debt lever).
5. **Bundle: dynamic-import pressConferences/storylineChains** (cheap load-time win).
