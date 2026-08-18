/**
 * Sunday League — playing the fixture.
 *
 * One entry point, `runSundayMatch`, used by both the Match Day screen and the
 * weekly advance. That is deliberate: if the manager taps Next Week without
 * playing, the same code runs with an auto-picked side, so there is exactly one
 * path a result can come from and exactly one place a fixture can be marked
 * played.
 *
 * EXACTLY ONCE. The function refuses when this week's fixture is already
 * played. Combined with the ledger being applied in the weekly advance rather
 * than here, that means no amount of double-tapping, backgrounding or
 * re-entering the screen can produce two results, two sets of stats, or two
 * charges for the same referee.
 */
import type {
  Club, InjuryDetails, Match, Player, PlayerMatchRating, SundayCupTie,
  SundayMatchReport, SundaySquadMember, SundayState,
} from '@/types/game';
import { computeMinutesPlayed, extractFinalMatchFitness, getYellowAccumulationBanWeek } from '@/store/slices/orchestration/helpers';
import { RED_CARD_SUSPENSION_MIN, RED_CARD_SUSPENSION_RANGE } from '@/config/gameBalance';
import {
  SUNDAY_FULL_XI, SUNDAY_HAPPY_AVAILABLE_UNPICKED, SUNDAY_HAPPY_CAPTAIN_BENCHED,
  SUNDAY_HAPPY_EGO_MULT, SUNDAY_HAPPY_STARTED, SUNDAY_HAPPY_SUB_UNUSED,
  SUNDAY_HAPPY_SUB_USED, SUNDAY_HEAVY_LOSS_MARGIN, SUNDAY_MAX_BENCH, SUNDAY_MAX_RINGERS,
  SUNDAY_MIN_START, SUNDAY_MORALE_DRAW, SUNDAY_MORALE_FORFEIT, SUNDAY_MORALE_HEAVY_LOSS,
  SUNDAY_MORALE_LOSS, SUNDAY_MORALE_WIN, SUNDAY_PITCH_BASE, SUNDAY_PITCH_PER_UPGRADE,
  SUNDAY_PITCH_WINTER_DROP, SUNDAY_REP_DRAW, SUNDAY_REP_FORFEIT, SUNDAY_REP_LOSS,
  SUNDAY_REP_WIN, SUNDAY_RINGER_MORALE, SUNDAY_RIVAL_HEAT_LOSS, SUNDAY_RIVAL_HEAT_MAX,
  SUNDAY_RIVAL_HEAT_WIN, SUNDAY_RIVAL_INTENSITY_SCALE, SUNDAY_DERBY_MORALE,
  getSundayTactic,
} from '@/config/sundayLeague';
import { SUNDAY_POSTMATCH_LINES } from '@/data/sundayNames';
import { resolveDoubt } from '@/utils/sunday/availability';
import { clearSundayRingers, generateSundayRinger } from '@/utils/sunday/generation';
import {
  buildMatchdayTeam, buildSundayNarrative, pickMotm, pickSundayOppositionXI,
  rollSundayWeather, simulateSundayMatch,
} from '@/utils/sunday/match';
import { advanceSundayCup, buildSundayTable, sundaySeasonWeeks } from '@/utils/sunday/season';
import { selectBestLineup } from '@/utils/playerGen';
import type { SundayRng } from '@/utils/sunday/rng';
import { createSundayRng, subSeed } from '@/utils/sunday/rng';
import type { Get, Set } from './shared';
import { clamp, clampRound, logWeek, upgradeLevel } from './shared';

/** Current pitch quality: base, plus what has been paid for, minus winter. */
export function sundayPitchQuality(sunday: SundayState, week: number): number {
  const total = sundaySeasonWeeks(sunday.divisionId);
  const share = total > 0 ? week / total : 0;
  const winter = share > 0.3 && share < 0.75 ? SUNDAY_PITCH_WINTER_DROP : 0;
  return clamp(SUNDAY_PITCH_BASE + upgradeLevel(sunday, 'pitch') * SUNDAY_PITCH_PER_UPGRADE - winter, 0, 100);
}

/** This week's fixture for the player's club, league or cup, or null. */
export function findSundayFixture(
  sunday: SundayState,
  fixtures: readonly Match[],
  week: number,
  clubId: string,
): { kind: 'league'; match: Match } | { kind: 'cup'; tie: SundayCupTie } | null {
  const tie = sunday.cup?.ties.find(t => t.week === week && !t.played && (t.homeClubId === clubId || t.awayClubId === clubId));
  if (tie) return { kind: 'cup', tie };
  const match = fixtures.find(m => m.week === week && !m.played && (m.homeClubId === clubId || m.awayClubId === clubId));
  if (match) return { kind: 'league', match };
  return null;
}

/** Best available XI + bench for the current tactic. */
export function autoPickSunday(
  sunday: SundayState,
  players: Record<string, Player>,
): { xi: string[]; bench: string[] } {
  const tactic = getSundayTactic(sunday.tactic);
  const availableIds = sunday.squad.filter(m => m.availability.status !== 'out').map(m => m.playerId);
  const pool = availableIds.map(id => players[id]).filter((p): p is Player => !!p);
  if (pool.length <= SUNDAY_FULL_XI) {
    // Everyone plays. `selectBestLineup` positions them as best it can; with
    // eleven or fewer that is the whole point.
    const { lineup } = selectBestLineup(pool, pool.length >= SUNDAY_FULL_XI ? tactic.formation : tactic.shortFormation);
    const chosen = lineup.length ? lineup : pool;
    return { xi: chosen.slice(0, SUNDAY_FULL_XI).map(p => p.id), bench: [] };
  }
  const { lineup, subs } = selectBestLineup(pool, tactic.formation);
  return {
    xi: lineup.slice(0, SUNDAY_FULL_XI).map(p => p.id),
    bench: subs.slice(0, SUNDAY_MAX_BENCH).map(p => p.id),
  };
}

interface ShootoutQuality { score: number; save: number }

/** Scoring and saving ability for a shootout, from the side that finished the
 *  match. Sunday penalties are a coin flip with a thumb on the scale. */
function shootoutQuality(xi: readonly Player[]): ShootoutQuality {
  if (!xi.length) return { score: 0.6, save: 0.2 };
  const shooting = xi.reduce((n, p) => n + p.attributes.shooting, 0) / xi.length;
  const keeper = xi.find(p => p.position === 'GK');
  const save = keeper ? keeper.attributes.defending / 100 : 0.3;
  return { score: 0.45 + shooting / 220, save: 0.12 + save * 0.2 };
}

/** Seeded penalty shootout. Cup ties cannot be drawn, so this always resolves. */
function shootout(rng: SundayRng, homeXI: Player[], awayXI: Player[]): { home: number; away: number } {
  const h = shootoutQuality(homeXI);
  const a = shootoutQuality(awayXI);
  let home = 0;
  let away = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.chance(Math.max(0.25, h.score - a.save))) home++;
    if (rng.chance(Math.max(0.25, a.score - h.save))) away++;
  }
  // Sudden death, bounded so a pathological pair of takers cannot loop forever.
  let round = 0;
  while (home === away && round < 20) {
    const hs = rng.chance(Math.max(0.25, h.score - a.save));
    const as = rng.chance(Math.max(0.25, a.score - h.save));
    if (hs) home++;
    if (as) away++;
    round++;
  }
  if (home === away) home++; // 20 rounds of sudden death; somebody has to win.
  return { home, away };
}

export interface RunSundayMatchResult {
  report: SundayMatchReport;
}

/**
 * Play this week's fixture and write every consequence.
 *
 * Returns null when there is nothing to play — no fixture, already played, the
 * club has folded, or the season is over.
 */
export function runSundayMatch(set: Set, get: Get): SundayMatchReport | null {
  const state = get();
  const sunday = state.sunday;
  if (!sunday || sunday.folded || sunday.seasonComplete) return null;
  const clubId = state.playerClubId;
  const fixture = findSundayFixture(sunday, state.fixtures, state.week, clubId);
  if (!fixture) return null;

  const week = state.week;
  const season = state.season;
  // The match's draws (weather, doubt resolution, ringers, shootout, narrative)
  // come from a stream keyed to THIS week, not from the persistent cursor. Two
  // reasons, both load-bearing:
  //   1. Reload-stability. How many draws a match consumes depends on the
  //      shared engine's (unseeded) event stream — narrative lines per event,
  //      subs used, and so on. Advancing the persistent cursor by a variable
  //      amount made everything AFTER the match (that week's event, sponsors,
  //      recruits) differ between a reloaded and an unreloaded save.
  //   2. Anti-save-scum. Keyed to the week, the weather, whether the doubtful
  //      centre-half turns up, and who the ringers are all resolve the same on
  //      every replay of the same Sunday — reloading cannot re-roll them.
  const rng = createSundayRng(subSeed(sunday.seed, `match:${season}:${week}`), 0);

  const isCup = fixture.kind === 'cup';
  const homeClubId = isCup ? fixture.tie.homeClubId : fixture.match.homeClubId;
  const awayClubId = isCup ? fixture.tie.awayClubId : fixture.match.awayClubId;
  const isHome = homeClubId === clubId;
  const oppClubId = isHome ? awayClubId : homeClubId;

  const players: Record<string, Player> = { ...state.players };
  const clubs = state.clubs;
  const oppClub = clubs[oppClubId];
  const ourClub = clubs[clubId];
  if (!oppClub || !ourClub) return null;

  // ── Who actually turned up ───────────────────────────────────────────────
  let squad: SundaySquadMember[] = sunday.squad.map(m => ({
    ...m,
    availability: resolveDoubt(rng, m.availability),
  }));
  const availableIds = new Set(squad.filter(m => m.availability.status !== 'out').map(m => m.playerId));
  const noShows = squad.filter(m => m.availability.status === 'out' && !m.availability.warned);

  // Honour the manager's teamsheet, minus anyone who did not make it.
  let xiIds = sunday.teamsheet.filter(id => availableIds.has(id));
  let benchIds = sunday.bench.filter(id => availableIds.has(id) && !xiIds.includes(id));
  if (xiIds.length < SUNDAY_MIN_START) {
    // Either nothing was picked or the picked side has been gutted. Fill from
    // whoever is left rather than refusing to play.
    const auto = autoPickSunday({ ...sunday, squad }, players);
    const merged = [...xiIds, ...auto.xi.filter(id => !xiIds.includes(id))];
    xiIds = merged.slice(0, SUNDAY_FULL_XI);
    benchIds = auto.bench.filter(id => !xiIds.includes(id)).slice(0, SUNDAY_MAX_BENCH);
  }

  // ── Ringers ──────────────────────────────────────────────────────────────
  const ringers: Player[] = [];
  while (xiIds.length + ringers.length < SUNDAY_MIN_START && ringers.length < SUNDAY_MAX_RINGERS) {
    const r = generateSundayRinger(rng, clubId, season, ringers.length);
    ringers.push(r);
    players[r.id] = r;
  }
  const ringerIds = ringers.map(r => r.id);
  const startingIds = [...xiIds, ...ringerIds];
  const forfeited = startingIds.length < SUNDAY_MIN_START;

  // ── Simulate ─────────────────────────────────────────────────────────────
  const pitchQuality = sundayPitchQuality(sunday, week);
  const weather = rollSundayWeather(rng, week, sundaySeasonWeeks(sunday.divisionId), pitchQuality);
  const isDerby = sunday.rivalry?.clubId === oppClubId;
  const derbyIntensity = isDerby && sunday.rivalry
    ? clamp(sunday.rivalry.heat * SUNDAY_RIVAL_INTENSITY_SCALE, 0, 3)
    : 0;

  let result: Match;
  let ratings: PlayerMatchRating[] = [];
  let injuries: Record<string, InjuryDetails> = {};
  let ourGoals = 0;
  let theirGoals = 0;
  let narrative: string[] = [];
  let motm: PlayerMatchRating | null = null;

  const baseMatch: Match = isCup
    ? {
        id: `sun-cup-${season}-${fixture.tie.round}-${homeClubId}-${awayClubId}`,
        week, homeClubId, awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [],
      }
    : fixture.match;

  if (forfeited) {
    ourGoals = 0;
    theirGoals = 3;
    narrative = [
      `You could not raise ${SUNDAY_MIN_START}. The referee waited twenty minutes and then went home.`,
      'The result stands as a 3-0 defeat and the league will be in touch about the fine.',
    ];
    result = {
      ...baseMatch,
      played: true,
      homeGoals: isHome ? 0 : 3,
      awayGoals: isHome ? 3 : 0,
      events: [{ minute: 0, type: 'full_time', clubId: '', description: '— Fixture not fulfilled —' }],
    };
  } else {
    const ourXI = startingIds.map(id => players[id]).filter((p): p is Player => !!p);
    const ourBenchPlayers = benchIds.map(id => players[id]).filter((p): p is Player => !!p);
    const opp = pickSundayOppositionXI(rng, oppClub, players, week);

    const ourTeam = buildMatchdayTeam({
      xi: ourXI, squad, tacticId: sunday.tactic, pitchQuality,
      ballsLevel: upgradeLevel(sunday, 'balls'), glovesLevel: upgradeLevel(sunday, 'keeper-gloves'),
      coachLevel: upgradeLevel(sunday, 'coach'), teamMorale: sunday.teamMorale, isPlayerClub: true,
    });
    // The opposition get the pitch, and nothing else — they have no Sunday
    // state of their own, and inventing one for them would be simulation for
    // its own sake.
    const oppTeam = buildMatchdayTeam({
      xi: opp.xi, squad: [], tacticId: 'route-one', pitchQuality,
      ballsLevel: 0, glovesLevel: 0, coachLevel: 0, teamMorale: 55, isPlayerClub: false,
    });

    // `club.lineup` is what the chemistry calculation aligns against, so the
    // match-day copies of the clubs carry the sides that are actually playing.
    const homeClubForSim: Club = isHome
      ? { ...ourClub, lineup: ourTeam.players.map(p => p.id), formation: startingIds.length >= SUNDAY_FULL_XI ? getSundayTactic(sunday.tactic).formation : getSundayTactic(sunday.tactic).shortFormation }
      : { ...oppClub, lineup: oppTeam.players.map(p => p.id) };
    const awayClubForSim: Club = isHome
      ? { ...oppClub, lineup: oppTeam.players.map(p => p.id) }
      : { ...ourClub, lineup: ourTeam.players.map(p => p.id), formation: startingIds.length >= SUNDAY_FULL_XI ? getSundayTactic(sunday.tactic).formation : getSundayTactic(sunday.tactic).shortFormation };

    const outcome = simulateSundayMatch({
      rng,
      match: baseMatch,
      homeClub: homeClubForSim,
      awayClub: awayClubForSim,
      homeXI: isHome ? ourTeam.players : oppTeam.players,
      awayXI: isHome ? oppTeam.players : ourTeam.players,
      homeBench: isHome ? ourBenchPlayers : opp.bench,
      awayBench: isHome ? opp.bench : ourBenchPlayers,
      homeTacticId: isHome ? sunday.tactic : 'route-one',
      awayTacticId: isHome ? 'route-one' : sunday.tactic,
      weather,
      derbyIntensity,
      season,
      playerPhysioLevel: upgradeLevel(sunday, 'physio'),
      playerIsHome: isHome,
    });

    result = outcome.result;
    ratings = outcome.playerRatings;
    injuries = outcome.matchInjuries;
    ourGoals = isHome ? result.homeGoals : result.awayGoals;
    theirGoals = isHome ? result.awayGoals : result.homeGoals;

    narrative = buildSundayNarrative({
      rng,
      events: result.events,
      clubId,
      players,
      noShowNames: noShows.map(m => players[m.playerId]?.firstName ?? 'someone'),
      ringerNames: ringers.map(r => r.firstName),
      startedWith: startingIds.length,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      isHome,
    });
    motm = pickMotm(ratings, startingIds);
  }

  // ── Cup shootout ─────────────────────────────────────────────────────────
  let shootoutScore: { home: number; away: number } | null = null;
  let cupWinnerId: string | null = null;
  if (isCup) {
    if (result.homeGoals === result.awayGoals) {
      const ourXI = startingIds.map(id => players[id]).filter((p): p is Player => !!p);
      const theirXI = (clubs[oppClubId]?.playerIds ?? []).slice(0, 11).map(id => players[id]).filter((p): p is Player => !!p);
      shootoutScore = shootout(rng, isHome ? ourXI : theirXI, isHome ? theirXI : ourXI);
      cupWinnerId = shootoutScore.home > shootoutScore.away ? homeClubId : awayClubId;
      narrative.push(
        `It finishes level, so it goes to penalties in front of about nine people. ${shootoutScore.home}-${shootoutScore.away}.`,
      );
    } else {
      cupWinnerId = result.homeGoals > result.awayGoals ? homeClubId : awayClubId;
    }
  }

  // ── Write the football facts back onto the players ───────────────────────
  const participantIds = new Set<string>(ratings.map(r => r.playerId));
  for (const id of startingIds) participantIds.add(id);
  const minutes = computeMinutesPlayed(result.events, [...participantIds]);
  const finalFitness = extractFinalMatchFitness(result.events);

  for (const ev of result.events) {
    const pid = ev.playerId;
    if (!pid || !players[pid]) continue;
    const p = players[pid];
    switch (ev.type) {
      case 'goal': case 'penalty_scored': case 'free_kick_goal': case 'long_range_goal':
      case 'counter_attack_goal': case 'header_goal': case 'solo_goal': case 'extra_time_goal':
      case 'goalkeeper_error':
        players[pid] = { ...p, goals: p.goals + 1, careerGoals: p.careerGoals + 1 };
        if (ev.assistPlayerId && players[ev.assistPlayerId]) {
          const a = players[ev.assistPlayerId];
          players[ev.assistPlayerId] = { ...a, assists: a.assists + 1, careerAssists: a.careerAssists + 1 };
        }
        break;
      case 'yellow_card': {
        const next = p.yellowCards + 1;
        const ban = getYellowAccumulationBanWeek(p.yellowCards, next, week);
        players[pid] = {
          ...p,
          yellowCards: next,
          ...(ban != null ? { suspendedUntilWeek: Math.max(p.suspendedUntilWeek ?? 0, ban) } : {}),
        };
        break;
      }
      case 'red_card':
        players[pid] = {
          ...p,
          redCards: p.redCards + 1,
          suspendedUntilWeek: week + 1 + RED_CARD_SUSPENSION_MIN + rng.int(0, RED_CARD_SUSPENSION_RANGE),
        };
        break;
      case 'injury': {
        const details = injuries[pid];
        const weeks = details ? details.weeksRemaining : rng.int(1, 4);
        players[pid] = { ...p, injured: true, injuryWeeks: weeks, injuryDetails: details };
        break;
      }
      default:
        break;
    }
  }

  const ratingById = new Map(ratings.map(r => [r.playerId, r]));
  for (const id of participantIds) {
    const p = players[id];
    if (!p) continue;
    const mins = minutes[id] ?? 0;
    const rating = ratingById.get(id)?.rating;
    players[id] = {
      ...p,
      appearances: p.appearances + 1,
      careerAppearances: p.careerAppearances + 1,
      minutesPlayed: (p.minutesPlayed ?? 0) + mins,
      fitness: clampRound(finalFitness[id] ?? p.fitness - mins * 0.35, 10, 100),
      ...(rating != null
        ? {
            seasonRatingTotal: (p.seasonRatingTotal ?? 0) + rating,
            seasonRatedMatches: (p.seasonRatedMatches ?? 0) + 1,
          }
        : {}),
    };
  }

  // ── Sunday-side consequences ─────────────────────────────────────────────
  const won = !forfeited && ourGoals > theirGoals;
  const drew = !forfeited && ourGoals === theirGoals;
  const lost = forfeited || ourGoals < theirGoals;
  const margin = Math.abs(ourGoals - theirGoals);

  let moraleDelta = forfeited
    ? SUNDAY_MORALE_FORFEIT
    : won ? SUNDAY_MORALE_WIN
      : drew ? SUNDAY_MORALE_DRAW
        : margin >= SUNDAY_HEAVY_LOSS_MARGIN ? SUNDAY_MORALE_HEAVY_LOSS : SUNDAY_MORALE_LOSS;
  moraleDelta -= ringers.length * SUNDAY_RINGER_MORALE;
  if (isDerby) moraleDelta += won ? SUNDAY_DERBY_MORALE : lost ? -SUNDAY_DERBY_MORALE : 0;

  const startedSet = new Set(startingIds);
  const usedSubs = new Set(
    result.events.filter(e => e.type === 'substitution' && e.playerId && e.clubId === clubId).map(e => e.playerId as string),
  );
  squad = squad.map(m => {
    const started = startedSet.has(m.playerId);
    const usedAsSub = usedSubs.has(m.playerId);
    const wasAvailable = m.availability.status !== 'out';
    let happy = m.happiness;
    if (started) happy += SUNDAY_HAPPY_STARTED;
    else if (usedAsSub) happy += SUNDAY_HAPPY_SUB_USED;
    else if (benchIds.includes(m.playerId)) happy += SUNDAY_HAPPY_SUB_UNUSED;
    else if (wasAvailable) {
      happy += SUNDAY_HAPPY_AVAILABLE_UNPICKED - Math.max(0, m.ego - 12) * SUNDAY_HAPPY_EGO_MULT;
      if (m.playerId === sunday.captainId) happy += SUNDAY_HAPPY_CAPTAIN_BENCHED;
    }
    const r = ratingById.get(m.playerId);
    // A red card or a knock takes effect the moment the whistle goes, not at
    // the next advance. Without this the squad screen showed a banned player as
    // available all the way to the following Sunday — and the teamsheet would
    // have let the manager name him.
    const p = players[m.playerId];
    const banned = p && p.suspendedUntilWeek != null && p.suspendedUntilWeek > week;
    const hurt = p && p.injured && p.injuryWeeks > 0;
    const availability = banned
      ? { status: 'out' as const, reason: 'suspended' as const, note: `${p.firstName} is banned`, warned: true, weeksRemaining: Math.max(1, (p.suspendedUntilWeek ?? week) - week) }
      : hurt
        ? { status: 'out' as const, reason: 'injury' as const, note: `${p.firstName} is injured`, warned: true, weeksRemaining: p.injuryWeeks }
        : m.availability;

    return {
      ...m,
      availability,
      happiness: clampRound(happy, 0, 100),
      benchedStreak: started || usedAsSub ? 0 : wasAvailable ? m.benchedStreak + 1 : m.benchedStreak,
      startedStreak: started ? m.startedStreak + 1 : 0,
      clubApps: started || usedAsSub ? m.clubApps + 1 : m.clubApps,
      clubGoals: m.clubGoals + (r?.goals ?? 0),
      clubAssists: m.clubAssists + (r?.assists ?? 0),
      clubMotm: motm?.playerId === m.playerId ? m.clubMotm + 1 : m.clubMotm,
    };
  });

  const repDelta = forfeited ? SUNDAY_REP_FORFEIT : won ? SUNDAY_REP_WIN : drew ? SUNDAY_REP_DRAW : SUNDAY_REP_LOSS;

  const rivalry = sunday.rivalry && isDerby
    ? {
        ...sunday.rivalry,
        wins: sunday.rivalry.wins + (won ? 1 : 0),
        draws: sunday.rivalry.draws + (drew ? 1 : 0),
        losses: sunday.rivalry.losses + (lost ? 1 : 0),
        heat: clamp(
          sunday.rivalry.heat + (lost ? SUNDAY_RIVAL_HEAT_LOSS : won ? SUNDAY_RIVAL_HEAT_WIN : 0),
          0, SUNDAY_RIVAL_HEAT_MAX,
        ),
      }
    : sunday.rivalry;

  narrative.push(rng.pick(SUNDAY_POSTMATCH_LINES) ?? '');

  // Squad members who actually took the field. Ringers are excluded — they do
  // not pay subs and they are not on the books.
  const squadIds = new Set(squad.map(m => m.playerId));
  const playedIds = [...participantIds].filter(id => squadIds.has(id));

  const report: SundayMatchReport = {
    matchId: result.id,
    season, week,
    opponentClubId: oppClubId,
    opponentName: oppClub.name,
    home: isHome,
    goalsFor: ourGoals,
    goalsAgainst: theirGoals,
    forfeited,
    noShows: noShows.map(m => m.playerId),
    startedWith: startingIds.length,
    ringersUsed: ringers.length,
    playedIds,
    motmPlayerId: motm?.playerId ?? null,
    motmRating: motm?.rating ?? 0,
    narrative: narrative.filter(Boolean),
    // Money is settled in the weekly advance so it can never be charged twice.
    moneyDelta: 0,
    moraleDelta,
  };

  // ── Fixture / cup bookkeeping ────────────────────────────────────────────
  let fixtures = state.fixtures;
  let cup = sunday.cup;
  if (isCup && cup) {
    const ties = cup.ties.map(t =>
      t.round === fixture.tie.round && t.homeClubId === homeClubId && t.awayClubId === awayClubId
        ? {
            ...t, played: true,
            homeGoals: result.homeGoals, awayGoals: result.awayGoals,
            winnerClubId: cupWinnerId, shootout: shootoutScore,
          }
        : t,
    );
    cup = { ...cup, ties };
    // Simulate the rest of this cup round so the bracket can advance.
    cup = simulateRemainingCupTies(rng, cup, fixture.tie.round, clubs, players, week, season);
    cup = advanceSundayCup(cup, sunday.divisionId, fixture.tie.round);
    if (cupWinnerId !== clubId) cup = { ...cup, eliminated: true };
  } else {
    fixtures = state.fixtures.map(m => (m.id === baseMatch.id ? result : m));
  }

  // ── Season aggregates ────────────────────────────────────────────────────
  const seasonStats = isCup
    ? sunday.seasonStats
    : {
        ...sunday.seasonStats,
        played: sunday.seasonStats.played + 1,
        won: sunday.seasonStats.won + (won ? 1 : 0),
        drawn: sunday.seasonStats.drawn + (drew ? 1 : 0),
        lost: sunday.seasonStats.lost + (lost ? 1 : 0),
        goalsFor: sunday.seasonStats.goalsFor + ourGoals,
        goalsAgainst: sunday.seasonStats.goalsAgainst + theirGoals,
        cleanSheets: sunday.seasonStats.cleanSheets + (theirGoals === 0 && !forfeited ? 1 : 0),
        forfeits: sunday.seasonStats.forfeits + (forfeited ? 1 : 0),
        noShows: sunday.seasonStats.noShows + noShows.length,
        biggestWin: Math.max(sunday.seasonStats.biggestWin, won ? margin : 0),
        unbeatenRun: lost ? 0 : sunday.seasonStats.unbeatenRun + 1,
        bestUnbeatenRun: Math.max(
          sunday.seasonStats.bestUnbeatenRun,
          lost ? 0 : sunday.seasonStats.unbeatenRun + 1,
        ),
        winlessRun: won ? 0 : sunday.seasonStats.winlessRun + 1,
        winRun: won ? sunday.seasonStats.winRun + 1 : 0,
        bestWinRun: Math.max(sunday.seasonStats.bestWinRun, won ? sunday.seasonStats.winRun + 1 : 0),
      };

  // Ringers exist for one afternoon only.
  const cleaned = clearSundayRingers(players) ?? players;

  const nextSunday: SundayState = {
    ...sunday,
    squad,
    cup,
    rivalry,
    teamMorale: clampRound(sunday.teamMorale + moraleDelta, 0, 100),
    reputation: clampRound(sunday.reputation + repDelta, 0, 100),
    lastMatch: report,
    seasonStats,
    // The named team was consumed by the fixture it was named for. Leaving it
    // in place kept a player who got injured or sent off DURING the match on
    // the sheet until the next advance — a teamsheet naming an unavailable
    // player, which the validator rightly rejects.
    teamsheet: [],
    bench: [],
    teamsheetLocked: false,
    // Deliberately NOT advancing `rngCursor` — the match drew from its own
    // week-keyed stream (see above), and the persistent cursor is reserved for
    // player-initiated actions so it stays identical across a reload.
    weekLog: logWeek(sunday, forfeited
      ? 'Fixture not fulfilled.'
      : `${isCup ? 'Cup: ' : ''}${ourGoals}-${theirGoals} ${won ? 'win' : drew ? 'draw' : 'defeat'} ${isHome ? 'at home to' : 'away at'} ${oppClub.shortName}.`),
  };

  const table = buildSundayTable(fixtures, sunday.divisionClubIds);
  set({
    players: cleaned,
    fixtures,
    leagueTable: table,
    divisionFixtures: { ...state.divisionFixtures, [sunday.divisionId]: fixtures },
    divisionTables: { ...state.divisionTables, [sunday.divisionId]: table },
    sunday: nextSunday,
    currentMatchResult: result,
    matchPlayerRatings: ratings,
  });

  return report;
}

/**
 * Play out the cup ties in `round` that do not involve the player.
 *
 * Kept crude on purpose — a full engine run for every AI cup tie triples the
 * cost of a cup week for results nobody watches. Strength comes from the same
 * `getTeamStrength` the engine uses, so the bracket stays plausible.
 */
function simulateRemainingCupTies(
  rng: SundayRng,
  cup: NonNullable<SundayState['cup']>,
  round: number,
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  week: number,
  season: number,
): NonNullable<SundayState['cup']> {
  const strength = (clubId: string): number => {
    const club = clubs[clubId];
    if (!club) return 30;
    const squad = club.playerIds.map(id => players[id]).filter(Boolean).slice(0, 14);
    if (!squad.length) return 30;
    return squad.reduce((n, p) => n + p.overall, 0) / squad.length;
  };
  const ties = cup.ties.map(t => {
    if (t.round !== round || t.played) return t;
    const h = strength(t.homeClubId) * 1.1;
    const a = strength(t.awayClubId);
    const homeShare = h / (h + a);
    const homeGoals = rng.int(0, 2) + (rng.chance(homeShare) ? 1 : 0);
    const awayGoals = rng.int(0, 2) + (rng.chance(1 - homeShare) ? 1 : 0);
    let winner: string;
    let sh: { home: number; away: number } | null = null;
    if (homeGoals === awayGoals) {
      sh = { home: rng.int(2, 5), away: rng.int(2, 5) };
      if (sh.home === sh.away) sh.home++;
      winner = sh.home > sh.away ? t.homeClubId : t.awayClubId;
    } else {
      winner = homeGoals > awayGoals ? t.homeClubId : t.awayClubId;
    }
    return { ...t, played: true, homeGoals, awayGoals, winnerClubId: winner, shootout: sh };
  });
  void week; void season;
  return { ...cup, ties };
}
