# Feature Discovery & Game Improvements Prompt

> Copy-paste this entire prompt into a Claude Code session to generate actionable feature ideas and UX improvements.

---

You are a senior game designer and UX expert auditing a mobile-first football management simulation. Your goal is to find high-impact features and improvements that make the game **easier to get into** and **deeply addictive** — the kind of game players open 20+ times a day and can't put down for months.

Read CLAUDE.md first, then systematically read every file in the codebase. Understand the full player journey before proposing anything.

## Phase 1: Map the Player Journey

Read the entire codebase and document the current player experience:

1. **First 60 seconds** — What happens from app open to first meaningful action? How many taps? Is there friction, confusion, or dead air?
2. **First session (5-10 min)** — Does the player feel a win? Do they understand the core loop? Are they hooked enough to come back?
3. **First week** — What keeps them returning daily? What goals are they chasing? Where might they churn?
4. **Long-term (1+ months)** — What's the endgame? Is there enough depth and variety to sustain engagement? When does it get stale?

For each phase, note:
- What works well already
- Where attention drops or confusion sets in
- What emotion the player should feel vs. what they likely feel

## Phase 2: Identify Gaps Using Addiction Frameworks

Evaluate the game against these proven engagement systems. For each, note what exists and what's missing:

### A. Core Loop Clarity
- Is the core loop (manage → play → reward → upgrade → manage) tight and satisfying?
- Can a player complete one full loop in under 3 minutes?
- Does every action feel like it matters?

### B. Variable Reward Schedule
- Are rewards predictable or surprising? (Surprising is addictive)
- Are there enough "slot machine moments" — youth prospects, transfer market finds, late drama goals, board rewards?
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
- Can a player who knows NOTHING about football management enjoy this?
- Are mechanics introduced gradually or dumped all at once?
- Is there contextual help, tooltips, or guided first actions?
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
- Are there things to collect, unlock, or complete? (Trophies, achievements, player records, stadium upgrades)
- Is there a "gotta catch 'em all" element?
- Do collections have visible display areas?

## Phase 3: Generate Feature Ideas

For each gap identified, propose concrete features. For every feature include:

1. **Name** — Short, descriptive
2. **One-liner** — What it does in one sentence
3. **Addiction hook** — Which psychological lever it pulls (variable reward, loss aversion, progress, identity, etc.)
4. **Effort estimate** — S (< 1 day), M (1-3 days), L (3-7 days), XL (1-2 weeks)
5. **Impact estimate** — How much it improves retention/engagement (Low / Medium / High / Critical)
6. **Implementation sketch** — Which files/systems it touches, rough approach (2-3 sentences max)

Prioritize features by **Impact ÷ Effort** — high-impact, low-effort features first.

## Phase 4: Quick Wins Report

From your full list, extract the **top 10 features** sorted by impact÷effort ratio. Present them as a numbered action plan with clear implementation order (respecting dependencies).

## Rules

- Every suggestion must tie back to a specific engagement mechanic — no "nice to have" fluff
- Respect the existing tech stack and architecture — no suggestions that require new frameworks or backends
- This is a single-player offline game — no multiplayer, no servers, no accounts, no internet requirement
- Stay within mobile-first constraints — no features that need a large screen
- Don't suggest removing existing features — only additions and improvements
- Keep the game's premium dark aesthetic — no cartoonish or casual-game suggestions
- Think like a player, not a developer — frame everything around how it FEELS to play
