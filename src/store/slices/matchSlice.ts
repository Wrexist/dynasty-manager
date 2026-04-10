import type { GameState } from '../storeTypes';
import type { TeamTalkType, PenaltyKick, MatchShout, ShoutType, Match } from '@/types/game';
import { MAX_SUBSTITUTIONS, SHOUT_DURATION, SHOUT_COOLDOWN, MAX_SHOUTS_PER_MATCH } from '@/config/matchEngine';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createMatchSlice = (set: Set, get: Get) => ({
  friendlies: [] as Match[],
  galacticoUsedThisSeason: false,
  invincibleUsedThisSeason: false,
  preMatchSnapshot: null as GameState['preMatchSnapshot'],
  currentMatchResult: null as GameState['currentMatchResult'],
  matchSubsUsed: 0,
  matchPlayerRatings: [] as GameState['matchPlayerRatings'],
  halfTimeState: null as GameState['halfTimeState'],
  matchPhase: 'none' as GameState['matchPhase'],
  matchTeamTalk: 'none' as TeamTalkType,
  preMatchLeaguePosition: 10,
  lastMatchXPGain: 0,
  currentCupTieId: null as GameState['currentCupTieId'],
  penaltyShootoutKicks: [] as PenaltyKick[],
  penaltyShootoutRevealIndex: 0,
  matchShouts: [] as MatchShout[],

  clearMatchResult: () => set({ currentMatchResult: null, halfTimeState: null, matchPhase: 'none', matchTeamTalk: 'none', currentCupTieId: null, penaltyShootoutKicks: [], penaltyShootoutRevealIndex: 0, matchShouts: [] }),

  /** Invincible perk: rewind a lost match by restoring pre-match state */
  rewindMatch: () => {
    const state = get();
    if (!state.preMatchSnapshot || state.invincibleUsedThisSeason) return;
    set({
      fixtures: state.preMatchSnapshot.fixtures,
      divisionFixtures: state.preMatchSnapshot.divisionFixtures,
      divisionTables: state.preMatchSnapshot.divisionTables,
      players: state.preMatchSnapshot.players,
      boardConfidence: state.preMatchSnapshot.boardConfidence,
      leagueTable: state.preMatchSnapshot.leagueTable,
      currentMatchResult: null,
      halfTimeState: null,
      matchPhase: 'none',
      preMatchSnapshot: null,
      invincibleUsedThisSeason: true,
      currentScreen: 'dashboard',
    });
  },

  /** Load a historical match result for review (e.g. from inbox click). */
  loadMatchForReview: (week: number) => {
    const state = get();
    const pid = state.playerClubId;

    // 0. Friendlies
    const friendlyMatch = state.friendlies?.find(
      m => m.week === week && m.played && (m.homeClubId === pid || m.awayClubId === pid)
    );
    if (friendlyMatch) { set({ currentMatchResult: friendlyMatch }); return; }

    // 1. League fixtures (full Match objects with events)
    const leagueMatch = state.fixtures.find(
      m => m.week === week && m.played && (m.homeClubId === pid || m.awayClubId === pid)
    );
    if (leagueMatch) { set({ currentMatchResult: leagueMatch }); return; }

    // Helper to build a basic Match from cup/tournament tie data
    const buildMatch = (homeClubId: string, awayClubId: string, homeGoals: number, awayGoals: number, penaltyShootout?: { home: number; away: number }): Match => ({
      id: `review-${week}-${homeClubId}-${awayClubId}`,
      week, homeClubId, awayClubId, played: true, homeGoals, awayGoals, events: [],
      ...(penaltyShootout ? { penaltyShootout } : {}),
    });

    // 2. Dynasty Cup
    const cupTie = state.cup?.ties?.find(t => t.week === week && t.played && (t.homeClubId === pid || t.awayClubId === pid));
    if (cupTie) { set({ currentMatchResult: buildMatch(cupTie.homeClubId, cupTie.awayClubId, cupTie.homeGoals, cupTie.awayGoals, cupTie.penaltyShootout) }); return; }

    // 3. League Cup
    const lcTie = state.leagueCup?.ties?.find(t => t.week === week && t.played && (t.homeClubId === pid || t.awayClubId === pid));
    if (lcTie) { set({ currentMatchResult: buildMatch(lcTie.homeClubId, lcTie.awayClubId, lcTie.homeGoals, lcTie.awayGoals, lcTie.penaltyShootout) }); return; }

    // 4. Continental tournaments (group + knockout)
    for (const tourney of [state.championsCup, state.shieldCup]) {
      if (!tourney) continue;
      for (const group of tourney.groups || []) {
        for (const m of group.matches || []) {
          if (m.week === week && m.played && (m.homeClubId === pid || m.awayClubId === pid)) {
            set({ currentMatchResult: buildMatch(m.homeClubId, m.awayClubId, m.homeGoals, m.awayGoals) });
            return;
          }
        }
      }
      for (const tie of tourney.knockoutTies || []) {
        if (tie.homeClubId !== pid && tie.awayClubId !== pid) continue;
        if (tie.leg1Played && tie.week1 === week) {
          set({ currentMatchResult: buildMatch(tie.homeClubId, tie.awayClubId, tie.leg1HomeGoals, tie.leg1AwayGoals) });
          return;
        }
        if (tie.leg2Played && tie.week2 === week) {
          set({ currentMatchResult: buildMatch(tie.awayClubId, tie.homeClubId, tie.leg2HomeGoals, tie.leg2AwayGoals, tie.penaltyShootout) });
          return;
        }
      }
    }

    // 5. Super cups
    for (const sc of [state.domesticSuperCup, state.continentalSuperCup]) {
      if (sc && sc.played && sc.week === week && (sc.homeClubId === pid || sc.awayClubId === pid)) {
        set({ currentMatchResult: buildMatch(sc.homeClubId, sc.awayClubId, sc.homeGoals, sc.awayGoals, sc.penaltyShootout) });
        return;
      }
    }

    // Not found — leave currentMatchResult as-is (MatchReview shows "No match to review")
  },

  useShout: (type: ShoutType, minute: number) => {
    const state = get();
    if (state.matchShouts.length >= MAX_SHOUTS_PER_MATCH) return false;
    const lastShout = state.matchShouts[state.matchShouts.length - 1];
    if (lastShout && minute - lastShout.startMinute < SHOUT_COOLDOWN) return false;
    set({ matchShouts: [...state.matchShouts, { type, startMinute: minute }] });
    return true;
  },

  getActiveShout: (minute: number): MatchShout | null => {
    const state = get();
    const active = state.matchShouts.find(s => minute >= s.startMinute && minute < s.startMinute + SHOUT_DURATION);
    return active || null;
  },

  setTeamTalk: (talk: TeamTalkType) => set({ matchTeamTalk: talk }),

  makeMatchSub: (outId: string, inId: string) => {
    const state = get();
    if (state.matchSubsUsed >= MAX_SUBSTITUTIONS) return;
    const club = { ...state.clubs[state.playerClubId] };
    if (!club.lineup.includes(outId)) return;
    if (!club.subs.includes(inId)) return;
    const inPlayer = state.players[inId];
    if (!inPlayer) return;
    if (inPlayer.injured) return;
    if (inPlayer.suspendedUntilWeek != null && inPlayer.suspendedUntilWeek > state.week) return;
    club.lineup = [...club.lineup.map(id => id === outId ? inId : id)];
    club.subs = [...club.subs.filter(id => id !== inId), outId];
    const outPlayer = state.players[outId];
    const subEvent = {
      minute: 45,
      type: 'substitution' as const,
      playerId: inId,
      assistPlayerId: outId,
      clubId: state.playerClubId,
      description: `${inPlayer.firstName} ${inPlayer.lastName} replaces ${outPlayer ? `${outPlayer.firstName} ${outPlayer.lastName}` : 'Unknown'}`,
    };
    const updates: Partial<GameState> = { clubs: { ...state.clubs, [club.id]: club }, matchSubsUsed: state.matchSubsUsed + 1 };
    if (state.currentMatchResult) {
      updates.currentMatchResult = {
        ...state.currentMatchResult,
        events: [...state.currentMatchResult.events, subEvent],
      };
    } else if (state.halfTimeState) {
      // At half-time: record sub event in halfTimeState so it carries into the second half
      updates.halfTimeState = {
        ...state.halfTimeState,
        events: [...state.halfTimeState.events, subEvent],
      };
    }
    set(updates);
  },
});
