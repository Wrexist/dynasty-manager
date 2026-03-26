import { GameScreen, GameSettings, LeagueId, SeasonPhase, TransferNewsEntry } from '@/types/game';
import type { GameState } from '../storeTypes';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createCoreSlice = (set: Set, get: Get) => ({
  gameStarted: false,
  playerClubId: '',
  currentScreen: 'dashboard' as GameScreen,
  previousScreen: null as GameScreen | null,
  selectedPlayerId: null as string | null,
  selectedClubId: null as string | null,
  season: 1,
  week: 1,
  totalWeeks: 46,
  transferWindowOpen: true,
  messages: [] as GameState['messages'],
  boardObjectives: [] as GameState['boardObjectives'],
  boardConfidence: 50,
  seasonHistory: [] as GameState['seasonHistory'],
  settings: { matchSpeed: 'normal', showOverallOnPitch: true, autoSave: true, hapticsEnabled: true } as GameSettings,
  activeSlot: 1,
  transferNews: [] as TransferNewsEntry[],

  // League system defaults
  seasonPhase: 'regular' as SeasonPhase,
  divisionFixtures: {} as GameState['divisionFixtures'],
  divisionTables: {} as GameState['divisionTables'],
  divisionClubs: {} as GameState['divisionClubs'],
  playerDivision: 'eng' as LeagueId,
  lastSeasonTurnover: null as GameState['lastSeasonTurnover'],
  derbies: [] as GameState['derbies'],

  setScreen: (screen: GameScreen) => set(s => ({ currentScreen: screen, previousScreen: s.currentScreen })),
  selectPlayer: (id: string | null) => set({ selectedPlayerId: id, currentScreen: id ? 'player-detail' : get().currentScreen }),
  selectClub: (id: string | null) => set({ selectedClubId: id, currentScreen: id ? 'team-detail' : get().currentScreen }),
  markMessageRead: (id: string) => set(s => ({ messages: s.messages.map(m => m.id === id ? { ...m, read: true } : m) })),
  markAllRead: () => set(s => ({ messages: s.messages.map(m => ({ ...m, read: true })) })),
  updateSettings: (partial: Partial<GameSettings>) => set(s => ({ settings: { ...s.settings, ...partial } })),
});
