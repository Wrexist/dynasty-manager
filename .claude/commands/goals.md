# Goals — Execute the Next Goal

You are executing the Dynasty Manager goal system. `GOALS.md` at the repo root is the
ranked execution list — it supersedes the open items in `ROADMAP.md`, `IDEAS.md`, and
the `AUDIT*` reports. Trust the code over any doc, and this file over other docs.

## User Request

$ARGUMENTS

## Procedure

1. **Read `GOALS.md`.** If `$ARGUMENTS` names a goal (e.g. "G3") or a quick win, work
   that. Otherwise pick the **first goal not marked done** — or, if the request is
   small-session-sized, the highest-numbered unchecked quick win.
2. **Re-verify before building.** Every goal cites file:line evidence. Confirm the
   cited code still looks like the finding describes — items ship between sessions.
   If a finding is stale, mark it in the "Corrected record" section of `GOALS.md`
   instead of re-planning it.
3. **Plan, then execute** per the project rules in `CLAUDE.md` and
   `.claude/CLAUDE.md` (short plan first for multi-file work; one logical change per
   commit; persisted-shape changes bump `CURRENT_VERSION` + migration; monetization
   invariants are inviolable).
4. **Respect the "Do NOT do" list** in `GOALS.md` — those items are declined on
   purpose. Push back if the request drifts onto one.
5. **Definition of done is the goal's own checklist.** Run `npm run preflight` before
   any push; ship via `npm run ship -- "msg"` and give the PR link.
6. **Update `GOALS.md`** when done: mark the goal/quick-win shipped with a one-line
   evidence note (file:line or PR #). Keep the file clean — no progress journaling.
