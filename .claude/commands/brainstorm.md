# Brainstorm — Dynasty Manager Feature Exploration

You are brainstorming a new feature for Dynasty Manager. Explore the design space before writing code.

## User Request

$ARGUMENTS

## Process

1. **Understand the domain** — Read relevant existing files:
   - `src/store/storeTypes.ts` — Current state shape
   - `src/types/game.ts` — All types
   - Similar existing features in `src/config/`, `src/store/slices/`, `src/pages/`

2. **Explore 3+ approaches** with trade-offs:
   - Impact on game loop (`advanceWeek`/`endSeason`)
   - Save migration needed? (current version: 20)
   - Mobile-first implications (375px)
   - New npm deps? (requires discussion per CLAUDE.md)

3. **Use context7** for any framework API questions (React, Zustand, Tailwind, Capacitor)

4. **Recommend** the best approach with justification

5. **Output an execution plan** — ordered file list ready for `/project:feature`

## Rules

- Do NOT write code during brainstorming — planning only
- Think about what `/project:test` would need to cover
- Flag any new config constants needed (→ `src/config/`)

## Next Steps

- After brainstorming: `/project:feature` to scaffold, or `/execute-plan` for TDD execution
