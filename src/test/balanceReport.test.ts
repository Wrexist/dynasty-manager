/* eslint-disable no-console -- diagnostic stats reporting */
/**
 * Phase E.5 balance report.
 *
 * Runs a 5-season sim with the community pack enabled and writes
 * docs/balance-report.md with:
 *   1. Average goals per match per league
 *   2. Transfer activity volume per season
 *   3. Title winners per league per season (should vary)
 *   4. Free-agent pool depletion rate (cursor vs. pool size)
 *   5. Market refresh variety (unique listings seen vs. avg simultaneous)
 *
 * Gated behind VITEST_BALANCE=1 so regular CI/dev runs don't pay the
 * ~60-90s cost. Run with:
 *
 *   VITEST_BALANCE=1 npx vitest run balanceReport
 *
 * Not a pass/fail spec — a reporting harness. The single assertion is
 * that the markdown got written.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { useGameStore } from '@/store/gameStore';
import { LEAGUES } from '@/data/league';

const RUN = process.env.VITEST_BALANCE === '1';

const CLUB_ID = 'manchester-city';
const TOTAL_WEEKS = 46;
const SEASONS = 5;

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function advanceFullSeason(onWeek?: (w: number) => void) {
  const store = useGameStore;
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    store.getState().advanceWeek();
    store.getState().playCurrentMatch();
    if (onWeek) onWeek(w);
    if (w % 10 === 9) await tick();
  }
}

interface LeagueMatchStats {
  matches: number;
  goals: number;
  avg: number;
}

interface SeasonMetrics {
  season: number;
  goalsByLeague: Record<string, LeagueMatchStats>;
  titleWinners: Record<string, { clubId: string; name: string; points: number; gf: number; ga: number }>;
  transferCount: number;
  loanCount: number;
  freeAgentSignCount: number;
  freeAgentPool: {
    size: number;
    cursor: number;
    usedFcIds: number;
    realFcIds: number; // number of FAs with a real fcId
  };
  marketChurn: {
    uniqueListingsSeen: number;
    avgSimultaneous: number;
    weeksObserved: number;
  };
}

describe.skipIf(!RUN)('Balance report: 5-season community pack sim', () => {
  it(
    'runs 5 seasons and writes docs/balance-report.md',
    { timeout: 600_000 },
    async () => {
      const store = useGameStore;
      await Promise.resolve(store.getState().initGame(CLUB_ID, { communityPackEnabled: true }));

      // Confirm CP actually loaded — skipping CP quietly would invalidate
      // the whole report.
      expect(store.getState().communityPackEnabled).toBe(true);

      const seasons: SeasonMetrics[] = [];

      for (let s = 0; s < SEASONS; s++) {
        const seasonNumber = store.getState().season;
        // transferNews is cleared by endSeason() between seasons, so we
        // snapshot the length at the top of each season and diff at the
        // end. A global cross-season watermark would go stale after the
        // clear and report 0 for S2+.
        const newsAtSeasonStart = store.getState().transferNews.length;

        const marketSnapshots: string[][] = [];

        await advanceFullSeason(() => {
          // Snapshot the market listings each week so we can measure churn.
          const listings = store.getState().transferMarket.map((l) => l.playerId);
          marketSnapshots.push(listings);
        });

        const state = store.getState();

        // 1. Goals per league (only count fixtures that were played).
        const goalsByLeague: Record<string, LeagueMatchStats> = {};
        for (const [leagueId, fixtures] of Object.entries(state.divisionFixtures)) {
          let matches = 0;
          let goals = 0;
          for (const f of fixtures) {
            if (f.played) {
              matches++;
              goals += (f.homeGoals ?? 0) + (f.awayGoals ?? 0);
            }
          }
          goalsByLeague[leagueId] = { matches, goals, avg: matches > 0 ? goals / matches : 0 };
        }

        // 3. Title winners.
        const titleWinners: SeasonMetrics['titleWinners'] = {};
        for (const [leagueId, table] of Object.entries(state.divisionTables)) {
          const top = table[0];
          if (!top) continue;
          titleWinners[leagueId] = {
            clubId: top.clubId,
            name: state.clubs[top.clubId]?.name ?? top.clubId,
            points: top.points,
            gf: top.goalsFor,
            ga: top.goalsAgainst,
          };
        }

        // 2. Transfer volume — new entries in transferNews this season.
        const newNews = state.transferNews.slice(newsAtSeasonStart);
        const transferCount = newNews.filter((n) => n.type === 'transfer').length;
        const loanCount = newNews.filter((n) => n.type === 'loan').length;
        const freeAgentSignCount = newNews.filter((n) => n.type === 'free_agent').length;

        // 4. Free-agent pool depletion.
        const realFcIds = state.freeAgents.reduce((acc, pid) => {
          const p = state.players[pid];
          return acc + (p && (p as { fcId?: string }).fcId ? 1 : 0);
        }, 0);

        // 5. Market churn.
        const uniqueIds = new Set<string>();
        let simultaneousSum = 0;
        for (const snap of marketSnapshots) {
          simultaneousSum += snap.length;
          for (const id of snap) uniqueIds.add(id);
        }

        seasons.push({
          season: seasonNumber,
          goalsByLeague,
          titleWinners,
          transferCount,
          loanCount,
          freeAgentSignCount,
          freeAgentPool: {
            size: state.freeAgents.length,
            cursor: state.cpPool.cursor,
            usedFcIds: state.cpPool.usedFcIds.length,
            realFcIds,
          },
          marketChurn: {
            uniqueListingsSeen: uniqueIds.size,
            avgSimultaneous: marketSnapshots.length > 0 ? simultaneousSum / marketSnapshots.length : 0,
            weeksObserved: marketSnapshots.length,
          },
        });

        store.getState().endSeason();
      }

      const md = renderReport(seasons);
      const outPath = join(process.cwd(), 'docs', 'balance-report.md');
      if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, md, 'utf8');

      console.log(`[balanceReport] wrote ${outPath}`);
    },
  );
});

function renderReport(seasons: SeasonMetrics[]): string {
  const leagueIds = Array.from(
    new Set(seasons.flatMap((s) => Object.keys(s.goalsByLeague))),
  ).sort();
  const leagueName = (id: string) => LEAGUES.find((l) => l.id === id)?.name ?? id;

  const out: string[] = [];
  out.push('# Community Pack — 5-Season Balance Report');
  out.push('');
  out.push(
    `_Generated by \`src/test/balanceReport.test.ts\` on ${new Date().toISOString().slice(0, 10)}. ` +
      `Player club: \`${CLUB_ID}\`. Community pack: enabled. ${seasons.length} seasons × ${TOTAL_WEEKS} weeks._`,
  );
  out.push('');
  out.push(
    '> **Reporting only.** No pass/fail assertions. Flags are human judgement calls — ' +
      'don\'t tune yet. Use this baseline to tell if E.6 changes anything.',
  );
  out.push('');

  // ── 1. Goals per match per league.
  out.push('## 1. Average goals per match per league');
  out.push('');
  const header = ['League', ...seasons.map((s) => `S${s.season}`), 'Mean'];
  out.push(`| ${header.join(' | ')} |`);
  out.push(`| ${header.map(() => '---').join(' | ')} |`);
  for (const lid of leagueIds) {
    const row = [leagueName(lid)];
    const avgs: number[] = [];
    for (const s of seasons) {
      const stat = s.goalsByLeague[lid];
      if (stat && stat.matches > 0) {
        avgs.push(stat.avg);
        row.push(stat.avg.toFixed(2));
      } else {
        row.push('—');
      }
    }
    const mean = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
    row.push(mean > 0 ? mean.toFixed(2) : '—');
    out.push(`| ${row.join(' | ')} |`);
  }
  out.push('');
  out.push(
    '_Reference: real-world top flights average ~2.6-3.0 goals per match (EPL ~2.85, Bundesliga ~3.1). ' +
      'Anything persistently under 1.8 or over 4.0 is suspect._',
  );
  out.push('');

  // ── 2. Transfer volume.
  out.push('## 2. Transfer activity volume');
  out.push('');
  out.push('| Season | Transfers | Loans | FA signings | Total moves |');
  out.push('| --- | --- | --- | --- | --- |');
  for (const s of seasons) {
    const total = s.transferCount + s.loanCount + s.freeAgentSignCount;
    out.push(
      `| S${s.season} | ${s.transferCount} | ${s.loanCount} | ${s.freeAgentSignCount} | ${total} |`,
    );
  }
  out.push('');

  // ── 3. Title winners.
  out.push('## 3. Title winners per league');
  out.push('');
  out.push('| League | ' + seasons.map((s) => `S${s.season}`).join(' | ') + ' | Distinct |');
  out.push('| --- | ' + seasons.map(() => '---').join(' | ') + ' | --- |');
  for (const lid of leagueIds) {
    const row = [leagueName(lid)];
    const winners: string[] = [];
    for (const s of seasons) {
      const w = s.titleWinners[lid];
      if (w) {
        winners.push(w.clubId);
        row.push(`${w.name} (${w.points}pt)`);
      } else {
        row.push('—');
      }
    }
    const distinct = new Set(winners).size;
    row.push(String(distinct));
    out.push(`| ${row.join(' | ')} |`);
  }
  out.push('');
  out.push(
    `_Distinct = number of different clubs that won that league across ${SEASONS} seasons. ` +
      'A \'1\' everywhere means the same club won every year — unrealistic unless that club is much stronger._',
  );
  out.push('');

  // ── 4. Free-agent pool depletion.
  out.push('## 4. Free-agent pool depletion');
  out.push('');
  out.push('| Season | FA count | Real-source FAs | CP cursor | CP used fcIds |');
  out.push('| --- | --- | --- | --- | --- |');
  for (const s of seasons) {
    const f = s.freeAgentPool;
    out.push(
      `| S${s.season} | ${f.size} | ${f.realFcIds} | ${f.cursor} | ${f.usedFcIds} |`,
    );
  }
  out.push('');
  out.push(
    '_CP cursor = how deep into the shuffled community-pack free-agent pool ' +
      '(9,074 entries) we\'ve drawn. If cursor approaches the pool size before season 5, ' +
      'we hit procedural fallback and the "real players" feel will degrade._',
  );
  out.push('');

  // ── 5. Market churn.
  out.push('## 5. Market refresh variety');
  out.push('');
  out.push(
    '| Season | Unique listings seen | Avg simultaneous | Weeks observed | Churn ratio |',
  );
  out.push('| --- | --- | --- | --- | --- |');
  for (const s of seasons) {
    const c = s.marketChurn;
    const churn = c.avgSimultaneous > 0 ? c.uniqueListingsSeen / c.avgSimultaneous : 0;
    out.push(
      `| S${s.season} | ${c.uniqueListingsSeen} | ${c.avgSimultaneous.toFixed(1)} | ${c.weeksObserved} | ${churn.toFixed(2)}x |`,
    );
  }
  out.push('');
  out.push(
    '_Churn ratio = unique listings seen ÷ average simultaneous listings. ' +
      'A ratio near 1.0 means the same ~20 names are cycling all season (bad). ' +
      'Ratios > 3 mean real roster rotation._',
  );
  out.push('');

  // ── Flags summary. Auto-generated heuristics — human must judge.
  out.push('## Flags');
  out.push('');
  const flags: string[] = [];

  // Goals-per-match extremes.
  for (const lid of leagueIds) {
    const avgs = seasons
      .map((s) => s.goalsByLeague[lid]?.avg)
      .filter((v) => typeof v === 'number' && v > 0) as number[];
    if (avgs.length === 0) continue;
    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    if (mean < 1.8) flags.push(`- 🔴 **${leagueName(lid)}** averages only ${mean.toFixed(2)} goals/match — too low.`);
    if (mean > 4.0) flags.push(`- 🔴 **${leagueName(lid)}** averages ${mean.toFixed(2)} goals/match — too high.`);
  }

  // Title repetition.
  for (const lid of leagueIds) {
    const winners = seasons.map((s) => s.titleWinners[lid]?.clubId).filter(Boolean) as string[];
    if (winners.length === SEASONS && new Set(winners).size === 1) {
      const name = seasons[0].titleWinners[lid]?.name ?? lid;
      flags.push(`- 🟠 **${leagueName(lid)}**: ${name} won all ${SEASONS} seasons — no variance.`);
    }
  }

  // FA pool depletion — flag if cursor crosses 80% of pool size in <=5 seasons.
  const CP_FA_POOL_APPROX = 9074;
  const lastCursor = seasons[seasons.length - 1]?.freeAgentPool.cursor ?? 0;
  if (lastCursor > CP_FA_POOL_APPROX * 0.8) {
    flags.push(
      `- 🟠 **CP pool depletion**: cursor at ${lastCursor} / ${CP_FA_POOL_APPROX} (${((lastCursor / CP_FA_POOL_APPROX) * 100).toFixed(0)}%) after ${SEASONS} seasons — procedural fallback imminent.`,
    );
  }

  // Low market churn — threshold 2.0x. Prompt's own yardstick: "ratios > 3
  // mean real roster rotation", "near 1.0 means the same 20 names cycling".
  for (const s of seasons) {
    const c = s.marketChurn;
    const ratio = c.avgSimultaneous > 0 ? c.uniqueListingsSeen / c.avgSimultaneous : 0;
    if (ratio > 0 && ratio < 2.0) {
      flags.push(
        `- 🟠 **Season ${s.season} market churn**: ratio ${ratio.toFixed(2)}x (${c.uniqueListingsSeen} unique / ${c.avgSimultaneous.toFixed(0)} avg) — low turnover.`,
      );
    }
  }

  // Dormant sub-systems. The community pack's pitch to the user is a rotating
  // market of real players; if the sim spends 5 seasons without touching the
  // loan or FA-signing systems, something's off at the AI level.
  const totalLoans = seasons.reduce((a, s) => a + s.loanCount, 0);
  if (totalLoans === 0) {
    flags.push(`- 🔴 **No AI loan activity** across ${SEASONS} seasons (\`transferNews\` contains 0 \`loan\` entries). The loan sub-system appears dormant.`);
  }
  const totalFaSignings = seasons.reduce((a, s) => a + s.freeAgentSignCount, 0);
  if (totalFaSignings === 0) {
    flags.push(`- 🔴 **No AI free-agent signings** across ${SEASONS} seasons. AI clubs never tap the FA pool.`);
  }

  // Real-source FA count stuck at 0 → the runtime FA pool isn't drawing from CP.
  const anyRealFaSeason = seasons.some((s) => s.freeAgentPool.realFcIds > 0);
  if (!anyRealFaSeason && seasons.some((s) => s.freeAgentPool.size > 0)) {
    flags.push(
      '- 🔴 **CP free-agent pool unused at runtime**: `cpPool.cursor` stays at 0 and every runtime free agent is procedurally generated (`realFcIds = 0`). The 9,074 CP free agents are only consumed during `initGame` — the pool never refills.',
    );
  }

  // Goals-per-match trend check — flag leagues that decline monotonically
  // (could mean cumulative attribute deflation).
  for (const lid of leagueIds) {
    const series = seasons
      .map((s) => s.goalsByLeague[lid]?.avg)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    if (series.length >= 4) {
      const first = series[0];
      const last = series[series.length - 1];
      if (first - last > 0.5) {
        flags.push(`- 🟠 **${leagueName(lid)}** goals/match trending down: ${first.toFixed(2)} → ${last.toFixed(2)} over ${series.length} seasons.`);
      }
    }
  }

  if (flags.length === 0) {
    out.push('_No automatic flags. Spot-check the tables above manually — especially the distinct-title-winners column and goals-per-match outliers._');
  } else {
    out.push(...flags);
  }
  out.push('');

  out.push('## Methodology notes');
  out.push('');
  out.push('- Sim runs the real game loop: `advanceWeek()` → `playCurrentMatch()` × 46 weeks → `endSeason()`.');
  out.push('- Player club is `manchester-city` (eng-1). Their matches use auto-filled lineups (no tactical input).');
  out.push('- Only the player\'s country pyramid (eng, eng-2, eng-3, eng-4) is simulated — `initGame` scopes `divisionClubs` to `countryLeagues`. Other country leagues (spa/ita/ger/fra/…) live in the data but aren\'t played out week-to-week, so they aren\'t in the tables below.');
  out.push('- Goals-per-match pulls from `state.divisionFixtures[leagueId]` filtered to `played=true`.');
  out.push('- Transfer counts use `state.transferNews` deltas between seasons.');
  out.push('- Market snapshots taken every week (46 per season), so "avg simultaneous" is smoothed across the whole season.');
  out.push('- Random seed is not fixed — re-runs will vary. Numbers should be stable to ±10% across runs; anything else is worth investigating.');
  out.push('');

  return out.join('\n');
}
