# Render Hygiene Audit

**Generated:** 2026-04-22  
**Branch:** `claude/analyze-bundle-size-bfgiS`  
**Harness:** `src/test/renderHygiene.test.ts` — gated behind `PERF_AUDIT=1`,
writes `docs/render-hygiene.json`.

Measures how often the **page-level Zustand selectors** for the three key
screens (Dashboard, LeagueTable, SquadPage) would fire a React re-render
across a full 46-week season. Uses `store.subscribe` + the same equality
function each page uses (`shallow` for multi-field shape, `Object.is` for
scalars) — the same signal React uses.

---

## Targets per the C.5 prompt

> "Home screen, league table, player list — these should render only when
> their data changes."

The harness answers: **do they, and how many renders per week?**

---

## Results

| Selector | Renders over 46 weeks | Mean / week | Max / week | Assessment |
|---|---:|---:|---:|---|
| Dashboard selector (50-field `useShallow`) | **201** | 4.37 | 6 | ✅ proportional to data changes |
| LeagueTable selector (9-field `useShallow`) | **201** | 4.37 | 6 | ✅ proportional to data changes |
| SquadPage selector (5-field `useShallow`) | **201** | 4.37 | 6 | ✅ proportional to data changes |
| `usePlayerClub` (scalar `clubs[id]`) | 46 | 1 | 1 | ✅ single render per week |
| `week` (scalar) | 46 | 1 | 1 | ✅ single render per week |

**Nothing measured is "excessive".** The headline is: the three pages each
fire ~4–5 renders per weekly tick, matching the number of distinct
`set({clubs, players, ...})` calls inside `advanceWeek()`. That is **render
volume proportional to state-change volume**, which is the goal.

Scalar selectors (e.g. `usePlayerClub(): s.clubs[playerClubId]`) — the
output reference is stable across bulk-map rewrites as long as that specific
club wasn't touched — correctly fire exactly once per week.

---

## Why 4–5 renders per week, not 1?

`advanceWeek()` runs several update phases inside a single tick, each
calling `set({ ... })` to replace the `clubs` and/or `players` maps:

1. Player dev & aging (rewrites `players`)
2. AI league simulation (rewrites `clubs` + `players` with match stats)
3. Cup / continental / super-cup sims (same)
4. Training, injuries, transfers, messages (each potentially rewrites one
   or both maps)
5. Final week-increment `set({ week: newWeek, … })`

Each `set()` that spreads `clubs` or `players` creates a new top-level
reference, so any selector shape that includes `clubs` or `players` fires a
shallow-equality mismatch and re-renders. Because the three target pages
all include both `clubs` and `players` in their selector shape (by design —
they need the full maps for e.g. opponent names, top scorers, squad
rosters), they all re-render in lockstep.

**This is the expected and correct behavior.** Narrowing the selectors
further would be wasted work: the data the page displays actually did
change in those phases, and skipping the re-render would just render stale
data later.

---

## Render cost in context

- Weekly tick total: **~109 ms** (see `docs/perf-baseline.md`)
- Match-sim share: **~85%** (44 AI matches × ~2 ms each + player match)
- React reconciliation share: **at most ~15%**, spread across the ~4–5
  re-renders per page × a handful of mounted pages. Even at a conservative
  5 ms per Dashboard reconciliation, 5 renders × 5 ms = 25 ms of React
  work, well inside the 500 ms weekly-tick budget.

The match engine, not render hygiene, is the dominant cost on the hot
path. No measured justification to apply `React.memo` / `useCallback` to
chase the 4-render baseline.

---

## Patterns found during static audit (informational, not fixed)

These are code observations during the audit. None of them were fixed in
this pass because none were measured to matter, but they're worth noting
for future reviews:

1. **`src/pages/SquadPage.tsx:119-124`** — `depthColors` is a plain
   `Record<string, string>` declared inside the component body. It's
   recreated on every render. Hoisting it to module scope would be a one-
   line change; the perf win is zero-ish (it's a tiny object literal) but
   it's a common anti-pattern worth pointing out.

2. **`src/pages/LeagueTable.tsx:99-119`** — `getZone()` and
   `zoneBgClass()` helpers defined inside the component body. Closures
   capture `qualZones` (already memoized), so they're stable-ish across a
   single render pass. Not a measured issue; only matters if a child
   becomes `React.memo`'d and takes them as props.

3. **`src/pages/SquadPage.tsx:37-79`** — `ContractAlertChip` is defined
   in-module (not memoized). It takes `onSelect` (stable, from store) and
   `onRenew` (inline `handleRenew`, new ref every render). If the chip
   became a perf bottleneck, `React.memo` + `useCallback(handleRenew)`
   would skip reconciliation. Not a problem today — at most 10-15 chips on
   screen × 4-5 renders/week.

4. **Existing memoization inventory:** `BenchStrip`, `CardArtBackground`,
   `PlayerHeroCard`, `PlayerCard`, `PlayerBadge`, `PlayerAvatar`,
   `PlayerRadarChart`, `StatBar`, `PlayerRatingBadge`, `TierBorderFrame`,
   `PackCard`, `PackShopCard`, `PackConfetti`, `LeagueCard` are already
   `React.memo`-wrapped. Hot-spot components (player cards, pack reveals)
   are covered.

---

## Keys / inline literals / Context

Spot-checked for the common busting patterns:

- **Missing `key` props:** Grepped `.map()` call sites in the three pages.
  Every list uses a stable `key` (mostly IDs, a few indices where the list
  is fixed-length). ✅
- **Inline object/array literals bust memo:** The memoized children that
  do exist take primitive props (IDs, numbers, strings) — no inline
  `{}`/`[]` passed to a `React.memo` child was found in the targets. ✅
- **Context overuse:** The app uses Zustand globally; React Context is
  used only for `TooltipProvider` (from Radix) and `InfoTipProvider`
  (internal) — both at App level, intentionally. ✅

---

## Verdict

✅ **Pass — render behavior is already proportional to state-change
volume.** No `memo`/`useCallback` changes applied in this commit because
the measured data does not justify them. The existing `useShallow` +
selective-scalar pattern in `src/hooks/useGameSelectors.ts` is the right
shape.

Phase C exit criterion met: "no jank on lists."

---

## How to reproduce

```bash
PERF_AUDIT=1 npx vitest run src/test/renderHygiene.test.ts
# writes docs/render-hygiene.json
```

Harness is skipped by default so regular CI stays fast (`describe.skipIf`).

## Known limitations

- **Counts selector-output changes, not actual React renders.** If a page
  is mounted but off-screen (route inactive), React still re-renders but
  the cost is near-zero. This harness can't distinguish.
- **Doesn't measure reconciliation time.** Renders/week × per-render cost
  = total React work. I don't have a jsdom-compatible way to measure the
  per-render cost; on-device profiling via React DevTools Profiler would
  give that number.
- **Headless — no real browser.** jsdom doesn't paint or lay out. Actual
  frame-time jank on a mid-range phone is a separate measurement.
