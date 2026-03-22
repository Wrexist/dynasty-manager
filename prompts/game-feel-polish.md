# Game Feel & Polish Prompt

> Copy-paste this entire prompt into a Claude Code session to find and implement micro-interactions, animations, and feedback improvements that make the game feel premium and satisfying.

---

You are a UI polish specialist for a premium mobile game. Your job is to make every tap, swipe, and transition feel satisfying. Small details compound — a game that feels great to USE becomes a game players can't stop using. Read CLAUDE.md first, then read the full codebase.

## Audit Every Interaction

Go through every page and component. For each user interaction, evaluate:

### Feedback & Response
- Does every tap have immediate visual/haptic feedback?
- Do loading states exist where needed, or does the UI feel frozen?
- Are state changes (buy player, win match, get promoted) celebrated proportionally to their importance?
- Do destructive actions (sell player, reject offer) have appropriate confirmation weight?

### Transitions & Flow
- Do page transitions feel smooth or jarring?
- Is there spatial consistency? (Does going "back" feel like going back?)
- Do modals/sheets animate in and out, or pop?
- Are there any dead frames or layout shifts during navigation?

### Visual Rhythm
- Do numbers animate when they change? (Budget, ratings, league position)
- Do lists animate items in with stagger, or do they appear all at once?
- Are empty states designed, or just blank screens?
- Do skeleton/loading states match the final layout?

### Micro-Rewards
- Does gaining XP, earning money, or improving a player feel tangible?
- Are there particle effects, color flashes, or haptic pulses for positive events?
- Do streaks and milestones have visual breakpoints?
- Does the match simulation build tension through pacing and visual intensity?

### Sound & Haptics (Capacitor)
- Are haptic patterns used for: goals scored, match won, player bought, promotion, bad news?
- Are haptics proportional? (Light tap for navigation, medium for actions, heavy for celebrations)
- Is haptic feedback implemented via Capacitor's Haptics API where available?

## Deliverables

For each issue found:

1. **What feels wrong** — Describe the current experience
2. **What it should feel like** — Describe the target experience
3. **Implementation** — Specific code changes needed (files, components, animations)
4. **Effort** — S (a few lines) / M (new component or animation) / L (system-level change)
5. **Feel impact** — How much this changes the perceived quality (Low / Medium / High)

Sort by feel impact (High → Low), then effort (S → L).

Then implement the top 15 highest-impact changes, starting with the smallest effort items.

## Rules

- Animations must be performant — use CSS transforms and opacity, never animate layout properties
- Use framer-motion (already in the project) for component animations
- Use Capacitor Haptics (already in the project) for tactile feedback
- Respect the dark premium aesthetic — glass-morphism, gold accents, no cartoonish effects
- Keep animations SHORT — 150-300ms for micro-interactions, 400-600ms for celebrations
- Never block user input with animations — everything should be interruptible
- Mobile-first: 60fps on mid-range phones, no heavy particle systems
- Don't over-animate — if everything moves, nothing stands out. Reserve animation for moments that matter
