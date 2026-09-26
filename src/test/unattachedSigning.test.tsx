/**
 * R9 — an "Unattached" player is a free agent.
 *
 * The playthrough found Weston Balogun (84 LW, "Unattached") with a £50.3M
 * asking fee, "Current deal 3 yrs left" and "~15% sell-on clause". No club
 * existed to receive the fee or hold a sell-on. He now signs as a free agent:
 * the price is his signing-on fee (paid to him, no club is credited), there is
 * no sell-on and no current contract, and the negotiation says so. The
 * negotiation's "Budget:" figure, which was the budget AFTER the offer while
 * the page shows the current budget, now reads "Budget after deal:".
 *
 * Decision recorded in the commit: the signing-on fee keeps the old asking
 * price. Routing these players through the wage-based free-agent bonus would
 * sign an 84-rated player for ~£5M instead of ~£50M.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { TransferNegotiation } from '@/components/game/TransferNegotiation';
import { isUnattachedListing } from '@/utils/transferOffers';
import { SELL_ON_HIGH_FEE_THRESHOLD } from '@/config/transfers';
import type { TransferListing } from '@/types/game';

const CLUB_ID = 'liverpool';

function stageUnattached(askingPrice = 50_000_000): TransferListing {
  const s = useGameStore.getState();
  const listing = s.transferMarket.find(l => l.externalPlayer)!;
  expect(listing, 'the generated market has an unattached listing').toBeTruthy();
  const staged = { ...listing, askingPrice };
  useGameStore.setState({
    transferWindowOpen: true,
    transferMarket: s.transferMarket.map(l => (l.playerId === listing.playerId ? staged : l)),
    clubs: { ...s.clubs, [CLUB_ID]: { ...s.clubs[CLUB_ID], budget: 200_000_000 } },
    // Let the reputation cap pass for whoever the generator drew.
    players: { ...s.players, [listing.playerId]: { ...s.players[listing.playerId], overall: 70 } },
  });
  return staged;
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useGameStore.getState().initGame(CLUB_ID);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('unattached listings sign on free-agent terms', () => {
  it('are recognised as unattached, club listings are not', () => {
    const s = useGameStore.getState();
    const clubListing = s.transferMarket.find(l => !l.externalPlayer && s.clubs[l.sellerClubId]);
    expect(isUnattachedListing(s, { externalPlayer: true, sellerClubId: '' })).toBe(true);
    if (clubListing) expect(isUnattachedListing(s, clubListing)).toBe(false);
  });

  it('never preview a sell-on clause, whatever the fee', () => {
    const listing = stageUnattached(SELL_ON_HIGH_FEE_THRESHOLD * 5);
    const ev = useGameStore.getState().evaluateOffer(listing.playerId, listing.askingPrice)!;
    expect(ev.wouldTriggerSellOn).toBe(false);
    expect(ev.sellOnPct).toBe(0);
  });

  it('pay the signing-on fee to nobody and leave no sell-on on the player', () => {
    const listing = stageUnattached();
    const before = useGameStore.getState();
    const othersBefore = Object.values(before.clubs).filter(c => c.id !== CLUB_ID).reduce((sum, c) => sum + c.budget, 0);

    const result = useGameStore.getState().executeTransfer(listing.playerId, listing.askingPrice);
    expect(result.success, result.message).toBe(true);

    const after = useGameStore.getState();
    const othersAfter = Object.values(after.clubs).filter(c => c.id !== CLUB_ID).reduce((sum, c) => sum + c.budget, 0);
    expect(after.clubs[CLUB_ID].budget).toBe(before.clubs[CLUB_ID].budget - listing.askingPrice);
    expect(othersAfter).toBe(othersBefore);
    const signed = after.players[listing.playerId];
    expect(signed.clubId).toBe(CLUB_ID);
    expect(signed.sellOnPercentage).toBeUndefined();
    expect(signed.sellOnClubId).toBeUndefined();
    const msg = after.messages.find(m => m.playerId === listing.playerId && m.title.endsWith('Signed!'))!;
    expect(msg.body).toMatch(/as a free agent/);
    expect(msg.body).toMatch(/signing-on fee/);
    expect(msg.body).not.toMatch(/transfer market/);
  });

  it('counter through the player\'s agent, not a "seller"', () => {
    const listing = stageUnattached();
    // First draw: the accept roll fails. Second: the counter fires.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValueOnce(0).mockReturnValue(0.5);
    const out = useGameStore.getState().makeOfferWithNegotiation(listing.playerId, Math.round(listing.askingPrice * 0.8));
    expect(out.outcome).toBe('counter');
    expect(out.message).toMatch(/agent wants a bigger signing-on fee/);
    expect(out.message).not.toMatch(/seller/i);
  });
});

describe('TransferNegotiation labels (R9)', () => {
  it('an unattached player reads as a free agent with no contract and no sell-on', () => {
    const listing = stageUnattached(SELL_ON_HIGH_FEE_THRESHOLD * 5);
    render(<TransferNegotiation listing={listing} onClose={() => {}} />);
    expect(screen.getByText('Sign Free Agent')).toBeTruthy();
    expect(screen.getByText('Free agent · no club')).toBeTruthy();
    expect(screen.getByText('No current contract')).toBeTruthy();
    expect(screen.queryByText(/Current deal/)).toBeNull();
    expect(screen.queryByText(/sell-on clause/)).toBeNull();
    expect(screen.queryByText('Unattached')).toBeNull();
  });

  it('says the budget figure is the budget after the deal', () => {
    const listing = stageUnattached();
    render(<TransferNegotiation listing={listing} onClose={() => {}} />);
    expect(screen.getByText('Budget after deal:')).toBeTruthy();
    expect(screen.queryByText('Budget:')).toBeNull();
  });
});
