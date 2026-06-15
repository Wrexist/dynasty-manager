# Dynasty Manager — Improvement Backlog (refreshed 2026-06-14)

> Rebuilt from two fresh parallel audits (UX/mobile/a11y + correctness/debt/perf),
> every load-bearing claim re-verified in source. Supersedes the earlier revision.
>
> **Bottom line: the codebase is in excellent shape.** 0 TODO/FIXME/HACK, 0
> `@ts-ignore`, 117 test files, 21 justified `eslint-disable`s, healthy deps, no
> shipblockers. Mobile a11y/safe-area/overflow/empty-states/confirms are handled
> systematically. What remains is a couple of small polish items and the larger
> (optional) refactor/feature work. This is NOT a debt list — it's a polish +
> roadmap list.

## Resolved since last revision (do NOT re-raise)
Pack-opening lag/stuck/jank fix (PR #561) · idle-polling pause · dead
`newLeagues.ts` deleted · a11y aria-labels · loan wage-split clamp · typecheck in
CI · `weekAdvance` CP-market-refresh extraction · flaky 11v10 test made
deterministic · ~160 new tests (loan/feature/career/match/systems/merchandise/
club/nationalTeam slices + continental/international/squadStrength utils +
monetization revenue invariants + weekAdvance contract + CP runtime) · onboarding
auto-dismiss + XP reward · Squad-vs-League panel · League/Inbox haptics.

## Verified FALSE POSITIVES from the automated pass (do NOT chase)
- **Save-migration "v66–72 gap"** — NOT real. The ladder has all 71 entries
  (v1→v72); keys are just out of source order (`saveMigration.ts`). Complete.
- **`ballonDor.ts` / `international.ts` "untested"** — both are covered across
  multiple existing test files; no real gap.
- (Earlier) transferSlice "double-charge", continental null-winner, StaffPage/
  TitleScreen "missing confirm" — all previously verified safe.

---

## 1. UX / polish (small, genuinely open)
- `[MED]` **MatchDay commentary height on landscape** — `MatchDay.tsx:1566` uses
  `max-h-[30vh]`; on a 375-tall landscape view that's ~112px (≈2 events). Use
  `max-h-[min(40vh,300px)]` (or `max-h-40 sm:max-h-[30vh]`) so a few events stay
  visible in any orientation.
- `[LOW]` **Money formatting bypasses `formatMoney`** in the detailed negotiation
  modals — `IncomingOfferNegotiation.tsx` (multiple), `LoanNegotiation.tsx:215/338/
  508`, `FacilityCard.tsx:140` use raw `£`+`.toFixed()`. Route through
  `formatMoney` (`utils/helpers.ts`) for a single source of truth. Pure hygiene.

## 2. Performance (minor)
- `[LOW]` **ScoutingPage watch list not virtualized** — renders all items via
  `.map()`. Fine under ~100 entries; apply the existing `useIncrementalReveal()`
  (already used by `TransferPage`) if it can grow large.
- `[note]` `pressConferences.ts` / `storylineChains.ts` are statically imported but
  only reachable via the lazy `/game` route chunk, so they're not in the eager
  boot graph — acceptable as-is (audit confirmed). Bundle strategy is deliberate
  and eslint-enforced for the giant data files.

## 3. Tech debt / testing (larger, each its own effort)
- **Oversized files** (current LOC): `weekAdvance.ts` **3063** (top extraction
  candidate — split match-scheduling / mentor / storyline phases), `Dashboard.tsx`
  2195, `match.ts` 2004, `seasonEnd.ts` 1732, `MatchDay.tsx` 1724, `matchActions.ts`
  1703, `PackOpeningOverlay.tsx` 1485, `saveMigration.ts` 1322, `orchestrationSlice.ts`
  1236, `TransferPage.tsx` 1082. Use the safe-extraction pattern (build the running
  safety net first, then extract verbatim, verify full suite).
- **Test coverage — real remaining gap:** page-component behavior
  (`Dashboard`/`MatchDay`/`TransferPage`) has no RTL tests (heavy scaffolding).
  `utils/purchases.ts` (RevenueCat native wrapper) is untested but low-testability
  (native, mocked off-device) — low value.
- `[verify-LOW]` `FacilitiesPage.tsx:64` exhaustive-deps disable — check whether all
  5 deps are needed or a narrower selector is cleaner.

## 4. Features (net-new value)
- **Mobile 375px landscape pass** — beyond the MatchDay item above, a deliberate
  pass at 375×667 and small-landscape would catch any remaining squeeze.
- **List search** on more surfaces (Scouting watch list search+sort).
- **Online mode** — `docs/online-mode-plan.md` (multi-slice Supabase; engine's
  unseeded `Math.random` forces server-authoritative sim). Big.
- **Declined:** Save export/import (needs `@capacitor/filesystem`+`share`).

## 5. Dependencies (healthy — no action needed now)
All majors current and stable (React 18.3, Vite 7, TS 5.9, Zustand 5, Vitest 3,
Capacitor 8, Sentry 10). Future, non-urgent major migrations to plan post-release:
**React 19, Capacitor 9, recharts 3**. Routine patch/minor bumps anytime.

---

### Suggested order of attack
1. **MatchDay landscape height** + **money-formatting hygiene** (S, quick polish).
2. **Continue `weekAdvance.ts` extraction** (next block, guarded by a safety-net test first).
3. **A deliberate 375px mobile pass** (needs a render-capable session).
4. **Page-component tests** or **Online mode** — the two big directions.
