import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import { getFarewellSummary } from '@/utils/playerNarratives';
import { GROWTH_NEGOTIATION_PER_TRANSFER as CAREER_NEGOTIATION_GROWTH, STAT_MAX as CAREER_STAT_MAX } from '@/config/managerCareer';
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
  LISTING_PRICE_FLOOR,
  INCOMING_NEGOTIATE_ACCEPT_AT_OFFER, INCOMING_NEGOTIATE_ACCEPT_AT_120, INCOMING_NEGOTIATE_ACCEPT_AT_MAX,
  INCOMING_NEGOTIATE_COUNTER_CHANCE, INCOMING_NEGOTIATE_COUNTER_BASE, INCOMING_NEGOTIATE_COUNTER_RANGE,
} from '@/config/transfers';
import { MIN_SQUAD_SIZE, APPEASE_BASE_CHANCE, APPEASE_MORALE_BOOST } from '@/config/gameBalance';
import { hasPerk } from '@/utils/managerPerks';
import { STAR_SIGNING_BUZZ_WEEKS, STAR_PLAYER_SALE_DIP_WEEKS, CAMPAIGN_STAR_SIGNING_MIN_VALUE } from '@/config/merchandise';
import { getStarPlayerMerch } from '@/utils/merchandise';
import { CHALLENGES } from '@/data/challenges';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

/** Check if an active challenge blocks this transfer. Returns error message or null if allowed. */
const checkChallengeBlock = (state: GameState, playerAge?: number): string | null => {
  if (!state.activeChallenge || state.activeChallenge.completed || state.activeChallenge.failed) return null;
  const scenario = CHALLENGES.find(c => c.id === state.activeChallenge!.scenarioId);
  if (!scenario) return null;
  if (scenario.noTransfers) return 'Transfers are disabled in this challenge.';
  if (scenario.youthOnly && playerAge != null && playerAge > 23) return 'Challenge restricts signings to players aged 23 or under.';
  return null;
};

/** Interpolate acceptance chance for incoming offer negotiation based on counter/offer ratio. */
const getIncomingAcceptChance = (ratio: number): number => {
  if (ratio <= 1.0) return INCOMING_NEGOTIATE_ACCEPT_AT_OFFER;
  if (ratio <= 1.2) return INCOMING_NEGOTIATE_ACCEPT_AT_OFFER - (ratio - 1.0) / 0.2 * (INCOMING_NEGOTIATE_ACCEPT_AT_OFFER - INCOMING_NEGOTIATE_ACCEPT_AT_120);
  return INCOMING_NEGOTIATE_ACCEPT_AT_120 - (ratio - 1.2) / 0.3 * (INCOMING_NEGOTIATE_ACCEPT_AT_120 - INCOMING_NEGOTIATE_ACCEPT_AT_MAX);
};

/** Shared sale execution for incoming offers — used by respondToOffer and negotiateIncomingOffer. */
const executeSale = (state: GameState, offer: { id: string; playerId: string; buyerClubId: string; fee: number }, fee: number, set: Set): { success: boolean; message: string } => {
  const player = state.players[offer.playerId];
  const buyerClub = state.clubs[offer.buyerClubId];
  if (!player || !buyerClub) return { success: false, message: 'Invalid offer.' };

  const newPlayers = { ...state.players };
  const sellerClub = { ...state.clubs[state.playerClubId] };
  const buyer = { ...state.clubs[offer.buyerClubId] };

  sellerClub.playerIds = sellerClub.playerIds.filter(id => id !== offer.playerId);
  sellerClub.lineup = sellerClub.lineup.filter(id => id !== offer.playerId);
  sellerClub.subs = sellerClub.subs.filter(id => id !== offer.playerId);
  // Sell-on clause: pay percentage to previous club if applicable
  let sellOnFee = 0;
  const updatedClubs = { ...state.clubs };
  if (player.sellOnPercentage && player.sellOnClubId && player.sellOnClubId !== state.playerClubId && updatedClubs[player.sellOnClubId]) {
    sellOnFee = Math.round(fee * (player.sellOnPercentage / 100));
    const sellOnClub = { ...updatedClubs[player.sellOnClubId] };
    sellOnClub.budget += sellOnFee;
    updatedClubs[player.sellOnClubId] = sellOnClub;
  }
  const netFee = fee - sellOnFee;
  sellerClub.budget += netFee;
  sellerClub.wageBill -= player.wage;

  buyer.playerIds = [...buyer.playerIds, offer.playerId];
  buyer.budget -= fee;
  buyer.wageBill += player.wage;

  newPlayers[offer.playerId] = { ...player, clubId: offer.buyerClubId, listedForSale: false, sellOnPercentage: undefined, sellOnClubId: undefined };

  const newMarket = state.transferMarket.filter(l => l.playerId !== offer.playerId);
  const wasInLineup = state.clubs[state.playerClubId].lineup.includes(offer.playerId);
  const sellOnNote = sellOnFee > 0 ? ` (£${(sellOnFee / 1e6).toFixed(1)}M sell-on fee paid to ${(player.sellOnClubId && state.clubs[player.sellOnClubId]?.name) || 'former club'})` : '';
  const lineupNote = wasInLineup ? ' Check your lineup — you now have a gap in your starting XI.' : '';
  const msg = addMsg(state.messages, { week: state.week, season: state.season, type: 'transfer', title: `${player.lastName} Sold!`, body: `${player.firstName} ${player.lastName} has been sold to ${buyerClub.name} for £${(fee / 1e6).toFixed(1)}M.${sellOnNote}${lineupNote}` });

  updatedClubs[sellerClub.id] = sellerClub;
  updatedClubs[buyer.id] = buyer;
  const ms = { ...state.managerStats, totalEarned: state.managerStats.totalEarned + netFee };

  // Check for farewell
  const farewell = getFarewellSummary(player, state.season, player.joinedSeason);
  const farewellEntry = farewell.shouldShow
    ? { playerId: offer.playerId, playerName: `${player.firstName} ${player.lastName}`, seasonsServed: farewell.seasonsServed, stats: farewell.stats }
    : null;

  // Check if the sold player was a top marketable player — trigger/extend merch dip
  const starPlayers = getStarPlayerMerch(sellerClub, state.players);
  const wasStar = starPlayers.some(sp => sp.playerId === offer.playerId);
  const merchDipUpdate: Partial<GameState> = {};
  if (wasStar) {
    const currentDip = state.merchandise?.starPlayerDip || 0;
    merchDipUpdate.merchandise = { ...state.merchandise, starPlayerDip: Math.max(currentDip, STAR_PLAYER_SALE_DIP_WEEKS) };
  }
  // Clean up any active loans involving the sold player
  const cleanedLoans = state.activeLoans.filter(l => l.playerId !== offer.playerId);
  // Remove this offer + all offers for same player
  const cleanedOffers = state.incomingOffers.filter(o => o.playerId !== offer.playerId);

  // Clean up shortlist and scout watch list for the sold player
  const cleanedShortlist = state.shortlist.filter(id => id !== offer.playerId);
  const cleanedWatchList = state.scoutWatchList.filter(id => id !== offer.playerId);

  set({
    players: newPlayers,
    clubs: updatedClubs,
    transferMarket: newMarket, incomingOffers: cleanedOffers, incomingLoanOffers: state.incomingLoanOffers.filter(o => o.playerId !== offer.playerId), activeLoans: cleanedLoans, messages: msg, managerStats: ms,
    shortlist: cleanedShortlist, scoutWatchList: cleanedWatchList,
    ...(farewellEntry ? { pendingFarewell: [...state.pendingFarewell, farewellEntry] } : {}),
    ...merchDipUpdate,
  });
  return { success: true, message: `${player.firstName} ${player.lastName} sold for £${(fee / 1e6).toFixed(1)}M!${sellOnNote}` };
};

export const createTransferSlice = (set: Set, get: Get) => ({
  transferMarket: [] as GameState['transferMarket'],
  shortlist: [] as string[],
  scoutWatchList: [] as string[],
  incomingOffers: [] as GameState['incomingOffers'],

  addToShortlist: (id: string) => set(s => ({ shortlist: s.shortlist.includes(id) ? s.shortlist : [...s.shortlist, id] })),
  removeFromShortlist: (id: string) => set(s => ({ shortlist: s.shortlist.filter(x => x !== id) })),

  evaluateOffer: (playerId: string, fee: number) => {
    const state = get();
    const listing = state.transferMarket.find(l => l.playerId === playerId);
    if (!listing) return null;
    const player = state.players[playerId];
    if (!player) return null;
    const club = state.clubs[state.playerClubId];
    if (!club) return null;
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
    const challengeBlock = checkChallengeBlock(state, state.players[playerId]?.age);
    if (challengeBlock) return { outcome: 'rejected', message: challengeBlock };
    const listing = state.transferMarket.find(l => l.playerId === playerId);
    if (!state.transferWindowOpen && !listing?.scoutedPlayer) return { outcome: 'rejected', message: 'Transfer window is closed.' };
    if (!listing) return { outcome: 'rejected', message: 'Player not available.' };
    const club = state.clubs[state.playerClubId];
    if (fee > club.budget) return { outcome: 'rejected', message: 'Insufficient funds.' };

    // Release clause: if fee meets or exceeds it, auto-accept
    const player = state.players[playerId];
    if (player?.releaseClause && fee >= player.releaseClause) {
      const result = get().executeTransfer(playerId, fee);
      return { outcome: result.success ? 'accepted' : 'rejected', message: result.success ? `Release clause triggered — ${player.name} joins for £${(fee / 1e6).toFixed(1)}M!` : result.message };
    }

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
    const challengeBlock = checkChallengeBlock(state, state.players[playerId]?.age);
    if (challengeBlock) return { success: false, message: challengeBlock };
    const listing = state.transferMarket.find(l => l.playerId === playerId);
    if (!state.transferWindowOpen && !listing?.scoutedPlayer) return { success: false, message: 'Transfer window is closed.' };
    if (!listing) return { success: false, message: 'Player not available.' };
    const club = state.clubs[state.playerClubId];
    if (fee > club.budget) return { success: false, message: 'Insufficient funds.' };

    const player = { ...state.players[playerId] };
    const oldClub = { ...state.clubs[listing.sellerClubId] };
    const newClub = { ...state.clubs[state.playerClubId] };

    // Only modify old club roster if the player is actually on it (scouted players may not be)
    const playerInOldClub = oldClub.playerIds?.includes(playerId);
    if (playerInOldClub) {
      oldClub.playerIds = oldClub.playerIds.filter(id => id !== playerId);
      oldClub.lineup = oldClub.lineup.filter(id => id !== playerId);
      oldClub.subs = oldClub.subs.filter(id => id !== playerId);
      oldClub.wageBill -= player.wage;
    }

    // Honor existing sell-on clause: pay percentage to the previous club
    const updatedClubs = { ...state.clubs };
    let sellOnFee = 0;
    let sellOnClubName = '';
    if (player.sellOnPercentage && player.sellOnClubId && player.sellOnClubId !== listing.sellerClubId && updatedClubs[player.sellOnClubId]) {
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
    newClub.budget = Math.max(0, newClub.budget - fee);
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
    const isRecordSigning = fee > state.managerStats.totalSpent * RECORD_SIGNING_SPEND_RATIO && fee >= RECORD_SIGNING_MIN_FEE;
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
      shortlist: state.shortlist.filter(id => id !== playerId),
      scoutWatchList: state.scoutWatchList.filter(id => id !== playerId),
      ...merchUpdate,
    });
    // Career mode: grow negotiation stat on successful transfer
    const postState = get();
    if (postState.gameMode === 'career' && postState.careerManager) {
      const cm = { ...postState.careerManager, attributes: { ...postState.careerManager.attributes } };
      cm.attributes.negotiation = Math.min(CAREER_STAT_MAX, cm.attributes.negotiation + CAREER_NEGOTIATION_GROWTH);
      set({ careerManager: cm });
    }
    return { success: true, message: `${updatedPlayer.firstName} ${updatedPlayer.lastName} signed!${sellOnNote}` };
  },

  makeOffer: (playerId: string, fee: number) => {
    const state = get();
    const challengeBlock = checkChallengeBlock(state, state.players[playerId]?.age);
    if (challengeBlock) return { success: false, message: challengeBlock };
    const listing = state.transferMarket.find(l => l.playerId === playerId);
    if (!state.transferWindowOpen && !listing?.scoutedPlayer) return { success: false, message: 'Transfer window is closed.' };
    if (!listing) return { success: false, message: 'Player not available.' };
    const club = state.clubs[state.playerClubId];
    if (fee > club.budget) return { success: false, message: 'Insufficient funds.' };
    const careerFeeDiscount = (state.gameMode === 'career' && state.careerManager) ? state.careerManager.attributes.negotiation * 0.005 : 0;
    const effAsk = (hasPerk(state.managerProgression, 'transfer_shark') ? listing.askingPrice * (1 - TRANSFER_SHARK_DISCOUNT) : listing.askingPrice) * (1 - careerFeeDiscount);
    const acceptChance = fee >= effAsk ? ACCEPT_CHANCE_AT_ASKING : fee >= effAsk * ACCEPT_80_PERCENT_THRESHOLD ? ACCEPT_CHANCE_AT_80_PERCENT : ACCEPT_CHANCE_BELOW;
    if (Math.random() > acceptChance) return { success: false, message: 'Offer rejected. Try a higher fee.' };
    return get().executeTransfer(playerId, fee);
  },

  listPlayerForSale: (playerId: string) => {
    const state = get();
    const player = state.players[playerId];
    if (!player || player.clubId !== state.playerClubId) return { appeased: false };
    const updatedPlayer = { ...player, listedForSale: true };
    let appeased = false;

    // Rare appease mechanic: unhappy player feels respected when you agree to let them go
    if (player.wantsToLeave && player.morale < 50) {
      const loyaltyBonus = (player.personality?.loyalty || 10) / 20; // higher loyalty = more grateful
      const appeaseChance = APPEASE_BASE_CHANCE + loyaltyBonus * 0.08;
      if (Math.random() < appeaseChance) {
        updatedPlayer.morale = Math.min(100, updatedPlayer.morale + APPEASE_MORALE_BOOST);
        updatedPlayer.wantsToLeave = false;
        updatedPlayer.lowMoraleWeeks = 0;
        appeased = true;
      }
    }

    const newPlayers = { ...state.players, [playerId]: updatedPlayer };
    const askingPrice = Math.max(LISTING_PRICE_FLOOR, Math.round(player.value * LIST_PRICE_MULTIPLIER));
    const newMarket = [...state.transferMarket, { playerId, askingPrice, sellerClubId: state.playerClubId }];
    let newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'transfer',
      title: `${player.lastName} Listed`,
      body: `${player.firstName} ${player.lastName} has been listed for sale at £${(askingPrice / 1e6).toFixed(1)}M.`,
    });
    if (appeased) {
      newMessages = addMsg(newMessages, {
        week: state.week, season: state.season, type: 'general',
        title: `${player.lastName} Appreciates Honesty`,
        body: `${player.firstName} ${player.lastName} feels respected by your willingness to let them move on. Their morale has improved and they've withdrawn the transfer request.`,
      });
    }
    set({ players: newPlayers, transferMarket: newMarket, messages: newMessages });
    return { appeased };
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

    // Validate buyer can afford the transfer
    const buyerData = state.clubs[offer.buyerClubId];
    if (buyerData && buyerData.budget < offer.fee) {
      const msg = addMsg(state.messages, { week: state.week, season: state.season, type: 'transfer', title: 'Bid Withdrawn', body: `${buyerData.name} can no longer afford their £${(offer.fee / 1e6).toFixed(1)}M bid for ${player.lastName}.` });
      set({ incomingOffers: newOffers, messages: msg });
      return { success: false, message: `${buyerData.name} can no longer afford the transfer fee.` };
    }

    return executeSale(state, offer, offer.fee, set);
  },

  negotiateIncomingOffer: (offerId: string, counterFee: number) => {
    const state = get();
    const offer = state.incomingOffers.find(o => o.id === offerId);
    if (!offer) return { outcome: 'rejected' as const, message: 'Offer not found.' };

    const player = state.players[offer.playerId];
    const buyerClub = state.clubs[offer.buyerClubId];
    if (!player || !buyerClub) return { outcome: 'rejected' as const, message: 'Invalid offer.' };

    // Prevent selling if squad would drop below minimum
    const sellerClubData = state.clubs[state.playerClubId];
    if (sellerClubData && sellerClubData.playerIds.length <= MIN_SQUAD_SIZE) {
      return { outcome: 'rejected' as const, message: `Cannot sell — squad would drop below minimum size (${MIN_SQUAD_SIZE}).` };
    }

    // Validate buyer can afford the counter fee
    if (buyerClub.budget < counterFee) {
      return { outcome: 'rejected' as const, message: `${buyerClub.name} cannot afford £${(counterFee / 1e6).toFixed(1)}M.` };
    }

    // Acceptance curve: ratio of counter to original offer
    const ratio = counterFee / offer.fee;
    const acceptChance = getIncomingAcceptChance(ratio);
    const roll = Math.random();

    if (roll <= acceptChance) {
      const result = executeSale(state, offer, counterFee, set);
      return { outcome: result.success ? 'accepted' as const : 'rejected' as const, message: result.message };
    }

    // Check for buyer counter-offer
    if (ratio <= 1.4 && Math.random() < INCOMING_NEGOTIATE_COUNTER_CHANCE) {
      const buyerCounterFee = Math.round(offer.fee + (counterFee - offer.fee) * (INCOMING_NEGOTIATE_COUNTER_BASE + Math.random() * INCOMING_NEGOTIATE_COUNTER_RANGE));
      return { outcome: 'counter' as const, counterFee: buyerCounterFee, message: `${buyerClub.shortName || buyerClub.name} revised their offer to £${(buyerCounterFee / 1e6).toFixed(1)}M.` };
    }

    return { outcome: 'rejected' as const, message: `${buyerClub.shortName || buyerClub.name} rejected your counter-offer. They won't pay that much.` };
  },

  acceptIncomingOfferAtFee: (offerId: string, fee: number) => {
    const state = get();
    const offer = state.incomingOffers.find(o => o.id === offerId);
    if (!offer) return { success: false, message: 'Offer not found.' };
    const player = state.players[offer.playerId];
    const buyerClub = state.clubs[offer.buyerClubId];
    if (!player || !buyerClub) return { success: false, message: 'Invalid offer.' };
    const sellerClubData = state.clubs[state.playerClubId];
    if (sellerClubData && sellerClubData.playerIds.length <= MIN_SQUAD_SIZE) {
      return { success: false, message: `Cannot sell — squad would drop below minimum size (${MIN_SQUAD_SIZE}).` };
    }
    if (buyerClub.budget < fee) {
      return { success: false, message: `${buyerClub.name} cannot afford £${(fee / 1e6).toFixed(1)}M.` };
    }
    return executeSale(state, offer, fee, set);
  },

  evaluateIncomingCounter: (offerId: string, counterFee: number) => {
    const state = get();
    const offer = state.incomingOffers.find(o => o.id === offerId);
    if (!offer) return null;
    const player = state.players[offer.playerId];
    if (!player) return null;
    const club = state.clubs[state.playerClubId];
    if (!club) return null;

    const ratio = counterFee / offer.fee;
    const acceptChance = getIncomingAcceptChance(ratio);
    const budgetAfter = club.budget + counterFee;
    const squadSizeAfter = club.playerIds.length - 1;
    const positionCountAfter = club.playerIds.filter(id => state.players[id]?.position === player.position).length - 1;
    return { acceptChance, budgetAfter, squadSizeAfter, positionCountAfter };
  },

  signFreeAgent: (playerId: string, wage: number, years: number) => {
    const state = get();
    // Challenge constraints: noTransfers blocks paid signings but allows free agents for penny-pincher
    const challenge = state.activeChallenge && !state.activeChallenge.completed && !state.activeChallenge.failed
      ? CHALLENGES.find(c => c.id === state.activeChallenge!.scenarioId) : null;
    if (challenge?.youthOnly) {
      const p = state.players[playerId];
      if (p && p.age > 23) return { success: false, message: 'Challenge restricts signings to players aged 23 or under.' };
    }
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
      shortlist: state.shortlist.filter(id => id !== playerId),
      scoutWatchList: state.scoutWatchList.filter(id => id !== playerId),
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
