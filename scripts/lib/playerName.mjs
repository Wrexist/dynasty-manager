/**
 * Split a player's display name into the `fn` / `ln` pair the game's squad
 * data uses.
 *
 * Moved here from scripts/buildClubTemplatesFromFC26.mjs so the FC27 pipeline
 * uses the SAME logic rather than a second copy. It matters: the naive
 * "split on the last space" in processFC26.mjs turns every mononym into a
 * doubled name — "Rodri Rodri", "Raphinha Raphinha" — and 206 of those shipped
 * in the FC26 community pack. This version reads EA's long name to recover the
 * real given name, which is why the generated squad files have none.
 */

const NAME_SUFFIXES = new Set(['Jr.', 'Sr.', 'Jr', 'Sr', 'II', 'III', 'IV', 'Júnior']);
// Cover Latin-1 (À-ÿ) and Latin Extended-A (Ā-ſ, U+0100–U+017F) so
// initials like Š./Ž./Č./Ł./Ś. hit the abbreviation branch.
const ABBREV_RE = /^([A-ZÀ-ÖØ-öø-ÿĀ-ſ])\.\s+(.+)$/;

// Lowercase + strip whitespace and hyphens so "Gue-sung" / "Gue Sung" /
// "Guesung" all collapse to the same key. Used to detect when a
// hyphenated mononym got duplicated across fn and ln.
function nameDedupKey(s) {
  return (s || '').toLowerCase().replace(/[\s-]+/g, '');
}

function extractName(longName, shortName) {
  const longParts = (longName || '').trim().split(/\s+/).filter(Boolean);
  const shortParts = (shortName || '').trim().split(/\s+/).filter(Boolean);
  const fallback = longParts[0] || shortParts[0] || 'Unknown';

  let fn;
  let ln;

  const m = (shortName || '').match(ABBREV_RE);
  if (m) {
    // "J. Bellingham" → fn from full long name, ln from the short.
    fn = longParts[0] || fallback;
    ln = m[2].trim();
  } else if (shortParts.length >= 2) {
    // "Lautaro Martínez" — Western order, fn + ln.
    // "Cho Gue Sung" — Korean order in FC26, family + given.
    // Either way EA's short_name encodes how the player is labelled, so
    // trust it: first token = fn, rest = ln. (Multi-word given names
    // like "Pierre-Emerick" already arrive hyphenated as a single token.)
    fn = shortParts[0];
    ln = shortParts.slice(1).join(' ');
  } else if (shortParts.length === 1 && longParts.length >= 2) {
    // Single-token short_name. Two distinct cases:
    //   a) True mononym — long_name *starts* with the short token
    //      (Rodrygo / Endrick / Brahim). The player is known by a
    //      single name; emit fn = ln = short so display stays clean.
    //   b) Surname-only short — long_name starts with a different
    //      given name (Carvajal → "Daniel Carvajal Ramos"). Treat
    //      short as ln and pull fn from long_name's first token.
    const shortKey = nameDedupKey(shortParts[0]);
    if (longParts.length > 0 && nameDedupKey(longParts[0]) === shortKey) {
      fn = shortParts[0];
      ln = shortParts[0];
    } else {
      ln = shortParts[0];
      const firstDifferent = longParts.find(p => nameDedupKey(p) !== shortKey);
      fn = firstDifferent ?? longParts[0] ?? ln;
    }
  } else {
    fn = fallback;
    if (longParts.length >= 2) {
      let i = longParts.length - 1;
      while (i > 0 && NAME_SUFFIXES.has(longParts[i])) i--;
      ln = longParts[i];
    } else {
      ln = shortParts[0] || longParts[0] || 'Unknown';
    }
  }

  // Final pass: if fn and ln still collapse to the same dedup key
  // (hyphenated Korean / Japanese romanisations like
  // 'Gue-sung' vs 'Gue Sung'), fall back to a single mononym so the
  // generated row doesn't render as "Gue-sung Gue Sung".
  if (nameDedupKey(fn) === nameDedupKey(ln)) {
    fn = ln;
  }
  return { fn, ln };
}

export { extractName, nameDedupKey, NAME_SUFFIXES, ABBREV_RE };
