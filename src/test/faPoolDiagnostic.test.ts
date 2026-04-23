/* eslint-disable no-console -- diagnostic only */
/**
 * One-shot diagnostic for the FA-pool-has-0-CP-fcIds puzzle.
 *
 * Instruments the 5-season sim to answer:
 *   - How many CP-sourced players are on club rosters each season?
 *   - How many reach the FA pool via contract expiry?
 *   - How many get deleted entirely from state.players?
 *   - Are their fcIds surviving through the state transitions?
 *
 * Run with:  VITEST_FA_DIAG=1 npx vitest run faPoolDiagnostic
 *
 * Not part of the regular test suite.
 */
import { describe, it } from 'vitest';
import { useGameStore } from '@/store/gameStore';

const RUN = process.env.VITEST_FA_DIAG === '1';
const CLUB_ID = 'manchester-city';
const TOTAL_WEEKS = 46;
const SEASONS = 5;

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

interface SeasonSnapshot {
  season: number;
  cpOnClubs: number;
  cpInFaPool: number;
  cpInState: number; // still in state.players at all
  cpEverSeen: number; // cumulative set of fcIds we've seen at any point
  faPoolSize: number;
  totalPlayers: number;
}

describe.skipIf(!RUN)('FA pool diagnostic: CP fcId lifecycle', () => {
  it('traces CP player flow across 5 seasons', { timeout: 600_000 }, async () => {
    const store = useGameStore;
    await Promise.resolve(store.getState().initGame(CLUB_ID, { communityPackEnabled: true }));

    // Baseline: every fcId that exists on any Player right after init.
    const initialFcIds = new Set<string>();
    for (const p of Object.values(store.getState().players)) {
      const fcId = (p as { fcId?: string }).fcId;
      if (fcId) initialFcIds.add(fcId);
    }
    console.log(`\n[init] Players with fcId across all clubs: ${initialFcIds.size}`);

    const everSeen = new Set(initialFcIds);
    const snapshots: SeasonSnapshot[] = [];

    // Also track, per season, how many players had contractEnd <= season
    // (i.e. eligible for expiry) and how many of those carried an fcId.
    for (let s = 0; s < SEASONS; s++) {
      const seasonNumber = store.getState().season;

      for (let w = 0; w < TOTAL_WEEKS; w++) {
        store.getState().advanceWeek();
        store.getState().playCurrentMatch();
        if (w % 10 === 9) await tick();
      }

      // Pre-endSeason snapshot — contract expiries happen during endSeason.
      const preEnd = store.getState();
      const expiringWithFcId = Object.values(preEnd.players).filter((p) => {
        const fcId = (p as { fcId?: string }).fcId;
        return p && p.clubId && fcId && p.contractEnd <= seasonNumber;
      }).length;
      const expiringTotal = Object.values(preEnd.players).filter((p) => p && p.clubId && p.contractEnd <= seasonNumber).length;
      console.log(`\n[S${seasonNumber} pre-endSeason] ${expiringTotal} players with contractEnd<=${seasonNumber} (${expiringWithFcId} carry fcId)`);

      store.getState().endSeason();

      const state = store.getState();
      let cpOnClubs = 0;
      let cpInState = 0;
      for (const p of Object.values(state.players)) {
        const fcId = (p as { fcId?: string }).fcId;
        if (!fcId) continue;
        cpInState++;
        everSeen.add(fcId);
        if (p.clubId) cpOnClubs++;
      }
      const cpInFaPool = state.freeAgents.reduce((acc, pid) => {
        const p = state.players[pid];
        return acc + (p && (p as { fcId?: string }).fcId ? 1 : 0);
      }, 0);

      const snap: SeasonSnapshot = {
        season: seasonNumber,
        cpOnClubs,
        cpInFaPool,
        cpInState,
        cpEverSeen: everSeen.size,
        faPoolSize: state.freeAgents.length,
        totalPlayers: Object.keys(state.players).length,
      };
      snapshots.push(snap);

      // How many fcIds have disappeared since init?
      const lostSinceInit = [...initialFcIds].filter((id) => {
        for (const p of Object.values(state.players)) {
          if ((p as { fcId?: string }).fcId === id) return false;
        }
        return true;
      }).length;

      console.log(
        `[S${seasonNumber} post-endSeason]\n` +
          `  total players:      ${snap.totalPlayers}\n` +
          `  CP players in state: ${cpInState} (${cpOnClubs} on clubs, ${cpInFaPool} in FA pool)\n` +
          `  FA pool size:       ${snap.faPoolSize}\n` +
          `  fcIds lost since init: ${lostSinceInit} / ${initialFcIds.size}`,
      );

      // If there are CPs in state that aren't on clubs and aren't in the
      // FA pool, where are they?
      const orphanedCp: string[] = [];
      for (const p of Object.values(state.players)) {
        const fcId = (p as { fcId?: string }).fcId;
        if (!fcId) continue;
        if (p.clubId) continue;
        if (state.freeAgents.includes(p.id)) continue;
        orphanedCp.push(`${p.firstName} ${p.lastName} (fcId=${fcId}, clubId='${p.clubId}')`);
      }
      if (orphanedCp.length > 0) {
        console.log(`  orphaned CP (in state.players but no club & not in freeAgents): ${orphanedCp.length}`);
        console.log(`    first few: ${orphanedCp.slice(0, 3).join(' | ')}`);
      }
    }
  });
});
