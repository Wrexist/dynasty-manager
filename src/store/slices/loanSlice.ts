import type { GameState } from '../storeTypes';
import { addMsg, safeRandomUUID } from '@/utils/helpers';
import type { Club, LoanDeal, OutgoingLoanRequest, Player } from '@/types/game';
import { TOTAL_WEEKS, LOAN_MIN_WEEKS_BEFORE_RECALL, MAX_SQUAD_SIZE, MIN_SQUAD_SIZE } from '@/config/gameBalance';
import {
  LOAN_REQUEST_BASE_ACCEPT, LOAN_REQUEST_LINEUP_PENALTY,
  LOAN_REQUEST_WAGE_BONUS, LOAN_REQUEST_AGE_BONUS,
  LOAN_REQUEST_COUNTER_CHANCE, LOAN_TERMINATION_MORALE_PENALTY,
} from '@/config/transfers';
import { getLoanBuyFee } from '@/utils/transferOffers';
import { checkChallengeBlock } from './transferSlice';
import { placePlayerInClub } from '../helpers/rosterOps';
import { assignNumberOnJoin } from '@/utils/squadNumbers';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

// Loans created before the wageSplit field existed (or with malformed
// wage data after migration) propagate NaN into club.wageBill, which then
// crashes finance dashboards and league-table rendering. Default to a
// 50/50 split and zero wage so the arithmetic stays finite, and clamp the
// split into [0,100] so a malformed/persisted out-of-range percentage can't
// charge a club more than 100% of a wage.
const clampSplit = (splitPct: number | undefined): number => {
  const s = Number.isFinite(splitPct as number) ? (splitPct as number) : 50;
  return Math.max(0, Math.min(100, s));
};
const safeWageShare = (wage: number | undefined, splitPct: number | undefined): number => {
  const w = Number.isFinite(wage as number) ? (wage as number) : 0;
  return Math.round((w * clampSplit(splitPct)) / 100);
};
const safeWageInverse = (wage: number | undefined, splitPct: number | undefined): number => {
  const w = Number.isFinite(wage as number) ? (wage as number) : 0;
  return Math.round((w * (100 - clampSplit(splitPct))) / 100);
};

/** A loan referencing a club that no longer exists (deleted during promotion/
 *  relegation turnover) cannot be executed — `{...state.clubs[id]}` on a
 *  missing club would crash on `.playerIds`. Mirror processLoanReturns'
 *  missing-club handling: drop the dead loan record, clean the surviving
 *  club's roster, and release the player to free agency. */
const dropBrokenLoan = (
  state: GameState,
  loan: LoanDeal,
  player: Player,
  set: Set,
): { success: false; message: string } => {
  const newClubs = { ...state.clubs };
  for (const cid of [loan.fromClubId, loan.toClubId]) {
    const c = newClubs[cid];
    if (!c) continue;
    newClubs[cid] = {
      ...c,
      playerIds: c.playerIds.filter(id => id !== loan.playerId),
      lineup: c.lineup.filter(id => id !== loan.playerId),
      subs: c.subs.filter(id => id !== loan.playerId),
    };
  }
  set({
    clubs: newClubs,
    activeLoans: state.activeLoans.filter(l => l.id !== loan.id),
    players: { ...state.players, [loan.playerId]: { ...player, onLoan: false, loanFromClubId: undefined, loanToClubId: undefined, clubId: '' } },
    freeAgents: state.freeAgents.includes(loan.playerId) ? state.freeAgents : [...state.freeAgents, loan.playerId],
  });
  return { success: false, message: 'The partner club no longer exists — the loan has been voided and the player released.' };
};

/** Execute an inbound loan (owner club → user club). Shared by requestLoan's
 *  accepted branch and acceptLoanCounter so the two paths can't drift.
 *  `outgoingLoanRequests` is the post-consumption request list to persist. */
const executeLoanIn = (
  state: GameState,
  set: Set,
  player: Player,
  ownerClub: Club,
  userClub: Club,
  terms: { duration: number; wageSplit: number; recallClause: boolean; obligatoryBuyFee?: number },
  outgoingLoanRequests: OutgoingLoanRequest[],
): void => {
  const loan: LoanDeal = {
    id: safeRandomUUID(),
    playerId: player.id,
    fromClubId: player.clubId,
    toClubId: state.playerClubId,
    startWeek: state.week,
    startSeason: state.season,
    durationWeeks: terms.duration,
    wageSplit: terms.wageSplit,
    recallClause: terms.recallClause,
    obligatoryBuyFee: terms.obligatoryBuyFee,
  };

  const updatedPlayer = {
    ...player,
    onLoan: true,
    loanFromClubId: player.clubId,
    loanToClubId: state.playerClubId,
    clubId: state.playerClubId,
  };
  // Give the loanee a shirt at the user's club (honouring retired numbers) so
  // it can't collide with an existing squad number.
  assignNumberOnJoin(updatedPlayer, [...userClub.playerIds, player.id], state.players, state.clubRecords?.retiredNumbers);

  const updatedOwner = { ...ownerClub };
  updatedOwner.playerIds = updatedOwner.playerIds.filter(id => id !== player.id);
  updatedOwner.lineup = updatedOwner.lineup.filter(id => id !== player.id);
  updatedOwner.subs = updatedOwner.subs.filter(id => id !== player.id);
  updatedOwner.wageBill = Math.max(0, updatedOwner.wageBill - safeWageShare(player.wage, terms.wageSplit));

  const updatedUser = { ...userClub };
  updatedUser.playerIds = [...updatedUser.playerIds, player.id];
  updatedUser.wageBill += safeWageShare(player.wage, terms.wageSplit);

  const newMessages = addMsg(state.messages, {
    week: state.week, season: state.season, type: 'transfer',
    title: `${player.lastName} Loan Agreed`,
    body: `${player.firstName} ${player.lastName} has joined on loan from ${ownerClub.name} for ${terms.duration} weeks. Wage split: ${terms.wageSplit}%.${terms.recallClause ? ' Recall clause included.' : ''}`,
    playerId: player.id,
  });

  const incomingLoanClubs = placePlayerInClub(
    { ...state.clubs, [updatedOwner.id]: updatedOwner, [updatedUser.id]: updatedUser },
    updatedUser.id,
    player.id,
  );
  set({
    players: { ...state.players, [player.id]: updatedPlayer },
    clubs: incomingLoanClubs,
    activeLoans: [...state.activeLoans, loan],
    messages: newMessages,
    outgoingLoanRequests,
    // Drop any live market listing — leaving it would let the user buy a
    // player who is mid-loan at full price (fee paid, player later handed
    // back to the lender when the stale LoanDeal expires).
    transferMarket: state.transferMarket.filter(l => l.playerId !== player.id),
  });
};

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
    // Don't loan out below a fieldable squad. recallLoan/terminateLoan guard MAX_SQUAD_SIZE
    // on the receiving side, but loaning out had no MIN guard, so a squad already at the
    // floor could drop below MIN_SQUAD_SIZE and be unable to field a lineup.
    if (fromClub.playerIds.length <= MIN_SQUAD_SIZE) return { success: false, message: 'Your squad is too small to loan out a player.' };

    // Clamp wageSplit to valid range
    wageSplit = Math.max(0, Math.min(100, wageSplit));

    const loan: LoanDeal = {
      id: safeRandomUUID(),
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
    // Compute loaned wage share once to ensure both clubs agree on the amount
    const loanWageShare = safeWageShare(player.wage, wageSplit);
    // Source club still pays (100 - wageSplit)% of wage
    updatedFrom.wageBill = Math.max(0, updatedFrom.wageBill - loanWageShare);

    const updatedTo = { ...toClub };
    updatedTo.playerIds = [...updatedTo.playerIds, playerId];
    // Destination club pays wageSplit% of wage
    updatedTo.wageBill += loanWageShare;

    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Loaned Out`,
      body: `${player.firstName} ${player.lastName} has joined ${toClub.name} on loan for ${duration} weeks. Wage split: ${wageSplit}%.${recallClause ? ' Recall clause included.' : ''}`,
      playerId,
    });

    // Clean up shortlist, scout watch list, transfer market, and stale incoming
    // offers for the loaned player. executeSale now rejects sales of on-loan
    // players defensively, but pruning stale offers also prevents misleading UI.
    const cleanedShortlist = state.shortlist.filter(id => id !== playerId);
    const cleanedWatchList = state.scoutWatchList.filter(id => id !== playerId);
    const cleanedMarket = state.transferMarket.filter(l => l.playerId !== playerId);
    const cleanedIncomingOffers = state.incomingOffers.filter(o => o.playerId !== playerId);
    const cleanedIncomingLoanOffers = state.incomingLoanOffers.filter(o => o.playerId !== playerId);

    const loanOutClubs = placePlayerInClub(
      { ...state.clubs, [updatedFrom.id]: updatedFrom, [updatedTo.id]: updatedTo },
      updatedTo.id,
      playerId,
    );
    set({
      players: { ...state.players, [playerId]: updatedPlayer },
      clubs: loanOutClubs,
      activeLoans: [...state.activeLoans, loan],
      messages: newMessages,
      shortlist: cleanedShortlist, scoutWatchList: cleanedWatchList, transferMarket: cleanedMarket,
      incomingOffers: cleanedIncomingOffers, incomingLoanOffers: cleanedIncomingLoanOffers,
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
    if (!state.clubs[loan.fromClubId] || !state.clubs[loan.toClubId]) return dropBrokenLoan(state, loan, player, set);

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

    if (fromClub.playerIds.length >= MAX_SQUAD_SIZE) return { success: false, message: `Squad is full (${MAX_SQUAD_SIZE} players). Sell or release a player before recalling.` };

    toClub.playerIds = toClub.playerIds.filter(id => id !== loan.playerId);
    toClub.lineup = toClub.lineup.filter(id => id !== loan.playerId);
    toClub.subs = toClub.subs.filter(id => id !== loan.playerId);
    const recallWageShare = safeWageShare(player.wage, loan.wageSplit);
    toClub.wageBill = Math.max(0, toClub.wageBill - recallWageShare);

    fromClub.playerIds = [...fromClub.playerIds, loan.playerId];
    fromClub.wageBill += recallWageShare;

    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Recalled`,
      body: `${player.firstName} ${player.lastName} has been recalled from loan at ${toClub.name}.`,
      playerId: loan.playerId,
    });

    const recallClubs = placePlayerInClub(
      { ...state.clubs, [fromClub.id]: fromClub, [toClub.id]: toClub },
      fromClub.id,
      loan.playerId,
    );
    set({
      players: { ...state.players, [loan.playerId]: updatedPlayer },
      clubs: recallClubs,
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
        playerId: offer.playerId,
      });
      set({ incomingLoanOffers: newOffers, messages: msg });
      return { success: true, message: 'Loan offer rejected.' };
    }

    // Mirror loanOut's guard: don't let the squad drop below a fieldable size.
    const userClubData = state.clubs[state.playerClubId];
    if (!userClubData || userClubData.playerIds.length <= MIN_SQUAD_SIZE) {
      return { success: false, message: `Cannot loan out — squad would drop below minimum size (${MIN_SQUAD_SIZE}).` };
    }

    // Accept loan — player goes to the offering club
    const loan: LoanDeal = {
      id: safeRandomUUID(),
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
    sellerClub.wageBill = Math.max(0, sellerClub.wageBill - safeWageShare(player.wage, offer.wageSplit));

    const buyerClub = { ...fromClub };
    buyerClub.playerIds = [...buyerClub.playerIds, offer.playerId];
    buyerClub.wageBill += safeWageShare(player.wage, offer.wageSplit);

    const msg = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Loaned Out`,
      body: `${player.firstName} ${player.lastName} has joined ${fromClub.name} on loan for ${offer.durationWeeks} weeks.`,
      playerId: offer.playerId,
    });

    const respondClubs = placePlayerInClub(
      { ...state.clubs, [sellerClub.id]: sellerClub, [buyerClub.id]: buyerClub },
      buyerClub.id,
      offer.playerId,
    );
    set({
      players: { ...state.players, [offer.playerId]: updatedPlayer },
      clubs: respondClubs,
      activeLoans: [...state.activeLoans, loan],
      incomingLoanOffers: newOffers.filter(o => o.playerId !== offer.playerId),
      transferMarket: state.transferMarket.filter(l => l.playerId !== offer.playerId),
      shortlist: state.shortlist.filter(id => id !== offer.playerId),
      scoutWatchList: state.scoutWatchList.filter(id => id !== offer.playerId),
      messages: msg,
    });

    return { success: true, message: `${player.firstName} ${player.lastName} loaned to ${fromClub.name}.` };
  },

  processLoanReturns: (forceAll?: boolean) => {
    const state = get();
    if (state.activeLoans.length === 0) return;

    const returning: LoanDeal[] = [];
    const remaining: LoanDeal[] = [];

    // forceAll: season end terminates every loan regardless of remaining
    // duration. finalizeSeason wipes activeLoans afterwards, so any loan
    // left in `remaining` there would silently become a free permanent
    // transfer — the borrower keeps the player and the parent club never
    // gets them back.
    for (const loan of state.activeLoans) {
      const elapsed = (state.season - loan.startSeason) * TOTAL_WEEKS + (state.week - loan.startWeek);
      if (forceAll || elapsed >= loan.durationWeeks) {
        returning.push(loan);
      } else {
        remaining.push(loan);
      }
    }

    if (returning.length === 0) return;

    const newPlayers = { ...state.players };
    const newClubs = { ...state.clubs };
    let newMessages = state.messages;
    let newFreeAgents = state.freeAgents;

    for (const loan of returning) {
      const player = newPlayers[loan.playerId];
      // Guard: skip if either club or player was removed during promotion/relegation
      if (!player || !newClubs[loan.fromClubId] || !newClubs[loan.toClubId]) {
        // Clean up club rosters if possible
        if (newClubs[loan.toClubId]) {
          const toClub = { ...newClubs[loan.toClubId] };
          toClub.playerIds = toClub.playerIds.filter(id => id !== loan.playerId);
          toClub.lineup = toClub.lineup.filter(id => id !== loan.playerId);
          toClub.subs = toClub.subs.filter(id => id !== loan.playerId);
          newClubs[toClub.id] = toClub;
        }
        if (player) {
          // Release to free agency — clubId '' alone leaves the player
          // invisible and unsignable forever (orphan).
          newPlayers[loan.playerId] = { ...player, onLoan: false, loanFromClubId: undefined, loanToClubId: undefined, clubId: '' };
          if (!newFreeAgents.includes(loan.playerId)) newFreeAgents = [...newFreeAgents, loan.playerId];
        }
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
        fromClub.wageBill = Math.max(0, fromClub.wageBill - safeWageInverse(player.wage, loan.wageSplit));
        toClub.wageBill += safeWageInverse(player.wage, loan.wageSplit);

        newClubs[fromClub.id] = fromClub;
        newClubs[toClub.id] = toClub;
        // Invariant: player is only in toClub's roster
        Object.assign(newClubs, placePlayerInClub(newClubs, toClub.id, loan.playerId));

        newMessages = addMsg(newMessages, {
          week: state.week, season: state.season, type: 'transfer',
          title: `${player.lastName} Permanent Move`,
          body: `${player.firstName} ${player.lastName}'s loan at ${toClub.name} has been made permanent for £${(loan.obligatoryBuyFee / 1e6).toFixed(1)}M.`,
        });
      } else {
        // Return player to parent club. (Both clubs are guaranteed present
        // here — the loop-top guard already handled the missing-club case.)
        const fromClub = { ...newClubs[loan.fromClubId] };
        const toClub = { ...newClubs[loan.toClubId] };

        // Notify if obligatory buy failed due to insufficient funds
        const buyFailed = loan.obligatoryBuyFee && toClub.budget < loan.obligatoryBuyFee;

        toClub.wageBill = Math.max(0, toClub.wageBill - safeWageShare(player.wage, loan.wageSplit));
        fromClub.wageBill += safeWageShare(player.wage, loan.wageSplit);

        newClubs[toClub.id] = toClub;
        newClubs[fromClub.id] = fromClub;
        // Invariant: player is only in fromClub's roster
        Object.assign(newClubs, placePlayerInClub(newClubs, fromClub.id, loan.playerId));

        newPlayers[loan.playerId] = {
          ...player,
          onLoan: false,
          loanFromClubId: undefined,
          loanToClubId: undefined,
          clubId: loan.fromClubId,
        };

        const returnBody = buyFailed
          ? `${player.firstName} ${player.lastName} has returned from loan at ${toClub.name}. The obligatory buy clause (£${(loan.obligatoryBuyFee! / 1e6).toFixed(1)}M) could not be activated — ${toClub.name} lacked sufficient funds.`
          : `${player.firstName} ${player.lastName} has returned from loan at ${toClub.name}.`;
        newMessages = addMsg(newMessages, {
          week: state.week, season: state.season, type: 'transfer',
          title: buyFailed ? `${player.lastName} Buy Clause Failed` : `${player.lastName} Returns`,
          body: returnBody,
        });
      }
    }

    set({ players: newPlayers, clubs: newClubs, activeLoans: remaining, messages: newMessages, freeAgents: newFreeAgents });
  },

  buyLoanedPlayer: (loanId: string) => {
    const state = get();
    const loan = state.activeLoans.find(l => l.id === loanId);
    if (!loan) return { success: false, message: 'Loan not found.' };
    if (loan.toClubId !== state.playerClubId) return { success: false, message: 'Player is not on loan to your club.' };

    const player = state.players[loan.playerId];
    if (!player) return { success: false, message: 'Player not found.' };
    if (!state.clubs[loan.fromClubId] || !state.clubs[loan.toClubId]) return dropBrokenLoan(state, loan, player, set);

    // Fee: obligatory buy fee if set, otherwise LOAN_BUY_FEE_MULTIPLIER × value
    // (shared util — TransferPage quotes the same number).
    const fee = getLoanBuyFee(loan, player);
    const buyerClub = { ...state.clubs[state.playerClubId] };
    if (fee > buyerClub.budget) return { success: false, message: `Insufficient funds — need £${(fee / 1e6).toFixed(1)}M.` };

    const sellerClub = { ...state.clubs[loan.fromClubId] };

    // Transfer finances
    buyerClub.budget -= fee;
    sellerClub.budget += fee;

    // Fix wages: remove loan split, add full wage to buyer
    buyerClub.wageBill += safeWageInverse(player.wage, loan.wageSplit);
    sellerClub.wageBill = Math.max(0, sellerClub.wageBill - safeWageInverse(player.wage, loan.wageSplit));

    // Remove from seller's roster (already at buyer from loan)
    sellerClub.playerIds = sellerClub.playerIds.filter(id => id !== loan.playerId);

    const updatedPlayer = { ...player, onLoan: false, loanFromClubId: undefined, loanToClubId: undefined, clubId: state.playerClubId, listedForSale: false };

    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Signed Permanently`,
      body: `${player.firstName} ${player.lastName}'s loan has been converted to a permanent deal for £${(fee / 1e6).toFixed(1)}M.`,
    });

    const buyLoanedClubs = placePlayerInClub(
      { ...state.clubs, [buyerClub.id]: buyerClub, [sellerClub.id]: sellerClub },
      buyerClub.id,
      loan.playerId,
    );
    set({
      players: { ...state.players, [loan.playerId]: updatedPlayer },
      clubs: buyLoanedClubs,
      activeLoans: state.activeLoans.filter(l => l.id !== loanId),
      messages: newMessages,
      shortlist: state.shortlist.filter(id => id !== loan.playerId),
      scoutWatchList: state.scoutWatchList.filter(id => id !== loan.playerId),
      // Clear any stale market listing for the now-permanently-owned player so AI
      // clubs can't keep bidding against an outdated listing.
      transferMarket: state.transferMarket.filter(l => l.playerId !== loan.playerId),
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
    if (!state.clubs[loan.fromClubId] || !state.clubs[loan.toClubId]) return dropBrokenLoan(state, loan, player, set);

    const fromClub = { ...state.clubs[loan.fromClubId] };
    const toClub = { ...state.clubs[loan.toClubId] };

    // Block if lending club (receiving player back) is at squad cap
    if (fromClub.playerIds.length >= MAX_SQUAD_SIZE) return { success: false, message: `Parent club squad is full (${MAX_SQUAD_SIZE} players). Cannot terminate loan.` };

    // Return player to parent club
    toClub.playerIds = toClub.playerIds.filter(id => id !== loan.playerId);
    toClub.lineup = toClub.lineup.filter(id => id !== loan.playerId);
    toClub.subs = toClub.subs.filter(id => id !== loan.playerId);
    toClub.wageBill = Math.max(0, toClub.wageBill - safeWageShare(player.wage, loan.wageSplit));

    fromClub.playerIds = [...fromClub.playerIds, loan.playerId];
    fromClub.wageBill += safeWageShare(player.wage, loan.wageSplit);

    // Small morale penalty for early termination
    const updatedPlayer = {
      ...player,
      onLoan: false,
      loanFromClubId: undefined,
      loanToClubId: undefined,
      clubId: loan.fromClubId,
      morale: Math.max(0, player.morale - LOAN_TERMINATION_MORALE_PENALTY),
    };

    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Loan Terminated`,
      body: `${player.firstName} ${player.lastName}'s loan at ${toClub.name} has been terminated early by mutual consent.`,
    });

    const terminateClubs = placePlayerInClub(
      { ...state.clubs, [fromClub.id]: fromClub, [toClub.id]: toClub },
      fromClub.id,
      loan.playerId,
    );
    set({
      players: { ...state.players, [loan.playerId]: updatedPlayer },
      clubs: terminateClubs,
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

    // Clamp wageSplit to valid range
    wageSplit = Math.max(0, Math.min(100, wageSplit));

    const player = state.players[playerId];
    if (!player) return { outcome: 'rejected' as const, message: 'Player not found.' };
    if (player.clubId === state.playerClubId) return { outcome: 'rejected' as const, message: 'Cannot loan your own player to yourself.' };
    if (player.onLoan) return { outcome: 'rejected' as const, message: 'Player is already on loan.' };

    const ownerClub = state.clubs[player.clubId];
    const userClub = state.clubs[state.playerClubId];
    if (!ownerClub || !userClub) return { outcome: 'rejected' as const, message: 'Invalid club.' };

    // Loan-ins count as signings — challenge restrictions (noTransfers /
    // youthOnly) and the squad cap apply just like executeTransfer.
    const challengeBlock = checkChallengeBlock(state, player.age);
    if (challengeBlock) return { outcome: 'rejected' as const, message: challengeBlock };
    if (userClub.playerIds.length >= MAX_SQUAD_SIZE) return { outcome: 'rejected' as const, message: `Squad is full (${MAX_SQUAD_SIZE} players). Release or sell a player first.` };

    // A fresh request supersedes any pending counter for the same player
    // (Revise → Submit flow) — consume it instead of dead-ending. Accepting
    // a counter as-is goes through acceptLoanCounter.
    const requestsBase = state.outgoingLoanRequests.filter(r => !(r.playerId === playerId && r.status === 'counter'));

    // Evaluate acceptance
    const eval_ = get().evaluateLoanRequest(playerId, duration, wageSplit);
    if (!eval_) return { outcome: 'rejected' as const, message: 'Unable to evaluate loan request.' };

    const roll = Math.random();

    if (roll < eval_.acceptChance) {
      // Accepted — execute the loan
      executeLoanIn(state, set, player, ownerClub, userClub, { duration, wageSplit, recallClause, obligatoryBuyFee }, requestsBase);
      return { outcome: 'accepted' as const, message: `${ownerClub.name} have agreed to loan ${player.firstName} ${player.lastName} to your club!` };
    }

    // Check for counter-offer
    if (roll < eval_.acceptChance + LOAN_REQUEST_COUNTER_CHANCE) {
      const counterWageSplit = Math.min(100, wageSplit + 10 + Math.floor(Math.random() * 15));
      const counterDuration = duration > 12 ? Math.max(4, duration - Math.floor(Math.random() * 8) - 4) : duration;

      // Persist the counter as a tracked request so the user can see it on
      // the Transfer page and accept / cancel it. Required for the dedupe
      // guard above to ever fire.
      const counterRequest: OutgoingLoanRequest = {
        id: safeRandomUUID(),
        playerId,
        toClubId: player.clubId,
        durationWeeks: duration,
        wageSplit,
        recallClause,
        obligatoryBuyFee,
        week: state.week,
        season: state.season,
        status: 'counter',
        counterWageSplit,
        counterDuration,
      };
      set({ outgoingLoanRequests: [...requestsBase, counterRequest] });

      return {
        outcome: 'counter' as const,
        counterWageSplit,
        counterDuration,
        message: `${ownerClub.name} are interested but want better terms: ${counterWageSplit}% wage contribution${counterDuration !== duration ? ` and a shorter ${counterDuration}-week loan` : ''}.`,
      };
    }

    // Rejected — persist a short-lived record so the page can show the
    // rejection note rather than silently swallowing the request. Prune any
    // OTHER rejected entries for the same player at the same time so a chain
    // of refused requests doesn't accumulate in the saved array indefinitely
    // (each entry is ~10 fields × N players × long-running careers = real
    // serialization bloat).
    const rejectedRequest: OutgoingLoanRequest = {
      id: safeRandomUUID(),
      playerId,
      toClubId: player.clubId,
      durationWeeks: duration,
      wageSplit,
      recallClause,
      obligatoryBuyFee,
      week: state.week,
      season: state.season,
      status: 'rejected',
    };
    const prunedRequests = requestsBase.filter(r =>
      !(r.playerId === playerId && r.status === 'rejected'),
    );
    set({ outgoingLoanRequests: [...prunedRequests, rejectedRequest] });
    return { outcome: 'rejected' as const, message: `${ownerClub.name} have rejected your loan request for ${player.lastName}. The club considers the player too important.` };
  },

  /** Accept a pending counter-offer at the club's counter terms. Executes the
   *  loan deterministically (the owner proposed these terms) and clears the
   *  counter record. Re-calling requestLoan here used to trip the dedupe
   *  guard, making counter acceptance always fail. */
  acceptLoanCounter: (requestId: string) => {
    const state = get();
    const req = state.outgoingLoanRequests.find(r => r.id === requestId);
    if (!req || req.status !== 'counter') return { success: false, message: 'Counter-offer not found.' };
    if (!state.transferWindowOpen) return { success: false, message: 'The transfer window is closed.' };

    const player = state.players[req.playerId];
    if (!player) return { success: false, message: 'Player not found.' };
    if (player.onLoan || player.clubId === state.playerClubId) return { success: false, message: 'Player is no longer available for loan.' };

    const ownerClub = state.clubs[player.clubId];
    const userClub = state.clubs[state.playerClubId];
    if (!ownerClub || !userClub) return { success: false, message: 'Invalid club.' };

    const challengeBlock = checkChallengeBlock(state, player.age);
    if (challengeBlock) return { success: false, message: challengeBlock };
    if (userClub.playerIds.length >= MAX_SQUAD_SIZE) return { success: false, message: `Squad is full (${MAX_SQUAD_SIZE} players). Release or sell a player first.` };

    const duration = req.counterDuration ?? req.durationWeeks;
    const wageSplit = Math.max(0, Math.min(100, req.counterWageSplit ?? req.wageSplit));

    executeLoanIn(
      state, set, player, ownerClub, userClub,
      { duration, wageSplit, recallClause: req.recallClause, obligatoryBuyFee: req.obligatoryBuyFee },
      state.outgoingLoanRequests.filter(r => r.id !== requestId),
    );
    return { success: true, message: `${ownerClub.name} have agreed to loan ${player.firstName} ${player.lastName} to your club!` };
  },

  cancelLoanRequest: (requestId: string) => {
    const state = get();
    set({ outgoingLoanRequests: state.outgoingLoanRequests.filter(r => r.id !== requestId) });
  },
});
