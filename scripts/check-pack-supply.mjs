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

function readTemplates() {
  const src = fs.readFileSync(POOL_FILE, 'utf8');
  // One template per line in the generated file. Read position, alternates and
  // rating — the three fields `pickRealPlayerForPack` filters on.
  const templates = [];
  for (const line of src.split('\n')) {
    const pos = /\bpos:\s*'([A-Z]+)'/.exec(line);
    const ovr = /\bovr:\s*(\d+)/.exec(line);
    if (!pos || !ovr) continue;
    const altM = /\baltPos:\s*\[([^\]]*)\]/.exec(line);
    const altPos = altM ? [...altM[1].matchAll(/'([A-Z]+)'/g)].map(m => m[1]) : [];
    templates.push({ pos: pos[1], altPos, ovr: Number(ovr[1]) });
  }
  return templates;
}

// The positions packs roll and the widening ladder the picker walks when a
// position has nobody in band. MUST mirror `PACK_POSITION_POOL` in
// `src/config/packs.ts` and `POSITION_FALLBACK` in
// `src/utils/realPlayerPicker.ts` — this script reads generated data with a
// regex and cannot import TS, so the tables are duplicated here on purpose.
const PACK_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
const POSITION_FALLBACK = {
  GK: [],
  CB: ['LB', 'RB', 'CDM'],
  LB: ['CB', 'LM'],
  RB: ['CB', 'RM'],
  CDM: ['CM', 'CB'],
  CM: ['CDM', 'CAM'],
  CAM: ['CM', 'LM', 'RM'],
  LM: ['LW', 'CAM', 'LB'],
  RM: ['RW', 'CAM', 'RB'],
  LW: ['LM', 'ST', 'CAM'],
  RW: ['RM', 'ST', 'CAM'],
  ST: ['CAM', 'LW', 'RW'],
};

/** How many templates the picker's full ladder (exact → alternate → related
 *  position) can reach for `position` inside [lo, hi]. Zero means a pull at
 *  that position falls through to an invented player — the aggregate count
 *  can pass while a single position (GK especially, which has no ladder at
 *  all) is empty. */
function reachableForPosition(templates, position, lo, hi) {
  const inBand = templates.filter(t => t.ovr >= lo && t.ovr <= hi);
  const exact = inBand.filter(t => t.pos === position).length;
  if (exact > 0) return exact;
  const alt = inBand.filter(t => t.altPos.includes(position)).length;
  if (alt > 0) return alt;
  for (const fb of POSITION_FALLBACK[position] ?? []) {
    const n = inBand.filter(t => t.pos === fb || t.altPos.includes(fb)).length;
    if (n > 0) return n;
  }
  return 0;
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
    // Scope every field read to THIS tier's own object literal — a lazy
    // [\s\S]*? scan from `key: 'daily'` happily runs past the end of the
    // daily block and matches the NEXT tier's field, which is exactly how a
    // first version of this script reported a +1 version boost on the free
    // pack. The slice between this `key:` and the next is the block.
    const startM = new RegExp(`key:\\s*'${key}',`).exec(src);
    if (!startM) throw new Error(`could not find tier "${key}"`);
    const rest = src.slice(startM.index + startM[0].length);
    const nextKey = /key:\s*'[a-z_]+',/.exec(rest);
    const block = nextKey ? rest.slice(0, nextKey.index) : rest;

    const num = (field) => {
      const m = new RegExp(`${field}:\\s*(\\d+),`).exec(block);
      return m ? Number(m[1]) : null;
    };
    const g = num('guaranteedMinOvr');
    const lo = num('ovrMin');
    const hi = num('ovrMax');
    if (g === null || lo === null || hi === null) throw new Error(`could not read bands for tier "${key}"`);
    // Band numbers in config are the FINAL ratings a buyer receives; the
    // underlying real player is picked at (final − boost), so THAT is the band
    // the pool has to supply.
    tiers.push({ key, guaranteedMinOvr: g, ovrMin: lo, ovrMax: hi, boost: num('versionBoost') ?? 0 });
  }
  return tiers;
}

function main() {
  const templates = readTemplates();
  const ovrs = templates.map(t => t.ovr);
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
    // Supply is judged at BASE ratings — where the real players actually live.
    const baseG = t.guaranteedMinOvr - t.boost;
    const baseLo = t.ovrMin - t.boost;
    const baseHi = t.ovrMax - t.boost;
    const guaranteed = count(baseG, baseHi);
    const band = count(baseLo, baseHi);
    rows.push({ key: t.key, guaranteed, band, g: t.guaranteedMinOvr, lo: t.ovrMin, hi: t.ovrMax, boost: t.boost });

    if (guaranteed < MIN_FOR_GUARANTEE) {
      errors.push(
        `${t.key}: only ${guaranteed} real players at base ${baseG}-${baseHi} `
        + `(need ${MIN_FOR_GUARANTEE}) — every open of this pack draws its guaranteed card from that band.`,
      );
    }
    if (band < MIN_FOR_BAND) {
      errors.push(
        `${t.key}: only ${band} real players across its base ${baseLo}-${baseHi} band (need ${MIN_FOR_BAND}).`,
      );
    }
    // A ceiling the world cannot reach is a published odds row that can never
    // be dealt. With a version boost the honest ceiling is (best base player +
    // boost) — a +4 Legends issue of a 91 genuinely is a 95.
    if (baseHi > poolMax) {
      errors.push(
        `${t.key}: final ovrMax ${t.ovrMax} needs base players at ${baseHi}, above the pool's best (${poolMax}). `
        + `Lower it, or the odds sheet advertises a band nobody can be dealt.`,
      );
    }
    // Aggregate supply can pass while one POSITION is empty — the picker
    // selects by position and only then widens, and a position its whole
    // ladder cannot fill falls through to an invented player. GK is the
    // realistic risk: it has no ladder at all.
    const emptyPositions = PACK_POSITIONS.filter(
      pos => reachableForPosition(templates, pos, baseG, baseHi) === 0,
    );
    if (emptyPositions.length > 0) {
      errors.push(
        `${t.key}: no real player reachable for ${emptyPositions.join(', ')} in the guaranteed base band `
        + `${baseG}-${baseHi} (after position widening) — pulls there would invent a player.`,
      );
    }
  }

  console.log('── Pack supply ─────────────────────────────────────────────');
  console.log(`  templates: ${ovrs.length}   best player: ${poolMax}`);
  for (const r of rows) {
    console.log(
      `  ${r.key.padEnd(9)} final ${String(r.lo).padStart(2)}-${r.hi}${r.boost ? ` (+${r.boost} version)` : '      '}`
      + `  base supply: ${String(r.band).padStart(5)}`
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
