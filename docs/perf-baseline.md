# Runtime Perf Baseline

**Generated:** 2026-09-25 (supersedes the 2026-04-22 baseline)
**Branch:** `wp/world`
**Harness:** `src/test/perf.test.ts` — gated behind `PERF_AUDIT=1`, writes
machine-readable numbers to `docs/perf-baseline.json`.

The April baseline measured a world of 92 clubs / ~2.3k players over a
46-iteration loop. Since then the living world instantiates the four strongest
foreign top tiers (168 clubs; 3.8k players in season 1, 5.3k by season 2), and
the harness had two problems of its own: it looped 46 times against a 38-week
season (8 empty post-season ticks pulled the mean down) and it was unseeded.
It now runs **two seeded seasons** of Manchester City, times `advanceWeek` on
its own as well as the user-facing tick, and times `endSeason`.

---

## Targets and current numbers

Season 2 is the steady state (continental football running, ~5.3k players).

| Path | Target | Season 1 mean | Season 2 mean | Season 2 p95 | Verdict |
|---|---:|---:|---:|---:|:---:|
| Match sim (`simulateMatch`, standalone) | **< 50 ms** | 2.09 ms | — | 3.59 ms | ✅ |
| Weekly tick (`playCurrentMatch` + `advanceWeek`) | **< 500 ms** | 258 ms | 288 ms | 446 ms | ✅ |
| `advanceWeek` alone | — | 231 ms | 265 ms | 398 ms | — |
| Season rollover (`endSeason`) | **< 1000 ms** | 193 ms | 200 ms | — | ✅ |
| Initial game load (`resetGame + initGame`) | **< 3000 ms** | 151 ms | — | 221 ms | ✅ |

World size: 168 clubs; 3,786 players at the end of season 1, 5,327 at the end
of season 2. Autosave is off in the harness (the save is its own path — see
the 2026-09-25 audit, #14).

## Before / after (audit 2026-09-25, S5 / S9 / S10)

Same seeded harness, same machine, medians of three interleaved runs of each
build. The container is shared with a concurrent CPU-heavy job, so single runs
move by up to ±10%; interleaving the builds is what keeps the comparison fair.

| Build | `advanceWeek` S1 / S2 | Tick S1 / S2 | `endSeason` S1 / S2 |
|---|---:|---:|---:|
| `b8afb76` (before this work) | 225 / 270 ms | 256 / 298 ms | 567 / 512 ms |
| + S5 unemployed competitions, S9 every division completes its season | 245 / 285 ms | 278 / 311 ms | 519 / 445 ms |
| + S10 hot-path work | 239 / 263 ms | 268 / 288 ms | 180 / 177 ms |

- **S9 adds real work.** Before it, the Championship, League One and League
  Two left 288 fixtures a season unplayed and `endSeason` invented their
  scorelines. They are now simulated during the season (midweek double
  rounds): ~7.6 extra engine matches a week on average, +5–9% on the tick.
  It is also why `endSeason` got a little cheaper in the second row — no
  backlog left to resolve.
- **S10** takes 3–8% back off `advanceWeek` (row 2 → row 3) and cuts
  `endSeason` by **~65%**. Net against the original build: season 1 ticks ~5%
  slower, season 2 ~3% faster — while simulating 288 more matches a season.
- **Every S10 change is outcome-identical.** A two-season fixed-seed run
  (seeded `Math.random` and `crypto.randomUUID`) produced a byte-identical
  fingerprint — every table, Cup, League Cup and continental result, and every
  player's name, club, overall, potential, fitness, form, wage and career
  totals — before and after. `src/test/worldTickPerf.test.ts` pins each change
  against a verbatim copy of the code it replaced.

### What S10 changed

| Change | Where | Effect |
|---|---|---|
| The real-player picker reads position buckets (built once per pool, in pool order) instead of filtering the whole ~16k-template pool up to five times per generated player; the per-nation pool is memoised; the rating-band test runs before the claim-key test | `utils/realPlayerPicker.ts` | This was most of `endSeason` — the regen fill generates hundreds of players. `endSeason` 450–570 → ~180 ms |
| `selectBestLineup` ranks the squad once (stable sort) instead of filter+sorting it per formation slot, again for fillers and again for the bench — 13 sorts per call | `utils/playerGen.ts` | AI XI pick is now ~0.12 ms per fixture (both sides); it was ~7% of `advanceWeek` in the season-1 profile |
| Chemistry adjacency is a symmetric map lookup instead of a scan of the 23-entry `ADJACENT_PAIRS` list for each of an XI's 55 slot pairs | `utils/chemistry.ts` | The engine asks for chemistry on every strength recompute of every fixture |
| The AI week shares ONE working copy of the player map instead of each of up to five stages spreading the ~5.3k-entry record again (~2 ms per copy on desktop Node, plus GC) | `utils/aiSimulation.ts` | `processAIWeekly` |

## Where the tick goes now

Section timers and a CPU profile over the seeded run (per season-1 week):

1. **The match engine — about two thirds of `advanceWeek`.** The seven other
   loaded divisions play ~80 AI fixtures a week (3,028 in season 1) at
   ~1.9–2.1 ms each: ~150–165 ms a week, before cups and continental
   football. The game loop's own overhead per fixture is small: XI pick
   0.12 ms, post-match bookkeeping (`applyAIMatchEvents`, Elo, detail strip)
   0.19 ms.
2. AI world upkeep and development (`tickWorldPlayers`): ~9 ms.
3. AI transfers / renewals / loans / free agents (`processAIWeekly`): ~11 ms.
4. Everything else in `advanceWeek` (training, finance, board, storylines,
   offers, tables, messages): ~25 ms combined.

Inside the engine, `computeStrengths` is ~20% of engine time, most of it
formation fit (`getFormationFitBonus`) and chemistry — both recomputed from
scratch on every recompute (kickoff, every substitution, injury, red card and
tactical change), even for the side whose XI did not change. **That is the
largest remaining lever, and it lives in `engine/*`**, which is out of scope
for this package (the engine is being recalibrated separately for S6).
Caching each side's formation fit and chemistry until its XI changes would
leave every result identical and remove up to ~13% of `advanceWeek` (an
estimate from the profile, not a measurement).

Two other levers were considered and left alone:

- **A per-week cache of each AI club's matchday XI.** Each club is picked once
  per fixture and plays about one fixture a week, so once `selectBestLineup`
  stopped re-sorting per slot there is almost nothing left for a cache to save.
- **Replacing the `Object.values(newPlayers).filter(p => p.clubId ===
  playerClubId …)` scans** in the offer/rumour code with the club's
  `playerIds` (~1.5 ms each). Some of those loops draw a random number per
  player, so a different iteration order changes outcomes; not done without
  a decision that the change is acceptable.

---

## Environment caveat (read before celebrating)

Captured on Node **v22.22.2** (desktop x64 V8, JIT-warm) under `jsdom`, in a
containerized Linux shared with another CPU-heavy job.

**Mid-range phones are typically 2–5× slower** (WKWebView runs JavaScriptCore,
thermal throttling on sustained work, slower memory → more visible GC, plus
real React reconciliation and paint, which jsdom does not do). Rule of thumb:
×3 on the mean, ×4 on p95.

| Path | Dev (season 2) | Projected mid-range phone | Meets target? |
|---|---:|---:|:---:|
| Weekly tick | 288 ms mean / 446 ms p95 | ~860 ms / ~1.8 s | ❌ projected over the 500 ms target |
| `endSeason` | 200 ms | ~600 ms | ✅ |
| Initial load | 151 ms | ~450 ms (pure JS) + network fetch | ✅ |

The weekly tick is the number to watch. With the living world it is
engine-bound, and on a phone a tap on "Advance" plausibly takes close to a
second. This is a projection, not a device measurement — profile a real build
with Safari Web Inspector before deciding whether the engine-side caching
above is needed for release.

---

## How to reproduce

```bash
PERF_AUDIT=1 npx vitest run src/test/perf.test.ts
# writes docs/perf-baseline.json (two seeded seasons, ~1 min)
```

The perf test is skipped unless `PERF_AUDIT=1` (`describe.skipIf(!RUN)`) and
listed in `SLOW_SUITES`, so regular CI and dev runs don't pay for it. Commit
any meaningful delta in `docs/perf-baseline.json` with the code change.

## Known limitations

- **jsdom ≠ real WebView.** No paint, no layout, no network.
- **Node V8 ≠ phone JavaScriptCore.** Desktop JIT is faster on hot loops.
- **One club, one country.** An English save loads the most clubs (four
  divisions + four foreign top tiers). A short league's save carries the same
  foreign top tiers but fits their seasons into fewer weeks (an 18-week league
  plays the Premier League's 38 rounds as double and triple rounds), so its
  weeks are denser than an English save's.
- **Save cost is excluded** (audit 2026-09-25, #14).
