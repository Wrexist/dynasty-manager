/**
 * Save migration system for Dynasty Manager.
 * Each migration transforms save data from one version to the next.
 * Add new migrations when the save schema changes.
 */

const CURRENT_VERSION = 7;

type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, MigrationFn> = {
  // v1 → v2: Added messages, seasonHistory, incomingOffers
  1: (data) => ({
    ...data,
    version: 2,
    messages: data.messages || [],
    seasonHistory: data.seasonHistory || [],
    incomingOffers: data.incomingOffers || [],
  }),

  // v2 → v3: Added systems (tactics, training, staff, scouting, youthAcademy, facilities, financeHistory, settings)
  2: (data) => {
    const tf = data.trainingFocus || 'fitness';
    return {
      ...data,
      version: 3,
      settings: data.settings || { matchSpeed: 'normal', showOverallOnPitch: true, autoSave: false },
      tactics: data.tactics || { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
      training: data.training || {
        schedule: { mon: tf, tue: tf, wed: tf, thu: tf, fri: tf },
        intensity: 'medium', individualPlans: [], tacticalFamiliarity: 30,
      },
      staff: data.staff || { members: [], availableHires: [] },
      scouting: data.scouting || { maxAssignments: 1, assignments: [], reports: [], discoveredPlayers: [] },
      youthAcademy: data.youthAcademy || { prospects: [], nextIntakePreview: [] },
      facilities: data.facilities || { trainingLevel: 5, youthLevel: 5, stadiumLevel: 5, medicalLevel: 5, upgradeInProgress: null },
      financeHistory: data.financeHistory || [],
    };
  },

  // v3 → v4: Added save slots, loan system, cup competition
  3: (data) => ({
    ...data,
    version: 4,
    activeSlot: 1,
    activeLoans: data.activeLoans || [],
    incomingLoanOffers: data.incomingLoanOffers || [],
    cup: data.cup || { ties: [], currentRound: null, eliminated: false, winner: null },
  }),

  // v4 → v5: Multi-division system (92 clubs, 4 divisions)
  4: (data) => {
    const clubIds = data.clubs ? Object.keys(data.clubs as Record<string, unknown>) : [];
    return {
      ...data,
      version: 5,
      totalWeeks: 46,
      playerDivision: 'div-1',
      divisionClubs: { 'div-1': clubIds, 'div-2': [], 'div-3': [], 'div-4': [] },
      divisionFixtures: { 'div-1': data.fixtures || [], 'div-2': [], 'div-3': [], 'div-4': [] },
      divisionTables: { 'div-1': [], 'div-2': [], 'div-3': [], 'div-4': [] },
      playoffs: [],
      lastPromotionRelegation: null,
      derbies: [],
    };
  },

  // v5 → v6: Manager progression, career timeline, records, objectives, storylines, achievements
  5: (data) => ({
    ...data,
    version: 6,
    managerProgression: data.managerProgression || { xp: 0, level: 1, unlockedPerks: [], prestigeLevel: 0 },
    careerTimeline: data.careerTimeline || [],
    clubRecords: data.clubRecords || { biggestWin: null, biggestLoss: null, highestScorer: null, mostAppearances: null, longestWinStreak: 0, longestUnbeatenRun: 0 },
    weeklyObjectives: data.weeklyObjectives || [],
    unlockedAchievements: data.unlockedAchievements || [],
    managerStats: data.managerStats || { totalWins: 0, totalDraws: 0, totalLosses: 0, totalSpent: 0, totalEarned: 0 },
    activeStorylineChains: data.activeStorylineChains || [],
    fanMood: data.fanMood ?? 50,
    activeChallenge: data.activeChallenge || null,
    seasonPhase: data.seasonPhase || 'regular',
    pendingFarewell: null,
  }),

  // v6 → v7: Added preMatchLeaguePosition, lastMatchXPGain for post-match popup
  6: (data) => ({
    ...data,
    version: 7,
    preMatchLeaguePosition: data.preMatchLeaguePosition ?? 10,
    lastMatchXPGain: data.lastMatchXPGain ?? 0,
  }),
};

export function migrateSaveData(data: Record<string, unknown>): Record<string, unknown> {
  let version = data.version || 1;
  let migrated = { ...data };

  while (version < CURRENT_VERSION) {
    const migrate = migrations[version];
    if (!migrate) {
      console.warn(`No migration found for save version ${version}`);
      break;
    }
    try {
      migrated = migrate(migrated);
    } catch (err) {
      console.error(`Save migration v${version} → v${version + 1} failed:`, err);
      migrated = { ...migrated, version: (version as number) + 1 };
    }
    version = migrated.version;
  }

  return migrated;
}

export { CURRENT_VERSION };
