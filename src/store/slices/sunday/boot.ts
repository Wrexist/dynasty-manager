/**
 * Sunday League — booting a save and starting a season.
 *
 * `startSundayLeague` follows the same contract `startWorldCup` established:
 * wipe the slot, then build a complete, valid session in one `set`. Half-built
 * intermediate states are never written, so a crash mid-boot leaves the player
 * on the title screen rather than inside a broken game.
 */
import type {
  Club, Player, SundayClubPersonalityId, SundayClubIdentity, SundayDivisionId,
  SundayState, SundaySquadMember, Match,
} from '@/types/game';
import {
  SUNDAY_MORALE_START, SUNDAY_REPUTATION_START, SUNDAY_STATE_VERSION,
  getSundayDivision, getSundayPersonality, SUNDAY_DIVISIONS,
} from '@/config/sundayLeague';
import { buildSundayRivalry } from '@/utils/sunday/rivalry';
import { createSundayRng, cursorOf, newSundaySeed, subSeed } from '@/utils/sunday/rng';
import {
  buildSundayClub, generateSundayDivision, generateSundayIdentity,
  generateSundayStartingSquad,
} from '@/utils/sunday/generation';
import { buildSundayFixtures, buildSundayTable, drawSundayCup, sundaySeasonWeeks } from '@/utils/sunday/season';
import { deriveSundayDivisionStyles } from '@/utils/sunday/match';
import { rollSundayAvailability } from '@/utils/sunday/availability';
import type { Get, Set } from './shared';
import { clampRound } from './shared';

/** Stable id for the player's Sunday club. One per save; the mode is
 *  single-club by definition. */
export const SUNDAY_CLUB_ID = 'sunday-club';

export interface StartSundayOptions {
  personality: SundayClubPersonalityId;
  /** Overrides from the setup screen. Anything omitted is generated. */
  identity?: Partial<SundayClubIdentity>;
  /** Fixed seed, for tests and for "replay this save". */
  seed?: number;
}

export interface SundayWorld {
  sunday: SundayState;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  fixtures: Match[];
}

/**
 * Build a complete first season from a seed.
 *
 * Split out from the action so tests (and the stress harness) can construct a
 * world without touching the store, and so `rolloverSundaySeason` can reuse the
 * division/fixture/cup half of it verbatim.
 */
export function buildSundayWorld(opts: StartSundayOptions): SundayWorld {
  const seed = opts.seed ?? newSundaySeed();
  const rng = createSundayRng(seed, 0);
  const personality = opts.personality;
  const p = getSundayPersonality(personality);

  const identity: SundayClubIdentity = { ...generateSundayIdentity(rng, personality), ...opts.identity, personality };
  const divisionId: SundayDivisionId = SUNDAY_DIVISIONS[0].id;
  const div = getSundayDivision(divisionId);
  const reputation = clampRound(SUNDAY_REPUTATION_START + p.reputationMod, 0, 100);

  const club = buildSundayClub(SUNDAY_CLUB_ID, identity, divisionId, reputation);
  const generated = generateSundayStartingSquad(rng, SUNDAY_CLUB_ID, personality, 1);

  const players: Record<string, Player> = {};
  const squad: SundaySquadMember[] = [];
  for (const g of generated) {
    players[g.player.id] = g.player;
    squad.push(g.member);
    club.playerIds.push(g.player.id);
  }

  const opponents = generateSundayDivision(seed, divisionId, div.teamCount - 1, 1, [identity.name]);
  const clubs: Record<string, Club> = { [club.id]: club };
  for (const o of opponents) {
    clubs[o.club.id] = o.club;
    for (const pl of o.players) players[pl.id] = pl;
  }

  const divisionClubIds = [club.id, ...opponents.map(o => o.club.id)];
  // Every AI club gets the tactic its own squad suits, for the season. Derived
  // rather than drawn: the squads are already a property of the seed, so this
  // adds no draw and cannot move the cursor.
  const divisionStyles = deriveSundayDivisionStyles(divisionClubIds, clubs, players, club.id);
  const fixtures = buildSundayFixtures(rng, divisionId, divisionClubIds);
  const cup = drawSundayCup(rng, divisionId, divisionClubIds, club.id);

  // The rival is a fixed local club, picked once and kept for as long as both
  // are in the same division. A rivalry that re-rolls every season is not a
  // rivalry.
  const rivalClub = rng.pick(opponents)?.club ?? null;
  const rivalry = rivalClub ? buildSundayRivalry(rng, rivalClub.id) : null;

  // Captain: the most influential player who also turns up. Appointing the best
  // player would be wrong — the armband here goes to whoever runs the club.
  const captain = [...squad].sort((a, b) =>
    (b.influence * 2 + b.commitment) - (a.influence * 2 + a.commitment))[0] ?? null;

  const sunday: SundayState = {
    v: SUNDAY_STATE_VERSION,
    identity,
    divisionId,
    divisionClubIds,
    divisionStyles,
    seed,
    rngCursor: cursorOf(rng),
    balance: p.startBalance,
    reputation,
    teamMorale: clampRound(SUNDAY_MORALE_START + p.moraleMod, 0, 100),
    tactic: 'route-one',
    captainId: captain?.playerId ?? null,
    teamsheet: [],
    bench: [],
    teamsheetLocked: false,
    squad,
    upgrades: [],
    sponsors: [],
    sponsorOffers: [],
    recruits: [],
    pendingEvent: null,
    eventCooldowns: {},
    eventLog: [],
    onceFiredIds: [],
    rivalry,
    cup,
    arrival: null,
    flags: {},
    pitchDamage: 0,
    weeksInDebt: 0,
    lastFundraiserWeek: -99,
    ledger: [],
    pendingLedger: [],
    records: [],
    legends: [],
    history: [],
    lastMatch: null,
    weekLog: [
      `${identity.name} are registered for the ${div.name}.`,
      `${squad.length} names on the sheet and a fixture on Sunday.`,
    ],
    seasonStats: {
      played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
      cleanSheets: 0, forfeits: 0, noShows: 0, subsCollected: 0,
      biggestWin: 0, unbeatenRun: 0, bestUnbeatenRun: 0,
      winlessRun: 0, winRun: 0, bestWinRun: 0,
    },
    folded: false,
    foldReason: null,
    seasonComplete: false,
  };

  // Week 1 availability, so the manager opens on a real teamsheet decision
  // rather than an empty one.
  const firstFixture = fixtures.find(m => m.week === 1 && (m.homeClubId === club.id || m.awayClubId === club.id));
  const ctx = {
    away: firstFixture ? firstFixture.awayClubId === club.id : false,
    bigGame: false,
    hasMinibus: false,
    freeWeek: !firstFixture,
  };
  const availRng = createSundayRng(subSeed(seed, 'avail:1'), 0);
  sunday.squad = squad.map(m => ({
    ...m,
    availability: rollSundayAvailability(availRng, m, players[m.playerId], ctx, 1),
  }));

  return { sunday, clubs, players, fixtures };
}

/** Apply a built world to the store. Assumes state has already been wiped. */
export function applySundayWorld(set: Set, get: Get, world: SundayWorld): void {
  const { sunday, clubs, players, fixtures } = world;
  const table = buildSundayTable(fixtures, sunday.divisionClubIds);
  set({
    gameMode: 'sunday',
    gameStarted: true,
    season: 1,
    week: 1,
    totalWeeks: sundaySeasonWeeks(sunday.divisionId),
    seasonPhase: 'regular',
    playerClubId: SUNDAY_CLUB_ID,
    clubs,
    players,
    fixtures,
    leagueTable: table,
    // Mirror the division into the shared multi-division maps so anything that
    // reads them (save/load's table rebuild, the shared league-table screen)
    // sees a coherent world rather than an empty one.
    playerDivision: sunday.divisionId,
    divisionClubs: { [sunday.divisionId]: sunday.divisionClubIds },
    divisionFixtures: { [sunday.divisionId]: fixtures },
    divisionTables: { [sunday.divisionId]: table },
    sunday,
    currentScreen: 'sunday-hub',
    transferWindowOpen: false,
  });
  void get;
}
