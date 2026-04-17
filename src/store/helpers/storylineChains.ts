import type { ActiveStorylineChain, Message, Player, StorylineEvent } from '@/types/game';
import { STORYLINE_CHAINS, shouldTriggerChain } from '@/data/storylineChains';
import { STORYLINE_CHAIN_TRIGGER_CHANCE, STORYLINE_CHAIN_MIN_WEEK } from '@/config/playoffs';
import { addMsg } from '@/utils/helpers';

export function interpolatePlayerName(text: string, chain: ActiveStorylineChain, players: Record<string, Player>): string {
  if (!chain.targetPlayerId) return text;
  const p = players[chain.targetPlayerId];
  const name = p ? `${p.firstName} ${p.lastName}` : 'your star player';
  return text.replace(/\{playerName\}/g, name);
}

export function interpolateStorylineEvent(event: StorylineEvent, chain: ActiveStorylineChain, players: Record<string, Player>): StorylineEvent {
  return {
    ...event,
    body: interpolatePlayerName(event.body, chain, players),
    options: event.options.map(opt => ({
      ...opt,
      text: interpolatePlayerName(opt.text, chain, players),
      effects: chain.targetPlayerId ? { ...opt.effects, targetPlayerId: chain.targetPlayerId } : opt.effects,
    })),
  };
}

interface ProcessChainsArgs {
  week: number;
  season: number;
  players: Record<string, Player>;
  playerClubId: string;
  boardConfidence: number;
  recentResults: { won: number; lost: number };
  activeChains: ActiveStorylineChain[];
  completedChainIds: string[];
  messages: Message[];
  pendingStorylineEvent: StorylineEvent | null;
  clubs: Record<string, { budget: number }>;
}

interface ProcessChainsResult {
  updatedChains: ActiveStorylineChain[];
  completedChainIds: string[];
  messages: Message[];
  pendingStorylineEvent: StorylineEvent | null;
}

/**
 * Advance all active storyline chains by one week and potentially seed a new one.
 * Pure function — returns new state slices; callers merge into their set() payload.
 */
export function processStorylineChains(args: ProcessChainsArgs): ProcessChainsResult {
  const { week, season, players, playerClubId, boardConfidence, recentResults, activeChains, messages, clubs } = args;
  const newCompletedChainIds = [...args.completedChainIds];
  let pendingStorylineEvent: StorylineEvent | null = args.pendingStorylineEvent;
  let newMessages = messages;

  const updatedChains: ActiveStorylineChain[] = activeChains.reduce<ActiveStorylineChain[]>((kept, chain) => {
    const chainDef = STORYLINE_CHAINS.find(c => c.id === chain.chainId);
    if (!chainDef) return kept;

    const nextStepIdx = chain.currentStep + 1;
    if (nextStepIdx >= chainDef.steps.length) {
      newCompletedChainIds.push(chain.chainId);
      const targetPlayer = chain.targetPlayerId ? players[chain.targetPlayerId] : null;
      const playerLabel = targetPlayer ? `${targetPlayer.firstName} ${targetPlayer.lastName}` : 'Your star player';
      const lastChoice = chain.choices[chain.choices.length - 1];
      const lastStep = chainDef.steps[chainDef.steps.length - 1];
      const chosenOption = lastStep?.options[lastChoice];
      const outcomeText = chosenOption ? `You chose: "${chosenOption.label}".` : '';
      newMessages = addMsg(newMessages, {
        week, season, type: 'general',
        title: `${chainDef.name} — Resolved`,
        body: `The ${playerLabel} saga is over. ${outcomeText}`,
      });
      return kept;
    }

    const nextStep = chainDef.steps[nextStepIdx];
    const dueWeek = chain.startWeek + nextStep.weekOffset;

    if (week >= dueWeek) {
      if (nextStep.requiredPrevChoice !== undefined) {
        const prevChoice = chain.choices[chain.choices.length - 1];
        if (prevChoice !== nextStep.requiredPrevChoice) {
          kept.push({ ...chain, currentStep: nextStepIdx });
          return kept;
        }
      }

      if (!pendingStorylineEvent) {
        const rawEvent: StorylineEvent = {
          id: `chain-${chain.chainId}-step-${nextStepIdx}`,
          title: nextStep.title,
          body: nextStep.body,
          icon: nextStep.icon,
          options: nextStep.options,
        };
        pendingStorylineEvent = interpolateStorylineEvent(rawEvent, chain, players);
        kept.push({ ...chain, currentStep: nextStepIdx });
      } else {
        kept.push(chain);
      }
    } else {
      kept.push(chain);
    }
    return kept;
  }, []);

  // Try to start a new chain (max 1 active, weekly trigger chance)
  if (updatedChains.length === 0 && Math.random() < STORYLINE_CHAIN_TRIGGER_CHANCE && week >= STORYLINE_CHAIN_MIN_WEEK) {
    const playerClub = clubs[playerClubId];
    const squadPlayers = Object.values(players).filter(p => p.clubId === playerClubId);
    const clubsList = Object.values(clubs);
    const avgBudget = clubsList.length > 0 ? clubsList.reduce((s, c) => s + c.budget, 0) / clubsList.length : 0;
    const completedSet = new Set<string>(newCompletedChainIds);
    for (const chainDef of STORYLINE_CHAINS) {
      if (completedSet.has(chainDef.id)) continue;
      const triggered = shouldTriggerChain(chainDef.id, {
        week,
        recentWins: recentResults.won,
        recentLosses: recentResults.lost,
        boardConfidence,
        hasStarPlayer: squadPlayers.some(p => p.overall >= 75),
        hasYouthProspect: squadPlayers.some(p => p.age <= 21 && p.potential >= 75),
        budget: playerClub?.budget || 0,
        averageBudget: avgBudget,
      });
      if (triggered) {
        let targetPlayerId: string | undefined;
        if (chainDef.id === 'star-player-transfer-saga') {
          const starPlayer = squadPlayers
            .filter(p => p.overall >= 75 && !p.injured && !p.onLoan && !p.wantsToLeave && !p.listedForSale)
            .sort((a, b) => b.overall - a.overall)[0];
          if (starPlayer) targetPlayerId = starPlayer.id;
        }

        const newChain: ActiveStorylineChain = {
          chainId: chainDef.id,
          startWeek: week,
          currentStep: 0,
          choices: [],
          targetPlayerId,
        };

        const firstStep = chainDef.steps[0];
        if (!pendingStorylineEvent) {
          const rawEvent: StorylineEvent = {
            id: `chain-${chainDef.id}-step-0`,
            title: firstStep.title,
            body: firstStep.body,
            icon: firstStep.icon,
            options: firstStep.options,
          };
          pendingStorylineEvent = interpolateStorylineEvent(rawEvent, newChain, players);
        }
        updatedChains.push(newChain);
        break;
      }
    }
  }

  return {
    updatedChains,
    completedChainIds: newCompletedChainIds,
    messages: newMessages,
    pendingStorylineEvent,
  };
}
