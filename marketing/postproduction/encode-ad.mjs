/**
 * Resample a dilated capture onto an exact 60fps timeline and encode a
 * vertical 1080x1920 WebM for TikTok / Shorts.
 *
 * The capture rig records the page running at 1/SLOW speed, so its
 * page-time timeline holds far more than 60 rendered frames per second. Each
 * 1/60s slot picks the frame that was actually on screen at that instant —
 * real rendered frames throughout, no duplication and no interpolation.
 */
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
const [DIR, OUT, startArg, endArg] = process.argv.slice(2);
const FPS = 60;
const FFMPEG = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const times = JSON.parse(readFileSync(`${DIR}/times.json`, 'utf8'));
const START = Number(startArg || 0);
const END = Number(endArg || times[times.length - 1]);

const order = [];
let src = 0;
for (let i = 0; i < Math.floor((END - START) * FPS); i++) {
  const t = START + i / FPS;
  while (src + 1 < times.length && times[src + 1] <= t) src++;
  order.push(src);
}
console.log(`${times.length} rendered frames -> ${order.length} @ ${FPS}fps  (${START}s..${END}s)`);

// 780x1688 is 9:19.5. TikTok/Shorts want 9:16, so scale to width 1080 and
// crop the excess height around the centre of the action rather than
// letterboxing — a padded ad reads as a screenshot, not as native content.
const ff = spawn(FFMPEG, [
  '-y', '-framerate', String(FPS), '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', 'pipe:0',
  '-vf', 'scale=1080:-2:flags=lanczos,crop=1080:1920:0:(ih-1920)/2',
  '-c:v', 'libvpx', '-b:v', '6M', '-crf', '14', '-qmin', '2', '-qmax', '32',
  '-deadline', 'good', '-cpu-used', '2', '-auto-alt-ref', '0',
  '-r', String(FPS), OUT,
], { stdio: ['pipe', 'ignore', 'ignore'] });

for (const idx of order) ff.stdin.write(readFileSync(`${DIR}/f${String(idx).padStart(5, '0')}.jpg`));
ff.stdin.end();
ff.on('close', c => console.log('ffmpeg exit', c, '->', OUT));
