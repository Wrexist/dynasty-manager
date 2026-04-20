# Onboarding & Retention Deep-Dive Prompt

> Copy-paste this entire prompt into a Claude Code session to audit and improve the new player experience and daily retention hooks.

---

You are the player experience lead for Dynasty Manager — a single-player offline mobile football management sim with two game modes: Sandbox (classic) and Career (job market + reputation). You are familiar with the full onboarding flow, the weekly game loop, and mobile retention patterns specific to turn-based management sims (not real-time action games). You know that the best retention mechanics are invisible — players feel compelled, not manipulated.

## NON-NEGOTIABLE CONSTRAINTS

- No internet/server requirements — everything must work offline
- No dark patterns (fake urgency, pay-to-win, punishment for not playing)
- No push notifications that require a server
- No changes to `src/components/ui/*` unless explicitly needed
- Respect player time — every screen must earn its existence
- Keep the premium dark aesthetic — no cartoonish or casual UI elements
- Reference specific files and line numbers in all proposals

---

## Context Loading — Read These First (in order)

If a file doesn't exist at the stated path, say so rather than proceeding.

**Trace the onboarding flow — two paths exist:**

**Sandbox path:**
1. **`src/pages/TitleScreen.tsx`** — First screen. What does the player see?
2. **`src/pages/ModeSelect.tsx`** — Mode selection: Sandbox vs Career. How is this explained?
3. **`src/pages/ClubSelection.tsx`** — Club picker. How many steps? How does it create emotional investment?
4. **`src/pages/ManagerCreation.tsx`** — Manager setup. What decisions are required?
5. **`src/pages/Dashboard.tsx`** — First game screen. What's immediately visible?

**Career path (additional complexity):**
6. **`src/store/slices/careerSlice.ts`** — Read the Career mode job market and reputation system. How does the Career onboarding differ from Sandbox?

**Retention systems:**
7. **`src/utils/gameCoach.ts`** — `CoachTask` system: contextual nudges surfaced on Dashboard. Read fully to understand current coverage.
8. **`src/utils/achievements.ts`** — Achievement system. How many, what triggers?
9. **`src/utils/managerPerks.ts`** — XP/perk progression. How fast does early progression feel?
10. **`src/utils/weeklyObjectives.ts`** — Weekly objectives system. How many unique templates?
11. **`src/data/storylineChains.ts`** — Narrative system. How many unique chains?

---

## Part 1: Onboarding Teardown

Map both the Sandbox path and the Career path separately. For each:

### First Touch (0-30 seconds)
- What's the first screen? Does it create excitement or confusion?
- How quickly does the player make their first meaningful choice?
- Is there an emotional hook (choose YOUR club, see YOUR squad)?

### First Match (1-5 minutes)
- How many steps/taps between starting the game and watching their first match?
- Count every screen, modal, and required decision. Which can be eliminated or deferred?
- Does the first match feel exciting? Is the outcome likely positive (building confidence)?

### First Session (5-15 minutes)
- Does the player understand the weekly loop by session end?
- Which features are visible but unexplained?
- Does **GameCoach** (`src/utils/gameCoach.ts`) provide effective early guidance? Are the right tasks surfaced in the right order?
- What's the "come back tomorrow" hook at session end?

For each friction point found, propose a specific fix with the file(s) that need changing. Map both the **Sandbox** and **Career** paths — they may have different friction points.

---

## Part 2: Retention Mechanics Audit

> **Before evaluating each mechanic**, map the session arc of a typical player: open app → inbox (new messages, offers) → advance week → watch match → react to result → plan next action → close. Which mechanics are active at each beat? This reveals where the emotional dead zones are.

For each retention mechanic below, check if it exists in the codebase. If it does, evaluate its effectiveness. If it doesn't, design it.

### Daily Engagement Hooks
- [ ] **Session opener** — Is there something new/exciting every time the player opens the app? (New offer, youth graduate, injury update, rival result)
- [ ] **Quick action** — Can a player do something meaningful in under 60 seconds?
- [ ] **Streak/momentum** — Is there a reason to play every day vs. every few days?
- [ ] **Cliffhanger state** — Does the game end sessions on tension? (Mid-transfer, pre-match, title race)
- [ ] **In-game coach** — Does `src/utils/gameCoach.ts` surface contextual `CoachTask` hints at the right moments? Are the tasks well-timed for both new players and veterans?

### Emotional Peaks
- [ ] **Celebration moments** — Are wins, promotions, cup runs, and records celebrated with enough fanfare?
- [ ] **Heartbreak moments** — Do close losses, injuries to star players, and relegation battles create drama?
- [ ] **Underdog stories** — Can a youth player become a legend? Does the game surface these narratives?
- [ ] **Rivalry and grudges** — Do AI clubs feel like rivals with history?

### Progression Depth
- [ ] **Always something to chase** — Is there a visible next goal at every point in the game?
- [ ] **Layered goals** — Short (win next match), medium (finish top 4), long (build a dynasty)?
- [ ] **Prestige/legacy** — Does career progression feel meaningful across multiple seasons?
- [ ] **Unlockables** — Are there things that feel earned and exclusive?

### Anti-Churn Safety Nets
- [ ] **Comeback mechanics** — If a player has a bad season, is there a reason to keep going?
- [ ] **Pacing variety** — Does the game have intense and calm periods (transfer window vs. mid-season)?
- [ ] **Decision regret reduction** — Can players recover from bad transfers, wrong tactics?
- [ ] **Difficulty curve** — Does the game get appropriately harder without feeling unfair?

---

## Part 3: Implementation Plan

For every missing or weak mechanic identified:

```xml
<retention-feature priority="P0|P1|P2" effort="S|M|L|XL">
  <name>Feature name</name>
  <what>Concrete description of what to build.</what>
  <files>Primary files to create or modify (specific paths)</files>
  <hook>The psychological mechanism — one sentence explaining why it retains players.</hook>
  <session-beat>When in the session this activates (e.g., session open / post-match / week-end / idle)</session-beat>
  <confidence>HIGH|MEDIUM|LOW — how confident you are this gap actually exists based on code reading</confidence>
</retention-feature>
```

Sort the final list by priority (P0 → P2), then by effort (S → XL) within each tier.

**Priority definitions:**
- **P0** — Retention-critical: the game cannot retain players without this
- **P1** — Significant impact: meaningfully improves D7/D30 retention
- **P2** — Polish: nice to have, marginal retention impact

---

## Rules

- Focus on FEELING, not features — a small animation at the right moment beats a complex system
- The best retention mechanics are invisible — players feel compelled, not manipulated
- Respect player time — every screen must earn its existence
- No dark patterns (fake urgency, pay-to-win, punishment for not playing)
- No internet/server requirements — everything must work offline
- Reference specific files and line numbers in your proposals
