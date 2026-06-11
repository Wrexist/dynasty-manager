/**
 * Longevity stress suite — Phase 1 gaps, Phase 2 boundaries, Phase 4–5 checks.
 *
 * Complements `longevity.test.ts` (10–20 season loops) and `edgeCases.test.ts`
 * (mass contracts, transfers, loans) with stricter invariants and save/perf probes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { assertValidGameState, validateGameState } from './stateValidator';
import { LEAGUES } from '@/data/league';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';
import { MAX_FINANCE_HISTORY } from '@/config/gameBalance';
import { CUP_BYE_MARKER } from '@/data/cup';
import type { GameState } from '@/store/storeTypes';

const CLUB_ID = 'manchester-city';
const TOTAL_WEEKS = 46;

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function advanceFullSeason() {
  const store = useGameStore;
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    await store.getState().advanceWeek();
    store.getState().playCurrentMatch();
    if (w % 10 === 9) await tick();
  }
  store.getState().endSeason();
}

function allDivisionClubIds(state: GameState): string[] {
  return Object.values(state.divisionClubs).flat();
}

function assertEnglishPyramidCounts(state: GameState) {
  const engLeagues = LEAGUES.filter(l => l.countryId === 'eng');
  for (const league of engLeagues) {
    const ids = state.divisionClubs[league.id];
    expect(ids?.length ?? 0, `${league.id} club count`).toBe(league.teamCount);
  }
  const unique = new Set(allDivisionClubIds(state));
  const sum = engLeagues.reduce((s, l) => s + l.teamCount, 0);
  expect(unique.size, 'unique clubs across English pyramid').toBe(sum);
  expect(sum, 'England configured club total').toBe(92);
}

describe('Phase 1 — strict multi-season invariants', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('1A: 12 seasons — validateGameState, ≥18 valid players per league club, numeric player fields', { timeout: 200_000 }, async () => {
    for (let s = 0; s < 12; s++) {
      const seasonBefore = useGameStore.getState().season;
      expect(seasonBefore).toBe(s + 1);

      await advanceFullSeason();

      const state = useGameStore.getState();
      expect(state.season).toBe(seasonBefore + 1);
      expect(state.week).toBe(1);

      assertValidGameState(state, `After season ${seasonBefore}`);

      assertEnglishPyramidCounts(state);

      const seenPlayer = new Set<string>();
      for (const clubId of allDivisionClubIds(state)) {
        const club = state.clubs[clubId];
        expect(club, `club ${clubId}`).toBeDefined();
        const valid = club!.playerIds.filter(id => state.players[id]);
        expect(
          valid.length,
          `${club!.name} (${clubId}) needs ≥18 valid players`,
        ).toBeGreaterThanOrEqual(18);

        for (const pid of club!.playerIds) {
          expect(seenPlayer.has(pid), `player ${pid} duplicated across clubs`).toBe(false);
          seenPlayer.add(pid);
        }
        for (const pid of club!.lineup) {
          expect(club!.playerIds, `lineup ${pid}`).toContain(pid);
        }
        for (const pid of club!.subs) {
          expect(club!.playerIds, `subs ${pid}`).toContain(pid);
        }
      }

      for (const p of Object.values(state.players)) {
        if (!p) continue;
        expect(p.overall, `${p.lastName} overall`).not.toBeNaN();
        expect(p.potential, `${p.lastName} potential`).not.toBeNaN();
        expect(p.age, `${p.lastName} age`).not.toBeNaN();
        expect(p.wage, `${p.lastName} wage`).not.toBeNaN();
        expect(p.value, `${p.lastName} value`).not.toBeNaN();
        if (p.clubId) {
          expect(p.overall).toBeGreaterThan(0);
          expect(p.age).toBeGreaterThan(0);
          expect(p.age).toBeLessThanOrEqual(50);
        }
      }

      expect(state.fixtures.length).toBeGreaterThan(0);
      for (const [leagueId, fixtures] of Object.entries(state.divisionFixtures)) {
        expect(fixtures.length, `${leagueId} fixtures`).toBeGreaterThan(0);
      }
    }
  });

  it('1B: 15 seasons — promotion turnover + replacement clubs unique within each snapshot', { timeout: 220_000 }, async () => {
    for (let s = 0; s < 15; s++) {
      await advanceFullSeason();
      const state = useGameStore.getState();

      assertEnglishPyramidCounts(state);
      assertValidGameState(state, `1B season ${state.season}`);

      const replacedThisSeason = allDivisionClubIds(state).filter(id => id.startsWith('replaced-'));
      expect(new Set(replacedThisSeason).size, 'duplicate replaced- ids same season').toBe(replacedThisSeason.length);

      const t = state.lastSeasonTurnover;
      if (t && t.promotedClubs.length > 0) {
        for (const cid of t.promotedClubs) {
          expect(state.divisionClubs[t.leagueId] ?? [], `promoted ${cid} in ${t.leagueId}`).toContain(cid);
        }
      }
      if (t && t.relegatedClubs.length > 0) {
        const lower = LEAGUES.find(l => l.id === t.leagueId);
        const below = lower ? LEAGUES.find(l => l.countryId === lower.countryId && l.tier === lower.tier + 1) : undefined;
        if (below) {
          for (const cid of t.relegatedClubs) {
            expect(state.divisionClubs[below.id] ?? [], `relegated ${cid} in ${below.id}`).toContain(cid);
          }
        }
      }
      if (t && t.playoffWinners.length > 0 && t.leagueId) {
        for (const cid of t.playoffWinners) {
          expect(state.divisionClubs[t.leagueId] ?? []).toContain(cid);
        }
      }

      for (const clubId of allDivisionClubIds(state)) {
        if (clubId.startsWith('replaced-')) {
          const c = state.clubs[clubId];
          expect(c?.playerIds.filter(id => state.players[id]).length ?? 0).toBeGreaterThanOrEqual(18);
          expect(c?.budget).toBeDefined();
          expect(Number.isFinite(c!.budget)).toBe(true);
        }
      }
    }
  });

  it('1C: 20 seasons — player club youth intake, aging sample, squad bounds, stat sanity', { timeout: 320_000 }, async () => {
    let prevAges = new Map<string, number>();

    for (let s = 0; s < 20; s++) {
      const prePlayerIds = new Set(
        allDivisionClubIds(useGameStore.getState()).flatMap(id => useGameStore.getState().clubs[id]?.playerIds ?? []),
      );
      prevAges = new Map(
        [...prePlayerIds].map(pid => {
          const pl = useGameStore.getState().players[pid];
          return [pid, pl?.age ?? -1];
        }),
      );

      await advanceFullSeason();

      const state = useGameStore.getState();
      const pc = state.clubs[state.playerClubId];
      expect(pc).toBeDefined();

      const youthThisSeason = Object.values(state.players).filter(
        p => p && p.clubId === state.playerClubId && p.isFromYouthAcademy && p.joinedSeason === state.season,
      );
      expect(youthThisSeason.length, 'player club youth intake count').toBeGreaterThanOrEqual(2);
      expect(youthThisSeason.length).toBeLessThanOrEqual(6);

      for (const [pid, ageBefore] of prevAges) {
        const now = state.players[pid];
        if (!now || !prePlayerIds.has(pid)) continue;
        if (now.clubId && allDivisionClubIds(state).some(cid => state.clubs[cid]?.playerIds.includes(pid))) {
          expect(now.age).toBeGreaterThanOrEqual(ageBefore);
          expect(now.age).toBeLessThanOrEqual(ageBefore + 1);
        }
      }

      const rostered = Object.values(state.players).filter(p => p && p.clubId);
      for (const p of rostered) {
        expect(p.age).toBeGreaterThan(0);
        expect(p.age).toBeLessThanOrEqual(50);
        expect(p.goals).toBeGreaterThanOrEqual(0);
        expect(p.assists).toBeGreaterThanOrEqual(0);
        expect(p.appearances).toBeGreaterThanOrEqual(0);
      }

      const totalPlayers = Object.keys(state.players).length;
      expect(totalPlayers).toBeGreaterThanOrEqual(2000);
      expect(totalPlayers).toBeLessThanOrEqual(4500);

      for (const cid of allDivisionClubIds(state)) {
        const c = state.clubs[cid];
        const n = c?.playerIds.filter(id => state.players[id]).length ?? 0;
        expect(n).toBeGreaterThanOrEqual(11);
      }

      const ghostContracts = rostered.filter(
        p => p.contractEnd < state.season && p.clubId && !p.onLoan,
      );
      expect(ghostContracts.length, 'expired contract still rostered').toBe(0);
    }
  });

  it('1D: 15 seasons — budgets bounded, financeHistory capped', { timeout: 200_000 }, async () => {
    for (let s = 0; s < 15; s++) {
      await advanceFullSeason();
      const state = useGameStore.getState();

      for (const cid of allDivisionClubIds(state)) {
        const c = state.clubs[cid];
        if (!c) continue;
        expect(Number.isFinite(c.budget)).toBe(true);
        expect(c.budget).toBeGreaterThan(-100_000_000);
        // Elite clubs can exceed £2B after many successful seasons; reject runaway / overflow only
        expect(c.budget).toBeLessThan(50_000_000_000);
        expect(c.wageBill).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(c.wageBill)).toBe(true);
      }

      expect(state.financeHistory.length).toBeLessThanOrEqual(MAX_FINANCE_HISTORY);
    }
  });

  it('1E: cup bracket integrity for 92-club pyramid each season (5 seasons)', { timeout: 90_000 }, async () => {
    for (let s = 0; s < 5; s++) {
      const state = useGameStore.getState();
      const leagueIds = LEAGUES.filter(l => l.countryId === 'eng').map(l => l.id);
      const cupClubIds = leagueIds.flatMap(id => state.divisionClubs[id] ?? []);
      expect(new Set(cupClubIds).size).toBe(92);

      const cup = state.cup;
      expect(cup.ties.length).toBeGreaterThan(0);

      const r1 = cup.ties.filter(t => t.round === cup.currentRound);
      const inR1 = new Set<string>();
      for (const t of r1) {
        for (const side of [t.homeClubId, t.awayClubId]) {
          if (!side || side === CUP_BYE_MARKER || side.toLowerCase() === '__bye__') continue;
          expect(inR1.has(side), `dup in cup R1: ${side}`).toBe(false);
          inR1.add(side);
        }
      }

      await advanceFullSeason();
      expect(useGameStore.getState().cup.ties.length).toBeGreaterThan(0);
    }
  });
});

describe('Phase 2 — injuries + transfer window execution', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('2B: many injured + suspended players — advanceWeek does not throw', { timeout: 45_000 }, async () => {
    const state = useGameStore.getState();
    const club = state.clubs[CLUB_ID];
    const players = { ...state.players };
    const ids = club.playerIds.slice(0, 8);
    for (let i = 0; i < 5; i++) {
      const p = players[ids[i]];
      if (p) {
        players[ids[i]] = {
          ...p,
          injured: true,
          injuryWeeks: 4,
          injuryDetails: {
            type: 'knock',
            severity: 'minor',
            weeksRemaining: 4,
            totalWeeks: 4,
            reinjuryRisk: 0,
            reinjuryWeeksRemaining: 0,
            fitnessOnReturn: 85,
          },
        };
      }
    }
    for (let i = 5; i < 7; i++) {
      const p = players[ids[i]];
      if (p) {
        players[ids[i]] = { ...p, suspendedUntilWeek: state.week + 10, yellowCards: 5 };
      }
    }
    useGameStore.setState({ players });

    // A rejection from advanceWeek or a throw from playCurrentMatch fails
    // the test directly — same contract as the old expect().not.toThrow().
    await useGameStore.getState().advanceWeek();
    useGameStore.getState().playCurrentMatch();

    const post = useGameStore.getState();
    for (const pid of ids.slice(0, 5)) {
      const pl = post.players[pid];
      if (pl?.injuryDetails && pl.injured) {
        expect(pl.injuryDetails.weeksRemaining).toBeLessThanOrEqual(4);
      }
    }
  });

  it('2C: executeTransfer succeeds in window week 8, fails when closed week 9 and 25', { timeout: 60_000 }, async () => {
    // Pick an affordable listing so the assertion targets the window gate
    // rather than the budget gate. Player-value rebalances upstream can
    // shift listing prices into ranges that exceed the starting budget,
    // which would silently flip this test from "verify mechanism" to
    // "verify insufficient-funds rejection" — not its intent.
    const findListing = () => {
      const st = useGameStore.getState();
      const buyer = st.clubs[st.playerClubId];
      const budget = buyer?.budget ?? 0;
      const listing = st.transferMarket.find(
        l => l.sellerClubId
          && st.clubs[l.sellerClubId]?.playerIds.includes(l.playerId)
          && l.askingPrice <= budget,
      );
      return listing;
    };

    for (let w = 0; w < 7; w++) {
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }
    expect(useGameStore.getState().week).toBe(8);
    expect(useGameStore.getState().transferWindowOpen).toBe(true);

    const listing8 = findListing();
    if (listing8) {
      const r = useGameStore.getState().executeTransfer(listing8.playerId, listing8.askingPrice);
      expect(r.success, r.message).toBe(true);
    }

    await useGameStore.getState().advanceWeek();
    useGameStore.getState().playCurrentMatch();
    expect(useGameStore.getState().week).toBe(9);
    expect(useGameStore.getState().transferWindowOpen).toBe(false);

    const listing9 = findListing();
    if (listing9) {
      const r9 = useGameStore.getState().executeTransfer(listing9.playerId, listing9.askingPrice);
      expect(r9.success).toBe(false);
      expect(r9.message).toMatch(/closed/i);
    }

    while (useGameStore.getState().week < 24) {
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }
    expect(useGameStore.getState().week).toBe(24);
    expect(useGameStore.getState().transferWindowOpen).toBe(true);

    const listing24 = findListing();
    if (listing24) {
      const r24 = useGameStore.getState().executeTransfer(listing24.playerId, listing24.askingPrice);
      expect(r24.success, r24.message).toBe(true);
    }

    await useGameStore.getState().advanceWeek();
    useGameStore.getState().playCurrentMatch();
    expect(useGameStore.getState().week).toBe(25);
    expect(useGameStore.getState().transferWindowOpen).toBe(false);

    const listing25 = findListing();
    if (listing25) {
      const r25 = useGameStore.getState().executeTransfer(listing25.playerId, listing25.askingPrice);
      expect(r25.success).toBe(false);
    }
  });
});

describe('Phase 4 — save round-trip + migration', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('4B/C: JSON round-trip and migrateSaveData each season for 5 seasons', { timeout: 120_000 }, async () => {
    for (let s = 0; s < 5; s++) {
      await advanceFullSeason();
      const raw = useGameStore.getState() as unknown as Record<string, unknown>;
      const json = JSON.stringify(raw);
      const parsed = JSON.parse(json) as Record<string, unknown>;
      parsed.version = (parsed.version as number) ?? 1;
      const migrated = migrateSaveData(parsed);
      expect(typeof migrated.version).toBe('number');
      expect(migrated.version as number).toBeGreaterThanOrEqual(1);
      expect(migrated.version as number).toBeLessThanOrEqual(CURRENT_VERSION);

      const size = json.length;
      expect(size).toBeGreaterThan(10_000);
      if (s === 4) {
        const projected20 = size * (20 / (s + 2));
        if (projected20 > 4_000_000) {
          console.warn(`[longevityStress] projected save size at S20 ~${Math.round(projected20 / 1e6)}MB`);
        }
      }

      const errors = validateGameState(useGameStore.getState());
      const critical = errors.filter(e => e.severity === 'critical');
      expect(critical.length, critical.map(e => e.message).join('; ')).toBe(0);
    }
  });
});

describe('Phase 5 — advanceWeek timing sample', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('5A: 100 consecutive advanceWeek calls average under 200ms', { timeout: 120_000 }, async () => {
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
      times.push(performance.now() - t0);
    }
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const budgetMs = process.env.CI ? 500 : 200;
    if (mean > 200) {
      console.warn(`[longevityStress] advanceWeek+play mean ${mean.toFixed(1)}ms (warn >200ms, fail >${budgetMs}ms)`);
    }
    expect(mean).toBeLessThan(budgetMs);
  });
});

describe('Phase 2G — continental state after season rollover', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('continental tournaments null or well-formed after one endSeason', { timeout: 45_000 }, async () => {
    for (let w = 0; w < TOTAL_WEEKS; w++) {
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }
    useGameStore.getState().endSeason();
    const state = useGameStore.getState();

    for (const label of ['championsCup', 'shieldCup', 'conferenceCup'] as const) {
      const t = state[label];
      if (!t) continue;
      expect(t.groups?.length ?? 0).toBeGreaterThan(0);
      if (t.winnerId) {
        expect(typeof t.winnerId).toBe('string');
      }
    }
  });
});
