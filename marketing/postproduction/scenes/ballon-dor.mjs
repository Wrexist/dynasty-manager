/** Ballon d'Or night in a save: play the Aston Villa season out, then film
 *  the real 10→1 ceremony (BallonDorCeremony) — fast turns for 10–4, the
 *  podium, the drumroll and the winner's walkout. The winner is whoever the
 *  engine's season produced; our captions never name him (PLAYBOOK §4 —
 *  names stay out of our own copy; the card on screen is the game's). */
import { resume, startCareer, simWeeks, finishSeason, hideHints } from './lib.mjs';

export const profile = 'villa';

export async function setup(h) {
  if (!(await resume(h))) { await startCareer(h, 'aston-villa'); await simWeeks(h, 12); }
  const hasCeremony = await h.store((s) => (s.getState().seasonHistory || []).some(x => x.ballonDOrRanking?.length));
  if (!hasCeremony) console.log((await finishSeason(h)).length, 'matches to season end');
  await hideHints(h);
  // Film it as a first viewing: forget any "watched" flag on this device.
  await h.page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('dynasty-bdo-seen-')) localStorage.removeItem(k);
  });
  await h.go('#/game');
  await h.wait(2500);
  await h.screen('ballon-dor');
  await h.wait(2500);
}

export async function shoot(h) {
  // Walkout length, read from the same config the component uses, so the
  // score's drop lands on the flip even if the walkout is retuned.
  const walk = await h.page.evaluate(async () => {
    const { PACK_ANIM } = await import('/src/config/packs.ts');
    const { BALLON_DOR_CEREMONY } = await import('/src/config/ui.ts');
    const w = PACK_ANIM.walkout;
    return { toFlip: w.enterMs + w.clueMs * 3 + w.breathMs, rest: w.flipMs + w.holdMs, drum: BALLON_DOR_CEREMONY.drumrollMs };
  });

  await h.caption("WHO WINS THE BALLON D'OR|IN MY SAVE?", 'mid', { size: 32 });
  await h.wait(2200);
  await h.caption('', 'mid');
  await h.page.getByRole('button', { name: /Start the ceremony/ }).click();
  await h.wait(1600);
  await h.caption('GUESS BEFORE NO. 1 👇', 'low', { size: 30 });
  const stage = h.page.locator('[role="dialog"] [tabindex="0"]');
  await stage.click();                       // intro → No. 10
  await h.wait(900);
  await h.caption('', 'low');
  // 10 → 4: turn, a beat to read the card, next.
  for (let i = 0; i < 7; i++) {
    await stage.click(); h.mark('flips');
    await h.wait(i < 2 ? 1300 : 950);
    await stage.click();
    await h.wait(650);
  }
  // Podium: 3 and 2 get room to land.
  for (let i = 0; i < 2; i++) {
    await stage.click(); h.mark('flips');
    await h.wait(2300);
    await stage.click();
    await h.wait(750);
  }
  // No. 1 face-down → drumroll → walkout.
  await stage.click();
  h.mark('build');
  await h.wait(walk.drum + walk.toFlip);
  h.mark('drop');
  await h.wait(walk.rest + 1800);
  await h.caption('DID YOU CALL IT? 👇', 'low', { size: 32 });
  await h.wait(3000);
}
