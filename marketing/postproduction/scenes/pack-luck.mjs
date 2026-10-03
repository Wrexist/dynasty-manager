/** Pack Luck series — the free daily streak pack on day DAY of a login streak.
 *  Real overlay, real generator, real streak band. Nothing is re-rolled: the
 *  first pull on camera is the one that ships, whatever it is.
 *    DAY=7 node capture-app.mjs scenes/pack-luck.mjs <dir>              */
import { startCareer, setStreakDay, hideHints } from './lib.mjs';

export const profile = 'luck';
export const fresh = true;
const DAY = Number(process.env.DAY || 1);
const FLOOR = DAY >= 7 ? 75 : DAY >= 5 ? 72 : DAY >= 3 ? 69 : 66;

export async function setup(h) {
  await startCareer(h, process.env.CLUB || 'newcastle-united');
  await setStreakDay(h, DAY);
  await h.store((s) => { if (!s.getState().gameStarted) s.getState().loadGame(1); });
  await hideHints(h);
  await h.go('#/game');
  await h.wait(2500);
  // Clear the daily-reward and digest popups a player would tap away first.
  for (let i = 0; i < 4; i++) {
    const b = h.page.getByRole('button', { name: /^(continue|close|got it|later|not now|claim.*)$/i }).first();
    if (!(await b.count())) break;
    await b.tap().catch(() => {}); await h.wait(1000);
  }
  await h.screen('packs');
  await h.wait(2500);
}

export async function shoot(h) {
  await h.caption(`PACK LUCK · DAY ${DAY}`, 'top', { size: 34 });
  await h.wait(1400);
  await h.caption(`PACK LUCK · DAY ${DAY}|FREE PACK · ${FLOOR}+ GUARANTEED`, 'top', { size: 30 });
  await h.wait(1300);
  await h.page.locator('button', { hasText: /free\s*(66|69|72|75)\+/i }).first().tap();
  h.mark('flips');
  await h.caption('', 'top');
  await h.wait(1500);
  for (let i = 0; i < 10; i++) {
    if (await h.page.getByText(/tap all to reveal/i).count()) break;
    await h.tap(195, 345); await h.wait(600);
  }
  await h.wait(600);
  h.mark('build');
  await h.page.getByText(/tap all to reveal/i).tap().catch(() => {});
  await h.wait(900);
  h.mark('drop');
  // Hold on the summary, then the question.
  const best = await h.store((s) => {
    const recs = s.getState().openedPacks || [];
    return recs.length ? recs[0].topOvr : null;
  });
  await h.wait(2200);
  await h.caption(best ? `BEST PULL: ${best}|${process.env.Q || 'GUESS TOMORROW\'S 👇'}` : (process.env.Q || 'GUESS TOMORROW\'S 👇'), 'low', { size: 30 });
  await h.wait(3200);
}
