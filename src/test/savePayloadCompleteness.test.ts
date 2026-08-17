/**
 * Regression: fields the store declares as persisted must actually be written
 * to the save payload.
 *
 * Two fields were declared persisted (`storeTypes.ts`), given migration steps
 * (`saveMigration.ts` v74 for `careerRetired`, v82 for `playoffState`) and then
 * never added to `performSave`'s `saveData` object. Nothing caught it because
 * every existing save test asserts on fields that ARE written.
 *
 * Each omission was independently career-ending:
 *
 *   - `playoffState`: `seasonPhase: 'playoff'` was saved without the bracket it
 *     refers to. On reload `endSeason()` saw the phase and refused to roll,
 *     while `playCurrentMatch()` found no tie to play. The season could never
 *     end again.
 *   - `careerRetired`: set at retirement, then dropped by the very `saveGame()`
 *     on the next line. A reloaded retiree re-entered the unemployed branch and
 *     re-retired every 24 weeks — verbatim the loop the flag was added to stop.
 *     It was also missing from `buildFreshSessionState`, so a NEW career started
 *     after a retirement inherited `careerRetired: true` and refused to advance
 *     a single week.
 *
 * The first test is a keyset guard rather than a per-field check: it fails for
 * the NEXT field that gets declared persisted and left out of the payload.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { readSaveSlot, __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { getPlayerPlayoffCandidates } from '@/store/slices/orchestration/playoff';

const SLOT = 1;
/** A second-tier club — eng-2 has playoff spots. */
const PLAYOFF_CLUB = 'coventry-city';
const TOP_TIER_CLUB = 'manchester-city';

function fresh(clubId: string) {
  __resetAutosaveSchedulerForTests();
  __resetSaveStorageForTests();
  useGameStore.getState().resetGame();
  localStorage.clear();
  useGameStore.getState().initGame(clubId);
}

/** Decide every fixture so `order` is the exact final table, then jump to the
 *  last week. Writes both fixture views — the season-settling step only leaves
 *  results alone when they are already `played`. */
function forceFinalTable(order: string[]): void {
  const s = useGameStore.getState();
  const div = s.playerDivision;
  const rank = new Map(order.map((id, i) => [id, i]));
  const decided = s.fixtures.map(f => {
    const homeBetter = (rank.get(f.homeClubId) ?? 99) < (rank.get(f.awayClubId) ?? 99);
    return { ...f, played: true, events: [], homeGoals: homeBetter ? 1 : 0, awayGoals: homeBetter ? 0 : 1 };
  });
  useGameStore.setState({
    fixtures: decided,
    divisionFixtures: { ...s.divisionFixtures, [div]: decided },
    week: s.totalWeeks,
  });
}

/** Put `clubId` at `position` (1-indexed) in its division's final table. */
function placeAt(clubId: string, position: number): void {
  const s = useGameStore.getState();
  const rest = (s.divisionClubs[s.playerDivision] || []).filter(id => id !== clubId);
  const order = [...rest];
  order.splice(position - 1, 0, clubId);
  forceFinalTable(order);
}

const savedPayload = () => JSON.parse(readSaveSlot(SLOT)!);

describe('save payload carries every field the store declares persisted', () => {
  beforeEach(() => fresh(TOP_TIER_CLUB));

  it('writes playoffState and careerRetired', () => {
    useGameStore.getState().saveGame(SLOT);
    const data = savedPayload();
    // `in` rather than a truthiness check: both fields are legitimately
    // null/false in a fresh game, and their ABSENCE is the bug.
    expect('playoffState' in data).toBe(true);
    expect('careerRetired' in data).toBe(true);
  });

  it('a phase that implies a bracket never ships without one', () => {
    useGameStore.setState({ seasonPhase: 'playoff' });
    useGameStore.getState().saveGame(SLOT);
    const data = savedPayload();
    expect(data.seasonPhase).toBe('playoff');
    expect('playoffState' in data).toBe(true);
  });
});

describe('playoffState survives a reload', () => {
  beforeEach(() => {
    fresh(PLAYOFF_CLUB);
    placeAt(PLAYOFF_CLUB, 3); // first outside automatic promotion
  });

  it('a saved playoff can still be played and rolled after loading', () => {
    // Hard precondition — if the club stops qualifying this test must fail
    // rather than quietly verify nothing.
    expect(getPlayerPlayoffCandidates(useGameStore.getState())).not.toBeNull();

    const season = useGameStore.getState().season;
    useGameStore.getState().endSeason();
    expect(useGameStore.getState().seasonPhase).toBe('playoff');
    expect(useGameStore.getState().playoffState?.pendingMatch).toBeTruthy();

    useGameStore.getState().saveGame(SLOT);
    expect(savedPayload().playoffState?.pendingMatch).toBeTruthy();

    // Simulate a relaunch: wipe memory without touching SLOT (resetGame
    // deletes the slot it resets, so reset a different one), then load.
    useGameStore.getState().resetGame(SLOT + 1);
    expect(useGameStore.getState().loadGame(SLOT)).toBe(true);

    const loaded = useGameStore.getState();
    expect(loaded.seasonPhase).toBe('playoff');
    expect(loaded.playoffState?.pendingMatch).toBeTruthy();
    // The tie is playable again — this is what was impossible before.
    expect(loaded.playCurrentMatch()).not.toBeNull();
    // ...and the season can still reach its end.
    let guard = 0;
    while (useGameStore.getState().seasonPhase === 'playoff' && guard++ < 6) {
      if (!useGameStore.getState().playoffState?.pendingMatch) break;
      useGameStore.getState().playCurrentMatch();
    }
    // Playing the last tie rolls the season itself; only nudge it if the
    // bracket ended without one. Either way the season must roll EXACTLY once.
    if (useGameStore.getState().season === season) useGameStore.getState().endSeason();
    expect(useGameStore.getState().season).toBe(season + 1);
  });

  it('a legacy save with the phase but no bracket self-heals instead of deadlocking', () => {
    useGameStore.getState().endSeason();
    const season = useGameStore.getState().season;
    // Exactly the shape an old save produced: phase persisted, bracket lost.
    useGameStore.setState({ seasonPhase: 'playoff', playoffState: null });

    useGameStore.getState().endSeason();

    expect(useGameStore.getState().seasonPhase).not.toBe('playoff');
    expect(useGameStore.getState().season).toBe(season + 1);
  });
});

describe('careerRetired is terminal, persisted, and reset by a new game', () => {
  beforeEach(() => fresh(TOP_TIER_CLUB));

  it('round-trips through save and load', () => {
    useGameStore.setState({ careerRetired: true });
    useGameStore.getState().saveGame(SLOT);
    expect(savedPayload().careerRetired).toBe(true);

    useGameStore.getState().resetGame(SLOT + 1);
    expect(useGameStore.getState().loadGame(SLOT)).toBe(true);
    expect(useGameStore.getState().careerRetired).toBe(true);
  });

  it('does not leak into a brand-new game', () => {
    useGameStore.setState({ careerRetired: true });
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().careerRetired).toBe(false);

    // And the fresh game actually advances — the symptom players would see.
    useGameStore.getState().initGame(TOP_TIER_CLUB);
    const week = useGameStore.getState().week;
    useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().week).toBeGreaterThan(week);
  });
});
