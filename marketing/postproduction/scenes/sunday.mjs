/** Sunday League series — one park-team save (Riverside Nomads, Pub FC).
 *  EP=1: week 1, who turns up on a Sunday morning, the match sheet.
 *  EP=2: the first story event the save throws up, and what we chose.
 *  EP=3: late season, the table and the match that decides it.
 *  Captions read the save; events and excuses are the game's own writing. */
import { simSundayWeeks, sundayFacts, hideHints } from './lib.mjs';

export const profile = 'sunday';
export const fresh = process.env.EP === '1';
const EP = Number(process.env.EP || 1);
const ord = n => `${n}${['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'}`;

async function standing(h) {
  return h.page.evaluate(async () => {
    const { useGameStore } = await import('/src/store/gameStore.ts');
    const { buildSundayTable, sundayPosition } = await import('/src/utils/sunday/season.ts');
    const st = useGameStore.getState();
    const t = buildSundayTable(st.fixtures, st.sunday.divisionClubIds);
    return { pos: sundayPosition(t, st.playerClubId), teams: t.length };
  });
}

/** Match Day → Sunday morning → Kick off → let the sheet play to full time. */
async function playMatchDay(h, capFn) {
  await h.screen('sunday-match'); await h.wait(1600);
  await h.page.getByRole('button', { name: /sunday morning/i }).first().tap();
  await h.wait(1800);
  const arrival = (await sundayFacts(h)).arrival;
  if (capFn) await capFn(arrival);
  await h.wait(2200);
  // A short side is offered ringers; playing short is the free option.
  const short = h.page.getByRole('button', { name: /play with \d|play short|go with|no ringers/i });
  if (await short.count()) { await short.first().tap().catch(() => {}); await h.wait(800); }
  await h.page.getByRole('button', { name: /kick off/i }).first().tap();
  h.mark('build');
  await h.caption('', 'top');
  for (let i = 0; i < 70; i++) {
    await h.wait(700);
    const more = h.page.getByRole('button', { name: /second half|back out|carry on|restart/i });
    if (await more.count()) { await more.first().tap().catch(() => {}); continue; }
    if (!(await h.page.getByText(/playing…|playing\.\.\./i).count()) && i > 4) break;
  }
  h.mark('drop');
  await h.scroll(900, 1600);
}

export async function setup(h) {
  if (EP === 1) {
    await h.store(async (s) => {
      await s.getState().startSundayLeague({ personality: 'pub', seed: 11 });
      s.setState({ activeSlot: 2 });
      s.getState().saveGame?.(2);
    });
  } else {
    await h.store((s) => { if (!s.getState().gameStarted) s.getState().loadGame(2); });
  }
  if (EP === 2) {
    // Advance until the save throws up a story (max 8 weeks).
    for (let i = 0; i < 8; i++) {
      if (await h.store((s) => !!s.getState().sunday.pendingEvent)) break;
      console.log((await simSundayWeeks(h, 1)).join('\n'));
    }
  }
  if (EP === 3) {
    const f = await sundayFacts(h);
    if (f.week < f.totalWeeks - 2) console.log((await simSundayWeeks(h, f.totalWeeks - 2 - f.week)).join('\n'));
    await h.store(async (s) => { const ev = s.getState().sunday.pendingEvent; if (ev) await s.getState().resolveSundayEvent(ev.choices[0].id); });
  }
  await h.store(async (s) => { await s.getState().autoPickSundayTeamsheet(); });
  await hideHints(h);
  await h.go('#/game');
  await h.wait(2500);
  await h.screen('sunday-hub');
  await h.wait(1500);
}

export async function shoot(h) {
  const f = await sundayFacts(h);
  if (EP === 1) {
    await h.caption(`SUNDAY LEAGUE · EP.1|${f.name.toUpperCase()}`, 'top', { size: 32 });
    await h.wait(2400);
    await h.scroll(560, 1800);
    await h.caption('THE EXCUSES ARE REAL', 'top');
    await h.wait(2600);
    await playMatchDay(h, async (arr) => {
      const n = arr?.presentIds?.length;
      await h.caption(n ? `SUNDAY MORNING:|${n} TURNED UP` : 'SUNDAY MORNING:|WHO TURNED UP?', 'top');
    });
    await h.caption("WHO'S THIS IN YOUR TEAM? 👇", 'top');
    await h.wait(2800);
  } else if (EP === 2) {
    const ev = await h.store((s) => {
      const e = s.getState().sunday.pendingEvent;
      return e ? { title: e.title, n: e.choices.length } : null;
    });
    await h.caption(`SUNDAY LEAGUE · EP.2|${(ev?.title || 'THIS WEEK').toUpperCase()}`, 'top', { size: 30 });
    await h.wait(4200);
    await h.caption('WHAT WOULD YOU DO? 👇', 'low');
    await h.wait(3600);
    // Take the last option — in this game it is usually the funniest one.
    const opts = h.page.locator('[role="dialog"] button').filter({ hasNotText: /^$/ });
    const count = await opts.count();
    if (count > 1) { await opts.nth(count - 1).tap().catch(() => {}); h.mark('drop'); }
    await h.caption('', 'low');
    await h.wait(3800);
    await h.caption('RIGHT CALL? 👇', 'top');
    await h.wait(2600);
  } else {
    const s0 = await standing(h);
    await h.screen('sunday-table'); await h.wait(1500);
    await h.caption(`SUNDAY LEAGUE · EP.3|${f.totalWeeks - f.week + 1} GAMES LEFT · ${s0.pos ? ord(s0.pos) : ''}`, 'top', { size: 30 });
    await h.wait(3000);
    await playMatchDay(h, async () => {
      await h.caption(s0.pos && s0.pos <= 3 ? 'PROMOTION DECIDER' : 'MUST-WIN', 'top');
    });
    const s1 = await standing(h);
    await h.caption(s1.pos ? `NOW ${ord(s1.pos)}.|WOULD YOU PLAY THE INJURED STRIKER? 👇` : 'WOULD YOU PLAY THE INJURED STRIKER? 👇', 'top');
    await h.wait(3000);
  }
}
