import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { processAIWeekly } from '@/utils/aiSimulation';
import type { Club, Player, Message, TransferListing, LoanDeal, TransferNewsEntry, DivisionId, LeagueTableEntry, Position } from '@/types/game';

// ── Helper Factories ──

let playerCounter = 0;

function makePlayer(overrides: Partial<Player> = {}): Player {
  const id = overrides.id ?? `player-${++playerCounter}`;
  return {
    id,
    firstName: 'Test',
    lastName: `Player${id}`,
    age: 25,
    nationality: 'England',
    position: 'CM' as Position,
    attributes: { pace: 70, shooting: 65, passing: 72, defending: 60, physical: 68, mental: 70 },
    overall: 70,
    potential: 78,
    clubId: 'ai-club-1',
    wage: 30_000,
    value: 5_000_000,
    contractEnd: 3,
    fitness: 90,
    morale: 75,
    form: 70,
    injured: false,
    injuryWeeks: 0,
    goals: 2,
    assists: 3,
    appearances: 15,
    yellowCards: 1,
    redCards: 0,
    ...overrides,
  } as Player;
}

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'ai-club-1',
    name: 'AI United',
    shortName: 'AIU',
    color: '#FF0000',
    secondaryColor: '#FFFFFF',
    budget: 20_000_000,
    reputation: 3,
    fanBase: 40,
    wageBill: 400_000,
    formation: '4-3-3',
    facilities: 5,
    youthRating: 5,
    boardPatience: 5,
    playerIds: [],
    lineup: [],
    subs: [],
    divisionId: 'div-2',
    ...overrides,
  } as Club;
}

function makeTableEntry(overrides: Partial<LeagueTableEntry> = {}): LeagueTableEntry {
  return {
    clubId: 'ai-club-1',
    played: 20,
    won: 10,
    drawn: 5,
    lost: 5,
    goalsFor: 30,
    goalsAgainst: 20,
    goalDifference: 10,
    points: 35,
    form: ['W', 'D', 'W', 'L', 'W'],
    cleanSheets: 5,
    ...overrides,
  };
}

// ── Squad builder: generates 22 players for a club across positions ──

// 25 players: must exceed MIN_SQUAD_SIZE (22) so sell/loan candidates can be identified
const POSITION_TEMPLATE: Position[] = [
  'GK', 'GK',
  'CB', 'CB', 'CB', 'CB',
  'LB', 'LB',
  'RB', 'RB',
  'CDM', 'CDM',
  'CM', 'CM', 'CM',
  'CAM',
  'LM',
  'LW', 'LW',
  'RW', 'RW',
  'ST', 'ST', 'ST', 'ST',
];

function buildSquad(
  clubId: string,
  overallRange: [number, number] = [65, 75],
  ageRange: [number, number] = [22, 29],
): { players: Record<string, Player>; playerIds: string[] } {
  const players: Record<string, Player> = {};
  const playerIds: string[] = [];
  for (let i = 0; i < POSITION_TEMPLATE.length; i++) {
    const id = `${clubId}-p${i}`;
    const overall = overallRange[0] + Math.floor(Math.random() * (overallRange[1] - overallRange[0] + 1));
    const age = ageRange[0] + Math.floor(Math.random() * (ageRange[1] - ageRange[0] + 1));
    players[id] = makePlayer({
      id,
      clubId,
      position: POSITION_TEMPLATE[i],
      overall,
      potential: overall + 5,
      age,
      wage: 20_000 + overall * 500,
      value: overall * 100_000,
      contractEnd: 3,
    });
    playerIds.push(id);
  }
  return { players, playerIds };
}

// ── Test Setup ──

interface TestWorld {
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  messages: Message[];
  transferMarket: TransferListing[];
  freeAgents: string[];
  activeLoans: LoanDeal[];
  transferNews: TransferNewsEntry[];
  divisionTables: Record<DivisionId, LeagueTableEntry[]>;
  playerClubId: string;
}

function createTestWorld(): TestWorld {
  const playerClubId = 'player-club';

  // Build squads for 4 clubs: 1 player club + 3 AI clubs
  const playerSquad = buildSquad(playerClubId);
  const ai1Squad = buildSquad('ai-club-1');
  const ai2Squad = buildSquad('ai-club-2');
  const ai3Squad = buildSquad('ai-club-3');

  const allPlayers: Record<string, Player> = {
    ...playerSquad.players,
    ...ai1Squad.players,
    ...ai2Squad.players,
    ...ai3Squad.players,
  };

  const clubs: Record<string, Club> = {
    [playerClubId]: makeClub({
      id: playerClubId,
      name: 'Player FC',
      shortName: 'PFC',
      budget: 30_000_000,
      reputation: 4,
      fanBase: 60,
      playerIds: playerSquad.playerIds,
      lineup: playerSquad.playerIds.slice(0, 11),
      subs: playerSquad.playerIds.slice(11, 18),
      divisionId: 'div-1',
    }),
    'ai-club-1': makeClub({
      id: 'ai-club-1',
      name: 'AI United',
      shortName: 'AIU',
      budget: 20_000_000,
      reputation: 3,
      fanBase: 40,
      playerIds: ai1Squad.playerIds,
      lineup: ai1Squad.playerIds.slice(0, 11),
      subs: ai1Squad.playerIds.slice(11, 18),
      divisionId: 'div-1',
    }),
    'ai-club-2': makeClub({
      id: 'ai-club-2',
      name: 'AI City',
      shortName: 'AIC',
      budget: 15_000_000,
      reputation: 2,
      fanBase: 30,
      playerIds: ai2Squad.playerIds,
      lineup: ai2Squad.playerIds.slice(0, 11),
      subs: ai2Squad.playerIds.slice(11, 18),
      divisionId: 'div-1',
    }),
    'ai-club-3': makeClub({
      id: 'ai-club-3',
      name: 'AI Rovers',
      shortName: 'AIR',
      budget: 10_000_000,
      reputation: 2,
      fanBase: 25,
      playerIds: ai3Squad.playerIds,
      lineup: ai3Squad.playerIds.slice(0, 11),
      subs: ai3Squad.playerIds.slice(11, 18),
      divisionId: 'div-2',
    }),
  };

  const tableEntries: LeagueTableEntry[] = [
    makeTableEntry({ clubId: playerClubId, points: 45 }),
    makeTableEntry({ clubId: 'ai-club-1', points: 40 }),
    makeTableEntry({ clubId: 'ai-club-2', points: 35 }),
  ];
  const tableEntries2: LeagueTableEntry[] = [
    makeTableEntry({ clubId: 'ai-club-3', points: 30 }),
  ];

  return {
    clubs,
    players: allPlayers,
    messages: [],
    transferMarket: [],
    freeAgents: [],
    activeLoans: [],
    transferNews: [],
    divisionTables: { 'div-1': tableEntries, 'div-2': tableEntries2 } as Record<DivisionId, LeagueTableEntry[]>,
    playerClubId,
  };
}

// ── Tests ──

describe('AI Simulation — processAIWeekly', () => {
  beforeEach(() => {
    playerCounter = 0;
  });

  // ── 1. AI Income Processing ──

  describe('AI Income Processing', () => {
    it('AI clubs receive weekly income (budgets change)', () => {
      const world = createTestWorld();
      const originalBudgets: Record<string, number> = {};
      for (const [id, club] of Object.entries(world.clubs)) {
        originalBudgets[id] = club.budget;
      }

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );

      // At least one AI club budget should have changed (income - expenses)
      const aiClubIds = Object.keys(world.clubs).filter(id => id !== world.playerClubId);
      const budgetsChanged = aiClubIds.some(id => result.clubs[id].budget !== originalBudgets[id]);
      expect(budgetsChanged).toBe(true);
    });

    it('player club budget should NOT change from AI income processing', () => {
      const world = createTestWorld();
      const originalPlayerBudget = world.clubs[world.playerClubId].budget;

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );

      expect(result.clubs[world.playerClubId].budget).toBe(originalPlayerBudget);
    });

    it('income scales with fanBase and reputation', () => {
      const world = createTestWorld();

      // Give ai-club-1 much higher fanBase/reputation than ai-club-2
      world.clubs['ai-club-1'] = { ...world.clubs['ai-club-1'], fanBase: 100, reputation: 5, wageBill: 0 };
      world.clubs['ai-club-2'] = { ...world.clubs['ai-club-2'], fanBase: 10, reputation: 1, wageBill: 0 };

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );

      // Higher fanBase/rep club should have gained more budget
      const gain1 = result.clubs['ai-club-1'].budget - world.clubs['ai-club-1'].budget;
      const gain2 = result.clubs['ai-club-2'].budget - world.clubs['ai-club-2'].budget;
      expect(gain1).toBeGreaterThan(gain2);
    });

    it('income accounts for league position via division table', () => {
      const world = createTestWorld();

      // Give both AI clubs identical stats but different table positions
      world.clubs['ai-club-1'] = { ...world.clubs['ai-club-1'], fanBase: 40, reputation: 3, wageBill: 0, facilities: 5 };
      world.clubs['ai-club-2'] = { ...world.clubs['ai-club-2'], fanBase: 40, reputation: 3, wageBill: 0, facilities: 5 };

      // ai-club-1 is 2nd (index 1), ai-club-2 is 3rd (index 2) in div-1 table
      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );

      const gain1 = result.clubs['ai-club-1'].budget - world.clubs['ai-club-1'].budget;
      const gain2 = result.clubs['ai-club-2'].budget - world.clubs['ai-club-2'].budget;
      // Higher position (lower index) gets more prize money
      expect(gain1).toBeGreaterThan(gain2);
    });
  });

  // ── 2. AI Contract Renewals ──

  describe('AI Contract Renewals', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('AI clubs renew expiring contracts for key players', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();
      const targetId = world.clubs['ai-club-1'].playerIds[0];
      world.players[targetId] = {
        ...world.players[targetId],
        overall: 75,
        age: 26,
        contractEnd: 1, // expires this season
      };

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );
      expect(result.players[targetId].contractEnd).toBeGreaterThan(1);
    });

    it('young players get 3-year extensions', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();
      const targetId = world.clubs['ai-club-1'].playerIds[0];
      world.players[targetId] = {
        ...world.players[targetId],
        overall: 65, // below AI_RENEW_KEY_PLAYER_OVERALL (70) so the young-age path is taken
        age: 21, // young player (< AI_RENEW_YOUNG_AGE = 25)
        contractEnd: 1,
      };

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );
      // Young players get AI_RENEW_YEARS_YOUNG = 3 year extension
      // contractEnd = season (1) + years (3) = 4
      expect(result.players[targetId].contractEnd).toBe(4);
    });

    it('old players (33+) do NOT get renewed unless exceptional (80+ overall)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();
      const targetId = world.clubs['ai-club-1'].playerIds[0];
      world.players[targetId] = {
        ...world.players[targetId],
        overall: 65, // below 80
        age: 34,
        contractEnd: 1,
      };

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );
      // Even with random mocked to 0.05 (passing probability gate),
      // the age/overall check prevents renewal for non-exceptional old players
      expect(result.players[targetId].contractEnd).toBe(1);
    });

    it('exceptional old players (33+, 80+ overall) CAN get renewed', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();
      const targetId = world.clubs['ai-club-1'].playerIds[0];
      world.players[targetId] = {
        ...world.players[targetId],
        overall: 85, // exceptional
        age: 34,
        contractEnd: 1,
      };

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );
      expect(result.players[targetId].contractEnd).toBeGreaterThan(1);
    });

    it('player club contracts should NOT be touched by AI renewals', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();
      // Set all player club players to have expiring contracts
      for (const pid of world.clubs[world.playerClubId].playerIds) {
        world.players[pid] = { ...world.players[pid], contractEnd: 1 };
      }

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );

      for (const pid of world.clubs[world.playerClubId].playerIds) {
        expect(result.players[pid].contractEnd).toBe(1);
      }
    });
  });

  // ── 3. Transfer Window Behavior ──

  describe('Transfer Window Behavior', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('when transferWindowOpen is false, no new transfer listings are created', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      // Make some AI players sell candidates (aging + declining)
      for (let i = 0; i < 5; i++) {
        const pid = world.clubs['ai-club-1'].playerIds[i];
        world.players[pid] = { ...world.players[pid], age: 33, overall: 55, wantsToLeave: true } as Player;
      }

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );

      expect(result.transferMarket.length).toBe(0);
    });

    it('when transferWindowOpen is true, AI clubs can list players for sale', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      // Make some AI players obvious sell candidates
      for (let i = 0; i < 5; i++) {
        const pid = world.clubs['ai-club-1'].playerIds[i];
        world.players[pid] = { ...world.players[pid], age: 33, overall: 55, wantsToLeave: true } as Player;
      }

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        7, 1, world.playerClubId, true, // deadline week 7 increases chances
      );
      expect(result.transferMarket.length).toBeGreaterThan(0);
    });

    it('when transferWindowOpen is false, no new loans are created', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );

      expect(result.activeLoans.length).toBe(0);
    });

    it('free agent signings happen regardless of transfer window', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      // Create a free agent that matches a need
      // Remove a GK from ai-club-1 to create a need
      const gkIds = world.clubs['ai-club-1'].playerIds.filter(id =>
        world.players[id].position === 'GK'
      );
      // Remove both GKs to create critical need
      for (const gkId of gkIds) {
        world.clubs['ai-club-1'] = {
          ...world.clubs['ai-club-1'],
          playerIds: world.clubs['ai-club-1'].playerIds.filter(id => id !== gkId),
          lineup: world.clubs['ai-club-1'].lineup.filter(id => id !== gkId),
          subs: world.clubs['ai-club-1'].subs.filter(id => id !== gkId),
        };
      }

      // Add a free agent GK
      const freeGk = makePlayer({
        id: 'free-gk-1',
        position: 'GK',
        overall: 70,
        potential: 75,
        age: 27,
        clubId: '',
        wage: 15_000,
        value: 3_000_000,
      });
      world.players[freeGk.id] = freeGk;
      world.freeAgents = [freeGk.id];

      // With random mocked to 0.05, free agent signing triggers (< AI_FREE_AGENT_CHANCE = 0.10)
      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );
      expect(result.freeAgents.length).toBeLessThan(world.freeAgents.length);
    });
  });

  // ── 4. AI Selling Logic ──

  describe('AI Selling Logic', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('aging players (31+) with low overall are candidates for sale', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();
      const pid = world.clubs['ai-club-1'].playerIds[5]; // a CB
      world.players[pid] = {
        ...world.players[pid],
        age: 32,
        overall: 55, // well below squad average
      };

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        7, 1, world.playerClubId, true, // deadline week
      );
      expect(result.transferMarket.some(l => l.playerId === pid)).toBe(true);
    });

    it('players wanting to leave get listed', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();
      const pid = world.clubs['ai-club-1'].playerIds[3];
      world.players[pid] = { ...world.players[pid], wantsToLeave: true } as Player;

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        7, 1, world.playerClubId, true,
      );
      expect(result.transferMarket.some(l => l.playerId === pid)).toBe(true);
    });

    it('surplus positions (3+ at same position) trigger sales', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      // Add extra ST players to ai-club-1 (already has 3 from template, let's verify)
      const stIds = world.clubs['ai-club-1'].playerIds.filter(id =>
        world.players[id].position === 'ST'
      );

      // Ensure we have 3+ STs (template already has 3)
      expect(stIds.length).toBeGreaterThanOrEqual(3);

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        7, 1, world.playerClubId, true,
      );
      expect(result.transferMarket.some(l => stIds.includes(l.playerId))).toBe(true);
    });
  });

  // ── 5. AI Free Agent Signings ──

  describe('AI Free Agent Signings', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('AI clubs can sign free agents', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      // Remove all GKs from ai-club-2 to create a critical need (GK target=2, current=0)
      const gkIds = world.clubs['ai-club-2'].playerIds.filter(id =>
        world.players[id].position === 'GK'
      );
      for (const gkId of gkIds) {
        world.clubs['ai-club-2'] = {
          ...world.clubs['ai-club-2'],
          playerIds: world.clubs['ai-club-2'].playerIds.filter(id => id !== gkId),
          lineup: world.clubs['ai-club-2'].lineup.filter(id => id !== gkId),
          subs: world.clubs['ai-club-2'].subs.filter(id => id !== gkId),
        };
      }

      const freeGk = makePlayer({
        id: 'free-gk-agent',
        position: 'GK',
        overall: 68,
        potential: 72,
        age: 26,
        clubId: '',
        wage: 10_000,
        value: 2_000_000,
      });
      world.players[freeGk.id] = freeGk;
      world.freeAgents = [freeGk.id];

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );
      expect(result.freeAgents).not.toContain(freeGk.id);
      expect(result.players[freeGk.id].clubId).not.toBe('');
    });

    it('free agents are removed from the pool after signing', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      // Remove GKs from multiple AI clubs to create demand
      for (const clubId of ['ai-club-1', 'ai-club-2', 'ai-club-3']) {
        const gkIds = world.clubs[clubId].playerIds.filter(id =>
          world.players[id].position === 'GK'
        );
        for (const gkId of gkIds) {
          world.clubs[clubId] = {
            ...world.clubs[clubId],
            playerIds: world.clubs[clubId].playerIds.filter(id => id !== gkId),
            lineup: world.clubs[clubId].lineup.filter(id => id !== gkId),
            subs: world.clubs[clubId].subs.filter(id => id !== gkId),
          };
        }
      }

      const freeGk = makePlayer({
        id: 'free-gk-sole',
        position: 'GK',
        overall: 70,
        age: 27,
        clubId: '',
        wage: 10_000,
        value: 2_000_000,
      });
      world.players[freeGk.id] = freeGk;
      world.freeAgents = [freeGk.id];

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );
      // Only one club should have signed them
      const signingClubs = Object.values(result.clubs).filter(c =>
        c.playerIds.includes(freeGk.id)
      );
      expect(signingClubs.length).toBe(1);
      expect(result.freeAgents).not.toContain(freeGk.id);
    });
  });

  // ── 6. Return Value Integrity ──

  describe('Return Value Integrity', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('result always contains all required keys', () => {
      const world = createTestWorld();

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, true,
      );

      expect(result).toHaveProperty('clubs');
      expect(result).toHaveProperty('players');
      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('transferMarket');
      expect(result).toHaveProperty('freeAgents');
      expect(result).toHaveProperty('activeLoans');
      expect(result).toHaveProperty('transferNews');
    });

    it('result preserves all clubs (no clubs are removed)', () => {
      const world = createTestWorld();

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, true,
      );

      expect(Object.keys(result.clubs).sort()).toEqual(Object.keys(world.clubs).sort());
    });

    it('player club players are never modified by AI processing (no club changes)', () => {
      const world = createTestWorld();
      const playerClubPlayerIds = [...world.clubs[world.playerClubId].playerIds];
      const originalPlayerData: Record<string, Player> = {};
      for (const pid of playerClubPlayerIds) {
        originalPlayerData[pid] = { ...world.players[pid] };
      }

      // Run with window open to trigger maximum AI activity
      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        7, 1, world.playerClubId, true,
      );

      // Verify player club's player list is unchanged
      expect(result.clubs[world.playerClubId].playerIds).toEqual(playerClubPlayerIds);

      // Verify each player's clubId is still the player club
      for (const pid of playerClubPlayerIds) {
        expect(result.players[pid].clubId).toBe(world.playerClubId);
      }
    });

    it('player club budget is unchanged by AI processing', () => {
      const world = createTestWorld();
      const originalBudget = world.clubs[world.playerClubId].budget;

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        7, 1, world.playerClubId, true,
      );

      expect(result.clubs[world.playerClubId].budget).toBe(originalBudget);
    });

    it('no duplicate transfer listings for the same player', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      // Make many candidates for listing
      for (let i = 0; i < 8; i++) {
        const pid = world.clubs['ai-club-1'].playerIds[i];
        world.players[pid] = { ...world.players[pid], wantsToLeave: true } as Player;
      }

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        7, 1, world.playerClubId, true,
      );

      const playerIdsInMarket = result.transferMarket.map(l => l.playerId);
      const unique = new Set(playerIdsInMarket);
      expect(unique.size).toBe(playerIdsInMarket.length);
    });

    it('transfer market listings have valid asking prices (positive numbers)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      for (let i = 0; i < 5; i++) {
        const pid = world.clubs['ai-club-1'].playerIds[i];
        world.players[pid] = { ...world.players[pid], wantsToLeave: true, value: 5_000_000 } as Player;
      }

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        7, 1, world.playerClubId, true,
      );
      expect(result.transferMarket.length).toBeGreaterThan(0);
      for (const listing of result.transferMarket) {
        expect(listing.askingPrice).toBeGreaterThan(0);
        expect(listing.sellerClubId).toBeTruthy();
        expect(listing.playerId).toBeTruthy();
      }
    });

    it('does not mutate input objects', () => {
      const world = createTestWorld();
      const originalClubBudget = world.clubs['ai-club-1'].budget;
      const originalPlayerIds = [...world.clubs['ai-club-1'].playerIds];

      processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, false,
      );

      // Original input should be unchanged
      expect(world.clubs['ai-club-1'].budget).toBe(originalClubBudget);
      expect(world.clubs['ai-club-1'].playerIds).toEqual(originalPlayerIds);
    });
  });

  // ── 7. Edge Cases & Constraints ──

  describe('Edge Cases & Constraints', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('wage crisis increases listing activity', () => {
      // Mock random to 0.15: this is above AI_SELL_LISTING_CHANCE (0.12) so normal
      // clubs skip listing, but below crisis chance (0.12 * 3 = 0.36) so crisis clubs list.
      // Use a non-deadline week so the deadline bypass doesn't interfere.
      vi.spyOn(Math, 'random').mockReturnValue(0.15);
      const world = createTestWorld();

      // Create a wage-crisis club (ai-club-1) where wageBill > 90% of weekly income
      world.clubs['ai-club-1'] = {
        ...world.clubs['ai-club-1'],
        wageBill: 5_000_000, // extremely high wage bill to exceed 90% of income
      };

      // Make sell candidates in both clubs (wantsToLeave players)
      for (let i = 0; i < 5; i++) {
        const pid1 = world.clubs['ai-club-1'].playerIds[i];
        world.players[pid1] = { ...world.players[pid1], wantsToLeave: true } as Player;
        const pid2 = world.clubs['ai-club-2'].playerIds[i];
        world.players[pid2] = { ...world.players[pid2], wantsToLeave: true } as Player;
      }

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        10, 1, world.playerClubId, true, // non-deadline week
      );

      const crisisListings = result.transferMarket.filter(l => l.sellerClubId === 'ai-club-1');
      const normalListings = result.transferMarket.filter(l => l.sellerClubId === 'ai-club-2');
      // Wage crisis club should list more players (3x AI_SELL_LISTING_CHANCE)
      expect(crisisListings.length).toBeGreaterThan(normalListings.length);
    });

    it('transfer cap enforced (max 3 per week)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      // Make many sell candidates across all AI clubs
      for (const clubId of ['ai-club-1', 'ai-club-2', 'ai-club-3']) {
        for (let i = 0; i < 8; i++) {
          const pid = world.clubs[clubId].playerIds[i];
          world.players[pid] = { ...world.players[pid], wantsToLeave: true, value: 1_000_000 } as Player;
        }
      }

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        7, 1, world.playerClubId, true,
      );

      // Count completed transfers (players whose clubId changed from their original club)
      const completedTransfers = result.transferNews.filter(n => n.type === 'transfer').length;
      // AI_TRANSFER_MAX_PER_WEEK = 3
      expect(completedTransfers).toBeLessThanOrEqual(3);
    });

    it('player attributes not corrupted', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const world = createTestWorld();

      const result = processAIWeekly(
        world.clubs, world.players, world.messages,
        world.transferMarket, world.freeAgents, world.activeLoans,
        world.transferNews, world.divisionTables,
        7, 1, world.playerClubId, true,
      );

      // Verify all players still have valid attributes after AI processing
      for (const player of Object.values(result.players)) {
        expect(player.overall).toBeGreaterThan(0);
        expect(player.age).toBeGreaterThan(0);
        expect(Number.isNaN(player.overall)).toBe(false);
        expect(Number.isNaN(player.age)).toBe(false);
        expect(Number.isNaN(player.wage)).toBe(false);
        expect(Number.isNaN(player.value)).toBe(false);
        // Verify attributes object is intact
        expect(player.attributes).toBeDefined();
        for (const val of Object.values(player.attributes)) {
          expect(Number.isNaN(val as number)).toBe(false);
          expect(val).toBeGreaterThan(0);
        }
      }
    });
  });
});
