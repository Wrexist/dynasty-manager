# Game Feel & Polish Prompt

> Copy-paste this entire prompt into a Claude Code session to find and implement micro-interactions, animations, and feedback that make Dynasty Manager feel premium and satisfying.

---

You are the animation and haptics lead for Dynasty Manager — a framer-motion 12 + Capacitor 8 mobile management sim with a dark glass-morphism UI and gold accents. Mid-range phones must hit 60fps. Only `transform` and `opacity` animate (never layout properties). The aesthetic is premium and restrained — never casual, cartoonish, or bright-flash. Polish compounds: a game that feels great to *use* becomes a game players can't put down.

## NON-NEGOTIABLE CONSTRAINTS

- **Never animate layout properties** (`top`, `left`, `width`, `height`, `margin`, `padding`) — use `transform` (`translate`, `scale`, `rotate`) and `opacity`
- **Never block input** with animations — every animation must be interruptible (use framer-motion's `layoutId` and `AnimatePresence` carefully)
- **Use what's already installed**: framer-motion (`motion`, `AnimatePresence`, `useMotionValue`, `useSpring`) and `@/utils/haptics` wrappers
- **Duration discipline**: micro-interactions 150–250ms, transitions 250–400ms, celebrations 400–800ms, walkout reveals up to 2s. Never longer.
- **Mobile-first**: 60fps on a 3-year-old phone. No heavy particle systems beyond what `PackConfetti.tsx` already does.
- **Glass-morphism preserved**: `bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl`
- **Dark premium aesthetic** — no bright flashes, no rainbow, no comic-style impact effects
- **Don't over-animate** — if everything moves, nothing stands out. Reserve motion for moments that matter.
- **Never modify `src/components/ui/*`**
- **Respect `settings.hapticsEnabled`** — `src/utils/haptics.ts` already gates on this; just call the helpers

---

## Existing Animation & Haptics Infrastructure (Read First)

If a path is missing, say so explicitly.

### Haptics API (already wired)
1. **`src/utils/haptics.ts`** — exports: `hapticLight`, `hapticMedium`, `hapticHeavy`, `hapticSuccess`, `hapticError`, `hapticWarning`. All async, all settings-gated, all safe in browser. Use these — don't import `@capacitor/haptics` directly.

### Animation conventions in use
2. **`src/components/game/CelebrationModal.tsx`** — major-achievement celebration pattern
3. **`src/components/game/AchievementUnlockModal.tsx`** + **`src/components/game/MilestoneUnlockModal.tsx`** — unlock celebrations
4. **`src/components/game/AnimatedNumber.tsx`** — count-up/down for budgets, ratings, league points
5. **`src/components/game/FloatingXP.tsx`** — XP gain feedback pattern
6. **`src/components/game/pack/PackOpeningOverlay.tsx`** + `WalkoutReveal.tsx` + `PackConfetti.tsx` + `GemRevealModal.tsx` — pack reveal pipeline (the highest-effort animation surface in the game)
7. **`src/components/game/LiquidButton.tsx`** + `LiquidGlassSlider.tsx` — premium tactile controls
8. **`src/components/game/BottomNav.tsx`** + **`src/components/game/TopBar.tsx`** — navigation animation patterns
9. **`src/components/game/SubNav.tsx`** — secondary nav patterns

### High-traffic surfaces (audit fully)
10. **`src/pages/MatchDay.tsx`** — peak emotional surface; tension build, event reveals, late drama
11. **`src/pages/Dashboard.tsx`** — every-session hub
12. **`src/pages/TransferPage.tsx`** — high-frequency taps, negotiation feel
13. **`src/pages/PacksPage.tsx`** — most polished surface; benchmark against this
14. **`src/pages/InboxPage.tsx`** — session opener; new-message reveal
15. **`src/pages/SeasonSummary.tsx`** + **`src/pages/BallonDor.tsx`** — season-end peaks

### Hooks available
16. **`src/hooks/useFlash.ts`** — flash highlight pattern
17. **`src/hooks/useSwipeGesture.ts`** — swipe handling for sheets/cards

After reading, state: **"Context loaded. Existing animation patterns: [summary]. Existing haptic call sites: [count by category]. Highest-polish surface: [page]. Lowest-polish surface: [page]. Proceeding to audit."**

---

## Audit Every Interaction (across four dimensions)

Walk every page and component. For each user-triggered interaction, evaluate:

### 1. Feedback & Response
- Every tap → immediate visual + (where appropriate) haptic feedback?
- Loading states present where work is async (pack open, save load, match sim, AI compute)?
- State changes celebrated **proportionally** to importance? (buying a youth ≠ winning a cup final)
- Destructive actions weighted appropriately? (selling a star, releasing a player, declining a contract, accepting a job offer in Career)

### 2. Transitions & Flow
- Page transitions smooth or jarring? (`AnimatePresence` mode="wait" usage consistent?)
- Spatial consistency — back gestures feel like "back"?
- Modals/sheets animate in/out, never pop? (slide-up sheets, fade overlays)
- Navigation between screens preserves context (e.g., scroll position on lists)?

### 3. Visual Rhythm
- Numbers animate when they change (use `AnimatedNumber.tsx`) — budget, rating, league points, XP, fan happiness
- List items stagger in (framer-motion `staggerChildren`) on first mount, not all-at-once?
- Empty states designed (icon + copy + suggested action) not blank?
- New items in lists (offers, messages, pack pulls) get a subtle highlight on entry?

### 4. Micro-Rewards
- Earning XP, money, fans, board confidence — tangible feedback (number jump + haptic + tile flash)?
- Color flashes on positive outcomes, subtle red dim on negative? (use existing `useFlash` hook)
- Match simulation builds tension — pacing, sound (where allowed), late-drama amplification?

### 5. Haptic Coverage (Capacitor)
- **Light**: navigation taps, selection changes, slider ticks
- **Medium**: confirm actions, accept offer, list player, place pack
- **Heavy**: game-changing actions — accept manager job, commit transfer, take penalty
- **Success**: goal scored, match won, promotion, pack walkout, achievement unlocked
- **Warning**: deadline approaching, board displeased, contract expiring
- **Error**: invalid action, transfer rejected, save failure
- Are haptics overused? (Tapping every nav item is fatigue.)

---

## Emotional Context Ranking

> **Reason about emotional context before scoring.** A haptic on a goal scored ≠ a haptic on a nav tap. The same animation lands differently depending on stakes. Classify each finding:
> - **Navigation tap** — low feel-impact ceiling
> - **Decision moment** — medium ceiling
> - **Positive outcome** — high ceiling
> - **Negative outcome** — high ceiling (loss aversion is potent)
> - **Milestone** — highest ceiling
> - **Idle state** (loading, empty, between actions) — medium ceiling, often forgotten

---

## Output: Ranked Issue List

```xml
<feel-issue rank="N">
  <interaction>Specific user action (e.g., "tap Accept on incoming transfer offer")</interaction>
  <surface>Page or component</surface>
  <current-experience>What happens now — be specific</current-experience>
  <target-experience>What it should feel like — describe sensation, duration, haptic, sound (if any)</target-experience>
  <implementation>Specific framer-motion variant, haptic call, or component change (1–3 lines pseudocode)</implementation>
  <effort>S (a few lines) | M (new variant or component) | L (system-level change)</effort>
  <feel-impact>Low | Medium | High</feel-impact>
  <emotional-context>Navigation | Decision | Positive | Negative | Milestone | Idle</emotional-context>
  <risk>Anything that could regress perf, block input, or break existing animations</risk>
</feel-issue>
```

Sort by: `feel-impact` (High → Low), then `effort` (S → L), then `emotional-context` (Milestone/Positive/Negative > Decision > Navigation/Idle).

---

## Pre-Implementation Phase Gate

Before writing a single line, state these checks explicitly:

1. ✅ Audited MatchDay, Dashboard, TransferPage, PacksPage, InboxPage (highest-traffic surfaces)
2. ✅ All top-15 candidates use only framer-motion or `@/utils/haptics` — no new libraries
3. ✅ No top-3 item touches `src/components/ui/*` (flag for discussion if any do)
4. ✅ All proposed animations use only `transform` and `opacity`
5. ✅ All haptic calls go through the `src/utils/haptics.ts` helpers (settings-gated)
6. ✅ No animation exceeds the duration budget (250 micro / 400 transition / 800 celebration / 2000 reveal)

---

## Implementation

Work the top-15 list in order. Smallest effort first within each impact tier (S → M → L). For each:

1. Read the target file (if not loaded)
2. Make the focused change — never refactor surrounding code
3. State: `"Implemented [N]: [interaction]. Change: [what was added]. Effort: [S/M/L]. Touched: [file]."`

After all implementations, smoke-test in `npm run dev` at 375px width. Report any 60fps drops (jank) or interruption issues. Run `npm run preflight` before marking done.

---

## Rules

- Animations must be performant — `transform` and `opacity` only, never layout
- Use framer-motion (already installed) and `@/utils/haptics` helpers — no new libs
- Durations: 150–250 micro / 250–400 transition / 400–800 celebration / up to 2000 reveal
- Never block input — every animation interruptible
- 60fps on mid-range phones — no heavy particle systems beyond `PackConfetti`
- Don't over-animate — restraint is the aesthetic
- Respect `settings.hapticsEnabled` (the haptics helpers already do this)
