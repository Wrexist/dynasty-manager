import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import { getFarewellSummary } from '@/utils/playerNarratives';
import {
  ACCEPT_CHANCE_AT_ASKING, ACCEPT_CHANCE_AT_80_PERCENT, ACCEPT_CHANCE_BELOW, ACCEPT_80_PERCENT_THRESHOLD,
  LIST_PRICE_MULTIPLIER,
  CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS, SIGNING_BONUS_WEEKS_PER_YEAR, RENEWAL_MORALE_BOOST,
  COUNTER_OFFER_MIN_THRESHOLD, COUNTER_OFFER_MAX_THRESHOLD, COUNTER_OFFER_CHANCE,
  TRANSFER_SHARK_DISCOUNT,
  SELL_ON_HIGH_FEE_THRESHOLD, SELL_ON_LOW_FEE_THRESHOLD,
  SELL_ON_HIGH_BASE_PCT, SELL_ON_HIGH_RANGE_PCT, SELL_ON_LOW_BASE_PCT, SELL_ON_LOW_RANGE_PCT,
  SELL_ON_EVAL_HIGH_PCT, SELL_ON_EVAL_LOW_PCT,
  COUNTER_OFFER_BASE_RATIO, COUNTER_OFFER_RANDOM_RANGE,
  RECORD_SIGNING_SPEND_RATIO, RECORD_SIGNING_MIN_FEE,
} from '@/config/transfers';
import { MIN_SQUAD_SIZE } from '@/config/gameBalance';
import { hasPerk } from '@/utils/managerPerks';
import { STAR_SIGNING_BUZZ_WEEKS, STAR_PLAYER_SALE_DIP_WEEKS, CAMPAIGN_STAR_SIGNING_MIN_VALUE } from '@/config/merchandise';
import { getStarPlayerMerch } from '@/utils/merchandise';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createTransferSlice = (set: Set, get: Get) => ({
  transferMarket: [] as GameState['transferMarket'],
  shortlist: [] as string[],
  scoutWatchList: [] as string[],
  incomingOffers: [] as GameState['incomingOffers'],

  addToShortlist: (id: string) => set(s => ({ shortlist: [...s.shortlist, id] })),
  removeFromShortlist: (id: string) => set(s => ({ shortlist: s.shortlist.filter(x => x !== id) })),

  evaluateOffer: (playerId: string, fee: number) => {
    const state = get();
    const listing = state.transferMarket.find(l => l.playerId === playerId);
    if (!listing) return null;
    const player = state.players[playerId];
    if (!player) return null;
    const club = state.clubs[state.playerClubId];
    const ratio = fee / listing.askingPrice;
    const acceptChance = fee >= listing.askingPrice ? ACCEPT_CHANCE_AT_ASKING : fee >= listing.askingPrice * ACCEPT_80_PERCENT_THRESHOLD ? ACCEPT_CHANCE_AT_80_PERCENT : ACCEPT_CHANCE_BELOW;
    const wouldTriggerSellOn = fee >= SELL_ON_LOW_FEE_THRESHOLD;
    const sellOnPct = fee >= SELL_ON_HIGH_FEE_THRESHOLD ? SELL_ON_EVAL_HIGH_PCT : fee >= SELL_ON_LOW_FEE_THRESHOLD ? SELL_ON_EVAL_LOW_PCT : 0;
    const budgetAfter = club.budget - fee;
    const wageImpact = player.wage;
    const positionCount = club.playerIds.filter(id => state.players[id]?.position === player.position).length;
    const totalSquadSize = club.playerIds.length;
    return { acceptChance, wouldTriggerSellOn, sellOnPct, budgetAfter, wageImpact, ratio, positionCount, totalSquadSize };
  },

  makeOfferWithNegotiation: (playerId: string, fee: number): { outcome: 'accepted' | 'rejected' | 'counter'; counterFee?: number; message: string } => {
    const state = get();
    if (!state.transferWindowOpen) return { outcome: 'rejected', message: 'Transfer window is closed.' };
    const listing = state.transferMarket.find(l => l.playerId === playerId);
    if (!listing) return { outcome: 'rejected', message: 'Player not available.' };
    const club = state.clubs[state.playerClubId];
    if (fee > club.budget) return { outcome: 'rejected', message: 'Insufficient funds.' };

    // Transfer Shark perk: treat asking price as 15% lower for acceptance calculation
    const effectiveAskingPrice = hasPerk(state.managerProgression, 'transfer_shark') ? listing.askingPrice * (1 - TRANSFER_SHARK_DISCOUNT) : listing.askingPrice;
    const ratio = fee / effectiveAskingPrice;
    const acceptChance = fee >= effectiveAskingPrice ? ACCEPT_CHANCE_AT_ASKING : fee >= effectiveAskingPrice * ACCEPT_80_PERCENT_THRESHOLD ? ACCEPT_CHANCE_AT_80_PERCENT : ACCEPT_CHANCE_BELOW;
    const roll = Math.random();

    if (roll <= acceptChance) {
      // Accept — delegate to executeTransfer directly (skip the second random roll in makeOffer)
      const result = get().executeTransfer(playerId, fee);
      return { outcome: result.success ? 'accepted' : 'rejected', message: result.message };
    }

    // Check for counter-offer
    if (ratio >= COUNTER_OFFER_MIN_THRESHOLD && ratio < COUNTER_OFFER_MAX_THRESHOLD && Math.random() < COUNTER_OFFER_CHANCE) {
      const counterFee = Math.round(fee + (listing.askingPrice - fee) * (COUNTER_OFFER_BASE_RATIO + Math.random() * COUNTER_OFFER_RANDOM_RANGE));
      return { outcome: 'counter', counterFee, message: `${state.clubs[listing.sellerClubId]?.shortName || 'The club'} want more — they counter with £${(counterFee / 1e6).toFixed(1)}M.` };
    }

    return { outcome: 'rejected', message: 'Offer rejected. The selling club want a higher fee.' };
  },

  executeTransfer: (playerId: string, fee: number) => {
    const state = get();
    if (!state.transferWindowOpen) return { success: false, message: 'Transfer window is closed.' };
    const listing = state.transferMarket.find(l => l.playerId === playerId);
    if (!listing) return { success: false, message: 'Player not available.' };
    const club = state.clubs[state.playerClubId];
    if (fee > club.budget) return { success: false, message: 'Insufficient funds.' };

    const player = { ...state.players[playerId] };
    const oldClub = { ...state.clubs[listing.sellerClubId] };
    const newClub = { ...state.clubs[state.playerClubId] };

    oldClub.playerIds = oldClub.playerIds.filter(id => id !== playerId);
    oldClub.lineup = oldClub.lineup.filter(id => id !== playerId);
    oldClub.subs = oldClub.subs.filter(id => id !== playerId);
    oldClub.wageBill -= player.wage;

    // Honor existing sell-on clause: pay percentage to the previous club
    const updatedClubs = { ...state.clubs };
    let sellOnFee = 0;
    let sellOnClubName = '';
    if (player.sellOnPercentage && player.sellOnClubId && player.sellOnClubId !== listing.sellerClubId) {
      sellOnFee = Math.round(fee * (player.sellOnPercentage / 100));
      sellOnClubName = state.clubs[player.sellOnClubId]?.name || 'former club';
      const sellOnClub = { ...updatedClubs[player.sellOnClubId] };
      sellOnClub.budget += sellOnFee;
      updatedClubs[player.sellOnClubId] = sellOnClub;
    }
    oldClub.budget += fee - sellOnFee;

    // New sell-on clause: the selling club gets 10-20% on expensive transfers
    const sellOnPct = fee >= SELL_ON_HIGH_FEE_THRESHOLD ? SELL_ON_HIGH_BASE_PCT + Math.floor(Math.random() * SELL_ON_HIGH_RANGE_PCT) : fee >= SELL_ON_LOW_FEE_THRESHOLD ? SELL_ON_LOW_BASE_PCT + Math.floor(Math.random() * SELL_ON_LOW_RANGE_PCT) : 0;
    const updatedPlayer = {
      ...player,
      clubId: state.playerClubId,
      joinedSeason: state.season,
      listedForSale: false,
      sellOnPercentage: sellOnPct > 0 ? sellOnPct : undefined,
      sellOnClubId: sellOnPct > 0 ? listing.sellerClubId : undefined,
    };
    newClub.playerIds = [...newClub.playerIds, playerId];
    newClub.budget -= fee;
    newClub.wageBill += updatedPlayer.wage;

    const transferMarket = state.transferMarket.filter(l => l.playerId !== playerId);
    const sellOnNote = sellOnFee > 0 ? ` (£${(sellOnFee / 1e6).toFixed(1)}M sell-on fee paid to ${sellOnClubName})` : '';
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${updatedPlayer.lastName} Signed!`,
      body: `${updatedPlayer.firstName} ${updatedPlayer.lastName} has joined ${newClub.name} from ${oldClub.name} for £${(fee / 1e6).toFixed(1)}M.${sellOnNote}`,
    });

    const ms = { ...state.managerStats, totalSpent: state.managerStats.totalSpent + fee };
    // Record signing milestone if this is the most expensive signing ever
    const isRecordSigning = fee > ms.totalSpent * RECORD_SIGNING_SPEND_RATIO && fee >= RECORD_SIGNING_MIN_FEE;
    const newTimeline = isRecordSigning
      ? [...state.careerTimeline, { id: crypto.randomUUID(), type: 'record_signing' as const, title: 'Record Signing', description: `Signed ${updatedPlayer.firstName} ${updatedPlayer.lastName} for £${(fee / 1e6).toFixed(1)}M from ${oldClub.name}.`, season: state.season, week: state.week, icon: 'pen-line' }]
      : state.careerTimeline;
    updatedClubs[oldClub.id] = oldClub;
    updatedClubs[newClub.id] = newClub;
    // Trigger star signing buzz for big signings
    const merchUpdate: Partial<GameState> = {};
    if (player.value >= CAMPAIGN_STAR_SIGNING_MIN_VALUE) {
      merchUpdate.merchandise = { ...state.merchandise, starSigningBuzz: STAR_SIGNING_BUZZ_WEEKS };
    }
    set({
      players: { ...state.players, [playerId]: updatedPlayer },
      clubs: updatedClubs,
      transferMarket, messages: newMessages, managerStats: ms,
      careerTimeline: newTimeline,
      ...merchUpdate,
    });
    return { success: true, message: `${updatedPlayer.firstName} ${updatedPlayer.lastName} signed!${sellOnNote}` };
  },

  makeOffer: (playerId: string, fee: number) => {
    const state = get();
    if (!state.transferWindowOpen) return { success: false, message: 'Transfer window is closed.' };
    const listing = state.transferMarket.find(l => l.playerId === playerId);
    if (!listing) return { success: false, message: 'Player not available.' };
    const club = state.clubs[state.playerClubId];
    if (fee > club.budget) return { success: false, message: 'Insufficient funds.' };
    const effAsk = hasPerk(state.managerProgression, 'transfer_shark') ? listing.askingPrice * (1 - TRANSFER_SHARK_DISCOUNT) : listing.askingPrice;
    const acceptChance = fee >= effAsk ? ACCEPT_CHANCE_AT_ASKING : fee >= effAsk * ACCEPT_80_PERCENT_THRESHOLD ? ACCEPT_CHANCE_AT_80_PERCENT : ACCEPT_CHANCE_BELOW;
    if (Math.random() > acceptChance) return { success: false, message: 'Offer rejected. Try a higher fee.' };
    return get().executeTransfer(playerId, fee);
  },

  listPlayerForSale: (playerId: string) => {
    const state = get();
    const player = state.players[playerId];
    if (!player || player.clubId !== state.playerClubId) return;
    const newPlayers = { ...state.players, [playerId]: { ...player, listedForSale: true } };
    const askingPrice = Math.max(50_000, Math.round(player.value * LIST_PRICE_MULTIPLIER));
    const newMarket = [...state.transferMarket, { playerId, askingPrice, sellerClubId: state.playerClubId }];
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

    // When rejecting, only remove this offer; when accepting, remove ALL offers for same player
    const newOffers = state.incomingOffers.filter(o => o.id !== offerId);

    if (!accept) {
      const msg = addMsg(state.messages, { week: state.week, season: state.season, type: 'transfer', title: `Bid Rejected`, body: `You rejected ${buyerClub.name}'s £${(offer.fee / 1e6).toFixed(1)}M bid for ${player.lastName}.` });
      set({ incomingOffers: newOffers, messages: msg });
      return { success: true, message: 'Offer rejected.' };
    }

    // Prevent selling if squad would drop below minimum
    const sellerClubData = state.clubs[state.playerClubId];
    if (sellerClubData && sellerClubData.playerIds.length <= MIN_SQUAD_SIZE) {
      return { success: false, message: `Cannot sell — squad would drop below minimum size (${MIN_SQUAD_SIZE}).` };
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

    buyer.playerIds = [...buyer.playerIds, offer.playerId];
    buyer.budget -= offer.fee;
    buyer.wageBill += player.wage;

    newPlayers[offer.playerId] = { ...player, clubId: offer.buyerClubId, listedForSale: false, sellOnPercentage: undefined, sellOnClubId: undefined };

    const newMarket = state.transferMarket.filter(l => l.playerId !== offer.playerId);
    const sellOnNote = sellOnFee > 0 ? ` (£${(sellOnFee / 1e6).toFixed(1)}M sell-on fee paid to ${(player.sellOnClubId && state.clubs[player.sellOnClubId]?.name) || 'former club'})` : '';
    const msg = addMsg(state.messages, { week: state.week, season: state.season, type: 'transfer', title: `${player.lastName} Sold!`, body: `${player.firstName} ${player.lastName} has been sold to ${buyerClub.name} for £${(offer.fee / 1e6).toFixed(1)}M.${sellOnNote}` });

    updatedClubs[sellerClub.id] = sellerClub;
    updatedClubs[buyer.id] = buyer;
    const ms = { ...state.managerStats, totalEarned: state.managerStats.totalEarned + netFee };

    // Check for farewell
    const farewell = getFarewellSummary(player, state.season, player.joinedSeason);
    const farewellEntry = farewell.shouldShow
      ? { playerId: offer.playerId, playerName: `${player.firstName} ${player.lastName}`, seasonsServed: farewell.seasonsServed, stats: farewell.stats }
      : null;

    // Check if the sold player was a top marketable player — trigger merch dip
    const starPlayers = getStarPlayerMerch(sellerClub, state.players);
    const wasStar = starPlayers.some(sp => sp.playerId === offer.playerId);
    const merchDipUpdate: Partial<GameState> = {};
    if (wasStar) {
      merchDipUpdate.merchandise = { ...state.merchandise, starPlayerDip: STAR_PLAYER_SALE_DIP_WEEKS };
    }
    set({
      players: newPlayers,
      clubs: updatedClubs,
      transferMarket: newMarket, incomingOffers: newOffers.filter(o => o.playerId !== offer.playerId), incomingLoanOffers: state.incomingLoanOffers.filter(o => o.playerId !== offer.playerId), messages: msg, managerStats: ms,
      ...(farewellEntry ? { pendingFarewell: [...state.pendingFarewell, farewellEntry] } : {}),
      ...merchDipUpdate,
    });
    return { success: true, message: `${player.firstName} ${player.lastName} sold for £${(offer.fee / 1e6).toFixed(1)}M!${sellOnNote}` };
  },

  signFreeAgent: (playerId: string, wage: number, years: number) => {
    const state = get();
    if (!state.freeAgents.includes(playerId)) return { success: false, message: 'Player is not a free agent.' };
    const player = state.players[playerId];
    if (!player) return { success: false, message: 'Player not found.' };
    const club = { ...state.clubs[state.playerClubId] };
    // Signing bonus: 4 weeks of wages per year
    const signingBonus = Math.round(wage * years * SIGNING_BONUS_WEEKS_PER_YEAR);
    if (club.budget < signingBonus) return { success: false, message: `Insufficient funds for signing bonus (£${(signingBonus / 1e6).toFixed(1)}M).` };

    club.budget -= signingBonus;
    club.playerIds = [...club.playerIds, playerId];
    club.wageBill += wage;

    const updatedPlayer = { ...player, clubId: state.playerClubId, wage, contractEnd: state.season + years, joinedSeason: state.season, listedForSale: false };
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Signed (Free)`,
      body: `${player.firstName} ${player.lastName} has joined on a free transfer. ${years}-year contract at £${(wage / 1000).toFixed(0)}K/week.`,
    });

    set({
      players: { ...state.players, [playerId]: updatedPlayer },
      clubs: { ...state.clubs, [club.id]: club },
      freeAgents: state.freeAgents.filter(id => id !== playerId),
      messages: newMessages,
    });
    return { success: true, message: `${player.firstName} ${player.lastName} signed on a free transfer!` };
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
