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
  boardUltimatum: null as GameState['boardUltimatum'],
  pendingPostSeason: null as GameState['pendingPostSeason'],
  careerRetired: false,
  seasonHistory: [] as GameState['seasonHistory'],
  settings: { matchSpeed: 3300, showOverallOnPitch: true, autoSave: true, hapticsEnabled: true, soundEnabled: true, hidePageHints: false, hideOnboarding: false, confirmAllOffers: false, reducedMotion: false, performanceMode: false, digestOnlyWhenSignificant: true } as GameSettings,
  celebrationDedupe: { season: 1, keys: [] as string[] },
  activeSlot: 1,
  transferNews: [] as TransferNewsEntry[],

  // Autosave status (transient — not persisted to disk)
  saveStatus: 'idle' as GameState['saveStatus'],
  lastSavedAt: null as number | null,
  saveFailureMessage: null as string | null,

  // Capture Studio flag (transient — blocks all slot writes while active)
  captureSession: false,

  // Set by loadGame() when a slot can't be loaded cleanly. SaveRecoveryDialog
  // reads this to render the appropriate message + actions. Transient.
  loadError: null as GameState['loadError'],

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

  // Community Pack — opt-in data layer. Populated by initGame when enabled;
  // defaults here so GameState is satisfied before first init and for saves
  // that predate the v59→v60 migration.
  communityPackEnabled: false,
  cpPool: {
    shuffleSeed: 0,
    cursor: 0,
    usedFcIds: [] as string[],
    marketListings: [] as string[],
    lastMarketRefreshWeek: 0,
    lastSeedSeason: 0,
  },

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
    const target = redirect ?? next;
    // Record previousScreen like setScreen does (only when actually
    // navigating) — back-navigation special-cases like
    // `previousScreen === 'team-detail'` depend on it.
    set(s => ({
      selectedPlayerId: id,
      currentScreen: target,
      ...(target !== s.currentScreen ? { previousScreen: s.currentScreen } : {}),
    }));
  },
  selectClub: (id: string | null) => {
    const next = id ? 'team-detail' as GameScreen : get().currentScreen;
    if (isMatchLocked(get(), next)) return;
    const redirect = getUnemployedRedirect(get(), next);
    const target = redirect ?? next;
    set(s => ({
      selectedClubId: id,
      currentScreen: target,
      ...(target !== s.currentScreen ? { previousScreen: s.currentScreen } : {}),
    }));
  },
  /** See `GameState.recordCelebrationKeys`. Filter + record happen in one
   *  synchronous pass so a double render can't fire the same modal twice. */
  recordCelebrationKeys: (season: number, keys: string[]): string[] => {
    const bucket = get().celebrationDedupe;
    const sameSeason = bucket?.season === season;
    const existing = sameSeason ? bucket.keys : [];
    const fresh = keys.filter((k, i) => keys.indexOf(k) === i && !existing.includes(k));
    if (!sameSeason || fresh.length > 0) {
      set({ celebrationDedupe: { season, keys: [...existing, ...fresh] } });
    }
    return fresh;
  },
  markMessageRead: (id: string) => set(s => ({ messages: s.messages.map(m => m.id === id ? { ...m, read: true } : m) })),
  markAllRead: () => set(s => ({ messages: s.messages.map(m => ({ ...m, read: true })) })),
  updateSettings: (partial: Partial<GameSettings>) => {
    set(s => ({ settings: { ...s.settings, ...partial } }));
    // Persist preference changes. Without this, toggling autoSave off and
    // closing the tab silently drops the change — flushForLifecycle would
    // short-circuit on the new autoSave=false value. saveGame() is debounced
    // so rapid toggles coalesce into one write. The scheduled idle save still
    // fires through flushForLifecycle/flushPendingOnly on tab close regardless
    // of the new preference value.
    if (get().gameStarted) get().saveGame();
  },
});
