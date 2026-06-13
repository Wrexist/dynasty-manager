# Online Mode — Implementation Plan (proposal)

> Status: **planning only, no code.** This is a scoped, sequenced plan to react
> to, not a committed design. Online is currently a `comingSoon: true` stub in
> `src/pages/ModeSelect.tsx` (pitch: *"Compete head-to-head, share leagues, and
> build rivalries with friends across the globe."*).

## TL;DR recommendation

Ship Online as **three independently-valuable slices**, in this order, and stop
after any one if the value/effort stops paying off:

1. **Accounts + Cloud Save** (foundational, useful even with zero multiplayer).
2. **Async Online Leagues** (friends share one league via invite code).
3. **Head-to-Head Challenges** (async single-match duels + leaderboards).

Do **not** attempt real-time synchronous multiplayer. This is a turn-based
management game; async is the right model and an order of magnitude cheaper.

The hard blocker that dictates everything below: **the match engine is not
deterministic.** `src/engine/match.ts` calls `Math.random()` directly
throughout, so the same fixture simulated on two devices produces different
results. Any *shared* league therefore needs match resolution to happen in
**one authoritative place**. That single fact drives the sequencing.

---

## Architecture

**Backend: Supabase** (Postgres + Auth + Realtime + Edge Functions). It's already
available in this environment, gives us auth/DB/serverless in one, and Postgres
Row-Level Security maps cleanly onto "you can only write your own club."

**Auth: Sign in with Apple** (required by Apple if we offer any third-party
login; also the lowest-friction option on iOS). Anonymous → upgrade flow so a
player can back up a save before committing to an account.

**Client integration:** a thin `src/utils/online/` layer (Supabase client +
typed RPC wrappers), kept behind dynamic `import()` so it never enters the eager
bundle (`size:check` guard). All persistence still routes through the existing
`persistence.ts` helpers; cloud is a *sync target*, not a replacement for the
local IndexedDB authority.

**Server-authoritative simulation (slices 2–3):** match resolution moves to a
Supabase **Edge Function** running the *same* engine code. Two prerequisites:
- The engine must be importable in a non-DOM runtime (it already is — it's pure
  TS with no React/DOM deps; verify no `window`/`document` references leak in).
- We accept the server result as truth; clients render the returned event log.

---

## The determinism problem (read before scoping slice 2)

Options, cheapest first:

| Approach | Effort | Notes |
|---|---|---|
| **Server-side sim** (Edge Function runs the engine) | M | No engine changes; clients send lineup/tactics, server returns the canonical `Match`. Network round-trip per resolved fixture. **Recommended.** |
| **Seeded deterministic engine** | L | Replace every `Math.random()` with an injected seeded RNG, derive the seed from `(matchId, week, season)`. Clients sim locally and agree. Big, fragile refactor across `match.ts` (1.8k LOC) + helpers; every balance change risks desync. High regression risk. |
| **Trust the host** | S | One player ("commissioner") resolves the week; others accept. Cheapest, but cheatable and couples progress to the host being online. Acceptable only for friends-only private leagues. |

Recommendation: **server-side sim**. It reuses the existing engine wholesale and
sidesteps the seeded-RNG refactor entirely.

---

## Slice 1 — Accounts + Cloud Save  (effort: M)

Independently shippable; delivers backup/restore + cross-device continuity even
before any multiplayer exists. Also satisfies the foundation the later slices need.

**Scope**
- Sign in with Apple; anonymous-first with upgrade.
- "Back up to cloud" / "Restore" in Settings (complements the local 3-slot system).
- Schema: `profiles(user_id, display_name, created_at)`, `cloud_saves(user_id,
  slot, schema_version, blob, updated_at)`. RLS: a row is readable/writable only
  by its `user_id`.
- Version-stamp every blob with `CURRENT_VERSION`; run the existing
  `saveMigration.ts` chain on restore. Refuse to restore a *newer* schema than
  the client knows (forward-incompat guard).

**Risks / what could break**
- Save blobs are large (full saves exceed 5 MB; that's why localStorage is only a
  mirror). Store gzipped; consider Supabase Storage over a Postgres `bytea` if
  rows get big.
- **Apple requires in-app account deletion** once you have accounts (Guideline
  5.1.1(v)). Build the "delete account + data" path in this slice, not later.
- Privacy: a backend that stores user data updates the privacy nutrition label +
  `docs/PRIVACY_POLICY_DEPLOY.md`. Loop this in before submission.

## Slice 2 — Async Online Leagues  (effort: L)

The headline feature: friends share one league, each manages a club, weeks resolve
server-side.

**Scope**
- Create league → get invite code; others join and claim an open club.
- AI fills unclaimed clubs (reuse the existing AI-manager sim).
- Week advance: each human submits lineup/tactics for their fixture by a deadline;
  an Edge Function resolves *all* fixtures with the engine and writes results +
  standings. Realtime channel pushes the updated table to members.
- Scope down v1: **fixed-length single-division season, no transfers between human
  clubs** (or a simple async transfer-request queue) to bound complexity.

**Risks**
- Determinism (resolved by server-side sim above).
- Deadline/no-show handling: auto-pick best XI (the lineup optimiser already
  exists, `useLineupOptimizer`/`autoFillLineup`) when a human misses the window.
- Engine drift: the server engine version must match the client's, or replays
  diverge. Pin an engine version per league.
- Cost/scale: Edge Function invocations per league-week; fine at friends-scale,
  model the cost before any broad launch.

## Slice 3 — Head-to-Head Challenges  (effort: M)

Lighter, viral-friendly: async single-match duels.

**Scope**
- Pick a squad/formation, challenge a friend or a global queue; server resolves
  one match; both see the event log; result feeds a leaderboard.
- Natural tie-in to the existing rivalry system and `CinematicCapturePage`-style
  shareable moments.

**Risks**: squad fairness (cap overall, or use preset rosters) to stop pay/grind-to-win.

---

## Cross-cutting concerns

- **Monetization:** RevenueCat is already wired. Decide early whether Online is
  free (growth) or Pro-gated (revenue). Recommendation: leagues free to *join*,
  creating/hosting a league Pro-gated — drives subs without walling out friends.
  Must NOT let online status touch sim parameters (existing invariant).
- **Anti-cheat:** server authority on results is the main defence; never trust a
  client-submitted score.
- **Save coupling:** online state must survive the `saveMigration` chain. Every
  online-related shape change still bumps `CURRENT_VERSION`.
- **Bundle:** all Supabase/online code behind dynamic `import()`; verify against
  `size:check` so offline players never download the netcode.
- **Offline-first:** the game must remain fully playable with no account/network.
  Online is additive, never required.

## Suggested first commit (when greenlit)

Start with Slice 1, smallest vertical slice: Supabase project + Sign in with Apple
+ a single "Back up to cloud / Restore" button in Settings, behind a feature flag,
no league features yet. That validates auth, the large-blob round-trip, and the
migration-on-restore path — the riskiest plumbing — before building leagues on top.
