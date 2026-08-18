/**
 * Sunday League — the season rollover.
 *
 * Everything that happens between the last Sunday of one season and the first
 * of the next: awards, ageing, retirements, promotion or relegation, a fresh
 * division, new fixtures, a new cup, and the club's permanent record of what
 * just happened.
 *
 * REBUILT, NOT MUTATED. The new season's opposition is generated from the seed
 * rather than carried over and adjusted. Sunday teams dissolve and re-form
 * constantly, so a fresh cast every year is both truthful and the thing that
 * stops season five feeling like season one with different numbers. The
 * player's own squad, records, legends and history are the continuity.
 */
import type {
  Club, Player, SundaySeasonRecord, SundaySquadMember, SundayState,
} from '@/types/game';
import {
  SUNDAY_REP_PROMOTION, SUNDAY_REP_RELEGATION, SUNDAY_REP_TITLE,
  SUNDAY_PRIZE_SHARES, SUNDAY_PROMOTION_BONUS,
  getSundayDivision, sundayDivisionTier,
} from '@/config/sundayLeague';
import { createSundayRng, cursorOf, subSeed } from '@/utils/sunday/rng';
import { generateSundayDivision } from '@/utils/sunday/generation';
import { makeMemory, momentOfSeason, rememberMoment, definingMemory } from '@/utils/sunday/memories';
import {
  addSundayLegend, buildSundayFixtures, buildSundaySeasonRecord, buildSundayTable,
  developSundayPlayer, drawSundayCup, qualifiesAsLegend, recordSundayRecord,
  resolveSundayOutcome, sundayCupRoundName, sundayPosition, sundaySeasonWeeks,
} from '@/utils/sunday/season';
import { rollSundayAvailability } from '@/utils/sunday/availability';
import { buildSundayRivalry } from '@/utils/sunday/rivalry';
import type { Get, Set } from './shared';
import { clampRound, sundayMessage } from './shared';

/**
 * Roll the season over.
 *
 * Refuses unless the season is actually complete, so a stray call from the UI
 * cannot skip half a campaign.
 */
export function rolloverSundaySeason(set: Set, get: Get): void {
  const state = get();
  const sunday = state.sunday;
  if (!sunday || !sunday.seasonComplete || sunday.folded) return;

  const season = state.season;
  const clubId = state.playerClubId;
  const rng = createSundayRng(sunday.seed, sunday.rngCursor);

  // ── Where the season finished ────────────────────────────────────────────
  const table = buildSundayTable(state.fixtures, sunday.divisionClubIds);
  const position = sundayPosition(table, clubId);
  const outcome = resolveSundayOutcome(sunday.divisionId, position, table.length);
  const div = getSundayDivision(sunday.divisionId);

  // ── Awards ───────────────────────────────────────────────────────────────
  const squadPlayers = sunday.squad
    .map(m => ({ member: m, player: state.players[m.playerId] }))
    .filter((x): x is { member: SundaySquadMember; player: Player } => !!x.player);

  const topScorer = [...squadPlayers].sort((a, b) => b.player.goals - a.player.goals)[0];
  const rated = squadPlayers
    .filter(x => (x.player.seasonRatedMatches ?? 0) >= 3)
    .map(x => ({ ...x, avg: (x.player.seasonRatingTotal ?? 0) / Math.max(1, x.player.seasonRatedMatches ?? 1) }))
    .sort((a, b) => b.avg - a.avg);
  const potm = rated[0];

  const cupResult = sunday.cup
    ? sunday.cup.winnerClubId === clubId
      ? 'Won the Sunday Cup'
      : (() => {
          const played = sunday.cup!.ties.filter(t => t.played && (t.homeClubId === clubId || t.awayClubId === clubId));
          const last = played[played.length - 1];
          return last ? `Out in the ${sundayCupRoundName(last.round)}` : 'Did not feature';
        })()
    : null;

  // ── Records ──────────────────────────────────────────────────────────────
  let records = [...sunday.records];
  const s = sunday.seasonStats;
  // biggest-win / worst-defeat / fewest-men are written at MATCH time, where
  // the opponent and the shirt count still exist to make them stories.
  if (s.bestUnbeatenRun > 0) {
    records = recordSundayRecord(records, 'longest-unbeaten', `${s.bestUnbeatenRun} matches`, s.bestUnbeatenRun, season, state.week);
  }
  if (topScorer && topScorer.player.goals > 0) {
    records = recordSundayRecord(records, 'top-scorer-season', `${topScorer.player.firstName} ${topScorer.player.lastName} — ${topScorer.player.goals}`, topScorer.player.goals, season, state.week);
  }
  const mostApps = [...sunday.squad].sort((a, b) => b.clubApps - a.clubApps)[0];
  if (mostApps) {
    const p = state.players[mostApps.playerId];
    if (p) records = recordSundayRecord(records, 'most-apps', `${p.firstName} ${p.lastName} — ${mostApps.clubApps}`, mostApps.clubApps, season, state.week);
  }
  records = recordSundayRecord(records, 'best-finish', `${position} in ${div.shortName}`,
    // A higher tier at the same position is a better finish, so rank on a
    // combined score rather than the raw position (which would call 1st in
    // Division Four better than 3rd in the County Premier).
    sundayDivisionTier(sunday.divisionId) * 100 - position, season, state.week);

  const highlights: string[] = [];
  if (outcome.champion) highlights.push(`Champions of ${div.name}.`);
  else if (outcome.promoted) highlights.push('Promoted.');
  if (outcome.relegated) highlights.push('Relegated.');
  if (sunday.cup?.winnerClubId === clubId) highlights.push('Won the Sunday Cup.');
  if (s.forfeits > 0) highlights.push(`${s.forfeits} fixture${s.forfeits === 1 ? '' : 's'} not fulfilled.`);
  if (topScorer && topScorer.player.goals > 0) highlights.push(`${topScorer.player.firstName} finished on ${topScorer.player.goals}.`);
  if (!highlights.length) highlights.push('A season of Sunday football happened, and here we are.');

  const seasonMoment = momentOfSeason(sunday.squad, season);

  const record: SundaySeasonRecord = buildSundaySeasonRecord({
    state: sunday, table, playerClubId: clubId, season, outcome,
    momentOfTheSeason: seasonMoment ? seasonMoment.text : null,
    topScorer: topScorer && topScorer.player.goals > 0
      ? { name: `${topScorer.player.firstName} ${topScorer.player.lastName}`, goals: topScorer.player.goals }
      : null,
    playerOfTheSeason: potm
      ? { name: `${potm.player.firstName} ${potm.player.lastName}`, rating: Math.round(potm.avg * 10) / 10 }
      : null,
    cupResult,
    highlights,
  });

  // ── Prize money ──────────────────────────────────────────────────────────
  // Paid here rather than in the weekly ledger: it is a season outcome, and
  // settling it at rollover means it can only ever be paid once.
  const prizeShare = SUNDAY_PRIZE_SHARES[position - 1] ?? 0;
  const prize = Math.round(div.titlePrize * prizeShare) + (outcome.promoted ? SUNDAY_PROMOTION_BONUS : 0);

  // ── Ageing, departures and legends ───────────────────────────────────────
  const players: Record<string, Player> = { ...state.players };
  const coachLevel = sunday.upgrades.find(u => u.id === 'coach')?.level ?? 0;
  let squad: SundaySquadMember[] = [];
  let legends = [...sunday.legends];
  let messages = state.messages;

  for (const { member, player } of squadPlayers) {
    const dev = developSundayPlayer(rng, player, member, coachLevel);
    if (dev.retiring) {
      if (qualifiesAsLegend(member)) {
        // A legend is remembered for his best DAY, not his totals — the totals
        // are the second sentence.
        const moment = definingMemory(member.memories);
        legends = addSundayLegend(
          legends, member, `${player.firstName} ${player.lastName}`,
          `${moment ? `${moment.text} ` : ''}${member.clubApps} appearances and ${member.clubGoals} goals over ${Math.max(1, season - member.joinedSeason + 1)} seasons.`,
          season,
        );
        messages = sundayMessage(
          messages, season + 1, 1, `${player.firstName} is hanging them up`,
          `After ${member.clubApps} games for the club, ${player.firstName} ${player.lastName} has called it a day. There will be a night out.`,
        );
      }
      delete players[member.playerId];
      continue;
    }
    // Going up or down together is part of everyone's story.
    let memories = member.memories;
    if (outcome.promoted) {
      memories = rememberMoment(memories, makeMemory(season, state.week, 'promotion',
        outcome.champion
          ? `Champions of the ${div.shortName}. His medal is on the pub wall.`
          : `Part of the squad that went up from the ${div.shortName}.`));
    } else if (outcome.relegated) {
      memories = rememberMoment(memories, makeMemory(season, state.week, 'relegation',
        `Went down with the club, and stayed anyway.`));
    }
    players[member.playerId] = { ...dev.player, form: 55 };
    squad.push({
      ...member,
      memories,
      // A new season, a clean slate: promises do not survive the summer.
      promise: null,
      availability: { status: 'available', reason: null, note: null, warned: true, weeksRemaining: 0 },
      benchedStreak: 0,
      startedStreak: 0,
      // Everyone starts the new season a bit more optimistic than they ended
      // the old one — pre-season is the one time of year Sunday football is
      // uncomplicated.
      happiness: clampRound(member.happiness * 0.7 + 62 * 0.3, 0, 100),
      unsettled: false,
    });
  }

  // ── The new world ────────────────────────────────────────────────────────
  const nextSeason = season + 1;
  const nextDivisionId = outcome.nextDivisionId;
  const nextDiv = getSundayDivision(nextDivisionId);

  const clubs: Record<string, Club> = {};
  const ourClub = state.clubs[clubId];
  if (!ourClub) return;
  clubs[clubId] = {
    ...ourClub,
    divisionId: nextDivisionId,
    playerIds: squad.map(m => m.playerId),
    lineup: [],
    subs: [],
    reputation: clampRound(sunday.reputation, 0, 100),
  };
  // Drop last season's opposition and their players entirely — nothing outside
  // the player's club is referenced across a season boundary, so keeping them
  // would only grow the save.
  for (const id of Object.keys(players)) {
    if (!squad.some(m => m.playerId === id)) delete players[id];
  }

  const opponents = generateSundayDivision(
    subSeed(sunday.seed, `season:${nextSeason}`),
    nextDivisionId,
    nextDiv.teamCount - 1,
    nextSeason,
    [sunday.identity.name],
  );
  for (const o of opponents) {
    clubs[o.club.id] = o.club;
    for (const pl of o.players) players[pl.id] = pl;
  }

  const divisionClubIds = [clubId, ...opponents.map(o => o.club.id)];
  const fixtures = buildSundayFixtures(rng, nextDivisionId, divisionClubIds);
  const cup = drawSundayCup(rng, nextDivisionId, divisionClubIds, clubId);

  // A promoted or relegated club leaves its rival behind; a club standing still
  // keeps its grudge. This is the one place a rivalry can legitimately reset.
  const keepRival = !outcome.promoted && !outcome.relegated && sunday.rivalry
    && divisionClubIds.includes(sunday.rivalry.clubId);
  const rivalry = keepRival
    ? sunday.rivalry
    : (() => {
        const c = rng.pick(opponents)?.club;
        return c ? buildSundayRivalry(rng, c.id) : null;
      })();

  const reputation = clampRound(
    sunday.reputation
    + (outcome.promoted ? SUNDAY_REP_PROMOTION : 0)
    + (outcome.relegated ? SUNDAY_REP_RELEGATION : 0)
    + (outcome.champion ? SUNDAY_REP_TITLE : 0),
    0, 100,
  );

  // ── Availability for week 1 ──────────────────────────────────────────────
  const firstFixture = fixtures.find(m => m.week === 1 && (m.homeClubId === clubId || m.awayClubId === clubId));
  const availRng = createSundayRng(subSeed(sunday.seed, `avail:${nextSeason}:1`), 0);
  squad = squad.map(m => ({
    ...m,
    availability: rollSundayAvailability(availRng, m, players[m.playerId], {
      away: firstFixture ? firstFixture.awayClubId === clubId : false,
      bigGame: false,
      hasMinibus: (sunday.upgrades.find(u => u.id === 'minibus')?.level ?? 0) > 0,
      freeWeek: !firstFixture,
    }, 1),
  }));

  const captainStillHere = sunday.captainId && squad.some(m => m.playerId === sunday.captainId);
  const captainId = captainStillHere
    ? sunday.captainId
    : ([...squad].sort((a, b) => (b.influence * 2 + b.commitment) - (a.influence * 2 + a.commitment))[0]?.playerId ?? null);

  messages = sundayMessage(
    messages, nextSeason, 1,
    outcome.promoted ? 'Promoted!' : outcome.relegated ? 'Relegated' : `Season ${nextSeason} is here`,
    outcome.promoted
      ? `${sunday.identity.name} go up. ${nextDiv.name} next season, and it is a step up in every sense.`
      : outcome.relegated
        ? `Down to the ${nextDiv.name}. Regroup, and go again.`
        : `Another year in the ${nextDiv.name}. ${squad.length} names on the sheet.`,
    'board',
  );

  const nextSunday: SundayState = {
    ...sunday,
    balance: Math.round(sunday.balance + prize),
    divisionId: nextDivisionId,
    divisionClubIds,
    rngCursor: cursorOf(rng),
    reputation,
    squad,
    captainId,
    teamsheet: [],
    bench: [],
    teamsheetLocked: false,
    // Sponsor deals that survive the summer keep paying; the rest lapsed above.
    sponsorOffers: [],
    recruits: [],
    pendingEvent: null,
    eventQueue: [],
    // Cooldowns are weeks-in-season, so they are meaningless across a rollover.
    eventCooldowns: {},
    // Chain flags are week-stamped for the same reason; an unresolved chain
    // does not survive the summer. The morning is long over.
    flags: {},
    arrival: null,
    rivalry,
    cup,
    lastMatch: null,
    records,
    legends,
    history: [...sunday.history, record],
    seasonComplete: false,
    weeksInDebt: 0,
    lastFundraiserWeek: -99,
    weekLog: [
      ...(prize > 0 ? [`£${prize} in prize money has landed.`] : []),
      outcome.promoted ? 'Promoted. Nobody can quite believe it.'
        : outcome.relegated ? 'Relegated. Pre-season starts here.'
          : 'A new season. Same pitch, same people, same referee.',
      `${squad.length} names on the sheet for the ${nextDiv.name}.`,
    ],
    seasonStats: {
      played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
      cleanSheets: 0, forfeits: 0, noShows: 0, subsCollected: 0,
      biggestWin: 0, unbeatenRun: 0, bestUnbeatenRun: 0,
      winlessRun: 0, winRun: 0, bestWinRun: 0,
    },
  };

  const newTable = buildSundayTable(fixtures, divisionClubIds);
  set({
    season: nextSeason,
    week: 1,
    totalWeeks: sundaySeasonWeeks(nextDivisionId),
    clubs,
    players,
    fixtures,
    messages,
    leagueTable: newTable,
    playerDivision: nextDivisionId,
    divisionClubs: { [nextDivisionId]: divisionClubIds },
    divisionFixtures: { [nextDivisionId]: fixtures },
    divisionTables: { [nextDivisionId]: newTable },
    sunday: nextSunday,
    currentMatchResult: null,
    matchPlayerRatings: [],
    currentScreen: 'sunday-hub',
  });

  if (state.settings.autoSave) get().saveGame();
}
