/**
 * The living world (Phase 6).
 *
 * `initGame` used to instantiate `Club` + squad objects only for the player's
 * own country: 92 of 756 clubs in an English save, 18 in a Dutch one. Every
 * continental opponent was an ephemeral throwaway generated from reputation and
 * discarded, there were no cross-border transfer targets, and the Ballon d'Or
 * had to fabricate synthetic seasons for "ghost" players at real foreign clubs
 * so the ceremony wasn't a single-country shortlist.
 *
 * These tests pin the invariants that make the world real:
 *   - the strongest foreign top tiers are instantiated, with squads, fixtures
 *     and tables, for both a multi-tier and a single-tier home country;
 *   - the qualification spot tables sum to a full 32-team draw, so the draw
 *     never fabricates `placeholder-*` clubs;
 *   - placeholder residue from older saves can neither earn coefficients nor
 *     be promoted into a cup-winner qualification slot;
 *   - continental ties between two instantiated clubs go through the REAL
 *     match engine, and only genuinely virtual filler falls back to reputation;
 *   - the Ballon d'Or ranks real players and no longer emits `__bdo-ghost-` ids.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  CONTINENTAL_TOTAL_TEAMS,
  CHAMPIONS_CUP_SPOTS_BY_RANK,
  SHIELD_CUP_SPOTS_BY_RANK,
  CONFERENCE_CUP_SPOTS_BY_RANK,
  LIVING_WORLD_LEAGUE_COUNT,
  LIVING_WORLD_SQUAD_SIZE,
  isPlaceholderClubId,
  PLACEHOLDER_CLUB_PREFIX,
} from '@/config/continental';
import {
  getLivingWorldLeagueIds,
  generateContinentalDraw,
  getConferenceCupQualifiers,
} from '@/data/continentalDraw';
import { updateCoefficients } from '@/utils/continentalCoefficients';
import { simulateGroupMatchday, type ContinentalWorld } from '@/utils/continental';
import { calculateBallonDOr } from '@/utils/ballonDor';
import { LEAGUES } from '@/data/league';
import type {
  ContinentalTournamentState, VirtualClub, Club, Player, LeagueTableEntry,
} from '@/types/game';

// ── League selection ───────────────────────────────────────────────────

describe('getLivingWorldLeagueIds', () => {
  it('picks the strongest foreign top tiers and never the home country', () => {
    const ids = getLivingWorldLeagueIds('eng', 4);
    expect(ids).toHaveLength(4);
    // The other four of the top five, in ranking order.
    expect(ids).toEqual(['esp', 'ita', 'ger', 'fra']);
    for (const id of ids) {
      expect(LEAGUES.find(l => l.id === id)?.countryId).not.toBe('eng');
    }
  });

  it('only ever selects top-tier leagues (continental competitions are tier-1 only)', () => {
    for (const id of getLivingWorldLeagueIds('ned', 6)) {
      expect(LEAGUES.find(l => l.id === id)?.tier).toBe(1);
    }
  });

  it('returns nothing when the count is zero', () => {
    expect(getLivingWorldLeagueIds('eng', 0)).toEqual([]);
  });
});

// ── initGame instantiates the world ────────────────────────────────────

describe('initGame — foreign leagues are real entities', () => {
  it('instantiates the foreign top tiers with squads, fixtures and tables (multi-tier home country)', async () => {
    useGameStore.getState().resetGame();
    await useGameStore.getState().initGame('manchester-city');
    const s = useGameStore.getState();

    const foreignIds = getLivingWorldLeagueIds('eng', LIVING_WORLD_LEAGUE_COUNT);
    expect(foreignIds.length).toBe(LIVING_WORLD_LEAGUE_COUNT);

    for (const leagueId of foreignIds) {
      const clubIds = s.divisionClubs[leagueId];
      expect(clubIds, `${leagueId} registered in divisionClubs`).toBeTruthy();
      expect(clubIds.length).toBeGreaterThan(8);
      // Fixtures + tables exist, so the league plays its own domestic season
      // (which is what gives foreign players appearances for the Ballon d'Or).
      expect(s.divisionFixtures[leagueId]?.length || 0).toBeGreaterThan(0);
      expect(s.divisionTables[leagueId]?.length || 0).toBe(clubIds.length);

      for (const clubId of clubIds) {
        const club = s.clubs[clubId];
        expect(club, `${clubId} is a real Club entity`).toBeTruthy();
        expect(club.divisionId).toBe(leagueId);
        // A real squad, not a name and a reputation integer.
        expect(club.playerIds.length).toBeGreaterThanOrEqual(11);
        expect(club.playerIds.length).toBeLessThanOrEqual(LIVING_WORLD_SQUAD_SIZE);
        expect(club.lineup.length).toBe(11);
        // Squad members are present in the players map and attributed correctly.
        for (const pid of club.playerIds) {
          expect(s.players[pid]?.clubId).toBe(clubId);
        }
        // AI-managed: every foreign club needs a manager profile so the AI
        // transfer market and tactical drift treat it like any other club.
        expect(club.aiManagerProfile).toBeTruthy();
        expect(club.wageBill).toBeGreaterThan(0);
      }
    }
  });

  it('instantiates a foreign world for a single-tier home country too', async () => {
    useGameStore.getState().resetGame();
    await useGameStore.getState().initGame('ajax');
    const s = useGameStore.getState();

    // Netherlands is single-tier: without the living world this save had 18
    // clubs — 2.4% of the shipped club list.
    expect(Object.keys(s.clubs).length).toBeGreaterThan(60);
    expect(Object.keys(s.divisionClubs).length).toBe(1 + LIVING_WORLD_LEAGUE_COUNT);
    expect(s.divisionClubs['eng']?.length).toBeGreaterThan(8);
    // The player's own country is still the only one loaded in depth.
    expect(s.divisionClubs['eng-2']).toBeUndefined();
  });

  it('keeps every foreign club out of the player-club and cup machinery', async () => {
    useGameStore.getState().resetGame();
    await useGameStore.getState().initGame('ajax');
    const s = useGameStore.getState();
    // Domestic cup + league cup are drawn from the player's division only.
    const cupClubIds = new Set(s.cup.ties.flatMap(t => [t.homeClubId, t.awayClubId]));
    for (const id of cupClubIds) {
      // Undrawn slots and the bye marker are not clubs.
      if (!id || !s.clubs[id]) continue;
      expect(s.clubs[id].divisionId).toBe('ned');
    }
  });

  it('seeds the reigning Ballon d\'Or top 10 from real players only (no ghosts)', async () => {
    useGameStore.getState().resetGame();
    await useGameStore.getState().initGame('ajax');
    const s = useGameStore.getState();
    const holders = Object.values(s.players).filter(p => typeof p.ballonDOrTop10HoldSeason === 'number');
    expect(holders.length).toBeGreaterThan(0);
    for (const h of holders) {
      // A ghost holder had a clubId pointing at a club that didn't exist.
      expect(s.clubs[h.clubId], `${h.firstName} ${h.lastName} belongs to a loaded club`).toBeTruthy();
      expect(h.id.startsWith('__bdo-ghost-')).toBe(false);
    }
  });
});

// ── Qualification tables + draw ────────────────────────────────────────

describe('continental qualification spots', () => {
  const sumSpots = (table: Record<number, number>) =>
    Object.values(table).reduce((a, b) => a + b, 0);

  it('every competition allocates a full 32-team field from league spots alone', () => {
    // The cup-winner spot is a bonus that only materialises when that club
    // hasn't already qualified via its league — a table that depends on it is
    // short in the common case, which is what forced placeholder fabrication.
    expect(sumSpots(CHAMPIONS_CUP_SPOTS_BY_RANK)).toBe(CONTINENTAL_TOTAL_TEAMS);
    expect(sumSpots(SHIELD_CUP_SPOTS_BY_RANK)).toBe(CONTINENTAL_TOTAL_TEAMS);
    expect(sumSpots(CONFERENCE_CUP_SPOTS_BY_RANK)).toBe(CONTINENTAL_TOTAL_TEAMS);
  });

  it('fills a short qualifier list with real clubs instead of placeholders', () => {
    const virtualClubs: Record<string, VirtualClub> = {};
    const qualifiers = ['arsenal', 'chelsea', 'liverpool'];
    for (const id of qualifiers) {
      virtualClubs[id] = {
        id, name: id, shortName: id.slice(0, 3).toUpperCase(),
        color: '#fff', secondaryColor: '#000', leagueId: 'eng',
        reputation: 5, country: 'England', countryCode: 'ENG',
      };
    }

    const draw = generateContinentalDraw('champions_cup', 2, qualifiers, virtualClubs, 'arsenal');

    const drawnIds = draw.groups.flatMap(g => g.clubIds);
    expect(drawnIds).toHaveLength(CONTINENTAL_TOTAL_TEAMS);
    expect(new Set(drawnIds).size).toBe(CONTINENTAL_TOTAL_TEAMS);
    for (const id of drawnIds) {
      expect(isPlaceholderClubId(id), `${id} is not fabricated`).toBe(false);
      // Every drawn club has renderable data behind it.
      expect(virtualClubs[id], `${id} has a VirtualClub entry`).toBeTruthy();
    }
    // The backfill spreads across countries rather than emptying one league.
    const countries = new Set(drawnIds.map(id => virtualClubs[id].country));
    expect(countries.size).toBeGreaterThan(3);
  });

  it('never promotes a legacy placeholder into a cup-winner qualification slot', () => {
    const placeholderWinner = `${PLACEHOLDER_CLUB_PREFIX}31`;
    const table: LeagueTableEntry[] = [];
    const { qualifiers } = getConferenceCupQualifiers(
      'eng', table, {}, new Set(), new Set(), undefined, placeholderWinner,
    );
    expect(qualifiers).not.toContain(placeholderWinner);
    expect(qualifiers.every(id => !isPlaceholderClubId(id))).toBe(true);
  });
});

describe('updateCoefficients', () => {
  it('ignores placeholder clubs and evicts legacy placeholder entries', () => {
    const placeholder = `${PLACEHOLDER_CLUB_PREFIX}30`;
    const tournament = {
      competition: 'conference_cup',
      groups: [{
        clubIds: ['arsenal', placeholder],
        matches: [{ homeClubId: placeholder, awayClubId: 'arsenal', homeGoals: 3, awayGoals: 0, played: true }],
      }],
      knockoutTies: [{ round: 'F', winnerId: placeholder, homeClubId: placeholder, awayClubId: 'arsenal' }],
    } as unknown as ContinentalTournamentState;

    const updated = updateCoefficients(
      { [placeholder]: { clubId: placeholder, points: 12, seasonPoints: { 3: 12 } } },
      tournament,
      4,
    );
    expect(updated[placeholder]).toBeUndefined();
    expect(updated['arsenal']).toBeTruthy();
  });
});

// ── Real-engine continental football ──────────────────────────────────

function makeSquad(clubId: string, count = 14): Player[] {
  const positions = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'GK', 'CB', 'CM'] as const;
  return Array.from({ length: count }, (_, i) => ({
    id: `${clubId}-p${i}`,
    firstName: 'Test',
    lastName: `${clubId}${i}`,
    age: 26,
    position: positions[i % positions.length],
    nationality: 'England',
    overall: 78,
    potential: 80,
    attributes: { pace: 75, shooting: 75, passing: 75, dribbling: 75, defending: 75, physical: 75 },
    value: 10_000_000,
    wage: 50_000,
    contractYears: 3,
    clubId,
    form: 70,
    fitness: 100,
    morale: 70,
    injured: false,
    goals: 0,
    assists: 0,
    appearances: 0,
    yellowCards: 0,
    redCards: 0,
    cleanSheets: 0,
  } as unknown as Player));
}

function makeClub(id: string, players: Player[]): Club {
  return {
    id, name: id, shortName: id.slice(0, 3).toUpperCase(),
    color: '#fff', secondaryColor: '#000',
    budget: 0, wageBill: 0, reputation: 4, facilities: 5, youthRating: 5,
    fanBase: 60, boardPatience: 50,
    playerIds: players.map(p => p.id),
    formation: '4-3-3',
    lineup: players.slice(0, 11).map(p => p.id),
    subs: players.slice(11).map(p => p.id),
    divisionId: 'esp',
  } as unknown as Club;
}

function twoClubGroupTournament(): ContinentalTournamentState {
  return {
    competition: 'champions_cup',
    season: 1,
    groups: [{
      id: 'A',
      clubIds: ['real', 'barca'],
      matches: [{
        id: 'm1', matchday: 1, week: 6,
        homeClubId: 'real', awayClubId: 'barca',
        played: false, homeGoals: 0, awayGoals: 0,
      }],
      standings: [],
    }],
    knockoutTies: [],
    currentPhase: 'group',
    currentRound: 'group',
    playerEliminated: false,
    playerGroupId: 'A',
    winnerId: null,
  } as unknown as ContinentalTournamentState;
}

describe('simulateGroupMatchday — real engine vs reputation fallback', () => {
  it('routes an instantiated-vs-instantiated tie through the real match engine', () => {
    const realSquad = makeSquad('real');
    const barcaSquad = makeSquad('barca');
    const players: Record<string, Player> = {};
    for (const p of [...realSquad, ...barcaSquad]) players[p.id] = p;

    const engineMatches: unknown[] = [];
    const world: ContinentalWorld = {
      clubs: { real: makeClub('real', realSquad), barca: makeClub('barca', barcaSquad) },
      players,
      week: 6,
      season: 1,
      onEngineMatch: info => engineMatches.push(info),
    };

    const result = simulateGroupMatchday(twoClubGroupTournament(), 1, {}, '', world);
    const match = result.groups[0].matches[0];
    expect(match.played).toBe(true);
    // The engine ran: exactly one fixture, with minute-by-minute events, and
    // the XIs are handed back so the caller can credit player stats.
    expect(engineMatches).toHaveLength(1);
    const info = engineMatches[0] as { result: { events: unknown[] }; homeXI: Player[]; awayXI: Player[] };
    expect(info.result.events.length).toBeGreaterThan(0);
    expect(info.homeXI.length).toBe(11);
    expect(info.awayXI.length).toBe(11);
  });

  it('falls back to the reputation model for genuinely virtual filler', () => {
    const virtualClubs: Record<string, VirtualClub> = {
      real: { id: 'real', name: 'R', shortName: 'R', color: '#fff', secondaryColor: '#000', leagueId: 'esp', reputation: 5, country: 'Spain', countryCode: 'ESP' },
      barca: { id: 'barca', name: 'B', shortName: 'B', color: '#fff', secondaryColor: '#000', leagueId: 'esp', reputation: 5, country: 'Spain', countryCode: 'ESP' },
    };
    // No world at all → reputation path, and the fixture still resolves.
    const noWorld = simulateGroupMatchday(twoClubGroupTournament(), 1, virtualClubs, '');
    expect(noWorld.groups[0].matches[0].played).toBe(true);

    // A world that only knows ONE of the two clubs must not half-run the
    // engine — it falls back rather than fielding a phantom XI.
    const realSquad = makeSquad('real');
    const players: Record<string, Player> = {};
    for (const p of realSquad) players[p.id] = p;
    const calls: unknown[] = [];
    const partial = simulateGroupMatchday(twoClubGroupTournament(), 1, virtualClubs, '', {
      clubs: { real: makeClub('real', realSquad) },
      players,
      week: 6,
      onEngineMatch: info => calls.push(info),
    });
    expect(partial.groups[0].matches[0].played).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('still leaves the player\'s own match for interactive play', () => {
    const result = simulateGroupMatchday(twoClubGroupTournament(), 1, {}, 'real');
    expect(result.groups[0].matches[0].played).toBe(false);
  });
});

// ── Ballon d'Or without the ghost hack ────────────────────────────────

describe('calculateBallonDOr — no fabricated candidates', () => {
  const table: LeagueTableEntry[] = [
    { clubId: 'arsenal', played: 38, won: 28, drawn: 5, lost: 5, goalsFor: 90, goalsAgainst: 30, points: 89, cleanSheets: 15 } as LeagueTableEntry,
  ];
  const clubs: Record<string, Club> = {
    arsenal: { id: 'arsenal', name: 'Arsenal', shortName: 'ARS', color: '#EF0107', divisionId: 'eng' } as unknown as Club,
  };

  it('never emits a __bdo-ghost- entry, even in the production ceremony', () => {
    const players = makeSquad('arsenal', 6).map(p => ({
      ...p, clubId: 'arsenal', appearances: 34, goals: 18, assists: 7,
    }));
    const ranking = calculateBallonDOr(
      players, clubs, table, {},
      null, null, null, null, null, null,
      /* isProductionCeremony */ true,
    );
    expect(ranking.length).toBeGreaterThan(0);
    for (const e of ranking) {
      expect(e.playerId.startsWith('__bdo-ghost-')).toBe(false);
      // Every entry maps back to a real player in the supplied pool.
      expect(players.some(p => p.id === e.playerId)).toBe(true);
    }
  });

  it('degrades gracefully instead of returning an empty ceremony', () => {
    // Nobody cleared the appearance threshold (season abandoned early, or a
    // save whose foreign leagues were never instantiated by an old migration).
    const players = makeSquad('arsenal', 6).map(p => ({ ...p, clubId: 'arsenal', appearances: 1 }));
    const strict = calculateBallonDOr(players, clubs, table, {});
    expect(strict).toHaveLength(0);

    const ceremony = calculateBallonDOr(
      players, clubs, table, {},
      null, null, null, null, null, null,
      /* isProductionCeremony */ true,
    );
    expect(ceremony.length).toBe(players.length);
    ceremony.forEach((e, i) => expect(e.rank).toBe(i + 1));
  });
});
