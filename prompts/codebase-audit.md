# Codebase Audit Prompt

> Copy-paste this entire prompt into a Claude Code session to perform a full codebase audit.

---

You are performing a full codebase audit of this project. Your goal is to find and fix every bug, incomplete implementation, dead code path, logic error, and quality issue.

## Phase 1: Discovery (DO NOT fix anything yet)

Scan the entire codebase systematically. For each file, check for:

### Critical (fix immediately)

- **Runtime errors**: null/undefined access, missing imports, broken references
- **Logic bugs**: wrong conditions, off-by-one errors, inverted booleans, unreachable code
- **State mutations**: direct mutation of state objects (especially in Zustand stores — must spread nested objects)
- **Data integrity**: operations that forget to update related data (e.g., removing an item from one list but not another)
- **Race conditions**: async operations that assume synchronous ordering
- **Missing error handling at system boundaries**: unhandled API failures, localStorage quota exceeded, JSON parse errors on external input

### High Priority

- **Incomplete implementations**: TODO/FIXME/HACK comments, stub functions that return hardcoded values, empty catch blocks, placeholder logic
- **Type mismatches**: function calls with wrong argument types/counts, property access on wrong types, incorrect generic usage
- **Broken UI flows**: click handlers that don't work, navigation to nonexistent routes, forms that don't submit, conditional renders that can never be true
- **Edge cases**: division by zero, empty arrays passed to reduce without initial value, negative indices, overflow in calculations

### Medium Priority

- **Dead code**: unused exports, unreachable branches, commented-out code blocks, unused variables/imports
- **Duplicated logic**: same helper/utility reimplemented in multiple files (DRY violations)
- **Performance issues**: unnecessary re-renders, missing keys in lists, expensive computations in render path without memoization, O(n²) loops on large datasets
- **Inconsistencies**: mixed patterns for the same task, naming convention violations, inconsistent parameter ordering

### Low Priority

- **Hardcoded values** that should be constants or config
- **Missing validation** on user-facing inputs
- **Accessibility gaps**: missing aria labels, non-semantic elements for interactive controls
- **Stale comments** that no longer match the code

## Phase 2: Report

Before fixing anything, output a numbered list of every issue found, grouped by severity (Critical → Low). For each issue include:

- File path and line number
- Category (from the lists above)
- One-line description of the problem
- One-line description of the fix

## Phase 3: Fix

Work through the list from Critical → Low. For each fix:

1. Read the relevant file(s) if not already read
2. Make the minimal, focused fix — do not refactor surrounding code
3. Mark the issue as resolved
4. If a fix would change behavior significantly, flag it and ask before proceeding

## Rules

- DO NOT refactor working code that has no bugs — this is a bug hunt, not a rewrite
- DO NOT add features, comments, or documentation
- DO NOT change formatting, style, or code organization unless it's hiding a bug
- DO NOT modify test files unless the test itself is buggy (wrong assertion, not a test that fails because of a real bug)
- If you find more than 30 issues, fix Critical and High first, then ask before continuing
- After all fixes, run the project's test/lint/build commands to verify nothing broke
