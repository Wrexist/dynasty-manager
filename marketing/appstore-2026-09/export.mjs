import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const formats = { 'iphone-6.5': [1242, 2688], 'iphone-6.9': [1320, 2868], 'ipad-13': [2064, 2752] };
const files = readdirSync(join(root, 'masters')).filter(f => f.endsWith('.jpg')).sort();
if (files.length !== 5) throw new Error('Exactly five masters are required');
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result.stdout.trim();
}
const manifest = [];
for (const [folder, [width, height]] of Object.entries(formats)) {
  mkdirSync(join(root, folder), { recursive: true });
  for (const file of files) {
    const source = join(root, 'masters', file);
    const target = join(root, folder, file);
    const light = file.startsWith('03') || file.startsWith('04');
    // Fit the complete artwork. Never stretch faces or crop headline/stat text.
    run('convert', [source, '-auto-orient', '-colorspace', 'sRGB', '-filter', 'Lanczos',
      '-resize', `${width}x${height}`, '-background', light ? '#ede7db' : '#12130f',
      '-gravity', 'center', '-extent', `${width}x${height}`, '-alpha', 'off',
      '-sampling-factor', '4:4:4', '-quality', '94', '-strip', target]);
    const dimensions = run('identify', ['-format', '%wx%h', target]);
    if (dimensions !== `${width}x${height}`) throw new Error(`Invalid dimensions: ${target}`);
    manifest.push({ file: `${folder}/${file}`, width, height, format: 'JPEG', alpha: false });
  }
}
writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Verified ${manifest.length} exports across ${Object.keys(formats).length} device sizes.`);
