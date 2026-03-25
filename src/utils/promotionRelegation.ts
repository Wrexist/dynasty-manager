/**
 * Season Turnover system for Dynasty Manager.
 * Handles end-of-season club replacement (abstract relegation).
 * Bottom N clubs in each league are replaced by procedurally-generated "promoted" clubs.
 */

import { LeagueId, LeagueInfo, LeagueTableEntry, SeasonTurnover, Club } from '@/types/game';
import { LEAGUES } from '@/data/league';
import type { ClubData } from '@/types/game';

// ── Determine replaced clubs from final table ──

export interface LeagueZones {
  safe: string[];
  replaced: string[];
}

export function determineZones(table: LeagueTableEntry[], league: LeagueInfo): LeagueZones {
  const ids = table.map(e => e.clubId);
  const n = ids.length;
  const { replacedSlots } = league;

  const safe = ids.slice(0, n - replacedSlots);
  const replaced = ids.slice(n - replacedSlots);

  return { safe, replaced };
}

// ── Apply season turnover ──

/**
 * Build the SeasonTurnover record from final table.
 * Bottom N clubs are marked for replacement.
 */
export function applySeasonTurnover(
  leagueId: LeagueId,
  leagueClubs: string[],
  leagueTable: LeagueTableEntry[],
  clubs: Record<string, Club>,
): { turnover: SeasonTurnover; updatedClubs: Record<string, Club>; updatedLeagueClubs: string[] } {
  const league = LEAGUES.find(l => l.id === leagueId);
  if (!league) {
    return {
      turnover: { replacedClubs: [], newClubs: [], leagueId },
      updatedClubs: clubs,
      updatedLeagueClubs: leagueClubs,
    };
  }

  const zones = determineZones(leagueTable, league);
  const turnover: SeasonTurnover = {
    replacedClubs: zones.replaced,
    newClubs: [],
    leagueId,
  };

  const newClubs = { ...clubs };
  const updatedLeagueClubs = leagueClubs.filter(id => !zones.replaced.includes(id));

  // Remove replaced clubs
  for (const cid of zones.replaced) {
    delete newClubs[cid];
  }

  return { turnover, updatedClubs: newClubs, updatedLeagueClubs };
}

// ── Generate replacement clubs ──

/** Replacement club name pools keyed by league country code */
const REPLACEMENT_POOLS: Record<string, { name: string; shortName: string; color: string; secondaryColor: string }[]> = {
  eng: [
    { name: 'Burnley', shortName: 'BUR', color: '#6C1D45', secondaryColor: '#99D6EA' },
    { name: 'Sheffield United', shortName: 'SHU', color: '#EE2737', secondaryColor: '#000000' },
    { name: 'Luton Town', shortName: 'LUT', color: '#F78F1E', secondaryColor: '#002D62' },
    { name: 'Sunderland', shortName: 'SUN', color: '#EB172B', secondaryColor: '#FFFFFF' },
    { name: 'Leeds United', shortName: 'LEE', color: '#FFFFFF', secondaryColor: '#1D428A' },
    { name: 'Norwich City', shortName: 'NOR', color: '#00A650', secondaryColor: '#FFF200' },
    { name: 'Middlesbrough', shortName: 'MID', color: '#E11B22', secondaryColor: '#FFFFFF' },
    { name: 'Coventry City', shortName: 'COV', color: '#5BB8F5', secondaryColor: '#FFFFFF' },
  ],
  esp: [
    { name: 'Eibar', shortName: 'EIB', color: '#2B388F', secondaryColor: '#E4002B' },
    { name: 'Huesca', shortName: 'HUE', color: '#2D2E83', secondaryColor: '#E40613' },
    { name: 'Sporting Gijón', shortName: 'SPG', color: '#E4002B', secondaryColor: '#FFFFFF' },
    { name: 'Racing Santander', shortName: 'RAC', color: '#009A44', secondaryColor: '#FFFFFF' },
  ],
  ita: [
    { name: 'Sassuolo', shortName: 'SAS', color: '#00A651', secondaryColor: '#000000' },
    { name: 'Salernitana', shortName: 'SAL', color: '#8B0000', secondaryColor: '#FFFFFF' },
    { name: 'Frosinone', shortName: 'FRO', color: '#FFD700', secondaryColor: '#003DA5' },
    { name: 'Cremonese', shortName: 'CRE', color: '#E30613', secondaryColor: '#808080' },
  ],
  ger: [
    { name: 'Schalke 04', shortName: 'S04', color: '#004D9D', secondaryColor: '#FFFFFF' },
    { name: 'Hamburger SV', shortName: 'HSV', color: '#0A3D8F', secondaryColor: '#FFFFFF' },
    { name: 'Hannover 96', shortName: 'H96', color: '#009639', secondaryColor: '#FFFFFF' },
    { name: 'Fortuna Düsseldorf', shortName: 'DUS', color: '#E4002B', secondaryColor: '#FFFFFF' },
  ],
  fra: [
    { name: 'Bordeaux', shortName: 'BOR', color: '#0E2A47', secondaryColor: '#FFFFFF' },
    { name: 'Metz', shortName: 'MET', color: '#8B0000', secondaryColor: '#FFFFFF' },
    { name: 'Caen', shortName: 'CAE', color: '#0047AB', secondaryColor: '#E30613' },
    { name: 'Lorient', shortName: 'LOR', color: '#F5821F', secondaryColor: '#000000' },
  ],
};

/** Default replacement names for leagues without a specific pool */
const DEFAULT_REPLACEMENTS = [
  { name: 'Promoted FC A', shortName: 'PFA', color: '#4A90D9', secondaryColor: '#FFFFFF' },
  { name: 'Promoted FC B', shortName: 'PFB', color: '#D94A4A', secondaryColor: '#FFFFFF' },
  { name: 'Promoted FC C', shortName: 'PFC', color: '#4AD94A', secondaryColor: '#FFFFFF' },
  { name: 'Promoted FC D', shortName: 'PFD', color: '#D9D94A', secondaryColor: '#FFFFFF' },
];

const replacementCounters: Record<string, number> = {};

export function generateReplacementClub(season: number, leagueId: LeagueId): { clubData: ClubData; clubId: string } {
  const pool = REPLACEMENT_POOLS[leagueId] || DEFAULT_REPLACEMENTS;
  if (!replacementCounters[leagueId]) replacementCounters[leagueId] = 0;
  const idx = replacementCounters[leagueId] % pool.length;
  replacementCounters[leagueId]++;

  const template = pool[idx];
  const league = LEAGUES.find(l => l.id === leagueId);

  const id = `replaced-${leagueId}-${season}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
  const baseQuality = league?.qualityTier === 1 ? 62 : league?.qualityTier === 2 ? 55 : league?.qualityTier === 3 ? 50 : 45;

  const clubData: ClubData = {
    id,
    name: template.name,
    shortName: template.shortName,
    color: template.color,
    secondaryColor: template.secondaryColor,
    budget: Math.floor((league?.prizeMoney || 300_000) * (0.8 + Math.random() * 0.4)),
    reputation: 2,
    facilities: 3 + Math.floor(Math.random() * 2),
    youthRating: 3 + Math.floor(Math.random() * 2),
    fanBase: 15 + Math.floor(Math.random() * 20),
    boardPatience: 8,
    squadQuality: baseQuality + Math.floor(Math.random() * 6),
    league: leagueId,
    divisionId: leagueId,
    stadiumName: `${template.name} Stadium`,
    stadiumCapacity: 8000 + Math.floor(Math.random() * 15000),
  };

  return { clubData, clubId: id };
}
