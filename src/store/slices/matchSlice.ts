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
  matchSubbedOffIds: [] as string[],
  matchPlayerRatings: [] as GameState['matchPlayerRatings'],
  halfTimeState: null as GameState['halfTimeState'],
  currentMatchWeather: null as GameState['currentMatchWeather'],
  matchPhase: 'none' as GameState['matchPhase'],
  matchTeamTalk: 'none' as TeamTalkType,
  preMatchLeaguePosition: 10,
  lastMatchXPGain: 0,
  currentCupTieId: null as GameState['currentCupTieId'],
  penaltyShootoutKicks: [] as PenaltyKick[],
  penaltyShootoutRevealIndex: 0,
  matchShouts: [] as MatchShout[],

  clearMatchResult: () => set({
    currentMatchResult: null,
    halfTimeState: null,
    currentMatchWeather: null,
    matchPhase: 'none',
    matchTeamTalk: 'none',
    currentCupTieId: null,
    penaltyShootoutKicks: [],
    penaltyShootoutRevealIndex: 0,
    matchShouts: [],
    matchSubbedOffIds: [],
    // Clear ancillary post-match UI state so the next popup/review can't
    // render leftover data before the new match writes its own values.
    lastMatchCompetition: null,
    lastMatchXPGain: 0,
    matchPlayerRatings: [],
    preMatchLeaguePosition: 10,
  }),

  /** Invincible perk: rewind a lost match by restoring pre-match state */
  rewindMatch: () => {
    const state = get();
    if (!state.preMatchSnapshot || state.invincibleUsedThisSeason) return;
    const snap = state.preMatchSnapshot;
    set({
      fixtures: snap.fixtures,
      divisionFixtures: snap.divisionFixtures,
      divisionTables: snap.divisionTables,
      players: snap.players,
      boardConfidence: snap.boardConfidence,
      leagueTable: snap.leagueTable,
      // Extended snapshot fields (optional — older snapshots lack them).
      // Without these the replay double-counts manager W/D/L, XP, rivalry
      // records, chemistry, ELO and session stats, keeps the post-match
      // inbox message/press conference, and preserves mid-match subs.
      ...(snap.clubs ? { clubs: snap.clubs } : {}),
      ...(snap.managerStats ? { managerStats: snap.managerStats } : {}),
      ...(snap.managerProgression ? { managerProgression: snap.managerProgression } : {}),
      ...(snap.careerTimeline ? { careerTimeline: snap.careerTimeline } : {}),
      ...(snap.rivalries ? { rivalries: snap.rivalries } : {}),
      ...(snap.pairFamiliarity ? { pairFamiliarity: snap.pairFamiliarity } : {}),
      ...(snap.clubPowerRankings ? { clubPowerRankings: snap.clubPowerRankings } : {}),
      ...(snap.sessionStats ? { sessionStats: snap.sessionStats } : {}),
      ...(snap.messages ? { messages: snap.messages } : {}),
      ...(snap.pendingPressConference !== undefined ? { pendingPressConference: snap.pendingPressConference } : {}),
      currentMatchResult: null,
      halfTimeState: null,
      currentMatchWeather: null,
      matchPhase: 'none',
      // Match-scoped transients must not leak into the replay.
      matchShouts: [],
      matchTeamTalk: 'none',
      matchSubsUsed: 0,
      matchSubbedOffIds: [],
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
    if (friendlyMatch) {
      set({ currentMatchResult: friendlyMatch, lastMatchCompetition: 'Pre-Season Friendly' });
      return;
    }

    // 1. League fixtures (full Match objects with events)
    const leagueMatch = state.fixtures.find(
      m => m.week === week && m.played && (m.homeClubId === pid || m.awayClubId === pid)
    );
    if (leagueMatch) {
      set({ currentMatchResult: leagueMatch, lastMatchCompetition: null });
      return;
    }

    // Helper to build a basic Match from cup/tournament tie data
    const buildMatch = (homeClubId: string, awayClubId: string, homeGoals: number, awayGoals: number, penaltyShootout?: { home: number; away: number }): Match => ({
      id: `review-${week}-${homeClubId}-${awayClubId}`,
      week, homeClubId, awayClubId, played: true, homeGoals, awayGoals, events: [],
      ...(penaltyShootout ? { penaltyShootout } : {}),
    });

    // 2. Dynasty Cup
    const cupTie = state.cup?.ties?.find(t => t.week === week && t.played && (t.homeClubId === pid || t.awayClubId === pid));
    if (cupTie) {
      set({
        currentMatchResult: buildMatch(cupTie.homeClubId, cupTie.awayClubId, cupTie.homeGoals, cupTie.awayGoals, cupTie.penaltyShootout),
        lastMatchCompetition: `Dynasty Cup — ${cupTie.round}`,
      });
      return;
    }

    // 3. League Cup
    const lcTie = state.leagueCup?.ties?.find(t => t.week === week && t.played && (t.homeClubId === pid || t.awayClubId === pid));
    if (lcTie) {
      set({
        currentMatchResult: buildMatch(lcTie.homeClubId, lcTie.awayClubId, lcTie.homeGoals, lcTie.awayGoals, lcTie.penaltyShootout),
        lastMatchCompetition: `League Cup — ${lcTie.round}`,
      });
      return;
    }

    // 4. Continental tournaments (group + knockout)
    const continentalSources: Array<[typeof state.championsCup, string]> = [
      [state.championsCup, 'Champions Cup'],
      [state.shieldCup, 'Shield Cup'],
      [state.conferenceCup, 'Conference Cup'],
    ];
    for (const [tourney, compName] of continentalSources) {
      if (!tourney) continue;
      for (const group of tourney.groups || []) {
        for (const m of group.matches || []) {
          if (m.week === week && m.played && (m.homeClubId === pid || m.awayClubId === pid)) {
            set({
              currentMatchResult: buildMatch(m.homeClubId, m.awayClubId, m.homeGoals, m.awayGoals),
              lastMatchCompetition: compName,
            });
            return;
          }
        }
      }
      for (const tie of tourney.knockoutTies || []) {
        if (tie.homeClubId !== pid && tie.awayClubId !== pid) continue;
        if (tie.leg1Played && tie.week1 === week) {
          set({
            currentMatchResult: buildMatch(tie.homeClubId, tie.awayClubId, tie.leg1HomeGoals, tie.leg1AwayGoals),
            lastMatchCompetition: `${compName} — ${tie.round}`,
          });
          return;
        }
        if (tie.leg2Played && tie.week2 === week) {
          set({
            currentMatchResult: buildMatch(tie.awayClubId, tie.homeClubId, tie.leg2HomeGoals, tie.leg2AwayGoals, tie.penaltyShootout),
            lastMatchCompetition: `${compName} — ${tie.round}`,
          });
          return;
        }
      }
    }

    // 5. Super cups
    const superCupSources: Array<[typeof state.domesticSuperCup, string]> = [
      [state.domesticSuperCup, 'Super Cup'],
      [state.continentalSuperCup, 'Continental Super Cup'],
    ];
    for (const [sc, compName] of superCupSources) {
      if (sc && sc.played && sc.week === week && (sc.homeClubId === pid || sc.awayClubId === pid)) {
        set({
          currentMatchResult: buildMatch(sc.homeClubId, sc.awayClubId, sc.homeGoals, sc.awayGoals, sc.penaltyShootout),
          lastMatchCompetition: compName,
        });
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

  makeMatchSub: (outId: string, inId: string, minute?: number): { success: boolean; message?: string } => {
    const state = get();
    if (state.matchSubsUsed >= MAX_SUBSTITUTIONS) return { success: false, message: 'No substitutions remaining.' };
    const club = { ...state.clubs[state.playerClubId] };
    if (!club.lineup.includes(outId)) return { success: false, message: 'That player is no longer in the lineup.' };
    if (!club.subs.includes(inId)) return { success: false, message: 'That player is not on the bench.' };
    // A player substituted off earlier in this match cannot re-enter —
    // the out-player goes back to `subs` (so post-match processing still
    // sees them), but they're no longer a legal substitution target.
    if ((state.matchSubbedOffIds || []).includes(inId)) return { success: false, message: 'A substituted player cannot re-enter the match.' };
    const inPlayer = state.players[inId];
    if (!inPlayer) return { success: false, message: 'That substitute is unavailable.' };
    if (inPlayer.injured) return { success: false, message: `${inPlayer.lastName} is injured and cannot come on.` };
    if (inPlayer.suspendedUntilWeek != null && inPlayer.suspendedUntilWeek > state.week) return { success: false, message: `${inPlayer.lastName} is suspended and cannot come on.` };
    club.lineup = [...club.lineup.map(id => id === outId ? inId : id)];
    club.subs = [...club.subs.filter(id => id !== inId), outId];
    const outPlayer = state.players[outId];
    const inFull = `${inPlayer.firstName} ${inPlayer.lastName}`;
    const outFull = outPlayer ? `${outPlayer.firstName} ${outPlayer.lastName}` : 'Unknown';
    const playerSubTemplates = [
      `${inFull} comes on for ${outFull}.`,
      `${inFull} replaces ${outFull}.`,
      `${outFull} makes way for ${inFull}.`,
      `Off comes ${outFull}, on goes ${inFull}.`,
      `${club.shortName} go to the bench: ${inFull} replaces ${outFull}.`,
      `Tactical change for ${club.shortName} — ${inFull} on, ${outFull} off.`,
    ];
    const subEvent = {
      minute: minute ?? 45,
      type: 'substitution' as const,
      playerId: inId,
      assistPlayerId: outId,
      clubId: state.playerClubId,
      description: playerSubTemplates[Math.floor(Math.random() * playerSubTemplates.length)],
    };
    const updates: Partial<GameState> = {
      clubs: { ...state.clubs, [club.id]: club },
      matchSubsUsed: state.matchSubsUsed + 1,
      matchSubbedOffIds: [...(state.matchSubbedOffIds || []), outId],
    };
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
    return { success: true };
  },
});
