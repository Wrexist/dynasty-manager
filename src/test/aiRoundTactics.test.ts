/**
 * The AI round played alongside the player's league match uses the same
 * counter-tactics as every other AI-vs-AI path (simfinish item 5).
 *
 * When the player finishes a league match, `matchActions` simulates the rest of
 * that division's round so the post-match table is right. Both of those loops
 * (instant sim and the live second half) called `simulateMatch` with no
 * tactics, so the engine fell back to each profile's kick-off defaults — while
 * the same fixtures, had they been played by `advanceWeek`, would have faced an
 * opponent-aware setup (`getAICounterTactics`). Two rulebooks for one round.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Match, TacticalInstructions } from '@/types/game';

const calls = vi.hoisted(() => [] as { match: Match; home?: TacticalInstructions; away?: TacticalInstructions }[]);

vi.mock('@/engine/match', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/engine/match')>();
  return {
    ...mod,
    simulateMatch: (...args: Parameters<typeof mod.simulateMatch>) => {
      calls.push({ match: args[0], home: args[5], away: args[6] });
      return mod.simulateMatch(...args);
    },
  };
});

import { useGameStore } from '@/store/gameStore';
import { aiMatchTactics } from '@/store/slices/orchestration/helpers';

const CLUB = 'arsenal';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;

const involves = (m: { homeClubId: string; awayClubId: string }) => m.homeClubId === CLUB || m.awayClubId === CLUB;

beforeEach(() => {
  calls.length = 0;
  Math.random = mulberry32(0x7AC7);
  useGameStore.getState().resetGame();
  useGameStore.getState().initGame(CLUB);
  const s = useGameStore.getState();
  // A league week with no cup tie of ours, so the league match is the match.
  const cupWeeks = new Set([...s.cup.ties, ...(s.leagueCup?.ties ?? [])].filter(involves).map(t => t.week));
  const own = s.fixtures.filter(involves).sort((a, b) => a.week - b.week).find(f => f.week >= 3 && !cupWeeks.has(f.week))!;
  useGameStore.setState({ week: own.week, friendlies: [], settings: { ...s.settings, autoSave: false } });
});
afterEach(() => { Math.random = realRandom; });

/** The AI-vs-AI fixtures of the player's division this week, as simulated. */
function aiRoundCalls() {
  const s = useGameStore.getState();
  const ids = new Set(s.fixtures.filter(m => m.week === s.week && !involves(m)).map(m => m.id));
  return calls.filter(c => ids.has(c.match.id));
}

describe('the AI round alongside the player\'s match', () => {
  it('instant sim: every AI fixture gets counter-tactics', () => {
    useGameStore.getState().playCurrentMatch();
    const round = aiRoundCalls();
    expect(round.length).toBeGreaterThan(0);
    for (const c of round) {
      expect(c.home, c.match.id).toBeDefined();
      expect(c.away, c.match.id).toBeDefined();
    }
  });

  it('live match: every AI fixture gets counter-tactics', () => {
    expect(useGameStore.getState().playFirstHalf()).not.toBeNull();
    useGameStore.getState().playSecondHalf();
    const round = aiRoundCalls();
    expect(round.length).toBeGreaterThan(0);
    for (const c of round) {
      expect(c.home, c.match.id).toBeDefined();
      expect(c.away, c.match.id).toBeDefined();
    }
  });
});

describe('aiMatchTactics', () => {
  it('each side reads the other\'s default setup; no profile, no counter', () => {
    const s = useGameStore.getState();
    const [a, b] = s.divisionClubs[s.playerDivision].filter(id => id !== CLUB).map(id => s.clubs[id]);
    // Fully adaptable: every applicable counter fires.
    const adaptable = (c: typeof a) => ({ ...c, aiManagerProfile: { ...c.aiManagerProfile!, adaptability: 1 } });
    const highLine = { ...a.aiManagerProfile!.defaultTactics, defensiveLine: 'high' as const };
    const home = { ...adaptable(a), aiManagerProfile: { ...adaptable(a).aiManagerProfile, defaultTactics: highLine } };
    const t = aiMatchTactics(home, adaptable(b));
    // The away side counters the home side's high line.
    expect(t.away?.tempo).toBe('fast');
    expect(t.away?.defensiveLine).toBe('deep');
    expect(aiMatchTactics({ ...a, aiManagerProfile: undefined }, b)).toEqual({});
  });
});
