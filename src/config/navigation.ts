import { GameScreen } from '@/types/game';

export const DETAIL_SCREENS: GameScreen[] = [
  'player-detail', 'match-review', 'board', 'finance', 'merchandise', 'facilities',
  'settings', 'season-summary', 'calendar', 'match-prep', 'match',
  'league-table', 'comparison', 'manager-profile', 'cup', 'perks', 'trophy-cabinet', 'prestige', 'hall-of-managers', 'club',
];

export const BACK_TARGET: Partial<Record<GameScreen, GameScreen>> = {
  'player-detail': 'squad',
  'match-review': 'dashboard',
  'match-prep': 'dashboard',
  'match': 'dashboard',
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
  'perks': 'manager-profile',
  'trophy-cabinet': 'dashboard',
  'prestige': 'season-summary',
  'hall-of-managers': 'dashboard',
  'club': 'dashboard',
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
  'cup': 'Cup',
  'perks': 'Perks',
  'trophy-cabinet': 'Trophy Cabinet',
  'prestige': 'Prestige',
  'hall-of-managers': 'Hall of Fame',
  'club': 'Club',
  'inbox': 'Inbox',
  'squad': 'Squad',
  'tactics': 'Tactics',
  'transfers': 'Transfer Market',
  'training': 'Training',
  'scouting': 'Scouting',
  'staff': 'Staff',
  'youth-academy': 'Youth Academy',
};

export const MAIN_TABS: GameScreen[] = ['dashboard', 'squad', 'tactics', 'transfers'];

// SubNav group mappings for swipe navigation within grouped screens
export const SCREEN_GROUPS: GameScreen[][] = [
  ['squad', 'training', 'staff', 'youth-academy'],
  ['transfers', 'scouting'],
];
