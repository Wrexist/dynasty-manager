/**
 * packsSlice — fills the gap left by packs.test.ts (which already covers
 * `openPack`, `canOpenPack`, and `releasePackedPlayer`). Focuses on
 * `quickSellPackedPlayer` (zero existing tests) plus a few `canOpenPack`
 * edge cases not exercised elsewhere.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { writeDailyPackOpens, currentDayIndex } from '@/store/helpers/persistence';
import { PACK_QUICK_SELL_RATE, PACK_QUICK_SELL_TAPER_ABOVE, PACK_QUICK_SELL_TAPER_RATE, quickSellValue } from '@/config/packs';
import { MIN_SQUAD_SIZE } from '@/config/gameBalance';

const CLUB_ID = 'celtic';

function initAndGetState() {
  // Daily allowances are device-global (localStorage), not part of the save,
  // and jsdom keeps localStorage for the whole file — clear it per test.
  writeDailyPackOpens({ dayIndex: currentDayIndex(), free: {}, ad: {} });
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
    const open = useGameStore.getState().openPack('daily');
    expect(open.success).toBe(true);
    const target = open.players![0];

    const budgetBefore = useGameStore.getState().clubs[state.playerClubId].budget;
    const expectedAmount = quickSellValue(target.value);

    const result = useGameStore.getState().quickSellPackedPlayer(target.id);
    expect(result.success).toBe(true);
    expect(result.amount).toBe(expectedAmount);

    const budgetAfter = useGameStore.getState().clubs[state.playerClubId].budget;
    expect(budgetAfter - budgetBefore).toBe(expectedAmount);
  });

  it('removes the player from the squad without free-agenting them (sold abroad)', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('daily');
    const target = open.players![0];
    useGameStore.getState().quickSellPackedPlayer(target.id);

    const after = useGameStore.getState();
    expect(after.clubs[state.playerClubId].playerIds).not.toContain(target.id);
    expect(after.clubs[state.playerClubId].lineup).not.toContain(target.id);
    expect(after.clubs[state.playerClubId].subs).not.toContain(target.id);
    // Audit S4-M6: quick-sold players must NOT enter free agency — selling
    // for 65% of value and re-signing for only a signing bonus was a value
    // loop. The sale is treated as a transfer abroad.
    expect(after.freeAgents).not.toContain(target.id);
    expect(after.players[target.id].clubId).toBe('');
  });

  it('does not charge severance — only credits the budget', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('daily');
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
    const open = useGameStore.getState().openPack('daily');
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
    const open = useGameStore.getState().openPack('daily');
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
    const open = useGameStore.getState().openPack('daily');
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
    const open = useGameStore.getState().openPack('daily');
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

describe('packsSlice — quick-sell taper', () => {
  it('pays the full rate below the threshold and the taper rate above it', () => {
    // The pricing model in one assertion. A flat cap used to clip the CHEAP
    // packs hardest — a $2.99 pack booking ~£35M could only ever realise £10M
    // — so the clip moved onto each card's value instead. Order-independent by
    // construction, which is what lets a whole pack sell in one action.
    expect(quickSellValue(4_000_000)).toBe(Math.round(4_000_000 * PACK_QUICK_SELL_RATE));
    expect(quickSellValue(PACK_QUICK_SELL_TAPER_ABOVE)).toBe(
      Math.round(PACK_QUICK_SELL_TAPER_ABOVE * PACK_QUICK_SELL_RATE),
    );
    expect(quickSellValue(PACK_QUICK_SELL_TAPER_ABOVE + 20_000_000)).toBe(
      Math.round(PACK_QUICK_SELL_TAPER_ABOVE * PACK_QUICK_SELL_RATE + 20_000_000 * PACK_QUICK_SELL_TAPER_RATE),
    );
    expect(quickSellValue(0)).toBe(0);
    expect(quickSellValue(undefined as unknown as number)).toBe(0);
  });

  it('still clips a jackpot card hard — real money must not mint decisive cash', () => {
    // The reason any clipping exists: an unclipped £196M Legends pull
    // quick-sold for ~£127M, more than most clubs' entire transfer budget.
    const jackpot = quickSellValue(196_000_000);
    expect(jackpot).toBeLessThan(196_000_000 * PACK_QUICK_SELL_RATE * 0.5);
    expect(jackpot).toBeGreaterThan(0);
  });

  it('is monotonic — a better card is never worth less', () => {
    let prev = -1;
    for (const v of [0, 1_000_000, 9_999_999, 10_000_000, 10_000_001, 50_000_000, 200_000_000]) {
      const paid = quickSellValue(v);
      expect(paid).toBeGreaterThanOrEqual(prev);
      prev = paid;
    }
  });

  it('never refuses a sale on price — every card in a pack can be sold', () => {
    // What the flat per-open cap got wrong: after it was spent the slice had to
    // REFUSE, so the tail of every Sell All silently failed. Nothing about
    // price can refuse a sale now.
    const open = useGameStore.getState().openPack('gold', { method: 'iap', skipPayment: true });
    expect(open.success).toBe(true);
    const dealt = open.players!;
    // Inflate every card past the threshold so each one exercises the taper.
    useGameStore.setState({
      players: Object.fromEntries(
        Object.entries(useGameStore.getState().players).map(([id, pl]) => [
          id,
          dealt.some(d => d.id === id) ? { ...pl, value: 200_000_000 } : pl,
        ]),
      ),
    });
    for (const p of dealt) {
      expect(useGameStore.getState().quickSellPackedPlayer(p.id).success).toBe(true);
    }
    const clubId = useGameStore.getState().playerClubId;
    for (const p of dealt) {
      expect(useGameStore.getState().clubs[clubId].playerIds).not.toContain(p.id);
    }
  });
});

describe('packsSlice — canOpenPack edge cases', () => {
  it('reports OK for the Daily Pack free path on a fresh game', () => {
    const result = useGameStore.getState().canOpenPack('daily', 'free');
    // `daily` has a freeDailyLimit > 0, so a fresh state should be OK
    if ('ok' in result) {
      expect(result.ok).toBe(true);
    }
  });

  it('blocks the Daily Pack free path after the allowance is used', () => {
    // Simulate today's free open already taken. The allowance is judged
    // against the DEVICE record, not the save — seeding `dailyPackOpens` in
    // state no longer means anything, which is the whole point: a per-slot,
    // save-scummable "daily" limit was not a daily limit.
    writeDailyPackOpens({ dayIndex: currentDayIndex(), free: { daily: 99 }, ad: {} });
    const result = useGameStore.getState().canOpenPack('daily', 'free');
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

describe('packsSlice — MIN_SQUAD_SIZE guards', () => {
  it('rejects releasePackedPlayer when squad is at minimum size', () => {
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...club, budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('daily');
    expect(open.success).toBe(true);
    const target = open.players![0];

    // Trim squad to minimum size (pack adds players, so trim below cap first)
    const updatedClub = useGameStore.getState().clubs[state.playerClubId];
    useGameStore.setState({
      clubs: {
        ...useGameStore.getState().clubs,
        [state.playerClubId]: { ...updatedClub, playerIds: updatedClub.playerIds.slice(0, 22) },
      },
    });

    const result = useGameStore.getState().releasePackedPlayer(target.id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/minimum size/i);
  });

  it('rejects quickSellPackedPlayer when squad is at minimum size', () => {
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...club, budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('daily');
    expect(open.success).toBe(true);
    const target = open.players![0];

    const updatedClub = useGameStore.getState().clubs[state.playerClubId];
    useGameStore.setState({
      clubs: {
        ...useGameStore.getState().clubs,
        [state.playerClubId]: { ...updatedClub, playerIds: updatedClub.playerIds.slice(0, 22) },
      },
    });

    const result = useGameStore.getState().quickSellPackedPlayer(target.id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/minimum size/i);
  });
});

describe('packsSlice — paid-IAP rejection surfaces refund signal', () => {
  it('flags paidButRejected when IAP re-validation fails on squad cap', () => {
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    // Fill the squad to MAX_SQUAD_SIZE so the soft-gate `slotsAvailable < tier.cards`
    // fires. This simulates state drift between IAP pre-flight and grant — in
    // practice the page's `busy` flag prevents drift, but if it ever fires
    // the slice MUST tell the page that the user paid so support can refund.
    const filled = Array.from({ length: 40 }, (_, i) => `filler-${i}`);
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...club, playerIds: filled, budget: 50_000_000 } },
    });

    const result = useGameStore.getState().openPack('icon', { method: 'iap', skipPayment: true });
    expect(result.success).toBe(false);
    expect(result.paidButRejected).toBe(true);
  });

  it('does NOT flag paidButRejected on free/currency rejections (no real cost)', () => {
    const state = useGameStore.getState();
    const club = state.clubs[state.playerClubId];
    const filled = Array.from({ length: 40 }, (_, i) => `filler-${i}`);
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...club, playerIds: filled } },
    });
    const result = useGameStore.getState().openPack('daily', { method: 'free' });
    expect(result.success).toBe(false);
    expect(result.paidButRejected).toBeUndefined();
  });
});

describe('packsSlice — undoLastQuickSell', () => {
  function openAndGetTarget() {
    const state = useGameStore.getState();
    useGameStore.setState({
      clubs: { ...state.clubs, [state.playerClubId]: { ...state.clubs[state.playerClubId], budget: 50_000_000 } },
    });
    const open = useGameStore.getState().openPack('daily');
    expect(open.success).toBe(true);
    return open.players![0];
  }

  it('reverts the most recent quick-sell exactly', () => {
    const target = openAndGetTarget();
    const clubId = useGameStore.getState().playerClubId;
    const before = useGameStore.getState();
    const budgetBefore = before.clubs[clubId].budget;
    const squadBefore = before.clubs[clubId].playerIds.length;
    const incomeBefore = before.seasonTotalIncome || 0;

    expect(useGameStore.getState().quickSellPackedPlayer(target.id).success).toBe(true);
    expect(useGameStore.getState().clubs[clubId].playerIds).not.toContain(target.id);

    expect(useGameStore.getState().undoLastQuickSell()).toBe(true);

    const after = useGameStore.getState();
    expect(after.clubs[clubId].budget).toBe(budgetBefore);
    expect(after.clubs[clubId].playerIds).toContain(target.id);
    expect(after.clubs[clubId].playerIds.length).toBe(squadBefore);
    expect(after.players[target.id].clubId).toBe(clubId);
    expect(after.freeAgents).not.toContain(target.id);
    expect(after.seasonTotalIncome || 0).toBe(incomeBefore);
  });

  it('is a no-op the second time (snapshot consumed)', () => {
    const target = openAndGetTarget();
    useGameStore.getState().quickSellPackedPlayer(target.id);
    expect(useGameStore.getState().undoLastQuickSell()).toBe(true);
    expect(useGameStore.getState().undoLastQuickSell()).toBe(false);
  });

  it('refuses to undo once a new pack is opened', () => {
    const target = openAndGetTarget();
    useGameStore.getState().quickSellPackedPlayer(target.id);
    useGameStore.getState().openPack('daily'); // invalidates the snapshot
    expect(useGameStore.getState().undoLastQuickSell()).toBe(false);
  });
});

/**
 * Selling a SELECTED set of cards in one action.
 *
 * The reveal screen is opt-in: nothing is pre-ticked, and `quickSellPackedPlayers`
 * sells exactly the ids handed to it. The two things that must hold are that
 * the money it reports is the money the budget receives, and that ONE Undo
 * reverts the WHOLE batch — a per-sale snapshot would revert only the last
 * card and leave the rest sold, which is not what a batch Undo means.
 */
describe('packsSlice — quickSellPackedPlayers (batch)', () => {
  it('sells exactly the selected ids and leaves the rest on the squad', () => {
    const open = useGameStore.getState().openPack('gold', { method: 'iap', skipPayment: true });
    const dealt = open.players!;
    const picked = [dealt[0].id, dealt[2].id];
    const clubId = useGameStore.getState().playerClubId;

    const result = useGameStore.getState().quickSellPackedPlayers(picked);

    expect(result.success).toBe(true);
    expect(result.soldIds).toEqual(picked);
    expect(result.refusedCount).toBe(0);

    const state = useGameStore.getState();
    for (const p of dealt) {
      const shouldBeSold = picked.includes(p.id);
      expect(state.clubs[clubId].playerIds.includes(p.id)).toBe(!shouldBeSold);
    }
  });

  it('the reported total is exactly what the budget receives', () => {
    // The trust invariant. The sell bar renders this same sum from the same
    // per-card function, so the button cannot promise a number the store
    // will not pay.
    const open = useGameStore.getState().openPack('gold', { method: 'iap', skipPayment: true });
    const dealt = open.players!;
    const ids = dealt.map(p => p.id);
    const clubId = useGameStore.getState().playerClubId;
    const expected = dealt.reduce((sum, p) => sum + quickSellValue(p.value), 0);
    const budgetBefore = useGameStore.getState().clubs[clubId].budget;

    const result = useGameStore.getState().quickSellPackedPlayers(ids);

    expect(result.total).toBe(expected);
    expect(useGameStore.getState().clubs[clubId].budget - budgetBefore).toBe(result.total);
  });

  it('one Undo reverts the WHOLE batch, not just the last card', () => {
    const open = useGameStore.getState().openPack('gold', { method: 'iap', skipPayment: true });
    const dealt = open.players!;
    const ids = dealt.map(p => p.id);
    const clubId = useGameStore.getState().playerClubId;
    const budgetBefore = useGameStore.getState().clubs[clubId].budget;

    const result = useGameStore.getState().quickSellPackedPlayers(ids);
    expect(result.soldIds.length).toBe(dealt.length);

    expect(useGameStore.getState().undoLastQuickSell()).toBe(true);

    const state = useGameStore.getState();
    expect(state.clubs[clubId].budget).toBe(budgetBefore);
    for (const p of dealt) {
      expect(state.clubs[clubId].playerIds).toContain(p.id);
      expect(state.players[p.id].clubId).toBe(clubId);
    }
    // Snapshot consumed — a second Undo must not double-restore.
    expect(useGameStore.getState().undoLastQuickSell()).toBe(false);
  });

  it('reports a partial batch honestly when the squad floor refuses the tail', () => {
    // Price can no longer refuse anything, but MIN_SQUAD_SIZE still can. The
    // caller must be able to tell which cards it may drop from the reveal, so
    // a refused card is never cleared as if it had sold.
    const open = useGameStore.getState().openPack('gold', { method: 'iap', skipPayment: true });
    const dealt = open.players!;
    const clubId = useGameStore.getState().playerClubId;
    const club = useGameStore.getState().clubs[clubId];

    // Sit the squad exactly one player above the floor, with two pack cards on
    // it: the first sale is allowed, the second drops below and is refused.
    const packIds = dealt.map(p => p.id);
    const others = club.playerIds.filter(id => !packIds.includes(id)).slice(0, MIN_SQUAD_SIZE - 1);
    const sellable = packIds.slice(0, 2);
    const keep = [...others, ...sellable];
    expect(keep.length).toBe(MIN_SQUAD_SIZE + 1);
    useGameStore.setState({
      clubs: { ...useGameStore.getState().clubs, [clubId]: { ...club, playerIds: keep } },
    });

    const result = useGameStore.getState().quickSellPackedPlayers(sellable);

    expect(result.success).toBe(true);
    expect(result.soldIds).toEqual([sellable[0]]);
    expect(result.refusedCount).toBe(1);
    expect(result.message).toMatch(/minimum size/i);
    // The refused card is untouched — still owned, still on the squad.
    expect(useGameStore.getState().players[sellable[1]].clubId).toBe(clubId);
    expect(useGameStore.getState().clubs[clubId].playerIds).toContain(sellable[1]);
  });

  it('an empty selection is a no-op', () => {
    useGameStore.getState().openPack('gold', { method: 'iap', skipPayment: true });
    const clubId = useGameStore.getState().playerClubId;
    const before = useGameStore.getState().clubs[clubId].budget;
    const result = useGameStore.getState().quickSellPackedPlayers([]);
    expect(result.success).toBe(false);
    expect(result.total).toBe(0);
    expect(useGameStore.getState().clubs[clubId].budget).toBe(before);
  });
});
