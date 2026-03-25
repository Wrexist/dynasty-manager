import { ClubData, Match, LeagueTableEntry, LeagueId, LeagueInfo, DerbyRivalry } from '@/types/game';

// ── Import all leagues ──
import { ALL_LEAGUES, ALL_CLUBS_DATA } from './leagues';

// ── Re-export for backward compatibility ──
export const LEAGUES: LeagueInfo[] = ALL_LEAGUES;
/** @deprecated Use LEAGUES instead */
export const DIVISIONS = LEAGUES;

export const CLUBS_DATA: ClubData[] = ALL_CLUBS_DATA;
/** Alias for new code */
export const ALL_CLUBS = ALL_CLUBS_DATA;

// ── Real Derby Rivalries ──
export const DERBIES: DerbyRivalry[] = [
  // England
  { clubIdA: 'manchester-city', clubIdB: 'manchester-united', name: 'Manchester Derby', intensity: 3 },
  { clubIdA: 'liverpool', clubIdB: 'everton', name: 'Merseyside Derby', intensity: 3 },
  { clubIdA: 'arsenal', clubIdB: 'tottenham', name: 'North London Derby', intensity: 3 },
  { clubIdA: 'chelsea', clubIdB: 'fulham', name: 'West London Derby', intensity: 2 },
  { clubIdA: 'crystal-palace', clubIdB: 'brighton', name: 'M23 Derby', intensity: 2 },
  { clubIdA: 'newcastle', clubIdB: 'sunderland', name: 'Tyne–Wear Derby', intensity: 3 },
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
  { clubIdA: 'borussia-dortmund', clubIdB: 'schalke-04', name: 'Revierderby', intensity: 3 },
  // France
  { clubIdA: 'paris-saint-germain', clubIdB: 'marseille', name: 'Le Classique', intensity: 3 },
  { clubIdA: 'lyon', clubIdB: 'saint-etienne', name: 'Derby Rhône-Alpes', intensity: 3 },
  // Netherlands
  { clubIdA: 'ajax', clubIdB: 'feyenoord', name: 'De Klassieker', intensity: 3 },
  { clubIdA: 'ajax', clubIdB: 'psv', name: 'De Topper', intensity: 2 },
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
export function getClubsByLeague(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const league of LEAGUES) {
    result[league.id] = [];
  }
  for (const club of CLUBS_DATA) {
    if (!result[club.divisionId]) result[club.divisionId] = [];
    result[club.divisionId].push(club.id);
  }
  return result;
}

/** @deprecated Use getClubsByLeague instead */
export const getClubsByDivision = getClubsByLeague;

export function getLeague(id: LeagueId): LeagueInfo {
  return LEAGUES.find(l => l.id === id)!;
}

/** @deprecated Use getLeague instead */
export const getDivision = getLeague;

// ── Fixture Generation ──
export function generateFixtures(clubIds: string[]): Match[] {
  const n = clubIds.length;
  if (n < 2) return [];
  const matches: Match[] = [];
  const teams = [...clubIds];

  // If odd number of teams, add a "bye" placeholder
  const hasBye = n % 2 !== 0;
  if (hasBye) teams.push('__bye__');
  const total = teams.length;

  for (let round = 0; round < total - 1; round++) {
    for (let i = 0; i < total / 2; i++) {
      const home = teams[i];
      const away = teams[total - 1 - i];
      if (home === '__bye__' || away === '__bye__') continue;
      matches.push({
        id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
  const matchWeeks = 2 * (n - 1);

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

// ── League Table ──
const _btlCache = new Map<string, LeagueTableEntry[]>();

export function buildLeagueTable(fixtures: Match[], clubIds: string[]): LeagueTableEntry[] {
  const playedCount = fixtures.filter(m => m.played).length;
  const cacheKey = `${playedCount}:${clubIds.length}:${clubIds[0] || ''}`;
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

  const result = Object.values(table).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
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
