/**
 * Canonicalise EA's nationality labels to the ones the game was built against.
 *
 * This is not cosmetic. National-team selection filters with
 * `nats.has(p.nationality)` (src/utils/international.ts) — an exact set
 * membership — so a Dutch player labelled "Holland" is simply invisible to the
 * Netherlands squad. The FC26 pack that shipped before this used
 * "Netherlands", so importing EA's label verbatim is a regression, not a
 * neutral difference.
 *
 * The first group was derived from the data rather than assumed: for players
 * matched on a stable id, it is what EA calls the nationality versus what the
 * FC26 baseline — the labels the game's nations and squads were built against
 * — calls the same player's.
 *
 * The second group differs from `src/data/nations.ts` in BOTH sources, so FC26
 * shipped them broken too. Every target is a real entry in that file.
 *
 * Deliberately NOT mapped:
 *   - "Curacao": nations.ts already carries "Curaçao" with its cedilla, so
 *     folding EA's label to the baseline's plain spelling would move it AWAY
 *     from a real nation.
 *   - Three players where the sources genuinely disagree about the country
 *     (France/Haiti, France/Côte d'Ivoire, Ukraine/Italy). Those are dual
 *     nationals, one player each — not label aliases. Folding them in would
 *     rewrite a fact rather than reconcile a spelling.
 */
export const NATIONALITY_ALIASES = {
  // Same country, different spelling between EA and the baseline.
  //
  // NOT here, deliberately: Turkey and Czech Republic. The FC26 baseline spells
  // those "Türkiye" and "Czechia", so a baseline-derived mapping would fold EA
  // onto those — but src/data/nations.ts carries BOTH spellings of each as
  // separate nations, and buildNationalPool.mjs records that the in-game label
  // is "Turkey" / "Czech Republic". EA already uses the in-game label, so
  // mapping them moves the players to the wrong one of the two entries. The
  // duplicate nations are a pre-existing bug; see docs/fc27/AUDIT-2026-08-28.md.
  Holland: 'Netherlands',
  'Cape Verde Islands': 'Cabo Verde',
  'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'St. Lucia': 'Saint Lucia',

  // Broken in FC26 as well: 396 Korean, 391 American, 313 Irish, 104 Ivorian
  // and 39 Congolese players who could never be picked for their own country.
  'Korea Republic': 'South Korea',
  'United States': 'USA',
  'Republic of Ireland': 'Ireland',
  "Côte d'Ivoire": 'Ivory Coast',
  'Congo DR': 'DR Congo',
};

/** @param {string | null | undefined} label @returns {string | null} */
export function canonicalNationality(label) {
  if (label === null || label === undefined || label === '') return null;
  return NATIONALITY_ALIASES[label] ?? label;
}

/** Compare two nationality labels across sources, aliases folded. */
export function sameNationality(a, b) {
  const ca = canonicalNationality(a);
  const cb = canonicalNationality(b);
  if (ca === null || cb === null) return false;
  return ca.localeCompare(cb, undefined, { sensitivity: 'base' }) === 0;
}
