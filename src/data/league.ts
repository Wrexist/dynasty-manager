import { ClubData, Match, LeagueTableEntry, LeagueId, LeagueInfo, DerbyRivalry } from '@/types/game';
import { shuffle, safeRandomUUID } from '@/utils/helpers';
import { PRESEASON_FRIENDLY_COUNT, FRIENDLY_PLACEMENT_MAX_WEEK } from '@/config/gameBalance';
import { CONTINENTAL_SUPER_CUP_WEEK, DOMESTIC_SUPER_CUP_WEEK, getCompetitionCalendar } from '@/config/continental';

// ── Import all leagues ──
import { ALL_LEAGUES, ALL_CLUBS_DATA } from './leagues';

// ── Re-export for backward compatibility ──
export const LEAGUES: LeagueInfo[] = ALL_LEAGUES;

export const CLUBS_DATA: ClubData[] = ALL_CLUBS_DATA;
/** Alias for new code */
export const ALL_CLUBS = ALL_CLUBS_DATA;

// ── Country-aware league helpers ──

/** Get all leagues/divisions for a given country, sorted by tier */
export function getLeaguesByCountry(countryId: string): LeagueInfo[] {
  return LEAGUES.filter(l => l.countryId === countryId).sort((a, b) => a.tier - b.tier);
}




/** Check if a country has multiple tiers */
export function hasMultipleTiers(countryId: string): boolean {
  return getLeaguesByCountry(countryId).length > 1;
}


// ── Real Derby Rivalries ──
export const DERBIES: DerbyRivalry[] = [
  // England
  { clubIdA: 'manchester-city', clubIdB: 'manchester-united', name: 'Manchester Derby', intensity: 3 },
  { clubIdA: 'liverpool', clubIdB: 'everton', name: 'Merseyside Derby', intensity: 3 },
  { clubIdA: 'arsenal', clubIdB: 'tottenham-hotspur', name: 'North London Derby', intensity: 3 },
  { clubIdA: 'chelsea', clubIdB: 'fulham', name: 'West London Derby', intensity: 2 },
  { clubIdA: 'crystal-palace', clubIdB: 'brighton', name: 'M23 Derby', intensity: 2 },
  { clubIdA: 'newcastle-united', clubIdB: 'nottingham-forest', name: 'East Midlands Rivalry', intensity: 1 },
  // Spain
  { clubIdA: 'barcelona', clubIdB: 'real-madrid', name: 'El Clásico', intensity: 3 },
  { clubIdA: 'atletico-madrid', clubIdB: 'real-madrid', name: 'Madrid Derby', intensity: 3 },
  { clubIdA: 'real-betis', clubIdB: 'sevilla', name: 'Seville Derby', intensity: 3 },
  // Italy
  { clubIdA: 'ac-milan', clubIdB: 'inter-milan', name: 'Derby della Madonnina', intensity: 3 },
  { clubIdA: 'juventus', clubIdB: 'torino', name: 'Derby della Mole', intensity: 3 },
  { clubIdA: 'as-roma', clubIdB: 'lazio', name: 'Derby della Capitale', intensity: 3 },
  { clubIdA: 'genoa', clubIdB: 'fiorentina', name: 'Derby dell\'Appennino', intensity: 1 },
  // Germany
  { clubIdA: 'bayern-munich', clubIdB: 'borussia-dortmund', name: 'Der Klassiker', intensity: 3 },
  { clubIdA: 'borussia-dortmund', clubIdB: 'eintracht-frankfurt', name: 'Bundesliga Rivalry', intensity: 2 },
  // France
  { clubIdA: 'paris-saint-germain', clubIdB: 'marseille', name: 'Le Classique', intensity: 3 },
  { clubIdA: 'lyon', clubIdB: 'saint-etienne', name: 'Derby Rhône-Alpes', intensity: 3 },
  // Netherlands
  { clubIdA: 'ajax', clubIdB: 'feyenoord', name: 'De Klassieker', intensity: 3 },
  { clubIdA: 'ajax', clubIdB: 'psv-eindhoven', name: 'De Topper', intensity: 2 },
  // Portugal
  { clubIdA: 'benfica', clubIdB: 'porto', name: 'O Clássico', intensity: 3 },
  { clubIdA: 'benfica', clubIdB: 'sporting-cp', name: 'Derby de Lisboa', intensity: 3 },
  // Scotland
  { clubIdA: 'celtic', clubIdB: 'rangers', name: 'Old Firm', intensity: 3 },
  // Turkey
  { clubIdA: 'galatasaray', clubIdB: 'fenerbahce', name: 'Kıtalar Arası Derbi', intensity: 3 },
  { clubIdA: 'galatasaray', clubIdB: 'besiktas', name: 'Istanbul Derby', intensity: 3 },
  // Belgium
  { clubIdA: 'club-brugge', clubIdB: 'anderlecht', name: 'Topper', intensity: 3 },
  // Greece
  { clubIdA: 'olympiacos', clubIdB: 'panathinaikos', name: 'Derby of the Eternal Enemies', intensity: 3 },
  // Serbia
  { clubIdA: 'red-star-belgrade', clubIdB: 'partizan-belgrade', name: 'Eternal Derby', intensity: 3 },
  // Croatia
  { clubIdA: 'dinamo-zagreb', clubIdB: 'hajduk-split', name: 'Croatian Derby', intensity: 3 },
  // Austria
  { clubIdA: 'rapid-wien', clubIdB: 'austria-wien', name: 'Wiener Derby', intensity: 3 },
  // Argentina-origin derbies in the style
  { clubIdA: 'celtic', clubIdB: 'aberdeen', name: 'Scottish Rivalry', intensity: 1 },
];

/** Returns the derby intensity (1-3) if the two clubs are rivals, or 0 if not a derby */
export function getDerbyIntensity(clubIdA: string, clubIdB: string): number {
  const derby = DERBIES.find(d =>
    (d.clubIdA === clubIdA && d.clubIdB === clubIdB) ||
    (d.clubIdA === clubIdB && d.clubIdB === clubIdA)
  );
  return derby?.intensity ?? 0;
}

/** Returns the derby name if the two clubs are rivals */
export function getDerbyName(clubIdA: string, clubIdB: string): string | null {
  const derby = DERBIES.find(d =>
    (d.clubIdA === clubIdA && d.clubIdB === clubIdB) ||
    (d.clubIdA === clubIdB && d.clubIdB === clubIdA)
  );
  return derby?.name ?? null;
}

// ── Helper: get clubs by league ──

export function getLeague(id: LeagueId): LeagueInfo {
  return LEAGUES.find(l => l.id === id)!;
}

// ── Fixture Generation ──
export function generateFixtures(clubIds: string[]): Match[] {
  const n = clubIds.length;
  if (n < 2) return [];
  const matches: Match[] = [];
  const teams = shuffle([...clubIds]);

  // If odd number of teams, add a "bye" placeholder
  const hasBye = n % 2 !== 0;
  if (hasBye) teams.push('__bye__');
  const total = teams.length;

  // Circle method. Every pairing flips venue on odd rounds. Without the flip
  // the side a club lands on is fixed by its position in the rotation, and a
  // position moves one step per round, so every club played about half a
  // season at home and then half away (the pivot team played 19 home games in
  // a row). That turned the home-week gate into ten weeks of nothing followed
  // by nine weeks of double gate: Liverpool opened with eight straight away
  // games and the Weekly Digest showed a −£3M loss every week (R1). With the
  // flip no club has more than two in a row at the same venue (three in odd
  // leagues, counted across a bye). Only venues change; the random draws are
  // the same.
  for (let round = 0; round < total - 1; round++) {
    const flipVenue = round % 2 === 1;
    for (let i = 0; i < total / 2; i++) {
      const home = flipVenue ? teams[total - 1 - i] : teams[i];
      const away = flipVenue ? teams[i] : teams[total - 1 - i];
      if (home === '__bye__' || away === '__bye__') continue;
      matches.push({
        id: safeRandomUUID(),
        week: round + 1,
        homeClubId: home,
        awayClubId: away,
        played: false,
        homeGoals: 0,
        awayGoals: 0,
        events: [],
      });
    }
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  // Reverse fixtures (away becomes home)
  const firstHalf = [...matches];
  for (const m of firstHalf) {
    matches.push({
      id: safeRandomUUID(),
      week: m.week + total - 1,
      homeClubId: m.awayClubId,
      awayClubId: m.homeClubId,
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      events: [],
    });
  }

  return matches;
}

/**
 * Generate fixtures for a league, spread across totalWeeks.
 */
export function generateDivisionFixtures(clubIds: string[], totalWeeks: number): Match[] {
  const fixtures = generateFixtures(clubIds);
  const n = clubIds.length;
  // Odd team counts use a bye placeholder: the circle method then runs n
  // rounds per half (one team idle each round), so the calendar spans 2n
  // weeks, not 2(n-1). Computing 2(n-1) here made 13-team aus / 19-team tur
  // schedule their last two rounds beyond totalWeeks — the season force-
  // ended with one full round of fixtures unplayed and unplayable.
  const matchWeeks = n % 2 !== 0 ? 2 * n : 2 * (n - 1);

  if (matchWeeks >= totalWeeks) return fixtures;

  const gap = totalWeeks / matchWeeks;
  for (const match of fixtures) {
    match.week = Math.min(totalWeeks, Math.ceil(match.week * gap));
  }
  return fixtures;
}

/** Alias for new code */
export const generateLeagueFixtures = generateDivisionFixtures;

/**
 * Generate up to `PRESEASON_FRIENDLY_COUNT` pre-season friendlies, placed ONLY
 * on weeks the player's club is otherwise free.
 *
 * `occupiedWeeks` lists every week the player's club already has a competitive
 * match (league fixtures + known cup ties). Friendlies are slotted into the
 * earliest fixture-free weeks inside the pre-season window
 * (`FRIENDLY_PLACEMENT_MAX_WEEK`), so a friendly NEVER shares a week with a
 * league fixture or cup tie — this closes the weeks-1-3 double-booking bug
 * where a new manager played a friendly and then found another match the same
 * week. Densely-scheduled leagues (every week has a league fixture) get no
 * pre-season friendlies and start straight into the league.
 *
 * Opponents are randomly selected from the same division. Omitting
 * `occupiedWeeks` (or passing an empty list) falls back to the earliest weeks
 * 1..N — the legacy behaviour, preserved for callers/tests that don't thread a
 * fixture list through.
 */
export function generateFriendlies(
  playerClubId: string,
  divisionClubIds: string[],
  occupiedWeeks: number[] = [],
): Match[] {
  const pool = shuffle(divisionClubIds.filter(id => id !== playerClubId));
  if (pool.length === 0) return [];

  const busy = new Set(occupiedWeeks);
  const freeWeeks: number[] = [];
  for (let w = 1; w <= FRIENDLY_PLACEMENT_MAX_WEEK && freeWeeks.length < PRESEASON_FRIENDLY_COUNT; w++) {
    if (!busy.has(w)) freeWeeks.push(w);
  }

  return freeWeeks.map((week, i) => {
    const opponentId = pool[i % pool.length]; // allow rematches if pool < count
    const isHome = i % 2 === 0; // home, away, home
    return {
      id: safeRandomUUID(),
      week,
      homeClubId: isHome ? playerClubId : opponentId,
      awayClubId: isHome ? opponentId : playerClubId,
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      events: [],
    };
  });
}

/** Collect every week the given club already has a competitive match, from any
 *  mix of league-fixture arrays and cup-tie arrays. Used to keep pre-season
 *  friendlies off weeks that already hold a real match. */
export function collectOccupiedWeeks(
  clubId: string,
  matchSources: { homeClubId: string; awayClubId: string; week: number }[][],
): number[] {
  const weeks: number[] = [];
  for (const src of matchSources) {
    if (!src) continue;
    for (const m of src) {
      if (m && (m.homeClubId === clubId || m.awayClubId === clubId)) weeks.push(m.week);
    }
  }
  return weeks;
}

/**
 * Generate fixtures for all leagues at once.
 */
export function generateAllDivisionFixtures(
  divisionClubs: Record<string, string[]>,
): Record<string, Match[]> {
  const result: Record<string, Match[]> = {};
  for (const leagueId of Object.keys(divisionClubs)) {
    const league = LEAGUES.find(l => l.id === leagueId);
    const clubs = divisionClubs[leagueId];
    if (clubs && clubs.length > 1) {
      result[leagueId] = generateDivisionFixtures(clubs, league?.totalWeeks || 46);
    }
  }
  return result;
}

// ── Season calendar fit ──
// Every division is generated over its OWN length (`generateDivisionFixtures`),
// but the season ends on the USER's calendar (`state.totalWeeks`, the managed
// division's length). A Premier League save therefore ran 38 weeks while the
// Championship, League One and League Two were scheduled over 46: their last 8
// rounds — 96 fixtures per division, 17% of each season — were never played,
// and the season-end catch-up filled them with a strength-weighted random
// scoreline and no player stats — so a sixth of the promotion and relegation
// race in three divisions was never actually played. The living world has the
// same shape at every length: a Croatian save (18 weeks) played under half of
// the Premier League.
//
// The fit maps the outstanding rounds onto the weeks that remain, as real
// football does — longer divisions play midweek double rounds. Rounds stay
// intact and in order (a club still plays each opponent once per round), and
// doubled weeks go to weeks with no Cup, League Cup, continental or Super Cup
// football first, so a club's midweek league game lands on a free midweek.

const busyWeekCache = new Map<number, ReadonlySet<number>>();

/** Weeks of a `seasonWeeks`-week season that already carry knockout football
 *  (domestic Cup, League Cup, continental, Super Cups). Memoized per length. */
export function getCompetitionBusyWeeks(seasonWeeks: number): ReadonlySet<number> {
  const cached = busyWeekCache.get(seasonWeeks);
  if (cached) return cached;
  const cal = getCompetitionCalendar(seasonWeeks);
  const busy = new Set<number>([
    ...Object.values(cal.cupWeeks),
    ...Object.values(cal.leagueCupWeeks),
    ...cal.groupWeeks, ...cal.r16Weeks, ...cal.qfWeeks, ...cal.sfWeeks, cal.finalWeek,
    DOMESTIC_SUPER_CUP_WEEK, CONTINENTAL_SUPER_CUP_WEEK,
  ]);
  busyWeekCache.set(seasonWeeks, busy);
  return busy;
}

/** `count` items of `list`, spread evenly across it (order preserved). */
function spreadPick(list: number[], count: number): number[] {
  const n = list.length;
  if (count <= 0 || n === 0) return [];
  if (count >= n) return [...list];
  const out: number[] = [];
  for (let j = 0; j < count; j++) out.push(list[Math.floor(((j + 0.5) * n) / count)]);
  return out;
}

/**
 * Re-schedule a division's outstanding rounds so all of them fall inside a
 * `seasonWeeks`-week season, starting no earlier than `fromWeek`.
 *
 * Pure and deterministic (no RNG), and a no-op — returning the SAME array —
 * when every unplayed fixture already falls inside the season, so callers can
 * run it every week and it only ever acts once per season (or after the
 * calendar changes under a division, e.g. a league loaded mid-season). Played
 * fixtures and overdue ones (`week < fromWeek`, which the caller's catch-up
 * plays this tick anyway) are never moved.
 *
 * A "round" is a set of fixtures sharing a week: `generateDivisionFixtures`
 * stamps each round onto its own week, and a doubled week produced by an
 * earlier fit simply moves as one unit.
 */
export function fitDivisionFixturesToSeason(fixtures: Match[], seasonWeeks: number, fromWeek: number): Match[] {
  if (!fixtures?.length || !(seasonWeeks >= 1)) return fixtures;
  if (!fixtures.some(m => !m.played && m.week > seasonWeeks)) return fixtures;

  const start = Math.max(1, Math.min(Math.floor(fromWeek) || 1, seasonWeeks));
  const roundWeeks = [...new Set(fixtures.filter(m => !m.played && m.week >= start).map(m => m.week))]
    .sort((a, b) => a - b);
  const rounds = roundWeeks.length;
  const weeks = seasonWeeks - start + 1;

  const targets: number[] = [];
  if (rounds <= weeks) {
    // Room for one round per week: spread evenly, last round on the last week.
    for (let i = 0; i < rounds; i++) targets.push(start - 1 + Math.ceil(((i + 1) * weeks) / rounds));
  } else {
    // More rounds than weeks: every week takes `base` rounds, and `extra` weeks
    // take one more — quiet weeks first, then the rest, each spread evenly.
    const base = Math.floor(rounds / weeks);
    const extra = rounds - base * weeks;
    const busy = getCompetitionBusyWeeks(seasonWeeks);
    const quiet: number[] = [];
    const loud: number[] = [];
    for (let w = start; w <= seasonWeeks; w++) (busy.has(w) ? loud : quiet).push(w);
    const doubled = new Set(spreadPick(quiet, extra));
    for (const w of spreadPick(loud, extra - doubled.size)) doubled.add(w);
    for (let w = start; w <= seasonWeeks; w++) {
      const n = base + (doubled.has(w) ? 1 : 0);
      for (let k = 0; k < n; k++) targets.push(w);
    }
  }

  const moved = new Map<number, number>();
  roundWeeks.forEach((w, i) => { if (targets[i] !== w) moved.set(w, targets[i]); });
  if (moved.size === 0) return fixtures;
  return fixtures.map(m => (!m.played && moved.has(m.week) ? { ...m, week: moved.get(m.week)! } : m));
}

// ── League Table ──
// Module-level memoization for `buildLeagueTable`. Keyed on (playedCount,
// results hash, clubIds) so the same standings return a cached sort without
// rebuilding from scratch.
//
// The key used to be (playedCount, clubIds), which made correctness depend on
// every caller remembering to clear — and one did not (the `invincible`
// rewind). Folding the results into the key makes a stale hit structurally
// impossible rather than conventionally avoided; `clearLeagueTableCache()`
// stays as cheap hygiene on load/reset/rollover.
//
// A self-eviction guard at size 8 prevents unbounded growth if keys start
// churning (e.g. mid-season rollovers); it's a belt-and-braces safety net,
// not the primary clearing mechanism.
const _btlCache = new Map<string, LeagueTableEntry[]>();

/** Clear the league table cache. Call on game init / load / reset to prevent
 *  stale standings carrying across saves or season rollovers. */
export function clearLeagueTableCache() { _btlCache.clear(); }

export function buildLeagueTable(fixtures: Match[], clubIds: string[]): LeagueTableEntry[] {
  // Key on the RESULTS, not merely how many there are. Counting played
  // fixtures made two different scorelines at the same played count share a
  // cache entry, and the `invincible` perk reaches exactly that state:
  // `rewindMatch` restores the pre-match fixtures and table, the player
  // replays the tie, and the rebuild afterwards has the same fixture count and
  // the same clubs — so the table from the match they just erased was served
  // back and written into `leagueTable`/`divisionTables`. On the final week of
  // a season that is the table `endSeasonImpl` records history from.
  //
  // The hash costs one extra multiply-add per played fixture inside a scan the
  // old key already paid for; the work this memo exists to avoid is the table
  // build and the sort, both of which still get skipped on a true hit.
  let playedCount = 0;
  let resultsHash = 0;
  for (const m of fixtures) {
    if (!m.played) continue;
    playedCount++;
    resultsHash = (Math.imul(resultsHash, 31) + m.week * 1000 + m.homeGoals * 31 + m.awayGoals) | 0;
  }
  const cacheKey = `${playedCount}:${resultsHash}:${clubIds.join(',')}`;
  const cached = _btlCache.get(cacheKey);
  if (cached) return cached;
  if (_btlCache.size >= 8) _btlCache.clear();

  const table: Record<string, LeagueTableEntry> = {};
  clubIds.forEach(id => {
    table[id] = { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: [], cleanSheets: 0 };
  });

  const played = fixtures.filter(m => m.played).sort((a, b) => a.week - b.week);
  for (const m of played) {
    const h = table[m.homeClubId];
    const a = table[m.awayClubId];
    if (!h || !a) continue;
    h.played++; a.played++;
    h.goalsFor += m.homeGoals; h.goalsAgainst += m.awayGoals;
    a.goalsFor += m.awayGoals; a.goalsAgainst += m.homeGoals;
    if (m.awayGoals === 0) h.cleanSheets++;
    if (m.homeGoals === 0) a.cleanSheets++;
    if (m.homeGoals > m.awayGoals) {
      h.won++; a.lost++; h.points += 3;
      h.form.push('W'); a.form.push('L');
    } else if (m.homeGoals < m.awayGoals) {
      a.won++; h.lost++; a.points += 3;
      h.form.push('L'); a.form.push('W');
    } else {
      h.drawn++; a.drawn++; h.points++; a.points++;
      h.form.push('D'); a.form.push('D');
    }
    h.goalDifference = h.goalsFor - h.goalsAgainst;
    a.goalDifference = a.goalsFor - a.goalsAgainst;
    if (h.form.length > 5) h.form = h.form.slice(-5);
    if (a.form.length > 5) a.form = a.form.slice(-5);
  }

  // Precompute head-to-head results for tiebreaking (avoids O(n²×m) in sort)
  const h2h = new Map<string, number>();
  for (const m of played) {
    const keyAB = `${m.homeClubId}:${m.awayClubId}`;
    const keyBA = `${m.awayClubId}:${m.homeClubId}`;
    if (m.homeGoals > m.awayGoals) {
      h2h.set(keyAB, (h2h.get(keyAB) || 0) + 3);
    } else if (m.homeGoals < m.awayGoals) {
      h2h.set(keyBA, (h2h.get(keyBA) || 0) + 3);
    } else {
      h2h.set(keyAB, (h2h.get(keyAB) || 0) + 1);
      h2h.set(keyBA, (h2h.get(keyBA) || 0) + 1);
    }
  }

  const result = Object.values(table).sort((a, b) => {
    const diff = b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor;
    if (diff !== 0) return diff;
    // Head-to-head tiebreaker
    const aPts = h2h.get(`${a.clubId}:${b.clubId}`) || 0;
    const bPts = h2h.get(`${b.clubId}:${a.clubId}`) || 0;
    return bPts - aPts || a.clubId.localeCompare(b.clubId);
  });
  _btlCache.set(cacheKey, result);
  return result;
}

/**
 * Build league tables for all leagues.
 */
export function buildAllDivisionTables(
  divisionFixtures: Record<string, Match[]>,
  divisionClubs: Record<string, string[]>,
): Record<string, LeagueTableEntry[]> {
  const result: Record<string, LeagueTableEntry[]> = {};
  for (const leagueId of Object.keys(divisionClubs)) {
    result[leagueId] = buildLeagueTable(divisionFixtures[leagueId] || [], divisionClubs[leagueId] || []);
  }
  return result;
}
