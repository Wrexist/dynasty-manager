# Release Readiness Audit

Baseline report — no fixes applied, findings only.

- **Branch:** `claude/audit-release-readiness-F989t`
- **Date:** 2026-04-21
- **Node/npm:** Node ≥18, npm ≥9 (per `package.json` engines)
- **Scope:** `src/` + root config. 430 TS/TSX files, ~522k LOC total (~127k LOC
  if you exclude the ~395k-line generated data tables under
  `src/data/communityPack/*`).

---

## 1. TypeScript Health — FAIL (18 errors)

`npx tsc --noEmit -p tsconfig.app.json` → 18 errors across 4 files.
Build (`vite build`) still succeeds because Vite does not type-check.

| File | Count | Error |
|------|-------|-------|
| `src/components/game/pack/PackShopCard.tsx` | 1 | `TS2459` — imports `PackTierDefinition` from `@/config/packs`, but that module only re-imports the type from `@/types/game` and never re-exports it. |
| `src/store/gameStore.ts` | 1 | `TS2739` — composed slice spread is missing `communityPackEnabled` and `cpPool` required by `GameState`. Fields are only populated inside `initGame()` (orchestrationSlice), not in the slice's initial-state object. |
| `src/test/nationalTeamPool.test.ts` | 15 | `TS2322` — literal string values assigned to numeric fields (lines 74-75, 96-97). Test fixtures authored with the wrong primitive type. |
| `src/test/subNav.test.tsx` | 1 | `TS2352` — `matchPhase: "simulating"` does not match `MatchPhase` union (`"none" \| "half_time" \| "full_time" \| "first_half" \| "second_half" \| "extra_time" \| "penalties"`). Likely stale after a rename. |

Note: `tsconfig.json` has `strict: false` and `strictNullChecks: false`, so these
18 errors are the ones that slip through even with strict off.

---

## 2. Lint Health — PASS

`npm run lint` → 0 errors, 0 warnings.
(ESLint 9.32.0 via `eslint.config.js`.)

---

## 3. Dead Code / Debt Markers

Counts under `src/`:

| Marker | Count | Files |
|--------|------:|-------|
| `TODO` | 0 | — |
| `FIXME` | 0 | — |
| `XXX` | 0 | — |
| `HACK` | 0 | — |
| `@ts-ignore` | 0 | — |
| `@ts-expect-error` | 18 | `src/test/sponsorship.test.ts` (11), `src/utils/purchases.ts` (3), `src/utils/haptics.ts` (2), `src/test/match.test.ts` (1), `src/store/slices/orchestrationSlice.ts` (1) |
| `: any` type annotations | 18 | same spread as `@ts-expect-error` — most cluster around Capacitor/RevenueCat bridges (`purchases.ts`, `haptics.ts`, `ads.ts`) and test fixtures |
| Bare `any` tokens (non-annotation keywords like `any` in identifiers, strings, comments) | 107 occurrences across 44 files — mostly false positives (word "any" in JSDoc, `Array.isArray`, English strings). Not a real signal. |

**Observation:** zero `TODO`/`FIXME`/`HACK` markers is unusual for a codebase
this size — either the team is diligent or those notes live in commit
messages / issues rather than code comments. The real debt is concentrated in
native-bridge utilities (`purchases.ts`, `haptics.ts`, `ads.ts`) where typed
SDK surfaces are shimmed with `any` + `@ts-expect-error`.

---

## 4. Console Noise

| Call | Count | Files |
|------|------:|-------|
| `console.log` | 14 | `src/test/contentAudit.test.ts` (12), `src/test/longevity.test.ts` (2) — **test-only, intentional audit prints** |
| `console.warn` | 14 | `src/main.tsx` (4), `src/utils/promotionRelegation.ts` (1), `src/utils/purchases.ts` (3), `src/utils/ads.ts` (2), `src/pages/GameShell.tsx` (1), `src/test/contentAudit.test.ts` (1), `src/test/longevity.test.ts` (2) |
| `console.error` | 8 | `src/main.tsx` (1), `src/utils/ads.ts` (1), `src/utils/purchases.ts` (6) |
| `debugger` | 0 | — |

**Observation:** all `console.log` calls live in tests (intentional audit
output). Production warns/errors are confined to `main.tsx` (boot-time
Sentry + service-worker guards) and the monetization bridges (`ads`,
`purchases`) — reasonable for a release build but worth confirming before
ship that Sentry captures them instead of relying on devtools.

---

## 5. Tests — PASS

- Framework: Vitest 3.2.4 + jsdom + Testing Library.
- **51 test files** under `src/test/` (50 run; `setup.ts`/`stateValidator.ts`
  are helpers, not suites).
- `npm test` → **50 files passed, 805 tests passed, 0 failed**.
  Duration: 376.22s (longevity suites dominate: 10/15/20-season lifecycle
  tests run 20-35s each).
- Notable coverage: contracts, edge cases, longevity (10-20 season stress),
  promotionRelegation, monetization, saveMigration (v22→v23 clean break),
  packs, playerGen, matchBalance, releaseReadiness.
- **Gaps:** no tests for the community-pack pipeline
  (`src/utils/communityPackPool.ts`, `src/data/communityPack/*`). The plan
  file (`scripts/community-pack-plan.md`) explicitly required a
  `communityPack.test.ts` — not created.

---

## 6. Dependencies

### npm audit — PASS
`npm audit` → **0 vulnerabilities** (588 packages audited).

### npm outdated — 41 outdated, 11 behind by a major version

| Package | Current | Latest | Major gap? | Notes |
|---------|---------|--------|------------|-------|
| react | 18.3.1 | 19.2.5 | **yes** | ecosystem not ready (@types/react also pinned to 18) |
| react-dom | 18.3.1 | 19.2.5 | **yes** | pair with react |
| @types/react | 18.3.23 | 19.2.14 | **yes** | |
| @types/react-dom | 18.3.7 | 19.2.3 | **yes** | |
| react-router-dom | 6.30.3 | 7.14.2 | **yes** | v7 is breaking; Router future-flag warnings already in test output |
| tailwindcss | 3.4.19 | 4.2.4 | **yes** | v4 is a rewrite (CSS-first config) |
| recharts | 2.15.4 | 3.8.1 | **yes** | breaking API changes in v3 |
| sonner | 1.7.4 | 2.0.7 | **yes** | |
| lucide-react | 0.462.0 | 1.8.0 | **yes** | first stable release, breaking exports |
| eslint | 9.32.0 | 10.2.1 | **yes** | |
| @eslint/js | 9.39.4 | 10.0.1 | **yes** | |
| eslint-plugin-react-hooks | 5.2.0 | 7.1.1 | **yes** | two majors behind |
| vite | 7.3.2 | 8.0.9 | **yes** | |
| vitest | 3.2.4 | 4.1.5 | **yes** | |
| typescript | 5.8.3 | 6.0.3 | **yes** | |
| @types/node | 22.16.5 | 25.6.0 | **yes** | |
| @vitejs/plugin-react-swc | 3.11.0 | 4.3.0 | **yes** | |
| jsdom | 28.1.0 | 29.0.2 | **yes** | |
| @revenuecat/purchases-capacitor(-ui) | 12.3.2 | 13.0.1 | **yes** | IAP bridge — verify native compat before bumping |
| globals | 15.15.0 | 17.5.0 | **yes** | eslint helper |

Minor/patch drift (safe to pick up): all `@capacitor/*` 8.2.0→8.3.1,
@sentry/react 10.45→10.49, autoprefixer 10.4→10.5, framer-motion
12.35→12.38, @radix-ui/* x4 patch bumps, postcss 8.5.6→8.5.10, tailwind-merge
2.6.0→2.6.1, typescript-eslint 8.38→8.59, zustand 5.0.11→5.0.12,
eslint-plugin-react-refresh 0.4.20→0.4.26.

**Release-blocking:** none — no CVEs, build is green. **Worth bumping:**
the Capacitor plugins and @sentry/react patches before a store submission.
Majors (React 19, Tailwind 4, Router 7, Vitest 4) are project calls — not
part of "release readiness" unless the team has already committed to them.

---

## 7. Bundle Size — over budget

`npm run build` → 3,355 modules → 25.7s build.

### Top chunks (min / gzip)

| Chunk | Min | Gzip | Nature |
|-------|----:|-----:|--------|
| `squad-data-*.js` | 1.88 MB | 360 KB | baseline squad templates |
| `freeAgents-*.js` | 1.87 MB | 312 KB | **community pack** — lazy |
| `byClub-*.js` | 1.15 MB | 207 KB | **community pack** — lazy |
| `index-*.js` | 1.02 MB | 285 KB | main entry |
| `cpLeagueSquads-*.js` | 574 KB | 98 KB | **community pack** — lazy |
| `national-pool-*.js` | 457 KB | 82 KB | |
| `recharts-*.js` | 413 KB | 111 KB | charting vendor |
| `radix-*.js` | 212 KB | 70 KB | Radix vendor |
| `framer-motion-*.js` | 132 KB | 44 KB | animation vendor |
| `Dashboard-*.js` | 119 KB | 28 KB | route |
| `MatchDay-*.js` | 83 KB | 22 KB | route |

Total JS output (excluding sourcemaps): **~8.5 MB unminified, ~2.5 MB
gzipped**. Vite emits a `>500 kB` warning for the 5 chunks above the line.

**Observations:**
- The community-pack chunks (`freeAgents`, `byClub`, `cpLeagueSquads`) are
  already code-split and loaded only when the user opts in — the commit
  `a3d7a5e` confirms this was done deliberately to restore the budget. But
  the opt-in experience still ships 360 KB gzip of data.
- `squad-data` at 1.88 MB (360 KB gzip) is the baseline cost every user
  pays — it's the non-community-pack league squad tables.
- The main `index-*.js` at 1 MB minified is large for an entry chunk — worth
  checking `npm run analyze` (rollup-plugin-visualizer) to see what's
  top-level-imported that shouldn't be.
- 45 MB total `dist/` size is dominated by sourcemaps (~26 MB) — not
  shipped to users, but slow to upload in CI.
- Browserslist data is 10 months old — cosmetic, not blocking.

---

## 8. Community Pack Integration Status — PARTIAL

The plan in `scripts/community-pack-plan.md` defines **8 phases (0-7)**. The
implementation **diverged** from the plan after Phase 1: the envisioned
FUT-style pack-opening collection layer was **not** built; instead the FC26
dataset was folded in as an opt-in league + free-agent expansion.

| Phase | Planned | Actually shipped | Status |
|-------|---------|------------------|--------|
| 0 — Analyze FC26 CSV | `scripts/analyzeFC26.mjs` + `fc26-report.json` | `scripts/analyzeFC26.mjs` exists; `package.json` exposes it as `npm run analyze-fc26` | ✅ done |
| 1 — Data pipeline | `scripts/processFC26.mjs` → `pool.ts` / `tiers.ts` / `meta.json` | `scripts/processFC26.mjs` exists (`npm run process-fc26`); outputs are `src/data/communityPack/{byClub,freeAgents,newLeagues,cpLeagueSquads}.ts` (different shape than planned — club-indexed + free-agent pool instead of a flat pool + tiers index) | ✅ done (divergent shape) |
| 2 — Pool & tier system | `src/config/communityPack.ts` (PACKS + odds), tier assigner | No `src/config/communityPack.ts`. `src/utils/communityPackPool.ts` exists but implements seeded shuffle / cursor / market-listing rotation — not pack-draw odds. | ⚠️ replaced with pool-rotation helpers; no tier/odds system |
| 3 — Store slice | `src/store/slices/communityPackSlice.ts` with `openPack()` / `assignToSquad()` | No slice file. Integration is inline in `orchestrationSlice.ts` (`initGame` seeds world, weekly rotation at week%4==0) and `careerSlice.ts`. `GameState.communityPack` + `cpPool` fields live in `storeTypes.ts`. | ⚠️ inline, no dedicated slice |
| 4 — UI flow | `PackStore.tsx` / `PackOpen.tsx` / `Collection.tsx` | None of those pages exist. Only surfaces: `src/components/CommunityPackPopup.tsx` (one-time intro) + `SettingsPage.tsx` toggle + `ClubSelection.tsx` gate (opt-in). | ⚠️ minimal UI; no pack-store flow |
| 5 — Squad & transfer integration | `assignToSquad()` via `hydratePlayerFromTemplate` | Community-pack players flow in through existing `initGame` squad-template loading + transfer-market seeding (`orchestrationSlice.ts:2803`, `:2856`). No card-to-squad assignment path. | ✅ integrated (different mechanism) |
| 6 — Persistence & migration | bump save version + migration step | `utils/saveMigration.ts` `CURRENT_VERSION = 60`; migration v59→v60 adds `communityPackEnabled: false` + empty `cpPool`. | ✅ done |
| 7 — Tests | `src/test/communityPack.test.ts` with odds/assign/migration coverage | **No community-pack test file.** Existing `packs.test.ts` covers the unrelated in-game pack-opening system, not the FC26 community pack. | ❌ missing |

### Orphaned files check — clean
- All `src/data/communityPack/*.ts` files are imported. `byClub`,
  `freeAgents`, and `cpLeagueSquads` are **dynamically imported** from
  `orchestrationSlice.ts` inside `initGame` so their chunks only ship
  when the user opts in. `src/data/squads/index.ts` intentionally
  excludes the 7 community-pack leagues (see the comment at the top of
  that file). `newLeagues.ts` is imported statically by
  `orchestrationSlice.ts`.
- `src/utils/communityPackPool.ts` is imported by `orchestrationSlice.ts`
  and re-exported in test fixtures.
- `src/components/CommunityPackPopup.tsx` is imported by `TitleScreen.tsx`.
- Settings toggle → `featureSlice.ts`. No dangling files.

### Commit hygiene — clean
9 community-pack commits land cleanly under PRs #383-#390, all merged into
`main`. Prefixed `cp:` or descriptive. No revert/amend churn in history.

### ⚠️ Unrelated "packs" system coexists
A separate **pack-opening** feature lives at
`src/store/slices/packsSlice.ts` + `src/config/packs.ts` +
`src/components/game/pack/*` + `src/pages/PacksPage.tsx` + the
`src/test/packs.test.ts` suite (30 tests, passing). This was **not** part of
the community-pack plan and is an independent feature. The name overlap
causes the TS error in section 1: `PackShopCard.tsx` imports
`PackTierDefinition` from `@/config/packs` where it isn't re-exported.

---

## Summary — what to look at before release

**Real blockers**
1. **18 TS errors** (section 1). `npm run build` / `npm run preflight`
   still pass because Vite does not type-check, but `npm run typecheck`
   fails. Two of them are genuine bugs (`PackShopCard` import path,
   `gameStore` initial state); fifteen are stale test fixtures. Left
   unaddressed these will surface in IDE diagnostics and in any CI
   step that enforces `tsc --noEmit`.
2. **Community-pack Phase 7 tests missing** (section 8). Plan required them; the largest new feature ships without automated coverage for the pipeline/migration/pool helpers.

**Worth addressing soon**
3. Bundle budget — the 5 chunks over 500 KB warning, particularly `index-*.js` at 1 MB, deserve a visualizer run.
4. Capacitor 8.2 → 8.3 patch bumps + @sentry/react patch before store submission (no API breaks).
5. Community-pack UI is much thinner than the plan described (no pack-store / opening / collection pages). Confirm this is an intentional scope cut, not forgotten work.

**Not blockers, flagged for awareness**
6. 41 outdated packages, 11 with major-version gaps (React 19, Tailwind 4, Router 7, Vitest 4, TS 6, etc.). Zero CVEs.
7. Monetization bridges (`ads.ts`, `purchases.ts`, `haptics.ts`) carry all the `any` / `@ts-expect-error` debt — typical for native SDK shims.
8. React Router v7 future-flag warnings surface during tests (`v7_startTransition`, `v7_relativeSplatPath`). Cosmetic until v7 bump.

No fixes applied. Stop here.
