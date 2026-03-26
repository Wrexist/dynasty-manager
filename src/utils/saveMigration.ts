/**
 * Save migration system for Dynasty Manager.
 * Each migration transforms save data from one version to the next.
 * Add new migrations when the save schema changes.
 */

const CURRENT_VERSION = 26;

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
      settings: data.settings || { matchSpeed: 'normal', showOverallOnPitch: true, autoSave: false, hapticsEnabled: true },
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
    pendingFarewell: [],
  }),

  // v6 → v7: Added preMatchLeaguePosition, lastMatchXPGain for post-match popup
  6: (data) => ({
    ...data,
    version: 7,
    preMatchLeaguePosition: data.preMatchLeaguePosition ?? 10,
    lastMatchXPGain: data.lastMatchXPGain ?? 0,
  }),

  // v7 → v8: Added scouting watch list
  7: (data) => ({
    ...data,
    version: 8,
    scoutWatchList: data.scoutWatchList || [],
  }),

  // v8 → v9: Added weeklyDigest for post-week summary overlay
  8: (data) => ({
    ...data,
    version: 9,
    weeklyDigest: data.weeklyDigest || null,
  }),

  // v9 → v10: Added free agents, AI manager profiles, injury details
  9: (data) => {
    // Add injuryDetails to players that have active injuries
    const players = data.players as Record<string, Record<string, unknown>> | undefined;
    if (players) {
      Object.values(players).forEach(p => {
        if (p.injured && !p.injuryDetails) {
          p.injuryDetails = {
            type: 'knock',
            severity: 'minor',
            weeksRemaining: (p.injuryWeeks as number) || 1,
            totalWeeks: (p.injuryWeeks as number) || 1,
            reinjuryRisk: 0.05,
            reinjuryWeeksRemaining: 0,
            fitnessOnReturn: 70,
          };
        }
      });
    }
    // Add aiManagerProfile to clubs that don't have one
    const clubs = data.clubs as Record<string, Record<string, unknown>> | undefined;
    if (clubs) {
      const styles = ['attacking', 'defensive', 'possession', 'counter-attack', 'balanced', 'direct'];
      Object.values(clubs).forEach((club, i) => {
        if (!club.aiManagerProfile) {
          const style = styles[i % styles.length];
          club.aiManagerProfile = {
            name: 'Manager',
            style,
            defaultTactics: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
            transferAggression: 0.5,
            youthFocus: 0.5,
            adaptability: 0.5,
          };
        }
      });
    }
    return {
      ...data,
      version: 10,
      freeAgents: data.freeAgents || [],
    };
  },

  // v10 → v11: Added sponsorship system
  10: (data) => ({
    ...data,
    version: 11,
    sponsorDeals: data.sponsorDeals || [],
    sponsorOffers: data.sponsorOffers || [],
    sponsorSlotCooldowns: data.sponsorSlotCooldowns || {},
  }),

  // v11 → v12: Added player unhappiness tracking, cup extra time state
  11: (data) => {
    const players = data.players as Record<string, Record<string, unknown>> | undefined;
    if (players) {
      Object.values(players).forEach(p => {
        if (p.lowMoraleWeeks === undefined) p.lowMoraleWeeks = 0;
        if (p.wantsToLeave === undefined) p.wantsToLeave = false;
      });
    }
    return {
      ...data,
      version: 12,
      currentCupTieId: data.currentCupTieId || null,
    };
  },

  // v12 → v13: Added merchandise strategy system
  12: (data) => ({
    ...data,
    version: 13,
    merchandise: data.merchandise || {
      activeProductLines: ['matchday_essentials'],
      pricingTier: 'standard',
      activeCampaign: null,
      campaignCooldownWeeks: 0,
      lastSeasonRevenue: 0,
      currentSeasonRevenue: 0,
      starPlayerDip: 0,
      starSigningBuzz: 0,
    },
  }),

  // v13 → v14: Added recovery facility + rivalries
  13: (data) => {
    const facilities = (data.facilities || {}) as Record<string, unknown>;
    return {
      ...data,
      version: 14,
      facilities: {
        ...facilities,
        recoveryLevel: facilities.medicalLevel || 5,
      },
    };
  },
  // v14 → v15: Added head-to-head rivalry records
  14: (data) => ({
    ...data,
    version: 15,
    rivalries: data.rivalries || {},
  }),
  // v15 → v16: Added pair familiarity for gradual chemistry line growth
  15: (data) => ({
    ...data,
    version: 16,
    pairFamiliarity: data.pairFamiliarity || {},
  }),
  // v16 → v17: Added career-cumulative player stats + pendingGemReveal
  16: (data) => {
    const players = (data.players || {}) as Record<string, Record<string, unknown>>;
    const updatedPlayers: Record<string, Record<string, unknown>> = {};
    for (const [id, p] of Object.entries(players)) {
      updatedPlayers[id] = {
        ...p,
        careerGoals: (p.careerGoals as number) || 0,
        careerAssists: (p.careerAssists as number) || 0,
        careerAppearances: (p.careerAppearances as number) || 0,
      };
    }
    return {
      ...data,
      version: 17,
      players: updatedPlayers,
      pendingGemReveal: null,
    };
  },
  // v17 → v18: Added stadiumName and stadiumCapacity to clubs
  17: (data) => {
    const clubs = data.clubs as Record<string, Record<string, unknown>> | undefined;
    if (clubs) {
      // Lazy-import avoidance: inline lookup from CLUBS_DATA would create a circular dep.
      // Instead, provide sensible defaults — the stadium data will be correct for new games.
      Object.values(clubs).forEach(club => {
        if (club.stadiumName === undefined) club.stadiumName = 'Community Stadium';
        if (club.stadiumCapacity === undefined) club.stadiumCapacity = 10_000;
      });
    }
    return { ...data, version: 18 };
  },
  // v18 → v19: Added monetization system (shop, entitlements, cosmetics, ad rewards)
  18: (data) => ({
    ...data,
    version: 19,
    monetization: data.monetization || {
      entitlements: [],
      activeCosmetics: {},
      adRewardsClaimed: {},
      firstLaunchTimestamp: 0,
      starterKitDismissed: false,
    },
  }),

  // v19 → v20: Added subscription support to monetization
  19: (data) => {
    const monetization = (data.monetization || {}) as Record<string, unknown>;
    return {
      ...data,
      version: 20,
      monetization: {
        ...monetization,
        subscription: monetization.subscription ?? null,
      },
    };
  },

  // v20 → v21: Added national team system
  20: (data) => ({
    ...data,
    version: 21,
    nationalTeam: data.nationalTeam ?? null,
    internationalTournament: data.internationalTournament ?? null,
    managerNationality: data.managerNationality ?? null,
  }),

  // v21 → v22: Rebalanced player values and wages (exponential curve)
  21: (data) => {
    const VALUE_EXP_BASE = 550;
    const VALUE_EXP_RATE = 0.136;
    const WAGE_EXP_BASE = 10;
    const WAGE_EXP_RATE = 0.116;
    const WAGE_FLOOR = 500;
    const AGE_MULTS = [
      { maxAge: 18, m: 0.30 }, { maxAge: 20, m: 0.50 }, { maxAge: 22, m: 0.75 },
      { maxAge: 24, m: 0.90 }, { maxAge: 27, m: 1.00 }, { maxAge: 29, m: 0.85 },
      { maxAge: 31, m: 0.60 }, { maxAge: 33, m: 0.35 }, { maxAge: Infinity, m: 0.15 },
    ];
    const getAgeMult = (age: number) => {
      for (const t of AGE_MULTS) { if (age <= t.maxAge) return t.m; }
      return 0.15;
    };
    const players = (data.players && typeof data.players === 'object' && !Array.isArray(data.players)) ? Object.values(data.players as Record<string, Record<string, unknown>>) : [];
    const clubs = (data.clubs && typeof data.clubs === 'object' && !Array.isArray(data.clubs)) ? Object.values(data.clubs as Record<string, Record<string, unknown>>) : [];
    for (const p of players) {
      const ovr = (p.overall || 50) as number;
      const age = (p.age || 25) as number;
      const baseValue = Math.round(VALUE_EXP_BASE * Math.exp(VALUE_EXP_RATE * ovr) * (1 + Math.random() * 0.15));
      p.value = Math.round(baseValue * getAgeMult(age));
      p.wage = Math.max(WAGE_FLOOR, Math.round(WAGE_EXP_BASE * Math.exp(WAGE_EXP_RATE * ovr) * (1 + Math.random() * 0.10)));
    }
    for (const c of clubs) {
      const clubId = c.id as string;
      const clubPlayers = players.filter((p) => p.clubId === clubId);
      c.wageBill = clubPlayers.reduce((sum: number, p) => sum + ((p.wage || 0) as number), 0);
    }
    return { ...data, version: 22 };
  },
  22: (_data: Record<string, unknown>) => {
    // v22 → v23: European leagues expansion (clean break)
    // Old saves used fictional English clubs (div-1/2/3/4) that no longer exist.
    // Force a new game by clearing all game state.
    return {
      version: 23,
      gameStarted: false,
      playerClubId: '',
      season: 1,
      week: 1,
      clubs: {},
      players: {},
      fixtures: [],
      leagueTable: [],
      divisionFixtures: {},
      divisionTables: {},
      divisionClubs: {},
      playerDivision: 'eng',
      messages: [],
      transferMarket: [],
      seasonHistory: [],
    };
  },
  // v23 → v24: Added game modes (sandbox/career) and career manager state
  23: (data) => ({
    ...data,
    version: 24,
    gameMode: data.gameMode || 'sandbox',
    careerManager: data.careerManager || null,
    jobVacancies: data.jobVacancies || [],
    jobOffers: data.jobOffers || [],
  }),
  // v24 → v25: Seed pair familiarity for existing lineup pairs
  24: (data) => {
    const pairFamiliarity = { ...(data.pairFamiliarity as Record<string, number> || {}) };
    const clubs = data.clubs as Record<string, { lineup?: string[] }> | undefined;
    const playerClubId = data.playerClubId as string;
    const lineup = clubs?.[playerClubId]?.lineup || [];
    const SEED = 2;
    for (let i = 0; i < lineup.length; i++) {
      for (let j = i + 1; j < lineup.length; j++) {
        if (!lineup[i] || !lineup[j]) continue;
        const key = lineup[i] < lineup[j] ? `${lineup[i]}-${lineup[j]}` : `${lineup[j]}-${lineup[i]}`;
        if (!pairFamiliarity[key]) pairFamiliarity[key] = SEED;
      }
    }
    return { ...data, version: 25, pairFamiliarity };
  },
  // v25 → v26: Add outgoingLoanRequests array
  25: (data) => ({
    ...data,
    version: 26,
    outgoingLoanRequests: data.outgoingLoanRequests || [],
  }),
};

export function migrateSaveData(data: Record<string, unknown>): Record<string, unknown> {
  let version = (data.version || 1) as number;
  let migrated = { ...data };

  while (version < CURRENT_VERSION) {
    const migrate = migrations[version];
    if (!migrate) {
      break;
    }
    try {
      migrated = migrate(migrated);
    } catch (err) {
      console.error(`[SaveMigration] Migration from v${version} to v${version + 1} failed:`, err);
      migrated = { ...migrated, version: version + 1 };
    }
    version = migrated.version as number;
  }

  return migrated;
}

export { CURRENT_VERSION };
