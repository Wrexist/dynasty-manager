/** Ballon d'Or night in a save: play the Aston Villa season out, then open
 *  the ceremony. The winner is whoever the engine's season produced; the
 *  caption never names him (PLAYBOOK §4 — names stay out of our own copy). */
import { resume, startCareer, simWeeks, finishSeason, hideHints } from './lib.mjs';

export const profile = 'villa';

export async function setup(h) {
  if (!(await resume(h))) { await startCareer(h, 'aston-villa'); await simWeeks(h, 12); }
  const hasCeremony = await h.store((s) => (s.getState().seasonHistory || []).length > 0);
  if (!hasCeremony) console.log((await finishSeason(h)).length, 'matches to season end');
  await hideHints(h);
  await h.go('#/game');
  await h.wait(2500);
  await h.screen('dashboard');
  await h.wait(1000);
}

export async function shoot(h) {
  await h.caption("WHO WINS THE BALLON D'OR|IN MY SAVE?", 'top', { size: 34 });
  await h.wait(1200);
  await h.screen('ballon-dor');
  await h.wait(2400);
  await h.caption('GUESS BEFORE THE END 👇', 'top');
  // Walk the top 10 from the bottom of the list up to the winner.
  const total = await h.page.evaluate(() => {
    const els = [document.scrollingElement, ...document.querySelectorAll('main, .overflow-y-auto')];
    return Math.max(...els.filter(Boolean).map(e => e.scrollHeight - e.clientHeight));
  });
  await h.scroll(Math.min(total, 1800), 3500);
  await h.wait(600);
  await h.scroll(-Math.min(total, 1800), 4200);
  h.mark('build');
  await h.wait(900);
  h.mark('drop');
  await h.caption('DID YOU CALL IT? 👇', 'low');
  await h.wait(3200);
}
