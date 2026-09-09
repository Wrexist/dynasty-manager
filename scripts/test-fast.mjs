import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
  'run', ...process.argv.slice(2),
], { stdio: 'inherit', env: { ...process.env, VITEST_FAST: '1' } });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
