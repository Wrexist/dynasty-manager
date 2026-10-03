/** Pilot: "Can <club> win the league in 5 seasons?" CLUB=<id>. Five seasons
 *  are simmed by the engine (the manager auto-picks, no transfers forced),
 *  then the take walks through what happened. Real club names appear only
 *  because the club is in the game; no crest in a thumbnail. */
import { startCareer, simWeeks, finishSeason, hideHints, clearInternationalBreak } from './lib.mjs';

const CLUB = process.env.CLUB || 'wrexham';
export const profile = `five-${CLUB}`;
export const fresh = !process.env.KEEP;
const ord = n => `${n}${['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'}`;
let story = [];
let clubName = CLUB;

export async function setup(h) {
  await startCareer(h, CLUB);
  const start = await h.store((s) => { const st = s.getState(); const c = st.clubs[st.playerClubId]; return { name: c.name, div: c.divisionId }; });
  clubName = start.name;
  for (let season = 1; season <= Number(process.env.SEASONS || 5); season++) {
    await clearInternationalBreak(h);
    const before = await h.store((s) => { const st = s.getState(); return { div: st.clubs[st.playerClubId].divisionId, weeks: st.totalWeeks, week: st.week, season: st.season }; });
    await simWeeks(h, Math.max(0, before.weeks - before.week + 1));
    await finishSeason(h);
    const after = await h.page.evaluate(async ([div, season]) => {
      const { useGameStore: s } = await import('/src/store/gameStore.ts');
      const { LEAGUES } = await import('/src/data/league.ts');
      const st = s.getState();
      const hist = st.seasonHistory.find(x => x.season === season);
      const lg = id => LEAGUES.find(l => l.id === id);
      const nowDiv = st.clubs[st.playerClubId].divisionId;
      return { pos: hist?.position, pts: hist?.points, tier: lg(div)?.tier, moved: nowDiv !== div ? (lg(nowDiv)?.tier < lg(div)?.tier ? 'up' : 'down') : null, sacked: hist?.boardVerdict === 'sacked' };
    }, [before.div, before.season]);
    story.push(after);
    console.log('season', season, JSON.stringify(after));
    if (after.sacked) break;
  }
  process.env.__STORY = JSON.stringify(story);
  await hideHints(h);
  await h.go('#/game'); await h.wait(2500);
  await h.screen('dashboard'); await h.wait(1000);
}

export async function shoot(h) {
  story = JSON.parse(process.env.__STORY || '[]');
  const name = clubName.toUpperCase();
  await h.caption(`CAN ${name} WIN THE|TOP FLIGHT IN 5 SEASONS?`, 'top', { size: 32 });
  await h.wait(2600);
  await h.screen('trophy-cabinet'); await h.wait(800);
  const lines = [];
  for (let i = 0; i < story.length; i++) {
    const s = story[i];
    const tag = s.sacked ? ' · SACKED' : s.moved === 'up' ? ' · UP ⬆' : s.moved === 'down' ? ' · DOWN ⬇' : '';
    lines.push(`S${i + 1}: TIER ${s.tier} · ${ord(s.pos)}${tag}`);
    await h.caption(lines.join('|'), 'mid', { size: 26 });
    h.mark('flips');
    await h.wait(1500);
  }
  const won = story.findIndex(s => s.tier === 1 && s.pos === 1);
  h.mark('build');
  await h.wait(700);
  h.mark('drop');
  await h.caption(won >= 0 ? `CHAMPIONS IN SEASON ${won + 1}.` : `NO. ${story.some(s => s.tier === 1) ? 'BUT WE GOT THERE.' : 'NOT EVEN CLOSE.'}`, 'top', { size: 36 });
  await h.wait(2600);
  await h.caption('WHICH CLUB NEXT? 👇', 'top', { size: 36 });
  await h.wait(2600);
}
