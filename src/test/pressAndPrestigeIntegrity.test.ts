/**
 * Regression: authored press-conference content must be reachable, and
 * prestige must not desync a career.
 *
 * 1. **Nine of the twelve press contexts never shipped.** `getPressContext`
 *    authors derby preview, injury crisis, transfer rumour, promotion race,
 *    relegation battle, big match, new signing and good/poor form — roughly 66
 *    of the 90 questions in `pressConferences.ts` — but it had zero production
 *    importers. Every call site hardcoded
 *    `won ? 'post_win' : lost ? 'post_loss' : 'post_draw'`.
 *    `getPostMatchPressContext` lets the situational contexts through a
 *    minority of the time, while keeping the result dominant and excluding the
 *    two preview-tense contexts, which read wrong after a match.
 *
 * 2. **Prestige desynced a career.** It re-inits the game at a new club and
 *    never touches `careerManager`, so `playerClubId` and `contract.clubId`
 *    named different clubs and the open `careerHistory` entry never closed —
 *    season-end then paid the new club's budget against the old club's terms.
 *    Prestige is a sandbox arc; career mode has the job market and retirement.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getPostMatchPressContext } from '@/data/pressConferences';
import { useGameStore } from '@/store/gameStore';
import { UNEMPLOYED_ALLOWED_SCREENS } from '@/config/navigation';

const realRandom = Math.random;
afterAll(() => { Math.random = realRandom; });

describe('post-match press conferences reach the authored contexts', () => {
  afterAll(() => { Math.random = realRandom; });

  it('always reports the result when the situational roll fails', () => {
    Math.random = () => 0.99; // above PRESS_SITUATIONAL_POST_MATCH_CHANCE
    expect(getPostMatchPressContext(true, false, ['W'], false)).toBe('post_win');
    expect(getPostMatchPressContext(false, true, ['L'], false)).toBe('post_loss');
    expect(getPostMatchPressContext(false, false, ['D'], false)).toBe('post_draw');
  });

  it('reaches a situational context that was previously unreachable', () => {
    Math.random = () => 0.0; // situational roll succeeds
    // Three injured players is the injury-crisis threshold.
    const ctx = getPostMatchPressContext(true, false, ['W', 'W'], false, { injuredCount: 5 });
    expect(ctx).toBe('injury_crisis');
    expect(ctx).not.toBe('post_win');
  });

  it('never returns a preview-tense context after a match', () => {
    // Sweep the roll space; derby/big-match questions are written in the
    // future tense and must not appear post-match under any draw.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      Math.random = () => (i % 100) / 100;
      seen.add(getPostMatchPressContext(false, true, ['L', 'L', 'L'], true, {
        leaguePosition: 19, totalTeams: 20, injuredCount: 4, recentSigning: true,
      }));
    }
    expect(seen.has('derby_preview')).toBe(false);
    expect(seen.has('pre_big_match')).toBe(false);
    // ...and it did reach beyond the result trio.
    expect([...seen].some(c => !c.startsWith('post_'))).toBe(true);
  });
});

describe('prestige is unavailable in career mode', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame('manchester-city');
  });

  it('startPrestige is a no-op for a career manager', () => {
    useGameStore.setState({ gameMode: 'career' });
    const before = {
      club: useGameStore.getState().playerClubId,
      prestige: useGameStore.getState().managerProgression.prestigeLevel || 0,
    };
    useGameStore.getState().startPrestige('rival');
    const after = useGameStore.getState();
    expect(after.playerClubId).toBe(before.club);
    expect(after.managerProgression.prestigeLevel || 0).toBe(before.prestige);
  });

  it('is not reachable from the unemployed-career screen whitelist', () => {
    expect([...UNEMPLOYED_ALLOWED_SCREENS]).not.toContain('prestige');
  });

  it('still works in sandbox', async () => {
    expect(useGameStore.getState().gameMode).not.toBe('career');
    useGameStore.getState().startPrestige('rival');
    await vi.waitFor(() => {
      expect(useGameStore.getState().managerProgression.prestigeLevel).toBe(1);
    });
  });
});
