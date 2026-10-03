/** Raw app captures for the Google Play phone screenshots.
 *  Output: marketing/play/graphics/raw/*.png, framed by render-graphics.mjs.
 *  Profile `villa`: an Aston Villa save simmed 12 weeks by lib.simWeeks. */
import { resume, startCareer, simWeeks, hideHints, kickOff } from './lib.mjs';

export const profile = 'villa';
const RAW = 'marketing/play/graphics/raw';

export async function setup(h) {
  if (!(await resume(h))) {
    await startCareer(h, 'aston-villa');
    await simWeeks(h, 12);
  }
  await hideHints(h);
  await h.go('#/game');
  await h.wait(3000);
  // Clear post-advance popups (weekly digest etc.) — a player taps these away.
  for (let i = 0; i < 4; i++) {
    const btn = h.page.getByRole('button', { name: /^(continue|close|got it|dismiss|later|not now|claim.*)$/i }).first();
    if (!(await btn.count())) break;
    await btn.tap().catch(() => {}); await h.wait(1200);
  }
  await h.page.evaluate(() => document.querySelectorAll('*').forEach(el => { if (el.scrollTop) el.scrollTop = 0; }));
  await h.wait(800);
  await h.still(`${RAW}/dashboard.png`);
  if (process.env.ONLY_DASH) return;
  await h.screen('league-table'); await h.wait(2500);
  await h.still(`${RAW}/table.png`);
  await h.screen('tactics'); await h.wait(2500);
  await h.still(`${RAW}/tactics.png`);
  await h.screen('transfers'); await h.wait(2500);
  await h.still(`${RAW}/transfers.png`);
  await kickOff(h);
  await h.wait(1500);
  await h.page.getByRole('button', { name: /^pitch$/i }).first().tap().catch(() => {});
  // Hold until there is a goal on the board (or 70'), so the shot has a story.
  for (let i = 0; i < 60; i++) {
    await h.wait(1500);
    const second = h.page.getByRole('button', { name: /start 2nd half/i });
    if (await second.count()) { await second.first().tap().catch(() => {}); continue; }
    const txt = await h.page.evaluate(() => document.body.innerText);
    const sc = txt.match(/(\d+)\s*-\s*(\d+)/);
    const min = +((txt.match(/(\d+)'/) || [])[1] || 0);
    if ((sc && +sc[1] + +sc[2] > 0 && min > 55) || min >= 80) break;
  }
  await h.still(`${RAW}/match.png`);
}
