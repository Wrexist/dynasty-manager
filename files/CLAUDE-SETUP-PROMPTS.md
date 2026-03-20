# Dynasty Manager — Claude Setup Prompts

## How to Use This

These are copy-paste prompts to give Claude (in Cursor Composer or Claude Code) to set up your project perfectly. Run them in order.

---

## PROMPT 1: Initial Project Scan + CLAUDE.md

> Read every file in this project. Start with `src/types/game.ts`, then `src/store/gameStore.ts`, then `src/engine/match.ts`, `src/utils/playerGen.ts`, `src/data/league.ts`, then all pages and components. After reading everything, create a `CLAUDE.md` file in the project root that documents:
>
> 1. Project overview (what it is, what stage it's at)
> 2. Full tech stack with exact versions from package.json
> 3. Architecture map showing every directory and what it contains
> 4. The 5 most critical files and why
> 5. Code conventions (TypeScript, components, styling, state, imports, naming)
> 6. Design system (colors, typography, layout patterns, component patterns)
> 7. Key game patterns (game loop, match sim, player dev, transfers, season lifecycle)
> 8. All npm scripts
> 9. Known tech debt and limitations
> 10. Hard rules (things to never do)
>
> Make it specific to THIS project, not generic. Reference actual file names, actual class patterns, actual variable names.

---

## PROMPT 2: Cursor Rules (`.cursor/rules/*.mdc`)

> Create the following Cursor rule files in `.cursor/rules/`:
>
> **`core.mdc`** (alwaysApply: true) — Your identity, process, principles, and coding style for this project. Include: read before writing, plan before coding, minimal diffs, test the build. Reference the actual tech stack.
>
> **`react.mdc`** (glob: `**/*.tsx`) — React component rules: functional only, Zustand for state, Tailwind for styling, cn() for conditionals, import order, don't modify shadcn ui/, rating color system, mobile-first layout.
>
> **`game-engine.mdc`** (glob: `src/store/**, src/engine/**, src/utils/**, src/data/**`) — Game logic rules: store is the brain, types in game.ts, match engine is pure, player gen patterns, data conventions.
>
> **`styling.mdc`** (glob: `**/*.tsx, **/*.css`) — Design system: dark theme HSL variables, glass morphism, typography, rating colors, layout dimensions, spacing, animations.
>
> **`testing.mdc`** (glob: `**/*.test.*, **/*.spec.*`) — Testing: Vitest + jsdom, what to test in priority order, patterns, don'ts.
>
> Use .mdc format with YAML frontmatter (description, globs/alwaysApply). Make every rule specific to Dynasty Manager, not generic.

---

## PROMPT 3: .cursorignore

> Create a `.cursorignore` file in the project root. Exclude: node_modules, dist, dist-ssr, lock files (package-lock.json, bun.lock, bun.lockb), .git, logs, .vscode, .idea, .DS_Store, .env files, *.local files. Keep src/components/ui/ indexed but note in comments that rules say don't modify them.

---

## PROMPT 4: LEARNINGS.md (Self-Improving Knowledge Base)

> Create a `LEARNINGS.md` file in the project root. This is a knowledge base that YOU (Claude) will maintain over time. Structure it with these sections:
>
> - **Architecture Gotchas** — things about the codebase structure that are easy to forget
> - **Type System Notes** — TS quirks, type locations, strict mode implications
> - **Styling Patterns** — design system details discovered through work
> - **Common Mistakes to Avoid** — bugs you've seen or traps in the code
> - **Performance Notes** — scale considerations
> - **File-Specific Notes** — per-file discoveries (empty to start, you'll fill as you work)
>
> Pre-populate it with what you already know from reading the codebase. Add a note at the top saying "This file is maintained by Claude — update after every task."
>
> After EVERY future task, update this file with anything new you learned.

---

## PROMPT 5: README.md Replacement

> Replace the current README.md (which is the default Lovable template) with a proper project README. Include:
>
> - Project name and one-line description
> - Screenshot placeholder
> - Tech stack badges
> - Getting started (clone, npm install, npm run dev)
> - Project structure overview (brief)
> - Available scripts
> - Contributing guidelines (for AI: read CLAUDE.md first)
> - License placeholder
>
> Keep it clean and professional. This is a game, make it feel exciting.

---

## PROMPT 6: Cleanup Lovable Artifacts

> This project was scaffolded in Lovable.dev. Clean up:
>
> 1. Remove `lovable-tagger` from devDependencies and `vite.config.ts` (the `componentTagger` import and plugin)
> 2. Update `README.md` if it still references Lovable
> 3. Remove `src/pages/Index.tsx` if unused (check routes in App.tsx)
> 4. Remove `src/App.css` if unused (check imports)
> 5. Consider removing `@tanstack/react-query` if not used (check for QueryClientProvider usage — it IS used in App.tsx but with no actual queries, so flag it but don't remove yet)
> 6. Run `npm run build` to verify nothing breaks

---

## PROMPT 7: Pre-Session Context Refresh

> Use this prompt at the START of every new session:
>
> Read CLAUDE.md, LEARNINGS.md, and the .cursor/rules/ files. Then read `src/store/gameStore.ts` and `src/types/game.ts` to refresh your understanding of the current game state. Tell me what you see as the top 3 priorities for improvement.

---

## PROMPT 8: Post-Task Self-Improvement

> Use this prompt AFTER completing any significant task:
>
> Update LEARNINGS.md with anything new you discovered during this task. Include: gotchas you hit, patterns you established, file-specific notes, or mistakes you corrected. If any rules in .cursor/rules/ should be updated based on what you learned, update those too.

---

## PROMPT 9: Architecture Review

> Review the entire codebase and produce a prioritized improvement plan. Focus on:
>
> 1. **gameStore.ts splitting** — propose how to split the ~600-line store into logical slices while keeping Zustand's simplicity
> 2. **Match engine enhancement** — how to make formations and tactics actually affect match results
> 3. **Type safety** — a plan to progressively enable strict mode without breaking everything
> 4. **Test coverage** — which functions/actions need tests first (by impact)
> 5. **Performance** — any unnecessary re-renders or heavy computations
> 6. **Missing features** — gaps in the game loop that would make the biggest gameplay difference
>
> For each item, give: what to do, which files are affected, estimated complexity (S/M/L), and suggested order.

---

## BONUS: The "Remember the Rules" Prompt

> When Claude starts ignoring conventions in long sessions:
>
> Stop. Re-read CLAUDE.md, LEARNINGS.md, and all files in .cursor/rules/. You've drifted from the project conventions. Summarize the key rules back to me, then continue with the task.
