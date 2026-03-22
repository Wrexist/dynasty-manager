# Onboarding & Retention Deep-Dive Prompt

> Copy-paste this entire prompt into a Claude Code session to audit and improve the new player experience and daily retention hooks.

---

You are a mobile game retention specialist. Your job is to make this football management sim so easy to start and so hard to stop that players become obsessed. Read CLAUDE.md first, then read the full codebase.

## Part 1: Onboarding Teardown

Trace the exact path a brand-new player takes from opening the app to completing their first season. Read every component, page, and state transition involved. Then answer:

### First Touch (0-30 seconds)
- What's the first screen? Does it create excitement or confusion?
- How quickly does the player make their first meaningful choice?
- Is there an emotional hook (choose YOUR club, see YOUR squad)?

### First Match (1-5 minutes)
- How many steps/taps between starting the game and watching their first match?
- Count every screen, modal, and required decision. Which ones can be eliminated or deferred?
- Does the first match feel exciting? Is the outcome likely positive (building confidence)?

### First Session (5-15 minutes)
- Does the player understand the weekly loop by the end of session 1?
- Which features are visible but unexplained?
- What's the "come back tomorrow" hook at session end?

For each friction point found, propose a specific fix with the file(s) that need changing.

## Part 2: Retention Mechanics Audit

For each retention mechanic below, check if it exists in the codebase. If it does, evaluate its effectiveness. If it doesn't, design it.

### Daily Engagement Hooks
- [ ] **Session opener** — Is there something new/exciting every time the player opens the app? (New offer, youth graduate, injury update, rival result)
- [ ] **Quick action** — Can a player do something meaningful in under 60 seconds?
- [ ] **Streak/momentum** — Is there a reason to play every day vs. every few days?
- [ ] **Cliffhanger state** — Does the game end sessions on tension? (Mid-transfer, pre-match, title race)

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
- [ ] **Decision regret reduction** — Can players recover from bad transfers, wrong tactics, etc.?
- [ ] **Difficulty curve** — Does the game get appropriately harder without feeling unfair?

## Part 3: Implementation Plan

For every missing or weak mechanic identified:

1. **What to build** — Concrete feature description
2. **Where it lives** — Specific files, slices, components affected
3. **How it hooks the player** — The psychological mechanism
4. **Priority** — P0 (retention critical), P1 (significant impact), P2 (polish)
5. **Effort** — S/M/L/XL

Sort the final list by priority, then by effort within each priority tier.

## Rules

- Focus on FEELING, not features — a small animation at the right moment beats a complex system
- The best retention mechanics are invisible — players feel compelled, not manipulated
- Respect player time — every screen must earn its existence
- No dark patterns (fake urgency, pay-to-win, punishment for not playing) — this is a premium feel game
- No internet/server requirements — everything must work offline
- No changes to the shadcn/ui components unless explicitly needed
- Reference specific files and line numbers in your proposals
