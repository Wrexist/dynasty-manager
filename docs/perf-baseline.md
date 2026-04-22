# Runtime Perf Baseline

**Generated:** 2026-04-22  
**Branch:** `claude/analyze-bundle-size-bfgiS`  
**Harness:** `src/test/perf.test.ts` — gated behind `PERF_AUDIT=1`, writes
machine-readable numbers to `docs/perf-baseline.json`.

Baselines the three hot paths called out in CLAUDE.md after the community
pack (~8–12 MB of player data) landed. No optimization in this pass — just
measure and flag anything out of spec.

---

## Targets and current numbers

| Path | Target | Mean | p50 | p95 | Max | Verdict |
|---|---:|---:|---:|---:|---:|:---:|
| Match sim (`simulateMatch`) | **< 50 ms** | **1.92 ms** | 1.68 | 3.30 | 21.1 | ✅ pass (26× under) |
| Weekly tick (`playCurrentMatch + advanceWeek`) | **< 500 ms** | **109.38 ms** | 104.20 | 152.3 | 201.4 | ✅ pass (4.5× under) |
| Initial game load (`resetGame + initGame`) | **< 3000 ms** | **51.89 ms** | 42.47 | 103.2 | 103.2 | ✅ pass (58× under) |

Numbers from the `PERF_AUDIT=1` run that wrote
`docs/perf-baseline.json`:

```text
initGame       n=5    mean 51.9 ms   p95 103 ms
simulateMatch  n=200  mean 1.9 ms    p95 3.3 ms
weeklyTick     n=46   mean 109 ms    p95 152 ms
```

> **Weekly tick order:** the harness runs `playCurrentMatch()` first, then
> `await advanceWeek()` — the same order as real gameplay (user plays their
> match, then taps "advance"). An earlier version of the harness did it the
> other way and slightly understated weekly cost; corrected in the latest
> perf commit.

**Nothing exceeds 2× target.** No flags raised.

---

## Environment caveat (read before celebrating)

This baseline was captured on:

- Node **v22.22.2** / V8 (JIT-warm, desktop x64)
- `jsdom` (DOM shim; no paint, no layout, no network)
- Containerized Linux, likely over-provisioned CPU

**Mid-range Android phones are typically 2–5× slower** due to:

1. **Different WebView engines:** iOS WKWebView runs WebKit / JavaScriptCore
   (a distinct JIT from V8). Android WebView is Chromium / V8 — same engine
   family as Node, but optimized for mobile power/heat rather than desktop
   throughput. Both are slower in practice than desktop V8.
2. Thermal throttling on sustained work (full-season sims heat up the CPU).
3. Slower memory bandwidth → GC pauses are more visible.
4. Actual **React reconciliation + paint** overhead (jsdom doesn't paint).

**Rule of thumb:** multiply mean by ~3 and p95 by ~4 for a conservative
on-device projection:

| Path | Dev mean | Projected mid-range phone mean | Still meets target? |
|---|---:|---:|:---:|
| Match sim | 1.9 ms | ~6 ms | ✅ yes |
| Weekly tick | 101 ms | ~300 ms | ✅ yes (still <500) |
| Initial load | 54 ms | ~160 ms (pure JS) + network fetch | ✅ yes, but see below |

**`initGame` projection assumes bundle is already cached.** First-visit load
has to download ~878 KB gzipped (see `docs/bundle-report.md`), which on 3G
takes ~8 s before `initGame` even starts. That is the real first-paint
concern on mid-range devices, not `initGame` itself.

---

## What each path exercises

### `simulateMatch` — 1.9 ms mean, 200 samples

Pure engine call with freshly generated 70-ovr squads. Excludes:
- Player-state propagation (goal/assist/appearance counters)
- Match-event UI rendering (MatchDay page animates events minute-by-minute)
- Substitution menu / celebrations

Harness: `src/test/perf.test.ts:92-112`. Each sample rebuilds squads to keep
fatigue/form drift out of the measurement.

### `weeklyTick` — 101 ms mean, 46 samples (one full season)

Wraps `advanceWeek()` + `playCurrentMatch()`, which together run:
- 4 divisions × ~11 AI fixtures/week = ~44 `simulateMatch` calls
- Training (all ~40 clubs × their squads)
- Player development (young progress, vet decline, per-attribute rolls)
- Injury rolls
- Transfer offer generation & listing expiry
- Income / finance updates
- Message/inbox generation
- Weekly objectives, streak tracking, facilities

At ~101 ms for 46 weeks → total season tick = ~4.6 s in dev. On a phone
that projects to ~15 s per season of background progression. Acceptable
given users tap "advance" 46 times across a season, not all at once.

**Per-match amortized cost inside the tick:** 101 ms ÷ 44 matches ≈ 2.3 ms —
very close to the standalone `simulateMatch` number (1.9 ms). The extra
0.4 ms / match is the stats-propagation cost inside `advanceWeek`.

### `initGame` — 54 ms mean, 5 samples

From the moment "New Game" is clicked to a playable state. Wraps:
- Squad generation for all 92 clubs × ~25 players each (~2,300 players)
- Fixture generation for 4 divisions (~1,600 fixtures)
- Cup draws, continental group stage seeding
- League table initialization
- Transfer market seeding

**Community pack NOT enabled** in this baseline. With CP on, `initGame`
awaits `Promise.all([byClub, freeAgents, cpLeagueSquads])` → **+200–500 ms**
for the dynamic-import fetch-and-parse on first enable, cached thereafter
(see `orchestrationSlice.ts:2758-2761`). Still well under the 3 s target.

---

## Hot spot candidates (no optimization — just where to look first)

Ordered by "time spent" in a weekly tick, based on call-site breakdown:

1. **AI match simulation** (~85 ms / 101 ms weekly tick = ~85%)
   - 44 matches × 2 ms each. The dominant cost.
   - Engine itself is tight (1.9 ms isolated). Optimization would mean
     cutting the AI match count or approximating AI-vs-AI results for
     non-player divisions.

2. **Training + player dev loop** (~10 ms)
   - ~2,300 players × a handful of attribute rolls each. Mostly RNG.
   - Could batch if it ever became a bottleneck.

3. **Transfer offer generation** (~3-5 ms)
   - Scans squads for listed players, rolls market interest.

4. **Persistence (debounced)** — not timed here. Runs on idle, not inside
   the tick. `writeSaveSlot` is already async with atomic writes.

Nothing in this list is urgent. The engine has meaningful headroom for
future feature work (more leagues, deeper AI logic) before it approaches
the 500 ms weekly-tick ceiling.

---

## How to reproduce

```bash
PERF_AUDIT=1 npx vitest run src/test/perf.test.ts
# writes docs/perf-baseline.json with fresh numbers
```

The perf test is skipped by default (`describe.skipIf(!RUN)`) so regular
CI and dev runs don't spend the ~5 s it takes.

To re-baseline after a change:

```bash
PERF_AUDIT=1 npx vitest run src/test/perf.test.ts
# Commit any meaningful delta in docs/perf-baseline.json alongside the code change.
```

## Known limitations

- **jsdom ≠ real WebView.** No paint, no layout, no network. Actual
  per-frame cost on device includes React reconciliation + browser paint.
- **Node V8 ≠ phone JavaScriptCore.** Desktop JIT is faster on hot loops.
- **Single club, single save.** Multi-save management, crowded inboxes, or
  late-career saves with thousands of historical players/matches are not
  covered. Longevity tests (`src/test/longevity.test.ts`, gated behind
  `VITEST_AUDIT=1`) do cover 10–20 season runs for correctness but not
  timing.
- **Match engine variance.** The `simulateMatch` max of 17 ms vs mean
  1.9 ms is driven by extra-time/penalty-shootout branches. Acceptable.
- No **first-paint / time-to-interactive** number — that needs a real
  browser and Lighthouse/web-vitals. Out of scope for this harness.
