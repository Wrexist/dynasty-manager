/**
 * Merchandise Strategy Slice
 * Manages product line toggles, pricing strategy, and campaign launches.
 */

import type { GameState } from '../storeTypes';
import type { MerchProductLine, MerchPricingTier, MerchCampaignType, MerchSignatureDrop } from '@/types/game';
import { addMsg } from '@/utils/helpers';
import {
  isProductLineUnlocked, canLaunchCampaign, getDefaultMerchState, getSignatureDropBonus,
  getSignatureDropRevenueDelta, getPlayerMarketability,
} from '@/utils/merchandise';
import {
  MERCH_PRODUCT_LINES, MERCH_CAMPAIGNS, MERCH_CAMPAIGN_COOLDOWN_WEEKS,
  SIGNATURE_DROP_COST, SIGNATURE_DROP_WEEKS, SIGNATURE_DROP_COOLDOWN_WEEKS,
} from '@/config/merchandise';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createMerchandiseSlice = (set: Set, get: Get) => ({
  merchandise: getDefaultMerchState(),

  toggleProductLine: (line: MerchProductLine) => {
    const state = get();
    const merch = state.merchandise;
    const club = state.clubs[state.playerClubId];
    if (!club) return { success: false, message: 'No club found.' };

    const isActive = merch.activeProductLines.includes(line);
    if (isActive) {
      // Deactivate
      set({
        merchandise: {
          ...merch,
          activeProductLines: merch.activeProductLines.filter(l => l !== line),
        },
      });
      return { success: true, message: `${MERCH_PRODUCT_LINES[line].label} deactivated.` };
    }

    // Activate — check unlock requirements
    if (!isProductLineUnlocked(line, club, state.playerDivision, state.facilities)) {
      return { success: false, message: `${MERCH_PRODUCT_LINES[line].label} is locked. Check requirements.` };
    }

    set({
      merchandise: {
        ...merch,
        activeProductLines: [...merch.activeProductLines, line],
      },
    });
    return { success: true, message: `${MERCH_PRODUCT_LINES[line].label} activated!` };
  },

  setMerchPricing: (tier: MerchPricingTier) => {
    const state = get();
    set({
      merchandise: { ...state.merchandise, pricingTier: tier },
    });
  },

  launchCampaign: (type: MerchCampaignType) => {
    const state = get();
    const club = state.clubs[state.playerClubId];
    if (!club) return { success: false, message: 'No club found.' };

    const playerTableIdx = state.leagueTable.findIndex(e => e.clubId === state.playerClubId);
    const leaguePosition = playerTableIdx >= 0 ? playerTableIdx + 1 : state.leagueTable.length;

    const check = canLaunchCampaign(type, {
      merch: state.merchandise,
      budget: club.budget,
      week: state.week,
      leaguePosition,
      cupEliminated: state.cup.eliminated,
      cupCurrentRound: state.cup.currentRound,
      hasRecentBigSigning: state.merchandise.starSigningBuzz > 0,
      kitLaunchUsedThisSeason: state.merchandise.kitLaunchUsedThisSeason ?? false,
      // Season length drives the End of Season Sale window — without it the
      // campaign is unreachable in every league shorter than 38 weeks.
      totalWeeks: state.totalWeeks,
    });

    if (!check.eligible) return { success: false, message: check.reason || 'Cannot launch campaign.' };

    const def = MERCH_CAMPAIGNS[type];
    const newClub = { ...club, budget: club.budget - def.setupCost };
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: `Campaign Launched: ${def.label}`,
      body: `Your ${def.label} campaign is now live! Expect a ${Math.round(def.revenueBoost * 100)}% merchandise revenue boost for ${def.durationWeeks} weeks. Setup cost: £${(def.setupCost / 1e6).toFixed(1)}M.`,
    });

    set({
      merchandise: {
        ...state.merchandise,
        activeCampaign: {
          type,
          weeksRemaining: def.durationWeeks,
          totalWeeks: def.durationWeeks,
          revenueBoost: def.revenueBoost,
        },
        ...(type === 'kit_launch' ? { kitLaunchUsedThisSeason: true } : {}),
      },
      clubs: { ...state.clubs, [state.playerClubId]: newClub },
      messages: newMessages,
    });
    return { success: true, message: `${def.label} campaign launched!` };
  },

  cancelCampaign: () => {
    const state = get();
    if (!state.merchandise.activeCampaign) return;
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: 'Campaign Cancelled',
      body: 'The active merchandise campaign has been cancelled. No refund on setup costs.',
    });
    set({
      merchandise: {
        ...state.merchandise,
        activeCampaign: null,
        campaignCooldownWeeks: MERCH_CAMPAIGN_COOLDOWN_WEEKS,
      },
      messages: newMessages,
    });
  },

  launchSignatureDrop: (playerId: string) => {
    const state = get();
    const club = state.clubs[state.playerClubId];
    if (!club) return { success: false, message: 'No club found.' };
    const merch = state.merchandise;
    if (merch.signatureDrop && merch.signatureDrop.weeksRemaining > 0) {
      return { success: false, message: 'A signature drop is already running.' };
    }
    if ((merch.signatureDropCooldownWeeks ?? 0) > 0) {
      return { success: false, message: `Cooldown: ${merch.signatureDropCooldownWeeks}w remaining.` };
    }
    const used = merch.signatureDropsUsedThisSeason ?? [];
    if (used.includes(playerId)) {
      return { success: false, message: 'This player already had a drop this season.' };
    }
    const player = state.players[playerId];
    if (!player) return { success: false, message: 'Player not found.' };
    if (getPlayerMarketability(player) <= 0) {
      return { success: false, message: 'Player needs more match action to be marketable.' };
    }
    if (club.budget < SIGNATURE_DROP_COST) {
      return { success: false, message: `Need £${Math.round(SIGNATURE_DROP_COST / 1000)}K to launch.` };
    }
    const weeklyBonus = getSignatureDropBonus(player);
    // The stored `weeklyBonus` is a revenue-BASE addend — it still flows through
    // the league tier scale, active product lines, pricing and campaigns. Quote
    // the real delta so the message can't promise money the drop won't produce
    // (with only one product line active a drop can be a net loss).
    const effectiveWeekly = getSignatureDropRevenueDelta(
      merch, club, state.players, state.playerDivision, state.managerProgression, player,
    );
    const drop: MerchSignatureDrop = {
      playerId,
      playerName: `${player.firstName} ${player.lastName}`,
      weeksRemaining: SIGNATURE_DROP_WEEKS,
      totalWeeks: SIGNATURE_DROP_WEEKS,
      weeklyBonus,
    };
    const newClub = { ...club, budget: club.budget - SIGNATURE_DROP_COST };
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: `Signature Drop: ${player.firstName} ${player.lastName}`,
      body: `Limited-edition kit and merch line dropped. Expect ~£${Math.round(effectiveWeekly / 1000)}K extra revenue per week for ${SIGNATURE_DROP_WEEKS} weeks. Activate more product lines to sell more of it.`,
    });
    set({
      merchandise: {
        ...merch,
        signatureDrop: drop,
        signatureDropsUsedThisSeason: [...used, playerId],
      },
      clubs: { ...state.clubs, [state.playerClubId]: newClub },
      messages: newMessages,
    });
    return { success: true, message: `${player.firstName}'s signature drop is live.` };
  },

  cancelSignatureDrop: () => {
    const state = get();
    if (!state.merchandise.signatureDrop) return;
    set({
      merchandise: {
        ...state.merchandise,
        signatureDrop: null,
        signatureDropCooldownWeeks: SIGNATURE_DROP_COOLDOWN_WEEKS,
      },
    });
  },
});
