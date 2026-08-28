/**
 * Split a player's display name into the `fn` / `ln` pair the game's squad
 * data uses. THE single splitter for every generator that reads the FC27
 * export: `buildNationalPool.mjs`, `build_community_pack.mjs` /
 * `processFC26.mjs`, and `buildClubTemplatesFromFC26.mjs`.
 *
 * EA gives two name fields and they disagree on purpose:
 *   short_name  how EA labels the player on a card  ("Alisson", "Rodri", "Vini Jr.")
 *   long_name   the full legal-ish name             ("Alisson Ramses Becker",
 *                                                    "Rodrigo Hernández Cascante",
 *                                                    "Vinícius José de Oliveira Júnior")
 *
 * The old splitter treated "EA labels him with one name AND long_name starts
 * with it" as proof of a mononym, and emitted `fn === ln`. That is right for
 * Endrick and Estêvão and wrong for Alisson Becker, Gabriel Magalhães and
 * Brahim Díaz — the two cases are structurally identical, so the difference is
 * editorial and lives in KEEP_MONONYM below.
 *
 * A player labelled with only a generational suffix ("Vini Jr.") lost their
 * family name the same way. There the answer is not the raw surname
 * ("Vinícius José Oliveira Júnior" is nobody's name) but the given name plus
 * the suffix: "Vinícius Júnior".
 */

const NAME_SUFFIXES = new Set(['Jr.', 'Sr.', 'Jr', 'Sr', 'II', 'III', 'IV', 'Júnior', 'Junior']);
// Latin-1 + Latin Extended-A so Š./Ž./Č. initials don't fall through.
const ABBREV_RE = /^([A-ZÀ-ÖØ-öø-ÿĀ-ſ])\.\s+(.+)$/;

/** Lowercase, strip accents, whitespace and hyphens — "Gue-sung" == "Gue Sung". */
export function nameDedupKey(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]+/g, '');
}

const isSuffix = (t) => NAME_SUFFIXES.has(t);

/**
 * Players EA labels with one name who ARE known by that one name. Everyone
 * else in the same shape gets their family name restored from long_name.
 * Keyed by nameDedupKey of the short_name; reviewed by hand against the
 * generated report (`node scripts/fc27/report_names.mjs`).
 */
/**
 * Spanish-convention nationalities carry two surnames, paternal first, and the
 * PATERNAL one is the name in use: "Ayoze Pérez Gutiérrez" is Ayoze Pérez, not
 * Ayoze Gutiérrez. Portuguese and Brazilian names run the other way round
 * ("Alisson Ramses Becker" is Becker), which is the default below.
 */
const SPANISH_SURNAME_ORDER = new Set([
  'Spain', 'Argentina', 'Mexico', 'Colombia', 'Chile', 'Peru', 'Uruguay',
  'Venezuela', 'Ecuador', 'Paraguay', 'Bolivia', 'Costa Rica', 'Cuba',
  'Dominican Republic', 'Guatemala', 'Honduras', 'Nicaragua', 'Panama',
  'El Salvador', 'Equatorial Guinea',
]);

/** Nobiliary/connective particles are never the name on the shirt. */
const PARTICLES = new Set([
  'de', 'del', 'da', 'do', 'dos', 'das', 'di', 'la', 'las', 'los', 'le',
  'van', 'von', 'der', 'den', 'ten', 'ter', 'e', 'y', 'al', 'bin', 'ibn',
]);

/**
 * Players EA labels with one name who ARE known by that one name. Everyone
 * else in the same shape gets their family name restored from long_name.
 * Reviewed by hand against `node scripts/fc27/report_names.mjs`.
 */
const RAW_KEEP_MONONYM = [
  // Portuguese/Brazilian diminutives and one-name identities
  'Rodri', 'Raphinha', 'Vitinha', 'Pedri', 'Marquinhos', 'Isco', 'Gavi',
  'Fabinho', 'Rafa', 'Koke', 'Isi', 'Fred', 'Savinho', 'Trincão', 'Otávio',
  'Malcom', 'Bento', 'Casemiro', 'Evanilson', 'Fermín', 'Florentino',
  'Alexsandro', 'Rodinei', 'Evander', 'Murillo', 'Galeno', 'Endrick',
  'Estêvão', 'Dante', 'Richarlison', 'Danilo', 'Everton', 'Matheus',
  'Wesley', 'Rômulo', 'Igor', 'Ângelo', 'Petros', 'Arthur', 'Italo', 'Kady',
  'Taison', 'Emerson', 'Vanderson', 'Sandro', 'Joelinton', 'Antony',
  'Éderson', 'Cassiano', 'Calebe', 'Geovani', 'Hernandes', 'Warleson',
  'Adilson', 'Mailson', 'Flavio', 'Ronivaldo', 'Anderson', 'Marcelo',
  'Jefté', 'Higinio', 'Hannibal', 'Kaku', 'Angeliño', 'Palhinha',
  'Zubimendi', 'Oyarzabal', 'Grimaldo', 'Balde', 'Bremer', 'Sancet',
];

export const KEEP_MONONYM = new Set(
  (process.env.FC27_NO_MONONYMS ? [] : RAW_KEEP_MONONYM).map(nameDedupKey),
);

/**
 * Resolve { fn, ln } from EA's two name fields.
 *
 * @param {string} longName  EA `long_name`
 * @param {string} shortName EA `short_name`
 * @param {string} nationality EA `nationality_name` — decides surname order
 * @returns {{ fn: string, ln: string }}
 */
export function extractName(longName, shortName, nationality = '') {
  const longParts = (longName || '').trim().split(/\s+/).filter(Boolean);
  const shortParts = (shortName || '').trim().split(/\s+/).filter(Boolean);
  const fallback = longParts[0] || shortParts[0] || 'Unknown';

  /**
   * The family name in use, from the tokens of long_name that follow the given
   * name. Spanish convention takes the first surname, everyone else the last;
   * particles ("de", "dos", "van") are skipped either way.
   */
  const familyName = (givenTokenCount) => {
    const rest = longParts.slice(givenTokenCount)
      .filter((t) => !isSuffix(t) && !PARTICLES.has(t.toLowerCase()) && !/^[A-Z]\.$/.test(t));
    if (rest.length === 0) return null;
    return SPANISH_SURNAME_ORDER.has(nationality) ? rest[0] : rest[rest.length - 1];
  };
  /** long_name's own suffix spelling ("Júnior") beats EA's abbreviation ("Jr."). */
  const suffixToken = (eaSuffix) => longParts.find(isSuffix) || eaSuffix;

  const m = (shortName || '').match(ABBREV_RE);
  if (m) {
    // "J. Bellingham" — full given name from long_name, family name from short.
    return { fn: longParts[0] || fallback, ln: m[2].trim() };
  }

  if (shortParts.length >= 2) {
    const tail = shortParts.slice(1);
    if (tail.every(isSuffix)) {
      // "Vini Jr." — EA dropped the family name and kept the suffix. The raw
      // surname reads as nobody's name, so use given name + suffix.
      return { fn: longParts[0] || shortParts[0], ln: suffixToken(tail[0]) };
    }
    // "Lautaro Martínez" / "Cho Gue Sung" — EA's own labelling; trust it.
    return { fn: shortParts[0], ln: tail.join(' ') };
  }

  if (shortParts.length === 1 && longParts.length >= 2) {
    const shortKey = nameDedupKey(shortParts[0]);
    if (nameDedupKey(longParts[0]) === shortKey) {
      // long_name starts with the label: either a true mononym, or a player
      // whose family name EA simply doesn't print.
      if (KEEP_MONONYM.has(shortKey)) return { fn: shortParts[0], ln: shortParts[0] };
      const family = familyName(1);
      if (family) return { fn: shortParts[0], ln: family };
      return { fn: shortParts[0], ln: shortParts[0] };
    }
    // A one-word label that is NOT in long_name at all is a football nickname
    // ("Rodri" for Rodrigo Hernández, "Savinho" for Sávio Moreira). Emit it as
    // a mononym so it renders as the one name he is known by, rather than
    // "Rodrigo Rodri".
    if (KEEP_MONONYM.has(shortKey)) return { fn: shortParts[0], ln: shortParts[0] };
    // "Carvajal" -> "Daniel Carvajal Ramos": short is the family name.
    const firstDifferent = longParts.find((p) => nameDedupKey(p) !== shortKey);
    return { fn: firstDifferent ?? longParts[0] ?? shortParts[0], ln: shortParts[0] };
  }

  // No usable short_name.
  if (longParts.length >= 2) {
    let i = longParts.length - 1;
    while (i > 0 && isSuffix(longParts[i])) i--;
    return { fn: fallback, ln: longParts[i] };
  }
  return { fn: fallback, ln: shortParts[0] || longParts[0] || 'Unknown' };
}

export { NAME_SUFFIXES, ABBREV_RE };
