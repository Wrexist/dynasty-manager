/**
 * Identify a club by WHO PLAYS FOR IT, not by what it is called.
 *
 * Club names are the least reliable thing about club data. EA writes exonyms
 * ("FC Bayern München" for Bayern Munich), abbreviations ("R. Union St.-G."),
 * and outright placeholders for clubs it has no licence for — Inter Milan
 * ships as "Lombardia FC", which no string comparison will ever match.
 *
 * Squads do not have that problem. The game's own squad files
 * (src/data/squads/*.ts, keyed by game club id) list every club's players, so
 * the overlap between an EA club's surnames and a game club's surnames
 * identifies the club outright. Lautaro, Bastoni and Barella can only be one
 * team, whatever the label on it says.
 *
 * Requires a clear winner: a minimum number of shared surnames AND a decisive
 * lead over the runner-up, so a couple of coincidental namesakes can never
 * carry a match.
 */

/** Surname key: accent-folded, punctuation-free, lowercased. */
export function surnameKey(last) {
  return String(last ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .trim();
}

/**
 * @param {Record<string, {ln?: string}[]>} squadsByClubId the game's squads
 * @returns {Map<string, Set<string>>} game club id -> surname keys
 */
export function buildSquadIndex(squadsByClubId) {
  const index = new Map();
  for (const [clubId, players] of Object.entries(squadsByClubId)) {
    const keys = new Set();
    for (const p of players ?? []) {
      const k = surnameKey(p.ln);
      if (k.length >= 3) keys.add(k);
    }
    if (keys.size) index.set(clubId, keys);
  }
  return index;
}

/**
 * Match one EA club's players against the squad index.
 *
 * @param {string[]} surnames the EA club's players' surnames
 * @param {Map<string, Set<string>>} squadIndex
 * @param {{ minOverlap?: number, minLead?: number }} opts
 * @returns {{ clubId: string, overlap: number, runnerUp: number } | null}
 */
export function fingerprintClub(surnames, squadIndex, { minOverlap = 3, minLead = 2 } = {}) {
  const keys = new Set(surnames.map(surnameKey).filter((k) => k.length >= 3));
  if (keys.size === 0) return null;

  let best = { clubId: null, overlap: 0 };
  let second = 0;

  for (const [clubId, squad] of squadIndex) {
    let n = 0;
    for (const k of keys) if (squad.has(k)) n += 1;
    if (n > best.overlap) { second = best.overlap; best = { clubId, overlap: n }; }
    else if (n > second) { second = n; }
  }

  if (!best.clubId || best.overlap < minOverlap) return null;
  // A decisive lead, so two clubs sharing a few common surnames cannot decide it.
  if (best.overlap - second < minLead) return null;
  return { ...best, runnerUp: second };
}
