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
  SUNDAY_PRIZE_SHARES, SUNDAY_PROMOTION_BONUS, SUNDAY_MENTOR_GROWTH_MULT,
  SUNDAY_FLOODLIGHT_COMMITMENT_GROWTH,
  getSundayDivision, sundayDivisionTier,
} from '@/config/sundayLeague';
import { createSundayRng, cursorOf, subSeed } from '@/utils/sunday/rng';
import { generateSundayDivision } from '@/utils/sunday/generation';
import { makeMemory, momentOfSeason, rememberMoment, definingMemory } from '@/utils/sunday/memories';
import {
  buildSundayFixtures, buildSundaySeasonRecord, buildSundayTable,
  developSundayPlayer, drawSundayCup, mintSundayLegend, recordSundayRecord,
  resolveSundayOutcome, sundayCupRoundName, sundayPosition, sundaySeasonWeeks,
} from '@/utils/sunday/season';
import { applySundayDeparture, sundayMentor } from '@/utils/sunday/relationships';
import { rollSundayAvailability } from '@/utils/sunday/availability';
import { deriveSundayDivisionStyles } from '@/utils/sunday/match';
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
  // Floodlights mean training after work through the winter, and a squad that
  // has trained together all year turns up more often. The upgrade card has
  // advertised this since the mode shipped; this is the line that makes it
  // true. Clamped at the 1-20 ceiling so it cannot run away over ten seasons.
  const floodlitGrowth = (sunday.upgrades.find(u => u.id === 'floodlights')?.level ?? 0) > 0
    ? SUNDAY_FLOODLIGHT_COMMITMENT_GROWTH
    : 0;
  let squad: SundaySquadMember[] = [];
  let legends = [...sunday.legends];
  let messages = state.messages;

  const retired: { id: string; name: string }[] = [];
  for (const { member, player } of squadPlayers) {
    // A young player with an old head in his position group comes on faster.
    // Derived from the squad as it stands at the last Sunday of the season and
    // stored nowhere: the pair is true while both are here and gone the moment
    // either is not. Nothing else in the mode rewards keeping a veteran past
    // the point where he can still play.
    const hasMentor = !!sundayMentor(member, sunday.squad, state.players, sunday.captainId);
    const dev = developSundayPlayer(
      rng, player, member, coachLevel, hasMentor ? SUNDAY_MENTOR_GROWTH_MULT : 1,
    );
    if (dev.retiring) {
      const fullName = `${player.firstName} ${player.lastName}`;
      // A legend is remembered for his best DAY, not his totals — the totals
      // are the second sentence. Same gate and same citation shape as every
      // other way out of the club now (`mintSundayLegend`); retirement is no
      // longer the only door that leads to the honours board.
      const before = legends.length;
      legends = mintSundayLegend({
        legends, member, name: fullName, kind: 'retired', season,
        momentText: definingMemory(member.memories)?.text ?? null,
      });
      if (legends.length > before) {
        messages = sundayMessage(
          messages, season + 1, 1, `${player.firstName} is hanging them up`,
          `After ${member.clubApps} games for the club, ${fullName} has called it a day. There will be a night out.`,
        );
      }
      retired.push({ id: member.playerId, name: fullName });
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
      commitment: clampRound(member.commitment + floodlitGrowth, 1, 20),
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

  // A retirement is a departure like any other: the man comes out of everybody
  // else's friends and rivals lists, and the mates he leaves behind keep his
  // name. The happiness hit lands AFTER the pre-season optimism applied above,
  // which is the right way round — a summer softens losing your lift to the
  // ground, it does not erase it. Running this unconditionally also makes the
  // rollover a full repair pass over the dressing room's ids.
  const retirementFallout = applySundayDeparture({ squad, players, departed: retired, season });
  squad = retirementFallout.squad;

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

  // The SAVE's root seed, not a per-season derivative: `generateSundayDivision`
  // splits identity (season-independent) from squad (season-keyed) itself, and
  // handing it a seed that already varied by season defeated the split — every
  // club in the league changed its name every summer while keeping its id, so
  // the rivalry story, the defector and the taunt all pointed at a club that no
  // longer existed under that name.
  const opponents = generateSundayDivision(
    sunday.seed,
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
  // A new division means new opponents and therefore new styles. Re-derived
  // from the squads that were just generated, so a promoted club walks into a
  // league that sets up differently — and one that stands still meets the same
  // sides playing the same way, because their squads are re-formed from the
  // same seed.
  const divisionStyles = deriveSundayDivisionStyles(divisionClubIds, clubs, players, clubId);
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
    // Prize money is a real movement and needs a line like everything else. It
    // is parked for the FIRST settlement of the new season, which is the next
    // ledger entry that will be written.
    pendingLedger: prize > 0
      ? [...sunday.pendingLedger, { kind: 'prize' as const, amount: prize, label: `${div.shortName} prize money` }]
      : sunday.pendingLedger,
    // Sponsor conditions are judged within ONE season — see the block comment
    // above `SUNDAY_SPONSOR_MIN_REPUTATION`. Reset the counters so a deal that
    // spans a rollover is measured the same way a single-season one is.
    sponsors: sunday.sponsors.map(s => ({ ...s, conditionProgress: 0 })),
    divisionId: nextDivisionId,
    divisionClubIds,
    divisionStyles,
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
    // Cooldowns are weeks-in-season, so they are meaningless across a rollover.
    // `onceFiredIds` deliberately survives: once per SAVE means once.
    eventCooldowns: {},
    // Story markers are week-stamped for the same reason. The morning is long
    // over, and the damper and the derby bet both belong to a season that has
    // finished.
    flags: {},
    // NO CHAIN SURVIVES THE SUMMER — see `SUNDAY_CHAIN_SEASON_MARGIN`. Every
    // deadline is clamped so the remaining beats are forced out before the last
    // Sunday; this line is the backstop for the case where the club folded, the
    // season ended early, or a beat's premise evaporated on the final week.
    chains: [],
    // A summer of growth repairs anything the winter churned up.
    pitchDamage: 0,
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
    // A new registration window. The signing cap is per SEASON, so it resets
    // here and nowhere else.
    signingsThisSeason: 0,
    weekLog: [
      ...(prize > 0 ? [`£${prize} in prize money has landed.`] : []),
      ...retirementFallout.lines,
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
