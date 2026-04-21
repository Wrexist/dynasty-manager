# Release Triage — Prioritized Fix List

Source of findings: `docs/release-audit.md` (2026-04-21 baseline).
Priority scheme:
- **P0** — shipblocker. Cannot release in current state.
- **P1** — must fix before release. Degrades user trust if shipped.
- **P2** — should fix. Not user-visible, but costs future velocity or signals sloppiness.
- **P3** — nice to have. Polish.

Effort:
- **S** — ≤ 30 min, single file, obvious fix.
- **M** — 30 min–2 h, multi-file or requires thought.
- **L** — half-day+ or spans the codebase.

---

## P0 — Shipblockers

| # | Item | File | Effort | Why it matters |
|---|------|------|:-:|---|
| P0-1 | `PackShopCard` imports `PackTierDefinition` from `@/config/packs` which only re-imports (never re-exports) the type. `TS2459`. | `src/components/game/pack/PackShopCard.tsx:4` | **S** | Breaks `npm run typecheck` and therefore `npm run preflight` → blocks `npm run ship`. Two-line fix (either import from `@/types/game` or re-export from `config/packs`). Genuine bug, not a stale fixture. |
| P0-2 | `useGameStore` composition in `gameStore.ts` doesn't provide initial values for `communityPackEnabled` and `cpPool` required by `GameState`. `TS2739`. | `src/store/gameStore.ts:21` | **S** | Same blocking effect on preflight. Also a latent runtime bug: a store consumer reading `state.cpPool` before `initGame()` runs will see `undefined`. Add defaults either in a slice's initial state or directly in the composed object. |
| P0-3 | 15 `TS2322` errors in `nationalTeamPool.test.ts` — string values assigned to numeric fields. | `src/test/nationalTeamPool.test.ts:74-75, 96-97` | **S** | Blocks `typecheck`. The test passes at runtime (Vitest doesn't type-check) but the fixture is wrong-typed — easy to miss if someone later relies on the type. Fix is literally dropping quotes around the numbers. |
| P0-4 | `TS2352` — `matchPhase: "simulating"` isn't a member of the `MatchPhase` union. | `src/test/subNav.test.tsx:60` | **S** | Blocks `typecheck`. Likely stale after a rename — check the intended value from the current `MatchPhase` union (`"first_half" \| "second_half" \| ...`) and update. |

**P0 total: 4 issues, all S, ~1 hour combined.** No security CVEs. No runtime crashes found. No `@ts-ignore` anywhere (the audit mis-reported 2 in `ads.ts` — actual count is **0**; those were `@ts-expect-error` which is self-checking and not masking bugs).

---

## P1 — Must Fix Before Release

| # | Item | File | Effort | Why it matters |
|---|------|------|:-:|---|
| P1-1 | **Community-pack Phase 7 tests missing.** No `communityPack.test.ts`; zero coverage for `src/utils/communityPackPool.ts` (seeded shuffle, active-pool cursor, market rotation) or for the v59→v60 save migration path. | `src/test/` (new file) | **M** | Largest new feature ships untested. Save migration is especially sensitive — if v59→v60 corrupts a field it silently breaks every existing save on upgrade. At minimum: migration fixture test + 2-3 pool helper tests. |
| P1-2 | `console.error` / `console.warn` in production boot path (`main.tsx`) should route through Sentry, not raw console. | `src/main.tsx` (1 `error`, 4 `warn`) | **S** | Currently tied to devtools. Users on TestFlight don't have console access — errors are invisible. Sentry is already in `package.json` (`@sentry/react`), so this is a wire-up. |
| P1-3 | `console.error` x6 in `purchases.ts` during real IAP failures. | `src/utils/purchases.ts` | **S** | Payment failures not surfaced to Sentry. If a user's purchase fails silently in prod you have no log. Same fix as P1-2. |
| P1-4 | Capacitor plugin patch bumps (8.2.0 → 8.3.1) before store submission. | `package.json` | **S** | Patch releases on native plugins fix iOS 18 / Android 15 compat issues. Not doing this before submission risks a store rejection or crash on latest OS. No API breaks. |
| P1-5 | @sentry/react patch bump (10.45 → 10.49). | `package.json` | **S** | Crash-reporting SDK patches often fix upload-path bugs. Quick patch, high value. |
| P1-6 | Confirm community-pack UI scope cut is intentional. Plan required `PackStore.tsx` / `PackOpen.tsx` / `Collection.tsx`; none exist. | conversation / product decision | **S** (decision) or **L** (if building) | If scope was cut, delete the unused portions of the plan in `scripts/community-pack-plan.md` and the two "Open questions" bullets that reference unbuilt surfaces. If it wasn't, this is an L-sized feature gap. |
| P1-7 | React Router future-flag warnings in test output (`v7_startTransition`, `v7_relativeSplatPath`). | `src/App.tsx` or router config | **S** | Not runtime errors, but noisy in logs and signal to real v7 compat issues later. Adding the opt-in flags (`future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`) silences them and smoke-tests the v7 behavior today. |

**P1 total: 7 issues, ~4-6 hours plus one product decision (P1-6).**

---

## P2 — Should Fix

| # | Item | File | Effort | Why it matters |
|---|------|------|:-:|---|
| P2-1 | 18 `@ts-expect-error` annotations — mostly correct, but 11 of them cluster in `src/test/sponsorship.test.ts`. Review whether the test should be refactored to not need them. | `src/test/sponsorship.test.ts` (11), `src/utils/purchases.ts` (3), `src/utils/haptics.ts` (2), `src/test/match.test.ts` (1), `src/store/slices/orchestrationSlice.ts` (1) | **M** | `@ts-expect-error` is self-validating (compiler errors when the silenced error disappears), so low risk. The concentration in sponsorship tests suggests a typing gap worth closing. |
| P2-2 | 18 `: any` annotations in native bridges (`purchases.ts`, `haptics.ts`, `ads.ts`) and test helpers. | same files as P2-1 | **M** | Most are legitimate shims for untyped Capacitor plugins. Adding minimal declared interfaces for the plugin surfaces we actually call would remove them and give IDE hints. |
| P2-3 | `index-*.js` main chunk is 1.02 MB min / 285 KB gzip. | Vite build output | **M** | Run `npm run analyze` (rollup-plugin-visualizer is already installed) to identify what's eagerly imported and pull candidates into route-level chunks. Dashboard at 119 KB suggests dashboard-visible imports may be leaking into index. Trim before hitting the App Store 4 MB over-cellular warning. |
| P2-4 | `squad-data-*.js` is 1.88 MB / 360 KB gzip for every user, even ones who never enable community pack. | `src/data/squads/*` | **L** | Biggest single baseline payload. Could lazy-load per-continent or per-division. Would reduce cold-start data transfer by ~40%. Not blocking, but a clear win. |
| P2-5 | No tests for `orchestrationSlice.ts` (~1,970 LOC, the largest file). | `src/test/` (new file) | **L** | High-complexity file with only 1 `@ts-expect-error` but a lot of inline game logic (week advance, season end, community-pack init). Longevity tests exercise paths but aren't unit-level. Low test-to-LOC ratio for the game-loop brain. |
| P2-6 | Major-version deps 11 behind. None are release-blockers. | `package.json` | **L** | Project call. React 19 / Tailwind 4 / Router 7 / Vitest 4 / TS 6 / Recharts 3 migrations are each their own project. Sort by ecosystem risk and budget them after release, not before. |
| P2-7 | Browserslist data 10 months old. | `node_modules/caniuse-lite` | **S** | Cosmetic build warning. `npx update-browserslist-db@latest` and commit `package-lock.json`. |
| P2-8 | `console.log` in tests — 12 in `contentAudit.test.ts`, 2 in `longevity.test.ts`. Intentional, but noisy in CI logs. | `src/test/contentAudit.test.ts`, `src/test/longevity.test.ts` | **S** | Gate behind a `VITEST_AUDIT=true` env so default `npm test` is quieter. |

**P2 total: 8 issues. P2-1 through P2-3 are worth doing this cycle; P2-4 through P2-8 are backlog candidates.**

---

## P3 — Nice to Have

| # | Item | File | Effort | Why it matters |
|---|------|------|:-:|---|
| P3-1 | Sourcemaps inflate `dist/` from ~20 MB to 45 MB. | `vite.config.ts` | **S** | Keep sourcemaps for Sentry but set `build.sourcemap: 'hidden'` so they're generated but not referenced. CI upload stays small; Sentry still resolves stack traces via upload. |
| P3-2 | 1,970-LOC `orchestrationSlice.ts` listed in CLAUDE.md's "Known Tech Debt". | `src/store/slices/orchestrationSlice.ts` | **L** | Extract week-advance, season-end, and community-pack-init into helpers under `src/store/helpers/`. Pure refactor. `/project:refactor` command is built for exactly this. |
| P3-3 | 395k LOC under `src/data/communityPack/*` is machine-generated but checked in as TS. | `src/data/communityPack/` | **M** | Moving these to JSON + a single typed loader would (a) skip TS parsing on build (faster), (b) be easier to diff, (c) open the door to delta-loading. |
| P3-4 | `STOP` button/skip path unverified in pack-opening flow. | `src/pages/PacksPage.tsx` | **M** | Not a bug so far as the tests show, but pack-opening is a timing-sensitive animated flow and tests don't cover interrupt/skip. Add one interaction test. |
| P3-5 | `scripts/community-pack-plan.md` describes a feature that wasn't built. | `scripts/community-pack-plan.md` | **S** | Either archive under `docs/archive/` with a note, or update to match what shipped. Right now it misleads future readers. |
| P3-6 | Zero `TODO`/`FIXME`/`HACK` markers in code is unusual. | n/a | **S** | Confirm that known-deferred work is tracked in GitHub issues rather than silently lost. If so, link the triage tags in PRs. |
| P3-7 | Patch-level dep drift (Capacitor, Sentry, Radix x4, etc.) | `package.json` | **S** | Already partially covered by P1-4/P1-5. Remaining ones (radix, typescript-eslint, zustand) are low-risk maintenance. |

---

## What to tackle first

**This sitting (≤ 2 hours):** P0-1, P0-2, P0-3, P0-4, P1-2, P1-3, P1-4, P1-5, P1-7, P2-7. All S-sized. Gets the tree to green `typecheck` + Sentry-routed errors + compat-patched natives + clean browserslist.

**Before submitting to the store:** P1-1 (community-pack tests), P1-6 (scope decision), P2-3 (main-chunk analyzer run).

**Next cycle:** P2-1 / P2-2 / P2-4 / P2-5 / P3-1 / P3-2.

No fixes applied — this is the plan only. Stop.
