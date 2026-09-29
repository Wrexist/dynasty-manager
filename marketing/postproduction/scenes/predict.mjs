/** Pilot: "I simulated <home> vs <away> 1,000 times in my game's engine."
 *  HOME_CLUB=<id> AWAY_CLUB=<id>. Runs the shipped engine (engine/match.ts) with each
 *  club's in-game XI, 1,000 times, and reports the split and the modal score.
 *  Squads are the game's, not this weekend's team news — the caption says so. */
import { startCareer, hideHints } from './lib.mjs';

export const profile = 'predict';
export const fresh = true;
const HOME = process.env.HOME_CLUB || 'arsenal';
const AWAY = process.env.AWAY_CLUB || 'tottenham-hotspur';
const N = 1000;
let r = null;

export async function setup(h) {
  await startCareer(h, HOME);
  r = await h.page.evaluate(async ([home, away, n]) => {
    const { useGameStore: s } = await import('/src/store/gameStore.ts');
    const { simulateMatch } = await import('/src/engine/match.ts');
    const st = s.getState();
    const H = st.clubs[home], A = st.clubs[away];
    const xi = c => (c.lineup?.length ? c.lineup : c.playerIds.slice(0, 11)).map(id => st.players[id]).filter(Boolean);
    const hp = xi(H), ap = xi(A);
    let hw = 0, d = 0, aw = 0; const scores = {};
    for (let i = 0; i < n; i++) {
      const m = simulateMatch({ id: `p${i}`, week: 1, homeClubId: home, awayClubId: away, played: false, homeGoals: 0, awayGoals: 0, events: [] }, H, A, hp, ap).result;
      const k = `${m.homeGoals}-${m.awayGoals}`;
      scores[k] = (scores[k] || 0) + 1;
      if (m.homeGoals > m.awayGoals) hw++; else if (m.homeGoals < m.awayGoals) aw++; else d++;
    }
    const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return { home: H.name, away: A.name, hShort: H.shortName || H.name, aShort: A.shortName || A.name, hw, d, aw, top: top[0], topN: top[1] };
  }, [HOME, AWAY, N]);
  console.log(JSON.stringify(r));
  await hideHints(h);
  await h.go('#/game'); await h.wait(2500);
  await h.store((s, _p, id) => s.setState({ selectedClubId: id }), AWAY);
}

export async function shoot(h) {
  const pct = x => `${Math.round((x / N) * 100)}%`;
  await h.caption(`I SIMULATED|${r.home.toUpperCase()} VS ${r.away.toUpperCase()}|1,000 TIMES`, 'top', { size: 30 });
  await h.screen('team-detail'); await h.wait(3000);
  await h.caption('IN MY GAME\'S MATCH ENGINE', 'top');
  await h.scroll(500, 2200);
  await h.screen('squad'); await h.wait(1600);
  h.mark('build');
  await h.wait(800);
  h.mark('drop');
  await h.caption(`${r.hShort.toUpperCase()} WIN: ${pct(r.hw)}|DRAW: ${pct(r.d)}|${r.aShort.toUpperCase()} WIN: ${pct(r.aw)}`, 'mid', { size: 34 });
  await h.wait(3200);
  await h.caption(`MOST LIKELY SCORE: ${r.top}|(${r.topN} OF 1,000)`, 'mid', { size: 32 });
  await h.wait(2800);
  await h.caption('GAME SQUADS, NOT TEAM NEWS.|IS MY ENGINE WRONG? 👇', 'mid', { size: 28 });
  await h.wait(3000);
}
