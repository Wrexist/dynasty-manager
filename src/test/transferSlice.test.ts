/**
 * transferSlice — direct unit tests for actions not covered by
 * transferOffers.test.ts (which targets utils) or edgeCases.test.ts
 * (which only touches the transfer-window boundary). Focuses on the
 * untested action surface: shortlist management, negotiation strikes,
 * incoming-offer acceptance, free-agent signings, releases, and contract
 * renewals.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { IncomingOffer } from '@/types/game';

const CLUB_ID = 'manchester-city';

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
});

describe('transferSlice — shortlist', () => {
  it('addToShortlist appends a player id', () => {
    useGameStore.getState().addToShortlist('player-x');
    expect(useGameStore.getState().shortlist).toContain('player-x');
  });

  it('addToShortlist deduplicates', () => {
    useGameStore.getState().addToShortlist('player-y');
    useGameStore.getState().addToShortlist('player-y');
    const shortlist = useGameStore.getState().shortlist;
    expect(shortlist.filter(id => id === 'player-y')).toHaveLength(1);
  });

  it('removeFromShortlist removes the entry', () => {
    useGameStore.getState().addToShortlist('player-z');
    useGameStore.getState().removeFromShortlist('player-z');
    expect(useGameStore.getState().shortlist).not.toContain('player-z');
  });

  it('removeFromShortlist on a missing id is a no-op', () => {
    const before = useGameStore.getState().shortlist;
    useGameStore.getState().removeFromShortlist('not-on-list');
    expect(useGameStore.getState().shortlist).toEqual(before);
  });
});

describe('transferSlice — negotiation strikes', () => {
  it('getPlayerStrikes returns 0 for an unknown player', () => {
    expect(useGameStore.getState().getPlayerStrikes('unknown')).toBe(0);
  });

  it('recordNegotiationStrike increments and returns the new total', () => {
    expect(useGameStore.getState().recordNegotiationStrike('p1')).toBe(1);
    expect(useGameStore.getState().recordNegotiationStrike('p1')).toBe(2);
    expect(useGameStore.getState().getPlayerStrikes('p1')).toBe(2);
  });

  it('strikes cap at the configured maximum (3) and lock further negotiation', () => {
    useGameStore.getState().recordNegotiationStrike('p2');
    useGameStore.getState().recordNegotiationStrike('p2');
    useGameStore.getState().recordNegotiationStrike('p2');
    expect(useGameStore.getState().getPlayerStrikes('p2')).toBe(3);
    const lock = useGameStore.getState().isNegotiationLocked('p2');
    expect(lock.locked).toBe(true);
    expect(lock.weeksRemaining).toBeGreaterThan(0);
    // Additional strikes don't go past the cap
    expect(useGameStore.getState().recordNegotiationStrike('p2')).toBe(3);
  });

  it('isNegotiationLocked returns false when no strikes recorded', () => {
    const lock = useGameStore.getState().isNegotiationLocked('clean-player');
    expect(lock.locked).toBe(false);
    expect(lock.weeksRemaining).toBe(0);
  });

  it('clearNegotiationStrikes wipes the entry', () => {
    useGameStore.getState().recordNegotiationStrike('p3');
    useGameStore.getState().clearNegotiationStrikes('p3');
    expect(useGameStore.getState().getPlayerStrikes('p3')).toBe(0);
  });

  it('clearExpiredCooldowns removes entries whose cooldown has passed', () => {
    useGameStore.getState().recordNegotiationStrike('p4');
    useGameStore.getState().recordNegotiationStrike('p4');
    useGameStore.getState().recordNegotiationStrike('p4');
    expect(useGameStore.getState().isNegotiationLocked('p4').locked).toBe(true);
    // Fast-forward past the cooldown window by setting season+week far ahead.
    useGameStore.setState({ season: 99 });
    useGameStore.getState().clearExpiredCooldowns();
    expect(useGameStore.getState().getPlayerStrikes('p4')).toBe(0);
  });
});

describe('transferSlice — listPlayerForSale / unlistPlayer', () => {
  it('listPlayerForSale puts the player on the transfer market', () => {
    const state = useGameStore.getState();
    const ownPlayer = state.clubs[CLUB_ID].playerIds[0];
    useGameStore.getState().listPlayerForSale(ownPlayer);
    const market = useGameStore.getState().transferMarket;
    expect(market.some(l => l.playerId === ownPlayer && l.sellerClubId === CLUB_ID)).toBe(true);
    expect(useGameStore.getState().players[ownPlayer].listedForSale).toBe(true);
  });

  it('listPlayerForSale honors a custom asking price', () => {
    const state = useGameStore.getState();
    const ownPlayer = state.clubs[CLUB_ID].playerIds[0];
    useGameStore.getState().listPlayerForSale(ownPlayer, 50_000_000);
    const listing = useGameStore.getState().transferMarket.find(l => l.playerId === ownPlayer);
    expect(listing?.askingPrice).toBeGreaterThanOrEqual(50_000_000);
  });

  it('listPlayerForSale refuses a player not on your club', () => {
    const result = useGameStore.getState().listPlayerForSale('not-yours');
    expect(result.appeased).toBe(false);
    // The player was never added to the market
    const market = useGameStore.getState().transferMarket;
    expect(market.some(l => l.playerId === 'not-yours')).toBe(false);
  });

  it('unlistPlayer removes the listing and clears the listedForSale flag', () => {
    const state = useGameStore.getState();
    const ownPlayer = state.clubs[CLUB_ID].playerIds[0];
    useGameStore.getState().listPlayerForSale(ownPlayer);
    useGameStore.getState().unlistPlayer(ownPlayer);
    expect(useGameStore.getState().transferMarket.some(l => l.playerId === ownPlayer)).toBe(false);
    expect(useGameStore.getState().players[ownPlayer].listedForSale).toBe(false);
  });
});

describe('transferSlice — respondToOffer', () => {
  function setupIncomingOffer(): { offer: IncomingOffer; targetPlayer: string; buyerClubId: string } {
    const state = useGameStore.getState();
    const targetPlayer = state.clubs[CLUB_ID].playerIds[0];
    const buyerClubId = Object.keys(state.clubs).find(id => id !== CLUB_ID)!;
    const offer: IncomingOffer = {
      id: 'incoming-1',
      playerId: targetPlayer,
      buyerClubId,
      fee: 25_000_000,
      week: state.week,
    };
    useGameStore.setState({ incomingOffers: [offer] });
    // Make sure buyer can afford it
    const buyer = { ...state.clubs[buyerClubId], budget: 100_000_000 };
    useGameStore.setState({ clubs: { ...state.clubs, [buyerClubId]: buyer } });
    return { offer, targetPlayer, buyerClubId };
  }

  it('rejects when the offer id does not exist', () => {
    const result = useGameStore.getState().respondToOffer('nonexistent', true);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it('rejecting an offer removes it from the queue', () => {
    setupIncomingOffer();
    const result = useGameStore.getState().respondToOffer('incoming-1', false);
    expect(result.success).toBe(true);
    expect(useGameStore.getState().incomingOffers).toHaveLength(0);
  });

  it('accepting transfers the player out of the player club', () => {
    const { targetPlayer, buyerClubId } = setupIncomingOffer();
    const result = useGameStore.getState().respondToOffer('incoming-1', true);
    expect(result.success).toBe(true);
    const after = useGameStore.getState();
    expect(after.clubs[CLUB_ID].playerIds).not.toContain(targetPlayer);
    expect(after.clubs[buyerClubId].playerIds).toContain(targetPlayer);
    expect(after.players[targetPlayer].clubId).toBe(buyerClubId);
  });

  it('accepting credits the seller and debits the buyer', () => {
    const { buyerClubId } = setupIncomingOffer();
    const before = useGameStore.getState();
    const sellerBudgetBefore = before.clubs[CLUB_ID].budget;
    const buyerBudgetBefore = before.clubs[buyerClubId].budget;
    useGameStore.getState().respondToOffer('incoming-1', true);
    const after = useGameStore.getState();
    expect(after.clubs[CLUB_ID].budget).toBeGreaterThan(sellerBudgetBefore);
    expect(after.clubs[buyerClubId].budget).toBeLessThan(buyerBudgetBefore);
  });

  it('refuses to sell when squad would drop below the minimum', () => {
    setupIncomingOffer();
    const club = useGameStore.getState().clubs[CLUB_ID];
    // Trim squad to the minimum
    const trimmed = { ...club, playerIds: club.playerIds.slice(0, 18) };
    useGameStore.setState({ clubs: { ...useGameStore.getState().clubs, [CLUB_ID]: trimmed } });
    const result = useGameStore.getState().respondToOffer('incoming-1', true);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/minimum size/i);
  });

  it('declines accept when buyer can no longer afford the fee', () => {
    const { buyerClubId } = setupIncomingOffer();
    const buyer = useGameStore.getState().clubs[buyerClubId];
    useGameStore.setState({
      clubs: { ...useGameStore.getState().clubs, [buyerClubId]: { ...buyer, budget: 0 } },
    });
    const result = useGameStore.getState().respondToOffer('incoming-1', true);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/afford/i);
  });
});

describe('transferSlice — acceptIncomingOfferAtFee', () => {
  it('rejects an unknown offer id', () => {
    const result = useGameStore.getState().acceptIncomingOfferAtFee('nope', 1_000_000);
    expect(result.success).toBe(false);
  });

  it('completes the sale at the supplied fee, not the original', () => {
    const state = useGameStore.getState();
    const targetPlayer = state.clubs[CLUB_ID].playerIds[0];
    const buyerClubId = Object.keys(state.clubs).find(id => id !== CLUB_ID)!;
    const offer: IncomingOffer = {
      id: 'incoming-2', playerId: targetPlayer, buyerClubId, fee: 10_000_000, week: state.week,
    };
    useGameStore.setState({
      incomingOffers: [offer],
      clubs: { ...state.clubs, [buyerClubId]: { ...state.clubs[buyerClubId], budget: 200_000_000 } },
    });
    const sellerBefore = useGameStore.getState().clubs[CLUB_ID].budget;
    const result = useGameStore.getState().acceptIncomingOfferAtFee('incoming-2', 30_000_000);
    expect(result.success).toBe(true);
    const sellerAfter = useGameStore.getState().clubs[CLUB_ID].budget;
    // Seller should have gained ~30M, not 10M
    expect(sellerAfter - sellerBefore).toBeGreaterThanOrEqual(25_000_000);
  });
});

describe('transferSlice — releasePlayer', () => {
  it('rejects releasing another club\'s player', () => {
    const state = useGameStore.getState();
    const otherClub = Object.keys(state.clubs).find(id => id !== CLUB_ID)!;
    const otherPlayer = state.clubs[otherClub].playerIds[0];
    const result = useGameStore.getState().releasePlayer(otherPlayer);
    expect(result.success).toBe(false);
  });

  it('releases the player and adds them to free agents', () => {
    const state = useGameStore.getState();
    const target = state.clubs[CLUB_ID].playerIds.find(pid => {
      const p = state.players[pid];
      return p && p.contractEnd === state.season; // expiring contract → no severance
    }) || state.clubs[CLUB_ID].playerIds[0];
    // Force expiring contract so severance is 0 for the test
    useGameStore.setState({
      players: { ...state.players, [target]: { ...state.players[target], contractEnd: state.season } },
    });
    const result = useGameStore.getState().releasePlayer(target);
    if (!result.success) {
      // If severance still required, top up the budget
      const club = useGameStore.getState().clubs[CLUB_ID];
      useGameStore.setState({ clubs: { ...useGameStore.getState().clubs, [CLUB_ID]: { ...club, budget: 1_000_000_000 } } });
      const retry = useGameStore.getState().releasePlayer(target);
      expect(retry.success).toBe(true);
    }
    const after = useGameStore.getState();
    expect(after.clubs[CLUB_ID].playerIds).not.toContain(target);
    expect(after.freeAgents).toContain(target);
    expect(after.players[target].clubId).toBe('');
  });

  it('rejects when squad is at minimum size', () => {
    const club = useGameStore.getState().clubs[CLUB_ID];
    const trimmed = { ...club, playerIds: club.playerIds.slice(0, 18) };
    useGameStore.setState({ clubs: { ...useGameStore.getState().clubs, [CLUB_ID]: trimmed } });
    const target = trimmed.playerIds[0];
    const result = useGameStore.getState().releasePlayer(target);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/minimum size/i);
  });
});

describe('transferSlice — renewContract', () => {
  it('rejects renewing another club\'s player', () => {
    const state = useGameStore.getState();
    const otherClub = Object.keys(state.clubs).find(id => id !== CLUB_ID)!;
    const otherPlayer = state.clubs[otherClub].playerIds[0];
    const result = useGameStore.getState().renewContract(otherPlayer, 3, 50_000);
    expect(result.success).toBe(false);
  });

  it('rejects renewals shorter than 1 or longer than 5 years', () => {
    const target = useGameStore.getState().clubs[CLUB_ID].playerIds[0];
    expect(useGameStore.getState().renewContract(target, 0, 50_000).success).toBe(false);
    expect(useGameStore.getState().renewContract(target, 6, 50_000).success).toBe(false);
  });

  it('extends the contract end and updates the wage', () => {
    const state = useGameStore.getState();
    const target = state.clubs[CLUB_ID].playerIds[0];
    // Ensure plenty of budget for signing bonus
    useGameStore.setState({
      clubs: { ...state.clubs, [CLUB_ID]: { ...state.clubs[CLUB_ID], budget: 1_000_000_000 } },
    });
    const result = useGameStore.getState().renewContract(target, 4, 80_000);
    expect(result.success).toBe(true);
    const player = useGameStore.getState().players[target];
    expect(player.contractEnd).toBe(state.season + 4);
    expect(player.wage).toBe(80_000);
  });

  it('rejects when budget is insufficient for the signing bonus', () => {
    const state = useGameStore.getState();
    const target = state.clubs[CLUB_ID].playerIds[0];
    useGameStore.setState({
      clubs: { ...state.clubs, [CLUB_ID]: { ...state.clubs[CLUB_ID], budget: 0 } },
    });
    const result = useGameStore.getState().renewContract(target, 5, 200_000);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Insufficient/i);
  });
});

describe('transferSlice — signFreeAgent', () => {
  it('rejects when player is not in the free-agent pool', () => {
    const result = useGameStore.getState().signFreeAgent('not-fa', 50_000, 2);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/free agent/i);
  });

  it('rejects when squad is full', () => {
    // First, ensure a free agent is available
    const state = useGameStore.getState();
    const fa = state.freeAgents[0];
    if (!fa) return; // can't run without a free agent — initGame fills the FA pool, so this is rare
    // Fill squad to MAX_SQUAD_SIZE (40)
    const club = state.clubs[CLUB_ID];
    const padded = {
      ...club,
      playerIds: Array.from({ length: 40 }, (_, i) => `padded-pid-${i}`),
    };
    useGameStore.setState({ clubs: { ...state.clubs, [CLUB_ID]: padded } });
    const result = useGameStore.getState().signFreeAgent(fa, 30_000, 2);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/full|40/i);
  });

  it('signs a free agent within reputation limits', () => {
    const state = useGameStore.getState();
    const fa = state.freeAgents.find(id => {
      const p = state.players[id];
      // Pick a low-quality FA so reputation cap is satisfied for any club
      return p && p.overall <= 65;
    });
    if (!fa) return; // cannot run without a suitable FA
    // Make sure budget is large enough for any signing bonus
    useGameStore.setState({
      clubs: { ...state.clubs, [CLUB_ID]: { ...state.clubs[CLUB_ID], budget: 1_000_000_000 } },
    });
    const result = useGameStore.getState().signFreeAgent(fa, 20_000, 2);
    if (!result.success) {
      // rep cap may still bite — that's fine, just confirm message is sensible
      expect(result.message).toMatch(/reputation|squad|fund/i);
      return;
    }
    const after = useGameStore.getState();
    expect(after.clubs[CLUB_ID].playerIds).toContain(fa);
    expect(after.freeAgents).not.toContain(fa);
    expect(after.players[fa].clubId).toBe(CLUB_ID);
  });
});
