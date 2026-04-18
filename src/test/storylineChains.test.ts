import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { interpolatePlayerName, interpolateStorylineEvent, processStorylineChains } from '@/store/helpers/storylineChains';
import type { ActiveStorylineChain, Message, Player, StorylineEvent } from '@/types/game';
import { STORYLINE_CHAINS } from '@/data/storylineChains';

function player(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id, firstName: 'First', lastName: 'Last', age: 25, nationality: 'England',
    position: 'CM', clubId: 'c', wage: 10_000, value: 5_000_000, contractEnd: 3,
    attributes: { pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70, mental: 70 },
    overall: 75, potential: 80,
    fitness: 100, morale: 70, form: 60,
    injured: false, injuryWeeks: 0,
    goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0,
    careerGoals: 0, careerAssists: 0, careerAppearances: 0,
    ...overrides,
  };
}

const baseArgs = {
  week: 10,
  season: 1,
  players: {} as Record<string, Player>,
  playerClubId: 'c',
  boardConfidence: 50,
  recentResults: { won: 2, lost: 1 },
  activeChains: [] as ActiveStorylineChain[],
  completedChainIds: [] as string[],
  messages: [] as Message[],
  pendingStorylineEvent: null as StorylineEvent | null,
  clubs: { c: { budget: 50_000_000 } } as Record<string, { budget: number }>,
};

describe('interpolatePlayerName', () => {
  it('replaces {playerName} with first+last of the chain target', () => {
    const chain: ActiveStorylineChain = { chainId: 'x', startWeek: 1, currentStep: 0, choices: [], targetPlayerId: 'p1' };
    const players = { p1: player('p1', { firstName: 'Lionel', lastName: 'Messi' }) };
    expect(interpolatePlayerName('{playerName} is unhappy', chain, players)).toBe('Lionel Messi is unhappy');
  });

  it('falls back to "your star player" when target is missing', () => {
    const chain: ActiveStorylineChain = { chainId: 'x', startWeek: 1, currentStep: 0, choices: [], targetPlayerId: 'missing' };
    expect(interpolatePlayerName('{playerName} is unhappy', chain, {})).toBe('your star player is unhappy');
  });

  it('returns the text unchanged when no target is set', () => {
    const chain: ActiveStorylineChain = { chainId: 'x', startWeek: 1, currentStep: 0, choices: [] };
    expect(interpolatePlayerName('the squad is unhappy', chain, {})).toBe('the squad is unhappy');
  });
});

describe('interpolateStorylineEvent', () => {
  it('interpolates body + option text and threads targetPlayerId into effects', () => {
    const chain: ActiveStorylineChain = { chainId: 'x', startWeek: 1, currentStep: 0, choices: [], targetPlayerId: 'p1' };
    const players = { p1: player('p1', { firstName: 'Lionel', lastName: 'Messi' }) };
    const event: StorylineEvent = {
      id: 'e', title: 'T', body: 'About {playerName}', icon: 'star',
      options: [
        { label: 'A', text: 'Call {playerName}', effects: { morale: 2 } },
      ],
    };
    const out = interpolateStorylineEvent(event, chain, players);
    expect(out.body).toBe('About Lionel Messi');
    expect(out.options[0].text).toBe('Call Lionel Messi');
    expect(out.options[0].effects.targetPlayerId).toBe('p1');
  });
});

describe('processStorylineChains', () => {
  beforeEach(() => {
    // Freeze chain-seeding randomness so the "maybe start a new chain" branch
    // never fires during tests that don't want it.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leaves state untouched when no chains are active and no new one triggers', () => {
    const result = processStorylineChains({ ...baseArgs });
    expect(result.updatedChains).toEqual([]);
    expect(result.completedChainIds).toEqual([]);
    expect(result.pendingStorylineEvent).toBeNull();
    expect(result.messages).toHaveLength(0);
  });

  it('completes a chain once all steps have run and emits a resolution message', () => {
    const firstChain = STORYLINE_CHAINS[0];
    const activeChain: ActiveStorylineChain = {
      chainId: firstChain.id,
      startWeek: 5,
      currentStep: firstChain.steps.length - 1, // last step already played
      choices: firstChain.steps.map(() => 0),
      targetPlayerId: 'p1',
    };
    const result = processStorylineChains({
      ...baseArgs,
      players: { p1: player('p1', { firstName: 'Test', lastName: 'Player' }) },
      activeChains: [activeChain],
    });
    // Chain removed from active list, added to completed
    expect(result.updatedChains).toHaveLength(0);
    expect(result.completedChainIds).toContain(firstChain.id);
    // Resolution message emitted
    expect(result.messages.some(m => m.title.includes(firstChain.name) && m.title.includes('Resolved'))).toBe(true);
  });

  it('advances a chain to the next step when the week threshold has passed', () => {
    const firstChain = STORYLINE_CHAINS[0];
    const activeChain: ActiveStorylineChain = {
      chainId: firstChain.id,
      startWeek: 1,
      currentStep: 0,
      choices: [0],
    };
    const dueWeek = activeChain.startWeek + firstChain.steps[1].weekOffset;
    const result = processStorylineChains({
      ...baseArgs,
      week: dueWeek,
      activeChains: [activeChain],
    });
    expect(result.updatedChains).toHaveLength(1);
    expect(result.updatedChains[0].currentStep).toBe(1);
    expect(result.pendingStorylineEvent).not.toBeNull();
    expect(result.pendingStorylineEvent?.id).toContain(`chain-${firstChain.id}-step-1`);
  });

  it('does not fire a second event when one is already pending', () => {
    const firstChain = STORYLINE_CHAINS[0];
    const activeChain: ActiveStorylineChain = {
      chainId: firstChain.id,
      startWeek: 1,
      currentStep: 0,
      choices: [0],
    };
    const dueWeek = activeChain.startWeek + firstChain.steps[1].weekOffset;
    const existingEvent: StorylineEvent = { id: 'prior', title: 'Prior', body: 'prior', icon: 'star', options: [] };
    const result = processStorylineChains({
      ...baseArgs,
      week: dueWeek,
      activeChains: [activeChain],
      pendingStorylineEvent: existingEvent,
    });
    // The pre-existing event is kept — chain step isn't promoted this tick
    expect(result.pendingStorylineEvent).toBe(existingEvent);
    expect(result.updatedChains[0].currentStep).toBe(0);
  });

  it('drops chains whose definition is no longer in STORYLINE_CHAINS', () => {
    const result = processStorylineChains({
      ...baseArgs,
      activeChains: [{ chainId: 'no-such-chain', startWeek: 1, currentStep: 0, choices: [] }],
    });
    expect(result.updatedChains).toEqual([]);
  });
});
