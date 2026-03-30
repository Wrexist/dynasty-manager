import type { PressConference, ContractOffer, ActiveChallenge, StorylineEvent, ActiveStorylineChain, ManagerProgression, CliffhangerItem, MatchDramaType, SessionStats, TransferTalk } from '@/types/game';
import { MOD_MEDIA_PRESS, MOD_MOTIVATION_MORALE, GROWTH_MEDIA_PER_CONFERENCE, STAT_MAX } from '@/config/managerCareer';
import { TRANSFER_TALK_EMPATHIZE_MORALE_BOOST, TRANSFER_TALK_CONVINCE_SUCCESS_MORALE, TRANSFER_TALK_CONVINCE_FAIL_MORALE } from '@/config/gameBalance';
import type { GameState } from '../storeTypes';
import { addMsg, clamp } from '@/utils/helpers';
import { createContractOffer, negotiateRound, formatWage } from '@/utils/contracts';
import { CHALLENGES } from '@/data/challenges';
import { createEmptyRecords } from '@/utils/records';
import { buildTransferTalk } from '@/utils/transferTalk';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createFeatureSlice = (set: Set, get: Get) => ({
  // Default state
  pendingPressConference: null as PressConference | null,
  fanMood: 50,
  activeNegotiation: null as ContractOffer | null,
  activeChallenge: null as ActiveChallenge | null,
  weeklyObjectives: [] as import('@/utils/weeklyObjectives').ObjectiveInstance[],
  pendingStoryline: null as StorylineEvent | null,
  pendingGemReveal: null as { playerId: string; region: string } | null,
  pendingTransferTalk: null as TransferTalk | null,
  activeStorylineChains: [] as ActiveStorylineChain[],
  freeAgents: [] as string[],
  unlockedAchievements: [] as string[],
  pendingAchievementIds: [] as string[],
  managerStats: { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0 },
  clubRecords: createEmptyRecords(),
  careerTimeline: [] as GameState['careerTimeline'],
  managerProgression: { xp: 0, level: 1, unlockedPerks: [], prestigeLevel: 0 } as ManagerProgression,
  objectiveStreak: 0,
  weekCliffhangers: [] as CliffhangerItem[],
  lastMatchDrama: null as MatchDramaType,
  sessionStats: { startWeek: 1, startSeason: 1, weeksPlayed: 0, xpEarned: 0, matchesWon: 0, matchesLost: 0, objectivesCompleted: 0 } as SessionStats,
  weeklyDigest: null as GameState['weeklyDigest'],
  pairFamiliarity: {} as Record<string, number>,
  rivalries: {} as Record<string, import('@/types/game').HeadToHeadRecord>,
  seasonGrowthTracker: {} as Record<string, number>,

  // ── Press Conference Actions ──
  respondToPress: (tone: import('@/types/game').PressResponseTone) => {
    const state = get();
    const press = state.pendingPressConference;
    if (!press) return;

    const option = press.options.find(o => o.tone === tone);
    if (!option) return;

    let { morale: moraleEffect, boardConfidence: boardEffect, fanMood: fanEffect } = option.effects;

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
    const club = state.clubs[state.playerClubId];

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

    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: storyline.title,
      body: `You chose: "${option.label}". ${option.text}`,
    });

    // Track choice in active storyline chain (if this event belongs to one)
    const updatedChains = [...(state.activeStorylineChains || [])];
    if (storyline.id.startsWith('chain-')) {
      const parts = storyline.id.split('-');
      // Format: chain-{chainId}-step-{stepIdx}
      const chainId = parts.slice(1, parts.length - 2).join('-');
      const chainIdx = updatedChains.findIndex(c => c.chainId === chainId);
      if (chainIdx >= 0) {
        updatedChains[chainIdx] = { ...updatedChains[chainIdx], choices: [...updatedChains[chainIdx].choices, optionIndex] };
      }
    }

    set({
      pendingStoryline: null,
      players: newPlayers,
      boardConfidence: newConfidence,
      fanMood: newFanMood,
      messages: newMessages,
      activeStorylineChains: updatedChains,
    });
  },

  dismissStoryline: () => {
    set({ pendingStoryline: null });
  },

  // ── Contract Negotiation Actions ──
  startNegotiation: (playerId: string, isRenewal: boolean) => {
    const state = get();
    const player = state.players[playerId];
    if (!player) return;
    const club = state.clubs[state.playerClubId];
    if (!club) return;

    const offer = createContractOffer(player, club.reputation, isRenewal, state.season);
    set({ activeNegotiation: offer });
  },

  submitWageOffer: (wage: number) => {
    const state = get();
    const offer = state.activeNegotiation;
    if (!offer || offer.status !== 'in_progress') return;

    const updated = { ...offer, offeredWage: wage };
    const result = negotiateRound(updated);

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
      club.wageBill = club.wageBill - player.wage + result.offeredWage;
      newClubs[state.playerClubId] = club;

      const newMessages = addMsg(state.messages, {
        week: state.week, season: state.season, type: 'contract',
        title: `${player.lastName} Signs!`,
        body: `${player.firstName} ${player.lastName} has agreed a ${result.contractYears}-year deal at ${formatWage(result.offeredWage)}. Agent fee: £${(result.agentFee / 1000).toFixed(0)}K.`,
      });

      set({
        activeNegotiation: { ...result },
        players: newPlayers,
        clubs: newClubs,
        messages: newMessages,
      });
    } else {
      set({ activeNegotiation: result });
    }
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
      newPlayers[talk.playerId] = { ...player, morale: clamp(player.morale + (option.effects.morale || 0), 10, 100), listedForSale: true };
      msgTitle = `${player.lastName}: Transfer Listed`;
      msgBody = `You listened to ${player.firstName} ${player.lastName}'s concerns and agreed to list them for sale.`;
    } else if (option.tone === 'convince') {
      succeeded = Math.random() < (option.effects.withdrawChance || 0);
      if (succeeded) {
        newPlayers[talk.playerId] = { ...player, wantsToLeave: false, morale: clamp(player.morale + TRANSFER_TALK_CONVINCE_SUCCESS_MORALE, 10, 100), lowMoraleWeeks: 0 };
        msgTitle = `${player.lastName} Convinced to Stay!`;
        msgBody = `${player.firstName} ${player.lastName} has withdrawn the transfer request after your talk. The player is committed to the project.`;
      } else {
        newPlayers[talk.playerId] = { ...player, morale: clamp(player.morale - TRANSFER_TALK_CONVINCE_FAIL_MORALE, 10, 100) };
        msgTitle = `${player.lastName} Insists on Leaving`;
        msgBody = `${player.firstName} ${player.lastName} was not convinced. The player still wants to leave the club.`;
      }
    } else if (option.tone === 'promise') {
      newPlayers[talk.playerId] = { ...player, morale: clamp(player.morale + (option.effects.morale || 0), 10, 100), listedForSale: true };
      msgTitle = `${player.lastName}: Move Promised`;
      msgBody = `You promised ${player.firstName} ${player.lastName} you'd find them the right move. They have been listed for sale.`;
    } else if (option.tone === 'refuse') {
      newPlayers[talk.playerId] = { ...player, morale: clamp(player.morale + (option.effects.morale || 0), 10, 100) };
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

    const newMessages = addMsg(state.messages, {
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

    const newMessages = addMsg(state.messages, {
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

    // Initialize the game first
    get().initGame(clubId);

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
