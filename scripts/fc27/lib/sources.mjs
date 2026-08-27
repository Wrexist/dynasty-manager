/**
 * Candidate FC27 source registry.
 *
 * Ordered by the extraction hierarchy in the pipeline brief: official bulk
 * JSON first, third-party structured endpoints after, HTML scraping last.
 * `discover_sources.mjs` probes every entry and writes the result; nothing in
 * the pipeline picks a source without a probe behind it.
 *
 * `usable: false` entries are kept deliberately. They document what was
 * investigated and why it was rejected, so a future run does not re-litigate
 * the same dead ends.
 */

/** EA renames the ratings path each season; these are tried in order. */
export const EA_TITLE_SLUGS = ['ea-sports-fc-27', 'fc-27', 'ea-sports-fc'];

export const SOURCES = [
  {
    id: 'ea-drop-api',
    label: 'EA SPORTS FC official ratings API (Drop API)',
    official: true,
    tier: 1,
    kind: 'json-api',
    base: 'https://drop-api.ea.com/rating',
    // Filled by discover_sources.mjs once a slug answers.
    slugCandidates: EA_TITLE_SLUGS,
    pageParam: 'offset',
    limitParam: 'limit',
    pageSize: 100, // the API rejects limits above 100
    itemsKey: 'items',
    totalKey: 'totalItems',
    sourceUrlTemplate: 'https://www.ea.com/games/ea-sports-fc/ratings?playerId={id}',
    hasGender: true,
    hasPotential: false, // <- the reason a second source is needed
    hasPlaystyles: true,
    authRequired: false,
    usable: true,
    notes:
      'Official, no auth, offset/limit pagination, explicit gender field, '
      + 'PlayStyles and PlayStyles+. Carries NO career-mode potential.',
  },
  {
    id: 'sofifa',
    label: 'SoFIFA',
    official: false,
    tier: 5,
    kind: 'html',
    base: 'https://sofifa.com',
    hasGender: true,
    hasPotential: true,
    hasPlaystyles: true,
    authRequired: false,
    usable: false,
    notes:
      'One of the only sources carrying potential. Cloudflare browser '
      + 'clearance in front of it; scraping it needs Playwright and is slow. '
      + 'Candidate for the potential merge only, never for the base pull.',
  },
  {
    id: 'cmtracker',
    label: 'CMTracker (career-mode database)',
    official: false,
    tier: 5,
    kind: 'html',
    base: 'https://cmtracker.net',
    hasGender: true,
    hasPotential: true,
    hasPlaystyles: true,
    authRequired: false,
    usable: false,
    notes:
      'Career-mode oriented, so it carries potential. Its export UI caps at '
      + '~50 rows per CSV. No public documented bulk endpoint was reachable '
      + 'from this environment to verify an alternative.',
  },
  {
    id: 'wefut',
    label: 'WeFUT player database',
    official: false,
    tier: 5,
    kind: 'html',
    base: 'https://wefut.com',
    hasGender: true,
    hasPotential: false,
    hasPlaystyles: true,
    authRequired: false,
    usable: false,
    notes:
      'Ultimate Team oriented. UT data has no career-mode potential, so it '
      + 'adds nothing over the official EA API, which is the same underlying '
      + 'ratings data with better access.',
  },
];

export const byId = (id) => SOURCES.find((s) => s.id === id);

/** Build one page URL for a json-api source. */
export function pageUrl(source, slug, { offset, limit, locale = 'en', extra = {} }) {
  const url = new URL(`${source.base}/${slug}`);
  url.searchParams.set('locale', locale);
  url.searchParams.set(source.limitParam, String(limit));
  url.searchParams.set(source.pageParam, String(offset));
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  return url.toString();
}
