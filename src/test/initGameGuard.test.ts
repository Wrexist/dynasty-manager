/**
 * `initGame` must refuse an unknown club id instead of crashing mid-build.
 *
 * THE BUG. `initGameImpl` resolved the club with
 * `ALL_CLUBS.find(c => c.id === clubId)` behind an optional chain, defaulted
 * the division to 'eng', and then ran the entire world build before dying on
 * an unguarded `club.divisionId` — `TypeError: Cannot read properties of
 * undefined (reading 'divisionId')`. A launch-time crash with a partially
 * mutated store behind it.
 *
 * Found by passing `sevilla-fc` where the real id is `sevilla`. `ClubSelection`
 * only ever offers real clubs, so reaching this needs a stale reference: a deep
 * link, a restored screen, or a save written before a club was renamed or
 * removed by a data regeneration — which `saveMigration` already has to handle
 * for exactly that reason.
 *
 * `advanceWeek` already bails cleanly on a missing player club rather than
 * crashing (`advanceWeek: missing player club`). This is the same contract at
 * the other end of the lifecycle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { ALL_CLUBS } from '@/data/league';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';

describe('initGame with an unknown club', () => {
  beforeEach(() => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    localStorage.clear();
    useGameStore.getState().resetGame();
  });

  it('does not throw', async () => {
    await expect(useGameStore.getState().initGame('sevilla-fc')).resolves.toBeUndefined();
  });

  it('leaves the session unstarted rather than half-built', async () => {
    await useGameStore.getState().initGame('this-club-does-not-exist');
    const s = useGameStore.getState();
    expect(s.gameStarted, 'a broken id started a game anyway').toBe(false);
    expect(s.playerClubId).toBeFalsy();
    expect(Object.keys(s.clubs)).toHaveLength(0);
  });

  it('surfaces a load error the UI can show', async () => {
    await useGameStore.getState().initGame('nope');
    const err = useGameStore.getState().loadError;
    expect(err).not.toBeNull();
    expect(err!.kind).toBe('validation_failed');
    expect(err!.reason).toContain('nope');
  });

  it('rejects an empty id', async () => {
    await useGameStore.getState().initGame('');
    expect(useGameStore.getState().gameStarted).toBe(false);
  });

  it('still builds a world for a real club', async () => {
    await useGameStore.getState().initGame('sevilla');
    const s = useGameStore.getState();
    expect(s.gameStarted).toBe(true);
    expect(s.playerClubId).toBe('sevilla');
    expect(s.loadError).toBeNull();
    expect(s.playerDivision).toBe(ALL_CLUBS.find(c => c.id === 'sevilla')!.divisionId);
  });
});
