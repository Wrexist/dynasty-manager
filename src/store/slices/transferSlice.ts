import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import { getFarewellSummary } from '@/utils/playerNarratives';
import {
  ACCEPT_CHANCE_AT_ASKING, ACCEPT_CHANCE_AT_80_PERCENT, ACCEPT_CHANCE_BELOW, ACCEPT_80_PERCENT_THRESHOLD,
  LIST_PRICE_MULTIPLIER,
  CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS, SIGNING_BONUS_WEEKS_PER_YEAR, RENEWAL_MORALE_BOOST,
} from '@/config/transfers';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createTransferSlice = (set: Set, get: Get) => ({
  transferMarket: [] as GameState['transferMarket'],
  shortlist: [] as string[],
  incomingOffers: [] as GameState['incomingOffers'],

  addToShortlist: (id: string) => set(s => ({ shortlist: [...s.shortlist, id] })),
  removeFromShortlist: (id: string) => set(s => ({ shortlist: s.shortlist.filter(x => x !== id) })),

  makeOffer: (playerId: string, fee: number) => {
    const state = get();
    if (!state.transferWindowOpen) return { success: false, message: 'Transfer window is closed.' };
    const listing = state.transferMarket.find(l => l.playerId === playerId);
    if (!listing) return { success: false, message: 'Player not available.' };

    const club = state.clubs[state.playerClubId];
    if (fee > club.budget) return { success: false, message: 'Insufficient funds.' };

    const acceptChance = fee >= listing.askingPrice ? ACCEPT_CHANCE_AT_ASKING : fee >= listing.askingPrice * ACCEPT_80_PERCENT_THRESHOLD ? ACCEPT_CHANCE_AT_80_PERCENT : ACCEPT_CHANCE_BELOW;
    if (Math.random() > acceptChance) return { success: false, message: 'Offer rejected. Try a higher fee.' };

    const player = { ...state.players[playerId] };
    const oldClub = { ...state.clubs[listing.sellerClubId] };
    const newClub = { ...state.clubs[state.playerClubId] };

    oldClub.playerIds = oldClub.playerIds.filter(id => id !== playerId);
    oldClub.lineup = oldClub.lineup.filter(id => id !== playerId);
    oldClub.subs = oldClub.subs.filter(id => id !== playerId);
    oldClub.budget += fee;
    oldClub.wageBill -= player.wage;

    // Sell-on clause: the selling club gets 10-20% on expensive transfers
    const sellOnPct = fee >= 10_000_000 ? 10 + Math.floor(Math.random() * 11) : fee >= 5_000_000 ? 5 + Math.floor(Math.random() * 6) : 0;
    player.clubId = state.playerClubId;
    player.joinedSeason = state.season;
    player.listedForSale = false;
    if (sellOnPct > 0) {
      player.sellOnPercentage = sellOnPct;
      player.sellOnClubId = listing.sellerClubId;
    }
    newClub.playerIds.push(playerId);
    newClub.budget -= fee;
    newClub.wageBill += player.wage;

    const transferMarket = state.transferMarket.filter(l => l.playerId !== playerId);
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Signed!`,
      body: `${player.firstName} ${player.lastName} has joined ${newClub.name} from ${oldClub.name} for £${(fee / 1e6).toFixed(1)}M.`,
    });

    const ms = { ...state.managerStats, totalSpent: state.managerStats.totalSpent + fee };
    // Record signing milestone if this is the most expensive signing ever
    const isRecordSigning = fee > ms.totalSpent * 0.4 && fee >= 5_000_000;
    const newTimeline = isRecordSigning
      ? [...state.careerTimeline, { id: crypto.randomUUID(), type: 'record_signing' as const, title: 'Record Signing', description: `Signed ${player.firstName} ${player.lastName} for £${(fee / 1e6).toFixed(1)}M from ${oldClub.name}.`, season: state.season, week: state.week, icon: '✍️' }]
      : state.careerTimeline;
    set({
      players: { ...state.players, [playerId]: player },
      clubs: { ...state.clubs, [oldClub.id]: oldClub, [newClub.id]: newClub },
      transferMarket, messages: newMessages, managerStats: ms,
      careerTimeline: newTimeline,
    });
    return { success: true, message: `${player.firstName} ${player.lastName} signed!` };
  },

  listPlayerForSale: (playerId: string) => {
    const state = get();
    const player = state.players[playerId];
    if (!player || player.clubId !== state.playerClubId) return;
    const newPlayers = { ...state.players, [playerId]: { ...player, listedForSale: true } };
    const newMarket = [...state.transferMarket, { playerId, askingPrice: Math.round(player.value * LIST_PRICE_MULTIPLIER), sellerClubId: state.playerClubId }];
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Listed`,
      body: `${player.firstName} ${player.lastName} has been listed for sale at £${(Math.round(player.value * LIST_PRICE_MULTIPLIER) / 1e6).toFixed(1)}M.`,
    });
    set({ players: newPlayers, transferMarket: newMarket, messages: newMessages });
  },

  unlistPlayer: (playerId: string) => {
    const state = get();
    const player = state.players[playerId];
    if (!player) return;
    set({
      players: { ...state.players, [playerId]: { ...player, listedForSale: false } },
      transferMarket: state.transferMarket.filter(l => l.playerId !== playerId),
    });
  },

  respondToOffer: (offerId: string, accept: boolean) => {
    const state = get();
    const offer = state.incomingOffers.find(o => o.id === offerId);
    if (!offer) return { success: false, message: 'Offer not found.' };

    const player = state.players[offer.playerId];
    const buyerClub = state.clubs[offer.buyerClubId];
    if (!player || !buyerClub) return { success: false, message: 'Invalid offer.' };

    const newOffers = state.incomingOffers.filter(o => o.id !== offerId);

    if (!accept) {
      const msg = addMsg(state.messages, { week: state.week, season: state.season, type: 'transfer', title: `Bid Rejected`, body: `You rejected ${buyerClub.name}'s £${(offer.fee / 1e6).toFixed(1)}M bid for ${player.lastName}.` });
      set({ incomingOffers: newOffers, messages: msg });
      return { success: true, message: 'Offer rejected.' };
    }

    const newPlayers = { ...state.players };
    const sellerClub = { ...state.clubs[state.playerClubId] };
    const buyer = { ...state.clubs[offer.buyerClubId] };

    sellerClub.playerIds = sellerClub.playerIds.filter(id => id !== offer.playerId);
    sellerClub.lineup = sellerClub.lineup.filter(id => id !== offer.playerId);
    sellerClub.subs = sellerClub.subs.filter(id => id !== offer.playerId);
    // Sell-on clause: pay percentage to previous club if applicable
    let sellOnFee = 0;
    const updatedClubs = { ...state.clubs };
    if (player.sellOnPercentage && player.sellOnClubId && player.sellOnClubId !== state.playerClubId) {
      sellOnFee = Math.round(offer.fee * (player.sellOnPercentage / 100));
      const sellOnClub = { ...updatedClubs[player.sellOnClubId] };
      sellOnClub.budget += sellOnFee;
      updatedClubs[player.sellOnClubId] = sellOnClub;
    }
    const netFee = offer.fee - sellOnFee;
    sellerClub.budget += netFee;
    sellerClub.wageBill -= player.wage;

    buyer.playerIds.push(offer.playerId);
    buyer.budget -= offer.fee;
    buyer.wageBill += player.wage;

    newPlayers[offer.playerId] = { ...player, clubId: offer.buyerClubId, listedForSale: false, sellOnPercentage: undefined, sellOnClubId: undefined };

    const newMarket = state.transferMarket.filter(l => l.playerId !== offer.playerId);
    const sellOnNote = sellOnFee > 0 ? ` (£${(sellOnFee / 1e6).toFixed(1)}M sell-on fee paid to ${state.clubs[player.sellOnClubId!]?.name || 'former club'})` : '';
    const msg = addMsg(state.messages, { week: state.week, season: state.season, type: 'transfer', title: `${player.lastName} Sold!`, body: `${player.firstName} ${player.lastName} has been sold to ${buyerClub.name} for £${(offer.fee / 1e6).toFixed(1)}M.${sellOnNote}` });

    updatedClubs[sellerClub.id] = sellerClub;
    updatedClubs[buyer.id] = buyer;
    const ms = { ...state.managerStats, totalEarned: state.managerStats.totalEarned + netFee };

    // Check for farewell
    const farewell = getFarewellSummary(player, state.season, player.joinedSeason);
    const pendingFarewell = farewell.shouldShow
      ? { playerId: offer.playerId, playerName: `${player.firstName} ${player.lastName}`, seasonsServed: farewell.seasonsServed, stats: farewell.stats }
      : null;

    set({
      players: newPlayers,
      clubs: updatedClubs,
      transferMarket: newMarket, incomingOffers: newOffers, messages: msg, managerStats: ms,
      ...(pendingFarewell ? { pendingFarewell } : {}),
    });
    return { success: true, message: `${player.firstName} ${player.lastName} sold for £${(offer.fee / 1e6).toFixed(1)}M!${sellOnNote}` };
  },

  renewContract: (playerId: string, years: number, newWage: number) => {
    const state = get();
    const player = state.players[playerId];
    if (!player || player.clubId !== state.playerClubId) return { success: false, message: 'Not your player.' };
    if (years < CONTRACT_MIN_YEARS || years > CONTRACT_MAX_YEARS) return { success: false, message: 'Contract must be 1-5 years.' };

    const club = { ...state.clubs[state.playerClubId] };
    // Signing bonus: 4 weeks of wages per year
    const signingBonus = Math.round(newWage * years * SIGNING_BONUS_WEEKS_PER_YEAR);
    if (club.budget < signingBonus) return { success: false, message: `Insufficient funds for signing bonus (£${(signingBonus / 1e6).toFixed(1)}M).` };

    club.budget -= signingBonus;
    club.wageBill = club.wageBill - player.wage + newWage;

    const updatedPlayer = {
      ...player,
      contractEnd: state.season + years,
      wage: newWage,
      morale: Math.min(100, player.morale + RENEWAL_MORALE_BOOST),
    };

    const msg = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'contract',
      title: `${player.lastName} Renewed`,
      body: `${player.firstName} ${player.lastName} has signed a new ${years}-year contract (£${(newWage / 1000).toFixed(0)}K/week). Signing bonus: £${(signingBonus / 1e6).toFixed(1)}M.`,
    });

    set({
      players: { ...state.players, [playerId]: updatedPlayer },
      clubs: { ...state.clubs, [club.id]: club },
      messages: msg,
    });
    return { success: true, message: `${player.firstName} ${player.lastName} renewed for ${years} years!` };
  },
});
