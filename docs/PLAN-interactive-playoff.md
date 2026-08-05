# Implementation plan — play your own promotion playoff

Finding 3 from `CRITICAL-REVIEW-2026-08.md`. The playoff is now decided by real
simulated matches and its results are shown in the season summary, but the
player still does not *play* their own tie. This is the remaining half.

Written down rather than implemented because it is a feature that changes the
most load-bearing transition in the game — season rollover — and deserves to be
built deliberately, with its tests written first. Everything below is scoped
against the current code, so it can be executed without re-deriving it.

## The key decision: do NOT make season rollover pausable

The obvious approach is to pause `processSeasonEnd` mid-way, hand control to
`MatchDay`, and resume. Reject it. `endSeasonImpl` is a single synchronous pass
over 1,940 lines that mutates clubs, players, divisions, finances, awards and
fixtures together; splitting it into resumable phases means every one of those
mutations needs to be idempotent across a save/load boundary, and the existing
tests cover the whole pass rather than its parts.

Instead, run the player's playoff **before** rollover, as ordinary matches, and
hand the finished result into rollover. Season rollover stays a single
synchronous pass and its tests stay valid.

## Where it hooks in

`weekAdvance.ts:824` currently reads:

```ts
if (newWeek > (state.totalWeeks || TOTAL_WEEKS)) {
  endSeasonImpl(set, get);
  return;
}
```

That is the seam. Between the final league week and rollover there are free
weeks — `TOTAL_WEEKS` is 46 while league `totalWeeks` runs 34–42, and the cup
choreography in `src/data/cup.ts` occupies weeks 40 (League Cup final), 43 (Cup
final) and 44 (continental final). Weeks 45–46 are free in every configuration.

## Steps

1. **Detect qualification.** At the seam, build the player's final table with
   `buildLeagueTable`, then `determineProRelZones(table, league)`. If
   `playoffCandidates` contains `playerClubId`, enter the playoff instead of
   calling `endSeasonImpl`.

2. **New `seasonPhase: 'playoff'`.** `storeTypes.ts` already has a `seasonPhase`
   with an `'international'` member and `weekAdvance` already branches on it
   (`weekAdvance.ts:834`), so this follows an established pattern rather than
   inventing one.

3. **New state, persisted — bump `CURRENT_VERSION` and add a migration.**
   ```ts
   playoffState: {
     leagueId: LeagueId;
     candidates: string[];        // league-position order, from determineProRelZones
     resolved: PlayoffTieResult[]; // ties already decided, player's and AI's alike
     currentTie: { homeClubId: string; awayClubId: string; round: 'SF' | 'F' } | null;
   } | null;
   ```

4. **Drive the bracket with the existing seeding.** `simulatePlayoff` in
   `utils/promotionRelegation.ts` already takes a `PlayoffTieResolver`. Reuse it
   with a resolver that: simulates the tie normally if the player is not in it,
   and otherwise *suspends* — records `currentTie` and throws a sentinel the
   caller catches. Alternatively (cleaner) lift the bracket walk into a small
   generator so it can be stepped. Either way the seeding logic is not
   duplicated.

5. **Play the tie.** Create a `Match` and route it through the existing
   `playCurrentMatch` / `playFirstHalf` path. A level tie is won by the
   better-placed side — that rule already lives in `seasonEnd.ts`'s resolver and
   must stay in exactly one place. Extra time and penalties are optional; the
   existing `playExtraTimeImpl` / `playPenaltiesImpl` are available if wanted.

6. **Feed the outcome into rollover.** `applyPromotionRelegation` already
   accepts a resolver. Pass one that returns the pre-decided winner for any tie
   in `playoffState.resolved` and simulates the rest, so rollover cannot
   re-decide a match the player just played.

7. **Season summary already works.** `SeasonHistory.playoffRun` and the panel in
   `SeasonSummary.tsx` are in place; populate it from `playoffState.resolved` as
   `seasonEnd` already does.

## Write these tests first

- Rollover is unchanged when the player is not in a playoff (guards the 90% path).
- A player in the playoff zone enters `seasonPhase: 'playoff'` instead of ending
  the season.
- Saving and loading mid-playoff restores the bracket and the pending tie.
- Rollover honours a pre-decided player result and never re-simulates it.
- A player knocked out in the semi is not promoted; a player who wins the final
  is — and the AI clubs' promotions are unchanged in both cases.
- League size is unchanged after rollover in every branch above. `edgeCases.test.ts`
  already has the invariant to reuse.

## Risks

- **Career mode.** An unemployed or sacked manager must skip the playoff
  entirely; `weekAdvance` already guards match play on `careerManager.contract`.
- **Autosave and mid-playoff quit.** The pending tie must survive a cold start,
  which is what step 3's persisted state is for.
- **Leagues without playoffs.** 40 of 45 leagues have `playoffSpots: 0`; the
  detection in step 1 must be the only gate.
- **The 46-week ceiling.** If a league's `totalWeeks` ever reaches 45, the free
  weeks disappear. Assert this in the config guard alongside the existing
  playoff checks in `promotionPlayoff.test.ts`.
