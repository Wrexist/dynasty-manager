import { GameScreen } from '@/types/game';

export const DETAIL_SCREENS: GameScreen[] = [
  'player-detail', 'match-review', 'board', 'finance', 'merchandise', 'facilities',
  'settings', 'season-summary', 'calendar', 'match-prep',
  'league-table', 'comparison', 'manager-profile', 'cup', 'league-cup', 'champions-cup', 'shield-cup', 'super-cup', 'perks', 'trophy-cabinet', 'prestige', 'hall-of-managers', 'club', 'team-detail', 'shop', 'help', 'whats-new',
  'national-team', 'national-squad-picker', 'international-tournament', 'conference-cup',
  'job-market', 'career-overview', 'ballon-dor', 'festival',
];

export const BACK_TARGET: Partial<Record<GameScreen, GameScreen>> = {
  'player-detail': 'squad',
  'match-review': 'dashboard',
  'match-prep': 'dashboard',
  'board': 'dashboard',
  'finance': 'dashboard',
  'merchandise': 'finance',
  'facilities': 'dashboard',
  'settings': 'dashboard',
  'season-summary': 'dashboard',
  'calendar': 'dashboard',
  'league-table': 'dashboard',
  'comparison': 'squad',
  'manager-profile': 'dashboard',
  'cup': 'dashboard',
  'league-cup': 'dashboard',
  'champions-cup': 'dashboard',
  'shield-cup': 'dashboard',
  'super-cup': 'dashboard',
  'perks': 'manager-profile',
  'trophy-cabinet': 'dashboard',
  'prestige': 'season-summary',
  'hall-of-managers': 'dashboard',
  'club': 'dashboard',
  'team-detail': 'league-table',
  'shop': 'dashboard',
  'help': 'dashboard',
  'whats-new': 'settings',
  'national-team': 'dashboard',
  'national-squad-picker': 'national-team',
  'international-tournament': 'dashboard',
  'conference-cup': 'dashboard',
  'job-market': 'dashboard',
  'career-overview': 'dashboard',
  'ballon-dor': 'trophy-cabinet',
  'festival': 'dashboard',
};

export const SCREEN_TITLES: Partial<Record<GameScreen, string>> = {
  'player-detail': 'Player Detail',
  'match-review': 'Match Review',
  'match-prep': 'Match Prep',
  'match': 'Match Day',
  'board': 'Board Room',
  'finance': 'Finance',
  'merchandise': 'Merchandise',
  'facilities': 'Facilities',
  'settings': 'Settings',
  'season-summary': 'Season Summary',
  'calendar': 'Calendar',
  'league-table': 'League Table',
  'comparison': 'Compare Players',
  'manager-profile': 'Manager Profile',
  'cup': 'Domestic Cup',
  'league-cup': 'League Cup',
  'champions-cup': 'Champions Cup',
  'shield-cup': 'Shield Cup',
  'super-cup': 'Super Cup',
  'perks': 'Perks',
  'trophy-cabinet': 'Trophy Cabinet',
  'prestige': 'Prestige',
  'hall-of-managers': 'Hall of Fame',
  'club': 'Club',
  'team-detail': 'Team Detail',
  'inbox': 'Inbox',
  'squad': 'Squad',
  'tactics': 'Tactics',
  'transfers': 'Transfer Market',
  'training': 'Training',
  'scouting': 'Scouting',
  'packs': 'Player Packs',
  'staff': 'Staff',
  'youth-academy': 'Youth Academy',
  'shop': 'Shop',
  'help': 'Game Guide',
  'whats-new': "What's New",
  'national-team': 'National Team',
  'national-squad-picker': 'Squad Selection',
  'international-tournament': 'Tournament',
  'conference-cup': 'Conference Cup',
  'job-market': 'Job Market',
  'career-overview': 'Career Overview',
  'ballon-dor': "Ballon d'Or",
  'festival': 'World Cup Festival',
};

export const MAIN_TABS: GameScreen[] = ['dashboard', 'squad', 'tactics', 'transfers'];

// SubNav group mappings for swipe navigation within grouped screens
export const SCREEN_GROUPS: GameScreen[][] = [
  ['squad', 'training', 'staff', 'youth-academy'],
  ['transfers', 'scouting', 'packs'],
];

// Pinned screens shown as quick-access icons at the top of the More drawer
export const PINNED_DRAWER_SCREENS: GameScreen[] = ['inbox', 'league-table', 'calendar', 'help'];

// Minimum season required before certain drawer items become visible (progressive disclosure)
// Ballon d'Or is visible from season 1 because the world starts with reigning
// top-10 holders carrying the special card — players can browse them before
// completing their first season.
export const DRAWER_PROGRESSIVE_SCREENS: Partial<Record<GameScreen, number>> = {
  'ballon-dor': 1,
  'hall-of-managers': 2,
  'comparison': 2,
};

// Screens accessible when unemployed in career mode (everything else redirects to job-market)
export const UNEMPLOYED_ALLOWED_SCREENS = new Set<GameScreen>([
  'job-market', 'career-overview', 'inbox', 'settings', 'manager-profile',
  'trophy-cabinet', 'hall-of-managers', 'perks', 'prestige', 'help', 'whats-new', 'shop',
  'ballon-dor', 'league-table', 'calendar', 'team-detail', 'season-summary',
  'player-detail',
]);

// BottomNav tabs shown when unemployed in career mode
export const UNEMPLOYED_TABS: { screen: GameScreen; label: string }[] = [
  { screen: 'job-market', label: 'Jobs' },
  { screen: 'career-overview', label: 'Career' },
  { screen: 'inbox', label: 'Inbox' },
];

// Main tabs for swipe navigation when unemployed (derived from UNEMPLOYED_TABS to stay in sync)
export const UNEMPLOYED_MAIN_TABS: GameScreen[] = UNEMPLOYED_TABS.map(t => t.screen);
