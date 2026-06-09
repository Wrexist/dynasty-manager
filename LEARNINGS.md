# LEARNINGS.md — Dynasty Manager

> **This file is maintained by Claude.** After completing any task, append
> discoveries, gotchas, and patterns learned so future sessions don't repeat
> mistakes. **Verify against code before trusting any entry here** — this file
> rotted badly once (it described a 20-club, single-file-store version of the
> game that no longer exists). If an entry disagrees with the code, fix the
> entry.

## State / Store Architecture
- `src/store/gameStore.ts` is a **37-line composition layer** — it just spreads
  15 slice creators into one Zustand store. **State mutations live in the
  slices** (`src/store/slices/*.ts`), not here. To change behavior, find the
  owning slice.
- The store uses `set()` with spread — always spread nested objects before
  modifying or you'll mutate state.
- **THE game loop is `advanceWeek()` in `src/store/slices/orchestration/weekAdvance.ts`**
  (3,094 LOC) — training, development, AI sims, injuries, income, messages,
  offers, weekly objectives, cup/continental/international scheduling.
  `orchestrationSlice.ts` (1,201 LOC) is a façade that delegates to the
  `orchestration/` submodule (weekAdvance, seasonEnd, matchActions, initGame,
  tournaments, helpers).
- `endSeason` lives in `orchestration/seasonEnd.ts` (1,651 LOC), **not** in
  `orchestrationSlice` or `gameStore`. It triggers when `week > totalWeeks`.
- `advanceWeek()` resets `matchSubsUsed`. The player's own match runs via
  `playCurrentMatch()` (`orchestration/matchActions.ts`), not inside
  `advanceWeek()`.

## League Structure (the "92-club" myth, debunked)
- The game ships **756 real clubs across 45 leagues in 37 countries**
  (`src/data/leagues/`, aggregated by `leagues/index.ts`). Real names: Premier
  League, Arsenal, Barcelona, Bayern, etc.
- **"92 clubs / 4 divisions" was never the whole game** — it's the size of the
  **England pyramid** (PL 20 + three 24-team tiers = 92). Old docs mistook
  England's 4-tier pyramid for the entire game. `stateValidator.ts` still
  refers to the "92-club England" pyramid — that reference is correct *for
  England*.
- Multi-tier pyramids: England (4), Germany (3), Spain/Italy/France (2). The
  other 32 countries are single-tier.
- **Season length is per-league** via `LeagueInfo.totalWeeks` (PL = 38).
  `TOTAL_WEEKS = 46` in `gameBalance.ts` is only a fallback. **Never assume 46.**
- **Real clubs replaced fictional ones.** The game used to have fictional
  English clubs (`div-1`…`div-4`: "Monarch Premier League", etc.).
  `saveMigration.ts` (CURRENT_VERSION = 71) explicitly migrates old saves whose
  clubs no longer exist. ⚠️ See "Open compliance flag" below.

## Type System
- TypeScript strict mode is OFF (`strict: false`, `noImplicitAny: false`,
  `strictNullChecks: false`). TS won't catch missing types — be careful.
- All game types are centralized in `src/types/game.ts` (2,083 LOC). Don't
  create type files elsewhere.
- The league type is **`LeagueInfo`**, not `DivisionInfo` (the latter is gone).
- `FormationType` is a union of **10 formations**; adding one means updating the
  type and the formation-positions map together.

## Persistence
- **IndexedDB is the authoritative save store** (3 slots + per-slot backups);
  localStorage is a best-effort mirror (WKWebView caps it at ~5 MB, which full
  saves exceed). `hydrateSaveStorage()` runs at app start.
- ALL storage access goes through `src/store/helpers/persistence.ts` — direct
  `localStorage`/`sessionStorage` is ESLint-banned. New keys register in
  `STORAGE_KEYS`.
- Save schema is **v71**. Any change to persisted state shape bumps
  `CURRENT_VERSION` and adds a migration step. Legacy `'dynasty-save'` key is
  migrated then removed.

## Monetization (revenue-critical — read invariants before touching)
- All IAP goes through RevenueCat (`src/utils/purchases.ts`). `isPro()` in
  `src/utils/monetization.ts` is the ONLY source of truth for Pro.
- **Never check subscription SKUs against `monetization.entitlements`** — only
  `PRO_ONE_TIME_PRODUCT_IDS` may be. Sub status lives in
  `subscription.expiresAt`; RevenueCat keeps expired subs in
  `allPurchasedProductIdentifiers` forever, so the wrong check grants permanent
  Pro to lapsed subscribers.
- Consumable player-pack IAPs are never stored as entitlements / never restored.
- The RevenueCat hosted paywall is banned (Apple 3.1.2(c)); all Pro flows go
  through the in-app `SubscribeOnboarding` page.
- Off-device (web/dev), purchases are mocked to succeed — real purchase paths
  only run on device.

## Common Mistakes to Avoid
- `club.lineup` and `club.subs` are **string arrays of player IDs**, not Player
  objects.
- Always `filter(Boolean)` after mapping playerIds to players — some IDs may
  reference deleted players.
- When selling a player, update: seller (playerIds/lineup/subs/wageBill/budget),
  buyer (same), player's `clubId`, AND remove from `transferMarket`.
- Match results must update BOTH the fixtures array AND individual player stats
  (goals, assists, etc.).
- **Cup-week choreography is load-bearing:** domestic Cup Final is at week 43 to
  dodge continental SF legs (41–42), continental Final (44), and League Cup
  Final (40). The player's continental knockout ties are NOT auto-simulated by
  `weekAdvance`; a same-week collision can hang the tournament. Read the comment
  block in `src/data/cup.ts` before moving a round week.

## Generated Data (never hand-edit)
- `src/data/communityPack/*` (~395K LOC), `src/data/nationalPlayerPool.ts`
  (~11K LOC) are tool-generated from FC26 data. Regenerate via the
  fc26/scrape scripts (`npm run process-fc26`, `validate-cp`). They dwarf the
  ~139K LOC of hand-written code — keep them lazily imported;
  `npm run size:check` enforces the eager-bundle budget.

## Open Compliance Flag (raised 2026-06-09 — unresolved)
- App Store docs (`docs/apple-review-response.md`, `docs/app-store-submission.md`,
  `APP_STORE_LISTING.md`) tell Apple the app has **"no real clubs, leagues,
  players, or tournaments."** The current build ships real club + league names
  and FC26-derived player data. This is a stale-doc-vs-reality conflict with
  potential trademark/IP and App-Store-review exposure. **Do not "fix" those
  compliance docs by editing the numbers** — the underlying real-vs-fictional
  decision is a licensing/legal question for the owner, not an editorial one.

## Engine / UI notes (verify before trusting magic numbers)
- `src/engine/match.ts` (1,828 LOC) — event-based, minute-by-minute, with late
  drama mechanics after minute ~85. Don't quote specific probability constants
  from memory; read the file.
- Dark-only theme, HSL CSS vars — never hardcode colors. `GlassPanel` is the
  standard container. Rating colors: ≥80 emerald, ≥70 gold/primary, ≥60 amber,
  <60 muted. Club colors are the only acceptable inline `style={{ backgroundColor }}`.
- Mobile-first: `max-w-lg mx-auto`; test at 375px. `App.tsx` is HashRouter +
  `MotionConfig` + ErrorBoundary scopes + first-launch analytics-consent gate —
  there is **no** `QueryClientProvider` (an old LEARNINGS entry claimed one).
