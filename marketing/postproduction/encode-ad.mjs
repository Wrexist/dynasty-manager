/**
 * Resample a dilated capture onto an exact 60fps timeline and encode a
 * vertical 1080x1920 ad.
 *
 * The capture rig records the page running at 1/SLOW speed, so its page-time
 * timeline holds far more than 60 rendered frames per second. Each 1/60s slot
 * picks the frame that was actually on screen at that instant — real rendered
 * frames throughout, no duplication and no interpolation.
 *
 * Container is decided by what the available ffmpeg can do, NOT by preference:
 * TikTok's uploader accepts MP4/MOV/MPEG/3GP/AVI and rejects WebM, so a WebM
 * deliverable is unusable for the channel this kit targets. The bundled
 * Playwright ffmpeg is a stripped build with no libx264, which is how the
 * first cut of these ads shipped in a format that could not be uploaded.
 * `resolveFfmpeg` therefore prefers any build that can encode H.264 and only
 * falls back to VP8/WebM with a loud warning.
 */
import { readFileSync, existsSync } from 'fs';
import { spawn, execFileSync } from 'child_process';
import { join } from 'path';

const [DIR, OUT_ARG, startArg, endArg] = process.argv.slice(2);
const FPS = 60;

/** ffmpeg builds to try, best first. `FFMPEG` overrides everything. */
function candidateBinaries() {
  const out = [];
  if (process.env.FFMPEG) out.push(process.env.FFMPEG);
  out.push(join(process.cwd(), '.cache', 'ffmpeg'));           // npm run ads:ffmpeg
  out.push(join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'));
  out.push('ffmpeg');                                           // system, on PATH
  out.push('/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux');        // Playwright's, VP8 only
  return out;
}

function encoders(bin) {
  try {
    return execFileSync(bin, ['-hide_banner', '-encoders'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function resolveFfmpeg() {
  let fallback = null;
  for (const bin of candidateBinaries()) {
    if (bin.includes('/') && !existsSync(bin)) continue;
    const list = encoders(bin);
    if (list === null) continue;
    if (/\blibx264\b/.test(list)) return { bin, h264: true };
    if (!fallback && /\blibvpx\b/.test(list)) fallback = { bin, h264: false };
  }
  return fallback;
}

const ff = resolveFfmpeg();
if (!ff) {
  console.error('No usable ffmpeg found. Set FFMPEG=/path/to/ffmpeg, or run: npm run ads:ffmpeg');
  process.exit(1);
}
if (!ff.h264) {
  console.warn(
    'WARNING: this ffmpeg cannot encode H.264, so the output will be VP8 WebM.\n'
    + '         YouTube Shorts accepts WebM; TikTok does NOT — it will refuse the upload.\n'
    + '         Run `npm run ads:ffmpeg` to fetch a build with libx264, then re-encode.',
  );
}

// Honour an explicit extension, otherwise name the file after what we can
// actually produce — a .mp4 containing VP8 would be a lie to the uploader.
const OUT = /\.(mp4|webm)$/.test(OUT_ARG)
  ? OUT_ARG
  : `${OUT_ARG}.${ff.h264 ? 'mp4' : 'webm'}`;

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
console.log(`${times.length} rendered frames -> ${order.length} @ ${FPS}fps  (${START}s..${END}s)`
  + `  [${ff.h264 ? 'H.264 mp4' : 'VP8 webm'}]`);

// 780x1688 is 9:19.5. TikTok/Shorts want 9:16, so scale to width 1080 and crop
// the excess height around the centre of the action rather than letterboxing —
// a padded ad reads as a screenshot, not as native content. `setsar=1` because
// scale-then-crop leaves a non-square SAR that some uploaders mishandle.
const VF = 'scale=1080:-2:flags=lanczos,crop=1080:1920:0:(ih-1920)/2,setsar=1,format=yuv420p';
const codec = ff.h264
  ? ['-c:v', 'libx264', '-profile:v', 'high', '-level', '4.2', '-preset', 'slow', '-crf', '18',
     '-x264-params', 'keyint=120:min-keyint=60', '-movflags', '+faststart']
  : ['-c:v', 'libvpx', '-b:v', '6M', '-crf', '14', '-qmin', '2', '-qmax', '32',
     '-deadline', 'good', '-cpu-used', '2', '-auto-alt-ref', '0'];

const proc = spawn(ff.bin, [
  '-y', '-framerate', String(FPS), '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', 'pipe:0',
  '-vf', VF, ...codec, '-r', String(FPS), OUT,
], { stdio: ['pipe', 'ignore', 'ignore'] });

for (const idx of order) proc.stdin.write(readFileSync(`${DIR}/f${String(idx).padStart(5, '0')}.jpg`));
proc.stdin.end();
proc.on('close', c => console.log('ffmpeg exit', c, '->', OUT));
