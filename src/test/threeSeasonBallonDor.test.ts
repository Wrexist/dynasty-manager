/* eslint-disable no-console -- diagnostic test surfaces BdO winners for tuning */
/**
 * Three-season Ballon d'Or simulation.
 *
 * Boots a real game via initGame, plays three full seasons (46 weeks +
 * playCurrentMatch each + endSeason), then prints the top-10 Ballon d'Or
 * ranking from each season's history. Useful as a sanity check for the
 * scoring formula whenever balance changes — surfaces who actually wins
 * under live conditions (positions, divisions, trophies, ratings) rather
 * than under hand-built fixtures.
 *
 * Output is gated behind VITEST_AUDIT=1 to keep CI quiet:
 *   VITEST_AUDIT=1 npm test -- threeSeasonBallonDor
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';

const CLUB_ID = 'manchester-city';
const TOTAL_WEEKS = 46;

const auditLog: typeof console.log = process.env.VITEST_AUDIT ? console.log : () => {};

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

function formatTop10(season: number, ranking: NonNullable<ReturnType<typeof useGameStore.getState>['seasonHistory'][number]['ballonDOrRanking']>) {
  const lines: string[] = [];
  lines.push('');
  lines.push(`────────  Ballon d'Or — Season ${season}  ────────`);
  lines.push('Rank  Player                          Club    Pos  OVR  Age  Goals  Assists  Apps  AvgRtg  Score');
  for (const e of ranking.slice(0, 10)) {
    const name = `${e.playerName}`.padEnd(30).slice(0, 30);
    const club = (e.clubName || '').padEnd(7).slice(0, 7);
    const pos = e.position.padEnd(4).slice(0, 4);
    const ovr = String(e.overall).padStart(3);
    const age = String(e.age).padStart(3);
    const goals = String(e.goals).padStart(5);
    const assists = String(e.assists).padStart(7);
    const apps = String(e.appearances).padStart(4);
    const rtg = (e.avgRating?.toFixed(1) ?? '—').padStart(6);
    const score = e.score.toFixed(1).padStart(6);
    lines.push(`${String(e.rank).padStart(4)}  ${name}  ${club}  ${pos}  ${ovr}  ${age}  ${goals}  ${assists}  ${apps}  ${rtg}  ${score}`);
  }
  lines.push('');
  return lines.join('\n');
}

describe('Three-season Ballon d\'Or simulation', () => {
  beforeEach(() => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    useGameStore.getState().resetGame();
    localStorage.clear();
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('produces a top-10 ranking for three consecutive seasons', { timeout: 180_000 }, async () => {
    const top10PerSeason: { season: number; ranking: NonNullable<ReturnType<typeof useGameStore.getState>['seasonHistory'][number]['ballonDOrRanking']> }[] = [];

    for (let s = 0; s < 3; s++) {
      const seasonNum = useGameStore.getState().season;
      await advanceFullSeason();

      const history = useGameStore.getState().seasonHistory;
      const last = history[history.length - 1];
      expect(last, `season ${seasonNum} should produce history`).toBeTruthy();
      expect(last.season, 'history season number matches').toBe(seasonNum);

      const ranking = last.ballonDOrRanking;
      expect(ranking, `season ${seasonNum} should produce a Ballon d'Or ranking`).toBeTruthy();
      expect(ranking!.length, 'ranking should be non-empty').toBeGreaterThan(0);

      top10PerSeason.push({ season: seasonNum, ranking: ranking! });
      auditLog(formatTop10(seasonNum, ranking!));
    }

    // Sanity invariants on every season's ranking.
    for (const { season, ranking } of top10PerSeason) {
      // Top 25 cap.
      expect(ranking.length, `season ${season} ranking length`).toBeLessThanOrEqual(25);
      // Ranks are dense 1..N.
      ranking.forEach((entry, i) => {
        expect(entry.rank, `season ${season} rank at index ${i}`).toBe(i + 1);
      });
      // Scores are monotonically non-increasing.
      for (let i = 1; i < ranking.length; i++) {
        expect(ranking[i].score, `season ${season} score order at rank ${i + 1}`)
          .toBeLessThanOrEqual(ranking[i - 1].score);
      }
      // Winner should be a real player with a real overall rating (not 0 or NaN).
      // The simulation is stochastic — under unusual seeds a lower-tier club
      // can win their division and field the BdO winner via avg-rating
      // dominance, so we don't assert a tight lower bound here.
      expect(ranking[0].overall, `season ${season} winner overall`).toBeGreaterThan(0);
    }

    // Always print the summary so the user (running with VITEST_AUDIT=1)
    // can see who would win the BdO under current balance.
    if (process.env.VITEST_AUDIT) {
      auditLog('\n════════ Three-Season Summary ════════');
      for (const { season, ranking } of top10PerSeason) {
        const w = ranking[0];
        auditLog(`Season ${season}: ${w.playerName} (${w.clubName}, ${w.position}, OVR ${w.overall}) — ${w.goals}G/${w.assists}A in ${w.appearances} apps, score ${w.score.toFixed(1)}`);
      }
    }
  });
});
