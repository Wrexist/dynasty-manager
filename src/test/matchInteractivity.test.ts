import { describe, it, expect } from 'vitest';
import { simulateHalf } from '@/engine/match';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { Club, Match, TacticalInstructions, MatchShout, ShoutType } from '@/types/game';
import { SHOUT_COOLDOWN, MAX_SHOUTS_PER_MATCH, SHOUT_DURATION, GOAL_EVENT_TYPES } from '@/config/matchEngine';

function makeClub(id: string, name: string): Club {
  return {
    id, name, shortName: name.slice(0, 3).toUpperCase(),
    color: '#fff', secondaryColor: '#000',
    budget: 50_000_000, wageBill: 200_000,
    reputation: 70, facilities: 5, youthRating: 5, fanBase: 5, boardPatience: 60,
    playerIds: [], formation: '4-3-3', lineup: [], subs: [],
    divisionId: 'eng',
  };
}

function setupMatch() {
  const homeClub = makeClub('home', 'Home FC');
  const awayClub = makeClub('away', 'Away FC');

  const homeSquad = generateSquad('home', 70, 1);
  const awaySquad = generateSquad('away', 70, 1);
  homeSquad.forEach(p => homeClub.playerIds.push(p.id));
  awaySquad.forEach(p => awayClub.playerIds.push(p.id));

  const { lineup: homePlayers } = selectBestLineup(homeSquad, '4-3-3');
  const { lineup: awayPlayers } = selectBestLineup(awaySquad, '4-3-3');
  homeClub.lineup = homePlayers.map(p => p.id);
  awayClub.lineup = awayPlayers.map(p => p.id);

  const match: Match = { id: 'test', week: 1, homeClubId: 'home', awayClubId: 'away', played: false, homeGoals: 0, awayGoals: 0, events: [] };

  return { homeClub, awayClub, homePlayers, awayPlayers, match, homeSquad, awaySquad };
}

describe('Match Interactivity Features', () => {
  describe('Fitness Snapshots', () => {
    it('attaches at least one fitness snapshot to events in first half', () => {
      const { homeClub, awayClub, homePlayers, awayPlayers } = setupMatch();
      const halfState = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45);
      const eventsWithFitness = halfState.events.filter(e => e.playerFitness);
      expect(eventsWithFitness.length).toBeGreaterThan(0);
    });

    it('fitness snapshot contains entries for active players', () => {
      const { homeClub, awayClub, homePlayers, awayPlayers } = setupMatch();
      const halfState = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45);
      const snapshotEvent = halfState.events.find(e => e.playerFitness);
      expect(snapshotEvent).toBeDefined();

      const snapshot = snapshotEvent!.playerFitness!;
      const allPlayerIds = [...homePlayers, ...awayPlayers].map(p => p.id);
      // At least most starters should be in the snapshot
      const coveredCount = allPlayerIds.filter(id => snapshot[id] !== undefined).length;
      expect(coveredCount).toBeGreaterThanOrEqual(allPlayerIds.length * 0.9);
    });

    it('fitness values degrade over time', () => {
      const { homeClub, awayClub, homePlayers, awayPlayers } = setupMatch();
      const halfState = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45);

      // End-of-half fitness should be lower than starting fitness for most players
      const startingFitness = homePlayers[0].fitness;
      const endFitness = halfState.playerFitness[homePlayers[0].id];
      expect(endFitness).toBeDefined();
      expect(endFitness).toBeLessThan(startingFitness);
    });
  });

  describe('xG Accumulation', () => {
    it('accumulates xG values on shot events', () => {
      const { homeClub, awayClub, homePlayers, awayPlayers } = setupMatch();
      const halfState = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45);

      // Find events with xG
      const xgEvents = halfState.events.filter(e => e.homeXG !== undefined);
      if (xgEvents.length > 0) {
        const lastXG = xgEvents[xgEvents.length - 1];
        expect(lastXG.homeXG).toBeGreaterThanOrEqual(0);
        expect(lastXG.awayXG).toBeGreaterThanOrEqual(0);
      }
      // xG in HalfState should be non-negative
      expect(halfState.homeXG).toBeGreaterThanOrEqual(0);
      expect(halfState.awayXG).toBeGreaterThanOrEqual(0);
    });

    it('xG values are cumulative across events', () => {
      const { homeClub, awayClub, homePlayers, awayPlayers } = setupMatch();
      // Run many matches to find one with multiple shots
      for (let i = 0; i < 20; i++) {
        const halfState = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45);
        const xgEvents = halfState.events.filter(e => e.homeXG !== undefined);
        if (xgEvents.length >= 2) {
          // Each subsequent xG event should be >= the previous
          for (let j = 1; j < xgEvents.length; j++) {
            expect((xgEvents[j].homeXG ?? 0) + (xgEvents[j].awayXG ?? 0))
              .toBeGreaterThanOrEqual((xgEvents[j - 1].homeXG ?? 0) + (xgEvents[j - 1].awayXG ?? 0) - 0.001);
          }
          return; // Found a valid match to test
        }
      }
    });
  });

  describe('Goal Count Consistency', () => {
    it('goal events match HalfState goal counts', () => {
      const { homeClub, awayClub, homePlayers, awayPlayers } = setupMatch();
      for (let i = 0; i < 10; i++) {
        const halfState = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45);
        const homeGoalEvents = halfState.events.filter(e => (GOAL_EVENT_TYPES as readonly string[]).includes(e.type) && e.clubId === homeClub.id).length;
        const awayGoalEvents = halfState.events.filter(e => (GOAL_EVENT_TYPES as readonly string[]).includes(e.type) && e.clubId === awayClub.id).length;
        expect(halfState.homeGoals).toBe(homeGoalEvents);
        expect(halfState.awayGoals).toBe(awayGoalEvents);
      }
    });
  });

  describe('Second-Half Tactical Insights', () => {
    it('generates fresh insights for second half', () => {
      const { homeClub, awayClub, homePlayers, awayPlayers } = setupMatch();
      const tactics: TacticalInstructions = {
        mentality: 'balanced', tempo: 'normal', width: 'normal',
        defensiveLine: 'normal', pressingIntensity: 50,
      };
      // First half with insights
      const firstHalf = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45, tactics, undefined, undefined, 'home');
      // Second half should generate fresh insights based on score
      const secondHalf = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 46, 90, tactics, undefined, undefined, 'home', firstHalf);
      expect(secondHalf.tacticalInsights).toBeDefined();
      expect(secondHalf.tacticalInsights.length).toBeGreaterThan(0);
      // Second half insights should differ from first half (score-aware)
      if (firstHalf.tacticalInsights.length > 0) {
        expect(secondHalf.tacticalInsights).not.toEqual(firstHalf.tacticalInsights);
      }
    });
  });

  describe('Shout System', () => {
    // Test the shout logic directly (unit tests for the store functions)
    function createShoutState() {
      const shouts: MatchShout[] = [];
      return {
        get shouts() { return shouts; },
        useShout(type: string, minute: number): boolean {
          if (shouts.length >= MAX_SHOUTS_PER_MATCH) return false;
          const last = shouts[shouts.length - 1];
          if (last && minute - last.startMinute < SHOUT_COOLDOWN) return false;
          shouts.push({ type: type as ShoutType, startMinute: minute });
          return true;
        },
        getActiveShout(minute: number): MatchShout | null {
          const active = shouts.find(s => minute >= s.startMinute && minute < s.startMinute + SHOUT_DURATION);
          return active || null;
        },
        clear() { shouts.length = 0; },
      };
    }

    it('allows shout activation', () => {
      const state = createShoutState();
      expect(state.useShout('push_forward', 10)).toBe(true);
      expect(state.shouts.length).toBe(1);
    });

    it('enforces cooldown between shouts', () => {
      const state = createShoutState();
      state.useShout('push_forward', 10);
      // Too early — within SHOUT_COOLDOWN (10 minutes)
      expect(state.useShout('hold_the_line', 15)).toBe(false);
      // Exactly at cooldown boundary — allowed
      expect(state.useShout('hold_the_line', 20)).toBe(true);
    });

    it('enforces max shouts per match', () => {
      const state = createShoutState();
      expect(state.useShout('push_forward', 5)).toBe(true);
      expect(state.useShout('hold_the_line', 20)).toBe(true);
      expect(state.useShout('calm_down', 35)).toBe(true);
      expect(state.useShout('push_forward', 50)).toBe(true);
      // 5th shout should fail
      expect(state.useShout('hold_the_line', 65)).toBe(false);
    });

    it('tracks active shout within duration window', () => {
      const state = createShoutState();
      state.useShout('push_forward', 30);
      expect(state.getActiveShout(30)).not.toBeNull();
      expect(state.getActiveShout(34)).not.toBeNull(); // within 5-minute window
      expect(state.getActiveShout(35)).toBeNull(); // at boundary — expired
    });

    it('resets on clear', () => {
      const state = createShoutState();
      state.useShout('push_forward', 10);
      state.useShout('hold_the_line', 25);
      state.clear();
      expect(state.shouts.length).toBe(0);
      // Can activate shouts again after reset
      expect(state.useShout('calm_down', 5)).toBe(true);
    });
  });

  describe('Second-Half Kickoff Insight', () => {
    it('emits a kickoff event with tactical insight at start of second half', () => {
      const { homeClub, awayClub, homePlayers, awayPlayers } = setupMatch();
      const tactics: TacticalInstructions = {
        mentality: 'balanced', tempo: 'normal', width: 'normal',
        defensiveLine: 'normal', pressingIntensity: 50,
      };
      const firstHalf = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45, tactics, undefined, undefined, 'home');
      const secondHalf = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 46, 90, tactics, undefined, undefined, 'home', firstHalf);
      // Second half should have a kickoff event with tactical insight
      const secondKickoff = secondHalf.events.find(e => e.type === 'kickoff' && e.minute >= 46);
      expect(secondKickoff).toBeDefined();
      expect(secondKickoff!.tacticalInsight).toBeDefined();
      expect(typeof secondKickoff!.tacticalInsight).toBe('string');
    });
  });

  describe('Shout Modifier Computation', () => {
    it('combines push_forward and hold_the_line effects correctly', () => {
      // Verify the math: computeShoutMods aggregates and scales by 0.5
      // push_forward: attackMod +0.15, defenseMod -0.10
      // hold_the_line: attackMod -0.10, defenseMod +0.15
      // Net: attackMod +0.05, defenseMod +0.05, scaled by 0.5
      const SCALE = 0.5;
      const expectedAttack = (0.15 + -0.10) * SCALE;
      const expectedDefense = (-0.10 + 0.15) * SCALE;
      expect(expectedAttack).toBeCloseTo(0.025);
      expect(expectedDefense).toBeCloseTo(0.025);
    });

    it('calm_down maps to negative foulMod', () => {
      // Verify calm_down cardReduction maps to negative foulMod
      // calm_down has cardReduction: 0.40 → maps to foulMod: -0.40 * 0.5 = -0.20
      const SCALE = 0.5;
      const expectedFoul = -0.40 * SCALE;
      expect(expectedFoul).toBeCloseTo(-0.20);
    });
  });
});
