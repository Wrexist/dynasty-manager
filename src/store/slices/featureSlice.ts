import type { PressConference, ContractOffer, ActiveChallenge, StorylineEvent, ActiveStorylineChain, ManagerProgression, CliffhangerItem, MatchDramaType, SessionStats } from '@/types/game';
import type { GameState } from '../storeTypes';
import { addMsg, clamp } from '@/utils/helpers';
import { createContractOffer, negotiateRound, formatWage } from '@/utils/contracts';
import { CHALLENGES } from '@/data/challenges';
import { createEmptyRecords } from '@/utils/records';

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
  pendingFarewell: null as GameState['pendingFarewell'],

  // ── Press Conference Actions ──
  respondToPress: (tone: 'confident' | 'humble' | 'deflect') => {
    const state = get();
    const press = state.pendingPressConference;
    if (!press) return;

    const option = press.options.find(o => o.tone === tone);
    if (!option) return;

    const { morale: moraleEffect, boardConfidence: boardEffect, fanMood: fanEffect } = option.effects;

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

  clearPendingAchievements: () => set({ pendingAchievementIds: [] }),

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

    const offer = createContractOffer(player, club.reputation, isRenewal);
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
