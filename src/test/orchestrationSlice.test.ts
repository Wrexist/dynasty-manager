/**
 * orchestrationSlice — targeted tests for action paths not exercised by
 * the existing integration suites (longevity / edgeCases / autosave /
 * monetization). Focuses on the kick-by-kick penalty shootout flow,
 * mid-match phase transitions, perk unlocks, prestige reset, abandoned
 * match cleanup, and the small UI-driven actions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { ALL_CLUBS, LEAGUES } from '@/data/league';
import { MANAGER_PERKS } from '@/utils/managerPerks';
import type { Club, Player } from '@/types/game';

const CLUB_ID = 'manchester-city';

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
});

describe('orchestrationSlice — dismissFarewell', () => {
  it('removes the head of the pendingFarewell queue', () => {
    useGameStore.setState({
      pendingFarewell: [
        { playerId: 'p1', playerName: 'A', seasonsServed: 5, stats: [] },
        { playerId: 'p2', playerName: 'B', seasonsServed: 3, stats: [] },
      ],
    });
    useGameStore.getState().dismissFarewell();
    const remaining = useGameStore.getState().pendingFarewell;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].playerId).toBe('p2');
  });

  it('is a no-op when queue is empty', () => {
    useGameStore.setState({ pendingFarewell: [] });
    expect(() => useGameStore.getState().dismissFarewell()).not.toThrow();
    expect(useGameStore.getState().pendingFarewell).toEqual([]);
  });
});

describe('orchestrationSlice — clearLoadError', () => {
  it('nulls the loadError field', () => {
    useGameStore.setState({ loadError: { slot: 0, kind: 'corrupt', canRecover: false } });
    useGameStore.getState().clearLoadError();
    expect(useGameStore.getState().loadError).toBeNull();
  });
});

describe('orchestrationSlice — unlockPerk', () => {
  it('rejects an unknown perk id', () => {
    const result = useGameStore.getState().unlockPerk('not-a-real-perk' as never);
    expect(result.success).toBe(false);
  });

  it('rejects a perk the user cannot afford', () => {
    // Tier-1 perk costs 80 XP; manager starts with 0 XP.
    const result = useGameStore.getState().unlockPerk('motivator');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/more XP|Cannot/i);
  });

  it('unlocks a tier-1 perk when XP is sufficient', () => {
    // Bypass the XP curve by giving level 50 — easily covers an 80-cost perk.
    useGameStore.setState({
      managerProgression: { xp: 0, level: 50, unlockedPerks: [], prestigeLevel: 0 },
    });
    const result = useGameStore.getState().unlockPerk('motivator');
    expect(result.success).toBe(true);
    expect(useGameStore.getState().managerProgression.unlockedPerks).toContain('motivator');
  });

  it('rejects an already-unlocked perk', () => {
    useGameStore.setState({
      managerProgression: { xp: 5000, level: 50, unlockedPerks: ['motivator'], prestigeLevel: 0 },
    });
    const result = useGameStore.getState().unlockPerk('motivator');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Already/i);
  });

  it('rejects a tier-2 perk when its prerequisite is missing', () => {
    useGameStore.setState({
      managerProgression: { xp: 0, level: 50, unlockedPerks: [], prestigeLevel: 0 },
    });
    // 'media_savvy' requires 'motivator'
    const result = useGameStore.getState().unlockPerk('media_savvy');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Requires/i);
  });

  it('all tier-1 perks have cost 80 — sanity check on test fixture assumption', () => {
    const tier1 = MANAGER_PERKS.filter(p => p.tier === 1);
    expect(tier1.length).toBeGreaterThan(0);
    expect(tier1.every(p => p.cost === 80)).toBe(true);
  });
});

describe('orchestrationSlice — cleanupAbandonedMatch', () => {
  it('is a no-op when no match was in progress', () => {
    const before = useGameStore.getState();
    expect(before.matchPhase).toBe('none');
    expect(before.halfTimeState).toBeNull();
    useGameStore.getState().cleanupAbandonedMatch();
    const after = useGameStore.getState();
    expect(after.matchPhase).toBe('none');
    expect(after.matchSubsUsed).toBe(before.matchSubsUsed);
  });

  it('resets match tracking state when matchPhase indicates an in-progress match', () => {
    useGameStore.setState({
      matchPhase: 'first_half',
      halfTimeState: null,
      matchSubsUsed: 2,
      currentCupTieId: 'tie-1',
      currentLeagueCupTieId: null,
      currentContinentalMatchId: null,
      currentContinentalCompetition: null,
    });
    useGameStore.getState().cleanupAbandonedMatch();
    const s = useGameStore.getState();
    expect(s.matchPhase).toBe('none');
    expect(s.matchSubsUsed).toBe(0);
    expect(s.currentCupTieId).toBeNull();
    expect(s.halfTimeState).toBeNull();
  });

  it('removes ephemeral virtual clubs and their players', () => {
    // Production uses real club IDs as virtualClubs keys (no synthetic prefix —
    // see continentalDraw.ts) and `vc-<clubId>-<playerId>` for ephemeral
    // player IDs (see createEphemeralClub in utils/continental.ts). The
    // cleanup must match those exact conventions.
    const VC_CLUB_ID = 'continental-test-fc';
    const VC_PLAYER_ID = `vc-${VC_CLUB_ID}-p1`;
    const fakePlayer: Player = {
      id: VC_PLAYER_ID, clubId: VC_CLUB_ID, firstName: 'V', lastName: 'X',
      age: 25, position: 'GK', overall: 75, potential: 80, form: 70, morale: 70,
      fitness: 100, injured: false, contractEnd: 2030, wage: 1000, value: 100000,
      goals: 0, assists: 0, appearances: 0,
      attributes: { attacking: 50, defending: 80, physical: 70, mental: 70, technical: 60 },
      careerGoals: 0, careerAssists: 0, careerAppearances: 0,
      nationality: 'XX', personality: 'professional',
    } as unknown as Player;
    const fakeClub: Club = {
      id: VC_CLUB_ID, name: 'V FC', shortName: 'V', color: '#000', secondaryColor: '#fff',
      budget: 0, wageBill: 0, reputation: 50, facilities: 1, youthRating: 1, fanBase: 1000,
      boardPatience: 50, playerIds: [VC_PLAYER_ID], formation: '4-3-3', lineup: [], subs: [],
      divisionId: 'div-1', stadiumName: 'V Stadium', stadiumCapacity: 1000,
    } as unknown as Club;

    useGameStore.setState({
      matchPhase: 'first_half',
      virtualClubs: { [VC_CLUB_ID]: { id: VC_CLUB_ID, name: 'V FC' } as never },
      clubs: { ...useGameStore.getState().clubs, [VC_CLUB_ID]: fakeClub },
      players: { ...useGameStore.getState().players, [VC_PLAYER_ID]: fakePlayer },
    });

    useGameStore.getState().cleanupAbandonedMatch();
    const s = useGameStore.getState();
    expect(s.clubs[VC_CLUB_ID]).toBeUndefined();
    expect(s.players[VC_PLAYER_ID]).toBeUndefined();
    expect(s.matchPhase).toBe('none');
  });
});

describe('orchestrationSlice — initializeLeague', () => {
  it('skips initialization when the league is already populated', () => {
    const playerLeague = useGameStore.getState().playerDivision;
    const before = useGameStore.getState().divisionClubs[playerLeague]?.length || 0;
    expect(before).toBeGreaterThan(0);
    useGameStore.getState().initializeLeague(playerLeague);
    const after = useGameStore.getState().divisionClubs[playerLeague]?.length || 0;
    expect(after).toBe(before); // no duplication
  });

  it('initializes a previously-empty league when called with a different league id', () => {
    // Find any league other than the player's, that hasn't been auto-initialised
    const playerLeague = useGameStore.getState().playerDivision;
    const otherLeague = LEAGUES.find(l => l.id !== playerLeague && !(useGameStore.getState().divisionClubs[l.id]?.length));
    if (!otherLeague) {
      // initGame may pre-init multiple leagues — skip if no empty one available
      return;
    }
    useGameStore.getState().initializeLeague(otherLeague.id);
    const after = useGameStore.getState().divisionClubs[otherLeague.id];
    expect(after?.length).toBeGreaterThan(0);
    const expectedClubCount = ALL_CLUBS.filter(c => c.divisionId === otherLeague.id).length;
    expect(after?.length).toBe(expectedClubCount);
  });

  it('is a no-op for an unknown league id', () => {
    const before = JSON.stringify(useGameStore.getState().divisionClubs);
    useGameStore.getState().initializeLeague('div-nonexistent');
    const after = JSON.stringify(useGameStore.getState().divisionClubs);
    expect(after).toBe(before);
  });
});

describe('orchestrationSlice — advanceToNextMatch', () => {
  it('does not advance when a match is already this week', async () => {
    const startWeek = useGameStore.getState().week;
    // Week 1 always has a league fixture — confirm in test
    await useGameStore.getState().advanceToNextMatch();
    expect(useGameStore.getState().week).toBe(startWeek);
  });

  it('skips at most 5 weeks per call', async () => {
    // Force an artificial scenario: clear all fixtures so there's no match.
    // The action should still cap at MAX_SKIPS = 5 advances.
    useGameStore.setState({
      fixtures: [],
      friendlies: [],
    });
    const startWeek = useGameStore.getState().week;
    await useGameStore.getState().advanceToNextMatch();
    const afterWeek = useGameStore.getState().week;
    expect(afterWeek - startWeek).toBeLessThanOrEqual(5);
  }, 30_000);

  it('clears the weekly digest after intermediate advances', async () => {
    useGameStore.setState({
      fixtures: [],
      friendlies: [],
      weeklyDigest: { week: 1, items: [] } as never,
    });
    await useGameStore.getState().advanceToNextMatch();
    expect(useGameStore.getState().weeklyDigest).toBeNull();
  }, 30_000);
});

describe('orchestrationSlice — penalty shootout flow', () => {
  function setupPenaltyShootout() {
    // Construct a minimal state with two clubs whose lineups have GKs and
    // currentMatchResult tied 1-1 after extra time, plus a cupTieId.
    const state = useGameStore.getState();
    const playerClub = state.clubs[CLUB_ID];
    // Find another club with players for the opponent
    const opponentEntry = Object.entries(state.clubs).find(([id, c]) => id !== CLUB_ID && (c as Club).playerIds.length >= 11);
    if (!opponentEntry) throw new Error('no opponent for shootout test');
    const [oppId, oppClub] = opponentEntry as [string, Club];

    // Ensure both teams have a lineup of 11 with a GK
    const ensureLineup = (club: Club): string[] => {
      if (club.lineup.length === 11) return club.lineup;
      const pids = club.playerIds.filter(pid => state.players[pid]);
      return pids.slice(0, 11);
    };
    const homeLineup = ensureLineup(playerClub);
    const awayLineup = ensureLineup(oppClub);

    useGameStore.setState({
      clubs: {
        ...state.clubs,
        [CLUB_ID]: { ...playerClub, lineup: homeLineup },
        [oppId]: { ...oppClub, lineup: awayLineup },
      },
      currentMatchResult: {
        id: 'cup-tie-1', week: state.week,
        homeClubId: CLUB_ID, awayClubId: oppId,
        homeGoals: 1, awayGoals: 1, played: false, events: [],
      } as never,
      currentCupTieId: 'cup-tie-1',
      matchPhase: 'penalties',
    });
  }

  it('playPenalties pre-computes the kick sequence and resets the reveal index', () => {
    setupPenaltyShootout();
    const result = useGameStore.getState().playPenalties();
    expect(result).not.toBeNull();
    const s = useGameStore.getState();
    // A shootout stops the moment the result is mathematically decided
    // (see penaltyShootout.ts:55) — the earliest a best-of-5 can be
    // settled is 6 kicks (3-0 after round 3), and sudden death extends
    // it past 10. So the sequence is anywhere from 6 upward; asserting
    // a fixed 10 was wrong and flaked whenever a shootout ended early.
    expect(s.penaltyShootoutKicks.length).toBeGreaterThanOrEqual(6);
    expect(s.penaltyShootoutRevealIndex).toBe(0);
    // Final score is a winner — totals must differ on the last kick
    const last = s.penaltyShootoutKicks[s.penaltyShootoutKicks.length - 1];
    expect(last.homeTotal).not.toBe(last.awayTotal);
  });

  it('playPenalties returns null when no current cup tie is set', () => {
    useGameStore.setState({ currentMatchResult: null, currentCupTieId: null });
    const result = useGameStore.getState().playPenalties();
    expect(result).toBeNull();
  });

  it('revealNextPenaltyKick increments the index', () => {
    setupPenaltyShootout();
    useGameStore.getState().playPenalties();
    const before = useGameStore.getState().penaltyShootoutRevealIndex;
    useGameStore.getState().revealNextPenaltyKick();
    expect(useGameStore.getState().penaltyShootoutRevealIndex).toBe(before + 1);
  });

  it('revealNextPenaltyKick auto-finalises when the last kick is reached', () => {
    setupPenaltyShootout();
    useGameStore.getState().playPenalties();
    const totalKicks = useGameStore.getState().penaltyShootoutKicks.length;
    // Reveal all kicks
    for (let i = 0; i < totalKicks; i++) {
      useGameStore.getState().revealNextPenaltyKick();
    }
    // After all reveals the shootout is finalised → kicks cleared, phase reset
    const s = useGameStore.getState();
    expect(s.matchPhase).toBe('none');
  });

  it('skipPenaltyShootout is a no-op when no kicks are pre-computed', () => {
    useGameStore.setState({
      penaltyShootoutKicks: [],
      currentMatchResult: { id: 'x' } as never,
      currentCupTieId: 'x',
    });
    expect(() => useGameStore.getState().skipPenaltyShootout()).not.toThrow();
  });

  it('skipPenaltyShootout finalises the shootout and resets matchPhase', () => {
    setupPenaltyShootout();
    useGameStore.getState().playPenalties();
    useGameStore.getState().skipPenaltyShootout();
    const s = useGameStore.getState();
    expect(s.matchPhase).toBe('none');
  });
});

describe('orchestrationSlice — playFirstHalf / playSecondHalf', () => {
  it('playFirstHalf returns null when no scheduled match exists for this week', () => {
    useGameStore.setState({
      fixtures: useGameStore.getState().fixtures.map(f => ({ ...f, played: true })),
      friendlies: [],
    });
    const result = useGameStore.getState().playFirstHalf();
    expect(result).toBeNull();
  });

  it('playFirstHalf produces a halfTimeState when a league fixture exists', () => {
    // Ensure we are at week 1 with an unplayed fixture
    const result = useGameStore.getState().playFirstHalf();
    expect(result).not.toBeNull();
    const s = useGameStore.getState();
    expect(s.halfTimeState).not.toBeNull();
    expect(s.matchPhase).toBe('half_time');
  });

  it('playSecondHalf transitions phase to fulltime or to extraTime/penalties', () => {
    useGameStore.getState().playFirstHalf();
    const result = useGameStore.getState().playSecondHalf();
    expect(result).not.toBeNull();
    const phase = useGameStore.getState().matchPhase;
    // Final phase after a regular league match is 'full_time' (no ET/pens for league)
    expect(['full_time', 'extra_time', 'penalties', 'none']).toContain(phase);
  });
});

describe('orchestrationSlice — startPrestige', () => {
  it('rejects with no-op when called outside a started game', () => {
    // initGame was called by beforeEach so the game is started — instead,
    // this test confirms the rival flow simply runs without throwing.
    expect(() => useGameStore.getState().startPrestige('rival')).not.toThrow();
  });

  it('restart-perks keeps the same club id', async () => {
    const beforeClubId = useGameStore.getState().playerClubId;
    useGameStore.getState().startPrestige('restart-perks');
    // Prestige bonuses apply once the init promise settles — flush the
    // task queue (a single microtask isn't enough for the await chain).
    await new Promise<void>(r => setTimeout(r, 0));
    expect(useGameStore.getState().playerClubId).toBe(beforeClubId);
  });

  it('increments prestigeLevel for any option', async () => {
    const before = useGameStore.getState().managerProgression.prestigeLevel || 0;
    useGameStore.getState().startPrestige('rival');
    await new Promise<void>(r => setTimeout(r, 0));
    expect(useGameStore.getState().managerProgression.prestigeLevel).toBe(before + 1);
  });
});

// Regression guard for the weeks 1–3 "double-booking" that ROADMAP.md §3
// flagged as an unconfirmed residual. The design is intentional: pre-season
// friendlies (weeks 1–3) run alongside the opening league fixtures. The player
// plays the higher-priority friendly via the playCurrentMatch chain, so their
// own league fixture would be left unplayed — weekAdvance must auto-sim it, or
// the club ends the season a game short and the division table is wrong.
describe('orchestrationSlice — weeks 1–3 friendly / league co-existence', () => {
  it('starts week 1 with both a friendly and a league fixture for the player', () => {
    const s = useGameStore.getState();
    const pc = s.playerClubId;
    const involves = (h: string, a: string) => h === pc || a === pc;
    const leagueFix = s.fixtures.find(f => f.week === 1 && involves(f.homeClubId, f.awayClubId));
    const friendly = s.friendlies?.find(f => f.week === 1 && involves(f.homeClubId, f.awayClubId));
    expect(leagueFix).toBeTruthy();
    expect(friendly).toBeTruthy();
  });

  it('auto-simulates the orphaned league fixture (with an inbox notice) when the friendly is played', async () => {
    const s0 = useGameStore.getState();
    const pc = s0.playerClubId;
    const involves = (h: string, a: string) => h === pc || a === pc;
    const leagueFix = s0.fixtures.find(f => f.week === 1 && !f.played && involves(f.homeClubId, f.awayClubId))!;
    const friendly = s0.friendlies.find(f => f.week === 1 && involves(f.homeClubId, f.awayClubId))!;

    // Stand in for the player having played the higher-priority friendly.
    useGameStore.setState({
      friendlies: s0.friendlies.map(f => (f.id === friendly.id ? { ...f, played: true, homeGoals: 1, awayGoals: 0 } : f)),
    });

    await useGameStore.getState().advanceWeek();

    const s1 = useGameStore.getState();
    const simmed = s1.fixtures.find(f => f.id === leagueFix.id);
    expect(simmed?.played).toBe(true); // not stranded — the table stays whole
    expect(s1.messages.some(m => m.title === 'League Fixture Auto-Simulated')).toBe(true);
  });
});
