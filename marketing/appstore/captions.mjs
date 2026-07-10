/**
 * Localized App Store metadata source for the 3D screenshot generator.
 *
 * The five screenshot captions and the localized App Name are parsed directly
 * from the already-authored, human-reviewed ASO copy in
 * `marketing/aso/locales/<locale>.md` — so the screenshots stay in lockstep
 * with the store metadata and we never machine-translate anything.
 *
 * Each locale file carries:
 *   ## App Name [24/30]
 *   `Dynasty Manager: …`
 *   ## Screenshot Captions (5)
 *   1. …
 *   2. …            (exactly five, in panel order)
 */
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(HERE, '..', 'aso', 'locales');

/** All locale codes that have an ASO file (minus the README). */
export function allLocales() {
  return readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => f.replace('.md', ''))
    .sort();
}

/** Parse one locale: { appName, captions: string[5] }. Throws if malformed. */
export function loadLocale(locale) {
  const text = readFileSync(join(LOCALES_DIR, `${locale}.md`), 'utf8');

  const nameMatch = text.match(/##\s*App Name[^\n]*\n+\s*`([^`]+)`/i);
  if (!nameMatch) throw new Error(`${locale}: no App Name`);
  const appName = nameMatch[1].trim();

  const capBlock = text.match(/##\s*Screenshot Captions[^\n]*\n([\s\S]*?)(?=\n##\s|\n?$)/i);
  if (!capBlock) throw new Error(`${locale}: no Screenshot Captions section`);
  const captions = capBlock[1]
    .split('\n')
    .map((l) => l.match(/^\s*\d+\.\s*(.+?)\s*$/))
    .filter(Boolean)
    .map((m) => m[1].trim());
  if (captions.length < 5) throw new Error(`${locale}: expected 5 captions, got ${captions.length}`);

  return { locale, appName, captions: captions.slice(0, 5) };
}
