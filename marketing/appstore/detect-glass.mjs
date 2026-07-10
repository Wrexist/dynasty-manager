// Detect the device-glass rectangle inside the docs/ingame composited
// screenshots (shared template geometry) by scanning for the bezel/background
// transitions along the center axes. Prints {left,right,top,bottom} in px.
import { chromium } from 'playwright';
import { existsSync } from 'fs';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const img = process.argv[2] || 'docs/ingame/dynasty-manager-08-stars.png';
const port = process.argv[3] || '8199';
const browser = await chromium.launch({ executablePath: existsSync(EXE) ? EXE : undefined, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
const url = `http://127.0.0.1:${port}/` + img;
const bounds = await page.evaluate(async (u) => {
  const im = new Image();
  im.src = u;
  await im.decode();
  const c = document.createElement('canvas');
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  const W = c.width, H = c.height;
  const px = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return d; };
  const lum = (d) => 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
  // The bezel is a light-grey frame; find it along center row/col as a local
  // brightness bump above the dark background/screen.
  const cx = W >> 1, cy = H >> 1;
  // vertical scan: find top & bottom bezel (bright grey) then step inward.
  const col = [];
  for (let y = 0; y < H; y++) col.push(lum(px(cx, y)));
  const row = [];
  for (let x = 0; x < W; x++) row.push(lum(px(x, cy)));
  // Bezel threshold: background luminance is very low (~10-25). Bezel grey ~55-90.
  const T = 42;
  let top = 0; for (let y = 0; y < H; y++) { if (col[y] > T) { top = y; break; } }
  let bottom = H - 1; for (let y = H - 1; y >= 0; y--) { if (col[y] > T) { bottom = y; break; } }
  let left = 0; for (let x = 0; x < W; x++) { if (row[x] > T) { left = x; break; } }
  let right = W - 1; for (let x = W - 1; x >= 0; x--) { if (row[x] > T) { right = x; break; } }
  return { W, H, top, bottom, left, right };
}, url);
console.log(JSON.stringify(bounds));
await browser.close();
