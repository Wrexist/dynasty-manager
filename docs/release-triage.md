# Release Triage — Prioritized Fix List

Source of findings: `docs/release-audit.md` (2026-04-22 on
`claude/audit-release-readiness-yVtum`, supersedes the 2026-04-21 triage).

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

**None.**

All P0 items from the prior triage have been resolved:

- ~~TypeScript errors (18 across 4 files)~~ — fixed in `9b4c0c7` (`fix(ts): resolve 18 typecheck errors (P0)`). `tsc --noEmit` now exits 0.
- ~~Build failures~~ — `npm run build` succeeds in 29.8s.
- ~~Security vulnerabilities~~ — `npm audit` reports 0 vulns across 645 packages (0 info/low/moderate/high/critical).
- ~~Crashes on happy path~~ — 841/841 tests pass including `longevity.test.ts` (10–20 season stress) and `edgeCases.test.ts`.
- ~~`@ts-ignore` masking real bugs~~ — 0 occurrences in the codebase.

No shipblockers.

---

## P1 — Must Fix Before Release

**None.**

All P1 items from the prior triage have been resolved:

- ~~Community-pack tests missing (old P1-1)~~ — `src/test/communityPack.test.ts` (307 LOC, 34 tests) covers pool helpers, v59→v60 migration, and league squads (commit `a6171e8`).
- ~~Native boot-path / IAP errors not reaching Sentry (old P1-2, P1-3)~~ — routed in commit `94dd7b3` (`chore(observability): route native-init + IAP errors to Sentry`).
- ~~Capacitor + Sentry patch bumps (old P1-4, P1-5)~~ — applied in commit `b72cd68` (`chore(deps): patch-bump Capacitor + Sentry, refresh browserslist`).
- ~~React Router v7 future-flag warnings (old P1-7)~~ — opted in via commit `0f2ada2` (`chore(router): opt in to React Router v7 future flags`).
- ~~Community-pack UI scope (old P1-6)~~ — the scope landed as a popup-only opt-in (`CommunityPackPopup.tsx`) plus market/squad integration. The original `PackStore.tsx` / `Collection.tsx` surfaces from `scripts/community-pack-plan.md` were not built — scope decision executed. (Moved to P3-5 as a doc-archival task.)

### Checks that still audit clean

| Check | Status |
|---|---|
| Lint errors | 0 |
| Failing tests | 0 |
| Skipped (`.skip`) / `.only` | 0 |
| `console.error` on happy path | 0 (only in catch blocks, forwarded to Sentry) |
| Unhandled promise rejections | None found in audit grep |
| Missing error boundaries | `App.tsx` wraps app in Sentry's `ErrorBoundary` (PR #391/#405 history) |

No P1 items.

---

## P2 — Should Fix

| # | Item | File | Effort | Why it matters |
|---|------|------|:-:|---|
| P2-1 | `index-*.js` main chunk is 1.03 MB raw / 286 KB gzip. Recharts/Radix/framer-motion are vendor-chunked; the Dashboard chunk is 117 KB — suggests some eagerly-imported logic leaking into `index`. | `dist/assets/index-*.js`, Vite config | **M** | Run `npm run analyze` (rollup-plugin-visualizer is already installed) and move any accidentally eager imports to route-level dynamic imports. Keeps initial payload under the App Store's 4 MB-over-cellular threshold with headroom. |
| P2-2 | 5 real `any` annotations in native adapter code. | `src/utils/haptics.ts` (2), `src/utils/purchases.ts` (3) | **M** | Declared interfaces for the narrow Capacitor/RevenueCat surfaces we actually use would remove them and give IDE hints without pulling in plugin type packages. Low risk, low value — cleanup. |
| P2-3 | 12 `any` in `src/test/sponsorship.test.ts` on message-payload introspection. | `src/test/sponsorship.test.ts` | **S** | Replace with the `GameMessage` union type from `@/types/game` and add a narrow helper. Self-contained. |
| P2-4 | `freeAgents-*.js` is 1.88 MB raw / 312 KB gzip; `byClub-*.js` is 1.15 MB / 207 KB. Only loaded when the community-pack toggle is ON, but every user who opts in pays the full transfer at init. | `src/data/communityPack/*` | **L** | Split by tier / nation / league and draw lazily via `communityPackPool`'s cursor. Current architecture already supports this — data just needs splitting. Not blocking; users who opt in already accept the cost. |
| P2-5 | `orchestrationSlice.ts` at ~1,970 LOC is the largest file and only has integration-style coverage via `longevity.test.ts`. | `src/store/slices/orchestrationSlice.ts`, new tests under `src/test/` | **L** | Not wrong; just hard to reason about. Extract `advanceWeek`, `endSeason`, and `initGame`'s community-pack branch into helpers under `src/store/helpers/` (pattern already established by `development.ts`, `matchProcessing.ts`, `persistence.ts`). Paired unit tests would then be cheap. |
| P2-6 | 11 major-version dep gaps: React 19, React Router 7, Tailwind 4, Vite 8, Vitest 4, TypeScript 6, Recharts 3, Sonner 2, `@vitejs/plugin-react-swc` 4, `lucide-react` 1.x, `jsdom` 29, ESLint 10, `eslint-plugin-react-hooks` 7, RevenueCat 13. None are blockers. | `package.json` | **L** | Each is its own migration project. Budget after release. RevenueCat 13 and Router 7 are the two with the clearest near-term benefit (native QA + no more future-flag pragma). |
| P2-7 | ~10 safe patch/minor bumps available: `@radix-ui/*` (×4), `autoprefixer`, `framer-motion` 12.35→12.38, `postcss`, `tailwind-merge` 2.6.0→2.6.1, `typescript-eslint` 8.38→8.59, `zustand` 5.0.11→5.0.12, `eslint-plugin-react-refresh` 0.4.20→0.4.26, `@types/node` 22.16→22.19. | `package.json` | **S** | Bundle into one PR, run preflight, ship. Zero API risk. Good post-release hygiene cadence. |
| P2-8 | `console.log` diagnostic output in `contentAudit.test.ts` (12 `[Content Audit] …` lines) and `longevity.test.ts` (season-growth rows). | `src/test/contentAudit.test.ts`, `src/test/longevity.test.ts` | **S** | Gate behind a `VITEST_AUDIT=true` env so local runs can still see the numbers but CI stays quieter. |

**P2 total: 8 issues. P2-1, P2-3, P2-7, P2-8 are worth bundling into this release window; P2-2/P2-4/P2-5/P2-6 are backlog.**

---

## P3 — Nice to Have

| # | Item | File | Effort | Why it matters |
|---|------|------|:-:|---|
| P3-1 | Sourcemaps inflate `dist/` from ~9 MB to 45 MB. | `vite.config.ts` | **S** | Keep maps for Sentry upload but set `build.sourcemap: 'hidden'` so they aren't referenced in the JS. Build output stays small; Sentry still resolves stack traces via its upload step. |
| P3-2 | `orchestrationSlice.ts` refactor into helpers (see P2-5). | `src/store/slices/orchestrationSlice.ts` | **L** | Listed in CLAUDE.md's "Known Tech Debt". `/project:refactor` command targets exactly this. |
| P3-3 | ~395k LOC under `src/data/communityPack/*` is machine-generated but checked in as TS. | `src/data/communityPack/` | **M** | Moving to JSON + a single typed loader would (a) skip TS parsing on build, (b) diff more cleanly, (c) enable delta-loading alongside P2-4. |
| P3-4 | `scripts/community-pack-plan.md` describes 7 phases. What shipped was the popup opt-in + market/squad integration, not the `PackStore` / `Collection` UI surfaces. | `scripts/community-pack-plan.md` | **S** | Add a short "What shipped" footer pointing at the relevant commits (`75d0b88`…`ed6b688`) and mark the unbuilt UI phases as deferred — so the doc isn't misleading. |
| P3-5 | Zero `TODO` / `FIXME` / `HACK` markers is unusual. | repo | **S** | Confirm that known-deferred work is tracked in GitHub issues, not silently lost. Link those issue numbers from the matching triage line. |
| P3-6 | 5 `any` in production code are in native-only paths (`haptics.ts`, `purchases.ts`). | same files as P2-2 | **S** | If P2-2 turns out to be painful, just add a top-of-file comment explaining the narrow surface and why type imports weren't added. Either way, document the decision. |
| P3-7 | Prior audit suggested minor `browserslist` refresh (completed in `b72cd68`) — sanity-check there are no warnings left. | `package-lock.json` / Vite output | **S** | Fold into the P2-7 patch-bump PR. |

---

## What to tackle first

Because the tree has no P0/P1 work, pick and choose. A clean, safe pre-release sweep:

- **≤ 2 hours this sitting:** P2-3 (sponsorship test `any`), P2-7 (bundled patch bumps), P2-8 (quiet audit logs), P3-1 (hidden sourcemaps), P3-4 (archive community-pack-plan).
- **Before submitting to the store:** P2-1 (main-chunk analyzer pass — verify no accidental eager imports).
- **Next release cycle:** P2-2, P2-4, P2-5 (orchestration refactor), P2-6 (stage one major dep at a time).

No fixes applied — this is the plan only. Stop.
