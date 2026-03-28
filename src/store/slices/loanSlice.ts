import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import type { LoanDeal, OutgoingLoanRequest } from '@/types/game';
import { TOTAL_WEEKS, LOAN_MIN_WEEKS_BEFORE_RECALL } from '@/config/gameBalance';
import {
  LOAN_REQUEST_BASE_ACCEPT, LOAN_REQUEST_LINEUP_PENALTY,
  LOAN_REQUEST_WAGE_BONUS, LOAN_REQUEST_AGE_BONUS,
  LOAN_REQUEST_COUNTER_CHANCE,
} from '@/config/transfers';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createLoanSlice = (set: Set, get: Get) => ({
  activeLoans: [] as LoanDeal[],
  incomingLoanOffers: [] as GameState['incomingLoanOffers'],
  outgoingLoanRequests: [] as OutgoingLoanRequest[],

  loanOut: (playerId: string, toClubId: string, duration: number, wageSplit: number, recallClause: boolean, obligatoryBuyFee?: number) => {
    const state = get();
    if (!state.transferWindowOpen) return { success: false, message: 'Transfer window is closed.' };

    const player = state.players[playerId];
    if (!player) return { success: false, message: 'Player not found.' };
    if (player.clubId !== state.playerClubId) return { success: false, message: 'Not your player.' };
    if (player.onLoan) return { success: false, message: 'Player is already on loan.' };
    if (player.listedForSale) return { success: false, message: 'Player is listed for sale. Remove from transfer list first.' };

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

    // Clean up shortlist, scout watch list, and transfer market for loaned player
    const cleanedShortlist = state.shortlist.filter(id => id !== playerId);
    const cleanedWatchList = state.scoutWatchList.filter(id => id !== playerId);
    const cleanedMarket = state.transferMarket.filter(l => l.playerId !== playerId);

    set({
      players: { ...state.players, [playerId]: updatedPlayer },
      clubs: { ...state.clubs, [updatedFrom.id]: updatedFrom, [updatedTo.id]: updatedTo },
      activeLoans: [...state.activeLoans, loan],
      messages: newMessages,
      shortlist: cleanedShortlist, scoutWatchList: cleanedWatchList, transferMarket: cleanedMarket,
    });

    return { success: true, message: `${player.firstName} ${player.lastName} loaned to ${toClub.name}!` };
  },

  recallLoan: (loanId: string) => {
    const state = get();
    const loan = state.activeLoans.find(l => l.id === loanId);
    if (!loan) return { success: false, message: 'Loan not found.' };
    if (!loan.recallClause) return { success: false, message: 'No recall clause in this loan.' };

    const elapsed = (state.season - loan.startSeason) * TOTAL_WEEKS + (state.week - loan.startWeek);
    if (elapsed < LOAN_MIN_WEEKS_BEFORE_RECALL) return { success: false, message: `Must wait at least ${LOAN_MIN_WEEKS_BEFORE_RECALL} weeks before recalling.` };

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
      shortlist: state.shortlist.filter(id => id !== offer.playerId),
      scoutWatchList: state.scoutWatchList.filter(id => id !== offer.playerId),
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

      if (loan.obligatoryBuyFee && newClubs[loan.toClubId].budget >= loan.obligatoryBuyFee) {
        // Convert to permanent transfer (only if buying club can afford it)
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

        if (!fromClub.playerIds.includes(loan.playerId)) {
          fromClub.playerIds = [...fromClub.playerIds, loan.playerId];
        }
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

  buyLoanedPlayer: (loanId: string) => {
    const state = get();
    const loan = state.activeLoans.find(l => l.id === loanId);
    if (!loan) return { success: false, message: 'Loan not found.' };
    if (loan.toClubId !== state.playerClubId) return { success: false, message: 'Player is not on loan to your club.' };

    const player = state.players[loan.playerId];
    if (!player) return { success: false, message: 'Player not found.' };

    // Fee: obligatory buy fee if set, otherwise 1.2x player value
    const fee = loan.obligatoryBuyFee || Math.round(player.value * 1.2);
    const buyerClub = { ...state.clubs[state.playerClubId] };
    if (fee > buyerClub.budget) return { success: false, message: `Insufficient funds — need £${(fee / 1e6).toFixed(1)}M.` };

    const sellerClub = { ...state.clubs[loan.fromClubId] };

    // Transfer finances
    buyerClub.budget -= fee;
    sellerClub.budget += fee;

    // Fix wages: remove loan split, add full wage to buyer
    buyerClub.wageBill += Math.round(player.wage * (100 - loan.wageSplit) / 100);
    sellerClub.wageBill -= Math.round(player.wage * (100 - loan.wageSplit) / 100);

    // Remove from seller's roster (already at buyer from loan)
    sellerClub.playerIds = sellerClub.playerIds.filter(id => id !== loan.playerId);

    const updatedPlayer = { ...player, onLoan: false, loanFromClubId: undefined, loanToClubId: undefined, clubId: state.playerClubId };

    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Signed Permanently`,
      body: `${player.firstName} ${player.lastName}'s loan has been converted to a permanent deal for £${(fee / 1e6).toFixed(1)}M.`,
    });

    set({
      players: { ...state.players, [loan.playerId]: updatedPlayer },
      clubs: { ...state.clubs, [buyerClub.id]: buyerClub, [sellerClub.id]: sellerClub },
      activeLoans: state.activeLoans.filter(l => l.id !== loanId),
      messages: newMessages,
    });

    return { success: true, message: `${player.firstName} ${player.lastName} signed permanently for £${(fee / 1e6).toFixed(1)}M!` };
  },

  terminateLoan: (loanId: string) => {
    const state = get();
    const loan = state.activeLoans.find(l => l.id === loanId);
    if (!loan) return { success: false, message: 'Loan not found.' };

    // Only the lending club (fromClub) or the borrowing club can terminate
    const isLender = loan.fromClubId === state.playerClubId;
    const isBorrower = loan.toClubId === state.playerClubId;
    if (!isLender && !isBorrower) return { success: false, message: 'Not involved in this loan.' };

    const player = state.players[loan.playerId];
    if (!player) return { success: false, message: 'Player not found.' };

    const fromClub = { ...state.clubs[loan.fromClubId] };
    const toClub = { ...state.clubs[loan.toClubId] };

    // Return player to parent club
    toClub.playerIds = toClub.playerIds.filter(id => id !== loan.playerId);
    toClub.lineup = toClub.lineup.filter(id => id !== loan.playerId);
    toClub.subs = toClub.subs.filter(id => id !== loan.playerId);
    toClub.wageBill -= Math.round(player.wage * loan.wageSplit / 100);

    fromClub.playerIds = [...fromClub.playerIds, loan.playerId];
    fromClub.wageBill += Math.round(player.wage * loan.wageSplit / 100);

    // Small morale penalty for early termination
    const updatedPlayer = {
      ...player,
      onLoan: false,
      loanFromClubId: undefined,
      loanToClubId: undefined,
      clubId: loan.fromClubId,
      morale: Math.max(0, player.morale - 10),
    };

    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Loan Terminated`,
      body: `${player.firstName} ${player.lastName}'s loan at ${toClub.name} has been terminated early by mutual consent.`,
    });

    set({
      players: { ...state.players, [loan.playerId]: updatedPlayer },
      clubs: { ...state.clubs, [fromClub.id]: fromClub, [toClub.id]: toClub },
      activeLoans: state.activeLoans.filter(l => l.id !== loanId),
      messages: newMessages,
    });

    return { success: true, message: `${player.firstName} ${player.lastName}'s loan terminated.` };
  },

  evaluateLoanRequest: (playerId: string, duration: number, wageSplit: number) => {
    const state = get();
    const player = state.players[playerId];
    if (!player) return null;

    const ownerClub = state.clubs[player.clubId];
    if (!ownerClub) return null;

    // Base chance
    let chance = LOAN_REQUEST_BASE_ACCEPT;

    // Penalty if player is in the owner's starting lineup
    const inLineup = ownerClub.lineup.includes(playerId);
    if (inLineup) chance -= LOAN_REQUEST_LINEUP_PENALTY;

    // Bonus for higher wage split (user pays more)
    chance += wageSplit * LOAN_REQUEST_WAGE_BONUS;

    // Bonus for younger players (under 23)
    if (player.age < 23) chance += (23 - player.age) * LOAN_REQUEST_AGE_BONUS;

    // Penalty for high-rated players
    if (player.overall >= 80) chance -= 0.15;
    else if (player.overall >= 75) chance -= 0.05;

    // Shorter loans are easier to accept
    if (duration <= 12) chance += 0.05;
    else if (duration >= 36) chance -= 0.1;

    chance = Math.max(0.05, Math.min(0.95, chance));

    return { acceptChance: chance, ownerClubName: ownerClub.name };
  },

  requestLoan: (playerId: string, duration: number, wageSplit: number, recallClause: boolean, obligatoryBuyFee?: number) => {
    const state = get();
    if (!state.transferWindowOpen) return { outcome: 'rejected' as const, message: 'The transfer window is closed.' };

    const player = state.players[playerId];
    if (!player) return { outcome: 'rejected' as const, message: 'Player not found.' };
    if (player.clubId === state.playerClubId) return { outcome: 'rejected' as const, message: 'Cannot loan your own player to yourself.' };
    if (player.onLoan) return { outcome: 'rejected' as const, message: 'Player is already on loan.' };

    const ownerClub = state.clubs[player.clubId];
    const userClub = state.clubs[state.playerClubId];
    if (!ownerClub || !userClub) return { outcome: 'rejected' as const, message: 'Invalid club.' };

    // Check for duplicate request
    const existing = state.outgoingLoanRequests.find(r => r.playerId === playerId && r.status === 'pending');
    if (existing) return { outcome: 'rejected' as const, message: 'You already have a pending loan request for this player.' };

    // Evaluate acceptance
    const eval_ = get().evaluateLoanRequest(playerId, duration, wageSplit);
    if (!eval_) return { outcome: 'rejected' as const, message: 'Unable to evaluate loan request.' };

    const roll = Math.random();

    if (roll < eval_.acceptChance) {
      // Accepted — execute the loan
      const loan: LoanDeal = {
        id: crypto.randomUUID(),
        playerId,
        fromClubId: player.clubId,
        toClubId: state.playerClubId,
        startWeek: state.week,
        startSeason: state.season,
        durationWeeks: duration,
        wageSplit,
        recallClause,
        obligatoryBuyFee,
      };

      const updatedPlayer = {
        ...player,
        onLoan: true,
        loanFromClubId: player.clubId,
        loanToClubId: state.playerClubId,
        clubId: state.playerClubId,
      };

      const updatedOwner = { ...ownerClub };
      updatedOwner.playerIds = updatedOwner.playerIds.filter(id => id !== playerId);
      updatedOwner.lineup = updatedOwner.lineup.filter(id => id !== playerId);
      updatedOwner.subs = updatedOwner.subs.filter(id => id !== playerId);
      updatedOwner.wageBill -= Math.round(player.wage * wageSplit / 100);

      const updatedUser = { ...userClub };
      updatedUser.playerIds = [...updatedUser.playerIds, playerId];
      updatedUser.wageBill += Math.round(player.wage * wageSplit / 100);

      const newMessages = addMsg(state.messages, {
        week: state.week, season: state.season, type: 'transfer',
        title: `${player.lastName} Loan Agreed`,
        body: `${player.firstName} ${player.lastName} has joined on loan from ${ownerClub.name} for ${duration} weeks. Wage split: ${wageSplit}%.${recallClause ? ' Recall clause included.' : ''}`,
      });

      set({
        players: { ...state.players, [playerId]: updatedPlayer },
        clubs: { ...state.clubs, [updatedOwner.id]: updatedOwner, [updatedUser.id]: updatedUser },
        activeLoans: [...state.activeLoans, loan],
        messages: newMessages,
      });

      return { outcome: 'accepted' as const, message: `${ownerClub.name} have agreed to loan ${player.firstName} ${player.lastName} to your club!` };
    }

    // Check for counter-offer
    if (roll < eval_.acceptChance + LOAN_REQUEST_COUNTER_CHANCE) {
      const counterWageSplit = Math.min(100, wageSplit + 10 + Math.floor(Math.random() * 15));
      const counterDuration = duration > 12 ? Math.max(4, duration - Math.floor(Math.random() * 8) - 4) : duration;

      return {
        outcome: 'counter' as const,
        counterWageSplit,
        counterDuration,
        message: `${ownerClub.name} are interested but want better terms: ${counterWageSplit}% wage contribution${counterDuration !== duration ? ` and a shorter ${counterDuration}-week loan` : ''}.`,
      };
    }

    // Rejected
    return { outcome: 'rejected' as const, message: `${ownerClub.name} have rejected your loan request for ${player.lastName}. The club considers the player too important.` };
  },

  cancelLoanRequest: (requestId: string) => {
    const state = get();
    set({ outgoingLoanRequests: state.outgoingLoanRequests.filter(r => r.id !== requestId) });
  },
});
