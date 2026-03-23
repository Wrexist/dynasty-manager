import { ClubData, Match, LeagueTableEntry, DivisionId, DivisionInfo, DerbyRivalry } from '@/types/game';

// ── Division Definitions ──
export const DIVISIONS: DivisionInfo[] = [
  {
    id: 'div-1', name: 'Monarch Premier League', shortName: 'MPL', tier: 1,
    teamCount: 20, totalWeeks: 46, autoPromoteSlots: 0, playoffSlots: 0,
    autoRelegateSlots: 3, replacedSlots: 0,
    description: 'The pinnacle of football. Massive budgets, world-class squads, and relentless expectations.',
    difficulty: 'Easy', colorClass: 'text-primary',
    prizeMoney: 10_000_000, averageWage: 120_000,
  },
  {
    id: 'div-2', name: 'Dynasty Championship', shortName: 'DCH', tier: 2,
    teamCount: 24, totalWeeks: 46, autoPromoteSlots: 2, playoffSlots: 4,
    autoRelegateSlots: 3, replacedSlots: 0,
    description: 'Ambitious clubs with strong foundations. Prove yourself among rising giants.',
    difficulty: 'Medium', colorClass: 'text-blue-400',
    prizeMoney: 3_000_000, averageWage: 50_000,
  },
  {
    id: 'div-3', name: 'Sovereign First Division', shortName: 'SFD', tier: 3,
    teamCount: 24, totalWeeks: 46, autoPromoteSlots: 2, playoffSlots: 4,
    autoRelegateSlots: 3, replacedSlots: 0,
    description: 'Limited resources demand tactical brilliance and smart transfers.',
    difficulty: 'Hard', colorClass: 'text-amber-400',
    prizeMoney: 1_000_000, averageWage: 20_000,
  },
  {
    id: 'div-4', name: 'Foundation League', shortName: 'FDN', tier: 4,
    teamCount: 24, totalWeeks: 46, autoPromoteSlots: 2, playoffSlots: 4,
    autoRelegateSlots: 0, replacedSlots: 2,
    description: 'Build from nothing. The ultimate test of a dynasty manager.',
    difficulty: 'Very Hard', colorClass: 'text-destructive',
    prizeMoney: 300_000, averageWage: 8_000,
  },
];

// ── 92 Clubs ──
export const CLUBS_DATA: ClubData[] = [
  // ═══ DIV-1: Monarch Premier League (20 clubs) ═══
  { id: 'crown-city', name: 'Crown City FC', shortName: 'CRO', color: '#6CABDD', secondaryColor: '#1C2C5B', budget: 250_000_000, reputation: 5, facilities: 10, youthRating: 9, fanBase: 90, boardPatience: 5, squadQuality: 88, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'The Crown Arena', stadiumCapacity: 55_000 },
  { id: 'redfield-utd', name: 'Redfield United', shortName: 'RED', color: '#DA291C', secondaryColor: '#FFE500', budget: 220_000_000, reputation: 5, facilities: 10, youthRating: 10, fanBase: 98, boardPatience: 4, squadQuality: 86, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Old Redfield', stadiumCapacity: 75_000 },
  { id: 'ashford-fc', name: 'Ashford FC', shortName: 'ASH', color: '#EF0107', secondaryColor: '#FFFFFF', budget: 180_000_000, reputation: 5, facilities: 9, youthRating: 9, fanBase: 82, boardPatience: 5, squadQuality: 84, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Ashford Park', stadiumCapacity: 60_000 },
  { id: 'merseyside-fc', name: 'Anfield Athletic', shortName: 'ANF', color: '#C8102E', secondaryColor: '#00B2A9', budget: 170_000_000, reputation: 5, facilities: 9, youthRating: 8, fanBase: 92, boardPatience: 5, squadQuality: 84, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Riverside Park', stadiumCapacity: 54_000 },
  { id: 'royal-blues', name: 'Royal Blues', shortName: 'ROY', color: '#034694', secondaryColor: '#DBA111', budget: 200_000_000, reputation: 5, facilities: 9, youthRating: 8, fanBase: 78, boardPatience: 4, squadQuality: 83, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'The Royal Ground', stadiumCapacity: 42_000 },
  { id: 'north-wanderers', name: 'North Wanderers', shortName: 'NOR', color: '#FFFFFF', secondaryColor: '#132257', budget: 140_000_000, reputation: 4, facilities: 8, youthRating: 8, fanBase: 72, boardPatience: 5, squadQuality: 80, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Wanderers Stadium', stadiumCapacity: 62_000 },
  { id: 'tyneside-utd', name: 'Tyneside United', shortName: 'TYN', color: '#241F20', secondaryColor: '#FFFFFF', budget: 150_000_000, reputation: 4, facilities: 8, youthRating: 7, fanBase: 85, boardPatience: 5, squadQuality: 80, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Tyne Bridge Arena', stadiumCapacity: 52_000 },
  { id: 'aston-bridge', name: 'Aston Bridge', shortName: 'AST', color: '#670E36', secondaryColor: '#95BFE5', budget: 110_000_000, reputation: 4, facilities: 7, youthRating: 7, fanBase: 68, boardPatience: 6, squadQuality: 78, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Bridge Park', stadiumCapacity: 42_000 },
  { id: 'western-hammers', name: 'Western Hammers', shortName: 'WES', color: '#7A263A', secondaryColor: '#1BB1E7', budget: 90_000_000, reputation: 4, facilities: 7, youthRating: 6, fanBase: 62, boardPatience: 6, squadQuality: 76, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Ironworks Stadium', stadiumCapacity: 62_000 },
  { id: 'brighton-shore', name: 'Brighton Shore', shortName: 'BRI', color: '#0057B8', secondaryColor: '#FFFFFF', budget: 100_000_000, reputation: 4, facilities: 8, youthRating: 8, fanBase: 52, boardPatience: 7, squadQuality: 77, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Shoreline Community Stadium', stadiumCapacity: 31_000 },
  { id: 'wolverton', name: 'Wolverton FC', shortName: 'WOL', color: '#FDB913', secondaryColor: '#231F20', budget: 85_000_000, reputation: 4, facilities: 7, youthRating: 7, fanBase: 58, boardPatience: 6, squadQuality: 75, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Molineux Park', stadiumCapacity: 32_000 },
  { id: 'everton-blue', name: 'Kirkdale Blues', shortName: 'KBL', color: '#003399', secondaryColor: '#FFFFFF', budget: 85_000_000, reputation: 4, facilities: 7, youthRating: 6, fanBase: 62, boardPatience: 5, squadQuality: 74, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Dockside Park', stadiumCapacity: 53_000 },
  { id: 'brentwood', name: 'Brentwood FC', shortName: 'BRE', color: '#E30613', secondaryColor: '#FBB800', budget: 85_000_000, reputation: 4, facilities: 7, youthRating: 8, fanBase: 42, boardPatience: 8, squadQuality: 75, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Brentwood Community Stadium', stadiumCapacity: 17_250 },
  { id: 'forest-green', name: 'Forest Green', shortName: 'FOR', color: '#DD0000', secondaryColor: '#FFFFFF', budget: 90_000_000, reputation: 4, facilities: 7, youthRating: 7, fanBase: 68, boardPatience: 6, squadQuality: 74, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Sherwood Ground', stadiumCapacity: 30_000 },
  { id: 'palace-park', name: 'Palace Park', shortName: 'PAL', color: '#1B458F', secondaryColor: '#C4122E', budget: 80_000_000, reputation: 4, facilities: 6, youthRating: 6, fanBase: 48, boardPatience: 6, squadQuality: 73, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Selhurst Lane', stadiumCapacity: 26_000 },
  { id: 'fulham-cross', name: 'Fulham Cross', shortName: 'FUL', color: '#FFFFFF', secondaryColor: '#CC0000', budget: 80_000_000, reputation: 4, facilities: 6, youthRating: 5, fanBase: 42, boardPatience: 6, squadQuality: 72, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Craven Lane', stadiumCapacity: 25_000 },
  { id: 'bourneport', name: 'Bourneport', shortName: 'BOU', color: '#DA291C', secondaryColor: '#000000', budget: 75_000_000, reputation: 3, facilities: 6, youthRating: 5, fanBase: 36, boardPatience: 7, squadQuality: 71, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Vitality Road', stadiumCapacity: 11_000 },
  { id: 'southgate-fc', name: 'Southgate FC', shortName: 'SGA', color: '#E8E8E8', secondaryColor: '#002147', budget: 85_000_000, reputation: 4, facilities: 7, youthRating: 6, fanBase: 52, boardPatience: 6, squadQuality: 73, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Southgate Stadium', stadiumCapacity: 35_000 },
  { id: 'ipswich-vale', name: 'Ipswich Vale', shortName: 'IPS', color: '#0033A0', secondaryColor: '#FFFFFF', budget: 70_000_000, reputation: 3, facilities: 6, youthRating: 6, fanBase: 44, boardPatience: 7, squadQuality: 70, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Portman Lane', stadiumCapacity: 30_000 },
  { id: 'leicester-fox', name: 'Foxborough City', shortName: 'FOX', color: '#003090', secondaryColor: '#FDBE11', budget: 80_000_000, reputation: 4, facilities: 7, youthRating: 6, fanBase: 58, boardPatience: 6, squadQuality: 72, league: 'premier-elite', divisionId: 'div-1', stadiumName: 'Monarch Power Stadium', stadiumCapacity: 32_000 },

  // ═══ DIV-2: Dynasty Championship (24 clubs) ═══
  { id: 'burnston', name: 'Burnston FC', shortName: 'BUR', color: '#6C1D45', secondaryColor: '#99D6EA', budget: 60_000_000, reputation: 3, facilities: 6, youthRating: 5, fanBase: 50, boardPatience: 6, squadQuality: 76, league: 'championship', divisionId: 'div-2', stadiumName: 'Turf Lane', stadiumCapacity: 22_000 },
  { id: 'sheffield-steel', name: 'Sheffield Steel', shortName: 'SHE', color: '#EE2737', secondaryColor: '#000000', budget: 55_000_000, reputation: 3, facilities: 6, youthRating: 5, fanBase: 55, boardPatience: 6, squadQuality: 74, league: 'championship', divisionId: 'div-2', stadiumName: 'Steelworks Arena', stadiumCapacity: 32_000 },
  { id: 'luton-rise', name: 'Luton Rise', shortName: 'LUT', color: '#F78F1E', secondaryColor: '#002D62', budget: 30_000_000, reputation: 3, facilities: 5, youthRating: 5, fanBase: 35, boardPatience: 7, squadQuality: 66, league: 'championship', divisionId: 'div-2', stadiumName: 'Kenilworth Lane', stadiumCapacity: 12_000 },
  { id: 'stonebridge-city', name: 'Stonebridge City', shortName: 'STO', color: '#1E5AA8', secondaryColor: '#FFD700', budget: 50_000_000, reputation: 3, facilities: 6, youthRating: 6, fanBase: 52, boardPatience: 6, squadQuality: 72, league: 'championship', divisionId: 'div-2', stadiumName: 'Stonebridge Stadium', stadiumCapacity: 28_000 },
  { id: 'coventry-phoenix', name: 'Coventry Phoenix', shortName: 'COV', color: '#5BB8F5', secondaryColor: '#FFFFFF', budget: 40_000_000, reputation: 3, facilities: 5, youthRating: 6, fanBase: 45, boardPatience: 7, squadQuality: 69, league: 'championship', divisionId: 'div-2', stadiumName: 'Phoenix Arena', stadiumCapacity: 32_000 },
  { id: 'blackpool-tide', name: 'Blackpool Tide', shortName: 'BPT', color: '#FF6B00', secondaryColor: '#FFFFFF', budget: 25_000_000, reputation: 3, facilities: 5, youthRating: 5, fanBase: 38, boardPatience: 7, squadQuality: 65, league: 'championship', divisionId: 'div-2', stadiumName: 'Promenade Park', stadiumCapacity: 17_000 },
  { id: 'norwich-canary', name: 'Broadland City', shortName: 'BLC', color: '#00A650', secondaryColor: '#FFF200', budget: 45_000_000, reputation: 3, facilities: 6, youthRating: 7, fanBase: 48, boardPatience: 7, squadQuality: 70, league: 'championship', divisionId: 'div-2', stadiumName: 'Carrow Lane', stadiumCapacity: 27_000 },
  { id: 'middlesbrough-iron', name: 'Middlesbrough Iron', shortName: 'MBI', color: '#E11B22', secondaryColor: '#FFFFFF', budget: 35_000_000, reputation: 3, facilities: 5, youthRating: 5, fanBase: 50, boardPatience: 6, squadQuality: 68, league: 'championship', divisionId: 'div-2', stadiumName: 'Riverside Ground', stadiumCapacity: 34_000 },
  { id: 'sunderland-port', name: 'Sunderland Port', shortName: 'SUN', color: '#EB172B', secondaryColor: '#FFFFFF', budget: 45_000_000, reputation: 3, facilities: 5, youthRating: 6, fanBase: 60, boardPatience: 6, squadQuality: 70, league: 'championship', divisionId: 'div-2', stadiumName: 'Port of Light Stadium', stadiumCapacity: 49_000 },
  { id: 'swansea-swan', name: 'Swansea Swan', shortName: 'SWA', color: '#FFFFFF', secondaryColor: '#000000', budget: 30_000_000, reputation: 3, facilities: 5, youthRating: 6, fanBase: 38, boardPatience: 7, squadQuality: 66, league: 'championship', divisionId: 'div-2', stadiumName: 'Liberty Lane', stadiumCapacity: 21_000 },
  { id: 'watford-horn', name: 'Watford Horn', shortName: 'WAT', color: '#FBEE23', secondaryColor: '#ED2127', budget: 40_000_000, reputation: 3, facilities: 5, youthRating: 5, fanBase: 42, boardPatience: 6, squadQuality: 68, league: 'championship', divisionId: 'div-2', stadiumName: 'Vicarage Lane', stadiumCapacity: 22_000 },
  { id: 'hull-tigers', name: 'Humber Town', shortName: 'HUM', color: '#F5A623', secondaryColor: '#000000', budget: 28_000_000, reputation: 3, facilities: 5, youthRating: 5, fanBase: 38, boardPatience: 7, squadQuality: 65, league: 'championship', divisionId: 'div-2', stadiumName: 'KC Stadium', stadiumCapacity: 25_000 },
  { id: 'bristol-bear', name: 'Bristol Bear', shortName: 'BRB', color: '#E21837', secondaryColor: '#FFFFFF', budget: 35_000_000, reputation: 3, facilities: 5, youthRating: 6, fanBase: 44, boardPatience: 7, squadQuality: 67, league: 'championship', divisionId: 'div-2', stadiumName: 'Ashton Gate', stadiumCapacity: 27_000 },
  { id: 'cardiff-dragon', name: 'Dragonmoor City', shortName: 'DRM', color: '#0070B5', secondaryColor: '#D01012', budget: 32_000_000, reputation: 3, facilities: 5, youthRating: 5, fanBase: 42, boardPatience: 7, squadQuality: 66, league: 'championship', divisionId: 'div-2', stadiumName: 'Dragonmoor Stadium', stadiumCapacity: 33_000 },
  { id: 'derby-rams', name: 'Ramworth County', shortName: 'RAM', color: '#FFFFFF', secondaryColor: '#000000', budget: 28_000_000, reputation: 3, facilities: 5, youthRating: 6, fanBase: 48, boardPatience: 7, squadQuality: 64, league: 'championship', divisionId: 'div-2', stadiumName: 'Pride Park', stadiumCapacity: 33_000 },
  { id: 'millwall-lions', name: 'Dockside Lions', shortName: 'DOC', color: '#001D5E', secondaryColor: '#FFFFFF', budget: 22_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 38, boardPatience: 7, squadQuality: 63, league: 'championship', divisionId: 'div-2', stadiumName: 'The Den', stadiumCapacity: 20_000 },
  { id: 'preston-end', name: 'Preston End', shortName: 'PRE', color: '#FFFFFF', secondaryColor: '#00205B', budget: 22_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 36, boardPatience: 8, squadQuality: 62, league: 'championship', divisionId: 'div-2', stadiumName: 'Deepdale Park', stadiumCapacity: 24_000 },
  { id: 'queens-park', name: 'Queens Park', shortName: 'QPR', color: '#0047AB', secondaryColor: '#FFFFFF', budget: 35_000_000, reputation: 3, facilities: 5, youthRating: 5, fanBase: 40, boardPatience: 6, squadQuality: 65, league: 'championship', divisionId: 'div-2', stadiumName: 'Loftus Lane', stadiumCapacity: 18_000 },
  { id: 'plymouth-argyle', name: 'Plymouth Argyle', shortName: 'PLY', color: '#00573F', secondaryColor: '#FFFFFF', budget: 20_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 35, boardPatience: 8, squadQuality: 62, league: 'championship', divisionId: 'div-2', stadiumName: 'Home Park', stadiumCapacity: 18_000 },
  { id: 'stoke-potter', name: 'Stoke Potter', shortName: 'STK', color: '#E03A3E', secondaryColor: '#1B449C', budget: 28_000_000, reputation: 3, facilities: 5, youthRating: 5, fanBase: 42, boardPatience: 7, squadQuality: 64, league: 'championship', divisionId: 'div-2', stadiumName: 'Britannia Lane', stadiumCapacity: 30_000 },
  { id: 'west-bromwich', name: 'West Bromwich', shortName: 'WBA', color: '#122F67', secondaryColor: '#FFFFFF', budget: 28_000_000, reputation: 3, facilities: 5, youthRating: 5, fanBase: 40, boardPatience: 7, squadQuality: 64, league: 'championship', divisionId: 'div-2', stadiumName: 'The Hawthorns', stadiumCapacity: 27_000 },
  { id: 'reading-royals', name: 'Reading Royals', shortName: 'RDG', color: '#004494', secondaryColor: '#FFFFFF', budget: 22_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 34, boardPatience: 7, squadQuality: 61, league: 'championship', divisionId: 'div-2', stadiumName: 'Madejski Stadium', stadiumCapacity: 24_000 },
  { id: 'birmingham-hart', name: 'Birmingham Hart', shortName: 'BIR', color: '#0000FF', secondaryColor: '#FFFFFF', budget: 28_000_000, reputation: 3, facilities: 5, youthRating: 5, fanBase: 45, boardPatience: 7, squadQuality: 64, league: 'championship', divisionId: 'div-2', stadiumName: 'St Andrews Lane', stadiumCapacity: 29_000 },
  { id: 'leeds-white', name: 'Leeds White', shortName: 'LEE', color: '#FFFFFF', secondaryColor: '#1D428A', budget: 55_000_000, reputation: 3, facilities: 6, youthRating: 6, fanBase: 68, boardPatience: 5, squadQuality: 75, league: 'championship', divisionId: 'div-2', stadiumName: 'Elland Road', stadiumCapacity: 37_000 },

  // ═══ DIV-3: Sovereign First Division (24 clubs) ═══
  { id: 'barnsley-tyke', name: 'Barnsley Tyke', shortName: 'BAR', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 15_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 32, boardPatience: 7, squadQuality: 62, league: 'first-division', divisionId: 'div-3', stadiumName: 'Oakwell Lane', stadiumCapacity: 23_000 },
  { id: 'bolton-trotter', name: 'Bolton Trotter', shortName: 'BOL', color: '#FFFFFF', secondaryColor: '#001E62', budget: 18_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 38, boardPatience: 7, squadQuality: 63, league: 'first-division', divisionId: 'div-3', stadiumName: 'Burnden Park', stadiumCapacity: 28_000 },
  { id: 'charlton-vale', name: 'Charlton Vale', shortName: 'CHV', color: '#D4021D', secondaryColor: '#FFFFFF', budget: 16_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 35, boardPatience: 7, squadQuality: 61, league: 'first-division', divisionId: 'div-3', stadiumName: 'The Valley', stadiumCapacity: 27_000 },
  { id: 'exeter-city', name: 'Exeter City', shortName: 'EXE', color: '#D4021D', secondaryColor: '#FFFFFF', budget: 12_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 28, boardPatience: 8, squadQuality: 58, league: 'first-division', divisionId: 'div-3', stadiumName: 'St James Park', stadiumCapacity: 9_000 },
  { id: 'portsmouth-dock', name: 'Portsmouth Dock', shortName: 'POR', color: '#001489', secondaryColor: '#C8102E', budget: 20_000_000, reputation: 2, facilities: 5, youthRating: 5, fanBase: 45, boardPatience: 6, squadQuality: 64, league: 'first-division', divisionId: 'div-3', stadiumName: 'Fratton End', stadiumCapacity: 21_000 },
  { id: 'oxford-scholar', name: 'Oxford Scholar', shortName: 'OXF', color: '#FFFF00', secondaryColor: '#002147', budget: 14_000_000, reputation: 2, facilities: 4, youthRating: 6, fanBase: 30, boardPatience: 7, squadQuality: 60, league: 'first-division', divisionId: 'div-3', stadiumName: 'Kassam Park', stadiumCapacity: 12_500 },
  { id: 'wigan-pier', name: 'Wigan Pier', shortName: 'WIG', color: '#0047AB', secondaryColor: '#FFFFFF', budget: 16_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 32, boardPatience: 7, squadQuality: 60, league: 'first-division', divisionId: 'div-3', stadiumName: 'Springfield Park', stadiumCapacity: 25_000 },
  { id: 'rotherham-mill', name: 'Rotherham Mill', shortName: 'ROT', color: '#E21A23', secondaryColor: '#FFE400', budget: 12_000_000, reputation: 2, facilities: 3, youthRating: 4, fanBase: 25, boardPatience: 8, squadQuality: 56, league: 'first-division', divisionId: 'div-3', stadiumName: 'Millmoor Lane', stadiumCapacity: 12_000 },
  { id: 'peterborough-eagle', name: 'Peterborough Eagle', shortName: 'PET', color: '#004AAD', secondaryColor: '#FFFFFF', budget: 14_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 28, boardPatience: 8, squadQuality: 58, league: 'first-division', divisionId: 'div-3', stadiumName: 'London Road', stadiumCapacity: 15_000 },
  { id: 'lincoln-imp', name: 'Lincoln Imp', shortName: 'LIN', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 12_000_000, reputation: 2, facilities: 3, youthRating: 5, fanBase: 26, boardPatience: 8, squadQuality: 57, league: 'first-division', divisionId: 'div-3', stadiumName: 'Sincil Bank', stadiumCapacity: 10_000 },
  { id: 'shrewsbury-town', name: 'Shrewsbury Town', shortName: 'SHR', color: '#0000FF', secondaryColor: '#FFD700', budget: 10_000_000, reputation: 2, facilities: 3, youthRating: 4, fanBase: 22, boardPatience: 8, squadQuality: 55, league: 'first-division', divisionId: 'div-3', stadiumName: 'The Meadow', stadiumCapacity: 10_000 },
  { id: 'cambridge-united', name: 'Cambridge United', shortName: 'CAM', color: '#F5A623', secondaryColor: '#000000', budget: 12_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 24, boardPatience: 8, squadQuality: 57, league: 'first-division', divisionId: 'div-3', stadiumName: 'Abbey Stadium', stadiumCapacity: 8_000 },
  { id: 'burton-athletic', name: 'Burton Athletic', shortName: 'BUA', color: '#FFFF00', secondaryColor: '#000000', budget: 9_000_000, reputation: 1, facilities: 3, youthRating: 4, fanBase: 20, boardPatience: 9, squadQuality: 54, league: 'first-division', divisionId: 'div-3', stadiumName: 'Pirelli Ground', stadiumCapacity: 7_000 },
  { id: 'northampton-cobblers', name: 'Northampton Cobblers', shortName: 'NHC', color: '#800020', secondaryColor: '#FFFFFF', budget: 10_000_000, reputation: 2, facilities: 3, youthRating: 4, fanBase: 22, boardPatience: 8, squadQuality: 55, league: 'first-division', divisionId: 'div-3', stadiumName: 'Sixfields Park', stadiumCapacity: 7_750 },
  { id: 'leyton-orient', name: 'Leyton Orient', shortName: 'LEY', color: '#D4021D', secondaryColor: '#FFFFFF', budget: 11_000_000, reputation: 2, facilities: 3, youthRating: 4, fanBase: 24, boardPatience: 8, squadQuality: 56, league: 'first-division', divisionId: 'div-3', stadiumName: 'Brisbane Road', stadiumCapacity: 9_300 },
  { id: 'cheltenham-spa', name: 'Cheltenham Spa', shortName: 'CHL', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 9_000_000, reputation: 1, facilities: 3, youthRating: 4, fanBase: 20, boardPatience: 9, squadQuality: 53, league: 'first-division', divisionId: 'div-3', stadiumName: 'Whaddon Lane', stadiumCapacity: 7_000 },
  { id: 'fleetwood-cod', name: 'Fleetwood Town', shortName: 'FLE', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 10_000_000, reputation: 2, facilities: 3, youthRating: 4, fanBase: 18, boardPatience: 8, squadQuality: 54, league: 'first-division', divisionId: 'div-3', stadiumName: 'Highbury Lane', stadiumCapacity: 5_300 },
  { id: 'wycombe-chair', name: 'Wycombe Athletic', shortName: 'WYA', color: '#004B87', secondaryColor: '#78CDD1', budget: 10_000_000, reputation: 2, facilities: 3, youthRating: 5, fanBase: 22, boardPatience: 8, squadQuality: 55, league: 'first-division', divisionId: 'div-3', stadiumName: 'Adams Park', stadiumCapacity: 10_000 },
  { id: 'huddersfield-terrier', name: 'Huddersfield Terrier', shortName: 'HUD', color: '#0E63AD', secondaryColor: '#FFFFFF', budget: 18_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 36, boardPatience: 7, squadQuality: 62, league: 'first-division', divisionId: 'div-3', stadiumName: 'Kirklees Stadium', stadiumCapacity: 24_000 },
  { id: 'blackburn-rover', name: 'Blackburn Rover', shortName: 'BLR', color: '#009EE0', secondaryColor: '#FFFFFF', budget: 20_000_000, reputation: 2, facilities: 5, youthRating: 5, fanBase: 40, boardPatience: 7, squadQuality: 63, league: 'first-division', divisionId: 'div-3', stadiumName: 'Ewood Park', stadiumCapacity: 31_000 },
  { id: 'charlbury-athletic', name: 'Charlbury Athletic', shortName: 'CHA', color: '#CC0000', secondaryColor: '#FFFFFF', budget: 14_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 30, boardPatience: 8, squadQuality: 59, league: 'first-division', divisionId: 'div-3', stadiumName: 'Charlbury Park', stadiumCapacity: 15_000 },
  { id: 'stockport-hat', name: 'Stockport County', shortName: 'SPC', color: '#0047AB', secondaryColor: '#FFFFFF', budget: 12_000_000, reputation: 2, facilities: 3, youthRating: 4, fanBase: 28, boardPatience: 8, squadQuality: 57, league: 'first-division', divisionId: 'div-3', stadiumName: 'Edgeley Park', stadiumCapacity: 11_000 },
  { id: 'bristol-manor', name: 'Bristol Manor', shortName: 'BRM', color: '#0047AB', secondaryColor: '#FFFFFF', budget: 15_000_000, reputation: 2, facilities: 4, youthRating: 5, fanBase: 32, boardPatience: 7, squadQuality: 61, league: 'first-division', divisionId: 'div-3', stadiumName: 'Memorial Ground', stadiumCapacity: 12_000 },
  { id: 'reading-park', name: 'Reading Park', shortName: 'RDP', color: '#003DA5', secondaryColor: '#FFD700', budget: 13_000_000, reputation: 2, facilities: 3, youthRating: 4, fanBase: 26, boardPatience: 8, squadQuality: 58, league: 'first-division', divisionId: 'div-3', stadiumName: 'Elm Park', stadiumCapacity: 15_000 },

  // ═══ DIV-4: Foundation League (24 clubs) ═══
  { id: 'grimsby-mariner', name: 'Grimsby Mariner', shortName: 'GRI', color: '#000000', secondaryColor: '#FFFFFF', budget: 6_000_000, reputation: 1, facilities: 3, youthRating: 3, fanBase: 20, boardPatience: 8, squadQuality: 52, league: 'foundation', divisionId: 'div-4', stadiumName: 'Blundell Park', stadiumCapacity: 9_000 },
  { id: 'carlisle-border', name: 'Carlisle Border', shortName: 'CRL', color: '#0047AB', secondaryColor: '#FFFFFF', budget: 4_000_000, reputation: 1, facilities: 2, youthRating: 3, fanBase: 18, boardPatience: 9, squadQuality: 49, league: 'foundation', divisionId: 'div-4', stadiumName: 'Brunton Park', stadiumCapacity: 18_000 },
  { id: 'swindon-robin', name: 'Swindon Robin', shortName: 'SWN', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 5_000_000, reputation: 1, facilities: 3, youthRating: 3, fanBase: 20, boardPatience: 8, squadQuality: 50, league: 'foundation', divisionId: 'div-4', stadiumName: 'County Ground', stadiumCapacity: 15_000 },
  { id: 'crewe-railway', name: 'Crewe Railway', shortName: 'CRW', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 4_000_000, reputation: 1, facilities: 3, youthRating: 4, fanBase: 16, boardPatience: 9, squadQuality: 48, league: 'foundation', divisionId: 'div-4', stadiumName: 'Gresty Road', stadiumCapacity: 10_000 },
  { id: 'doncaster-bell', name: 'Doncaster Bell', shortName: 'DON', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 5_000_000, reputation: 1, facilities: 3, youthRating: 3, fanBase: 22, boardPatience: 8, squadQuality: 50, league: 'foundation', divisionId: 'div-4', stadiumName: 'Keepmoat Lane', stadiumCapacity: 15_000 },
  { id: 'morecambe-bay', name: 'Morecambe Bay', shortName: 'MOR', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 2_500_000, reputation: 1, facilities: 2, youthRating: 2, fanBase: 12, boardPatience: 9, squadQuality: 44, league: 'foundation', divisionId: 'div-4', stadiumName: 'Globe Arena', stadiumCapacity: 6_500 },
  { id: 'accrington-crown', name: 'Accrington Crown', shortName: 'ACC', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 2_500_000, reputation: 1, facilities: 2, youthRating: 2, fanBase: 10, boardPatience: 9, squadQuality: 43, league: 'foundation', divisionId: 'div-4', stadiumName: 'Crown Ground', stadiumCapacity: 5_500 },
  { id: 'harrogate-spa', name: 'Harrogate Spa', shortName: 'HAR', color: '#FFD700', secondaryColor: '#000000', budget: 2_500_000, reputation: 1, facilities: 2, youthRating: 2, fanBase: 10, boardPatience: 9, squadQuality: 43, league: 'foundation', divisionId: 'div-4', stadiumName: 'Wetherby Road', stadiumCapacity: 5_000 },
  { id: 'mansfield-stag', name: 'Mansfield Stag', shortName: 'MAN', color: '#F5A623', secondaryColor: '#0047AB', budget: 4_500_000, reputation: 1, facilities: 3, youthRating: 3, fanBase: 18, boardPatience: 8, squadQuality: 48, league: 'foundation', divisionId: 'div-4', stadiumName: 'Field Mill', stadiumCapacity: 10_000 },
  { id: 'colchester-eagle', name: 'Colchester Eagle', shortName: 'COL', color: '#0047AB', secondaryColor: '#FFFFFF', budget: 4_000_000, reputation: 1, facilities: 3, youthRating: 3, fanBase: 16, boardPatience: 9, squadQuality: 47, league: 'foundation', divisionId: 'div-4', stadiumName: 'Community Stadium', stadiumCapacity: 10_000 },
  { id: 'bradford-bantam', name: 'Bradford Bantam', shortName: 'BFD', color: '#800020', secondaryColor: '#F5A623', budget: 7_000_000, reputation: 2, facilities: 3, youthRating: 4, fanBase: 28, boardPatience: 7, squadQuality: 54, league: 'foundation', divisionId: 'div-4', stadiumName: 'Valley Parade', stadiumCapacity: 25_000 },
  { id: 'tranmere-rover', name: 'Tranmere Rover', shortName: 'TRA', color: '#FFFFFF', secondaryColor: '#0047AB', budget: 5_000_000, reputation: 1, facilities: 3, youthRating: 3, fanBase: 20, boardPatience: 8, squadQuality: 49, league: 'foundation', divisionId: 'div-4', stadiumName: 'Prenton Park', stadiumCapacity: 16_500 },
  { id: 'newport-dragon', name: 'Newport Dragon', shortName: 'NEW', color: '#F5A623', secondaryColor: '#000000', budget: 2_500_000, reputation: 1, facilities: 2, youthRating: 2, fanBase: 12, boardPatience: 9, squadQuality: 44, league: 'foundation', divisionId: 'div-4', stadiumName: 'Rodney Parade', stadiumCapacity: 8_000 },
  { id: 'gillingham-fc', name: 'Gillingham FC', shortName: 'GIL', color: '#0047AB', secondaryColor: '#FFFFFF', budget: 4_000_000, reputation: 1, facilities: 3, youthRating: 3, fanBase: 18, boardPatience: 8, squadQuality: 48, league: 'foundation', divisionId: 'div-4', stadiumName: 'Priestfield Ground', stadiumCapacity: 11_500 },
  { id: 'salford-red', name: 'Salford Red', shortName: 'SAL', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 8_000_000, reputation: 2, facilities: 4, youthRating: 4, fanBase: 22, boardPatience: 7, squadQuality: 54, league: 'foundation', divisionId: 'div-4', stadiumName: 'Peninsula Stadium', stadiumCapacity: 5_100 },
  { id: 'walsall-town', name: 'Walsall Town', shortName: 'WAL', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 4_000_000, reputation: 1, facilities: 2, youthRating: 3, fanBase: 16, boardPatience: 9, squadQuality: 47, league: 'foundation', divisionId: 'div-4', stadiumName: 'Bescot Lane', stadiumCapacity: 11_000 },
  { id: 'barrow-blue', name: 'Barrow Blue', shortName: 'BAW', color: '#0047AB', secondaryColor: '#FFFFFF', budget: 1_500_000, reputation: 1, facilities: 1, youthRating: 1, fanBase: 8, boardPatience: 9, squadQuality: 41, league: 'foundation', divisionId: 'div-4', stadiumName: 'Holker Street', stadiumCapacity: 5_000 },
  { id: 'sutton-amber', name: 'Sutton Amber', shortName: 'SUT', color: '#F5A623', secondaryColor: '#5C2D91', budget: 1_500_000, reputation: 1, facilities: 1, youthRating: 1, fanBase: 8, boardPatience: 9, squadQuality: 41, league: 'foundation', divisionId: 'div-4', stadiumName: 'Gander Green Lane', stadiumCapacity: 5_000 },
  { id: 'crawley-red', name: 'Crawley Red', shortName: 'CRA', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 3_000_000, reputation: 1, facilities: 2, youthRating: 2, fanBase: 12, boardPatience: 9, squadQuality: 44, league: 'foundation', divisionId: 'div-4', stadiumName: 'Broadfield Stadium', stadiumCapacity: 6_000 },
  { id: 'notts-county', name: 'Notts County', shortName: 'NOT', color: '#000000', secondaryColor: '#FFFFFF', budget: 5_000_000, reputation: 1, facilities: 3, youthRating: 4, fanBase: 22, boardPatience: 8, squadQuality: 50, league: 'foundation', divisionId: 'div-4', stadiumName: 'Meadow Lane', stadiumCapacity: 20_000 },
  { id: 'rochdale-dale', name: 'Rochdale Town', shortName: 'ROC', color: '#0047AB', secondaryColor: '#FFFFFF', budget: 3_000_000, reputation: 1, facilities: 2, youthRating: 2, fanBase: 12, boardPatience: 9, squadQuality: 44, league: 'foundation', divisionId: 'div-4', stadiumName: 'Spotland Stadium', stadiumCapacity: 10_000 },
  { id: 'stevenage-boro', name: 'Stevenage Boro', shortName: 'STV', color: '#E01A22', secondaryColor: '#FFFFFF', budget: 3_000_000, reputation: 1, facilities: 2, youthRating: 2, fanBase: 10, boardPatience: 9, squadQuality: 42, league: 'foundation', divisionId: 'div-4', stadiumName: 'Broadhall Way', stadiumCapacity: 7_000 },
  { id: 'wimbledon-fc', name: 'Wimbledon FC', shortName: 'WIM', color: '#0047AB', secondaryColor: '#FFD700', budget: 4_500_000, reputation: 1, facilities: 3, youthRating: 3, fanBase: 18, boardPatience: 8, squadQuality: 49, league: 'foundation', divisionId: 'div-4', stadiumName: 'Plough Lane', stadiumCapacity: 9_300 },
  { id: 'hartlepool-monkey', name: 'Hartlepool Town', shortName: 'HTP', color: '#0047AB', secondaryColor: '#FFFFFF', budget: 1_500_000, reputation: 1, facilities: 1, youthRating: 1, fanBase: 10, boardPatience: 9, squadQuality: 40, league: 'foundation', divisionId: 'div-4', stadiumName: 'Victoria Park', stadiumCapacity: 8_000 },
];

// ── Derby Rivalries ──
export const DERBIES: DerbyRivalry[] = [
  { clubIdA: 'crown-city', clubIdB: 'redfield-utd', name: 'The Crown Derby', intensity: 3 },
  { clubIdA: 'merseyside-fc', clubIdB: 'everton-blue', name: 'The Red-Blue Derby', intensity: 3 },
  { clubIdA: 'ashford-fc', clubIdB: 'north-wanderers', name: 'The Capital Rivalry', intensity: 2 },
  { clubIdA: 'sheffield-steel', clubIdB: 'barnsley-tyke', name: 'The Steel City Derby', intensity: 2 },
  { clubIdA: 'sunderland-port', clubIdB: 'tyneside-utd', name: 'The Northeast Derby', intensity: 3 },
  { clubIdA: 'bristol-bear', clubIdB: 'bristol-manor', name: 'The Bristol Derby', intensity: 2 },
  { clubIdA: 'cardiff-dragon', clubIdB: 'swansea-swan', name: 'The South Wales Derby', intensity: 3 },
  { clubIdA: 'leeds-white', clubIdB: 'huddersfield-terrier', name: 'The West Riding Derby', intensity: 2 },
  { clubIdA: 'bolton-trotter', clubIdB: 'wigan-pier', name: 'The Greater Manchester Derby', intensity: 1 },
  { clubIdA: 'palace-park', clubIdB: 'brighton-shore', name: 'The M23 Derby', intensity: 2 },
  { clubIdA: 'western-hammers', clubIdB: 'millwall-lions', name: 'The East London Derby', intensity: 3 },
  { clubIdA: 'burnston', clubIdB: 'blackburn-rover', name: 'The East Lancashire Derby', intensity: 2 },
  { clubIdA: 'portsmouth-dock', clubIdB: 'southgate-fc', name: 'The South Coast Rivalry', intensity: 1 },
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

// ── Helper: get clubs by division ──
export function getClubsByDivision(): Record<DivisionId, string[]> {
  const result: Record<DivisionId, string[]> = { 'div-1': [], 'div-2': [], 'div-3': [], 'div-4': [] };
  for (const club of CLUBS_DATA) {
    result[club.divisionId].push(club.id);
  }
  return result;
}

export function getDivision(id: DivisionId): DivisionInfo {
  return DIVISIONS.find(d => d.id === id)!;
}

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
 * Generate fixtures for a division, spread across totalWeeks.
 * For div-1 (38 match-weeks across 46 calendar weeks), inserts bye weeks evenly.
 */
export function generateDivisionFixtures(clubIds: string[], totalWeeks: number): Match[] {
  const fixtures = generateFixtures(clubIds);
  const n = clubIds.length;
  const matchWeeks = 2 * (n - 1); // e.g. 38 for 20 teams, 46 for 24 teams

  if (matchWeeks >= totalWeeks) return fixtures; // no spreading needed

  // Spread matchWeeks across totalWeeks by mapping match weeks to calendar weeks
  const gap = totalWeeks / matchWeeks;
  for (const match of fixtures) {
    match.week = Math.min(totalWeeks, Math.ceil(match.week * gap));
  }
  return fixtures;
}

/**
 * Generate fixtures for all divisions at once.
 */
export function generateAllDivisionFixtures(
  divisionClubs: Record<DivisionId, string[]>,
): Record<DivisionId, Match[]> {
  const result = {} as Record<DivisionId, Match[]>;
  for (const div of DIVISIONS) {
    const clubs = divisionClubs[div.id];
    result[div.id] = generateDivisionFixtures(clubs, div.totalWeeks);
  }
  return result;
}

// ── League Table ──
export function buildLeagueTable(fixtures: Match[], clubIds: string[]): LeagueTableEntry[] {
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
    // Keep last 5
    if (h.form.length > 5) h.form = h.form.slice(-5);
    if (a.form.length > 5) a.form = a.form.slice(-5);
  }

  return Object.values(table).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
}

/**
 * Build league tables for all divisions.
 */
export function buildAllDivisionTables(
  divisionFixtures: Record<DivisionId, Match[]>,
  divisionClubs: Record<DivisionId, string[]>,
): Record<DivisionId, LeagueTableEntry[]> {
  const result = {} as Record<DivisionId, LeagueTableEntry[]>;
  for (const divId of Object.keys(divisionClubs) as DivisionId[]) {
    result[divId] = buildLeagueTable(divisionFixtures[divId] || [], divisionClubs[divId] || []);
  }
  return result;
}
