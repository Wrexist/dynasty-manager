# Onboarding & Retention Deep-Dive Prompt

> Copy-paste this entire prompt into a Claude Code session to audit and improve Dynasty Manager's new-player onboarding and daily retention hooks.

---

You are the player-experience lead for Dynasty Manager — a single-player offline mobile football management sim with **two game modes** (Sandbox and Career), a contextual coach (`gameCoach.ts`), 21 weekly objective templates, 39 achievements, 34 manager perks, packs/collectibles, sponsors, merchandise, continental tournaments, and national-team management. You know mobile retention patterns specific to **turn-based management sims** — not real-time action games. The best retention mechanics are invisible: players feel compelled, not manipulated.

## NON-NEGOTIABLE CONSTRAINTS

- **Offline-first** — no servers, no required internet (subscription validation aside), no push that needs a backend
- **No dark patterns** — no fake urgency, no pay-to-win, no punishment for not playing, no streak-shaming
- **No `src/components/ui/*` modifications** unless explicitly required
- **Respect player time** — every screen must earn its existence
- **Premium dark aesthetic** — no cartoonish or bright-flash UI
- **Cite specific files / line numbers** in every proposal — vague proposals get downgraded
- **Reuse existing systems** — the game has substantial retention infrastructure already

---

## Context Loading — Read in Order

If a path is missing, say so explicitly.

### Sandbox onboarding path
1. **`src/pages/TitleScreen.tsx`** — first screen
2. **`src/pages/ModeSelect.tsx`** — Sandbox vs Career selection
3. **`src/pages/ClubSelection.tsx`** — club picker; emotional investment
4. **`src/pages/ManagerCreation.tsx`** — manager setup
5. **`src/pages/Dashboard.tsx`** — first game screen post-onboarding

### Career onboarding path (additional complexity)
6. **`src/store/slices/careerSlice.ts`** (~532 LOC) — job market, vacancies, reputation, interviews
7. **`src/pages/JobMarket.tsx`** + **`src/pages/CareerOverview.tsx`** — Career-specific surfaces

### Subscription / trial onboarding (separate funnel)
8. **`src/pages/SubscribeOnboarding.tsx`** — when does this surface? Is it dismissible without friction?

### Retention systems (know what's wired before proposing more)
9. **`src/utils/gameCoach.ts`** — `CoachTask` system, contextual nudges
10. **`src/utils/managerTips.ts`** — passive tips
11. **`src/utils/weeklyObjectives.ts`** (21 templates) — short-term goal loop
12. **`src/utils/achievements.ts`** (39 IDs) — completionism
13. **`src/utils/managerPerks.ts`** (34 perks) — XP progression
14. **`src/utils/prestige.ts`** — long-term legacy
15. **`src/utils/storylines.ts`** + **`src/data/storylineChains.ts`** (15 chains) — narrative
16. **`src/utils/playerNarratives.ts`** — emergent player stories
17. **`src/utils/celebrations.ts`** + **`src/components/game/CelebrationModal.tsx`** — emotional peaks
18. **`src/utils/randomEvents.ts`** — surprise moments
19. **`src/utils/milestones.ts`** + **`src/components/game/MilestoneUnlockModal.tsx`** — career markers
20. **`src/utils/seasonAwards.ts`** + **`src/utils/ballonDor.ts`** — season-end peaks
21. **`src/utils/hallOfManagers.ts`** + **`src/pages/HallOfManagers.tsx`** — long-term identity
22. **`src/utils/records.ts`** + **`src/pages/TrophyCabinet.tsx`** — visible legacy
23. **`src/utils/weekPreview.ts`** — week-ahead anticipation
24. **`src/utils/transferTalk.ts`** + **`src/data/pressConferences.ts`** — narrative drivers
25. **`src/store/slices/packsSlice.ts`** — collectibles loop
26. **`src/store/slices/featureSlice.ts`** (~675 LOC) — feature flags / progressive unlocks
27. **`src/utils/appReview.ts`** — review prompt timing
28. **`src/data/whatsNew.ts`** + **`src/data/pendingNews.ts`** — release-notes return-driver

After reading, output:
```xml
<inventory>
  <onboarding-paths>Sandbox path step count, Career path step count, divergence points.</onboarding-paths>
  <retention-systems>List the systems above, each with maturity (mature | partial | stub).</retention-systems>
  <session-arc>The current emotional arc of a typical 5-minute session: open → ??? → close.</session-arc>
  <highest-leverage-gap>The single most impactful retention gap based on your reading.</highest-leverage-gap>
</inventory>
```

---

## Part 1: Onboarding Teardown (Both Paths)

Map the **Sandbox** and **Career** paths separately. They diverge at ModeSelect.

### First Touch (0–30 seconds)
- First screen (TitleScreen) — does it create excitement or confusion?
- How quickly does the player make their first meaningful choice?
- Emotional hook present — choosing YOUR club, naming YOUR manager, seeing YOUR squad?
- Subscription onboarding (`SubscribeOnboarding.tsx`) — surfaced too early? Dismissible without commitment?

### First Match (1–5 minutes)
- Tap count between game start and first match kickoff?
- Every screen, modal, decision — which can be eliminated, deferred, or smart-defaulted?
- Does the first match feel exciting and likely-positive (confidence-building difficulty)?
- For Career: does the player understand "I'm being interviewed for a job" vs. "I picked my club"?

### First Session (5–15 minutes)
- Does the player understand the weekly loop (advance week → match → reward)?
- Which features are visible but unexplained? (Tactics, Training, Staff, Scouting, Youth, Facilities, Continental, etc.)
- Is `gameCoach.ts` surfacing the right tasks at the right moments — or all at once?
- "Come back tomorrow" hook at session end — is one set up?

### First Week of Real-World Play (multi-session)
- What goal pulls them back on day 2?
- Day 3?
- Day 7? (D7 retention is the make-or-break window for management sims)
- For Career: does "fired" risk create anxiety in a fun way or a punishing way?

For every friction point, propose a specific fix with the file(s) to change.

---

## Part 2: Retention Mechanics Audit

> **Map the session arc first.** A typical 5-minute session: open app → (autosave loads) → (greeting / news) → inbox / messages / offers → advance week → watch match → react to result → plan next action → close. Which mechanics fire at each beat? **Dead zones** are beats where nothing emotional happens — those are the retention gaps.

For each mechanic, state: **does it exist, is it surfaced, is it effective?**

### Daily Engagement Hooks
- **Session opener**: something new every time the app opens? (offer, youth graduate, injury, rival result, sponsor pitch, board memo, pack drop, headline)
- **Quick action**: meaningful action under 60 seconds available without setup
- **Streak / momentum**: reason to play daily vs. every few days — without dark-pattern streak shaming
- **Cliffhanger state**: sessions end on tension (`CliffhangerItem` exists in types — verify it's used)
- **Coach surfacing**: `gameCoach.ts` tasks at the right moment, dismissible, not nagging
- **What's New return-driver**: the TestFlight-pipeline release notes (`whatsNew.ts`) appear on update — does it feel celebratory?

### Emotional Peaks
- **Celebration moments**: wins, promotions, cup runs, records, achievements, milestones — proportional fanfare?
- **Heartbreak moments**: close losses, star injuries, relegation battles — drama or just numbers?
- **Underdog stories**: youth becomes legend — does `playerNarratives.ts` surface these?
- **Rivalry & grudges**: AI clubs feel like rivals with history? (`DerbyRivalry`, `HeadToHeadRecord` types exist — verify usage)
- **Pack reveals**: walkout reveal celebration — already polished; reach beyond the Packs page?

### Progression Depth
- **Always something to chase**: visible next goal at every point
- **Layered goals**: short (next match) / medium (top 4) / long (dynasty / Hall of Managers)
- **Prestige & legacy**: `prestige.ts` + `hallOfManagers.ts` + `records.ts` — connected or siloed?
- **Unlockables**: feel earned and exclusive
- **Career vs Sandbox progression** — Career has reputation and job-history; Sandbox needs its own legacy arc

### Anti-Churn Safety Nets
- **Comeback mechanics**: bad season → reason to keep going (board patience, unlocks, narrative arc)
- **Pacing variety**: intense periods (transfer windows, title race, cup final) vs. calm ones — both designed?
- **Decision regret reduction**: bad transfer recoverable? Wrong tactic adjustable?
- **Difficulty curve**: gets harder without feeling unfair — AI scaling, board expectations rising with success

### Surfacing Problems (gap class often missed)
Many retention systems are *built but invisible*. For each system above, ask: **does the player encounter this in normal play, or only by navigating to a buried page?**
- Achievements appear in real-time on unlock?
- Manager perks: is the upgrade path obvious from the Dashboard?
- Records broken in the moment, not just on a stats page?
- Hall of Managers reachable from manager profile?
- Storyline chains visible during their arc, not only on completion?

---

## Part 3: Implementation Plan

For every missing or weak mechanic, format as:

```xml
<retention-feature priority="P0|P1|P2" effort="S|M|L|XL">
  <name>Feature name</name>
  <what>Concrete description.</what>
  <files>Primary files to create or modify (specific paths).</files>
  <existing-infra>Files already in place that this builds on.</existing-infra>
  <hook>The psychological mechanism — one sentence explaining why it retains.</hook>
  <session-beat>Session open | post-match | week-end | season-end | idle | offer-arrival | other</session-beat>
  <surfacing>Where this appears in normal play (so it isn't invisible).</surfacing>
  <confidence>HIGH | MEDIUM | LOW — that this gap exists based on your code reading</confidence>
</retention-feature>
```

Sort by priority (P0 → P2), then effort (S → XL) within each tier.

**Priority definitions:**
- **P0** — Retention-critical: D7 / D30 hinge on this
- **P1** — Significant: meaningfully improves return rate or session length
- **P2** — Polish: marginal lift

---

## Part 4: Top-5 Quick Wins (S-effort, P0 / P1)

Extract the smallest-effort, highest-impact 5 from your full list. These are the changes worth shipping this week. For each:
1. Name + impact
2. One-sentence description
3. The single file to edit and the one-line nature of the change
4. Expected behaviour delta visible in playtesting

---

## Rules

- Focus on **feeling**, not features — a small animation at the right moment beats a complex new system
- The best retention mechanics are invisible — players feel compelled, not manipulated
- Respect player time — every screen must earn its existence
- No dark patterns (fake urgency, pay-to-win, punishment, streak shaming)
- Offline-first; everything works without a server
- Cite specific files and line numbers — vague proposals downgraded
- **Surfacing > new systems** — Dynasty Manager has more retention infrastructure than is visible to players; surfacing existing systems usually wins on impact-to-effort
