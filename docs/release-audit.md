# Release Readiness Audit

Baseline report — no fixes applied, findings only.

- **Branch:** `claude/audit-release-readiness-yVtum`
- **Date:** 2026-04-22
- **Node/npm:** Node ≥18, npm ≥9 (per `package.json` engines)
- **HEAD:** `d724c77` — Merge pull request #405 (await initGame so new-game save reaches the slot)
- **Working tree:** clean (no modified/untracked files)
- **Scope:** `src/` + root config. 434 TS/TSX files, ~523,628 LOC total
  (~107,048 LOC if you exclude the generated data tables under
  `src/data/communityPack/*`, `src/data/squads/*`, and
  `src/data/nationalPlayerPool.ts`).

Supersedes the prior audit of 2026-04-21 (`claude/audit-release-readiness-F989t`).
Most P0/P1 items from that triage have been resolved (see §11 below).

---

## 1. TypeScript Health — PASS

`npx tsc --noEmit -p tsconfig.app.json` → **0 errors**, exit 0.

The 18 errors that the prior audit flagged were resolved in commit
`9b4c0c7 fix(ts): resolve 18 typecheck errors (P0)`. Typecheck is now clean.

Note: `tsconfig.json` keeps `strict: false` and `strictNullChecks: false`,
so a strict-mode re-audit would surface additional issues. Current config
matches the documented project convention; no action required for release.

---

## 2. Lint Health — PASS

`npm run lint` → **0 errors, 0 warnings**, exit 0.
(ESLint 9.32.0 via `eslint.config.js`.)

---

## 3. Dead Code / Debt Markers

Counts under `src/`:

| Marker | Count | Notes |
|--------|------:|-------|
| `TODO` | 0 | Clean. |
| `FIXME` | 0 | Clean. |
| `XXX` | 0 | Clean. |
| `HACK` | 0 | Clean. |
| `@ts-ignore` | 0 | None. |
| `@ts-expect-error` | 2 | Both in `src/utils/ads.ts` lines 32 and 60 — justified: dynamic optional imports of native plugins that only resolve at runtime on device. |
| `: any` annotations (all) | 18 | 6 in `src/`, 12 in `src/test/`. |

### `: any` breakdown (non-test `src/` only)

| File | Line | Context |
|------|-----:|---------|
| `src/utils/haptics.ts` | 8 | `let Haptics: any = null;` — dynamic import placeholder. |
| `src/utils/haptics.ts` | 10 | `let ImpactStyle: any = null;` — dynamic import placeholder. |
| `src/utils/purchases.ts` | 148 | `mapEntitlements(customerInfo: any)` — third-party SDK payload. |
| `src/utils/purchases.ts` | 182 | `extractSubscriptionInfo(customerInfo: any)` — same reason. |
| `src/utils/purchases.ts` | 216 | `const options: any = {};` — dynamic option bag for paywall. |
| `src/store/slices/orchestrationSlice.ts` | 3497 | Inside a comment only — not a real annotation (a grep false positive). |

Real `any` annotations in production code: **5**, all in adapter layers
around `@capacitor/haptics` and `@revenuecat/purchases-capacitor`. Safe to
leave for release; could be tightened post-ship.

Test-only `any` (12 occurrences, mostly in `src/test/sponsorship.test.ts`
with one comment match in `src/test/match.test.ts`) is acceptable.

---

## 4. Console Noise

Grep under `src/`:

| Pattern | Hits | Files |
|---------|-----:|-------|
| `console.log` | 2 files | `src/test/contentAudit.test.ts`, `src/test/longevity.test.ts` — test-only, intentional diagnostic output. |
| `console.warn` | 7 files | `src/main.tsx`, `src/pages/GameShell.tsx`, `src/utils/ads.ts`, `src/utils/purchases.ts`, `src/utils/promotionRelegation.ts` + 2 test files. |
| `console.error` | 3 files | `src/main.tsx`, `src/utils/ads.ts`, `src/utils/purchases.ts`. |
| `debugger` | 0 | Clean. |

All `console.warn`/`console.error` calls in production code are inside
catch blocks for native-init failures, purchase errors, ad-load errors, or
defensive state checks (e.g. `promotionRelegation.ts` logs an unexpected
division size). These are forwarded to Sentry by the surrounding handlers
(see commit `94dd7b3`) — the console output is the local-dev companion.

**Recommendation:** leave as-is for release. None of these fire on the
happy path.

---

## 5. Test Coverage — PASS

`npm run test` → **51 test files, 841 tests, all passed**. Duration 378s
(dominated by `longevity.test.ts` at 128s and `edgeCases.test.ts` at 14s,
both of which simulate 10–20 full seasons).

Notable suites that already guard release-critical behavior:

- `communityPack.test.ts` (34 tests) — pool helpers, v59→v60 migration,
  league squads.
- `longevity.test.ts` (6 tests, 128s) — 10–20 season stress, no state
  corruption, player lifecycle integrity.
- `edgeCases.test.ts` — transfer-window boundaries, loan clauses, season
  turnover.
- `releaseReadiness.test.ts` (13 tests) — release smoke.
- `contentAudit.test.ts` (18 tests) — achievement/perk/storyline content
  counts (surfaced to stdout as `[Content Audit] …` lines during the run).
- `saveMigration.test.ts` (11 tests) — v22→v23 clean-break + later
  migration chain.

No skipped (`.skip`), no `.only`, no failing tests.

---

## 6. Dependencies

`npm audit` → **0 vulnerabilities** across 645 packages (info/low/moderate/high/critical all zero).

`npm outdated` → 32 packages behind. Security picture is clean; these are
feature/maintenance gaps only.

### Major version gaps (shipping blockers = none, but worth tracking)

| Package | Current | Latest | Risk |
|---------|---------|--------|------|
| `react` / `react-dom` | 18.3.1 | 19.2.5 | Major — Suspense/ref changes. Out of scope for this release. |
| `@types/react` / `@types/react-dom` | 18.3.x | 19.2.x | Tied to React 18. |
| `react-router-dom` | 6.30.3 | 7.14.2 | Major — React Router v7 future flags already opted-in (commit `0f2ada2`). Full v7 upgrade deferred. |
| `recharts` | 2.15.4 | 3.8.1 | Major — only used on stats pages, low surface area but needs test. |
| `sonner` | 1.7.4 | 2.0.7 | Major — toast API. |
| `tailwindcss` | 3.4.19 | 4.2.4 | Major — v4 is a rewrite. Deferred. |
| `tailwind-merge` | 2.6.1 | 3.5.0 | Tied to tailwindcss v4. |
| `typescript` | 5.8.3 | 6.0.3 | Major. Hold until ecosystem lands. |
| `vite` | 7.3.2 | 8.0.9 | Major. |
| `vitest` | 3.2.4 | 4.1.5 | Major. |
| `@vitejs/plugin-react-swc` | 3.11.0 | 4.3.0 | Major. |
| `lucide-react` | 0.462.0 | 1.8.0 | Major — icon API changes. |
| `jsdom` | 28.1.0 | 29.0.2 | Major, test-only. |
| `eslint` | 9.32.0 | 10.2.1 | Major. |
| `eslint-plugin-react-hooks` | 5.2.0 | 7.1.1 | Major. |
| `@revenuecat/purchases-capacitor` | 12.3.2 | 13.0.1 | Major — native IAP SDK, needs QA on device. |
| `@revenuecat/purchases-capacitor-ui` | 12.3.2 | 13.0.1 | Same. |
| `@types/node` | 22.16.5 | 25.6.0 | Dev-only. |
| `globals` | 15.15.0 | 17.5.0 | Dev-only. |
| `@eslint/js` | 9.39.4 | 10.0.1 | Dev-only. |

### Patch/minor bumps available (safe)

`@radix-ui/*` (4 packages), `autoprefixer`, `framer-motion` 12.35.2→12.38.0,
`postcss`, `tailwind-merge` 2.6.0→2.6.1, `typescript-eslint` 8.38.0→8.59.0,
`zustand` 5.0.11→5.0.12, `eslint-plugin-react-refresh` 0.4.20→0.4.26,
`@types/node` 22.16.5→22.19.17.

**Recommendation:** ship on current pins (0 vulnerabilities, all tests
pass). Stage patch/minor bumps post-release; hold majors for a separate
upgrade cycle.

---

## 7. Bundle Size

`npm run build` → success in 29.8s. Output under `dist/`:

- **Total raw JS** (no source maps): **8,957,809 B ≈ 8.6 MB**
- **Total gzipped JS** (no source maps): **1,933,219 B ≈ 1.84 MB**
- **Total dist/** (incl. maps): 45 MB
- **Files:** 93 JS chunks + 93 source maps + `index.html` (2.5 KB)

### Largest chunks (raw / gzipped)

| Chunk | Raw | Gzipped | Notes |
|-------|----:|--------:|-------|
| `squad-data-*.js` | 1.88 MB | 360 KB | FC25 squads — baked. Lazy-loaded per club. |
| `freeAgents-*.js` | 1.88 MB | 312 KB | Community-pack free agents. Lazy-loaded only when community-pack toggle is ON. |
| `byClub-*.js` | 1.15 MB | 207 KB | Community-pack rostered players. Lazy-loaded only when CP toggle ON. |
| `index-*.js` | 1.03 MB | 286 KB | Main app bundle. |
| `national-pool-*.js` | 457 KB | 82 KB | National team player pool (existing). |
| `cpLeagueSquads-*.js` | 574 KB | 98 KB | 7 CP-only league squads, lazy-loaded. |
| `recharts-*.js` | 413 KB | 111 KB | Vendor chunk. |
| `radix-*.js` | 212 KB | 70 KB | Vendor chunk. |
| `framer-motion-*.js` | 132 KB | 44 KB | Vendor chunk. |

Vite warns about chunks > 500 KB (standard warning, documented and expected
here: the squad/CP data files are large by design and are code-split).

**Flag:** `freeAgents-*.js` at 1.88 MB raw / 312 KB gzipped is the single
biggest lazy chunk. Already gated behind the community-pack toggle, so
users who don't enable it never download it. No action for release.

---

## 8. Community Pack Integration

The planning doc at `scripts/community-pack-plan.md` describes 7 phases; the
actual ship landed as 8 merged implementation commits in PR #388
(`claude/add-community-pack-init-QIh3P`) plus follow-ups. All present, all
clean.

### Phase-by-phase status

| # | Commit | Description | Status |
|---|--------|-------------|:------:|
| 1 | `75d0b88` | Add `Player.source`/`fcId`/`heightCm`/`weightKg` + GameState `communityPack` types | committed |
| 2 | `a087a91` | v59→v60 save migration for Community Pack fields | committed (see `src/utils/saveMigration.ts:892-897`, `CURRENT_VERSION=60`) |
| 3 | `861ea9f` | Seeded shuffle + active-pool helpers | committed (`src/utils/communityPackPool.ts`) |
| 4 | `765a287` | Market + scouting draw helpers | committed |
| 5 | `f8a12cd` | AI fill, youth, cursor-advance helpers | committed |
| 6 | `683ed34` | Community-pack branch inside `initGame` | committed (`src/store/slices/orchestrationSlice.ts:2749-2803`) |
| 7 | `6747b84` | Seed initial transfer market from CP free agents | committed |
| 8 | `ed6b688` | Rotate CP market listings every 4 weeks | committed |

### Supporting artifacts (all present)

| File | LOC | Notes |
|------|----:|-------|
| `src/data/communityPack/byClub.ts` | 119,893 | Rostered CP players, per-club templates. |
| `src/data/communityPack/freeAgents.ts` | 195,058 | Unclubbed CP players. |
| `src/data/communityPack/newLeagues.ts` | 79,857 | 7 CP-only leagues. |
| `src/data/communityPack/cpLeagueSquads.ts` | 25 | Lazy-loader façade. |
| `src/utils/communityPackPool.ts` | 155 | Pool helpers (shuffle, active pool, draw). |
| `src/components/CommunityPackPopup.tsx` | 199 | Opt-in popup, wired into new-game flow. |
| `src/test/communityPack.test.ts` | 307 | 34 tests. |

### Integration touch points

Grep for `communityPack|CommunityPack|cpPool` across `src/` finds 16 files
referencing the feature:

- Store: `storeTypes.ts`, `coreSlice.ts`, `careerSlice.ts`,
  `orchestrationSlice.ts`, `helpers/persistence.ts`.
- UI: `TitleScreen.tsx`, `SettingsPage.tsx`, `ModeSelect.tsx`,
  `ManagerCreation.tsx`, `ClubSelection.tsx`, `CommunityPackPopup.tsx`.
- Data/logic: `utils/saveMigration.ts`, `utils/communityPackPool.ts`,
  `data/squads/index.ts`.
- Tests: `test/communityPack.test.ts`, `test/autosave.test.ts`.

### Cleanliness checks

- `git status` → clean working tree, no stray files.
- No orphaned `communityPack*` files outside `src/data/communityPack/` and
  the touch-points above.
- Community-pack toggle defaults to `false` (`coreSlice.ts:61`). Users
  who don't opt in pay zero bytes of CP data (lazy chunks never load).
- Bundle chunking is explicit: `byClub`, `freeAgents`, `cpLeagueSquads`,
  `national-pool` all split into their own chunks (commit `6ca134c`).

Community Pack integration is shippable. No follow-up needed for release.

---

## 9. Observability & Release Plumbing

Captured here for completeness — not part of the requested eight audit
items, but visible from the git log and relevant to ship readiness.

- **Sentry:** wired in `src/main.tsx` and IAP paths (commit `94dd7b3`).
- **React Router v7 future flags:** opted in (commit `0f2ada2`).
- **Capacitor + Sentry patch-bumps:** applied (commit `b72cd68`).
- **Husky + lint-staged:** active pre-commit hook runs `eslint --fix`.

---

## 10. Tooling Note (one-time friction)

`node_modules/` was absent at audit start — a fresh `npm install` (25s, 587
packages, 0 vulns) was needed before `tsc`, `eslint`, `vitest`, and `vite`
would run. Normal for a fresh clone; flagged so CI/humans aren't surprised.

---

## 11. Delta vs. Prior Audit (2026-04-21)

Quick diff against the previous state of `docs/release-audit.md` (superseded
by this run):

| Section | Prior | Now | Change |
|---------|-------|-----|--------|
| TypeScript | 18 errors / 4 files | 0 errors | Fixed in `9b4c0c7` |
| Lint | 0 / 0 | 0 / 0 | = |
| TODO/FIXME markers | 0 | 0 | = |
| `@ts-expect-error` | 2 (same locations) | 2 | = |
| `any` annotations (prod) | 5 | 5 | = |
| Tests | not run | 841/841 pass | new data |
| `npm audit` | 0 vulns | 0 vulns | = |
| Community pack | 8-phase implementation present | All 8 phases verified clean | confirmed |

---

## 12. Summary

Release gate status:

| Check | Verdict |
|-------|:-------:|
| TypeScript | PASS |
| Lint | PASS |
| Tests | PASS (841/841) |
| Security (npm audit) | PASS (0 vulns) |
| Bundle build | PASS |
| Community pack integration | PASS (all 8 phases clean) |
| Working tree clean | PASS |
| Dead-code markers | PASS (0 TODO/FIXME/HACK) |
| Console noise | WARN — intentional error/warn logs in native adapter paths; forwarded to Sentry |
| Dependencies — patch/minor | WARN — ~10 non-breaking bumps available post-ship |
| Dependencies — major | WARN — React 19 / RR7 / Tailwind 4 / Vite 8 deferred |

No blockers. The branch is release-ready; remaining items are optional
post-ship maintenance.
