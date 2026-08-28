#!/usr/bin/env node
/**
 * Fetch an ffmpeg build that can encode H.264, into `.cache/ffmpeg`.
 *
 * Deliberately NOT an npm dependency and NOT committed:
 *   - `ffmpeg-static` in package.json would put a ~79 MB postinstall download
 *     in front of every contributor and every CI run, to serve one marketing
 *     script that most of them will never touch.
 *   - Committing the binary puts 79 MB in every clone, forever.
 *
 * So it is fetched on demand into a gitignored cache. `encode-ad.mjs` finds it
 * automatically; without it that script still runs and emits VP8 WebM, warning
 * that TikTok will reject the result.
 */
import { existsSync, mkdirSync, chmodSync, createWriteStream, statSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';

const RELEASE = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0';
const PLATFORM = { 'linux-x64': 'ffmpeg-linux-x64', 'darwin-arm64': 'ffmpeg-darwin-arm64', 'darwin-x64': 'ffmpeg-darwin-x64', 'win32-x64': 'ffmpeg-win32-x64.exe' };

const key = `${process.platform}-${process.arch}`;
const asset = PLATFORM[key];
if (!asset) {
  console.error(`No prebuilt ffmpeg for ${key}. Install ffmpeg yourself and set FFMPEG=/path/to/ffmpeg.`);
  process.exit(1);
}

const dir = join(process.cwd(), '.cache');
const out = join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
if (existsSync(out) && statSync(out).size > 1_000_000) {
  console.log(`already present: ${out}`);
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
const url = `${RELEASE}/${asset}`;
console.log(`fetching ${url}`);
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) {
  console.error(`download failed: HTTP ${res.status}`);
  process.exit(1);
}
await pipeline(res.body, createWriteStream(out));
chmodSync(out, 0o755);
console.log(`ffmpeg -> ${out} (${(statSync(out).size / 1e6).toFixed(0)} MB)`);
