#!/usr/bin/env node
/**
 * Finish a silent take: append the brand end card and lay the owned score.
 * Writes two files, one per CTA, so the Android launch needs no re-render:
 *
 *   <out>-ios.mp4       "Free on iPhone"            (post now)
 *   <out>-android.mp4   "Free on iPhone & Android"  (post after the Play launch)
 *
 *   node marketing/postproduction/finish-video.mjs <take.mp4> <out> <style> <cue> [dropSec]
 *
 * style: anthem | phonk | cinematic | preview   (score-ad.py)
 * cue:   a CUES name in score-ad.py (pack5, icon) or inline JSON with at least
 *        {"build": s, "drop": s}; capture-app takes pass their marks.json.
 * The score is synthesised (score-ad.py) — no sample or music licence to clear.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const [TAKE, OUT, STYLE = 'anthem', CUE = 'pack5', DROP] = process.argv.slice(2);
if (!TAKE || !OUT) { console.error('usage: finish-video.mjs <take.mp4> <out> <style> <cue> [dropSec]'); process.exit(1); }
const HERE = dirname(fileURLToPath(import.meta.url));
const FF = process.env.FFMPEG || join(process.cwd(), '.cache', 'ffmpeg');
const CARD_SEC = 2.2;
const tmp = join(process.cwd(), '.cache', 'finish');
mkdirSync(tmp, { recursive: true });
mkdirSync(dirname(OUT), { recursive: true });

function duration(file) {
  let err = '';
  try { execFileSync(FF, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] }); }
  catch (e) { err = String(e.stderr); }
  const m = err.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!m) throw new Error(`no duration for ${file}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

// End cards are rendered once and cached.
const cards = { ios: join(tmp, 'endcard-ios.png'), all: join(tmp, 'endcard-all.png') };
if (!existsSync(cards.ios) || !existsSync(cards.all)) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const v of ['ios', 'all']) {
    await p.goto(`${pathToFileURL(join(HERE, 'endcard.html')).href}?v=${v}`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: cards[v] });
  }
  await b.close();
}

const takeDur = duration(TAKE);
const total = takeDur + CARD_SEC;
const wav = join(tmp, 'score.wav');
const cueArg = CUE.startsWith('{')
  ? JSON.stringify({ cta: takeDur + 0.15, ...JSON.parse(CUE) })
  : CUE;
const scoreArgs = [join(HERE, 'score-ad.py'), STYLE, cueArg, total.toFixed(2), wav];
if (DROP) scoreArgs.push(DROP);
execFileSync('python3', scoreArgs, { stdio: 'inherit' });

for (const [variant, suffix] of [['ios', 'ios'], ['all', 'android']]) {
  const out = `${OUT}-${suffix}.mp4`;
  execFileSync(FF, [
    '-y', '-loglevel', 'error',
    '-i', TAKE,
    '-loop', '1', '-framerate', '60', '-t', String(CARD_SEC), '-i', cards[variant],
    '-i', wav,
    '-filter_complex',
    // The card fades in over the last take frames' hold so the cut is not a slam.
    '[1:v]scale=1080:1920,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.25[c];'
    + '[0:v]setsar=1,format=yuv420p[t];[t][c]concat=n=2:v=1:a=0[v];'
    + '[2:a]loudnorm=I=-14:TP=-1:LRA=9,aresample=48000,aformat=channel_layouts=stereo[a]',
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '19', '-r', '60',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out,
  ]);
  console.log('->', out, `${total.toFixed(1)}s`);
}
