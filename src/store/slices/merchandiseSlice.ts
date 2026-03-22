/**
 * Merchandise Strategy Slice
 * Manages product line toggles, pricing strategy, and campaign launches.
 */

import type { GameState } from '../storeTypes';
import type { MerchProductLine, MerchPricingTier, MerchCampaignType } from '@/types/game';
import { addMsg } from '@/utils/helpers';
import { isProductLineUnlocked, canLaunchCampaign, getDefaultMerchState } from '@/utils/merchandise';
import { MERCH_PRODUCT_LINES, MERCH_CAMPAIGNS, MERCH_CAMPAIGN_COOLDOWN_WEEKS } from '@/config/merchandise';

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
});
