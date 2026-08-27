/**
 * Storefront supply guard.
 *
 * Pack pulls are REAL players drawn from `src/data/nationalPlayerPool.ts`. That
 * makes the storefront a consumer of generated data, and a data import that
 * cannot fill a band the store advertises does not fail — it silently falls
 * back to an invented player, which is precisely the thing pack pulls were
 * changed to stop doing. The failure is invisible from the code and invisible
 * in a screenshot; the only place it can be caught is here, against the data.
 *
 * Run it after regenerating the player pool (`npm run process-fc26`,
 * `npm run buildNationalPool`, or any future FC27 import) and BEFORE trusting
 * the packs. It is wired into `npm run preflight` so a pool that cannot back
 * the store cannot reach main quietly.
 *
 * Exit code: 0 on clean, 1 if any band is short.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const POOL_FILE = path.join(ROOT, 'src/data/nationalPlayerPool.ts');
const PACKS_FILE = path.join(ROOT, 'src/config/packs.ts');

/** Minimum real players a band needs before it is safe to sell.
 *
 *  Not a round number for its own sake: below roughly this many, the
 *  position-widening ladder in `pickRealPlayerForPack` starts returning the
 *  same handful of names to everyone, and the pull stops feeling like a pull.
 *  A guaranteed slot is stricter than a rarity rung because every single open
 *  of that pack draws from it. */
const MIN_FOR_GUARANTEE = 12;
const MIN_FOR_BAND = 25;

function readOvrs() {
  const src = fs.readFileSync(POOL_FILE, 'utf8');
  const m = src.match(/ovr:\s*(\d+)/g) || [];
  return m.map(x => Number(x.replace(/\D/g, '')));
}

/** Pull the numbers straight out of the config rather than duplicating them,
 *  so a retuned tier is checked at its new values automatically. */
function readTiers() {
  const src = fs.readFileSync(PACKS_FILE, 'utf8');
  const order = /PACK_STOREFRONT_ORDER:\s*PackTierKey\[\]\s*=\s*\[([^\]]*)\]/.exec(src);
  if (!order) throw new Error('could not find PACK_STOREFRONT_ORDER in config/packs.ts');
  const keys = [...order[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);

  const tiers = [];
  for (const key of keys) {
    const block = new RegExp(
      `key:\\s*'${key}',[\\s\\S]*?guaranteedMinOvr:\\s*(\\d+),[\\s\\S]*?ovrMin:\\s*(\\d+),[\\s\\S]*?ovrMax:\\s*(\\d+),`,
    ).exec(src);
    if (!block) throw new Error(`could not read bands for tier "${key}"`);
    tiers.push({
      key,
      guaranteedMinOvr: Number(block[1]),
      ovrMin: Number(block[2]),
      ovrMax: Number(block[3]),
    });
  }
  return tiers;
}

function main() {
  const ovrs = readOvrs();
  if (ovrs.length === 0) {
    console.error('Pack supply: no player templates found in nationalPlayerPool.ts');
    process.exit(1);
  }
  const poolMax = Math.max(...ovrs);
  const count = (lo, hi) => ovrs.filter(v => v >= lo && v <= hi).length;

  const tiers = readTiers();
  const errors = [];
  const rows = [];

  for (const t of tiers) {
    const guaranteed = count(t.guaranteedMinOvr, t.ovrMax);
    const band = count(t.ovrMin, t.ovrMax);
    rows.push({ key: t.key, guaranteed, band, g: t.guaranteedMinOvr, lo: t.ovrMin, hi: t.ovrMax });

    if (guaranteed < MIN_FOR_GUARANTEE) {
      errors.push(
        `${t.key}: only ${guaranteed} real players at ${t.guaranteedMinOvr}-${t.ovrMax} `
        + `(need ${MIN_FOR_GUARANTEE}) — every open of this pack draws its guaranteed card from that band.`,
      );
    }
    if (band < MIN_FOR_BAND) {
      errors.push(
        `${t.key}: only ${band} real players across its ${t.ovrMin}-${t.ovrMax} band (need ${MIN_FOR_BAND}).`,
      );
    }
    // A ceiling above the best player alive is a published odds row that can
    // never be dealt — the store would be advertising a rating the world does
    // not contain.
    if (t.ovrMax > poolMax) {
      errors.push(
        `${t.key}: ovrMax ${t.ovrMax} is above the pool's best player (${poolMax}). `
        + `Lower it, or the odds sheet advertises a band nobody can be dealt.`,
      );
    }
  }

  console.log('── Pack supply ─────────────────────────────────────────────');
  console.log(`  templates: ${ovrs.length}   best player: ${poolMax}`);
  for (const r of rows) {
    console.log(
      `  ${r.key.padEnd(9)} band ${String(r.lo).padStart(2)}-${r.hi}: ${String(r.band).padStart(5)} players`
      + `   guaranteed ${r.g}+: ${String(r.guaranteed).padStart(4)}`,
    );
  }
  console.log('');

  if (errors.length > 0) {
    console.error(`── ${errors.length} problem(s) ─────────────────────────────────────────`);
    for (const e of errors) console.error(`  ${e}`);
    console.error('');
    console.error('Packs would fall back to invented players for these bands.');
    process.exit(1);
  }
  console.log('OK: every storefront band is backed by real players.');
}

main();
