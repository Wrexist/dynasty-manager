#!/usr/bin/env node
/**
 * Render videos from marketing/content/videos.mjs.
 *
 *   node marketing/postproduction/render-calendar.mjs [idFilter...] [--force]
 *
 * Needs the dev server (`npm run dev -- --host 127.0.0.1`, port 8080) and an
 * H.264 ffmpeg (`npm run ads:ffmpeg`) and numpy+scipy for the score.
 * Output: marketing/content/videos/<id>-ios.mp4 and <id>-android.mp4
 * (gitignored — regenerate, don't commit 15 MB files).
 *
 * Entries render in list order, so Road to Glory episodes advance one save in
 * sequence. Rendering EP3 alone continues from wherever the save is.
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { VIDEOS } from '../content/videos.mjs';

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const filters = args.filter(a => !a.startsWith('--'));
const OUT = join(process.cwd(), 'marketing', 'content', 'videos');
const WORK = join(process.cwd(), '.cache', 'takes');
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });
const PP = join(process.cwd(), 'marketing', 'postproduction');
const APP = process.env.APP_URL || 'http://127.0.0.1:8080';

const run = (cmd, argv, env = {}) => execFileSync(cmd, argv, {
  stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, ...env },
});

const todo = VIDEOS.filter(v => !filters.length || filters.some(f => v.id.includes(f)));
for (const v of todo) {
  const base = join(OUT, v.id);
  if (!FORCE && existsSync(`${base}-ios.mp4`)) { console.log('skip', v.id); continue; }
  console.log(`\n=== ${v.id} ===`);
  const dir = join(WORK, v.id);
  rmSync(dir, { recursive: true, force: true });
  const take = `${dir}.mp4`;
  try {
    if (v.kind === 'ad') {
      const url = `${APP}/capture.html?${new URLSearchParams({ realOnly: '1', ...v.params })}`;
      run('node', [join(PP, 'capture-ad.mjs'), dir, url, '4', v.plan], v.env || {});
      run('node', [join(PP, 'encode-ad.mjs'), dir, take, String(v.trim[0]), String(v.trim[1])]);
      waitForFile(take);
      run('node', [join(PP, 'finish-video.mjs'), take, base, v.style, v.cue]);
    } else {
      run('node', [join(PP, 'capture-app.mjs'), join(PP, 'scenes', v.scene), dir], { SLOW: '4', ...v.env });
      run('node', [join(PP, 'encode-ad.mjs'), dir, take]);
      waitForFile(take);
      const marks = existsSync(join(dir, 'marks.json')) ? JSON.parse(readFileSync(join(dir, 'marks.json'), 'utf8')) : {};
      const drop = marks.drop?.[0] ?? 1.2;
      const build = marks.build?.[0] ?? Math.max(0.2, drop - 1);
      const cue = JSON.stringify({ flips: marks.flips || [], build: Math.min(build, drop - 0.2), drop, whoosh: marks.whoosh || [] });
      run('node', [join(PP, 'finish-video.mjs'), take, base, v.style, cue]);
    }
  } catch (e) {
    console.error(`FAILED ${v.id}: ${String(e.message).split('\n')[0]}`);
  }
}

/** encode-ad.mjs returns before ffmpeg has flushed the moov atom. */
function waitForFile(file) {
  for (let i = 0; i < 120; i++) {
    try {
      execFileSync(join(process.cwd(), '.cache', 'ffmpeg'), ['-v', 'error', '-i', file, '-f', 'null', '-t', '0.1', '-'], { stdio: 'ignore' });
      return;
    } catch { execFileSync('sleep', ['1']); }
  }
  throw new Error(`take never finished: ${file}`);
}
