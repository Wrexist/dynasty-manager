/**
 * Storyline chain content + wiring.
 *
 * A season starts 6-8 chains and a finished chain sits out
 * STORYLINE_CHAIN_COOLDOWN_SEASONS, so the 15-chain pool recycled every couple
 * of seasons. The content package added eleven chains, several of them about a
 * specific squad player (`target`) or the club's real situation (a derby this
 * week, the title race, a relegation fight). These tests pin:
 *
 *  - every chain is structurally valid and its effects stay inside the ranges
 *    the original fifteen chains were balanced to;
 *  - text only uses placeholders the game loop fills, and `{playerName}` only
 *    appears in chains that resolve a target (otherwise it would print raw);
 *  - every icon resolves to a real glyph (two old chains silently fell back
 *    to a star);
 *  - target rules state facts the save can verify;
 *  - the loop attaches the target when a targeted chain starts, and ends a
 *    chain early once its player has left the club.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  STORYLINE_CHAINS, shouldTriggerChain, pickChainTarget, topRivalId, interpolateChainText, CHAIN_PLACEHOLDERS,
} from '@/data/storylineChains';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { useGameStore } from '@/store/gameStore';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import {
  STORYLINE_COMEBACK_MIN_INJURY_WEEKS, STORYLINE_DROUGHT_MIN_APPS, STORYLINE_DROUGHT_MAX_GOALS,
} from '@/config/playoffs';
import type { Club, InjuryDetails, Player, StorylineOption } from '@/types/game';

// Every week rolls the chain trigger, so the wiring cases below are deterministic.
vi.mock('@/config/playoffs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/playoffs')>()),
  STORYLINE_CHAIN_TRIGGER_CHANCE: 1,
}));

/** The ranges the original fifteen chains were authored in. New chains must
 *  not out-muscle them — a storyline is flavour with a nudge, not a lever. */
const BOUNDS = {
  morale: [-10, 12],
  boardConfidence: [-5, 8],
  fanMood: [-10, 12],
  playerMorale: [-15, 15],
} as const;

const PLACEHOLDER_RE = /\{(\w+)\}/g;

function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map(m => m[1]);
}

function allOptions(): { chainId: string; option: StorylineOption }[] {
  return STORYLINE_CHAINS.flatMap(c => c.steps.flatMap(s => s.options.map(option => ({ chainId: c.id, option }))));
}

function player(over: Partial<Player> = {}): Player {
  return {
    id: 'p', firstName: 'Test', lastName: 'Player', age: 25, position: 'CM',
    nationality: 'England', overall: 70, potential: 75, value: 1_000_000, wage: 10_000,
    clubId: 'club-a', contractEnd: 3, goals: 0, assists: 0, appearances: 10,
    careerGoals: 0, careerAssists: 0, careerAppearances: 10,
    fitness: 90, morale: 70, form: 60, injured: false, injuryWeeks: 0,
    yellowCards: 0, redCards: 0,
    attributes: { pace: 65, shooting: 60, passing: 70, defending: 55, physical: 65, mental: 70 },
    ...over,
  };
}

function club(id: string, over: Partial<Club> = {}): Club {
  return {
    id, name: id.toUpperCase(), shortName: id, color: '#000', secondaryColor: '#fff',
    budget: 10_000_000, reputation: 3, fanBase: 50, wageBill: 0, formation: '4-4-2',
    playerIds: [], lineup: [], subs: [], divisionId: 'eng',
    facilities: 5, youthRating: 5, boardPatience: 5, ...over,
  };
}

describe('storyline chain content', () => {
  it('has at least 23 chains with unique ids and names', () => {
    expect(STORYLINE_CHAINS.length).toBeGreaterThanOrEqual(23);
    expect(new Set(STORYLINE_CHAINS.map(c => c.id)).size).toBe(STORYLINE_CHAINS.length);
    expect(new Set(STORYLINE_CHAINS.map(c => c.name)).size).toBe(STORYLINE_CHAINS.length);
  });

  it('every chain is well-formed', () => {
    for (const chain of STORYLINE_CHAINS) {
      expect(chain.steps.length, chain.id).toBeGreaterThanOrEqual(2);
      expect(chain.steps[0].weekOffset, `${chain.id} starts at offset 0`).toBe(0);
      expect(chain.steps[0].requiredPrevChoice, `${chain.id} first step cannot branch`).toBeUndefined();
      for (let i = 0; i < chain.steps.length; i++) {
        const step = chain.steps[i];
        if (i > 0) expect(step.weekOffset, `${chain.id} step ${i} offset`).toBeGreaterThan(chain.steps[i - 1].weekOffset);
        expect(step.title.trim().length, `${chain.id} step ${i} title`).toBeGreaterThan(0);
        expect(step.body.trim().length, `${chain.id} step ${i} body`).toBeGreaterThan(20);
        expect(step.options.length, `${chain.id} step ${i} options`).toBe(3);
        if (step.requiredPrevChoice !== undefined) {
          expect(step.requiredPrevChoice).toBeGreaterThanOrEqual(0);
          expect(step.requiredPrevChoice).toBeLessThan(chain.steps[i - 1].options.length);
        }
        const labels = step.options.map(o => o.label);
        expect(new Set(labels).size, `${chain.id} step ${i} duplicate labels`).toBe(labels.length);
        for (const o of step.options) {
          expect(o.label.trim().length).toBeGreaterThan(0);
          expect(o.text.trim().length).toBeGreaterThan(0);
          expect(Object.keys(o.effects).length, `${chain.id} "${o.label}" has no effect`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps every effect inside the original chains\' ranges', () => {
    for (const { chainId, option } of allOptions()) {
      for (const [stat, [lo, hi]] of Object.entries(BOUNDS)) {
        const v = option.effects[stat as keyof typeof BOUNDS];
        if (v === undefined) continue;
        expect(Number.isInteger(v), `${chainId} ${stat}`).toBe(true);
        expect(v, `${chainId} "${option.label}" ${stat}`).toBeGreaterThanOrEqual(lo);
        expect(v, `${chainId} "${option.label}" ${stat}`).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('only uses placeholders the loop fills, and only where they are filled', () => {
    for (const chain of STORYLINE_CHAINS) {
      for (const step of chain.steps) {
        // Titles and labels are shown verbatim — never interpolated.
        expect(placeholders(step.title), `${chain.id} title`).toEqual([]);
        for (const o of step.options) expect(placeholders(o.label), `${chain.id} label`).toEqual([]);

        const used = [step.body, ...step.options.map(o => o.text)].flatMap(placeholders);
        for (const name of used) expect(CHAIN_PLACEHOLDERS as readonly string[]).toContain(name);
        if (!chain.target) {
          expect(used, `${chain.id} names a player but resolves no target`).not.toContain('playerName');
        }
      }
    }
  });

  it('applies player morale only in chains that have a player to apply it to', () => {
    for (const chain of STORYLINE_CHAINS) {
      if (chain.target) continue;
      for (const step of chain.steps) {
        for (const o of step.options) expect(o.effects.playerMorale, `${chain.id} "${o.label}"`).toBeUndefined();
      }
    }
  });

  it('every chain can trigger in some game situation', () => {
    const situations = [];
    for (let week = 1; week <= 40; week++) {
      for (const flags of [false, true]) {
        situations.push({
          week, recentWins: flags ? 5 : 0, recentLosses: flags ? 0 : 3,
          boardConfidence: flags ? 80 : 20, hasStarPlayer: true, hasYouthProspect: true,
          budget: flags ? 50e6 : 1e6, averageBudget: 20e6,
          leaguePosition: flags ? 1 : 19, totalTeams: 20, relegationSpots: 3, derbyThisWeek: flags,
        });
      }
    }
    for (const chain of STORYLINE_CHAINS) {
      expect(situations.some(ctx => shouldTriggerChain(chain.id, ctx)), `${chain.id} can never trigger`).toBe(true);
    }
  });

  it('every step icon resolves to a real glyph, not the star fallback', () => {
    for (const chain of STORYLINE_CHAINS) {
      for (const step of chain.steps) {
        if (step.icon === 'star' || step.icon === 'sparkles') continue;
        const { container, unmount } = render(<DynamicIcon name={step.icon} />);
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('class') ?? '', `${chain.id} icon "${step.icon}"`).not.toMatch(/lucide-star\b/);
        unmount();
      }
    }
  });
});

describe('situational triggers', () => {
  const base = {
    week: 30, recentWins: 1, recentLosses: 1, boardConfidence: 50, hasStarPlayer: false,
    hasYouthProspect: false, budget: 10e6, averageBudget: 10e6,
  };

  it('title race needs a top-two place in a real league, late enough to matter', () => {
    expect(shouldTriggerChain('title-race-nerves', { ...base, leaguePosition: 2, totalTeams: 20 })).toBe(true);
    expect(shouldTriggerChain('title-race-nerves', { ...base, leaguePosition: 3, totalTeams: 20 })).toBe(false);
    expect(shouldTriggerChain('title-race-nerves', { ...base, week: 12, leaguePosition: 1, totalTeams: 20 })).toBe(false);
    expect(shouldTriggerChain('title-race-nerves', { ...base, leaguePosition: 1, totalTeams: 4 })).toBe(false);
    expect(shouldTriggerChain('title-race-nerves', base)).toBe(false);
  });

  it('relegation dogfight never fires in a league without relegation', () => {
    expect(shouldTriggerChain('relegation-dogfight', { ...base, leaguePosition: 18, totalTeams: 20, relegationSpots: 3 })).toBe(true);
    expect(shouldTriggerChain('relegation-dogfight', { ...base, leaguePosition: 17, totalTeams: 20, relegationSpots: 3 })).toBe(true);
    expect(shouldTriggerChain('relegation-dogfight', { ...base, leaguePosition: 16, totalTeams: 20, relegationSpots: 3 })).toBe(false);
    expect(shouldTriggerChain('relegation-dogfight', { ...base, leaguePosition: 20, totalTeams: 20, relegationSpots: 0 })).toBe(false);
  });

  it('derby week only fires when this week\'s opponent is the rival', () => {
    expect(shouldTriggerChain('derby-build-up', { ...base, derbyThisWeek: true })).toBe(true);
    expect(shouldTriggerChain('derby-build-up', { ...base, derbyThisWeek: false })).toBe(false);
  });
});

describe('pickChainTarget', () => {
  it('star: best available 75+ who is not unsettled or on the market', () => {
    const squad = [
      player({ id: 'a', overall: 82, listedForSale: true }),
      player({ id: 'b', overall: 80, injured: true, injuryWeeks: 2 }),
      player({ id: 'c', overall: 78 }),
      player({ id: 'd', overall: 76 }),
    ];
    expect(pickChainTarget('star', squad)?.id).toBe('c');
    expect(pickChainTarget('star', [player({ overall: 70 })])).toBeNull();
  });

  it('youth: the highest-potential youngster', () => {
    const squad = [
      player({ id: 'old', age: 26, potential: 90 }),
      player({ id: 'y1', age: 19, potential: 80 }),
      player({ id: 'y2', age: 18, potential: 86, overall: 60 }),
    ];
    expect(pickChainTarget('youth', squad)?.id).toBe('y2');
    expect(pickChainTarget('youth', [player({ age: 20, potential: 70 })])).toBeNull();
  });

  it('injured: only a genuinely long lay-off counts', () => {
    const shortKnock = player({ id: 's', injured: true, injuryWeeks: STORYLINE_COMEBACK_MIN_INJURY_WEEKS - 1 });
    const longTerm = player({ id: 'l', injured: true, injuryWeeks: STORYLINE_COMEBACK_MIN_INJURY_WEEKS + 3 });
    expect(pickChainTarget('injured', [shortKnock])).toBeNull();
    expect(pickChainTarget('injured', [shortKnock, longTerm])?.id).toBe('l');
  });

  it('striker: a first-team ST who really is in a drought', () => {
    const drought = player({ id: 'st', position: 'ST', appearances: STORYLINE_DROUGHT_MIN_APPS, goals: STORYLINE_DROUGHT_MAX_GOALS });
    const scoring = player({ id: 'st2', position: 'ST', appearances: 12, goals: 7, overall: 80 });
    const tooFewGames = player({ id: 'st3', position: 'ST', appearances: STORYLINE_DROUGHT_MIN_APPS - 1, goals: 0 });
    const notAStriker = player({ id: 'cm', position: 'CM', appearances: 12, goals: 0 });
    expect(pickChainTarget('striker', [scoring, tooFewGames, notAStriker])).toBeNull();
    expect(pickChainTarget('striker', [scoring, drought])?.id).toBe('st');
  });

  it('new signing: someone bought this season, matched by name', () => {
    const signing = player({ id: 'n', firstName: 'Nico', lastName: 'New' });
    const squad = [player({ id: 'x' }), signing];
    expect(pickChainTarget('new-signing', squad, { recentSigningNames: ['Nico New'] })?.id).toBe('n');
    expect(pickChainTarget('new-signing', squad, { recentSigningNames: [] })).toBeNull();
  });

  it('never picks a player out on loan', () => {
    expect(pickChainTarget('star', [player({ overall: 85, onLoan: true })])).toBeNull();
  });
});

describe('topRivalId + interpolation', () => {
  it('prefers a same-division derby, then an earned grudge, never a mere frequent opponent', () => {
    const clubs: Record<string, Club> = {
      'arsenal': club('arsenal'),
      'tottenham-hotspur': club('tottenham-hotspur'),
      'fulham': club('fulham'),
    };
    expect(topRivalId('arsenal', clubs, {})).toBe('tottenham-hotspur');

    const noDerby = { 'arsenal': club('arsenal'), 'fulham': club('fulham') };
    const met = { fulham: { wins: 3, draws: 2, losses: 3, grudgeLevel: 0 } };
    expect(topRivalId('arsenal', noDerby, met as never)).toBeNull();
    const grudge = { fulham: { wins: 1, draws: 0, losses: 3, grudgeLevel: 3 } };
    expect(topRivalId('arsenal', noDerby, grudge as never)).toBe('fulham');
  });

  it('fills every placeholder and never leaves braces behind', () => {
    const text = '{playerName} of {clubName} faces {rivalName}.';
    expect(interpolateChainText(text, { playerName: 'Ann Bee', clubName: 'City', rivalName: 'United' }))
      .toBe('Ann Bee of City faces United.');
    expect(interpolateChainText(text, {})).not.toMatch(/[{}]/);
  });
});

// ── Game-loop wiring ──────────────────────────────────────────────────────────

const CLUB = 'manchester-city';
const injuryDetails = (weeks: number): InjuryDetails => ({
  type: 'hamstring', severity: 'severe', weeksRemaining: weeks, totalWeeks: weeks,
  reinjuryRisk: 0.1, reinjuryWeeksRemaining: 4, fitnessOnReturn: 65,
});

describe('storyline chains in advanceWeek', () => {
  let baseline: ReturnType<typeof useGameStore.getState> | null = null;

  beforeAll(async () => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    localStorage.clear();
    await useGameStore.getState().initGame(CLUB);
    baseline = useGameStore.getState();
  }, 60_000);

  beforeEach(() => {
    const b = baseline!;
    useGameStore.setState(JSON.parse(JSON.stringify({
      season: b.season, week: 11, clubs: b.clubs, players: b.players, fixtures: b.fixtures,
      leagueTable: b.leagueTable, messages: [], activeStorylineChains: [], completedStorylineChainIds: [],
      pendingStoryline: null, boardConfidence: b.boardConfidence,
    })));
  });

  it('a targeted chain starts about the player who fits it', { timeout: 60_000 }, async () => {
    const st = useGameStore.getState();
    const squad = st.clubs[CLUB].playerIds.map(id => st.players[id]).filter(Boolean);
    const victim = squad.find(p => p.position !== 'GK')!;
    // Everything except the injury comeback is on cooldown this season.
    const cooled = STORYLINE_CHAINS.filter(c => c.id !== 'injury-comeback').map(c => `${c.id}@${st.season}`);
    // Heal everyone else so the victim is the only long-term absentee.
    const players = { ...st.players };
    for (const p of squad) players[p.id] = { ...p, injured: false, injuryWeeks: 0, injuryDetails: undefined };
    players[victim.id] = { ...victim, injured: true, injuryWeeks: 10, injuryDetails: injuryDetails(10) };
    useGameStore.setState({ players, completedStorylineChainIds: cooled });

    for (let i = 0; i < 3 && useGameStore.getState().activeStorylineChains.length === 0; i++) {
      await useGameStore.getState().advanceWeek();
    }
    const chain = useGameStore.getState().activeStorylineChains[0];
    expect(chain?.chainId).toBe('injury-comeback');
    expect(chain?.targetPlayerId).toBe(victim.id);
    const pending = useGameStore.getState().pendingStoryline;
    if (pending?.id.startsWith('chain-injury-comeback')) {
      expect(pending.body).toContain(`${victim.firstName} ${victim.lastName}`);
      expect(pending.body).not.toMatch(/[{}]/);
    }
  });

  it('ends a chain early once its player has left the club', { timeout: 60_000 }, async () => {
    const st = useGameStore.getState();
    const target = st.players[st.clubs[CLUB].playerIds[0]];
    const otherClub = Object.keys(st.clubs).find(id => id !== CLUB)!;
    useGameStore.setState({
      players: { ...st.players, [target.id]: { ...target, clubId: otherClub } },
      activeStorylineChains: [{ chainId: 'wonderkid-hype', startWeek: st.week, currentStep: 0, choices: [0], targetPlayerId: target.id }],
      // Keep the trigger block from immediately starting another chain.
      completedStorylineChainIds: STORYLINE_CHAINS.map(c => `${c.id}@${st.season}`),
    });
    await useGameStore.getState().advanceWeek();
    const after = useGameStore.getState();
    expect(after.activeStorylineChains.some(c => c.chainId === 'wonderkid-hype')).toBe(false);
    expect(after.completedStorylineChainIds).toContain(`wonderkid-hype@${st.season}`);
    expect(after.messages.some(m => m.title === 'Wonderkid Hype — Resolved'
      && m.body.includes(`${target.firstName} ${target.lastName} left the club`))).toBe(true);
  });

  it('an untargeted chain resolves without the "Your star player saga" line', { timeout: 60_000 }, async () => {
    const st = useGameStore.getState();
    useGameStore.setState({
      activeStorylineChains: [{ chainId: 'ticket-price-row', startWeek: st.week - 6, currentStep: 2, choices: [0, 1, 2] }],
      completedStorylineChainIds: STORYLINE_CHAINS.map(c => `${c.id}@${st.season}`),
    });
    await useGameStore.getState().advanceWeek();
    const msg = useGameStore.getState().messages.find(m => m.title === 'Ticket Price Row — Resolved');
    expect(msg).toBeTruthy();
    expect(msg!.body).not.toMatch(/star player/i);
    expect(msg!.body).toContain('Leave it to them');
  });
});
