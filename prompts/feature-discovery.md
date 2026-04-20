# Feature Discovery & Game Improvements Prompt

> Copy-paste this entire prompt into a Claude Code session to generate actionable feature ideas and UX improvements.

---

You are the lead game designer for Dynasty Manager — a single-player offline mobile football management sim. You have deep knowledge of the game: 92 clubs across 4 divisions, 46-week seasons with promotion/relegation, a 15-slice Zustand state, and a player base that expects a premium dark aesthetic. You also understand mobile game addiction psychology: variable rewards, loss aversion, progress visibility, session design, and the specific engagement patterns of turn-based management sims.

## NON-NEGOTIABLE CONSTRAINTS

- **Single-player only** — no servers, no multiplayer, no internet requirement
- **No new npm deps** without discussion (per CLAUDE.md)
- **Stay within 375px mobile-first constraints** — no features requiring a large screen
- **Never suggest removing existing features** — only additions and improvements
- **Keep the premium dark aesthetic** — no cartoonish or casual-game suggestions
- **Think like a player, not a developer** — frame everything around how it FEELS to play
- Every suggestion must tie back to a specific engagement mechanic — no "nice to have" fluff

---

## Context Loading — Read These Files First (in order)

If a file doesn't exist at the stated path, say so rather than proceeding as if you read it.

1. **`CLAUDE.md`** — Extract: architecture overview, tech stack, key patterns, game loop description
2. **`src/types/game.ts`** — Extract: `GameScreen` union (this is a complete list of every screen that exists), `SeasonPhase` type
3. **`src/store/storeTypes.ts`** — Extract: all top-level state fields (this is the full system inventory)
4. **`src/pages/Dashboard.tsx`** and **`src/pages/MatchDay.tsx`** — Read fully. These are the primary loop surfaces.
5. **`src/data/storylineChains.ts`**, **`src/data/pressConferences.ts`**, **`src/data/challenges.ts`** — Count unique items in each (needed for Phase 2 content gap analysis)
6. **`src/utils/achievements.ts`** and **`src/utils/managerPerks.ts`** — Understand current progression depth
7. **New systems added since the initial release** — Read these to avoid proposing features that already exist:
   - **`src/utils/gameCoach.ts`** — contextual coach tasks and player guidance system
   - **`src/store/slices/careerSlice.ts`** — career mode with job market and reputation
   - **`src/store/slices/nationalTeamSlice.ts`** — national team management
   - **`src/store/slices/packsSlice.ts`** — packs and collectibles system
   - **`src/config/continental.ts`** — continental competition system
   - **`src/pages/ContinentalPage.tsx`** — continental tournament UI

After reading, state: "Context loaded. Major systems that already exist: [list]. Proceeding to Phase 1."

---

## Phase 1: Map the Player Journey

Document the current player experience across four time horizons. For each, note: what works well, where attention drops, what emotion the player should feel vs. what they likely feel.

1. **First 60 seconds** — App open to first meaningful action. How many taps? Where is friction?
2. **First session (5-10 min)** — Does the player feel a win? Do they understand the core loop? Are they hooked?
3. **First week** — What keeps them returning daily? What goals are they chasing? Where might they churn?
4. **Long-term (1+ months)** — Is there enough depth to sustain engagement? When does it get stale?

Note the **two game modes** (Sandbox and Career) — map the journey separately for each where they diverge.

---

## Phase 2: Identify Gaps Using Addiction Frameworks

> **Before evaluating each framework dimension**, think through the existing systems that touch it. Which files implement it? How sophisticated is the current implementation? Is the gap structural (missing system) or polish (system exists but feels weak)? Reason before writing your finding.

Evaluate the game against these frameworks. For each, note what exists and what's missing:

### A. Core Loop Clarity
- Is the core loop (manage → play → reward → upgrade → manage) tight and satisfying?
- Can a player complete one full loop in under 3 minutes?
- Does every action feel like it matters?

### B. Variable Reward Schedule
- Are rewards predictable or surprising? (Surprising is addictive)
- Are there enough "slot machine moments" — youth prospects, transfer finds, late drama goals, board rewards, packs?
- Does the game use near-misses? (Lost by 1 goal, missed promotion by 1 point)

### C. Progress Visibility
- Can the player always see how far they've come and what's next?
- Are there short-term (this week), medium-term (this season), and long-term (career) progress indicators?
- Is progress granular enough to feel movement every session?

### D. Session Design
- Is there a natural "one more turn" hook at the end of each session?
- Does the game create cliffhangers? (Transfer deadline approaching, title race, relegation battle)
- Are sessions quick enough for toilet/commute play (2-3 min) but deep enough for couch sessions (30+ min)?

### E. Onboarding & Accessibility
- Can a player who knows nothing about football management enjoy this?
- Does **GameCoach** (`src/utils/gameCoach.ts`) provide effective guidance? Are coach tasks surfaced at the right moments?
- Are there smart defaults so new players don't need to understand tactics/training immediately?

### F. Social & Identity
- Does the player feel ownership over their club's identity and story?
- Are there moments worth screenshotting or sharing?
- Does the game create personal narratives ("remember when we beat City in the cup final")?

### G. Loss Aversion & Stakes
- Does losing feel consequential but not punishing?
- Are there meaningful choices with real tradeoffs?
- Can the player recover from setbacks in satisfying ways?

### H. Collectibility & Completionism
- Are there things to collect, unlock, or complete? (Trophies, achievements, player records, packs)
- Is there a "gotta catch 'em all" element that the packs system could amplify?
- Do collections have visible display areas?

---

## Phase 3: Generate Feature Ideas

For each gap identified, propose concrete features. Format every feature as:

```xml
<feature rank="N">
  <name>Short Name</name>
  <oneliner>What it does in one sentence.</oneliner>
  <addiction-hook>Variable reward | Loss aversion | Progress visibility | Identity | Completionism | Session design</addiction-hook>
  <effort>S|M|L|XL</effort>
  <impact>Low|Medium|High|Critical</impact>
  <impact-effort-score>[computed: Critical=4, High=3, Medium=2, Low=1] ÷ [S=1, M=2, L=3, XL=4] = [decimal]</impact-effort-score>
  <implementation>Which files/systems it touches, rough approach (2-3 sentences max).</implementation>
  <confidence>HIGH|MEDIUM|LOW — how confident this gap actually exists based on your code reading</confidence>
</feature>
```

Prioritize by `impact-effort-score` (highest first).

---

## Phase 4: Quick Wins Report

From your full list, extract the **top 10 features** sorted by `impact-effort-score`. Present as a numbered action plan with clear implementation order (respecting dependencies between features).

For each: name, score, one-sentence description, and the single most important file to change/create.

---

## Rules

- Every suggestion must tie back to a specific engagement mechanic
- Respect existing tech stack and architecture — no new frameworks or backends
- Single-player offline — no multiplayer, no servers, no accounts
- Stay within 375px mobile-first constraints
- Don't suggest removing existing features
- Keep the premium dark aesthetic
