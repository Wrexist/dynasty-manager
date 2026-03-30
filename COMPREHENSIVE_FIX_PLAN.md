# Comprehensive Codebase & Feature Review + Fix Plan

**Date:** 2026-03-30  
**Repository:** `dynasty-manager`  
**Requested scope:** review the whole codebase for incomplete implementations, bugs/errors/problems, hardcoded risks, and produce a complete fix plan.

## 1) Audit Method Used

I reviewed the codebase and behavior using:

- Source inventory and architecture pass (pages/components/store/utils/config/data).
- Static scans for bug markers and risky patterns (`TODO`, `stub`, hardcoded flags, direct persistence usage).
- Full quality gate commands:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run typecheck`
- Focused release/content test pass:
  - `npx vitest run src/test/contentAudit.test.ts src/test/releaseReadiness.test.ts`

## 2) What Is Implemented Today (Feature Surface)

The app is already substantial and production-shaped in breadth:

- **Core gameplay loop + multi-screen management sim** built across `GameShell` and 40+ pages.
- **Squad/tactics/match flow** (match engine, lineup editor, match day/review, transfer/loan negotiation, training, youth, scouting).
- **Career/meta systems** (manager profile, achievements, perks, prestige, board/inbox/calendar/finance/staff/facilities).
- **Competition systems** (league, cup, league cup, continental pages, super cup, international tournament page).
- **Monetization scaffolding** (shop, ads wrapper, purchases wrapper, pro upsell).
- **Cross-platform target** via Capacitor (web + iOS + Android folders present).
- **Automated tests**: broad test suite exists and currently passes under Vitest.

## 3) Major Issues Found (Prioritized)

## P0 — Must fix before any release hardening

1. **TypeScript build integrity is broken (`npm run typecheck` fails).**
   - Dozens of compile errors across types, missing props, missing modules, and state/type drift.
   - Highest-risk examples:
     - Press conference tone type mismatch (`strategic`/`analytical` expected, data only has 3 tones).
     - `GameState` missing required `lastMatchCompetition` during store composition.
     - `orchestrationSlice` references `get` in places where symbol is unavailable.
     - Missing native plugin typings/packages for purchases + ads.

2. **Dependency/type contract mismatch for optional native monetization plugins.**
   - `@revenuecat/*` and `@capacitor-community/admob` imports are unresolved in typecheck.
   - Runtime guards exist, but compile contract is currently broken.

3. **Domain model drift between state/types/UI.**
   - Examples: `squadNumber`, `promoted`, `cupState`, `ObjectiveInstance`, icon prop mismatches, screen enum mismatches.

## P1 — Important functional quality issues

4. **Content repetition risks remain.**
   - Content audit warns about low press conference question count and deterministic fixture generation.

5. **Large-file concentration and maintainability bottlenecks.**
   - `orchestrationSlice.ts` is extremely large and centralizes too many responsibilities.
   - `Dashboard.tsx`, `engine/match.ts`, and several page/components are oversized and difficult to reason about safely.

6. **Long-test noisy persistence behavior in longevity tests.**
   - Save write failures are repeatedly logged in stress tests even when tests pass, masking real failures and reducing signal.

## P2 — Strategic/product alignment gaps

7. **Current product is a football management sim, but requested direction is life simulator.**
   - There is currently no life-sim core domain (character life stages, education/career/relationships/housing/health loops, emergent life events economy) despite platform base being reusable.

## 4) Hardcoded/Config Risks

- Native monetization is deliberately disabled (`NATIVE_MONETIZATION_READY = false`) and appears in operational code paths.
- Some constants and UI assumptions are still tightly coupled to football-domain constructs, making pivot/extensibility expensive.
- Build output warns that the main chunk is very large; additional chunking strategy is needed.

## 5) Complete Fix Plan (Execution Roadmap)

## Phase 0 — Stabilize engineering baseline (1–2 weeks)

- **0.1 Type contract repair sweep (mandatory)**
  - Resolve all `npm run typecheck` errors to zero.
  - Introduce strict shared type fixtures for `GameState`, `SeasonHistory`, `Player`, press conference models.
  - Add CI gate: fail PRs if typecheck fails.

- **0.2 Native plugin boundary strategy**
  - Option A: install + type native monetization plugins now and wire proper feature detection.
  - Option B: isolate all plugin imports behind adapter interfaces and provide web-safe typed stubs.
  - Goal: no unresolved module/type errors on web CI.

- **0.3 Test signal cleanup**
  - Fix save-write path behavior for test environment (inject persistence adapter / mock storage quotas).
  - Keep longevity tests noisy-free except true failures.

**Exit criteria:** lint/test/build/typecheck all green with deterministic CI behavior.

## Phase 1 — Functional correctness + content depth (1–2 weeks)

- **1.1 Press conference model fix**
  - Reconcile `PressResponseTone` union with actual content model.
  - Add missing tone content or narrow union.

- **1.2 Fixture variety improvement**
  - Introduce seedable fixture randomization to avoid identical season schedules.
  - Preserve deterministic replay by storing seed in save state.

- **1.3 Content expansion package**
  - Expand press conference question bank.
  - Add more storyline chains and contextual triggers.
  - Add more objective templates and event variants to reduce repetition.

**Exit criteria:** content audit warnings removed; no type drift from new content schemas.

## Phase 2 — Architecture refactor (2–4 weeks)

- **2.1 Split orchestration responsibilities**
  - Extract save/load, season transitions, match progression, and event generation into bounded modules.

- **2.2 Page/component decomposition**
  - Break oversized pages into view-model + presentation components.

- **2.3 Performance pass**
  - Add memoization where re-render hotspots exist.
  - Introduce virtualization for large list-heavy screens.
  - Improve chunking strategy (manual chunks and lazy boundaries) to reduce initial payload.

**Exit criteria:** smaller modules, lower regression risk, improved runtime and bundle profile.

## Phase 3 — Life Simulator product pivot (iOS + Android + Web) (4–8+ weeks)

This addresses your instruction: **“Skapa en life simulator app för iOS och Android mobiler, även webbaserat.”**

- **3.1 Domain extraction**
  - Extract reusable platform shell from football domain (navigation, save system, settings, monetization adapter, UI kit).

- **3.2 New life-sim core model**
  - Character profile + traits
  - Time progression (day/week/month/year)
  - Education/career tracks
  - Relationships/family graph
  - Health/energy/stress systems
  - Economy (income, rent, purchases, debt, investments)
  - Event engine (random + conditional story events)

- **3.3 Simulation engine & balancing**
  - Build deterministic seedable simulation modules.
  - Define balancing constants in config-only files.

- **3.4 UX flows**
  - New onboarding (create person/background)
  - Core loop dashboard
  - Decision screens (career, relationships, finance, life events)
  - End-of-year recap and milestone system

- **3.5 Cross-platform release tracks**
  - Web PWA quality path.
  - iOS/Android native wrapper hardening via Capacitor.
  - Native plugin readiness checklist (notifications, purchases, ads, privacy prompts).

**Exit criteria:** playable life-sim MVP on web + iOS + Android from shared core.

## Phase 4 — Release governance and observability (ongoing)

- CI pipeline: lint + tests + typecheck + build as required checks.
- Add smoke E2E tests for top user journeys.
- Crash/error telemetry triage workflow.
- Release checklist automation (assets, legal pages, store metadata, version sync).

## 6) Suggested Immediate Backlog (first 10 tickets)

1. Fix all `PressResponseTone` model/data mismatches.
2. Add/restore missing `GameState` properties (`lastMatchCompetition` etc.) in store composition.
3. Resolve all unresolved native plugin imports (install or adapter-stub).
4. Fix invalid state/prop references (`squadNumber`, `promoted`, `cupState`, `ObjectiveInstance`, `GameScreen`).
5. Repair framer-motion variant typing (`ease` typed constants).
6. Remove unsupported icon props (`title`) and replace with a11y wrappers.
7. Fix `orchestrationSlice` `get` symbol issues.
8. Introduce seeded fixture shuffling + tests.
9. Expand press conference dataset to target repetition threshold.
10. Define life-sim domain schema document + migration strategy from current app shell.

## 7) Definition of Done for “Fix Everything”

A practical DoD for this repository:

- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes.
- `npm run typecheck` passes (currently failing and is the top blocker).
- No unresolved plugin imports in web CI.
- Content audit has no warning-level findings for repetition-critical systems.
- Architecture hotspots split into maintainable modules.
- If pivoting to life sim: first playable life-sim loop delivered on web + iOS + Android.
