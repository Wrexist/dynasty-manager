import type { PressConference, ContractOffer, ActiveChallenge, StorylineEvent, ActiveStorylineChain, ManagerProgression, CliffhangerItem, MatchDramaType, SessionStats, TransferTalk, PlayerPromise, PlayerPromiseType } from '@/types/game';
import { makePlayerPromise } from '@/utils/playerPromises';
import { PROMISE_WAGE_REDUCTION } from '@/config/gameBalance';
import { MOD_MEDIA_PRESS, MOD_MOTIVATION_MORALE, GROWTH_MEDIA_PER_CONFERENCE, STAT_MAX } from '@/config/managerCareer';
import { TRANSFER_TALK_EMPATHIZE_MORALE_BOOST, TRANSFER_TALK_CONVINCE_SUCCESS_MORALE, TRANSFER_TALK_CONVINCE_FAIL_MORALE, COACH_TASK_XP, COACH_ALL_TASKS_BONUS_XP, ONBOARDING_COMPLETION_XP, TOTAL_WEEKS } from '@/config/gameBalance';
import { getFlag, setFlag, STORAGE_KEYS, readDailyStreak, writeDailyStreak, writeLiveEventProgress, readRedeemedCodes, addRedeemedCode } from '@/store/helpers/persistence';
import { applyDailyClaim } from '@/utils/dailyStreak';
import { verifyRedeemCode, getRedeemSecret } from '@/utils/redeemCodes';
import { getActiveLiveEvent, readActiveFestivalProgress, canCheckInToday, applyCheckIn, applyTierClaim } from '@/utils/liveEvents';
import { track } from '@/utils/analytics';
import { TRANSFER_DEMAND_COOLDOWN_WEEKS, TRANSFER_TALK_RETRY_WEEKS } from '@/config/personality';
import { grantXP, hasPerk, branchMult } from '@/utils/managerPerks';
import { objectiveClaimXP } from '@/utils/weeklyObjectives';
import { claimSeasonPassTier as applySeasonPassClaim } from '@/utils/seasonPass';
import type { GameState } from '../storeTypes';
import { addMsg, clamp, safeRandomUUID } from '@/utils/helpers';
import { createContractOffer, negotiateRound, formatWage } from '@/utils/contracts';
import { CONTRACT_MAX_STRIKES, CONTRACT_STRIKE_COOLDOWN_WEEKS, CONTRACT_ICON_STATUS_BONUS } from '@/config/contracts';
import { CHALLENGES } from '@/data/challenges';
import { createEmptyRecords } from '@/utils/records';
import { buildTransferTalk } from '@/utils/transferTalk';
import { getFarewellSummary } from '@/utils/playerNarratives';
import { getStarPlayerMerch } from '@/utils/merchandise';
import { guardAsync } from '@/utils/asyncGuard';
import { STAR_PLAYER_SALE_DIP_WEEKS } from '@/config/merchandise';
import { placePlayerInClub } from '../helpers/rosterOps';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createFeatureSlice = (set: Set, get: Get) => ({
  // Default state
  pendingPressConference: null as PressConference | null,
  fanMood: 50,
  activeNegotiation: null as ContractOffer | null,
  promises: [] as PlayerPromise[],
  activeChallenge: null as ActiveChallenge | null,
  weeklyObjectives: [] as import('@/utils/weeklyObjectives').ObjectiveInstance[],
  seasonPass: { points: 0, claimedTiers: [] as number[] },
  pendingStoryline: null as StorylineEvent | null,
  pendingGemReveal: null as { playerId: string; region: string } | null,
  pendingYouthIntake: null as { players: string[]; season: number } | null,
  pendingTransferTalk: null as TransferTalk | null,
  activeStorylineChains: [] as ActiveStorylineChain[],
  completedStorylineChainIds: [] as string[],
  freeAgents: [] as string[],
  unlockedAchievements: [] as string[],
  pendingAchievementIds: [] as string[],
  managerStats: { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0 },
  clubRecords: createEmptyRecords(),
  careerTimeline: [] as GameState['careerTimeline'],
  managerProgression: { xp: 0, level: 1, unlockedPerks: [], prestigeLevel: 0 } as ManagerProgression,
  objectiveStreak: 0,
  objectivesStartWeek: 1,
  completedCoachTaskIds: [] as string[],
  weekCliffhangers: [] as CliffhangerItem[],
  lastMatchDrama: null as MatchDramaType,
  sessionStats: { startWeek: 1, startSeason: 1, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 } as SessionStats,
  weeklyDigest: null as GameState['weeklyDigest'],
  contractStrikes: {} as Record<string, import('@/types/game').NegotiationStrike>,
  pairFamiliarity: {} as Record<string, number>,
  rivalries: {} as Record<string, import('@/types/game').HeadToHeadRecord>,
  seasonGrowthTracker: {} as Record<string, number>,
  // Transfer page filter state (persisted across navigation)
  transferFilters: {
    tab: 'market' as 'market' | 'deals' | 'freeAgents' | 'news',
    posFilter: 0,
    searchQuery: '',
    sortBy: 'overall' as 'overall' | 'price' | 'age' | 'potential',
    faSortBy: 'overall' as 'overall' | 'age' | 'potential' | 'wage',
    divFilter: 'all',
    newsTypeFilter: 'all' as 'all' | 'transfer' | 'loan' | 'free_agent',
    hideUnaffordable: false,
    showShortlistOnly: false,
  },

  // ── Transfer Filter Actions ──
  setTransferFilter: (updates: Partial<GameState['transferFilters']>) => {
    const state = get();
    set({ transferFilters: { ...state.transferFilters, ...updates } });
  },

  // ── Press Conference Actions ──
  respondToPress: (tone: import('@/types/game').PressResponseTone) => {
    const state = get();
    const press = state.pendingPressConference;
    if (!press) return;

    const option = press.options.find(o => o.tone === tone);
    if (!option) return;

    let { morale: moraleEffect, boardConfidence: boardEffect, fanMood: fanEffect } = option.effects;

    // Media Savvy perk: double press conference effects (dynasty builder boosts further)
    if (hasPerk(state.managerProgression, 'media_savvy')) {
      const mediaDm = 2 * branchMult(state.managerProgression, 'motivator');
      moraleEffect = Math.round(moraleEffect * mediaDm);
      boardEffect = Math.round(boardEffect * mediaDm);
      fanEffect = Math.round(fanEffect * mediaDm);
    }

    // Career mode: apply media handling modifier to press effects
    if (state.gameMode === 'career' && state.careerManager) {
      const mediaMod = 1 + state.careerManager.attributes.mediaHandling * MOD_MEDIA_PRESS;
      const motivationMod = 1 + state.careerManager.attributes.motivation * MOD_MOTIVATION_MORALE;
      moraleEffect = Math.round(moraleEffect * mediaMod * motivationMod);
      boardEffect = Math.round(boardEffect * mediaMod);
      fanEffect = Math.round(fanEffect * mediaMod);

      // Grow media handling stat
      const cm = { ...state.careerManager, attributes: { ...state.careerManager.attributes } };
      cm.attributes.mediaHandling = Math.min(STAT_MAX, cm.attributes.mediaHandling + GROWTH_MEDIA_PER_CONFERENCE);
      set({ careerManager: cm });
    }

    // Apply morale to all squad players
    const newPlayers = { ...state.players };
    const club = state.clubs[state.playerClubId];
    if (club) {
      club.playerIds.forEach(pid => {
        const p = newPlayers[pid];
        if (p) {
          newPlayers[pid] = { ...p, morale: clamp(p.morale + moraleEffect, 10, 100) };
        }
      });
    }

    const newConfidence = clamp(state.boardConfidence + boardEffect, 10, 100);
    const newFanMood = clamp(state.fanMood + fanEffect, 0, 100);

    const toneLabel = tone === 'confident' ? 'boldly' : tone === 'humble' ? 'humbly' : 'evasively';
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: 'Press Conference',
      body: `You responded ${toneLabel}. ${boardEffect > 0 ? 'The board approves.' : boardEffect < 0 ? 'The board is uneasy.' : ''} ${fanEffect > 3 ? 'Fans are buzzing.' : fanEffect < -2 ? 'Fans are skeptical.' : ''}`.trim(),
    });

    set({
      pendingPressConference: null,
      players: newPlayers,
      boardConfidence: newConfidence,
      fanMood: newFanMood,
      messages: newMessages,
    });
  },

  clearPendingAchievements: () => {
    if (get().pendingAchievementIds.length === 0) return;
    set({ pendingAchievementIds: [] });
  },

  markCoachTaskComplete: (taskId: string) => {
    const ids = get().completedCoachTaskIds;
    if (ids.includes(taskId)) return;
    const newIds = [...ids, taskId];

    // Grant XP for the completed task
    const xp = COACH_TASK_XP[taskId] ?? 5;
    let updatedProgression = grantXP(get().managerProgression, xp);

    // Bonus XP for completing ALL tasks (fires exactly once) — derive the
    // count from the config so adding/removing a task can't desync this.
    if (newIds.length === Object.keys(COACH_TASK_XP).length) {
      updatedProgression = grantXP(updatedProgression, COACH_ALL_TASKS_BONUS_XP);
    }

    set({ completedCoachTaskIds: newIds, managerProgression: updatedProgression });
  },

  completeOnboardingChecklist: () => {
    // One-off XP payoff when the first-session "Getting Started" checklist is
    // finished. Idempotent: a persisted device-global flag means re-runs (the
    // component effect can fire more than once) never double-pay. Returns
    // whether XP was actually granted so the UI can decide to toast.
    if (getFlag(STORAGE_KEYS.ONBOARDING_REWARD_CLAIMED)) return false;
    setFlag(STORAGE_KEYS.ONBOARDING_REWARD_CLAIMED);
    const sessionStats = get().sessionStats;
    set({
      managerProgression: grantXP(get().managerProgression, ONBOARDING_COMPLETION_XP),
      sessionStats: { ...sessionStats, xpEarned: sessionStats.xpEarned + ONBOARDING_COMPLETION_XP },
    });
    return true;
  },

  claimObjective: (objectiveId: string) => {
    const objectives = get().weeklyObjectives;
    const target = objectives.find(o => o.objectiveId === objectiveId);
    // Only completed-but-unclaimed objectives pay out.
    if (!target || !target.completed || target.claimed) return;
    const xp = objectiveClaimXP(target);
    const updated = objectives.map(o =>
      o.objectiveId === objectiveId ? { ...o, claimed: true } : o
    );
    if (xp <= 0) {
      set({ weeklyObjectives: updated });
      return;
    }
    const sessionStats = get().sessionStats;
    set({
      weeklyObjectives: updated,
      managerProgression: grantXP(get().managerProgression, xp),
      // Keep the Dashboard's session XP total in sync. Objective base XP used
      // to be added here in advanceWeek; now it's paid on claim, so account
      // for it on claim too (the month-end safety net handles unclaimed ones).
      sessionStats: { ...sessionStats, xpEarned: sessionStats.xpEarned + xp },
    });
  },

  // ── Dynasty Pass ──
  // Claim a reward tier: grant its manager XP and mark it claimed. Idempotent —
  // the claimedTiers guard in applySeasonPassClaim makes a re-claim a no-op, so
  // a double-tap can never double-pay. Sim-neutral (XP only).
  claimSeasonPassTier: (tier: number) => {
    const state = get();
    const result = applySeasonPassClaim(state.seasonPass, tier);
    if (!result.claimed) return null;
    const sessionStats = state.sessionStats;
    set({
      seasonPass: result.pass,
      managerProgression: grantXP(state.managerProgression, result.xp),
      sessionStats: { ...sessionStats, xpEarned: sessionStats.xpEarned + result.xp },
    });
    track('season_pass_claim', { tier, xp: result.xp });
    return { xp: result.xp };
  },

  // ── Daily Login Streak ──
  claimDailyStreakReward: () => {
    // The streak record is device-global (localStorage), not save-scoped, so a
    // new career keeps yesterday's streak alive. Only the XP payout lands on
    // the active save's manager progression — a sim-neutral reward.
    const { record, status } = applyDailyClaim(readDailyStreak());
    if (!status.canClaim) return null;
    writeDailyStreak(record);
    const sessionStats = get().sessionStats;
    set({
      managerProgression: grantXP(get().managerProgression, status.rewardXP),
      sessionStats: { ...sessionStats, xpEarned: sessionStats.xpEarned + status.rewardXP },
    });
    track('daily_streak_claim', { streak: status.current, xp: status.rewardXP });
    return status;
  },

  // ── Redeem Codes ──
  redeemCode: async (code: string) => {
    const parsed = await verifyRedeemCode(code, getRedeemSecret());
    if (!parsed.valid) return { ok: false, reason: parsed.error };
    if (readRedeemedCodes().includes(parsed.codeId)) return { ok: false, reason: 'already-used' as const };

    const state = get();
    if (!state.gameStarted) return { ok: false, reason: 'no-game' as const };
    const { type, amount } = parsed.reward;

    if (type === 'money') {
      const club = state.clubs[state.playerClubId];
      if (!club) return { ok: false, reason: 'no-game' as const };
      set({ clubs: { ...state.clubs, [state.playerClubId]: { ...club, budget: (club.budget || 0) + amount } } });
    } else {
      const sessionStats = state.sessionStats;
      set({
        managerProgression: grantXP(state.managerProgression, amount),
        sessionStats: { ...sessionStats, xpEarned: sessionStats.xpEarned + amount },
      });
    }

    addRedeemedCode(parsed.codeId);
    track('code_redeemed', { reward: type });
    return { ok: true, rewardType: type, amount };
  },

  // ── Live Event (World Cup Festival) ──
  // Progress is device-global (localStorage), not save-scoped — only the XP
  // payout from claiming a tier lands on the active save's manager progression.
  festivalCheckIn: () => {
    const event = getActiveLiveEvent();
    if (!event) return null;
    const progress = readActiveFestivalProgress(event);
    if (!canCheckInToday(progress)) return null;
    const next = applyCheckIn(progress, event);
    writeLiveEventProgress(next);
    track('festival_checkin', { eventId: event.id, points: next.points });
    return next;
  },

  claimFestivalTier: (tierId: string) => {
    const event = getActiveLiveEvent();
    if (!event) return null;
    const tier = event.tiers.find(t => t.id === tierId);
    if (!tier) return null;
    const progress = readActiveFestivalProgress(event);
    const next = applyTierClaim(progress, event, tierId);
    // applyTierClaim is a no-op when the tier is locked/already-claimed — only
    // pay out when the claimed list actually grew.
    if (next.claimedTierIds.length === progress.claimedTierIds.length) return null;
    writeLiveEventProgress(next);
    const sessionStats = get().sessionStats;
    set({
      managerProgression: grantXP(get().managerProgression, tier.xp),
      sessionStats: { ...sessionStats, xpEarned: sessionStats.xpEarned + tier.xp },
    });
    track('festival_tier_claim', { eventId: event.id, tierId, xp: tier.xp });
    return { progress: next, xp: tier.xp };
  },

  // ── Weekly Digest ──
  dismissWeeklyDigest: () => set({ weeklyDigest: null }),

  dismissPress: () => {
    // Dismissing has a small negative effect — media reports "manager refused to comment"
    const state = get();
    set({
      pendingPressConference: null,
      fanMood: clamp(state.fanMood - 3, 0, 100),
      boardConfidence: clamp(state.boardConfidence - 2, 10, 100),
    });
  },

  // ── Storyline Actions ──
  respondToStoryline: (optionIndex: number) => {
    const state = get();
    const storyline = state.pendingStoryline;
    if (!storyline || !storyline.options[optionIndex]) return;

    const option = storyline.options[optionIndex];
    const { morale, boardConfidence, fanMood, targetPlayerId, playerMorale } = option.effects;

    const newPlayers = { ...state.players };
    const newClubs = { ...state.clubs };
    const club = newClubs[state.playerClubId] ? { ...newClubs[state.playerClubId] } : null;
    if (club) newClubs[state.playerClubId] = club;

    // Apply squad-wide morale
    if (morale && club) {
      club.playerIds.forEach(pid => {
        const p = newPlayers[pid];
        if (p) newPlayers[pid] = { ...p, morale: clamp(p.morale + morale, 10, 100) };
      });
    }

    // Apply targeted player morale
    if (targetPlayerId && playerMorale && newPlayers[targetPlayerId]) {
      const p = newPlayers[targetPlayerId];
      newPlayers[targetPlayerId] = { ...p, morale: clamp(p.morale + playerMorale, 10, 100) };
    }

    const newConfidence = clamp(state.boardConfidence + (boardConfidence || 0), 10, 100);
    const newFanMood = clamp(state.fanMood + (fanMood || 0), 0, 100);

    let newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: storyline.title,
      body: `You chose: "${option.label}". ${option.text}`,
    });

    // Track choice in active storyline chain (if this event belongs to one)
    const updatedChains = [...(state.activeStorylineChains || [])];
    let chainId = '';
    let stepIdx = -1;
    if (storyline.id.startsWith('chain-')) {
      const parts = storyline.id.split('-');
      // Format: chain-{chainId}-step-{stepIdx}
      chainId = parts.slice(1, parts.length - 2).join('-');
      stepIdx = parseInt(parts[parts.length - 1], 10);
      const chainIdx = updatedChains.findIndex(c => c.chainId === chainId);
      if (chainIdx >= 0) {
        updatedChains[chainIdx] = { ...updatedChains[chainIdx], choices: [...updatedChains[chainIdx].choices, optionIndex] };
      }
    }

    // Extra state for saga consequences
    let extraState: Partial<GameState> = {};

    // ── Star Player Transfer Saga: Final step real consequences ──
    if (chainId === 'star-player-transfer-saga' && stepIdx === 3 && targetPlayerId && club) {
      const player = newPlayers[targetPlayerId];
      if (!player || player.clubId !== state.playerClubId) {
        // Player already left the club mid-saga — inform the user
        const pName = player ? `${player.firstName} ${player.lastName}` : 'The star player';
        newMessages = addMsg(newMessages, {
          week: state.week, season: state.season, type: 'general',
          title: 'Saga Concluded',
          body: `${pName} has already left the club. The transfer saga concludes without further action.`,
        });
      } else if (optionIndex === 1) {
        // "Accept a record fee" — actually sell the player
        const saleFee = Math.round(player.value * 1.5);
        club.playerIds = club.playerIds.filter(id => id !== targetPlayerId);
        club.lineup = club.lineup.filter(id => id !== targetPlayerId);
        club.subs = club.subs.filter(id => id !== targetPlayerId);
        if (club.setPieceTakerId === targetPlayerId) club.setPieceTakerId = undefined;
        if (club.penaltyTakerId === targetPlayerId) club.penaltyTakerId = undefined;
        club.budget += saleFee;
        club.wageBill = Math.max(0, club.wageBill - player.wage);

        // Find a buyer club (random AI club, not the player's club)
        const allClubs = Object.values(state.clubs).filter(c => c.id !== state.playerClubId);
        const buyerClub = allClubs.length > 0
          ? allClubs[Math.floor(Math.random() * allClubs.length)]
          : null;

        if (buyerClub) {
          const buyer = { ...buyerClub };
          buyer.wageBill += player.wage;
          newClubs[buyer.id] = buyer;
          Object.assign(newClubs, placePlayerInClub(newClubs, buyer.id, targetPlayerId));
          newPlayers[targetPlayerId] = { ...player, clubId: buyer.id, listedForSale: false };

          newMessages = addMsg(newMessages, {
            week: state.week, season: state.season, type: 'transfer',
            title: `${player.lastName} Sold!`,
            body: `${player.firstName} ${player.lastName} has been sold to ${buyer.name} for a record fee of £${(saleFee / 1e6).toFixed(1)}M.`,
            playerId: targetPlayerId,
          });
        } else {
          // No buyer found — sell to "foreign club" (remove from game)
          newPlayers[targetPlayerId] = { ...player, clubId: '' };
          newMessages = addMsg(newMessages, {
            week: state.week, season: state.season, type: 'transfer',
            title: `${player.lastName} Sold!`,
            body: `${player.firstName} ${player.lastName} has been sold abroad for a record fee of £${(saleFee / 1e6).toFixed(1)}M.`,
            playerId: targetPlayerId,
          });
        }

        // Farewell check for long-serving players
        const farewell = getFarewellSummary(player, state.season, player.joinedSeason);
        const farewellEntry = farewell.shouldShow
          ? { playerId: targetPlayerId, playerName: `${player.firstName} ${player.lastName}`, seasonsServed: farewell.seasonsServed, stats: farewell.stats }
          : null;

        // Merchandise dip when star player sold
        let merchUpdate: Partial<GameState> = {};
        const starPlayers = getStarPlayerMerch(club, state.players);
        if (starPlayers.some(sp => sp.playerId === targetPlayerId)) {
          const currentDip = state.merchandise?.starPlayerDip || 0;
          merchUpdate = { merchandise: { ...state.merchandise, starPlayerDip: Math.max(currentDip, STAR_PLAYER_SALE_DIP_WEEKS) } };
        }

        extraState = {
          transferMarket: state.transferMarket.filter(l => l.playerId !== targetPlayerId),
          shortlist: state.shortlist.filter(id => id !== targetPlayerId),
          scoutWatchList: state.scoutWatchList.filter(id => id !== targetPlayerId),
          incomingOffers: state.incomingOffers.filter(o => o.playerId !== targetPlayerId),
          seasonTransfersSold: [...(state.seasonTransfersSold || []), { playerName: `${player.firstName} ${player.lastName}`, fee: saleFee }],
          managerStats: { ...state.managerStats, totalEarned: state.managerStats.totalEarned + saleFee },
          ...(farewellEntry ? { pendingFarewell: [...state.pendingFarewell, farewellEntry] } : {}),
          ...merchUpdate,
        };
      } else if (optionIndex === 2) {
        // "Loan him out" — actually loan the player (only if transfer window open)
        if (!state.transferWindowOpen) {
          newMessages = addMsg(newMessages, {
            week: state.week, season: state.season, type: 'transfer',
            title: `${player.lastName}'s Loan Falls Through`,
            body: `The loan move for ${player.firstName} ${player.lastName} collapsed — the transfer window is closed.`,
            playerId: targetPlayerId,
          });
        } else {
          const allClubs = Object.values(state.clubs).filter(c => c.id !== state.playerClubId);
          const destClub = allClubs.length > 0
            ? allClubs[Math.floor(Math.random() * allClubs.length)]
            : null;

          if (destClub) {
            const remainingWeeks = Math.max(4, TOTAL_WEEKS - state.week);
            const wageSplit = 50;
            const loanWageShare = Math.round(player.wage * wageSplit / 100);

            const loan: import('@/types/game').LoanDeal = {
              id: safeRandomUUID(),
              playerId: targetPlayerId,
              fromClubId: state.playerClubId,
              toClubId: destClub.id,
              startWeek: state.week,
              startSeason: state.season,
              durationWeeks: remainingWeeks,
              wageSplit,
              recallClause: true,
            };

            newPlayers[targetPlayerId] = {
              ...player,
              onLoan: true,
              loanFromClubId: state.playerClubId,
              loanToClubId: destClub.id,
              clubId: destClub.id,
            };

            club.playerIds = club.playerIds.filter(id => id !== targetPlayerId);
            club.lineup = club.lineup.filter(id => id !== targetPlayerId);
            club.subs = club.subs.filter(id => id !== targetPlayerId);
            if (club.setPieceTakerId === targetPlayerId) club.setPieceTakerId = undefined;
            if (club.penaltyTakerId === targetPlayerId) club.penaltyTakerId = undefined;
            club.wageBill = Math.max(0, club.wageBill - loanWageShare);

            const dest = { ...destClub };
            dest.wageBill += loanWageShare;
            newClubs[dest.id] = dest;
            Object.assign(newClubs, placePlayerInClub(newClubs, dest.id, targetPlayerId));

            newMessages = addMsg(newMessages, {
              week: state.week, season: state.season, type: 'transfer',
              title: `${player.lastName} Loaned Out`,
              body: `${player.firstName} ${player.lastName} has joined ${dest.name} on loan for the rest of the season. Recall clause included.`,
              playerId: targetPlayerId,
            });

            extraState = {
              activeLoans: [...state.activeLoans, loan],
              transferMarket: state.transferMarket.filter(l => l.playerId !== targetPlayerId),
              shortlist: state.shortlist.filter(id => id !== targetPlayerId),
              scoutWatchList: state.scoutWatchList.filter(id => id !== targetPlayerId),
            };
          }
        }
      }
    }

    set({
      pendingStoryline: null,
      players: newPlayers,
      clubs: newClubs,
      boardConfidence: newConfidence,
      fanMood: newFanMood,
      messages: newMessages,
      activeStorylineChains: updatedChains,
      ...extraState,
    });
  },

  dismissStoryline: () => {
    set({ pendingStoryline: null });
  },

  // ── Contract Strike Helpers ──
  getContractStrikes: (playerId: string): number => {
    return get().contractStrikes[playerId]?.strikes || 0;
  },

  isContractLocked: (playerId: string): { locked: boolean; weeksRemaining: number } => {
    const state = get();
    const strike = state.contractStrikes[playerId];
    if (!strike?.cooldownUntil) return { locked: false, weeksRemaining: 0 };
    const currentAbsoluteWeek = (state.season - 1) * TOTAL_WEEKS + state.week;
    if (currentAbsoluteWeek >= strike.cooldownUntil) return { locked: false, weeksRemaining: 0 };
    return { locked: true, weeksRemaining: strike.cooldownUntil - currentAbsoluteWeek };
  },

  recordContractStrike: (playerId: string): number => {
    let newStrikes = 1;
    set(s => {
      const existing = s.contractStrikes[playerId] || { strikes: 0 };
      newStrikes = existing.strikes + 1;
      const currentAbsoluteWeek = (s.season - 1) * TOTAL_WEEKS + s.week;
      const cooldownUntil = newStrikes >= CONTRACT_MAX_STRIKES
        ? currentAbsoluteWeek + CONTRACT_STRIKE_COOLDOWN_WEEKS
        : undefined;
      return {
        contractStrikes: {
          ...s.contractStrikes,
          [playerId]: { strikes: newStrikes, cooldownUntil },
        },
      };
    });
    return newStrikes;
  },

  clearContractStrikes: (playerId: string) => {
    set(s => {
      const updated = { ...s.contractStrikes };
      delete updated[playerId];
      return { contractStrikes: updated };
    });
  },

  // ── Contract Negotiation Actions ──
  startNegotiation: (playerId: string, isRenewal: boolean): { success: boolean; lockedWeeks?: number } => {
    const state = get();
    const player = state.players[playerId];
    if (!player) return { success: false };
    const club = state.clubs[state.playerClubId];
    if (!club) return { success: false };

    // Check if player is locked from contract negotiations
    const lockStatus = get().isContractLocked(playerId);
    if (lockStatus.locked) return { success: false, lockedWeeks: lockStatus.weeksRemaining };

    const offer = createContractOffer(player, club.reputation, isRenewal, state.season);
    set({ activeNegotiation: offer });
    return { success: true };
  },

  submitWageOffer: (wage: number, years?: number): { success: false; message: string } | void => {
    const state = get();
    const offer = state.activeNegotiation;
    if (!offer || offer.status !== 'in_progress') return;

    // Affordability pre-check: agent fee + loyalty bonus are fixed at offer
    // creation and charged in full on acceptance with no budget guard, so an
    // accepted round would silently drive the budget negative. Siblings
    // (renewStaffContract, terminateSponsorDeal) refuse when unaffordable.
    const negotiatingClub = state.clubs[state.playerClubId];
    const upfrontCost = (offer.agentFee || 0) + (offer.loyaltyBonus || 0);
    if (negotiatingClub && negotiatingClub.budget < upfrontCost) {
      return { success: false, message: `Cannot afford the £${(upfrontCost / 1000).toFixed(0)}K agent fee${offer.loyaltyBonus > 0 ? ' and loyalty bonus' : ''}.` };
    }

    const updated = { ...offer, offeredWage: wage };
    if (years !== undefined) updated.contractYears = years;
    const iconBonus = hasPerk(state.managerProgression, 'icon_status') ? CONTRACT_ICON_STATUS_BONUS : 0;
    const result = negotiateRound(updated, iconBonus);

    if (result.status === 'accepted') {
      // Apply the contract
      const player = state.players[offer.playerId];
      if (!player) return;

      const newPlayers = { ...state.players };
      newPlayers[offer.playerId] = {
        ...player,
        wage: result.offeredWage,
        contractEnd: state.season + result.contractYears,
        morale: Math.min(100, player.morale + 10),
      };

      // Deduct agent fee from budget
      const newClubs = { ...state.clubs };
      const club = { ...newClubs[state.playerClubId] };
      club.budget -= result.agentFee + result.loyaltyBonus;
      club.wageBill = Math.max(0, club.wageBill - player.wage + result.offeredWage);
      newClubs[state.playerClubId] = club;

      const newMessages = addMsg(state.messages, {
        week: state.week, season: state.season, type: 'contract',
        title: `${player.lastName} Signs!`,
        body: `${player.firstName} ${player.lastName} has agreed a ${result.contractYears}-year deal at ${formatWage(result.offeredWage)}. Agent fee: £${(result.agentFee / 1000).toFixed(0)}K.`,
      });

      // Clear strikes on successful deal — atomic with the acceptance update
      const clearedStrikes = { ...state.contractStrikes };
      delete clearedStrikes[offer.playerId];

      // Record an attached promise (renewals only). One active promise per
      // player — replace any prior unresolved promise for this player.
      let newPromises = state.promises;
      if (offer.promise) {
        newPromises = [
          ...(state.promises || []).filter(pr => !(pr.playerId === offer.playerId && pr.status === 'active')),
          makePlayerPromise(offer.playerId, offer.promise, state.season, state.week),
        ];
      }

      set({
        activeNegotiation: { ...result },
        players: newPlayers,
        clubs: newClubs,
        messages: newMessages,
        contractStrikes: clearedStrikes,
        promises: newPromises,
      });
    } else {
      // Atomic: record strike on rejection + update negotiation in one set()
      if (result.status === 'rejected') {
        set(s => {
          const existing = s.contractStrikes[offer.playerId] || { strikes: 0 };
          const newStrikes = existing.strikes + 1;
          const currentAbsoluteWeek = (s.season - 1) * TOTAL_WEEKS + s.week;
          const cooldownUntil = newStrikes >= CONTRACT_MAX_STRIKES
            ? currentAbsoluteWeek + CONTRACT_STRIKE_COOLDOWN_WEEKS
            : undefined;
          return {
            activeNegotiation: result,
            contractStrikes: {
              ...s.contractStrikes,
              [offer.playerId]: { strikes: newStrikes, cooldownUntil },
            },
          };
        });
      } else {
        set({ activeNegotiation: result });
      }
    }
  },

  setNegotiationPromise: (type: PlayerPromiseType | null) => {
    const offer = get().activeNegotiation;
    if (!offer || offer.status !== 'in_progress') return;
    const current = offer.promise ?? null;
    const next = current === type ? null : type; // tapping the active chip clears it
    if (current === next) return;

    // Recompute the demand: undo any existing discount, apply the new one.
    let demand = offer.demandedWage;
    if (current) demand = demand / (1 - PROMISE_WAGE_REDUCTION);
    if (next) demand = demand * (1 - PROMISE_WAGE_REDUCTION);
    demand = Math.round(demand / 1000) * 1000 || Math.round(demand);

    set({ activeNegotiation: { ...offer, promise: next, demandedWage: demand } });
  },

  cancelNegotiation: () => {
    const state = get();
    const offer = state.activeNegotiation;
    if (!offer) return;

    // Player's morale drops if negotiation abandoned
    const player = state.players[offer.playerId];
    if (player) {
      const newPlayers = { ...state.players };
      newPlayers[offer.playerId] = { ...player, morale: Math.max(10, player.morale - 8) };
      set({ activeNegotiation: null, players: newPlayers });
    } else {
      set({ activeNegotiation: null });
    }
  },

  // ── Transfer Talk Actions ──
  openTransferTalk: (playerId: string) => {
    const state = get();
    const player = state.players[playerId];
    if (!player || !player.wantsToLeave) return;
    // Prevent spamming talk within retry cooldown period
    if (player.lastTransferTalkWeek && state.week - player.lastTransferTalkWeek < TRANSFER_TALK_RETRY_WEEKS) return;
    const reason = (player.lowMoraleWeeks && player.lowMoraleWeeks >= 4) ? 'low_morale' as const : 'ambition' as const;
    set({ pendingTransferTalk: buildTransferTalk(player, reason) });
  },

  respondToTransferTalk: (optionIndex: number) => {
    const state = get();
    const talk = state.pendingTransferTalk;
    if (!talk || !talk.options[optionIndex]) return null;

    const option = talk.options[optionIndex];
    const player = state.players[talk.playerId];
    if (!player) { set({ pendingTransferTalk: null }); return null; }

    const newPlayers = { ...state.players };
    const club = state.clubs[state.playerClubId];
    let msgTitle = '';
    let msgBody = '';
    let succeeded: boolean | undefined;

    if (option.tone === 'empathize') {
      newPlayers[talk.playerId] = { ...player, morale: clamp(player.morale + (option.effects.morale || 0), 10, 100), listedForSale: true, lastTransferTalkWeek: state.week };
      msgTitle = `${player.lastName}: Transfer Listed`;
      msgBody = `You listened to ${player.firstName} ${player.lastName}'s concerns and agreed to list them for sale.`;
    } else if (option.tone === 'convince') {
      succeeded = Math.random() < (option.effects.withdrawChance || 0);
      if (succeeded) {
        newPlayers[talk.playerId] = { ...player, wantsToLeave: false, morale: clamp(player.morale + TRANSFER_TALK_CONVINCE_SUCCESS_MORALE, 10, 100), lowMoraleWeeks: 0, transferCooldownUntilWeek: state.week + TRANSFER_DEMAND_COOLDOWN_WEEKS, lastTransferTalkWeek: state.week };
        msgTitle = `${player.lastName} Convinced to Stay!`;
        msgBody = `${player.firstName} ${player.lastName} has withdrawn the transfer request after your talk. The player is committed to the project.`;
      } else {
        newPlayers[talk.playerId] = { ...player, morale: clamp(player.morale - TRANSFER_TALK_CONVINCE_FAIL_MORALE, 10, 100), lastTransferTalkWeek: state.week };
        msgTitle = `${player.lastName} Insists on Leaving`;
        msgBody = `${player.firstName} ${player.lastName} was not convinced. The player still wants to leave the club.`;
      }
    } else if (option.tone === 'promise') {
      newPlayers[talk.playerId] = { ...player, morale: clamp(player.morale + (option.effects.morale || 0), 10, 100), listedForSale: true, lastTransferTalkWeek: state.week };
      msgTitle = `${player.lastName}: Move Promised`;
      msgBody = `You promised ${player.firstName} ${player.lastName} you'd find them the right move. They have been listed for sale.`;
    } else if (option.tone === 'refuse') {
      newPlayers[talk.playerId] = { ...player, morale: clamp(player.morale + (option.effects.morale || 0), 10, 100), lastTransferTalkWeek: state.week };
      // Apply team morale hit
      if (option.effects.teamMorale && club) {
        club.playerIds.forEach(pid => {
          if (pid === talk.playerId) return;
          const p = newPlayers[pid];
          if (p) newPlayers[pid] = { ...p, morale: clamp(p.morale + (option.effects.teamMorale || 0), 10, 100) };
        });
      }
      msgTitle = `${player.lastName}: Request Denied`;
      msgBody = `You refused ${player.firstName} ${player.lastName}'s transfer request. The player is unhappy and the squad has taken notice.`;
    }

    // Mark all existing transfer messages for this player as actioned
    const actionedMessages = state.messages.map(m =>
      m.type === 'transfer' && m.playerId === talk.playerId && !m.actioned
        ? { ...m, actioned: true }
        : m
    );

    const newMessages = addMsg(actionedMessages, {
      week: state.week, season: state.season, type: 'transfer',
      title: msgTitle, body: msgBody, playerId: talk.playerId,
    });

    set({ pendingTransferTalk: null, players: newPlayers, messages: newMessages });
    return { tone: option.tone, succeeded, playerName: talk.playerName, msgTitle, msgBody };
  },

  dismissTransferTalk: () => {
    // Dismissing defaults to empathize — list for sale with small morale boost
    const state = get();
    const talk = state.pendingTransferTalk;
    if (!talk) { set({ pendingTransferTalk: null }); return null; }
    const player = state.players[talk.playerId];
    if (!player) { set({ pendingTransferTalk: null }); return null; }

    const newPlayers = { ...state.players };
    newPlayers[talk.playerId] = { ...player, morale: clamp(player.morale + TRANSFER_TALK_EMPATHIZE_MORALE_BOOST, 10, 100), listedForSale: true };

    const msgTitle = `${player.lastName}: Transfer Listed`;
    const msgBody = `${player.firstName} ${player.lastName} has been listed for sale after requesting a transfer.`;

    // Mark all existing transfer messages for this player as actioned
    const actionedMessages = state.messages.map(m =>
      m.type === 'transfer' && m.playerId === talk.playerId && !m.actioned
        ? { ...m, actioned: true }
        : m
    );

    const newMessages = addMsg(actionedMessages, {
      week: state.week, season: state.season, type: 'transfer',
      title: msgTitle, body: msgBody, playerId: talk.playerId,
    });

    set({ pendingTransferTalk: null, players: newPlayers, messages: newMessages });
    return { playerName: talk.playerName, msgTitle, msgBody };
  },

  // ── Challenge Mode Actions ──
  startChallenge: (scenarioId: string, clubId: string) => {
    const scenario = CHALLENGES.find(c => c.id === scenarioId);
    if (!scenario) return;

    // Initialize the game first. Challenge flow doesn't thread Community
    // Pack so initGame is sync in practice; guardAsync is belt-and-braces
    // in case CP plumbing reaches this call path later.
    guardAsync(
      get().initGame(clubId),
      'startChallenge.initGame',
      { title: 'Challenge start failed', body: 'Could not initialise the challenge scenario.' },
    );

    // Apply challenge modifiers
    const state = get();
    const newClubs = { ...state.clubs };
    const club = { ...newClubs[clubId] };
    club.budget = Math.round(club.budget * scenario.budgetModifier);
    newClubs[clubId] = club;

    const challenge: ActiveChallenge = {
      scenarioId,
      startSeason: 1,
      seasonsRemaining: scenario.seasonLimit,
      completed: false,
      failed: false,
    };

    const newMessages = addMsg(state.messages, {
      week: 1, season: 1, type: 'board',
      title: `Challenge: ${scenario.name}`,
      body: `${scenario.description}\n\nObjective: ${scenario.winCondition}\n\nYou have ${scenario.seasonLimit} season(s) to complete this challenge.`,
    });

    set({
      clubs: newClubs,
      activeChallenge: challenge,
      messages: newMessages,
    });
  },
});
