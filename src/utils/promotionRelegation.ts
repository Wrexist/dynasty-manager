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
  ned: [
    { name: 'SC Cambuur', shortName: 'CAM', color: '#FFD700', secondaryColor: '#003DA5' },
    { name: 'Excelsior', shortName: 'EXC', color: '#E30613', secondaryColor: '#000000' },
    { name: 'FC Emmen', shortName: 'EMM', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'De Graafschap', shortName: 'GRA', color: '#0047AB', secondaryColor: '#FFFFFF' },
    { name: 'Roda JC', shortName: 'ROD', color: '#FFD700', secondaryColor: '#000000' },
  ],
  por: [
    { name: 'Chaves', shortName: 'CHV', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Tondela', shortName: 'TON', color: '#008C45', secondaryColor: '#FFD700' },
    { name: 'Desportivo de Aves', shortName: 'AVE', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Nacional', shortName: 'NAC', color: '#000000', secondaryColor: '#FFFFFF' },
    { name: 'Portimonense', shortName: 'POR', color: '#000000', secondaryColor: '#FFD700' },
  ],
  bel: [
    { name: 'Beerschot', shortName: 'BEE', color: '#4B0082', secondaryColor: '#FFFFFF' },
    { name: 'Lommel SK', shortName: 'LOM', color: '#008C45', secondaryColor: '#FFFFFF' },
    { name: 'RWDM', shortName: 'RWD', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Waasland-Beveren', shortName: 'WBE', color: '#FFD700', secondaryColor: '#003DA5' },
    { name: 'Dender', shortName: 'DEN', color: '#E30613', secondaryColor: '#000000' },
  ],
  tur: [
    { name: 'Pendikspor', shortName: 'PEN', color: '#8B0000', secondaryColor: '#FFD700' },
    { name: 'İstanbulspor', shortName: 'IST', color: '#FFD700', secondaryColor: '#000000' },
    { name: 'Giresunspor', shortName: 'GIR', color: '#008C45', secondaryColor: '#FFFFFF' },
    { name: 'Ankaragücü', shortName: 'ANK', color: '#003DA5', secondaryColor: '#FFD700' },
    { name: 'Eyüpspor', shortName: 'EYU', color: '#E30613', secondaryColor: '#FFFFFF' },
  ],
  cze: [
    { name: 'Dukla Praha', shortName: 'DUK', color: '#8B0000', secondaryColor: '#FFD700' },
    { name: 'Zbrojovka Brno', shortName: 'ZBR', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Vlašim', shortName: 'VLA', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Žižkov', shortName: 'ZIZ', color: '#E30613', secondaryColor: '#000000' },
  ],
  gre: [
    { name: 'Ionikos', shortName: 'ION', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Levadiakos', shortName: 'LEV', color: '#008C45', secondaryColor: '#FFFFFF' },
    { name: 'Apollon Smyrnis', shortName: 'APO', color: '#87CEEB', secondaryColor: '#FFFFFF' },
    { name: 'Giannina', shortName: 'GIA', color: '#003DA5', secondaryColor: '#000000' },
    { name: 'Kallithea', shortName: 'KAL', color: '#4B0082', secondaryColor: '#FFFFFF' },
  ],
  pol: [
    { name: 'Wisła Kraków', shortName: 'WIS', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'ŁKS Łódź', shortName: 'LKS', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Arka Gdynia', shortName: 'ARK', color: '#FFD700', secondaryColor: '#003DA5' },
    { name: 'Miedź Legnica', shortName: 'MIE', color: '#B87333', secondaryColor: '#008C45' },
    { name: 'Sandecja Nowy Sącz', shortName: 'SAN', color: '#003DA5', secondaryColor: '#FFFFFF' },
  ],
  den: [
    { name: 'Lyngby', shortName: 'LYN', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Hobro IK', shortName: 'HOB', color: '#E30613', secondaryColor: '#003DA5' },
    { name: 'Esbjerg fB', shortName: 'ESB', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Hvidovre IF', shortName: 'HVI', color: '#003DA5', secondaryColor: '#E30613' },
  ],
  nor: [
    { name: 'Stabæk', shortName: 'STB', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Start', shortName: 'STA', color: '#FFD700', secondaryColor: '#000000' },
    { name: 'Sogndal', shortName: 'SOG', color: '#000000', secondaryColor: '#FFFFFF' },
    { name: 'Mjøndalen', shortName: 'MJO', color: '#8B4513', secondaryColor: '#FFFFFF' },
    { name: 'Ranheim', shortName: 'RAN', color: '#008C45', secondaryColor: '#FFFFFF' },
  ],
  che: [
    { name: 'Grasshoppers', shortName: 'GCZ', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'FC Schaffhausen', shortName: 'SHA', color: '#000000', secondaryColor: '#FFD700' },
    { name: 'FC Aarau', shortName: 'AAR', color: '#000000', secondaryColor: '#FFFFFF' },
    { name: 'FC Thun', shortName: 'THU', color: '#E30613', secondaryColor: '#003DA5' },
    { name: 'Vaduz', shortName: 'VAD', color: '#003DA5', secondaryColor: '#E30613' },
  ],
  aut: [
    { name: 'Ried', shortName: 'RIE', color: '#000000', secondaryColor: '#008C45' },
    { name: 'SKN St. Pölten', shortName: 'STP', color: '#003DA5', secondaryColor: '#FFD700' },
    { name: 'Admira Wacker', shortName: 'ADM', color: '#000000', secondaryColor: '#E30613' },
    { name: 'Wacker Innsbruck', shortName: 'WAC', color: '#008C45', secondaryColor: '#000000' },
  ],
  sco: [
    { name: 'Partick Thistle', shortName: 'PAR', color: '#FFD700', secondaryColor: '#E30613' },
    { name: 'Raith Rovers', shortName: 'RAI', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Inverness CT', shortName: 'INV', color: '#003DA5', secondaryColor: '#E30613' },
    { name: "Queen's Park", shortName: 'QPK', color: '#000000', secondaryColor: '#FFD700' },
    { name: 'Airdrieonians', shortName: 'AIR', color: '#FFFFFF', secondaryColor: '#E30613' },
  ],
  swe: [
    { name: 'Helsingborg', shortName: 'HEL', color: '#E30613', secondaryColor: '#003DA5' },
    { name: 'Örebro SK', shortName: 'ORE', color: '#000000', secondaryColor: '#FFFFFF' },
    { name: 'Östersund', shortName: 'OST', color: '#E30613', secondaryColor: '#000000' },
    { name: 'Falkenberg', shortName: 'FAL', color: '#FFD700', secondaryColor: '#003DA5' },
    { name: 'AFC Eskilstuna', shortName: 'ESK', color: '#000000', secondaryColor: '#FFD700' },
  ],
  cro: [
    { name: 'Slaven Belupo', shortName: 'SBE', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Inter Zaprešić', shortName: 'INZ', color: '#FFD700', secondaryColor: '#000000' },
    { name: 'Gorica', shortName: 'GOR', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Cibalia', shortName: 'CIB', color: '#003DA5', secondaryColor: '#E30613' },
  ],
  hun: [
    { name: 'Vasas', shortName: 'VAS', color: '#E30613', secondaryColor: '#003DA5' },
    { name: 'Honvéd', shortName: 'HON', color: '#E30613', secondaryColor: '#000000' },
    { name: 'Diósgyőr', shortName: 'DIO', color: '#E30613', secondaryColor: '#FFD700' },
    { name: 'Gyirmót', shortName: 'GYI', color: '#008C45', secondaryColor: '#FFFFFF' },
  ],
  srb: [
    { name: 'Voždovac', shortName: 'VOZ', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Kolubara', shortName: 'KOL', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Radnik Surdulica', shortName: 'RAD', color: '#E30613', secondaryColor: '#000000' },
    { name: 'Spartak Subotica', shortName: 'SPS', color: '#003DA5', secondaryColor: '#E30613' },
    { name: 'Železničar Pančevo', shortName: 'ZEL', color: '#003DA5', secondaryColor: '#FFFFFF' },
  ],
  rou: [
    { name: 'Dinamo București', shortName: 'DIN', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Rapid București', shortName: 'RAP', color: '#4B0082', secondaryColor: '#FFFFFF' },
    { name: 'Petrolul Ploiești', shortName: 'PET', color: '#FFD700', secondaryColor: '#003DA5' },
    { name: 'Argeș Pitești', shortName: 'ARG', color: '#4B0082', secondaryColor: '#FFFFFF' },
    { name: 'UTA Arad', shortName: 'UTA', color: '#E30613', secondaryColor: '#FFFFFF' },
  ],
  ukr: [
    { name: 'Metallist Kharkiv', shortName: 'MTL', color: '#FFD700', secondaryColor: '#003DA5' },
    { name: 'Karpaty Lviv', shortName: 'KAR', color: '#008C45', secondaryColor: '#FFFFFF' },
    { name: 'Chornomorets Odesa', shortName: 'CHO', color: '#003DA5', secondaryColor: '#000000' },
    { name: 'Metalist 1925', shortName: 'M25', color: '#FFD700', secondaryColor: '#003DA5' },
  ],
  bgr: [
    { name: 'Botev Plovdiv', shortName: 'BOT', color: '#FFD700', secondaryColor: '#000000' },
    { name: 'Beroe', shortName: 'BER', color: '#008C45', secondaryColor: '#FFFFFF' },
    { name: 'Lokomotiv Plovdiv', shortName: 'LPL', color: '#000000', secondaryColor: '#E30613' },
    { name: 'Pirin Blagoevgrad', shortName: 'PIR', color: '#008C45', secondaryColor: '#FFFFFF' },
  ],
  svk: [
    { name: 'Trenčín', shortName: 'TRE', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Senica', shortName: 'SEN', color: '#003DA5', secondaryColor: '#FFD700' },
    { name: 'Pohronie', shortName: 'POH', color: '#008C45', secondaryColor: '#FFFFFF' },
    { name: 'Skalica', shortName: 'SKA', color: '#E30613', secondaryColor: '#000000' },
  ],
  fin: [
    { name: 'HIFK', shortName: 'HIK', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'AC Oulu', shortName: 'ACO', color: '#000000', secondaryColor: '#FFD700' },
    { name: 'FC Haka', shortName: 'HAK', color: '#FFFFFF', secondaryColor: '#000000' },
    { name: 'MP Mikkeli', shortName: 'MPM', color: '#003DA5', secondaryColor: '#FFFFFF' },
  ],
  isl: [
    { name: 'ÍBV Vestmannaeyjar', shortName: 'IBV', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Grindavík', shortName: 'GRN', color: '#000000', secondaryColor: '#FFD700' },
    { name: 'Keflavík', shortName: 'KEF', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Throttur', shortName: 'THR', color: '#003DA5', secondaryColor: '#E30613' },
  ],
  irl: [
    { name: 'Finn Harps', shortName: 'FIN', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Longford Town', shortName: 'LON', color: '#E30613', secondaryColor: '#000000' },
    { name: 'Wexford', shortName: 'WEX', color: '#4B0082', secondaryColor: '#FFFFFF' },
    { name: 'Bray Wanderers', shortName: 'BRA', color: '#008C45', secondaryColor: '#FFFFFF' },
    { name: 'Cobh Ramblers', shortName: 'COB', color: '#E30613', secondaryColor: '#008C45' },
  ],
  isr: [
    { name: 'Hapoel Tel Aviv', shortName: 'HTA', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Bnei Sakhnin', shortName: 'BNS', color: '#008C45', secondaryColor: '#FFFFFF' },
    { name: 'Hapoel Haifa', shortName: 'HHA', color: '#E30613', secondaryColor: '#000000' },
    { name: 'Ironi Kiryat Shmona', shortName: 'IKS', color: '#003DA5', secondaryColor: '#FFD700' },
  ],
  cyp: [
    { name: 'Ethnikos Achna', shortName: 'ETH', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Doxa Katokopias', shortName: 'DOX', color: '#008C45', secondaryColor: '#FFFFFF' },
    { name: 'Ermis Aradippou', shortName: 'ERM', color: '#FFD700', secondaryColor: '#003DA5' },
    { name: 'Karmiotissa', shortName: 'KAR', color: '#E30613', secondaryColor: '#FFFFFF' },
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
