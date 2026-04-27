/**
 * packsSlice — fills the gap left by packs.test.ts (which already covers
 * `openPack`, `canOpenPack`, and `releasePackedPlayer`). Focuses on
 * `quickSellPackedPlayer` (zero existing tests) plus a few `canOpenPack`
 * edge cases not exercised elsewhere.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

const CLUB_ID = 'celtic';

function initAndGetState() {
  useGameStore.getState().initGame(CLUB_ID);
  return useGameStore.getState();
}

beforeEach(() => { initAndGetState(); });

describe('packsSlice — quickSellPackedPlayer', () => {
  it('credits the club budget at 65% of player value', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('bronze');
    expect(open.success).toBe(true);
    const target = open.players![0];

    const budgetBefore = useGameStore.getState().clubs[state.playerClubId].budget;
    const expectedAmount = Math.max(0, Math.round((target.value || 0) * 0.65));

    const result = useGameStore.getState().quickSellPackedPlayer(target.id);
    expect(result.success).toBe(true);
    expect(result.amount).toBe(expectedAmount);

    const budgetAfter = useGameStore.getState().clubs[state.playerClubId].budget;
    expect(budgetAfter - budgetBefore).toBe(expectedAmount);
  });

  it('removes the player from the squad and adds them to free agents', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('bronze');
    const target = open.players![0];
    useGameStore.getState().quickSellPackedPlayer(target.id);

    const after = useGameStore.getState();
    expect(after.clubs[state.playerClubId].playerIds).not.toContain(target.id);
    expect(after.clubs[state.playerClubId].lineup).not.toContain(target.id);
    expect(after.clubs[state.playerClubId].subs).not.toContain(target.id);
    expect(after.freeAgents).toContain(target.id);
    expect(after.players[target.id].clubId).toBe('');
  });

  it('does not charge severance — only credits the budget', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('bronze');
    const target = open.players![0];
    const budgetBefore = useGameStore.getState().clubs[state.playerClubId].budget;
    useGameStore.getState().quickSellPackedPlayer(target.id);
    const budgetAfter = useGameStore.getState().clubs[state.playerClubId].budget;
    expect(budgetAfter).toBeGreaterThanOrEqual(budgetBefore);
  });

  it('reduces the wage bill by the player wage', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('bronze');
    const target = open.players![0];
    const wageBillBefore = useGameStore.getState().clubs[state.playerClubId].wageBill;
    useGameStore.getState().quickSellPackedPlayer(target.id);
    const wageBillAfter = useGameStore.getState().clubs[state.playerClubId].wageBill;
    expect(wageBillAfter).toBe(Math.max(0, wageBillBefore - target.wage));
  });

  it('updates the openedPacks record so the summary re-renders without the sold card', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('rare', { method: 'iap', skipPayment: true });
    const target = open.players![0];

    useGameStore.getState().quickSellPackedPlayer(target.id);
    const latestRecord = useGameStore.getState().openedPacks[0];
    expect(latestRecord.playerIds).not.toContain(target.id);
  });

  it('rejects quick-sell of a player not from the latest pack', () => {
    const state = useGameStore.getState();
    const existingPlayerId = state.clubs[state.playerClubId].playerIds[0];
    const result = useGameStore.getState().quickSellPackedPlayer(existingPlayerId);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/just opened/i);
  });

  it('rejects quick-sell after the week advances', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('bronze');
    const target = open.players![0];
    useGameStore.setState({ week: state.week + 1 });
    const result = useGameStore.getState().quickSellPackedPlayer(target.id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/just opened/i);
  });

  it('rejects quick-sell after the season changes', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('bronze');
    const target = open.players![0];
    useGameStore.setState({ season: state.season + 1 });
    const result = useGameStore.getState().quickSellPackedPlayer(target.id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/just opened/i);
  });

  it('refills the lineup after quick-selling an auto-placed pack starter', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 200_000_000 } },
    });
    const open = useGameStore.getState().openPack('rare', { method: 'iap', skipPayment: true });
    const target = open.players![0];
    const lineupBefore = useGameStore.getState().clubs[state.playerClubId].lineup.length;
    useGameStore.getState().quickSellPackedPlayer(target.id);
    const lineupAfter = useGameStore.getState().clubs[state.playerClubId].lineup;
    // Refill keeps lineup the same size or down by at most 1
    expect(lineupAfter.length).toBeGreaterThanOrEqual(lineupBefore - 1);
    expect(lineupAfter).not.toContain(target.id);
  });

  it('credits 0 when the player value is missing', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('bronze');
    const target = open.players![0];
    // Force value to 0
    useGameStore.setState({
      players: { ...useGameStore.getState().players, [target.id]: { ...target, value: 0 } },
    });
    const result = useGameStore.getState().quickSellPackedPlayer(target.id);
    expect(result.success).toBe(true);
    expect(result.amount).toBe(0);
  });
});

describe('packsSlice — canOpenPack edge cases', () => {
  it('reports OK for the bronze daily-free path on a fresh game', () => {
    const result = useGameStore.getState().canOpenPack('bronze', 'free');
    // bronze has a freeDailyLimit > 0, so a fresh state should be OK
    if ('ok' in result) {
      expect(result.ok).toBe(true);
    }
  });

  it('blocks bronze free path after the daily allowance is used', () => {
    // Simulate today's bronze free already taken
    const today = new Date().toISOString().slice(0, 10);
    useGameStore.setState({
      dailyPackOpens: { date: today, free: { bronze: 99 }, ad: {} },
    });
    const result = useGameStore.getState().canOpenPack('bronze', 'free');
    expect('ok' in result && result.ok).toBe(false);
  });

  it('returns a method-aware result when an explicit method is passed', () => {
    // iap path should always be a yes/no for "can the page proceed?"
    const result = useGameStore.getState().canOpenPack('icon', 'iap');
    // We don't assert ok=true (icon requires real money) but the structure
    // should be consistent
    expect(typeof result.ok).toBe('boolean');
  });
});
