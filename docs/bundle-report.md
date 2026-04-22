# Bundle Report — Post Community Pack

**Generated:** 2026-04-22  
**Branch:** `claude/analyze-bundle-size-bfgiS`  
**Build command:** `ANALYZE=true npm run build` (writes `stats.html` via `rollup-plugin-visualizer`)  
**Vite:** 7.3.2, target `es2020`, `sourcemap: 'hidden'`, SWC React plugin.

This report baselines bundle size after the community-pack (~8–12 MB of
player/squad data) was added. Goal: confirm the extra data does **not** ship
in the eager initial payload — it must only load when a user opts in to the
community pack. No optimization work is done here — analysis only.

---

## Total bundle size

| Slice | Raw | Gzipped |
|---|---|---|
| **All JS chunks (93 files)** | **8.76 MB** | ~2.57 MB |
| CSS (`index-Z7x1uxcd.css`) | 155.63 KB | 21.36 KB |
| **`dist/assets/` total (excl. source maps)** | **8.97 MB** | — |
| Source maps (`.map`, hidden from users, uploaded to Sentry) | 25.39 MB | — |

### Initial page load (what users actually download on first visit)

Per `dist/index.html`, the eagerly preloaded chunks (`<script type="module">`
+ `<link rel="modulepreload">`) are:

| Chunk | Raw | Gzip | Notes |
|---|---|---|---|
| `index-*.js` (main entry) | 1031.94 KB | 288.29 KB | Store, routes, shared UI |
| `squad-data-*.js` | 1876.97 KB | 360.15 KB | 39 base-league squad files (England, Germany, Italy, …) |
| `national-pool-*.js` | 456.59 KB | 82.34 KB | `nationalPlayerPool.ts` |
| `recharts-*.js` | 413.90 KB | 111.08 KB | Charting lib |
| `radix-*.js` | 217.18 KB | 71.16 KB | Radix primitives |
| `framer-motion-*.js` | 133.47 KB | 44.09 KB | Animation lib |
| `lucide-*.js` | 37.24 KB | 12.04 KB | Icons |
| `router-*.js` | 20.25 KB | 7.69 KB | React Router |
| `sentry-*.js` | 18.94 KB | 6.54 KB | Error tracking |
| `capacitor-*.js` | 12.87 KB | 4.86 KB | Native bridge |
| `zustand-*.js` | 1.48 KB | 0.73 KB | State |
| CSS `index-*.css` | 155.63 KB | 21.36 KB | Tailwind output |
| **Eager total** | **~4.28 MB** | **~987 KB** | Over-the-wire before first paint |

### Lazy (route-split / dynamic-imported) chunks

Route chunks for `/dashboard`, `/match-day`, `/transfers`, etc. (see top-20
below) plus the community-pack chunks load on demand.

---

## Community Pack chunks — confirmed code-split ✅

All three community-pack-only data chunks are **dynamically imported** from
`src/store/slices/orchestrationSlice.ts` (line 2759–2761 and 5339) via
`await import('@/data/communityPack/...')`, guarded by the
`communityPackEnabled` flag. They are **NOT** in `index.html`'s preload list
and therefore **never loaded on initial visit**.

| Chunk | Raw | Gzip | Source |
|---|---|---|---|
| `freeAgents-*.js` | 1875.44 KB | 311.53 KB | `src/data/communityPack/freeAgents.ts` |
| `byClub-*.js` | 1152.75 KB | 207.16 KB | `src/data/communityPack/byClub.ts` |
| `cpLeagueSquads-*.js` | 574.23 KB | 97.72 KB | `src/data/squads/{arg,aus,bra,ind,kor,mls,sau}.ts` bundled via `cpLeagueSquads.ts` |
| **CP total (lazy)** | **~3.52 MB** | **~602 KB** | Only fetched when user opts in |

**Verified code-split via three signals:**

1. **`vite.config.ts` manualChunks** (lines 98–102): routes all CP squad files
   to the `cpLeagueSquads` chunk and the rest of `src/data/squads/` to
   `squad-data` (eager, for the 85 non-CP teams).
2. **Dynamic `await import()`** in `orchestrationSlice.ts:2759-2761, 5339` —
   executed only when `communityPackEnabled === true`.
3. **`dist/index.html` modulepreload list** does NOT include
   `byClub`/`freeAgents`/`cpLeagueSquads` — browser will not fetch them until
   the dynamic import fires.

---

## Top 20 largest modules (rendered size, rollup stats)

From `stats.html` / `rollup-plugin-visualizer`. "Rendered" is post-tree-shake,
pre-minify. "Gzip" reflects the final on-the-wire cost inside each chunk.

| # | Module | Rendered | Gzip | Chunk | Eager? |
|---|---|---|---|---|---|
| 1 | `src/data/communityPack/freeAgents.ts` | 3,327,337 | 325,077 | `freeAgents` | ❌ lazy |
| 2 | `src/data/communityPack/byClub.ts` | 2,282,362 | 222,140 | `byClub` | ❌ lazy |
| 3 | `src/data/nationalPlayerPool.ts` | 557,533 | 81,862 | `national-pool` | ✅ eager |
| 4 | `src/store/slices/orchestrationSlice.ts` | 331,478 | 67,216 | `index` | ✅ eager |
| 5 | `src/data/squads/arg.ts` | 181,141 | 24,136 | `cpLeagueSquads` | ❌ lazy |
| 6 | `src/data/squads/mls.ts` | 155,015 | 23,298 | `cpLeagueSquads` | ❌ lazy |
| 7 | `react-dom/cjs/react-dom.production.min.js` | 133,838 | 42,655 | `index` | ✅ eager |
| 8 | `src/data/squads/england2.ts` | 128,933 | 20,697 | `squad-data` | ✅ eager |
| 9 | `src/pages/Dashboard.tsx` | 120,623 | 18,752 | `Dashboard` | ❌ route-split |
| 10 | `src/data/squads/england3.ts` | 115,266 | 17,948 | `squad-data` | ✅ eager |
| 11 | `src/data/squads/england.ts` | 113,834 | 19,134 | `squad-data` | ✅ eager |
| 12 | `src/data/squads/sau.ts` | 103,496 | 15,005 | `cpLeagueSquads` | ❌ lazy |
| 13 | `src/data/squads/england4.ts` | 103,241 | 15,664 | `squad-data` | ✅ eager |
| 14 | `src/data/squads/italy.ts` | 102,771 | 17,538 | `squad-data` | ✅ eager |
| 15 | `src/data/squads/spain.ts` | 101,391 | 16,488 | `squad-data` | ✅ eager |
| 16 | `src/data/squads/germany2.ts` | 95,502 | 15,694 | `squad-data` | ✅ eager |
| 17 | `src/data/squads/spain2.ts` | 93,780 | 14,510 | `squad-data` | ✅ eager |
| 18 | `src/data/squads/germany.ts` | 92,980 | 15,721 | `squad-data` | ✅ eager |
| 19 | `src/data/squads/germany3.ts` | 92,340 | 14,858 | `squad-data` | ✅ eager |
| 20 | `src/engine/match.ts` | 92,028 | 20,489 | `index` | ✅ eager |

---

## Top 20 largest chunks (output files)

| # | Chunk | Raw | Gzip | Load |
|---|---|---|---|---|
| 1 | `squad-data-*.js` | 1876.97 KB | 360.15 KB | eager |
| 2 | `freeAgents-*.js` | 1875.44 KB | 311.53 KB | **lazy (CP)** |
| 3 | `byClub-*.js` | 1152.75 KB | 207.16 KB | **lazy (CP)** |
| 4 | `index-*.js` | 1031.94 KB | 288.29 KB | eager |
| 5 | `cpLeagueSquads-*.js` | 574.23 KB | 97.72 KB | **lazy (CP)** |
| 6 | `national-pool-*.js` | 456.59 KB | 82.34 KB | eager |
| 7 | `recharts-*.js` | 413.90 KB | 111.08 KB | eager |
| 8 | `radix-*.js` | 217.18 KB | 71.16 KB | eager |
| 9 | `framer-motion-*.js` | 133.47 KB | 44.09 KB | eager |
| 10 | `Dashboard-*.js` | 117.60 KB | 27.02 KB | route-split |
| 11 | `MatchDay-*.js` | 87.43 KB | 23.08 KB | route-split |
| 12 | `PlayerDetail-*.js` | 63.26 KB | 14.39 KB | route-split |
| 13 | `TransferPage-*.js` | 55.98 KB | 12.60 KB | route-split |
| 14 | `GameShell-*.js` | 52.00 KB | 14.73 KB | route-split |
| 15 | `PacksPage-*.js` | 41.35 KB | 11.14 KB | route-split |
| 16 | `lucide-*.js` | 37.24 KB | 12.04 KB | eager |
| 17 | `MatchReview-*.js` | 32.86 KB | 9.63 KB | route-split |
| 18 | `TrainingPage-*.js` | 28.77 KB | 7.63 KB | route-split |
| 19 | `TacticsPage-*.js` | 26.09 KB | 6.63 KB | route-split |
| 20 | `TransferNegotiation-*.js` | 24.42 KB | 6.10 KB | route-split |

Total JS chunk count: **93** files.

---

## Surprisingly large dependencies

### 1. `recharts` — 414 KB / 111 KB gzip (eager) ⚠️
Shipped on initial load even though charts only appear on a handful of screens
(Dashboard stats, SeasonSummary, Finance). Heaviest third-party dep in the
eager payload. Candidate for dynamic import or replacement with a lighter
chart lib (e.g. `visx`, hand-rolled SVG) when we optimize.

### 2. `radix-ui` bundle — 217 KB / 71 KB gzip (eager) ⚠️
Radix Dialog + Slot + Toast + Tooltip — all included because they're used on
many screens. Most of this may already be necessary, but worth auditing which
primitives we actually import vs. which are pulled in transitively.

### 3. `framer-motion` — 133 KB / 44 KB gzip (eager) ⚠️
Flagged in CLAUDE.md already ("known tech debt, ~30 KB gzipped"). Currently
44 KB gzip. Page transitions + match animations justify it, but worth noting.

### 4. `src/data/nationalPlayerPool.ts` — 557 KB / 82 KB gzip (eager) ⚠️
Lives in `node_modules`-style mega-module that is eagerly preloaded. Used for
international squads. **Not** in the community pack but still ~82 KB gzip on
first load. Consider lazy-loading this when the user navigates to
international-tournament screens.

### 5. `src/store/slices/orchestrationSlice.ts` — 331 KB / 67 KB gzip
Known tech debt (~1,970 LOC). Biggest single app file. Drives the main entry
chunk to ~288 KB gzip. `/project:refactor` is the designated tool for
extraction; not urgent for bundle size but a meaningful slice of the main
chunk.

### 6. `tailwind-merge` — 72 KB raw / 12 KB gzip (eager, inside main chunk)
Used by every `cn()` call. The bundle is ~70 KB before gzip, compressing
~6×. Acceptable given ubiquity but `clsx` alone would be 1 KB if we dropped
arbitrary-value merging.

### 7. `sonner` toast — 33 KB / 9.4 KB gzip (eager, inside main chunk)
Heavier than expected for a toast library but within reason.

### 8. `src/data/pressConferences.ts` — 66 KB / 15.5 KB gzip (eager, in main chunk)
Could likely be split — only used on the Press Conference screen flow.

### 9. `src/data/storylineChains.ts` — 41 KB / 10.6 KB gzip (eager, in main chunk)
Same pattern — could be route-split.

### 10. `src/data/communityPack/newLeagues.ts` — 2.0 MB on disk, **0 bytes in output** ⚠️ dead code
`grep` finds zero importers. The file defines `newLeagues: Record<string, NewLeague>`
but nothing consumes it. Tree-shaken out of the build, but still checked into
source control. Either wire it up or delete it.

---

## Community-pack code-splitting: bottom line

✅ **The ~8–12 MB of community-pack data does NOT ship on initial page load.**

- `byClub.ts` (2.28 MB) → `byClub-*.js` chunk, lazy
- `freeAgents.ts` (3.33 MB) → `freeAgents-*.js` chunk, lazy
- 7 CP league squad files (arg, aus, bra, ind, kor, mls, sau, total 903 KB) →
  `cpLeagueSquads-*.js` chunk, lazy
- `newLeagues.ts` (2.0 MB source) → not imported anywhere; excluded from bundle

Users who never enable the community pack pay **zero** extra bytes. Users who
do enable it pay **~602 KB gzipped** (~3.52 MB raw) once, at the time they
start a game with CP enabled — via `orchestrationSlice.ts:2759-2761`.

### Initial payload (non-CP user): ~987 KB gzipped (~4.28 MB raw)

That is the number to watch on mid-range phones. `recharts` + `squad-data` +
`national-pool` are the three biggest levers remaining **before** the main
app chunk.

---

## How to reproduce

```bash
ANALYZE=true npm run build         # writes dist/ + stats.html
ANALYZE=true ANALYZE_OPEN=true npm run build   # also opens stats.html in browser
```

`rollup-plugin-visualizer@7.0.1` is declared in `package.json` devDependencies.
Vite config (`vite.config.ts:62-68`) only enables it when `ANALYZE=true` so
normal builds aren't slowed by the size calculation.
