import { GameScreen, GameSettings, LeagueId, SeasonPhase, TransferNewsEntry } from '@/types/game';
import type { GameState } from '../storeTypes';
import { UNEMPLOYED_ALLOWED_SCREENS } from '@/config/navigation';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

/** Returns true when navigation away from the match screen should be blocked. */
const isMatchLocked = (state: GameState, screen: GameScreen) =>
  state.currentScreen === 'match' && state.matchPhase !== 'none' &&
  screen !== 'match' && screen !== 'match-review';

/** Returns the redirected screen when unemployed (not retired) in career mode, or null if allowed. */
const getUnemployedRedirect = (state: GameState, screen: GameScreen): GameScreen | null => {
  if (state.gameMode !== 'career' || !state.careerManager || state.careerManager.contract) return null;
  // Retired managers are not subject to unemployed navigation restrictions
  if (state.careerManager.careerHistory?.some(e => e.reason === 'retired')) return null;
  if (UNEMPLOYED_ALLOWED_SCREENS.has(screen)) return null;
  return 'job-market';
};

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
  settings: { matchSpeed: 600, showOverallOnPitch: true, autoSave: true, hapticsEnabled: true, hidePageHints: false, confirmAllOffers: false, reducedMotion: false, show3DPitch: false, show3DFormation: false } as GameSettings,
  activeSlot: 1,
  transferNews: [] as TransferNewsEntry[],

  // Season tracking (enriches SeasonHistory at endSeason)
  lastMatchCompetition: null as string | null,
  seasonStartAvgOVR: 0,
  seasonTransfersBought: [] as { playerName: string; fee: number }[],
  seasonTransfersSold: [] as { playerName: string; fee: number }[],
  seasonTotalIncome: 0,
  seasonTotalExpenses: 0,

  // Continental & rankings
  continentalCoefficients: {} as GameState['continentalCoefficients'],
  clubPowerRankings: {} as Record<string, number>,

  // League system defaults
  seasonPhase: 'regular' as SeasonPhase,
  divisionFixtures: {} as GameState['divisionFixtures'],
  divisionTables: {} as GameState['divisionTables'],
  divisionClubs: {} as GameState['divisionClubs'],
  playerDivision: 'eng' as LeagueId,
  lastSeasonTurnover: null as GameState['lastSeasonTurnover'],
  derbies: [] as GameState['derbies'],

  setScreen: (screen: GameScreen) => {
    if (isMatchLocked(get(), screen)) return;
    const redirect = getUnemployedRedirect(get(), screen);
    const target = redirect ?? screen;
    set(s => ({ currentScreen: target, previousScreen: s.currentScreen }));
  },
  selectPlayer: (id: string | null) => {
    const next = id ? 'player-detail' as GameScreen : get().currentScreen;
    if (isMatchLocked(get(), next)) return;
    const redirect = getUnemployedRedirect(get(), next);
    set({ selectedPlayerId: id, currentScreen: redirect ?? next });
  },
  selectClub: (id: string | null) => {
    const next = id ? 'team-detail' as GameScreen : get().currentScreen;
    if (isMatchLocked(get(), next)) return;
    const redirect = getUnemployedRedirect(get(), next);
    set({ selectedClubId: id, currentScreen: redirect ?? next });
  },
  markMessageRead: (id: string) => set(s => ({ messages: s.messages.map(m => m.id === id ? { ...m, read: true } : m) })),
  markAllRead: () => set(s => ({ messages: s.messages.map(m => ({ ...m, read: true })) })),
  updateSettings: (partial: Partial<GameSettings>) => set(s => ({ settings: { ...s.settings, ...partial } })),
});
