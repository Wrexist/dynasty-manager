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
  SundayArrival, FormationType, MatchEvent, MatchWeather, SundayHalfTime, SundayMatchTier,
  Club, InjuryDetails, Match, Player, PlayerMatchRating, SundayCupTie,
  SundayLedgerLine, SundayMatchReport, SundaySquadMember, SundayState, SundayTacticId,
} from '@/types/game';
import { computeMinutesPlayed, extractFinalMatchFitness, getYellowAccumulationBanWeek } from '@/store/slices/orchestration/helpers';
import { RED_CARD_SUSPENSION_MIN, RED_CARD_SUSPENSION_RANGE } from '@/config/gameBalance';
import {
  SUNDAY_FULL_XI, SUNDAY_HAPPY_AVAILABLE_UNPICKED, SUNDAY_HAPPY_CAPTAIN_BENCHED,
  SUNDAY_HAPPY_EGO_MULT, SUNDAY_HAPPY_STARTED, SUNDAY_HAPPY_SUB_UNUSED,
  SUNDAY_HAPPY_SUB_USED, SUNDAY_HEAVY_LOSS_MARGIN, SUNDAY_MAX_BENCH, SUNDAY_MAX_RINGERS,
  SUNDAY_MIN_START, SUNDAY_MORALE_DRAW, SUNDAY_MORALE_FORFEIT, SUNDAY_MORALE_HEAVY_LOSS,
  SUNDAY_MORALE_LOSS, SUNDAY_MORALE_WIN, SUNDAY_PITCH_BASE, SUNDAY_PITCH_MIN, SUNDAY_PITCH_PER_UPGRADE,
  SUNDAY_PITCH_WINTER_DROP, SUNDAY_REP_DRAW, SUNDAY_REP_FORFEIT, SUNDAY_REP_LOSS,
  SUNDAY_REP_WIN, SUNDAY_RINGER_MORALE, SUNDAY_RIVAL_HEAT_LOSS, SUNDAY_RIVAL_HEAT_MAX,
  SUNDAY_RIVAL_HEAT_WIN, SUNDAY_RIVAL_INTENSITY_SCALE, SUNDAY_DERBY_MORALE,
  getSundayTactic,
  SUNDAY_FORM_BASELINE_RATING, SUNDAY_FORM_MAX, SUNDAY_FORM_MIN, SUNDAY_FORM_PER_RATING,
  SUNDAY_PROMISE_BROKEN_HAPPINESS, SUNDAY_PROMISE_BROKEN_MORALE, SUNDAY_PROMISE_KEPT_HAPPINESS,
  SUNDAY_RINGER_COST, SUNDAY_DERBY_BET, SUNDAY_DERBY_BET_FLAG, SUNDAY_TACTICS,
  SUNDAY_CLUBHOUSE_POSTMATCH_MORALE,
} from '@/config/sundayLeague';
import {
  SUNDAY_ARRIVAL_CRIED_OFF, SUNDAY_ARRIVAL_NO_SHOW, SUNDAY_ARRIVAL_TURNED_UP,
  SUNDAY_POSTMATCH_LINES,
} from '@/data/sundayNames';
import { captureMatchMemories, findMatchWinner, findTurningPoint, makeMemory, rememberMoment } from '@/utils/sunday/memories';
import { bumpHeat, deriveDerbyIncident, recordRivalryIncident } from '@/utils/sunday/rivalry';
import { resolveDoubt } from '@/utils/sunday/availability';
import { bumpSundayAppsWith } from '@/utils/sunday/relationships';
import { clearSundayRingers, generateSundayRinger } from '@/utils/sunday/generation';
import type { SundayAdjustment } from '@/utils/sunday/match';
import {
  buildMatchdayTeam, buildSundayNarrative, finishSundaySecondHalf, pickMotm,
  pickSundayOppositionXI, rollSundayWeather, simulateSundayFirstHalf,
  simulateSundayMatch, sundayStyleOf, sundayTacticFit,
} from '@/utils/sunday/match';
import { advanceSundayCup, buildSundayTable, recordSundayRecord, sundayCupRoundName, sundaySeasonWeeks } from '@/utils/sunday/season';
import { deriveSundayStakes } from '@/utils/sunday/tier';
import { selectBestLineup } from '@/utils/playerGen';
import type { SundayRng } from '@/utils/sunday/rng';
import { createSundayRng, cursorOf, subSeed } from '@/utils/sunday/rng';
import type { Get, Set } from './shared';
import { clamp, clampRound, logWeek, upgradeLevel } from './shared';

/** Current pitch quality: base, plus what has been paid for, minus winter, minus
 *  whatever has been churned out of it and not yet grown back. */
export function sundayPitchQuality(sunday: SundayState, week: number): number {
  const total = sundaySeasonWeeks(sunday.divisionId);
  const share = total > 0 ? week / total : 0;
  const winter = share > 0.3 && share < 0.75 ? SUNDAY_PITCH_WINTER_DROP : 0;
  const damage = Math.max(0, sunday.pitchDamage ?? 0);
  return clamp(
    SUNDAY_PITCH_BASE + upgradeLevel(sunday, 'pitch') * SUNDAY_PITCH_PER_UPGRADE - winter - damage,
    SUNDAY_PITCH_MIN, 100,
  );
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

// ── The arrival phase ───────────────────────────────────────────────────────

/**
 * Resolve the Sunday morning: doubts turn up or cry off, unwarned absentees
 * are discovered, and the shortfall is counted.
 *
 * Idempotent per (season, week): the resolved morning is WRITTEN to state, so
 * a reload, a re-render or a second tap replays the same one. Draws come from
 * the front of the week's match stream; the stored cursor lets the match
 * itself continue that stream without repeating the morning's luck.
 *
 * This is where the mode's sharpest decision is staged: below eleven, the
 * manager chooses between paying for guests and playing short — see
 * `hireSundayRingers`. Below seven, guests are forced, because the
 * alternative is handing the league a walkover.
 */
export function ensureArrival(set: Set, get: Get): SundayArrival | null {
  const state = get();
  const sunday = state.sunday;
  if (!sunday || sunday.folded || sunday.seasonComplete) return null;
  if (sunday.arrival && sunday.arrival.season === state.season && sunday.arrival.week === state.week) {
    return sunday.arrival;
  }
  const clubId = state.playerClubId;
  const fixture = findSundayFixture(sunday, state.fixtures, state.week, clubId);
  if (!fixture) return null;

  const season = state.season;
  const week = state.week;
  const rng = createSundayRng(subSeed(sunday.seed, `match:${season}:${week}`), 0);
  const beats: string[] = [];
  const players = state.players;
  const nameOf = (id: string) => players[id]?.firstName ?? 'Someone';

  // Doubts resolve first — the "should be alright" messages coming true or not.
  const squad: SundaySquadMember[] = sunday.squad.map(m => {
    if (m.availability.status !== 'doubt') return m;
    const resolved = resolveDoubt(rng, m.availability);
    const line = resolved.status === 'available' ? SUNDAY_ARRIVAL_TURNED_UP : SUNDAY_ARRIVAL_CRIED_OFF;
    beats.push((rng.pick(line) ?? '{name}.').replace('{name}', nameOf(m.playerId)));
    return { ...m, availability: resolved };
  });

  // Then the discoveries: people who never said a word and are simply not here.
  for (const m of squad) {
    if (m.availability.status === 'out' && !m.availability.warned) {
      beats.push((rng.pick(SUNDAY_ARRIVAL_NO_SHOW) ?? '{name} is missing.').replace('{name}', nameOf(m.playerId)));
    }
  }

  // The XI that is actually standing here: the named side minus the missing.
  // When it is gutted, the BENCH steps up — they were named and they made the
  // trip. The deliberately-unnamed never auto-return: dropping a player has to
  // stick, or a promise (and a punishment) could be silently undone by this
  // very function re-picking him. The remaining gap is the ringer decision.
  const availableIds = new Set(squad.filter(m => m.availability.status !== 'out').map(m => m.playerId));
  const presentIds = sunday.teamsheet.filter(id => availableIds.has(id));
  const benchPool = sunday.bench.filter(id => availableIds.has(id) && !presentIds.includes(id));
  while (presentIds.length < SUNDAY_FULL_XI && benchPool.length > 0) {
    presentIds.push(benchPool.shift()!);
  }
  let benchIds = benchPool;
  if (sunday.teamsheet.length === 0) {
    // Never named at all (the advance-the-week path): pick the side the
    // manager would have.
    const auto = autoPickSunday({ ...sunday, squad }, players);
    for (const id of auto.xi) {
      if (presentIds.length >= SUNDAY_FULL_XI) break;
      if (!presentIds.includes(id)) presentIds.push(id);
    }
    benchIds = auto.bench.filter(id => !presentIds.includes(id)).slice(0, SUNDAY_MAX_BENCH);
  }

  const forcedRingers = Math.min(SUNDAY_MAX_RINGERS, Math.max(0, SUNDAY_MIN_START - presentIds.length));
  const optionalRingers = Math.max(
    0,
    Math.min(SUNDAY_MAX_RINGERS - forcedRingers, SUNDAY_FULL_XI - presentIds.length - forcedRingers),
  );

  const arrival: SundayArrival = {
    season, week, beats, presentIds, benchIds,
    forcedRingers, optionalRingers, ringersHired: null,
    rngCursor: cursorOf(rng),
  };
  // THE SHEET NOW SAYS WHO IS HERE.
  //
  // The morning takes men out of the squad, and leaving the named XI alone left
  // the state carrying a teamsheet with an unavailable player on it for the
  // whole of Match Day — the exact shape `validateSundayState` rejects, and the
  // exact reason the whistle already clears the sheet (see the note there). A
  // save taken in that window — an autosave, a backgrounded app — loaded back
  // as an invalid state and said so in the dev console.
  //
  // Writing the arrival's own XI and bench back is not a new decision: it is
  // the side `prepareSundayMatch` will field either way, since the kick-off
  // reads `arrival.presentIds` and never the sheet. `teamsheetLocked` follows
  // it, because a side gutted below the legal minimum is not a locked side any
  // more — it is a forfeit waiting for guests.
  set({
    sunday: {
      ...get().sunday!,
      squad,
      arrival,
      teamsheet: [...presentIds],
      bench: [...benchIds],
      teamsheetLocked: presentIds.length >= SUNDAY_MIN_START,
    },
  });
  return arrival;
}

/**
 * The manager's arrival decision: hire `count` optional guests (0 = play
 * short). Charged here, once — a decision, not a toggle: it cannot be
 * revisited once made, exactly like standing in a car park at kick-off.
 */
export function hireSundayRingers(set: Set, get: Get, count: number): { ok: boolean; message: string } {
  const state = get();
  const sunday = state.sunday;
  const arrival = sunday?.arrival;
  if (!sunday || !arrival || arrival.week !== state.week || arrival.season !== state.season) {
    return { ok: false, message: 'There is no morning to decide about.' };
  }
  if (arrival.ringersHired !== null) return { ok: false, message: 'That decision has been made.' };
  const hired = Math.max(0, Math.min(arrival.optionalRingers, Math.floor(count)));
  const cost = hired * SUNDAY_RINGER_COST;
  if (hired > 0 && sunday.balance < cost) {
    return { ok: false, message: `You cannot cover £${cost} for ${hired} guest${hired === 1 ? '' : 's'}.` };
  }
  // Charged ONCE, as a ledger line at the weekly settlement, via the report's
  // ringer count — the same path the forced guests take. Moving the balance
  // here as well would double-charge.
  set({ sunday: { ...sunday, arrival: { ...arrival, ringersHired: hired } } });
  return {
    ok: true,
    message: hired > 0
      ? `${hired} guest${hired === 1 ? '' : 's'} sorted. £${cost} when the whip-round settles.`
      : `You go with the ${arrival.presentIds.length + arrival.forcedRingers} you have.`,
  };
}

export interface RunSundayMatchResult {
  report: SundayMatchReport;
}

/**
 * Everything settled before a ball is kicked.
 *
 * Pulled out of `runSundayMatch` so the SAME preparation serves three callers:
 * the atomic ninety minutes, the first half of an interactive match, and the
 * resumption of one at half time. The last of those is why `resume` exists —
 * a paused match must be reconstructed EXACTLY, guests and weather included,
 * and none of it may be re-rolled.
 */
interface SundayMatchSetup {
  clubId: string;
  week: number;
  season: number;
  fixture: NonNullable<ReturnType<typeof findSundayFixture>>;
  isCup: boolean;
  cupRound: number | null;
  homeClubId: string;
  awayClubId: string;
  isHome: boolean;
  oppClubId: string;
  ourClub: Club;
  oppClub: Club;
  /** A LOCAL copy of the players map with the guests added. Never the store's. */
  players: Record<string, Player>;
  squad: SundaySquadMember[];
  noShows: SundaySquadMember[];
  arrivalBeats: string[];
  ringers: Player[];
  startingIds: string[];
  benchIds: string[];
  forfeited: boolean;
  rng: SundayRng;
  weather: MatchWeather;
  pitchQuality: number;
  isDerby: boolean;
  derbyIntensity: number;
  tier: SundayMatchTier;
  oppTactic: SundayTacticId;
  baseMatch: Match;
  /** The tactic the football is actually played under. */
  tacticId: SundayTacticId;
}

function prepareSundayMatch(set: Set, get: Get, resume?: SundayHalfTime): SundayMatchSetup | null {
  const state = get();
  const sunday = state.sunday;
  if (!sunday || sunday.folded || sunday.seasonComplete) return null;
  const clubId = state.playerClubId;
  const fixture = findSundayFixture(sunday, state.fixtures, state.week, clubId);
  if (!fixture) return null;

  const week = state.week;
  const season = state.season;
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

  // ── The Sunday morning ───────────────────────────────────────────────────
  // Who is actually here was settled by the arrival phase — including the
  // manager's ringer decision. When the player skipped Match Day entirely
  // (advancing the week directly), arrive now with the default decision:
  // forced guests only, which is exactly the old automatic behaviour.
  const arrival = ensureArrival(set, get) ?? {
    season, week, beats: [], presentIds: [], benchIds: [],
    forcedRingers: 0, optionalRingers: 0, ringersHired: null, rngCursor: 0,
  };
  // Continue the match stream from where the arrival draws left it — replaying
  // them would correlate the morning's luck with the afternoon's. A resumed
  // match continues from where its own first half left the stream.
  const rng = createSundayRng(
    subSeed(sunday.seed, `match:${season}:${week}`),
    resume ? resume.rngCursor : arrival.rngCursor,
  );

  const squad: SundaySquadMember[] = get().sunday?.squad ?? sunday.squad;
  const noShows = squad.filter(m => m.availability.status === 'out' && !m.availability.warned);

  // ── Ringers ──────────────────────────────────────────────────────────────
  // Forced guests keep the fixture alive; optional ones are the manager's
  // call, made (and paid for) at arrival. An undecided arrival means the
  // manager never looked — forced only.
  //
  // A RESUMED match takes its guests off the pause rather than generating new
  // ones: they only exist for one afternoon and are wiped at the whistle, so
  // re-rolling them here would put eleven different men on the pitch for the
  // second half of a match nine of them already played.
  let ringers: Player[];
  let startingIds: string[];
  let benchIds: string[];
  if (resume) {
    ringers = resume.ringers;
    startingIds = [...resume.startingIds];
    benchIds = [...resume.benchIds];
  } else {
    const ringerCount = Math.min(
      SUNDAY_MAX_RINGERS,
      arrival.forcedRingers + (arrival.ringersHired ?? 0),
    );
    ringers = [];
    for (let i = 0; i < ringerCount; i++) ringers.push(generateSundayRinger(rng, clubId, season, i));
    startingIds = [...arrival.presentIds, ...ringers.map(r => r.id)].slice(0, SUNDAY_FULL_XI);
    benchIds = [...arrival.benchIds];
  }
  for (const r of ringers) players[r.id] = r;
  const forfeited = startingIds.length < SUNDAY_MIN_START;

  const pitchQuality = resume ? resume.pitchQuality : sundayPitchQuality(sunday, week);
  const weather = resume
    ? resume.weather
    : rollSundayWeather(rng, week, sundaySeasonWeeks(sunday.divisionId), pitchQuality);
  // How big this afternoon is, fixed BEFORE the result exists — the table it
  // reads is the one the manager saw in the briefing, so the tier on the
  // report is the tier he was shown.
  const tier = resume ? resume.tier : deriveSundayStakes({
    divisionId: sunday.divisionId,
    clubId,
    opponentClubId: oppClubId,
    fixtures: state.fixtures,
    divisionClubIds: sunday.divisionClubIds,
    table: buildSundayTable(state.fixtures, sunday.divisionClubIds),
    rivalClubId: sunday.rivalry?.clubId ?? null,
    cupRound: isCup ? fixture.tie.round : null,
  }).tier;
  const isDerby = sunday.rivalry?.clubId === oppClubId;
  const derbyIntensity = resume ? resume.derbyIntensity
    : isDerby && sunday.rivalry
      ? clamp(sunday.rivalry.heat * SUNDAY_RIVAL_INTENSITY_SCALE, 0, 3)
      : 0;

  // How they play. Held for the season and derived from their own squad, so
  // the manager can learn a side and set up against it — and so the engine's
  // tactical-matchup channel is live for all four of the player's options
  // instead of being flat against a division of hardcoded Route One.
  const oppTactic = resume ? resume.oppTactic : sundayStyleOf(sunday.divisionStyles, oppClubId, clubs, players);

  const baseMatch: Match = isCup
    ? {
        id: `sun-cup-${season}-${fixture.tie.round}-${homeClubId}-${awayClubId}`,
        week, homeClubId, awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [],
      }
    : fixture.match;

  return {
    clubId, week, season, fixture, isCup, cupRound: isCup ? fixture.tie.round : null,
    homeClubId, awayClubId, isHome, oppClubId, ourClub, oppClub,
    players, squad, noShows, arrivalBeats: arrival.beats,
    ringers, startingIds, benchIds, forfeited,
    rng, weather, pitchQuality, isDerby, derbyIntensity, tier, oppTactic, baseMatch,
    tacticId: get().sunday?.tactic ?? sunday.tactic,
  };
}

/** Everything the football produced, before any of it is written down. */
interface SundaySimOutcome {
  result: Match;
  ratings: PlayerMatchRating[];
  injuries: Record<string, InjuryDetails>;
  /** The complete feed, arrival beats included. */
  narrative: string[];
  motm: PlayerMatchRating | null;
  /** Why our side was better or worse than it looks on paper — the labelled
   *  list `buildMatchdayTeam` produced for the XI that finished the match. */
  adjustments: SundayAdjustment[];
}

/**
 * The forfeit outcome: nobody played, and the feed says why.
 *
 * A forfeit is not a match, which is why it never reaches the engine and never
 * takes the half-time path.
 */
function forfeitOutcome(setup: SundayMatchSetup): SundaySimOutcome {
  const { isHome, baseMatch, arrivalBeats } = setup;
  return {
    result: {
      ...baseMatch,
      played: true,
      homeGoals: isHome ? 0 : 3,
      awayGoals: isHome ? 3 : 0,
      events: [{ minute: 0, type: 'full_time', clubId: '', description: '— Fixture not fulfilled —' }],
    },
    ratings: [],
    injuries: {},
    motm: null,
    // Nobody played, so nothing helped or hindered them.
    adjustments: [],
    narrative: [
      ...arrivalBeats,
      `You could not raise ${SUNDAY_MIN_START}. The referee waited twenty minutes and then went home.`,
      'The result stands as a 3-0 defeat and the league will be in touch about the fine.',
    ],
  };
}

/**
 * Both sides as the engine will see them, under a given tactic.
 *
 * Pure: it never draws, so the second half can rebuild OUR side under a new
 * tactic without disturbing the seeded stream or the opposition. The
 * opposition XI is passed in because choosing it does draw, and it is chosen
 * exactly once per match.
 */
function buildSundaySides(
  setup: SundayMatchSetup,
  sunday: SundayState,
  tacticId: SundayTacticId,
  opp: { xi: Player[]; bench: Player[]; formation: FormationType },
) {
  const { players, squad, startingIds, benchIds, pitchQuality, ourClub, oppClub, isHome } = setup;
  const ourXI = startingIds.map(id => players[id]).filter((p): p is Player => !!p);
  const ourBenchPlayers = benchIds.map(id => players[id]).filter((p): p is Player => !!p);

  const ourTeam = buildMatchdayTeam({
    xi: ourXI, squad, tacticId, pitchQuality,
    ballsLevel: upgradeLevel(sunday, 'balls'), glovesLevel: upgradeLevel(sunday, 'keeper-gloves'),
    coachLevel: upgradeLevel(sunday, 'coach'), teamMorale: sunday.teamMorale, isPlayerClub: true,
  });
  // The opposition get the pitch and their own tactical fit — they picked a
  // tactic too, and a fit only the manager can hold would be a thumb on the
  // scale rather than a system. They do NOT get equipment, a coach or a
  // dressing room: those are things the club buys, and they have no Sunday
  // state of their own to buy them with.
  const oppTeam = buildMatchdayTeam({
    xi: opp.xi, squad: [], tacticId: setup.oppTactic, pitchQuality,
    ballsLevel: 0, glovesLevel: 0, coachLevel: 0, teamMorale: 55, isPlayerClub: false,
  });

  // `club.lineup` is what the chemistry calculation aligns against, so the
  // match-day copies of the clubs carry the sides that are actually playing —
  // in the shape their own tactic asks for, on both sides.
  const ourFormation = startingIds.length >= SUNDAY_FULL_XI
    ? getSundayTactic(tacticId).formation
    : getSundayTactic(tacticId).shortFormation;
  const ourClubForSim: Club = { ...ourClub, lineup: ourTeam.players.map(p => p.id), formation: ourFormation };
  const oppClubForSim: Club = { ...oppClub, lineup: oppTeam.players.map(p => p.id), formation: opp.formation };

  return {
    ourTeam, oppTeam, ourBenchPlayers,
    homeClub: isHome ? ourClubForSim : oppClubForSim,
    awayClub: isHome ? oppClubForSim : ourClubForSim,
    homeXI: isHome ? ourTeam.players : oppTeam.players,
    awayXI: isHome ? oppTeam.players : ourTeam.players,
    homeBench: isHome ? ourBenchPlayers : opp.bench,
    awayBench: isHome ? opp.bench : ourBenchPlayers,
    homeTacticId: isHome ? tacticId : setup.oppTactic,
    awayTacticId: isHome ? setup.oppTactic : tacticId,
  };
}

/** The feed for a stretch of the match, in the mode's voice. */
function narrateSunday(
  setup: SundayMatchSetup,
  sunday: SundayState,
  events: readonly MatchEvent[],
  phase: 'full' | 'first' | 'second',
): string[] {
  const { rng, clubId, players, isDerby, noShows, ringers, startingIds, squad, isCup, fixture } = setup;
  return buildSundayNarrative({
    rng,
    events,
    clubId,
    players,
    isDerby,
    noShowNames: noShows.map(m => players[m.playerId]?.firstName ?? 'someone'),
    ringerNames: ringers.map(r => r.firstName),
    startedWith: startingIds.length,
    homeGoals: 0,
    awayGoals: 0,
    isHome: setup.isHome,
    // The club's own records reach the feed here: what these men do on
    // weekdays, how many afternoons they have given the club, and — for the
    // build-up only — the one who crossed the road.
    squad,
    startedIds: startingIds,
    cupRound: isCup && fixture.kind === 'cup' ? sundayCupRoundName(fixture.tie.round) : null,
    defectorName: sunday.rivalry?.defector?.name ?? null,
    phase,
  });
}

/** The whole ninety minutes in one call. Every path but the interactive one. */
function simulateSundayFull(
  setup: SundayMatchSetup,
  sunday: SundayState,
  prePicked?: { xi: Player[]; bench: Player[]; formation: FormationType },
): SundaySimOutcome {
  const { rng, players, oppClub, week, isHome, startingIds, arrivalBeats } = setup;
  // Passed in when the caller has already drawn it — drawing twice would both
  // move the seeded stream and field two different oppositions.
  const opp = prePicked ?? pickSundayOppositionXI(rng, oppClub, players, week, setup.oppTactic);
  const sides = buildSundaySides(setup, sunday, setup.tacticId, opp);

  const outcome = simulateSundayMatch({
    rng,
    match: setup.baseMatch,
    ...sides,
    weather: setup.weather,
    derbyIntensity: setup.derbyIntensity,
    season: setup.season,
    playerPhysioLevel: upgradeLevel(sunday, 'physio'),
    playerIsHome: isHome,
  });

  return {
    result: outcome.result,
    ratings: outcome.playerRatings,
    injuries: outcome.matchInjuries,
    motm: pickMotm(outcome.playerRatings, startingIds),
    adjustments: sides.ourTeam.adjustments,
    narrative: [...arrivalBeats, ...narrateSunday(setup, sunday, outcome.result.events, 'full')],
  };
}

/**
 * Write every consequence of a played (or abandoned) fixture, exactly once.
 *
 * The single place a Sunday result becomes history: player stats, the squad's
 * happiness and streaks, memories, promises, the rivalry, records, the table
 * and the report itself. Both the atomic path and the half-time path end here
 * with the same shape, which is what makes them interchangeable.
 */
function settleSundayMatch(set: Set, get: Get, setup: SundayMatchSetup, sim: SundaySimOutcome): SundayMatchReport {
  const state = get();
  // The FRESH Sunday state: a half-time tactic switch happens between the
  // preparation and this call, and spreading a stale copy would undo it.
  const sunday = state.sunday!;
  const {
    clubId, week, season, fixture, isCup, homeClubId, awayClubId, isHome, oppClubId,
    oppClub, players, ringers, startingIds, benchIds, forfeited, rng, tier, isDerby, noShows,
  } = setup;
  const clubs = state.clubs;
  const cupTie = fixture.kind === 'cup' ? fixture.tie : null;
  let squad = setup.squad;
  const { result, ratings, injuries, motm } = sim;
  const ringerIds = new Set(ringers.map(r => r.id));
  const narrative = [...sim.narrative];
  const ourGoals = isHome ? result.homeGoals : result.awayGoals;
  const theirGoals = isHome ? result.awayGoals : result.homeGoals;

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
  // NOBODY PLAYED IN A FORFEIT. The referee waited twenty minutes and went
  // home, so there are no participants: no appearances, no career minutes, no
  // fitness cost, no club apps, no form movement. Before this the men who did
  // turn up were credited with a full ninety off the synthetic `full_time`
  // event — which fed development, so an abandoned fixture grew the youngsters.
  const participantIds = new Set<string>();
  if (!forfeited) {
    for (const r of ratings) participantIds.add(r.playerId);
    for (const id of startingIds) participantIds.add(id);
  }
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
            // Form follows performance. The engine reads `form` in shot
            // quality, so a striker on a run genuinely scores more and a slump
            // genuinely deepens — visible momentum with no hidden hand. This
            // was generated once and never updated before v2: a dead input.
            form: clampRound(
              p.form + (rating - SUNDAY_FORM_BASELINE_RATING) * SUNDAY_FORM_PER_RATING,
              SUNDAY_FORM_MIN, SUNDAY_FORM_MAX,
            ),
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
  // An hour in the clubhouse afterwards. This is the effect the upgrade's card
  // has always advertised as a "post-match morale boost" — until now it was a
  // single +2 at the till and nothing on any Sunday since. Home only: there is
  // no clubhouse at their place, and not for a fixture that was not fulfilled.
  const clubhouseLevel = sunday.upgrades.find(u => u.id === 'clubhouse')?.level ?? 0;
  if (!forfeited && isHome && clubhouseLevel > 0) {
    moraleDelta += clubhouseLevel * SUNDAY_CLUBHOUSE_POSTMATCH_MORALE;
  }

  // Nobody started and nobody came on when the fixture was not fulfilled.
  const startedSet = new Set(forfeited ? [] : startingIds);
  const usedSubs = new Set(
    result.events.filter(e => e.type === 'substitution' && e.playerId && e.clubId === clubId).map(e => e.playerId as string),
  );

  // ── The story of the match ───────────────────────────────────────────────
  // Who won it, who stank it out, and where it turned — all read off the
  // engine's own events, never invented.
  const squadIdSet = new Set(squad.map(m => m.playerId));
  // Everybody on the books who actually took the field. Feeds the shared-
  // appearance counter below, which is the only history the friendship rule
  // reads: two men are mates because they have played twenty afternoons
  // together, not because a dice said so. Guests are excluded — they are here
  // for one morning and are wiped after the whistle.
  const tookTheField = new Set([...participantIds].filter(id => squadIdSet.has(id)));
  const winner = forfeited ? null : findMatchWinner(result, clubId, isHome);
  const winnerId = winner && squadIdSet.has(winner.playerId) ? winner.playerId : null;
  const turningPoint = forfeited ? null : findTurningPoint(result, clubId, isHome, players);
  // The three worst men on the pitch by ability. One of them winning the match
  // is the afternoon a club retells for years, so it is worth its own memory —
  // and it is a fact about who was out there, not a judgement.
  const weakestIds = new Set(
    startingIds
      .map(id => players[id])
      .filter((p): p is Player => !!p)
      .sort((a, b) => a.overall - b.overall)
      .slice(0, 3)
      .map(p => p.id),
  );
  let lowlight: PlayerMatchRating | null = null;
  for (const r of ratings) {
    if (!squadIdSet.has(r.playerId)) continue;
    if (r.rating <= 5.2 && (!lowlight || r.rating < lowlight.rating)) lowlight = r;
  }
  const consequences: string[] = [];
  // A guest can win it too, and he has no biography to write it into — the
  // club just has to live with it.
  if (winner && !winnerId && ringerIds.has(winner.playerId)) {
    consequences.push('A guest nobody had met before won the match. Nobody is sure how to feel about it.');
  }
  const bansStarting: string[] = [];
  const injuriesPicked: string[] = [];
  const cupRound = cupTie ? sundayCupRoundName(cupTie.round) : null;
  let promiseMoraleHit = 0;

  squad = squad.map(m => {
    const started = startedSet.has(m.playerId);
    const usedAsSub = usedSubs.has(m.playerId);
    const wasAvailable = m.availability.status !== 'out';
    let happy = m.happiness;
    // Selection only means something when there was a selection. A forfeit is
    // a squad-wide `SUNDAY_MORALE_FORFEIT` and nothing personal: the men who
    // turned up were not "started", and the men who did not were not "left out".
    if (!forfeited) {
      if (started) happy += SUNDAY_HAPPY_STARTED;
      else if (usedAsSub) happy += SUNDAY_HAPPY_SUB_USED;
      else if (benchIds.includes(m.playerId)) happy += SUNDAY_HAPPY_SUB_UNUSED;
      else if (wasAvailable) {
        happy += SUNDAY_HAPPY_AVAILABLE_UNPICKED - Math.max(0, m.ego - 12) * SUNDAY_HAPPY_EGO_MULT;
        if (m.playerId === sunday.captainId) happy += SUNDAY_HAPPY_CAPTAIN_BENCHED;
      }
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

    // ── His story ──────────────────────────────────────────────────────────
    // Everything this match wrote into this player's biography, judged from
    // the state BEFORE the totals move.
    const took = started || usedAsSub;
    let memories = m.memories;
    if (!forfeited && p) {
      const newMemories = captureMatchMemories({
        rating: r,
        report: { goalsFor: ourGoals, goalsAgainst: theirGoals, opponentName: oppClub.name, season, week },
        isDerby,
        isCup,
        cupRound,
        winnerMinute: winnerId === m.playerId ? winner!.minute : null,
        motm: motm?.playerId === m.playerId,
        unlikelyHero: winnerId === m.playerId && weakestIds.has(m.playerId),
        played: took,
        sentOff: result.events.some(e => e.type === 'red_card' && e.playerId === m.playerId),
        injuryWeeks: p.injured ? p.injuryWeeks : 0,
        prevApps: m.clubApps,
        prevGoals: m.clubGoals,
      });
      for (const memory of newMemories) memories = rememberMoment(memories, memory);
    }
    if (p && p.injured && p.injuryWeeks > 0 && took) {
      injuriesPicked.push(`${p.firstName} (${p.injuryWeeks}w)`);
    }
    if (banned && p) bansStarting.push(p.firstName);

    // ── The promise ────────────────────────────────────────────────────────
    // "You will start on Sunday" is judged here, at the only moment it can
    // be: he started, or the match happened without him. An unavailable week
    // does not break it — you cannot start a man who is in Tenerife — and
    // neither does a forfeit: no Sunday happened, so the promise is still live
    // and rolls on to the next one.
    let promise = m.promise;
    if (promise && p && !forfeited) {
      if (started) {
        happy += SUNDAY_PROMISE_KEPT_HAPPINESS;
        memories = rememberMoment(memories, makeMemory(season, week, 'promise-kept',
          `The gaffer promised him a start against ${oppClub.name} and kept his word.`));
        consequences.push(`Promise kept — ${p.firstName} got his start.`);
        promise = null;
      } else if (wasAvailable && week >= promise.dueWeek) {
        happy += SUNDAY_PROMISE_BROKEN_HAPPINESS;
        promiseMoraleHit += SUNDAY_PROMISE_BROKEN_MORALE;
        memories = rememberMoment(memories, makeMemory(season, week, 'promise-broken',
          `Was promised a start and watched from the touchline against ${oppClub.name}. He has not forgotten.`));
        consequences.push(`Promise broken — ${p.firstName} was told he would start.`);
        promise = null;
      }
    }

    // A forfeit leaves the streaks and the club totals exactly where they were:
    // an abandoned fixture is not an appearance, and it is not a week benched
    // either.
    if (forfeited) {
      return { ...m, availability, memories, promise, happiness: clampRound(happy, 0, 100) };
    }

    return {
      ...m,
      availability,
      memories,
      promise,
      happiness: clampRound(happy, 0, 100),
      benchedStreak: took ? 0 : wasAvailable ? m.benchedStreak + 1 : m.benchedStreak,
      startedStreak: started ? m.startedStreak + 1 : 0,
      clubApps: took ? m.clubApps + 1 : m.clubApps,
      appsWith: took ? bumpSundayAppsWith(m.appsWith, tookTheField, m.playerId) : m.appsWith,
      clubGoals: m.clubGoals + (r?.goals ?? 0),
      clubAssists: m.clubAssists + (r?.assists ?? 0),
      clubMotm: motm?.playerId === m.playerId ? m.clubMotm + 1 : m.clubMotm,
    };
  });
  moraleDelta += promiseMoraleHit;

  const repDelta = forfeited ? SUNDAY_REP_FORFEIT : won ? SUNDAY_REP_WIN : drew ? SUNDAY_REP_DRAW : SUNDAY_REP_LOSS;

  let rivalry = sunday.rivalry;
  if (rivalry && isDerby) {
    rivalry = {
      ...rivalry,
      wins: rivalry.wins + (won ? 1 : 0),
      draws: rivalry.draws + (drew ? 1 : 0),
      losses: rivalry.losses + (lost ? 1 : 0),
      heat: clamp(
        rivalry.heat + (lost ? SUNDAY_RIVAL_HEAT_LOSS : won ? SUNDAY_RIVAL_HEAT_WIN : 0),
        0, SUNDAY_RIVAL_HEAT_MAX,
      ),
    };
    // The feud keeps its own diary. Hammerings, capitulations and results
    // with the defector involved all go in it, straight off the report.
    const incident = deriveDerbyIncident(rivalry, {
      season, week, goalsFor: ourGoals, goalsAgainst: theirGoals, forfeited,
      opponentName: oppClub.name,
    } as SundayMatchReport);
    if (incident.line) rivalry = recordRivalryIncident(rivalry, incident.line);
    if (incident.extraHeat) rivalry = bumpHeat(rivalry, incident.extraHeat);
    if (isCup && cupWinnerId && cupWinnerId !== clubId) {
      rivalry = recordRivalryIncident(bumpHeat(rivalry, 2),
        `Season ${season}: they knocked you out of the cup. ${rivalry.managerName} still mentions it.`);
    }
  }

  // The standing bet with their manager, settled the only place it can be:
  // on the result. `rival-trash-talk` used to offer "bet him £50" and stake
  // nothing at all, which made it a free morale bump with a joke attached.
  // A draw leaves it on the table — nobody pays out on a nil-nil.
  let betLine: SundayLedgerLine | null = null;
  let flags = sunday.flags;
  if (isDerby && !forfeited && (won || lost) && sunday.flags[SUNDAY_DERBY_BET_FLAG] != null) {
    const amount = won ? SUNDAY_DERBY_BET : -SUNDAY_DERBY_BET;
    betLine = {
      kind: 'event',
      amount,
      label: won ? 'Derby bet — collected' : 'Derby bet — paid out',
    };
    flags = Object.fromEntries(Object.entries(flags).filter(([k]) => k !== SUNDAY_DERBY_BET_FLAG));
    consequences.push(won
      ? `He paid the £${SUNDAY_DERBY_BET} in the car park, in front of people.`
      : `You paid him the £${SUNDAY_DERBY_BET} in the car park, in front of people.`);
  }

  narrative.push(rng.pick(SUNDAY_POSTMATCH_LINES) ?? '');

  // Squad members who actually took the field. Ringers are excluded — they do
  // not pay subs and they are not on the books — and so is everybody on a
  // forfeit, which is why `participantIds` is empty above: the weekly ledger
  // reads this list to collect match fees, and charging subs for a fixture
  // nobody played was the club billing its own members for a car park.
  const squadIds = new Set(squad.map(m => m.playerId));
  const playedIds = [...participantIds].filter(id => squadIds.has(id));

  // What Sunday costs you. Every line is a real state change made above.
  const buildConsequences = (): string[] => {
    const out: string[] = [...consequences];
    if (injuriesPicked.length) out.push(`Injured: ${injuriesPicked.join(', ')}.`);
    if (bansStarting.length) out.push(`Suspended: ${bansStarting.join(', ')}.`);
    if (isDerby) out.push(won ? 'Derby won. The pub is yours tonight.' : lost ? 'Derby lost. Expect to hear about it.' : 'Derby honours even. Nobody satisfied.');
    if (ringers.length > 0) out.push(`${ringers.length} guest${ringers.length === 1 ? '' : 's'} played — £${ringers.length * SUNDAY_RINGER_COST} owed and a few noses out of joint.`);
    return out.slice(0, 5);
  };

  // Discipline and treatment, counted HERE and carried on the report. The
  // weekly settlement used to read them back off `currentMatchResult`, which
  // is not persisted — so reloading between the whistle and Next Week wiped
  // the fine and the physio bill. See the note on the fields.
  const ourRedCards = result.events.filter(e => e.type === 'red_card' && e.clubId === clubId).length;
  const ourInjuries = result.events.filter(e => e.type === 'injury' && e.clubId === clubId).length;
  const nameOfPlayer = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const p = players[id];
    return p ? `${p.firstName} ${p.lastName}` : null;
  };

  const report: SundayMatchReport = {
    matchId: result.id,
    season, week,
    opponentClubId: oppClubId,
    opponentName: oppClub.name,
    home: isHome,
    tier,
    goalsFor: ourGoals,
    goalsAgainst: theirGoals,
    forfeited,
    noShows: noShows.map(m => m.playerId),
    startedWith: startingIds.length,
    ringersUsed: ringers.length,
    playedIds,
    motmPlayerId: motm?.playerId ?? null,
    // Snapshotted while the guest still exists — ringers are wiped below.
    motmName: nameOfPlayer(motm?.playerId),
    motmRating: motm?.rating ?? 0,
    lowlightPlayerId: lowlight?.playerId ?? null,
    lowlightName: nameOfPlayer(lowlight?.playerId),
    lowlightRating: lowlight?.rating ?? 0,
    redCards: ourRedCards,
    injuries: ourInjuries,
    turningPoint,
    consequences: buildConsequences(),
    adjustments: sim.adjustments.map(a => ({ label: a.label, delta: a.delta })),
    // Snapshotted while the guests still exist. Everything else about them is
    // wiped at the whistle, which is exactly why the ratings list lost them.
    guestRatings: ratings
      .filter(r => ringerIds.has(r.playerId))
      .map(r => ({
        name: players[r.playerId] ? `${players[r.playerId].firstName} ${players[r.playerId].lastName}` : 'A guest',
        rating: r.rating,
        goals: r.goals,
        assists: r.assists,
      }))
      .sort((a, b) => b.rating - a.rating),
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
      t.round === cupTie!.round && t.homeClubId === homeClubId && t.awayClubId === awayClubId
        ? {
            ...t, played: true,
            homeGoals: result.homeGoals, awayGoals: result.awayGoals,
            winnerClubId: cupWinnerId, shootout: shootoutScore,
          }
        : t,
    );
    cup = { ...cup, ties };
    // Simulate the rest of this cup round so the bracket can advance.
    cup = simulateRemainingCupTies(rng, cup, cupTie!.round, clubs, players, week, season);
    cup = advanceSundayCup(cup, sunday.divisionId, cupTie!.round);
    if (cupWinnerId !== clubId) cup = { ...cup, eliminated: true };
  } else {
    fixtures = state.fixtures.map(m => (m.id === setup.baseMatch.id ? result : m));
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

  // Club records are written HERE, where the context still exists: the
  // opponent, how many you had, who was a guest. "9-1" is a number; "9-1 with
  // eight men and two ringers" is a story someone retells.
  let records = sunday.records;
  if (!forfeited && won) {
    const context = startingIds.length < SUNDAY_FULL_XI
      ? `With ${startingIds.length} men${ringers.length ? ` and ${ringers.length} guest${ringers.length === 1 ? '' : 's'}` : ''}.`
      : isDerby ? 'In the derby, which made it twice as loud.' : undefined;
    records = recordSundayRecord(
      records, 'biggest-win', `${ourGoals}-${theirGoals} v ${oppClub.shortName}`,
      margin, season, week, 'higher', context,
    );
  }
  if (!forfeited && lost && margin >= 3) {
    records = recordSundayRecord(
      records, 'worst-defeat', `${theirGoals}-${ourGoals} v ${oppClub.shortName}`,
      margin, season, week, 'higher',
      startingIds.length < SUNDAY_FULL_XI ? `Started with ${startingIds.length}. It showed.` : undefined,
    );
  }
  if (!forfeited && won && startingIds.length < SUNDAY_FULL_XI) {
    records = recordSundayRecord(
      records, 'fewest-men', `Won with ${startingIds.length} v ${oppClub.shortName}`,
      // Lower is the record here.
      startingIds.length, season, week, 'lower',
      `${ourGoals}-${theirGoals}, and nobody will ever be allowed to forget it.`,
    );
  }

  const nextSunday: SundayState = {
    ...sunday,
    records,
    squad,
    cup,
    rivalry,
    flags,
    // The bet is real money and moves the balance like any other, with a line
    // parked for this week's settlement — the mode's one money convention.
    balance: betLine ? Math.round(sunday.balance + betLine.amount) : sunday.balance,
    pendingLedger: betLine ? [...sunday.pendingLedger, betLine] : sunday.pendingLedger,
    teamMorale: clampRound(sunday.teamMorale + moraleDelta, 0, 100),
    reputation: clampRound(sunday.reputation + repDelta, 0, 100),
    lastMatch: report,
    seasonStats,
    // The morning is spent. Leaving it would let a stale arrival satisfy next
    // week's ensureArrival if the week numbers ever collided across seasons.
    arrival: null,
    // The match is settled, so there is nothing paused any more. This is the
    // other half of the exactly-once guarantee: the pause is cleared in the
    // same write that marks the fixture played.
    halfTime: null,
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

// ── Entry points ────────────────────────────────────────────────────────────

/**
 * Whether the pause currently in state was created by THIS session.
 *
 * Module state on purpose: it is exactly the question "did the app restart
 * since half time?", and a reload is precisely what clears it. See
 * `SundayHalfTime` for why that question decides whether the manager gets his
 * decision back.
 */
let liveHalfTimeKey: string | null = null;
const halfTimeKey = (h: SundayHalfTime) => `${h.season}:${h.week}:${h.matchId}`;

export function isSundayHalfTimeLive(halfTime: SundayHalfTime | null | undefined): boolean {
  return !!halfTime && liveHalfTimeKey === halfTimeKey(halfTime);
}

/** Simulates the app being restarted, for tests that exercise the reload rule. */
export function __resetSundayHalfTimeSessionForTests(): void {
  liveHalfTimeKey = null;
}

/**
 * Play this week's fixture and write every consequence, in one call.
 *
 * Returns null when there is nothing to play — no fixture, already played, the
 * club has folded, or the season is over. A match left paused at half time is
 * finished here first, under the tactic it kicked off with: the weekly advance
 * is not a person, and it cannot make the manager's decision for him.
 */
export function runSundayMatch(set: Set, get: Get): SundayMatchReport | null {
  const state = get();
  const paused = state.sunday?.halfTime;
  if (paused) {
    // A pause belonging to THIS week is the match: finish it.
    if (paused.season === state.season && paused.week === state.week) return finishSundayMatch(set, get);
    // One belonging to another week is rubbish left behind (a rollover that
    // kept it, a save edited between seasons). `finishSundayMatch` drops it and
    // returns null — and returning that null here skipped THIS week's fixture
    // entirely: no result, no forfeit, no ledger line, no row in the table, and
    // the fixture stranded unplayed for good. Drop it and play the real one.
    set({ sunday: { ...state.sunday!, halfTime: null } });
  }
  const setup = prepareSundayMatch(set, get);
  if (!setup) return null;
  const sunday = get().sunday!;
  return settleSundayMatch(set, get, setup, setup.forfeited ? forfeitOutcome(setup) : simulateSundayFull(setup, sunday));
}

/**
 * Play the first half and stop, leaving the manager one decision.
 *
 * Used ONLY by the interactive Match Day screen. Everything that is not a
 * person — the weekly advance, the rest of the division, the cup ties nobody
 * watches — goes through `runSundayMatch` and plays ninety minutes atomically.
 *
 * A fixture that cannot be split (a forfeit, or a side the engine would refuse)
 * is played in full and returned as a finished report, so the caller always has
 * something to show.
 */
export function playSundayFirstHalf(
  set: Set, get: Get,
): { halfTime: SundayHalfTime | null; report: SundayMatchReport | null } {
  const existing = get().sunday?.halfTime;
  // Already paused: hand back the same pause. A second first half would be a
  // second match.
  if (existing) return { halfTime: existing, report: null };

  const setup = prepareSundayMatch(set, get);
  if (!setup) return { halfTime: null, report: null };
  const sunday = get().sunday!;
  if (setup.forfeited) {
    return { halfTime: null, report: settleSundayMatch(set, get, setup, forfeitOutcome(setup)) };
  }

  const opp = pickSundayOppositionXI(setup.rng, setup.oppClub, setup.players, setup.week, setup.oppTactic);
  const ourXI = setup.startingIds.map(id => setup.players[id]).filter((p): p is Player => !!p);
  // The engine forfeits a side below seven outright in `simulateMatch`; the
  // split path must not reach the engine with one, or the two paths would
  // disagree about the same fixture. Below the line, play it whole.
  if (ourXI.length < SUNDAY_MIN_START || opp.xi.length < SUNDAY_MIN_START) {
    return { halfTime: null, report: settleSundayMatch(set, get, setup, simulateSundayFull(setup, sunday, opp)) };
  }

  const sides = buildSundaySides(setup, sunday, setup.tacticId, opp);
  const engineState = simulateSundayFirstHalf({
    rng: setup.rng,
    match: setup.baseMatch,
    ...sides,
    weather: setup.weather,
    derbyIntensity: setup.derbyIntensity,
    season: setup.season,
    playerPhysioLevel: upgradeLevel(sunday, 'physio'),
    playerIsHome: setup.isHome,
  });

  const coachLevel = upgradeLevel(sunday, 'coach');
  const halfTime: SundayHalfTime = {
    season: setup.season,
    week: setup.week,
    matchId: setup.baseMatch.id,
    isCup: setup.isCup,
    cupRound: setup.cupRound,
    tier: setup.tier,
    goalsFor: setup.isHome ? engineState.homeGoals : engineState.awayGoals,
    goalsAgainst: setup.isHome ? engineState.awayGoals : engineState.homeGoals,
    tactic: setup.tacticId,
    // Measured on the men actually out there, guests included — they are not
    // in `players`, so nothing outside this call could work it out.
    tacticFit: Object.fromEntries(
      SUNDAY_TACTICS.map(t => [t.id, sundayTacticFit(t.id, ourXI, coachLevel)]),
    ),
    startingIds: [...setup.startingIds],
    benchIds: [...setup.benchIds],
    ringers: setup.ringers,
    oppXiIds: opp.xi.map(p => p.id),
    oppBenchIds: opp.bench.map(p => p.id),
    oppFormation: opp.formation,
    oppTactic: setup.oppTactic,
    weather: setup.weather,
    pitchQuality: setup.pitchQuality,
    derbyIntensity: setup.derbyIntensity,
    rngCursor: cursorOf(setup.rng),
    narrative: [...setup.arrivalBeats, ...narrateSunday(setup, sunday, engineState.events, 'first')],
    engineState,
  };

  set({ sunday: { ...get().sunday!, halfTime } });
  liveHalfTimeKey = halfTimeKey(halfTime);
  return { halfTime, report: null };
}

/**
 * Finish a match that is paused at half time, under `tactic` if the manager
 * chose one.
 *
 * THE RELOAD RULE. A pause that came off disk (the app was killed at the
 * break) is finished under the tactic the first half was played with, and the
 * requested change is ignored. The shared engine is unseeded, so allowing the
 * choice again after a reload would hand the player an unlimited re-roll of
 * the second half; losing the decision instead makes reloading strictly worse
 * than playing on, which is the only honest close available without seeding
 * the engine. See `SundayHalfTime`.
 *
 * SETTLED ONCE. `prepareSundayMatch` returns null when there is no unplayed
 * fixture this week, so a second call after the whistle clears the pause and
 * refuses rather than writing a second set of consequences.
 */
export function finishSundayMatch(set: Set, get: Get, tactic?: SundayTacticId): SundayMatchReport | null {
  const state = get();
  const sunday = state.sunday;
  const halfTime = sunday?.halfTime;
  if (!sunday || !halfTime) return null;
  const drop = () => set({ sunday: { ...get().sunday!, halfTime: null } });
  if (halfTime.season !== state.season || halfTime.week !== state.week) {
    drop();
    return null;
  }

  const setup = prepareSundayMatch(set, get, halfTime);
  if (!setup) { drop(); return null; }

  const live = isSundayHalfTimeLive(halfTime);
  const tacticId = live && tactic ? tactic : halfTime.tactic;
  const sundayNow = get().sunday!;
  const opp = {
    xi: halfTime.oppXiIds.map(id => setup.players[id]).filter((p): p is Player => !!p),
    bench: halfTime.oppBenchIds.map(id => setup.players[id]).filter((p): p is Player => !!p),
    formation: halfTime.oppFormation,
  };
  // OUR side is rebuilt under the new tactic — different attributes, same men,
  // same ids, so everything the first half recorded still belongs to them. The
  // BENCH keeps the copies it warmed up with: the engine carries its own bench
  // pool across the break, which is also what happens in every other mode.
  const sides = buildSundaySides({ ...setup, tacticId }, sundayNow, tacticId, opp);

  const outcome = finishSundaySecondHalf({
    rng: setup.rng,
    match: setup.baseMatch,
    ...sides,
    prevState: halfTime.engineState,
    weather: setup.weather,
    derbyIntensity: setup.derbyIntensity,
    season: setup.season,
    playerPhysioLevel: upgradeLevel(sundayNow, 'physio'),
    playerIsHome: setup.isHome,
    playersById: setup.players,
  });

  // The change he made at the break is his tactic from now on, exactly as if
  // he had made it on the Tactics screen.
  if (tacticId !== sundayNow.tactic) set({ sunday: { ...sundayNow, tactic: tacticId } });

  return settleSundayMatch(set, get, { ...setup, tacticId }, {
    result: outcome.result,
    ratings: outcome.playerRatings,
    injuries: outcome.matchInjuries,
    motm: pickMotm(outcome.playerRatings, setup.startingIds),
    // The build the match FINISHED under, which is the one that needs
    // explaining when the manager changed something at the break.
    adjustments: sides.ourTeam.adjustments,
    // The half already on screen, then the half that just happened. The
    // finished report therefore BEGINS with what the manager has been reading,
    // so the reveal continues instead of starting again.
    narrative: [...halfTime.narrative, ...narrateSunday(setup, sundayNow, outcome.result.events, 'second')],
  });
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
