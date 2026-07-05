import type { FormationType, NationalTeamState, InternationalTournamentState, InternationalKnockoutTie, NationalTeamOffer, CaptureScenario, Match, MatchEvent, Player } from '@/types/game';
import type { GameState } from '../storeTypes';
import { addMsg, safeRandomUUID } from '@/utils/helpers';
import { NT_JOB_OFFER_DURATION_WEEKS } from '@/config/gameBalance';
import { generateNationalTeamPool, autoSelectNationalSquad, generateTournament } from '@/utils/international';
import { nationToClub, buildInternationalMatchTeams } from '@/utils/internationalMatch';
import { selectBestLineup } from '@/utils/playerGen';
import { getNationRanking } from '@/data/nations';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

/** The shared World Cup session boot used by `startWorldCup` (new game — after
 *  a slot-deleting resetGame) and `startCaptureScenario` (throwaway session —
 *  after a slot-preserving clearActiveSession). Assumes state is freshly wiped. */
function bootWorldCupSession(_set: Set, _get: Get, nationality: string) {
  _set({
    gameMode: 'world-cup',
    gameStarted: true,
    season: 1,
    week: 47,
    seasonPhase: 'international',
  });
  // Generate the candidate pool + auto-pick the 23-man squad (sets
  // nationalTeam + adds the pool into `players`).
  _get().initNationalTeam(nationality);
  const nt = _get().nationalTeam!;
  // The national team IS the player's club (keyed by nation name) so Squad,
  // Tactics and MatchDay all operate on it. clubs[nation] is the source of
  // truth for the lineup the player edits.
  const ntClub = nationToClub(nationality, nt.squad, nt.lineup, nt.subs, nt.formation);
  // Squad is managed via the normal Squad page — no separate picker gate.
  const tournament = generateTournament('world-cup', 1, nationality);
  tournament.squadConfirmed = true;
  _set({
    playerClubId: nationality,
    clubs: { [nationality]: ntClub },
    internationalTournament: tournament,
    // Open on the group-draw ceremony; its Continue button drops the player
    // onto the World Cup dashboard.
    currentScreen: 'world-cup-draw',
  });
}

/** Capture Studio: stage the pre-computed 2-2 that sends the Final straight to
 *  a penalty shootout. Materialises the opponent (normally done at kickoff),
 *  writes a level `currentMatchResult` with star-credited goal events, and
 *  parks the match in the 'penalties' phase — MatchDay mounts directly into
 *  the shootout and the normal finalize path (trophy lift, result screen)
 *  takes it from there. */
function stageCapturePenalties(_set: Set, _get: Get, scenario: CaptureScenario) {
  const state = _get();
  if (!state.clubs[scenario.opponentNation]) {
    const { opponentClub, opponentPlayers } = buildInternationalMatchTeams({
      playerNation: scenario.playerNation,
      opponentNation: scenario.opponentNation,
      nationalTeam: state.nationalTeam!,
      existingPlayers: state.players,
      season: state.season,
      communityPackEnabled: state.communityPackEnabled,
    });
    _set({
      clubs: { ...state.clubs, [scenario.opponentNation]: opponentClub },
      players: { ...state.players, ...opponentPlayers },
    });
  }

  const s = _get();
  const scorerFor = (nation: string, preferred: string[]): Player | undefined => {
    const xi = (s.clubs[nation]?.lineup ?? []).map(id => s.players[id]).filter(Boolean);
    const starred = xi.find(p => preferred.some(n => (p.lastName || '').includes(n)));
    if (starred) return starred;
    const outfield = xi.filter(p => p.position !== 'GK');
    return [...outfield].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))[0] ?? xi[0];
  };
  const home = scorerFor(scenario.playerNation, scenario.starScorers?.player ?? []);
  const away = scorerFor(scenario.opponentNation, scenario.starScorers?.opponent ?? []);
  const goal = (minute: number, p: Player | undefined, nation: string, h: number, a: number): MatchEvent => ({
    minute,
    type: 'goal',
    clubId: nation,
    playerId: p?.id,
    description: `GOAL! ${p ? (p.lastName || p.firstName) : nation} scores for ${nation}! (${h}-${a})`,
  });
  const events: MatchEvent[] = [
    goal(23, home, scenario.playerNation, 1, 0),
    goal(41, away, scenario.opponentNation, 1, 1),
    goal(58, home, scenario.playerNation, 2, 1),
    goal(87, away, scenario.opponentNation, 2, 2),
  ];
  const result: Match = {
    id: `wc-${scenario.playerNation}-${scenario.opponentNation}`,
    week: s.week,
    homeClubId: scenario.playerNation,
    awayClubId: scenario.opponentNation,
    played: false,
    homeGoals: 2,
    awayGoals: 2,
    events,
  };
  _set({
    currentMatchResult: result,
    matchPhase: 'penalties',
    matchPlayerRatings: [],
    matchSubsUsed: 0,
    matchSubbedOffIds: [],
    penaltyShootoutKicks: [],
    penaltyShootoutRevealIndex: 0,
    penaltyShootoutCtx: null,
    halfTimeState: null,
    lastMatchCompetition: 'World Cup — Final',
  });
}

export const createNationalTeamSlice = (_set: Set, _get: Get) => ({
  nationalTeam: null as NationalTeamState | null,
  internationalTournament: null as InternationalTournamentState | null,
  managerNationality: null as string | null,
  nationalTeamOffer: null as NationalTeamOffer | null,
  showNationalTeamOffer: false,

  initNationalTeam: (nationality: string) => {
    const state = _get();
    const formation = '4-3-3' as FormationType;

    // Generate national team candidate pool (sandbox mode starts with full squad)
    const poolPlayers = generateNationalTeamPool(nationality, state.players, state.season || 1, {
      communityPackEnabled: state.communityPackEnabled,
    });
    const allPlayers = { ...state.players, ...poolPlayers };
    const poolPlayerIds = Object.keys(poolPlayers);

    // Auto-select best 23-man squad
    const squad = autoSelectNationalSquad(nationality, allPlayers, state.week);
    const squadPlayerObjs = squad.map(id => allPlayers[id]).filter(Boolean);
    let lineup: string[] = [];
    let subs: string[] = [];
    if (squadPlayerObjs.length >= 7) {
      const best = selectBestLineup(squadPlayerObjs, formation);
      lineup = best.lineup.map(p => p.id);
      subs = best.subs.map(p => p.id).slice(0, 7);
    }

    _set({
      managerNationality: nationality,
      players: allPlayers,
      nationalTeam: {
        nationality,
        squad,
        lineup,
        subs,
        formation,
        fifaRanking: getNationRanking(nationality),
        caps: {},
        internationalGoals: {},
        results: [],
        poolPlayerIds,
      },
    });
  },

  /** Boot a World Cup game: it plays like the normal game, except your "club"
   *  IS your national team and your only competition is the World Cup. The
   *  national team becomes `playerClubId` so the normal Squad, Tactics and match
   *  flow operate on it; a nation-adapted Dashboard is the hub. The World Cup
   *  tournament is the season. `gameMode: 'world-cup'` flags existing fields —
   *  no save migration. */
  startWorldCup: (nationality: string) => {
    // Clean slate — clears any prior club/career/transfer/match state AND
    // deletes the active slot on disk (this is the new-game-into-slot flow).
    _get().resetGame();
    bootWorldCupSession(_set, _get, nationality);
  },

  /** Capture Studio: boot a throwaway World Cup session staged at a Final
   *  between two star nations, for screen-recording marketing footage
   *  (scenarios in `config/captureScenarios.ts`). The session is never
   *  written to a slot: the outgoing session is flushed to disk first (when
   *  auto-save is on), then `captureSession` blocks every subsequent write —
   *  the user's saved games are untouched no matter what happens in here. */
  startCaptureScenario: (scenario): boolean => {
    if (!scenario) return false;

    const state = _get();
    if (state.gameStarted && state.playerClubId && state.settings.autoSave && !state.captureSession) {
      _get().flushSave();
    }
    // Slot-preserving wipe (resetGame would delete the save on disk).
    _get().clearActiveSession();
    // From this line on, performSave is inert for the whole staged session.
    _set({ captureSession: true });

    bootWorldCupSession(_set, _get, scenario.playerNation);

    // Fast-forward the tournament to a Final between the scenario nations.
    // The bracket behind it is cosmetic — the scenario exists to film the
    // match/shootout, and the finalize path only needs this one unplayed tie.
    const t = _get().internationalTournament!;
    const finalWeek = t.currentWeek + 5;
    const finalTie: InternationalKnockoutTie = {
      id: `capture-final-${scenario.id}`,
      round: 'F',
      homeNation: scenario.playerNation,
      awayNation: scenario.opponentNation,
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      week: finalWeek,
    };
    _set({
      week: finalWeek,
      internationalTournament: {
        ...t,
        phase: 'knockout',
        currentRound: 'F',
        currentWeek: finalWeek,
        knockoutTies: [finalTie],
      },
    });

    if (scenario.stage === 'penalties') {
      stageCapturePenalties(_set, _get, scenario);
    }
    _set({ currentScreen: 'match' });
    return true;
  },

  setManagerNationality: (nationality: string) => {
    const state = _get();
    // Career mode: immediately offer the national team job (shown as popup)
    if (state.gameMode === 'career') {
      const offer: NationalTeamOffer = {
        id: safeRandomUUID(),
        nationality,
        reason: 'initial',
        offerSeason: 1,
        offerWeek: 1,
        expiresSeason: 1,
        expiresWeek: 1 + NT_JOB_OFFER_DURATION_WEEKS,
        status: 'pending',
      };
      const messages = addMsg(state.messages, {
        week: 1, season: 1, type: 'national_team',
        title: `${nationality} FA: National Team Position`,
        body: `The ${nationality} Football Association would like to offer you the position of national team manager alongside your club duties.`,
      });
      _set({
        managerNationality: nationality,
        nationalTeamOffer: offer,
        showNationalTeamOffer: true,
        messages,
      });
    } else {
      _set({ managerNationality: nationality });
    }
  },

  acceptNationalTeamOffer: () => {
    const state = _get();
    const offer = state.nationalTeamOffer;
    if (!offer || offer.status !== 'pending' || !state.managerNationality) return;

    const nationality = state.managerNationality;
    const formation = '4-3-3' as FormationType;

    // Generate national team candidate pool so there are enough eligible players
    const poolPlayers = generateNationalTeamPool(nationality, state.players, state.season, {
      communityPackEnabled: state.communityPackEnabled,
    });
    const allPlayers = { ...state.players, ...poolPlayers };

    // Auto-select best 23-man squad from all eligible players
    const squad = autoSelectNationalSquad(nationality, allPlayers, state.week);

    // Auto-select best lineup and subs from the squad
    const squadPlayerObjs = squad.map(id => allPlayers[id]).filter(Boolean);
    let lineup: string[] = [];
    let subs: string[] = [];
    if (squadPlayerObjs.length >= 7) {
      const best = selectBestLineup(squadPlayerObjs, formation);
      lineup = best.lineup.map(p => p.id);
      subs = best.subs.map(p => p.id).slice(0, 7);
    }

    const nationalTeam: NationalTeamState = {
      nationality,
      squad,
      lineup,
      subs,
      formation,
      fifaRanking: getNationRanking(nationality),
      caps: {},
      internationalGoals: {},
      results: [],
      poolPlayerIds: Object.keys(poolPlayers),
    };

    const messages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'national_team',
      title: `${nationality} National Team — Appointed!`,
      body: `You have accepted the position of ${nationality} national team manager. Your ${squad.length}-man squad has been selected — review and edit it on the National Team page.`,
    });

    const careerTimeline = state.gameMode === 'career' ? [
      ...state.careerTimeline,
      {
        id: safeRandomUUID(),
        type: 'national_team_appointed' as const,
        title: `${nationality} Manager`,
        description: `Appointed as ${nationality} national team manager.`,
        season: state.season,
        week: state.week,
        icon: 'Globe',
      },
    ] : state.careerTimeline;

    const careerManager = state.careerManager ? {
      ...state.careerManager,
      nationalTeamAppointedSeason: state.season,
    } : null;

    _set({
      nationalTeam,
      nationalTeamOffer: null,
      showNationalTeamOffer: false,
      players: allPlayers,
      messages,
      careerTimeline,
      careerManager,
    });
  },

  declineNationalTeamOffer: () => {
    const state = _get();
    if (!state.nationalTeamOffer || !state.managerNationality) return;

    const messages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'national_team',
      title: 'National Team Offer Declined',
      body: `You have declined the ${state.managerNationality} national team position. The FA will consider other candidates.`,
    });

    _set({
      nationalTeamOffer: null,
      showNationalTeamOffer: false,
      messages,
    });
  },

  updateNationalSquad: (squad: string[], lineup: string[], subs: string[]) => {
    const state = _get();
    if (!state.nationalTeam) return;
    _set({
      nationalTeam: {
        ...state.nationalTeam,
        squad,
        lineup,
        subs,
      },
    });
  },

  setNationalFormation: (f: FormationType) => {
    const state = _get();
    if (!state.nationalTeam) return;
    _set({
      nationalTeam: {
        ...state.nationalTeam,
        formation: f,
      },
    });
  },

  /** Confirm the manager's pre-tournament squad. Locks the 23 they picked,
   *  flips `squadConfirmed` so `advanceInternationalWeekImpl` can run, and
   *  sends the manager to the tournament screen. */
  confirmNationalSquad: (squad: string[], lineup: string[], subs: string[]) => {
    const state = _get();
    if (!state.nationalTeam || !state.internationalTournament) return;
    _set({
      nationalTeam: {
        ...state.nationalTeam,
        squad,
        lineup,
        subs,
      },
      internationalTournament: {
        ...state.internationalTournament,
        squadConfirmed: true,
      },
      currentScreen: 'international-tournament',
    });
  },

  // advanceInternationalWeek and playInternationalMatch are handled by
  // orchestrationSlice (advanceInternationalWeekImpl). These slice-level
  // stubs are intentionally omitted — orchestration owns the game loop.

  /** Replace an injured player in the national team tournament squad */
  replaceInjuredInternationalPlayer: (outId: string, inId: string) => {
    const state = _get();
    if (!state.nationalTeam) return;
    // Validate the replacement: must be a real player and not already in the
    // squad — a duplicate id would occupy two squad/lineup slots at once.
    if (!state.players[inId]) return;
    if (state.nationalTeam.squad.includes(inId)) return;
    const nt = { ...state.nationalTeam };
    // Swap in squad
    nt.squad = nt.squad.map(id => id === outId ? inId : id);
    // Swap in lineup if present
    nt.lineup = nt.lineup.map(id => id === outId ? inId : id);
    // Swap in subs if present
    nt.subs = nt.subs.map(id => id === outId ? inId : id);
    _set({ nationalTeam: nt });
  },
});
