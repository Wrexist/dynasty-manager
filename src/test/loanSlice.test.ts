/**
 * loanSlice — previously untested (775 LOC, finance-critical). Covers the
 * public `loanOut` action: the transfer-window guard, wage-split accounting
 * across both clubs, the [0,100] wage-split clamp, and the roster move.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

const CLUB_ID = 'celtic';

function otherClubId(): string {
  const s = useGameStore.getState();
  const id = Object.keys(s.clubs).find(c => c !== s.playerClubId);
  if (!id) throw new Error('no other club available');
  return id;
}

/** A squad player who is not on loan / listed — safe to loan out. */
function loanablePlayer() {
  const s = useGameStore.getState();
  const club = s.clubs[s.playerClubId];
  const p = club.playerIds
    .map(id => s.players[id])
    .filter(Boolean)
    .find(pl => !pl.onLoan && !pl.listedForSale);
  if (!p) throw new Error('no loanable player');
  return p;
}

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
});

describe('loanSlice — loanOut', () => {
  it('moves the player to the destination club and records the deal', () => {
    const to = otherClubId();
    const player = loanablePlayer();

    const res = useGameStore.getState().loanOut(player.id, to, 8, 50, false);
    expect(res.success).toBe(true);

    const s = useGameStore.getState();
    expect(s.players[player.id].clubId).toBe(to);
    expect(s.players[player.id].onLoan).toBe(true);
    expect(s.clubs[s.playerClubId].playerIds).not.toContain(player.id);
    expect(s.clubs[to].playerIds).toContain(player.id);
    expect(s.activeLoans.some(l => l.playerId === player.id && l.toClubId === to)).toBe(true);
  });

  it('splits the wage bill between the two clubs by wageSplit%', () => {
    const to = otherClubId();
    const player = loanablePlayer();
    const before = useGameStore.getState();
    const fromWageBefore = before.clubs[before.playerClubId].wageBill;
    const toWageBefore = before.clubs[to].wageBill;
    const share = Math.round((player.wage * 50) / 100);

    useGameStore.getState().loanOut(player.id, to, 8, 50, false);

    const s = useGameStore.getState();
    // Owner sheds the destination's share; destination picks it up. Conserved.
    expect(s.clubs[s.playerClubId].wageBill).toBe(Math.max(0, fromWageBefore - share));
    expect(s.clubs[to].wageBill).toBe(toWageBefore + share);
  });

  it('clamps an out-of-range wageSplit to 100 (destination pays full wage)', () => {
    const to = otherClubId();
    const player = loanablePlayer();
    const toWageBefore = useGameStore.getState().clubs[to].wageBill;

    useGameStore.getState().loanOut(player.id, to, 8, 150 /* invalid */, false);

    const s = useGameStore.getState();
    const deal = s.activeLoans.find(l => l.playerId === player.id);
    expect(deal?.wageSplit).toBe(100);
    // At a clamped 100% split the destination shoulders the entire wage.
    expect(s.clubs[to].wageBill).toBe(toWageBefore + player.wage);
  });

  it('refuses to loan out when the transfer window is closed', () => {
    useGameStore.setState({ transferWindowOpen: false });
    const to = otherClubId();
    const player = loanablePlayer();

    const res = useGameStore.getState().loanOut(player.id, to, 8, 50, false);
    expect(res.success).toBe(false);
    expect(useGameStore.getState().players[player.id].onLoan).toBeFalsy();
  });
});
