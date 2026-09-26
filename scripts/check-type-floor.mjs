#!/usr/bin/env node
/**
 * Enforce the 11px type floor (CLAUDE.md › Hard Rules).
 *
 * WHY THIS EXISTS. The floor was written down long before it was held: ~950
 * `text-[10px]` / `text-[9px]` / `text-[8px]` utilities sat in the screens a
 * player reads, and tiny type is the loudest "unfinished" signal on a 375px
 * phone. `src/test/designSystem.test.ts` only guards a hand-picked list of
 * cleaned files, so every new screen was free to slide back under the floor.
 * This counts the whole surface and fails above a ceiling, so the number can
 * only go down.
 *
 * WHAT COUNTS. Arbitrary-value font sizes below 11px — `text-[10px]`,
 * `sm:text-[9.5px]`, `text-[0.6rem]` (rem at 16px) — in `src/pages` and
 * `src/components`, excluding `src/components/ui` (shadcn, not ours to edit).
 * The named scale in `tailwind.config.ts` starts at `text-micro` (11px), so
 * the only way under the floor is an arbitrary value, which is what this sees.
 *
 * GRAPHICS ARE NOT COPY. A crest monogram, a glyph inside a 12px dot, or an
 * overlay sized to a 52px card chip is part of a drawing, not something a
 * player reads as text. Mark the line with `type-floor: graphic` (plus a
 * reason) and it is listed separately instead of counted. That marker is a
 * claim a reviewer should check, not an escape hatch.
 *
 *   node scripts/check-type-floor.mjs            # summary
 *   node scripts/check-type-floor.mjs --by-file  # every offending line
 *   node scripts/check-type-floor.mjs --max 0    # fail above a ceiling
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const SCAN = ['src/pages', 'src/components'];
const EXCLUDE = [join('src', 'components', 'ui')];
const FLOOR_PX = 11;
const REM_PX = 16;
const GRAPHIC_MARKER = 'type-floor: graphic';

/** `text-[10px]`, `md:text-[9.5px]`, `text-[0.6rem]` — size values only;
 *  `text-[#fff]` and `text-[length:var(--x)]` do not match. */
const SIZE_RE = /(?<![\w-])text-\[(\d*\.?\d+)(px|rem)\]/g;

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (EXCLUDE.some((ex) => rel === ex || rel.startsWith(ex + '/') || rel.startsWith(ex + '\\'))) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const hits = [];
const graphics = [];
for (const base of SCAN) {
  for (const file of walk(join(ROOT, base), [])) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(SIZE_RE)) {
        const px = m[2] === 'rem' ? Number(m[1]) * REM_PX : Number(m[1]);
        if (!(px < FLOOR_PX)) continue;
        const hit = { file: relative(ROOT, file), line: i + 1, cls: m[0] };
        (line.includes(GRAPHIC_MARKER) ? graphics : hits).push(hit);
      }
    });
  }
}

const byFile = process.argv.includes('--by-file');
const maxIdx = process.argv.indexOf('--max');
const max = maxIdx === -1 ? null : Number(process.argv[maxIdx + 1]);

console.log(`Sub-${FLOOR_PX}px copy: ${hits.length} (graphics marked '${GRAPHIC_MARKER}': ${graphics.length})`);
if (byFile || (max !== null && hits.length > max)) {
  for (const h of hits) console.log(`  ${h.file}:${h.line}  ${h.cls}`);
}
if (byFile && graphics.length) {
  console.log('Marked graphics:');
  for (const g of graphics) console.log(`  ${g.file}:${g.line}  ${g.cls}`);
}

if (max !== null && hits.length > max) {
  console.error(`\nOver the ceiling: ${hits.length} > ${max}. Use text-micro (11px) or larger; mark genuine graphics with '${GRAPHIC_MARKER}'.`);
  process.exit(1);
}
