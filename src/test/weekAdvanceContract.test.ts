/**
 * advanceWeek() game-loop contract. The long-run behaviour is exercised by the
 * longevity/season integration suites; this is a focused, fast guard on the
 * documented per-week invariants (CLAUDE.md):
 *   - week advances by one (within a season);
 *   - matchSubsUsed is reset;
 *   - squads stay valid (lineup ⊆ playerIds, ≥11 players);
 *   - finances stay finite (no NaN budget/wageBill);
 *   - no lineup id is left pointing at a deleted player.
 *
 * Drive pattern mirrors the integration tests: `await advanceWeek()` then
 * `playCurrentMatch()`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

const CLUB_ID = 'celtic';

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
});

/** Every club's lineup/subs must reference real players and a fieldable squad. */
function assertSquadIntegrity() {
  const s = useGameStore.getState();
  for (const club of Object.values(s.clubs)) {
    expect(club.lineup.every(id => !!s.players[id])).toBe(true);
    expect(club.subs.every(id => !!s.players[id])).toBe(true);
    // A club must keep enough players to field a side.
    expect(club.playerIds.length).toBeGreaterThanOrEqual(11);
  }
}

/** No club may carry a NaN/Infinity budget or wage bill. */
function assertFiniteFinances() {
  const s = useGameStore.getState();
  for (const club of Object.values(s.clubs)) {
    expect(Number.isFinite(club.budget)).toBe(true);
    expect(Number.isFinite(club.wageBill)).toBe(true);
  }
}

describe('advanceWeek — per-week contract', () => {
  it('advances the week by one and resets matchSubsUsed', async () => {
    const before = useGameStore.getState().week;
    useGameStore.setState({ matchSubsUsed: 3 });

    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    expect(s.week).toBe(before + 1);
    expect(s.matchSubsUsed).toBe(0);
  });

  it('keeps squads valid and finances finite after one week', async () => {
    await useGameStore.getState().advanceWeek();
    useGameStore.getState().playCurrentMatch();
    assertSquadIntegrity();
    assertFiniteFinances();
  });

  it('holds the invariants across several consecutive weeks', async () => {
    let prev = useGameStore.getState().week;
    for (let i = 0; i < 4; i++) {
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();

      const wk = useGameStore.getState().week;
      // Week is strictly monotonic within the season (no season rollover this early).
      expect(wk).toBe(prev + 1);
      prev = wk;

      assertSquadIntegrity();
      assertFiniteFinances();
    }
  });
});
