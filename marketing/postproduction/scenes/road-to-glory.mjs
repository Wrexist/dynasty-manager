/** Road to Glory — one Doncaster save (smallest budget in the 4th tier),
 *  filmed an episode at a time. EP=1..7. Every caption is read from the save,
 *  so the series says what the engine actually did — including a bad run.
 *
 *    EP=3 node capture-app.mjs scenes/road-to-glory.mjs <dir>              */
import { resume, startCareer, simWeeks, hideHints, kickOff, finishSeason, clearInternationalBreak } from './lib.mjs';

// PROFILE/FRESH re-film one episode from its own save when the shared one has
// moved past it (the caption still reads that save, so it stays true).
export const profile = process.env.PROFILE || 'road';
export const fresh = process.env.EP === '1' || !!process.env.FRESH;
const EP = Number(process.env.EP || 1);
const CLUB = 'doncaster';
/** Week each episode is filmed at (season 1 is 46 weeks in the 4th tier). */
const WEEK = { 1: 1, 2: 1, 3: 13, 4: 21, 5: 31, 6: 46, 7: null };

const ord = n => `${n}${['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'}`;
const money = n => (n >= 1e6 ? `£${(n / 1e6).toFixed(1)}M` : `£${Math.round(n / 1e3)}K`);

async function facts(h) {
  return h.store((s) => {
    const st = s.getState();
    const me = st.playerClubId;
    const club = st.clubs[me];
    const squad = club.playerIds.map(id => st.players[id]).filter(Boolean);
    const avg = Math.round(squad.reduce((a, p) => a + p.overall, 0) / Math.max(1, squad.length));
    const table = st.leagueTable || [];
    const idx = table.findIndex(r => r.clubId === me);
    const row = table[idx] || {};
    const cupTies = (st.cup?.ties || []).filter(t => t.played && (t.homeClubId === me || t.awayClubId === me));
    return {
      name: club.name, budget: club.budget, avg, squadSize: squad.length, week: st.week, season: st.season,
      totalWeeks: st.totalWeeks, pos: idx + 1, teams: table.length, row, leagueId: club.divisionId,
      cupEliminated: !!st.cup?.eliminated, cupWinner: st.cup?.winner === me, cupRounds: cupTies.length,
      cupRound: st.cup?.currentRound,
    };
  });
}

async function clearPopups(h) {
  for (let i = 0; i < 6; i++) {
    const b = h.page.getByRole('button', { name: /^(continue|close|got it|later|not now|claim.*|done|ok)$/i }).first();
    if (!(await b.count())) break;
    await b.tap().catch(() => {}); await h.wait(900);
  }
}

async function simTo(h, week) {
  const f = await facts(h);
  if (week && f.week < week) {
    const log = await simWeeks(h, week - f.week);
    console.log(log.join('\n'));
  }
}

export async function setup(h) {
  if (EP === 1 || !(await resume(h))) await startCareer(h, CLUB);
  await resume(h);
  if (EP === 2) {
    // Sign the best free agent the budget can carry — on camera the squad
    // screen shows him arriving. Real market, real wage demand.
    const signed = await h.store((s) => {
      const st = s.getState();
      const club = st.clubs[st.playerClubId];
      const pool = (st.freeAgents || []).map(id => st.players[id]).filter(Boolean)
        .filter(p => p.age <= 31).sort((a, b) => b.overall - a.overall);
      // Best first; the signing bonus rules most of them out on this budget.
      for (const p of pool) {
        for (const k of [1, 1.2]) {
          const r = s.getState().signFreeAgent(p.id, Math.round((p.wage || 5000) * k), 2);
          if (r?.success) return { ovr: p.overall, pos: p.position, age: p.age };
        }
      }
      return null;
    });
    console.log('signed', JSON.stringify(signed));
    process.env.__SIGNED = JSON.stringify(signed);
  }
  if (EP === 7) {
    // Play out the season (and any play-off), then the season rollover.
    if ((await facts(h)).season === 1) console.log((await finishSeason(h)).join(' '));
    await clearInternationalBreak(h);
  } else {
    await simTo(h, WEEK[EP] && EP !== 4 && EP !== 6 ? WEEK[EP] : WEEK[EP] - 1);
  }
  await hideHints(h);
  await h.go('#/game');
  await h.wait(2500);
  await clearPopups(h);
  // A new season can open on the national-squad picker; the episode starts home.
  await h.screen('dashboard');
  await h.wait(1200);
}

export async function shoot(h) {
  const f = await facts(h);
  const cap = (t, pos = 'top', o) => h.caption(t, pos, o);
  if (EP === 1) {
    await cap(`ROAD TO GLORY · EP.1|4TH TIER. NO MONEY.`, 'top', { size: 32 });
    await h.wait(2600);
    await cap(`BUDGET: ${money(f.budget)}|SQUAD AVERAGE: ${f.avg} OVR`, 'mid');
    await h.wait(2600);
    await h.screen('squad'); await h.wait(600);
    await cap(`${f.squadSize} PLAYERS.|NOBODY YOU'VE HEARD OF.`, 'low');
    await h.scroll(700, 2600);
    await h.screen('league-table'); await h.wait(600);
    await cap('THE GOAL: THE TOP FLIGHT', 'mid');
    await h.wait(2400);
    await cap('HOW MANY SEASONS WILL IT TAKE? 👇', 'mid');
    await h.wait(2600);
  } else if (EP === 2) {
    const signed = JSON.parse(process.env.__SIGNED || 'null');
    await cap(`EP.2|FIRST WINDOW. ${money(f.budget)} TO SPEND.`, 'top', { size: 32 });
    await h.screen('transfers'); await h.wait(2400);
    await h.page.getByRole('button', { name: /free agents/i }).first().tap().catch(() => {});
    await cap('SO: FREE AGENTS ONLY', 'mid');
    await h.scroll(600, 2800);
    await h.screen('squad'); await h.wait(600);
    await cap(!signed ? 'NOBODY WOULD SIGN.|NOT EVEN FOR FREE.'
      : signed.ovr < f.avg ? `THE ONLY ONE WE COULD AFFORD:|${signed.pos} · ${signed.ovr} OVR · AGE ${signed.age}`
        : `SIGNED: ${signed.pos} · ${signed.ovr} OVR · AGE ${signed.age}|TRANSFER FEE: £0`, 'mid');
    await h.wait(3200);
    await cap('LOAN OR FREE AGENT NEXT? 👇', 'mid');
    await h.wait(2600);
  } else if (EP === 3) {
    const r = f.row;
    await cap(`EP.3|${f.week - 1} GAMES IN`, 'top', { size: 32 });
    await h.screen('league-table'); await h.wait(1800);
    await cap(`${ord(f.pos)} OF ${f.teams}|${r.won}W ${r.drawn}D ${r.lost}L · ${r.points} PTS`, 'mid');
    await h.wait(3000);
    await h.scroll(Math.max(0, (f.pos - 6) * 40), 1400);
    await cap(f.pos <= 3 ? 'TOP OF THE TABLE?|NOT YET. BUT CLOSE.' : f.pos <= 7 ? 'PLAY-OFF PLACES.|FOR NOW.' : 'NOT THE START WE WANTED.', 'mid');
    await h.wait(2600);
    await cap('PREDICT WHERE WE FINISH 👇', 'mid');
    await h.wait(2600);
  } else if (EP === 4 || EP === 6) {
    const opp = await h.store((s) => {
      const st = s.getState();
      const me = st.playerClubId;
      const mine = m => !m.played && m.week === st.week && (m.homeClubId === me || m.awayClubId === me);
      const fx = (st.fixtures || []).find(mine) || (st.cup?.ties || []).find(mine) || (st.leagueCup?.ties || []).find(mine);
      if (!fx) return null;
      const id = fx.homeClubId === me ? fx.awayClubId : fx.homeClubId;
      const idx = (st.leagueTable || []).findIndex(r => r.clubId === id);
      return { name: st.clubs[id]?.shortName || st.clubs[id]?.name, pos: idx + 1 };
    });
    await cap(EP === 4
      ? `EP.4 · BIGGEST GAME YET|${ord(f.pos)} VS ${opp ? ord(opp.pos) : '?'}`
      : `EP.6 · FINAL DAY|WE'RE ${ord(f.pos)}`, 'top', { size: 30 });
    await h.wait(2200);
    await cap('', 'top');
    await kickOff(h, /^fast$/i);
    await h.wait(1200);
    // The in-match 2x (free) keeps a half inside ~30s of video.
    await h.page.getByRole('button', { name: /^2x$/i }).first().tap().catch(() => {});
    h.mark('build');
    let skipped = false;
    for (let i = 0; i < 80; i++) {
      await h.wait(900);
      const second = h.page.getByRole('button', { name: /start 2nd half/i });
      // DOM clicks throughout: these controls sit under the bottom nav at
      // this viewport, where a tap waits out its timeout and never lands.
      if (await second.count()) { await second.first().evaluate(b => b.click()).catch(() => {}); continue; }
      // Key Moment prompts pause the match until the manager answers
      // (labels from config/keyMoments.ts).
      const moment = h.page.getByRole('button', { name: /^(go aggressive|stay composed|shore up|park the bus|stay brave|reduce pressure|go for the win|protect the point|keep pushing|stay patient|go direct|drop deep|hold firm)/i });
      if (await moment.count()) { await moment.first().evaluate(b => b.click()).catch(() => {}); await h.wait(500); continue; }
      const txt = await h.page.evaluate(() => document.body.innerText);
      const min = +((txt.match(/(\d+)'/) || [])[1] || 0);
      if (!skipped && min >= 46) {
        const skip = h.page.getByRole('button', { name: /skip to ft/i });
        if (await skip.count()) { await skip.first().evaluate(b => b.click()).catch(() => {}); skipped = true; h.mark('drop'); }
      }
      if (/full time|full-time/i.test(txt) || (skipped && i > 2 && !/(\d+)'/.test(txt))) break;
    }
    await h.wait(1500);
    const res = await h.store((s) => {
      const st = s.getState();
      const me = st.playerClubId;
      const m = [...(st.fixtures || [])].reverse().find(x => x.played && (x.homeClubId === me || x.awayClubId === me));
      if (!m) return null;
      const home = m.homeClubId === me;
      return { gf: home ? m.homeGoals : m.awayGoals, ga: home ? m.awayGoals : m.homeGoals };
    });
    const verdict = !res ? '' : res.gf > res.ga ? 'WON' : res.gf < res.ga ? 'LOST' : 'DREW';
    await cap(res ? `${verdict} ${res.gf}-${res.ga}` : 'FULL TIME', 'mid', { size: 40 });
    await h.wait(2600);
    await cap(EP === 4 ? 'WORST RESULT YOU\'VE HAD IN A SAVE? 👇' : 'PROMOTED OR NOT? FIND OUT NEXT 👇', 'mid');
    await h.wait(2600);
  } else if (EP === 5) {
    await cap('EP.5 · THE CUP', 'top', { size: 32 });
    await h.screen('cup'); await h.wait(2000);
    const line = f.cupWinner ? 'WE WON IT. 4TH TIER.'
      : f.cupEliminated ? `OUT AFTER ${f.cupRounds} ${f.cupRounds === 1 ? 'TIE' : 'TIES'}.|HONEST.`
        : `STILL IN IT. ${String(f.cupRound || '').toUpperCase()} NEXT.`;
    await cap(line, 'mid');
    await h.scroll(500, 2600);
    await h.screen('league-table'); await h.wait(600);
    await cap(`LEAGUE: ${ord(f.pos)} WITH ${f.totalWeeks - f.week + 1} TO GO`, 'mid');
    await h.wait(2600);
    await cap('HOW FAR WOULD YOU GO? 👇', 'mid');
    await h.wait(2400);
  } else if (EP === 7) {
    const last = await h.store((s) => {
      const hist = s.getState().seasonHistory || [];
      return hist[hist.length - 1] || null;
    });
    await cap('EP.7 · NEW SEASON', 'top', { size: 32 });
    await h.wait(1800);
    await h.screen('league-table'); await h.wait(1600);
    const league = await h.store((s) => {
      const st = s.getState();
      return st.clubs[st.playerClubId].divisionId;
    });
    const moved = league !== 'eng-4';
    await cap(moved ? 'NEW LEAGUE.|WE WENT UP.' : `SAME LEAGUE.|${last?.position ? `FINISHED ${ord(last.position)}.` : 'NOT THIS TIME.'}`, 'mid');
    await h.wait(3000);
    await h.screen('transfers'); await h.wait(800);
    await cap(`BUDGET NOW: ${money((await facts(h)).budget)}`, 'mid');
    await h.wait(2600);
    await cap('WHO DO WE SIGN FIRST? 👇', 'mid');
    await h.wait(2600);
  }
  if (!(await h.page.evaluate(() => 1))) return;
}
