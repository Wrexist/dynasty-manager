/**
 * Audit 6.2 — "leagues converge instead of diverging".
 *
 * Squad regeneration used to anchor replacement players on `club.reputation`
 * (`reputation * 10 + 20`) blended 0.4/0.6 with the club's own squad average.
 * Reputation spans only 2–5, and across the English pyramid it barely spans
 * anything: tier 2 is 21×rep2 + 3×rep3, tier 3 is identical, tier 4 is 24×rep2.
 * So the anchor could not tell a Championship club from a League Two one, and
 * the 0.6 on the club's own average made every fill an average player — elite
 * squads lost their stars and the bottom of the pyramid fell out.
 *
 * MEASURED over 9 seasons under the old formula: League Two's mean OVR fell
 * 61.9 -> 53.4, and the best AI club in the Premier League decayed 82.6 -> 77.6.
 * Under the design-anchored formula every tier holds within ~2 points of where
 * it started and the best AI club stays elite (81.0).
 *
 * These assertions are what separate the two: they fail on the old formula.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { tick } from './helpers/eventLoop';

const CLUB_ID = 'arsenal';
const SEASONS = 6;
/** How far a tier's mean OVR may fall below where the designed world started.
 *  The old formula lost ~5 points from tier 4 by this many seasons. */
const MAX_TIER_COLLAPSE = 4;
/** Same for the strongest AI club in the top flight — the "stars stop
 *  regenerating" symptom shows up here first. */
const MAX_ELITE_DECAY = 4;

const ENG_TIERS = ['eng', 'eng-2', 'eng-3', 'eng-4'];

function tierMean(leagueId: string): number | null {
  const s = useGameStore.getState();
  const ids = s.divisionClubs[leagueId] ?? [];
  const avgs: number[] = [];
  for (const cid of ids) {
    const c = s.clubs[cid];
    if (!c) continue;
    const squad = c.playerIds.map(i => s.players[i]).filter(Boolean);
    if (squad.length === 0) continue;
    avgs.push(squad.reduce((a, p) => a + p.overall, 0) / squad.length);
  }
  if (avgs.length === 0) return null;
  return avgs.reduce((a, b) => a + b, 0) / avgs.length;
}

/** Best club average in a league, EXCLUDING the player's own club — the user
 *  accumulating talent over many seasons is a separate (intended) effect and
 *  would mask AI decay entirely. */
function bestAiClubMean(leagueId: string): number | null {
  const s = useGameStore.getState();
  const ids = (s.divisionClubs[leagueId] ?? []).filter(cid => cid !== s.playerClubId);
  let best: number | null = null;
  for (const cid of ids) {
    const c = s.clubs[cid];
    if (!c) continue;
    const squad = c.playerIds.map(i => s.players[i]).filter(Boolean);
    if (squad.length === 0) continue;
    const avg = squad.reduce((a, p) => a + p.overall, 0) / squad.length;
    if (best == null || avg > best) best = avg;
  }
  return best;
}

async function advanceFullSeason() {
  const total = useGameStore.getState().totalWeeks || 38;
  for (let w = 0; w < total + 8; w++) {
    const st = useGameStore.getState();
    if (st.week > total) break;
    await st.advanceWeek();
    useGameStore.getState().playCurrentMatch();
    // The whole audit below is ONE test running six full seasons. Without a
    // macrotask yield the loop never reaches the timer phase, and birpc's
    // hardcoded 60 s `onTaskUpdate` deadline expires inside it — which exits
    // the run 1 with every test green. See `helpers/eventLoop.ts`.
    await tick();
  }
  await useGameStore.getState().endSeason();
  await tick();
}

describe('audit 6.2 — the pyramid keeps its shape across seasons', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('no tier collapses, the pyramid stays ordered, and elite AI clubs stay elite', { timeout: 600_000 }, async () => {
    const initialTier: Record<string, number> = {};
    for (const id of ENG_TIERS) {
      const m = tierMean(id);
      expect(m, `${id} has clubs at init`).not.toBeNull();
      initialTier[id] = m!;
    }
    const initialElite = bestAiClubMean('eng');
    expect(initialElite).not.toBeNull();

    for (let s = 0; s < SEASONS; s++) await advanceFullSeason();

    // 1. No tier may fall out from under the world it was designed as.
    for (const id of ENG_TIERS) {
      const now = tierMean(id);
      expect(now, `${id} still has clubs`).not.toBeNull();
      expect(
        now!,
        `${id} collapsed: ${initialTier[id].toFixed(1)} -> ${now!.toFixed(1)}`,
      ).toBeGreaterThan(initialTier[id] - MAX_TIER_COLLAPSE);
    }

    // 2. The pyramid must still BE a pyramid — a higher tier is stronger.
    const means = ENG_TIERS.map(id => ({ id, mean: tierMean(id)! }));
    for (let i = 1; i < means.length; i++) {
      expect(
        means[i - 1].mean,
        `${means[i - 1].id} (${means[i - 1].mean.toFixed(1)}) must outrank ${means[i].id} (${means[i].mean.toFixed(1)})`,
      ).toBeGreaterThan(means[i].mean);
    }

    // 3. Stars must regenerate: the best AI side in the top flight cannot rot.
    const eliteNow = bestAiClubMean('eng');
    expect(eliteNow).not.toBeNull();
    expect(
      eliteNow!,
      `best AI club decayed: ${initialElite!.toFixed(1)} -> ${eliteNow!.toFixed(1)}`,
    ).toBeGreaterThan(initialElite! - MAX_ELITE_DECAY);
  });
});
