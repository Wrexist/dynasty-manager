import { resume, kickOff, captureAsPro } from './lib.mjs';
export const profile = 'road-test';
export async function setup(h) {
  await resume(h);
  await captureAsPro(h);
  console.log('pro', await h.store((s) => s.getState().monetization.entitlements));
  await h.go('#/game'); await h.wait(2500);
  await kickOff(h, /^fast$/i);
  await h.wait(6000);
  await h.still('/tmp/claude-0/shots/sk.png');
  console.log(JSON.stringify((await h.page.locator('button').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean)));
}
