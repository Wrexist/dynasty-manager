#!/usr/bin/env node
/**
 * FC25 CSV Import Script
 * Parses fc25_players.csv and generates:
 * 1. Player template files per league (src/data/squads/*.ts)
 * 2. Club data files for new divisions (src/data/leagues/*.ts)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CSV_PATH = join(ROOT, 'fc25_players.csv');
const SQUADS_DIR = join(ROOT, 'src/data/squads');
const LEAGUES_DIR = join(ROOT, 'src/data/leagues');

// ── CSV League Name → Game League ID mapping ──
const LEAGUE_MAP = {
  'Premier League': 'eng',
  'EFL Championship': 'eng-2',
  'EFL League One': 'eng-3',
  'EFL League Two': 'eng-4',
  'Bundesliga': 'ger',
  'Bundesliga 2': 'ger-2',
  '3. Liga': 'ger-3',
  'LALIGA EA SPORTS': 'esp',
  'LALIGA HYPERMOTION': 'esp-2',
  'Serie A Enilive': 'ita',
  'Serie BKT': 'ita-2',
  "Ligue 1 McDonald's": 'fra',
  'Ligue 2 BKT': 'fra-2',
  'Eredivisie': 'ned',
  'Liga Portugal': 'por',
  '1A Pro League': 'bel',
  'Trendyol Süper Lig': 'tur',
  'PKO BP Ekstraklasa': 'pol',
  'Eliteserien': 'nor',
  'Allsvenskan': 'swe',
  '3F Superliga': 'den',
  'Ö. Bundesliga': 'aut',
  'Scottish Prem': 'sco',
  'SSE Airtricity PD': 'irl',
  'Hellas Liga': 'gre',
  'Česká Liga': 'cze',
  'Ukrayina Liha': 'ukr',
  'Liga Hrvatska': 'cro',
  'Magyar Liga': 'hun',
  'Liga Cyprus': 'cyp',
  'Finnliiga': 'fin',
};

// ── CSV Team Name → Game Club ID mapping for EXISTING clubs ──
// Only needed for tier-1 clubs that already have IDs in the game
const EXISTING_CLUB_IDS = {
  // England
  'Arsenal': 'arsenal', 'Aston Villa': 'aston-villa', 'AFC Bournemouth': 'bournemouth',
  'Brentford': 'brentford', 'Brighton': 'brighton', 'Chelsea': 'chelsea',
  'Crystal Palace': 'crystal-palace', 'Everton': 'everton', 'Fulham': 'fulham',
  'Ipswich Town': 'ipswich-town', 'Leicester City': 'leicester-city', 'Liverpool': 'liverpool',
  'Manchester City': 'manchester-city', 'Manchester United': 'manchester-united',
  'Newcastle United': 'newcastle-united', 'Nottingham Forest': 'nottingham-forest',
  'Southampton': 'southampton', 'Tottenham Hotspur': 'tottenham-hotspur',
  'West Ham United': 'west-ham-united', 'Wolverhampton Wanderers': 'wolverhampton-wanderers',
  // We'll auto-generate IDs for any club not in this map
};

// ── League metadata for NEW divisions ──
const NEW_LEAGUE_INFO = {
  'eng-2': {
    name: 'EFL Championship', shortName: 'EFL', country: 'England', countryCode: 'GB',
    teamCount: 24, totalWeeks: 46, replacedSlots: 0,
    description: 'The second tier of English football, featuring intense promotion battles and playoff drama.',
    difficulty: 'Hard', colorClass: 'text-orange-400', prizeMoney: 8000000,
    averageWage: 30000, qualityTier: 2, tier: 2, countryId: 'eng',
    promotionSpots: 2, relegationSpots: 3, playoffSpots: 4,
  },
  'eng-3': {
    name: 'EFL League One', shortName: 'L1', country: 'England', countryCode: 'GB',
    teamCount: 24, totalWeeks: 46, replacedSlots: 0,
    description: 'The third tier of English football with fierce competition for promotion to the Championship.',
    difficulty: 'Medium', colorClass: 'text-green-400', prizeMoney: 3000000,
    averageWage: 12000, qualityTier: 3, tier: 3, countryId: 'eng',
    promotionSpots: 2, relegationSpots: 4, playoffSpots: 4,
  },
  'eng-4': {
    name: 'EFL League Two', shortName: 'L2', country: 'England', countryCode: 'GB',
    teamCount: 24, totalWeeks: 46, replacedSlots: 3,
    description: 'The fourth tier of English football. Fight for promotion or face the drop out of the Football League.',
    difficulty: 'Medium', colorClass: 'text-cyan-400', prizeMoney: 1500000,
    averageWage: 6000, qualityTier: 4, tier: 4, countryId: 'eng',
    promotionSpots: 3, relegationSpots: 0, playoffSpots: 4,
  },
  'ger-2': {
    name: '2. Bundesliga', shortName: '2.BL', country: 'Germany', countryCode: 'DE',
    teamCount: 18, totalWeeks: 34, replacedSlots: 0,
    description: 'Germany\'s second division, known for large attendances and competitive promotion races.',
    difficulty: 'Hard', colorClass: 'text-orange-400', prizeMoney: 5000000,
    averageWage: 25000, qualityTier: 2, tier: 2, countryId: 'ger',
    promotionSpots: 2, relegationSpots: 2, playoffSpots: 1,
  },
  'ger-3': {
    name: '3. Liga', shortName: '3.L', country: 'Germany', countryCode: 'DE',
    teamCount: 20, totalWeeks: 38, replacedSlots: 3,
    description: 'Germany\'s third tier, a breeding ground for future Bundesliga stars.',
    difficulty: 'Medium', colorClass: 'text-green-400', prizeMoney: 2000000,
    averageWage: 10000, qualityTier: 3, tier: 3, countryId: 'ger',
    promotionSpots: 2, relegationSpots: 0, playoffSpots: 1,
  },
  'esp-2': {
    name: 'La Liga 2', shortName: 'LL2', country: 'Spain', countryCode: 'ES',
    teamCount: 22, totalWeeks: 42, replacedSlots: 3,
    description: 'Spain\'s second division, gateway to La Liga with dramatic promotion playoffs.',
    difficulty: 'Hard', colorClass: 'text-orange-400', prizeMoney: 4000000,
    averageWage: 20000, qualityTier: 2, tier: 2, countryId: 'esp',
    promotionSpots: 2, relegationSpots: 0, playoffSpots: 1,
  },
  'ita-2': {
    name: 'Serie B', shortName: 'SB', country: 'Italy', countryCode: 'IT',
    teamCount: 20, totalWeeks: 38, replacedSlots: 3,
    description: 'Italy\'s second tier, the stepping stone to Serie A with fierce competition.',
    difficulty: 'Hard', colorClass: 'text-orange-400', prizeMoney: 3500000,
    averageWage: 18000, qualityTier: 2, tier: 2, countryId: 'ita',
    promotionSpots: 2, relegationSpots: 0, playoffSpots: 1,
  },
  'fra-2': {
    name: 'Ligue 2', shortName: 'L2', country: 'France', countryCode: 'FR',
    teamCount: 18, totalWeeks: 34, replacedSlots: 3,
    description: 'France\'s second division, known for developing young talent and tight promotion battles.',
    difficulty: 'Hard', colorClass: 'text-orange-400', prizeMoney: 3000000,
    averageWage: 15000, qualityTier: 2, tier: 2, countryId: 'fra',
    promotionSpots: 2, relegationSpots: 0, playoffSpots: 1,
  },
};

// ── Default club colors for new clubs (fallback) ──
const DEFAULT_COLORS = [
  { color: '#E30613', secondaryColor: '#FFFFFF' },
  { color: '#003DA5', secondaryColor: '#FFFFFF' },
  { color: '#000000', secondaryColor: '#FFFFFF' },
  { color: '#FFD700', secondaryColor: '#000000' },
  { color: '#008C45', secondaryColor: '#FFFFFF' },
  { color: '#4B0082', secondaryColor: '#FFFFFF' },
  { color: '#FF6600', secondaryColor: '#000000' },
  { color: '#8B0000', secondaryColor: '#FFD700' },
];

// ── Well-known club colors ──
const CLUB_COLORS = {
  // Championship
  'Burnley': { color: '#6C1D45', secondaryColor: '#99D6EA' },
  'Sheffield United': { color: '#EE2737', secondaryColor: '#000000' },
  'Luton Town': { color: '#F78F1E', secondaryColor: '#002D62' },
  'Sunderland': { color: '#EB172B', secondaryColor: '#FFFFFF' },
  'Leeds United': { color: '#FFFFFF', secondaryColor: '#1D428A' },
  'Norwich City': { color: '#00A650', secondaryColor: '#FFF200' },
  'Middlesbrough': { color: '#E11B22', secondaryColor: '#FFFFFF' },
  'Coventry City': { color: '#5BB8F5', secondaryColor: '#FFFFFF' },
  'Stoke City': { color: '#E03A3E', secondaryColor: '#1B449C' },
  'Swansea City': { color: '#FFFFFF', secondaryColor: '#000000' },
  'Hull City': { color: '#F5A623', secondaryColor: '#000000' },
  'West Bromwich': { color: '#122F67', secondaryColor: '#FFFFFF' },
  'Millwall': { color: '#001D5E', secondaryColor: '#FFFFFF' },
  'Watford': { color: '#FBEE23', secondaryColor: '#ED2127' },
  'Preston': { color: '#FFFFFF', secondaryColor: '#003399' },
  'QPR': { color: '#1D5BA4', secondaryColor: '#FFFFFF' },
  'Blackburn Rovers': { color: '#009EE0', secondaryColor: '#FFFFFF' },
  'Bristol City': { color: '#E21C38', secondaryColor: '#FFFFFF' },
  'Cardiff City': { color: '#00529F', secondaryColor: '#D11124' },
  'Derby County': { color: '#FFFFFF', secondaryColor: '#000000' },
  'Oxford United': { color: '#F7E400', secondaryColor: '#003B71' },
  'Plymouth Argyle': { color: '#007B45', secondaryColor: '#FFFFFF' },
  'Portsmouth': { color: '#001489', secondaryColor: '#BBA14F' },
  'Sheffield Wednesday': { color: '#2257A8', secondaryColor: '#FFFFFF' },
  // Germany 2
  '1. FC Köln': { color: '#ED1C24', secondaryColor: '#FFFFFF' },
  '1. FC Nürnberg': { color: '#8B0000', secondaryColor: '#FFFFFF' },
  'Schalke 04': { color: '#004D9D', secondaryColor: '#FFFFFF' },
  'Hamburger SV': { color: '#0A3D8F', secondaryColor: '#FFFFFF' },
  'Hannover 96': { color: '#009639', secondaryColor: '#FFFFFF' },
  'Düsseldorf': { color: '#E4002B', secondaryColor: '#FFFFFF' },
  'Kaiserslautern': { color: '#E4002B', secondaryColor: '#FFFFFF' },
  'Hertha BSC': { color: '#005CA9', secondaryColor: '#FFFFFF' },
  'Braunschweig': { color: '#FFD700', secondaryColor: '#003DA5' },
  'SV Elversberg': { color: '#003DA5', secondaryColor: '#FFFFFF' },
  'Karlsruher SC': { color: '#003DA5', secondaryColor: '#FFFFFF' },
  'SC Paderborn': { color: '#003DA5', secondaryColor: '#FFFFFF' },
  'SpVgg Greuther Fürth': { color: '#008C45', secondaryColor: '#FFFFFF' },
  'SV Darmstadt 98': { color: '#004EA1', secondaryColor: '#FFFFFF' },
  '1. FC Magdeburg': { color: '#003DA5', secondaryColor: '#FFFFFF' },
  'SSV Ulm 1846': { color: '#000000', secondaryColor: '#FFFFFF' },
  'Jahn Regensburg': { color: '#E30613', secondaryColor: '#FFFFFF' },
  'Preußen Münster': { color: '#006633', secondaryColor: '#FFFFFF' },
  // Spain 2
  'Eibar': { color: '#2B388F', secondaryColor: '#E4002B' },
  'Sporting Gijón': { color: '#E4002B', secondaryColor: '#FFFFFF' },
  'Racing Santander': { color: '#009A44', secondaryColor: '#FFFFFF' },
  // Italy 2
  'Sassuolo': { color: '#00A651', secondaryColor: '#000000' },
  'Salernitana': { color: '#8B0000', secondaryColor: '#FFFFFF' },
  'Frosinone': { color: '#FFD700', secondaryColor: '#003DA5' },
  'Bari': { color: '#FFFFFF', secondaryColor: '#E30613' },
  'Brescia': { color: '#003DA5', secondaryColor: '#FFFFFF' },
  'Palermo': { color: '#F5ACB8', secondaryColor: '#000000' },
  'Sampdoria': { color: '#003DA5', secondaryColor: '#E30613' },
  'Cremonese': { color: '#E30613', secondaryColor: '#808080' },
  // France 2
  'Bordeaux': { color: '#0E2A47', secondaryColor: '#FFFFFF' },
  'Metz': { color: '#8B0000', secondaryColor: '#FFFFFF' },
  'Lorient': { color: '#F5821F', secondaryColor: '#000000' },
};

// ── Stadium names for well-known clubs ──
const CLUB_STADIUMS = {
  'Leeds United': { name: 'Elland Road', capacity: 37890 },
  'Sunderland': { name: 'Stadium of Light', capacity: 49000 },
  'Burnley': { name: 'Turf Moor', capacity: 21944 },
  'Sheffield United': { name: 'Bramall Lane', capacity: 32050 },
  'Norwich City': { name: 'Carrow Road', capacity: 27244 },
  'Middlesbrough': { name: 'Riverside Stadium', capacity: 34742 },
  'Coventry City': { name: 'Coventry Building Society Arena', capacity: 32609 },
  'Stoke City': { name: 'bet365 Stadium', capacity: 30089 },
  'Watford': { name: 'Vicarage Road', capacity: 22220 },
  'Hull City': { name: 'MKM Stadium', capacity: 25586 },
  'Millwall': { name: 'The Den', capacity: 20146 },
  'Derby County': { name: 'Pride Park', capacity: 33597 },
  'QPR': { name: 'Loftus Road', capacity: 18439 },
  'Swansea City': { name: 'Swansea.com Stadium', capacity: 21088 },
  'Blackburn Rovers': { name: 'Ewood Park', capacity: 31367 },
  'Bristol City': { name: 'Ashton Gate', capacity: 27000 },
  'Cardiff City': { name: 'Cardiff City Stadium', capacity: 33280 },
  'Preston': { name: 'Deepdale', capacity: 23404 },
  'Portsmouth': { name: 'Fratton Park', capacity: 20899 },
  'Plymouth Argyle': { name: 'Home Park', capacity: 18600 },
  'Oxford United': { name: 'Kassam Stadium', capacity: 12500 },
  'Sheffield Wednesday': { name: 'Hillsborough', capacity: 39732 },
  'West Bromwich': { name: 'The Hawthorns', capacity: 26850 },
  'Luton Town': { name: 'Kenilworth Road', capacity: 10356 },
  // Germany
  '1. FC Köln': { name: 'RheinEnergieStadion', capacity: 50000 },
  'Hamburger SV': { name: 'Volksparkstadion', capacity: 57000 },
  'Schalke 04': { name: 'Veltins-Arena', capacity: 62271 },
  'Hannover 96': { name: 'Heinz von Heiden Arena', capacity: 49200 },
  'Hertha BSC': { name: 'Olympiastadion', capacity: 74475 },
  '1. FC Nürnberg': { name: 'Max-Morlock-Stadion', capacity: 50000 },
  'Kaiserslautern': { name: 'Fritz-Walter-Stadion', capacity: 49780 },
  'Düsseldorf': { name: 'Merkur Spiel-Arena', capacity: 54600 },
  // Italy
  'Palermo': { name: 'Stadio Renzo Barbera', capacity: 36349 },
  'Sampdoria': { name: 'Stadio Luigi Ferraris', capacity: 36600 },
  'Bari': { name: 'Stadio San Nicola', capacity: 58270 },
  'Sassuolo': { name: 'Mapei Stadium', capacity: 23717 },
};

// ── Simple CSV parser that handles quoted fields ──
function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] || '';
    }
    results.push(obj);
  }
  return results;
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ── Parse CSV ──
console.log('Reading CSV...');
const csvContent = readFileSync(CSV_PATH, 'utf-8');
const records = parseCSV(csvContent);
console.log(`Parsed ${records.length} players`);

// ── Group players by league and team ──
const playersByLeagueTeam = {};
for (const row of records) {
  const csvLeague = row['League'];
  const team = row['Team'];
  const leagueId = LEAGUE_MAP[csvLeague];
  if (!leagueId || !team) continue;

  const key = `${leagueId}::${team}`;
  if (!playersByLeagueTeam[key]) {
    playersByLeagueTeam[key] = { leagueId, team, players: [] };
  }
  playersByLeagueTeam[key].players.push(row);
}

// ── Generate club ID from team name ──
function toClubId(teamName) {
  if (EXISTING_CLUB_IDS[teamName]) return EXISTING_CLUB_IDS[teamName];
  return teamName
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\./g, '')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/é/g, 'e')
    .replace(/í/g, 'i').replace(/ñ/g, 'n').replace(/ç/g, 'c').replace(/ó/g, 'o')
    .replace(/á/g, 'a').replace(/ú/g, 'u').replace(/è/g, 'e').replace(/à/g, 'a')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Map FC25 position to game position ──
function mapPosition(pos) {
  const valid = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
  const aliases = { LWB: 'LB', RWB: 'RB', CF: 'ST', LF: 'LW', RF: 'RW' };
  if (valid.includes(pos)) return pos;
  return aliases[pos] || 'CM'; // fallback
}

// ── Compute mental from sub-attributes ──
function computeMental(row) {
  const composure = parseInt(row['Composure']) || 50;
  const vision = parseInt(row['Vision']) || 50;
  const reactions = parseInt(row['Reactions']) || 50;
  return Math.round((composure + vision + reactions) / 3);
}

// ── Compute potential from age + OVR ──
function computePotential(age, ovr) {
  if (age <= 20) return Math.min(99, ovr + Math.floor(Math.random() * 10) + 8);
  if (age <= 23) return Math.min(99, ovr + Math.floor(Math.random() * 8) + 3);
  if (age <= 27) return Math.min(99, ovr + Math.floor(Math.random() * 4) + 1);
  if (age <= 30) return ovr;
  return Math.max(ovr - 2, 40);
}

// ── Generate short name from team name ──
function toShortName(name) {
  if (name.length <= 3) return name.toUpperCase();
  const abbrevs = {
    // England
    'AFC Bournemouth': 'BOU', 'Brighton': 'BHA', 'Crystal Palace': 'CRY',
    'Nottingham Forest': 'NFO', 'Wolverhampton Wanderers': 'WOL',
    'West Ham United': 'WHU', 'Tottenham Hotspur': 'TOT',
    'Manchester City': 'MCI', 'Manchester United': 'MUN',
    'Newcastle United': 'NEW', 'Leicester City': 'LEI',
    'Sheffield United': 'SHU', 'Sheffield Wednesday': 'SHW',
    'West Bromwich': 'WBA', 'Plymouth Argyle': 'PLY',
    'Blackburn Rovers': 'BLK', 'Bristol City': 'BRC', 'Cardiff City': 'CAR',
    'Coventry City': 'COV', 'Derby County': 'DER', 'Hull City': 'HUL',
    'Leeds United': 'LEE', 'Luton Town': 'LUT', 'Middlesbrough': 'MID',
    'Millwall': 'MIL', 'Norwich City': 'NOR', 'Oxford United': 'OXF',
    'Portsmouth': 'POM', 'Preston': 'PRE', 'Stoke City': 'STK',
    'Sunderland': 'SUN', 'Swansea City': 'SWA', 'Watford': 'WAT',
    'Burnley': 'BUR', 'Barnsley': 'BAR', 'Birmingham City': 'BIR',
    'Blackpool': 'BPL', 'Bolton': 'BOL', 'Bristol Rovers': 'BRR',
    'Burton Albion': 'BUA', 'Cambridge United': 'CAM',
    'Charlton Athletic': 'CHA', 'Cheltenham Town': 'CHE',
    'Crawley Town': 'CRA', 'Exeter City': 'EXE',
    'Huddersfield Town': 'HUD', 'Leyton Orient': 'LEO',
    'Lincoln City': 'LIN', 'Mansfield Town': 'MAN',
    'Northampton Town': 'NOR', 'Peterborough United': 'PET',
    'Reading': 'REA', 'Rotherham United': 'ROT',
    'Shrewsbury Town': 'SHR', 'Stevenage': 'STE', 'Stockport County': 'STO',
    'Wigan Athletic': 'WIG', 'Wrexham': 'WRX', 'Wycombe Wanderers': 'WYC',
    'AFC Wimbledon': 'WIM', 'Accrington': 'ACC', 'Barrow': 'BAW',
    'Bradford City': 'BRA', 'Bromley FC': 'BRM', 'Carlisle United': 'CLU',
    'Chesterfield': 'CHF', 'Colchester': 'COL', 'Crewe Alexandra': 'CRW',
    'Doncaster Rovers': 'DON', 'Fleetwood Town': 'FLE',
    'Gillingham': 'GIL', 'Grimsby Town': 'GRI',
    'Harrogate Town': 'HAR', 'MK Dons': 'MKD', 'Morecambe': 'MOR',
    'Newport County': 'NEW', 'Notts County': 'NOT',
    'Port Vale': 'PTV', 'Salford City': 'SAL', 'Swindon Town': 'SWI',
    'Tranmere Rovers': 'TRA', 'Walsall': 'WAL',
    // Germany
    '1. FC Köln': 'KOL', '1. FC Nürnberg': 'NUR', 'Schalke 04': 'S04',
    'Hamburger SV': 'HSV', 'Hannover 96': 'H96', 'Düsseldorf': 'DUS',
    'Kaiserslautern': 'KAI', 'Hertha BSC': 'BSC', 'Braunschweig': 'BSW',
    'SV Elversberg': 'ELV', 'Karlsruher SC': 'KSC', 'SC Paderborn': 'PAD',
    'SpVgg Greuther Fürth': 'FUR', 'SV Darmstadt 98': 'DAR',
    '1. FC Magdeburg': 'MAG', 'SSV Ulm 1846': 'ULM',
    'Jahn Regensburg': 'REG', 'Preußen Münster': 'MUN',
    '1860 München': 'M60', 'Arminia Bielefeld': 'BIE',
    'Dynamo Dresden': 'DRE', 'Waldhof Mannheim': 'WAL',
    'FC Ingolstadt': 'ING', 'Viktoria Köln': 'VIK', 'Hansa Rostock': 'ROS',
    'SC Verl': 'VER', 'SV Sandhausen': 'SAN', 'FC Erzgebirge Aue': 'AUE',
    'B. Dortmund II': 'BD2', 'Aleman. Aachen': 'AAC',
    'Energie Cottbus': 'COT', 'SpVgg Unterhaching': 'UNT',
    // Spain
    'Albacete BP': 'ALB', 'Burgos CF': 'BUR', 'CD Castellón': 'CAS',
    'CD Eldense': 'ELD', 'CD Mirandés': 'MIR', 'Córdoba CF': 'COR',
    'Cartagena CF': 'CRT', 'Deportivo de La Coruña': 'DEP',
    'Elche CF': 'ELC', 'FC Andorra': 'AND', 'Granada CF': 'GRA',
    'Huesca': 'HUE', 'Levante UD': 'LEV', 'Málaga CF': 'MAL',
    'Racing de Ferrol': 'FER', 'Racing de Santander': 'SAN',
    'Real Oviedo': 'OVI', 'Real Zaragoza': 'ZAR',
    'SD Eibar': 'EIB', 'Sporting Gijón': 'GIJ', 'Tenerife': 'TEN',
    // Italy
    'Bari': 'BAR', 'Brescia': 'BRE', 'Carrarese Calcio': 'CAR',
    'Catanzaro': 'CTZ', 'Cesena': 'CES', 'Cittadella': 'CTD',
    'Cosenza': 'COS', 'Cremonese': 'CRM', 'Frosinone': 'FRO',
    'Juve Stabia': 'JST', 'Mantova': 'MNT', 'Modena': 'MOD',
    'Palermo': 'PAL', 'Pisa': 'PIS', 'Reggiana': 'REG',
    'SALERNITANA': 'SAL', 'Sampdoria': 'SAM', 'Sassuolo': 'SAS',
    'Spezia': 'SPE', 'Spal': 'SPL',
    // France
    'AC Ajaccio': 'ACA', 'Amiens SC': 'AMI', 'Clermont Foot 63': 'CLE',
    'ESTAC Troyes': 'TRO', 'En Avant Guingamp': 'GUI',
    'FC Martigues': 'MAR', 'FC Metz': 'MET', 'Grenoble Foot 38': 'GRE',
    'Laval': 'LAV', 'Paris FC': 'PFC', 'Red Star FC': 'RST',
    'SC Bastia': 'BAS', 'SM Caen': 'CAE', 'Rodez AF': 'ROD',
    'Pau FC': 'PAU', 'US Dunkerque': 'DUN', 'Lorient': 'LOR',
    'FC Annecy': 'ANN',
  };
  if (abbrevs[name]) return abbrevs[name];
  // Fallback: first 3 characters of the name
  return name.replace(/^(FC |SC |AC |1\. |SV |SpVgg )/i, '').slice(0, 3).toUpperCase();
}

// ── Build player template from CSV row ──
function buildTemplate(row) {
  const ovr = parseInt(row['OVR']) || 60;
  const age = parseInt(row['Age']) || 25;
  const pos = mapPosition(row['Position']);
  const name = row['Name'] || 'Unknown';

  // Split name into first/last
  const parts = name.split(/\s+/);
  let fn, ln;
  if (parts.length === 1) {
    fn = parts[0];
    ln = parts[0];
  } else {
    fn = parts[0];
    ln = parts.slice(1).join(' ');
  }

  return {
    fn, ln,
    pos,
    age,
    nat: row['Nation'] || 'Unknown',
    ovr,
    pot: computePotential(age, ovr),
    pace: parseInt(row['PAC']) || 50,
    shooting: parseInt(row['SHO']) || 50,
    passing: parseInt(row['PAS']) || 50,
    defending: parseInt(row['DEF']) || 50,
    physical: parseInt(row['PHY']) || 50,
    mental: computeMental(row),
  };
}

// ── Escape string for TS output ──
function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Group teams by league ──
const teamsByLeague = {};
for (const { leagueId, team, players } of Object.values(playersByLeagueTeam)) {
  if (!teamsByLeague[leagueId]) teamsByLeague[leagueId] = {};
  teamsByLeague[leagueId][team] = players;
}

// ── Determine which leagues are NEW (need club data files) ──
const NEW_LEAGUE_IDS = new Set(Object.keys(NEW_LEAGUE_INFO));

// ── Map of leagueId → country file name for squads ──
const LEAGUE_TO_SQUAD_FILE = {
  'eng': 'england', 'eng-2': 'england2', 'eng-3': 'england3', 'eng-4': 'england4',
  'ger': 'germany', 'ger-2': 'germany2', 'ger-3': 'germany3',
  'esp': 'spain', 'esp-2': 'spain2',
  'ita': 'italy', 'ita-2': 'italy2',
  'fra': 'france', 'fra-2': 'france2',
  'ned': 'netherlands', 'por': 'portugal', 'bel': 'belgium', 'tur': 'turkey',
  'pol': 'poland', 'nor': 'norway', 'swe': 'sweden', 'den': 'denmark',
  'aut': 'austria', 'sco': 'scotland', 'irl': 'ireland',
  'gre': 'greece', 'cze': 'czechia', 'ukr': 'ukraine', 'cro': 'croatia',
  'hun': 'hungary', 'cyp': 'cyprus', 'fin': 'finland',
};

// ── Generate squad files ──
console.log('\nGenerating squad files...');
for (const [leagueId, teams] of Object.entries(teamsByLeague)) {
  const fileName = LEAGUE_TO_SQUAD_FILE[leagueId];
  if (!fileName) {
    console.log(`  Skipping league ${leagueId} (no file mapping)`);
    continue;
  }

  const filePath = join(SQUADS_DIR, `${fileName}.ts`);
  let output = `import type { PlayerTemplate } from '@/data/playerTemplates';\n\n`;
  output += `// ${leagueId} — Auto-generated from FC25 data\n`;
  output += `export const SQUADS: Record<string, PlayerTemplate[]> = {\n`;

  const sortedTeams = Object.keys(teams).sort();
  for (const team of sortedTeams) {
    const players = teams[team];
    const clubId = toClubId(team);
    const templates = players.map(buildTemplate);
    // Sort: GK first, then by OVR descending
    templates.sort((a, b) => {
      if (a.pos === 'GK' && b.pos !== 'GK') return -1;
      if (b.pos === 'GK' && a.pos !== 'GK') return 1;
      return b.ovr - a.ovr;
    });

    output += `  '${esc(clubId)}': [\n`;
    for (const t of templates) {
      output += `    { fn: '${esc(t.fn)}', ln: '${esc(t.ln)}', pos: '${t.pos}', age: ${t.age}, nat: '${esc(t.nat)}', ovr: ${t.ovr}, pot: ${t.pot}, pace: ${t.pace}, shooting: ${t.shooting}, passing: ${t.passing}, defending: ${t.defending}, physical: ${t.physical}, mental: ${t.mental} },\n`;
    }
    output += `  ],\n`;
  }
  output += `};\n`;

  writeFileSync(filePath, output);
  console.log(`  ${filePath} (${sortedTeams.length} clubs)`);
}

// ── Generate league data files for NEW divisions ──
console.log('\nGenerating new league data files...');
for (const [leagueId, info] of Object.entries(NEW_LEAGUE_INFO)) {
  const teams = teamsByLeague[leagueId];
  if (!teams) {
    console.log(`  Skipping ${leagueId} (no teams in CSV)`);
    continue;
  }

  const fileName = LEAGUE_TO_SQUAD_FILE[leagueId];
  const filePath = join(LEAGUES_DIR, `${fileName}.ts`);

  let output = `import type { ClubData, LeagueInfo } from '@/types/game';\n\n`;
  output += `export const LEAGUE_INFO: LeagueInfo = {\n`;
  output += `  id: '${leagueId}',\n`;
  output += `  name: '${esc(info.name)}',\n`;
  output += `  shortName: '${esc(info.shortName)}',\n`;
  output += `  country: '${esc(info.country)}',\n`;
  output += `  countryCode: '${esc(info.countryCode)}',\n`;
  output += `  teamCount: ${info.teamCount},\n`;
  output += `  totalWeeks: ${info.totalWeeks},\n`;
  output += `  replacedSlots: ${info.replacedSlots},\n`;
  output += `  description: '${esc(info.description)}',\n`;
  output += `  difficulty: '${esc(info.difficulty)}',\n`;
  output += `  colorClass: '${esc(info.colorClass)}',\n`;
  output += `  prizeMoney: ${info.prizeMoney},\n`;
  output += `  averageWage: ${info.averageWage},\n`;
  output += `  qualityTier: ${info.qualityTier},\n`;
  output += `  tier: ${info.tier},\n`;
  output += `  countryId: '${esc(info.countryId)}',\n`;
  output += `  promotionSpots: ${info.promotionSpots},\n`;
  output += `  relegationSpots: ${info.relegationSpots},\n`;
  output += `  playoffSpots: ${info.playoffSpots},\n`;
  output += `};\n\n`;

  // Generate club data
  output += `export const CLUBS: ClubData[] = [\n`;
  const sortedTeams = Object.keys(teams).sort();

  for (let i = 0; i < sortedTeams.length; i++) {
    const team = sortedTeams[i];
    const clubId = toClubId(team);
    const colors = CLUB_COLORS[team] || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    const stadium = CLUB_STADIUMS[team] || { name: `${team} Stadium`, capacity: 10000 + Math.floor(Math.random() * 15000) };
    const shortName = toShortName(team);

    // Scale quality based on tier
    const tierMultiplier = info.qualityTier === 2 ? 0.85 : info.qualityTier === 3 ? 0.7 : 0.55;
    const avgOvr = teams[team].reduce((s, p) => s + (parseInt(p['OVR']) || 60), 0) / teams[team].length;
    const squadQuality = Math.round(avgOvr * tierMultiplier + (1 - tierMultiplier) * avgOvr);

    const budget = Math.round(info.prizeMoney * (0.5 + Math.random() * 0.6));
    const reputation = info.qualityTier <= 2 ? (avgOvr > 72 ? 4 : avgOvr > 68 ? 3 : 2) : (avgOvr > 65 ? 3 : 2);

    output += `  {\n`;
    output += `    id: '${esc(clubId)}',\n`;
    output += `    name: '${esc(team)}',\n`;
    output += `    shortName: '${esc(shortName)}',\n`;
    output += `    color: '${colors.color}',\n`;
    output += `    secondaryColor: '${colors.secondaryColor}',\n`;
    output += `    budget: ${budget},\n`;
    output += `    reputation: ${reputation},\n`;
    output += `    facilities: ${Math.max(2, Math.min(8, Math.round(reputation * 1.5 + Math.random())))},\n`;
    output += `    youthRating: ${Math.max(2, Math.min(8, Math.round(reputation * 1.3 + Math.random())))},\n`;
    output += `    fanBase: ${Math.round(15 + reputation * 10 + Math.random() * 15)},\n`;
    output += `    boardPatience: ${Math.round(5 + Math.random() * 3)},\n`;
    output += `    squadQuality: ${squadQuality},\n`;
    output += `    league: '${leagueId}',\n`;
    output += `    divisionId: '${leagueId}',\n`;
    output += `    stadiumName: '${esc(stadium.name)}',\n`;
    output += `    stadiumCapacity: ${stadium.capacity},\n`;
    output += `  },\n`;
  }
  output += `];\n`;

  writeFileSync(filePath, output);
  console.log(`  ${filePath} (${sortedTeams.length} clubs)`);
}

// ── Summary ──
console.log('\n=== SUMMARY ===');
let totalClubs = 0;
let totalPlayers = 0;
for (const [leagueId, teams] of Object.entries(teamsByLeague)) {
  const clubCount = Object.keys(teams).length;
  const playerCount = Object.values(teams).reduce((s, p) => s + p.length, 0);
  totalClubs += clubCount;
  totalPlayers += playerCount;
  console.log(`  ${leagueId}: ${clubCount} clubs, ${playerCount} players`);
}
console.log(`\nTotal: ${totalClubs} clubs, ${totalPlayers} players`);
console.log('\nDone!');
