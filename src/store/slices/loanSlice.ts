import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import type { LoanDeal } from '@/types/game';
import { TOTAL_WEEKS } from '@/config/gameBalance';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createLoanSlice = (set: Set, get: Get) => ({
  activeLoans: [] as LoanDeal[],
  incomingLoanOffers: [] as GameState['incomingLoanOffers'],

  loanOut: (playerId: string, toClubId: string, duration: number, wageSplit: number, recallClause: boolean, obligatoryBuyFee?: number) => {
    const state = get();
    if (!state.transferWindowOpen) return { success: false, message: 'Transfer window is closed.' };

    const player = state.players[playerId];
    if (!player) return { success: false, message: 'Player not found.' };
    if (player.clubId !== state.playerClubId) return { success: false, message: 'Not your player.' };
    if (player.onLoan) return { success: false, message: 'Player is already on loan.' };

    const fromClub = state.clubs[state.playerClubId];
    const toClub = state.clubs[toClubId];
    if (!fromClub || !toClub) return { success: false, message: 'Invalid club.' };

    const loan: LoanDeal = {
      id: crypto.randomUUID(),
      playerId,
      fromClubId: state.playerClubId,
      toClubId,
      startWeek: state.week,
      startSeason: state.season,
      durationWeeks: duration,
      wageSplit,
      recallClause,
      obligatoryBuyFee,
    };

    // Update player
    const updatedPlayer = {
      ...player,
      onLoan: true,
      loanFromClubId: state.playerClubId,
      loanToClubId: toClubId,
      clubId: toClubId,
    };

    // Update clubs
    const updatedFrom = { ...fromClub };
    updatedFrom.playerIds = updatedFrom.playerIds.filter(id => id !== playerId);
    updatedFrom.lineup = updatedFrom.lineup.filter(id => id !== playerId);
    updatedFrom.subs = updatedFrom.subs.filter(id => id !== playerId);
    // Source club still pays (100 - wageSplit)% of wage
    updatedFrom.wageBill -= Math.round(player.wage * wageSplit / 100);

    const updatedTo = { ...toClub };
    updatedTo.playerIds = [...updatedTo.playerIds, playerId];
    // Destination club pays wageSplit% of wage
    updatedTo.wageBill += Math.round(player.wage * wageSplit / 100);

    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Loaned Out`,
      body: `${player.firstName} ${player.lastName} has joined ${toClub.name} on loan for ${duration} weeks. Wage split: ${wageSplit}%.${recallClause ? ' Recall clause included.' : ''}`,
    });

    set({
      players: { ...state.players, [playerId]: updatedPlayer },
      clubs: { ...state.clubs, [updatedFrom.id]: updatedFrom, [updatedTo.id]: updatedTo },
      activeLoans: [...state.activeLoans, loan],
      messages: newMessages,
    });

    return { success: true, message: `${player.firstName} ${player.lastName} loaned to ${toClub.name}!` };
  },

  recallLoan: (loanId: string) => {
    const state = get();
    const loan = state.activeLoans.find(l => l.id === loanId);
    if (!loan) return { success: false, message: 'Loan not found.' };
    if (!loan.recallClause) return { success: false, message: 'No recall clause in this loan.' };

    // Must have been on loan for at least 4 weeks
    const elapsed = (state.season - loan.startSeason) * TOTAL_WEEKS + (state.week - loan.startWeek);
    if (elapsed < 4) return { success: false, message: 'Must wait at least 4 weeks before recalling.' };

    const player = state.players[loan.playerId];
    if (!player) return { success: false, message: 'Player not found.' };

    const fromClub = { ...state.clubs[loan.fromClubId] };
    const toClub = { ...state.clubs[loan.toClubId] };

    // Return player to parent club
    const updatedPlayer = {
      ...player,
      onLoan: false,
      loanFromClubId: undefined,
      loanToClubId: undefined,
      clubId: loan.fromClubId,
    };

    toClub.playerIds = toClub.playerIds.filter(id => id !== loan.playerId);
    toClub.lineup = toClub.lineup.filter(id => id !== loan.playerId);
    toClub.subs = toClub.subs.filter(id => id !== loan.playerId);
    toClub.wageBill -= Math.round(player.wage * loan.wageSplit / 100);

    fromClub.playerIds = [...fromClub.playerIds, loan.playerId];
    fromClub.wageBill += Math.round(player.wage * loan.wageSplit / 100);

    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Recalled`,
      body: `${player.firstName} ${player.lastName} has been recalled from loan at ${toClub.name}.`,
    });

    set({
      players: { ...state.players, [loan.playerId]: updatedPlayer },
      clubs: { ...state.clubs, [fromClub.id]: fromClub, [toClub.id]: toClub },
      activeLoans: state.activeLoans.filter(l => l.id !== loanId),
      messages: newMessages,
    });

    return { success: true, message: `${player.firstName} ${player.lastName} recalled from loan.` };
  },

  respondToLoanOffer: (offerId: string, accept: boolean) => {
    const state = get();
    const offer = state.incomingLoanOffers.find(o => o.id === offerId);
    if (!offer) return { success: false, message: 'Offer not found.' };

    const newOffers = state.incomingLoanOffers.filter(o => o.id !== offerId);
    const player = state.players[offer.playerId];
    const fromClub = state.clubs[offer.fromClubId];

    if (!player || !fromClub) return { success: false, message: 'Invalid offer.' };

    if (!accept) {
      const msg = addMsg(state.messages, {
        week: state.week, season: state.season, type: 'transfer',
        title: 'Loan Offer Rejected',
        body: `You rejected ${fromClub.name}'s loan offer for ${player.lastName}.`,
      });
      set({ incomingLoanOffers: newOffers, messages: msg });
      return { success: true, message: 'Loan offer rejected.' };
    }

    // Accept loan — player goes to the offering club
    const loan: LoanDeal = {
      id: crypto.randomUUID(),
      playerId: offer.playerId,
      fromClubId: state.playerClubId,
      toClubId: offer.fromClubId,
      startWeek: state.week,
      startSeason: state.season,
      durationWeeks: offer.durationWeeks,
      wageSplit: offer.wageSplit,
      recallClause: offer.recallClause,
      obligatoryBuyFee: offer.obligatoryBuyFee,
    };

    const updatedPlayer = {
      ...player,
      onLoan: true,
      listedForSale: false,
      loanFromClubId: state.playerClubId,
      loanToClubId: offer.fromClubId,
      clubId: offer.fromClubId,
    };

    const sellerClub = { ...state.clubs[state.playerClubId] };
    sellerClub.playerIds = sellerClub.playerIds.filter(id => id !== offer.playerId);
    sellerClub.lineup = sellerClub.lineup.filter(id => id !== offer.playerId);
    sellerClub.subs = sellerClub.subs.filter(id => id !== offer.playerId);
    sellerClub.wageBill -= Math.round(player.wage * offer.wageSplit / 100);

    const buyerClub = { ...fromClub };
    buyerClub.playerIds = [...buyerClub.playerIds, offer.playerId];
    buyerClub.wageBill += Math.round(player.wage * offer.wageSplit / 100);

    const msg = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Loaned Out`,
      body: `${player.firstName} ${player.lastName} has joined ${fromClub.name} on loan for ${offer.durationWeeks} weeks.`,
    });

    set({
      players: { ...state.players, [offer.playerId]: updatedPlayer },
      clubs: { ...state.clubs, [sellerClub.id]: sellerClub, [buyerClub.id]: buyerClub },
      activeLoans: [...state.activeLoans, loan],
      incomingLoanOffers: newOffers.filter(o => o.playerId !== offer.playerId),
      transferMarket: state.transferMarket.filter(l => l.playerId !== offer.playerId),
      messages: msg,
    });

    return { success: true, message: `${player.firstName} ${player.lastName} loaned to ${fromClub.name}.` };
  },

  processLoanReturns: () => {
    const state = get();
    if (state.activeLoans.length === 0) return;

    const returning: LoanDeal[] = [];
    const remaining: LoanDeal[] = [];

    for (const loan of state.activeLoans) {
      const elapsed = (state.season - loan.startSeason) * TOTAL_WEEKS + (state.week - loan.startWeek);
      if (elapsed >= loan.durationWeeks) {
        returning.push(loan);
      } else {
        remaining.push(loan);
      }
    }

    if (returning.length === 0) return;

    const newPlayers = { ...state.players };
    const newClubs = { ...state.clubs };
    let newMessages = state.messages;

    for (const loan of returning) {
      const player = newPlayers[loan.playerId];
      if (!player) {
        // Player entity missing — still clean up club rosters to prevent ghost references
        const toClub = { ...newClubs[loan.toClubId] };
        toClub.playerIds = toClub.playerIds.filter(id => id !== loan.playerId);
        toClub.lineup = toClub.lineup.filter(id => id !== loan.playerId);
        toClub.subs = toClub.subs.filter(id => id !== loan.playerId);
        newClubs[toClub.id] = toClub;
        continue;
      }

      if (loan.obligatoryBuyFee) {
        // Convert to permanent transfer
        const fromClub = { ...newClubs[loan.fromClubId] };
        const toClub = { ...newClubs[loan.toClubId] };

        fromClub.budget += loan.obligatoryBuyFee;
        toClub.budget -= loan.obligatoryBuyFee;

        // Player stays at toClub permanently
        newPlayers[loan.playerId] = {
          ...player,
          onLoan: false,
          loanFromClubId: undefined,
          loanToClubId: undefined,
          clubId: loan.toClubId,
        };

        // Fix wage bills — remove the split, add full wage to dest
        fromClub.wageBill -= Math.round(player.wage * (100 - loan.wageSplit) / 100);
        toClub.wageBill += Math.round(player.wage * (100 - loan.wageSplit) / 100);

        newClubs[fromClub.id] = fromClub;
        newClubs[toClub.id] = toClub;

        newMessages = addMsg(newMessages, {
          week: state.week, season: state.season, type: 'transfer',
          title: `${player.lastName} Permanent Move`,
          body: `${player.firstName} ${player.lastName}'s loan at ${toClub.name} has been made permanent for £${(loan.obligatoryBuyFee / 1e6).toFixed(1)}M.`,
        });
      } else {
        // Return player to parent club
        const fromClub = { ...newClubs[loan.fromClubId] };
        const toClub = { ...newClubs[loan.toClubId] };

        toClub.playerIds = toClub.playerIds.filter(id => id !== loan.playerId);
        toClub.lineup = toClub.lineup.filter(id => id !== loan.playerId);
        toClub.subs = toClub.subs.filter(id => id !== loan.playerId);
        toClub.wageBill -= Math.round(player.wage * loan.wageSplit / 100);

        fromClub.playerIds = [...fromClub.playerIds, loan.playerId];
        fromClub.wageBill += Math.round(player.wage * loan.wageSplit / 100);

        newPlayers[loan.playerId] = {
          ...player,
          onLoan: false,
          loanFromClubId: undefined,
          loanToClubId: undefined,
          clubId: loan.fromClubId,
        };

        newClubs[fromClub.id] = fromClub;
        newClubs[toClub.id] = toClub;

        newMessages = addMsg(newMessages, {
          week: state.week, season: state.season, type: 'transfer',
          title: `${player.lastName} Returns`,
          body: `${player.firstName} ${player.lastName} has returned from loan at ${toClub.name}.`,
        });
      }
    }

    set({ players: newPlayers, clubs: newClubs, activeLoans: remaining, messages: newMessages });
  },
});
