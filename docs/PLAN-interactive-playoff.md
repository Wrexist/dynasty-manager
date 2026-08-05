# Implementation plan — play your own promotion playoff

Finding 3 from `CRITICAL-REVIEW-2026-08.md`. The playoff is now decided by real
simulated matches and its results are shown in the season summary, but the
player still does not *play* their own tie. This is the remaining half.

Built deliberately, tests first, one layer at a time. **Step 4 — the bracket
engine — is implemented and tested.** The remaining steps are the store wiring
and the UI, and are scoped against the current code so they can be executed
without re-deriving anything.

The reason for the staging: this changes the most load-bearing transition in the
game. The bracket engine is pure and fully testable, so it lands first and
carries its own regression suite. The store and UI steps cannot be verified
without actually playing the game, so they should be built by someone who can.

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

4. **Drive the bracket with the existing seeding. — DONE, `utils/promotionRelegation.ts`.**
   `stepPlayoff(candidates, resolveStep)` is the single bracket walk; a
   `resolveStep` returning `null` suspends it and yields the pending tie.
   `simulatePlayoff` is now that walk with a resolver that never suspends, so
   seeding, home advantage and bye placement exist in exactly one place.

   `resumePlayoff(candidates, resolved, pauseForClubId, simulateTie)` replays a
   bracket against results already recorded — matched on the unordered club pair,
   so replay order cannot re-decide a tie — and suspends on the first unplayed
   tie involving the player. An eliminated player stops suspending anything and
   the bracket runs to a decision.

   `PlayoffPendingTie.teamsInRound` names the round (4 = semi, 2 = final). The
   first cut of this reported "ties left in the round", which is 1 for the last
   tie of EVERY round and so could not tell a semi from a final; the tests caught
   it before anything consumed it.

   Covered by `src/test/promotionPlayoff.test.ts` (18 tests), including that a
   level tie replays as a win for the better-placed side — the same rule
   `seasonEnd` applies live, which must stay in one place.

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
