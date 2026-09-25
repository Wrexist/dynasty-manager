/**
 * Device locale → default nationality.
 *
 * The nationality step used to open on a list of 67 nations with nothing
 * chosen, so every new player had to search or scroll for their own country
 * before they could see a single club. The device already knows: iOS hands
 * WKWebView a BCP 47 tag like `sv-SE` or `en-GB`. We read the REGION of that
 * tag first — `en` is spoken in a dozen of our nations and says nothing on its
 * own, while `GB`, `US` and `AU` each name exactly one.
 *
 * This is a DEFAULT, never a decision: the result pre-selects a row the player
 * can change, and anything we cannot map returns `null` (the list opens
 * unselected, exactly as before). Nothing here is persisted.
 */

import { SELECTABLE_NATIONS } from '@/data/nations';

/**
 * ISO 3166-1 alpha-2 region → nation name in `SELECTABLE_NATIONS`.
 *
 * `GB` goes to England: the UK is one locale region but four football nations,
 * and England is the right default for the majority. Scotland and Wales are
 * reached through their languages below, or one tap away in the list. A test
 * pins that every value here is a selectable nation.
 */
export const REGION_TO_NATION: Readonly<Record<string, string>> = {
  // UEFA
  FR: 'France', ES: 'Spain', GB: 'England', PT: 'Portugal', NL: 'Netherlands',
  BE: 'Belgium', DE: 'Germany', HR: 'Croatia', IT: 'Italy', CH: 'Switzerland',
  DK: 'Denmark', TR: 'Turkey', AT: 'Austria', NO: 'Norway', UA: 'Ukraine',
  PL: 'Poland', SE: 'Sweden', RS: 'Serbia', CZ: 'Czech Republic', HU: 'Hungary',
  GR: 'Greece', IE: 'Ireland', BA: 'Bosnia and Herzegovina',
  // CONMEBOL
  AR: 'Argentina', BR: 'Brazil', CO: 'Colombia', UY: 'Uruguay', EC: 'Ecuador',
  PY: 'Paraguay', CL: 'Chile', PE: 'Peru',
  // CAF
  MA: 'Morocco', SN: 'Senegal', NG: 'Nigeria', DZ: 'Algeria', EG: 'Egypt',
  CI: 'Ivory Coast', CM: 'Cameroon', GH: 'Ghana', ML: 'Mali', GA: 'Gabon',
  ZA: 'South Africa', TN: 'Tunisia', CV: 'Cabo Verde', CD: 'DR Congo',
  // AFC (New Zealand is OFC in reality; the game files it under AFC)
  JP: 'Japan', KR: 'South Korea', AU: 'Australia', SA: 'Saudi Arabia',
  QA: 'Qatar', NZ: 'New Zealand', IR: 'Iran', IQ: 'Iraq', JO: 'Jordan',
  UZ: 'Uzbekistan',
  // CONCACAF
  MX: 'Mexico', US: 'USA', CA: 'Canada', CR: 'Costa Rica', JM: 'Jamaica',
  HT: 'Haiti', CW: 'Curaçao', PA: 'Panama',
};

/**
 * Languages that name a home nation more precisely than their region does.
 * A device set to Welsh reports `cy-GB`; `GB` alone would make that player
 * English. Checked before the region, and deliberately tiny.
 */
const HOME_NATION_LANGUAGES: Readonly<Record<string, string>> = {
  cy: 'Wales',
  gd: 'Scotland',
};

/**
 * Region-less tags (`sv`, `ja`) — only languages spoken overwhelmingly in ONE
 * of our nations. English, Spanish, French, Portuguese and Arabic are absent on
 * purpose: guessing a country from them would be wrong for most speakers, and
 * `null` (nothing pre-selected) is the honest answer.
 */
const LANGUAGE_TO_NATION: Readonly<Record<string, string>> = {
  sv: 'Sweden', nb: 'Norway', nn: 'Norway', no: 'Norway', da: 'Denmark',
  nl: 'Netherlands', de: 'Germany', it: 'Italy', pl: 'Poland',
  cs: 'Czech Republic', hu: 'Hungary', el: 'Greece', uk: 'Ukraine',
  hr: 'Croatia', sr: 'Serbia', bs: 'Bosnia and Herzegovina', tr: 'Turkey',
  ja: 'Japan', ko: 'South Korea', fa: 'Iran', uz: 'Uzbekistan', ga: 'Ireland',
};

const SELECTABLE_NAMES: ReadonlySet<string> = new Set(SELECTABLE_NATIONS.map(n => n.name));

export interface ParsedLocale {
  /** Lower-case primary language subtag (`sv`, `en`). */
  language: string;
  /** Upper-case ISO 3166-1 alpha-2 region, or `null` when the tag has none. */
  region: string | null;
}

/**
 * Split a BCP 47 tag into language + country region. Accepts `_` separators
 * (`en_GB`), skips a script subtag (`zh-Hant-TW`), and treats a UN M.49 area
 * (`es-419`) as no region — "Latin America" is not one nation. Never throws.
 */
export function parseLocaleTag(tag: string | null | undefined): ParsedLocale | null {
  if (!tag || typeof tag !== 'string') return null;
  const parts = tag.trim().replace(/_/g, '-').split('-').filter(Boolean);
  if (parts.length === 0 || !/^[A-Za-z]{2,3}$/.test(parts[0])) return null;
  let region: string | null = null;
  for (const part of parts.slice(1)) {
    if (/^[A-Za-z]{4}$/.test(part)) continue; // script subtag
    if (/^[A-Za-z]{2}$/.test(part)) region = part.toUpperCase();
    break; // region, M.49 area, variant or extension — nothing after matters
  }
  return { language: parts[0].toLowerCase(), region };
}

/** Nation name for one locale tag, or `null` if it doesn't map to a selectable nation. */
export function nationFromLocaleTag(tag: string | null | undefined): string | null {
  const parsed = parseLocaleTag(tag);
  if (!parsed) return null;
  // An explicit region is authoritative even when it doesn't map: `sv-FI` is
  // a Finnish player, not a Swede, so it must not fall through to `sv`.
  const nation = HOME_NATION_LANGUAGES[parsed.language]
    ?? (parsed.region ? REGION_TO_NATION[parsed.region] : LANGUAGE_TO_NATION[parsed.language]);
  return nation && SELECTABLE_NAMES.has(nation) ? nation : null;
}

/** The subset of `Navigator` this reads — injectable so tests don't touch globals. */
export interface LocaleSource {
  language?: string;
  languages?: readonly string[];
}

/**
 * Default nationality for this device: the first of the player's preferred
 * languages that maps to a selectable nation. `null` when nothing maps or there
 * is no navigator.
 */
export function detectLocaleNation(
  source: LocaleSource | null | undefined = typeof navigator !== 'undefined' ? navigator : null,
): string | null {
  if (!source) return null;
  const tags = [...(source.languages ?? []), source.language].filter((t): t is string => !!t);
  for (const tag of tags) {
    const nation = nationFromLocaleTag(tag);
    if (nation) return nation;
  }
  return null;
}
