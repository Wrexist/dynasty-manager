import * as Sentry from '@sentry/react';
import { LEAGUES, getLeaguesByCountry, generateDivisionFixtures, ALL_CLUBS } from '@/data/league';
import { generateSquad, selectBestLineup, expandAbbreviatedFirstName } from '@/utils/playerGen';
import { autoFillBestTeam } from '@/utils/autoFillLineup';
import { NATIONS } from '@/data/nations';
import { getPlayerRarity, getRarityValueMultiplier, getRarityWageMultiplier } from '@/utils/playerRarity';
import type { Club, Player, FormationType } from '@/types/game';
/**
 * Save migration system for Dynasty Manager.
 * Each migration transforms save data from one version to the next.
 * Add new migrations when the save schema changes.
 */

const CURRENT_VERSION = 73;

type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, MigrationFn> = {
  // v72 → v73: GameState gained `boardUltimatum` (mid-season board ultimatum
  // issued at review weeks when confidence is critically low — see
  // config/gameBalance ULTIMATUM_* constants). Existing saves have no active
  // ultimatum; default to null.
  72: (data) => ({
    ...data,
    version: 73,
    boardUltimatum: data.boardUltimatum ?? null,
  }),

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
        if (!p || typeof p !== 'object') return;
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
        if (!club || typeof club !== 'object') return;
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
        if (!p || typeof p !== 'object') return;
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
        if (!club || typeof club !== 'object') return;
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
      if (!p || typeof p !== 'object') continue;
      const ovr = (p.overall || 50) as number;
      const age = (p.age || 25) as number;
      const baseValue = Math.round(VALUE_EXP_BASE * Math.exp(VALUE_EXP_RATE * ovr) * (1 + Math.random() * 0.15));
      p.value = Math.round(baseValue * getAgeMult(age));
      p.wage = Math.max(WAGE_FLOOR, Math.round(WAGE_EXP_BASE * Math.exp(WAGE_EXP_RATE * ovr) * (1 + Math.random() * 0.10)));
    }
    for (const c of clubs) {
      if (!c || typeof c !== 'object') continue;
      const clubId = c.id as string;
      const clubPlayers = players.filter((p) => p && typeof p === 'object' && p.clubId === clubId);
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
  // v26 → v27: Added training drills, streaks, and reports
  26: (data) => {
    const training = (data.training || {}) as Record<string, unknown>;
    return {
      ...data,
      version: 27,
      training: {
        ...training,
        drillSchedule: undefined,
        streaks: {},
        lastReport: undefined,
      },
    };
  },

  // v27 → v28: Added manager appearance to CareerManager
  27: (data) => {
    const cm = data.careerManager as Record<string, unknown> | null;
    return {
      ...data,
      version: 28,
      careerManager: cm ? {
        ...cm,
        appearance: cm.appearance ?? { gender: 'male', skinTone: 0, faceShape: 1, eyeStyle: 0, hairStyle: 1, hairColor: 0, facialHair: 0, glasses: 0, outfit: 0, outfitColor: '#1a1a2e', tieColor: '#D4A017', accessory: 0 },
      } : null,
    };
  },

  // v28 → v29: Added League Cup, Continental Tournaments, Super Cups
  28: (data) => ({
    ...data,
    version: 29,
    leagueCup: data.leagueCup || { ties: [], currentRound: null, eliminated: false, winner: null },
    championsCup: data.championsCup || null,
    shieldCup: data.shieldCup || null,
    virtualClubs: data.virtualClubs || {},
    continentalQualification: data.continentalQualification || null,
    domesticSuperCup: data.domesticSuperCup || null,
    continentalSuperCup: data.continentalSuperCup || null,
  }),

  // v29 → v30: Expanded manager appearance (gender, face shape, eyes, facial hair, glasses, outfit, accessories)
  29: (data) => {
    const cm = data.careerManager as Record<string, unknown> | null;
    if (cm?.appearance) {
      const old = cm.appearance as Record<string, unknown>;
      cm.appearance = {
        gender: 'male',
        skinTone: old.skinTone ?? 0,
        faceShape: 1,           // oval default
        eyeStyle: 0,            // default
        hairStyle: old.hairStyle ?? 1,
        hairColor: old.hairColor ?? 0,
        facialHair: 0,          // none
        glasses: 0,             // none
        outfit: 0,              // suit (preserves current look)
        outfitColor: old.suitColor || '#1a1a2e',
        tieColor: '#D4A017',    // gold (matches previous hardcoded tie)
        accessory: 0,           // none
      };
    }
    return { ...data, version: 30 };
  },

  // v30 → v31: Generate PlayerAppearance for all existing players
  30: (data) => {
    const players = data.players as Record<string, Record<string, unknown>> | undefined;
    if (players) {
      // Deterministic hash from player ID (same as PlayerAvatar fallback)
      const hash = (id: string) => {
        let h = 5381;
        for (let i = 0; i < id.length; i++) {
          h = ((h << 5) + h + id.charCodeAt(i)) | 0;
        }
        return Math.abs(h);
      };
      for (const pid of Object.keys(players)) {
        const p = players[pid];
        if (!p || typeof p !== 'object') continue;
        if (!p.appearance) {
          const h = hash(pid);
          p.appearance = {
            skinTone: h % 8,
            hairStyle: (h >> 3) % 8,
            hairColor: (h >> 6) % 8,
            height: (h >> 9) % 3,
            build: (h >> 11) % 3,
          };
        }
      }
    }
    return { ...data, version: 31 };
  },
  31: (data) => {
    // Fix red card suspension off-by-one: bump active suspensions by 1
    const players = data.players as Record<string, Record<string, unknown>> | undefined;
    if (players) {
      for (const p of Object.values(players)) {
        if (typeof p.suspendedUntilWeek === 'number') {
          p.suspendedUntilWeek = p.suspendedUntilWeek + 1;
        }
      }
    }
    // Cap financeHistory and careerTimeline for existing saves
    const fh = data.financeHistory as unknown[] | undefined;
    if (fh && fh.length > 200) {
      data.financeHistory = fh.slice(-200);
    }
    const ct = data.careerTimeline as unknown[] | undefined;
    if (ct && ct.length > 100) {
      data.careerTimeline = ct.slice(-100);
    }
    return { ...data, version: 32 };
  },

  // v32 → v33: Sanitize club objects — ensure subs, lineup, formation exist
  32: (data) => {
    const clubs = data.clubs as Record<string, Record<string, unknown>> | undefined;
    if (clubs) {
      for (const club of Object.values(clubs)) {
        if (!club || typeof club !== 'object') continue;
        if (!Array.isArray(club.subs)) club.subs = [];
        if (!Array.isArray(club.lineup)) club.lineup = [];
        if (!Array.isArray(club.playerIds)) club.playerIds = [];
        if (!club.formation) club.formation = '4-3-3';
      }
    }
    return { ...data, version: 33 };
  },

  // v33 → v34: Extend PlayerAppearance with facialHair, accessory, bootColor
  33: (data) => {
    const players = data.players as Record<string, Record<string, unknown>> | undefined;
    if (players) {
      const hash = (id: string) => {
        let h = 5381;
        for (let i = 0; i < id.length; i++) {
          h = ((h << 5) + h + id.charCodeAt(i)) | 0;
        }
        return Math.abs(h);
      };
      for (const pid of Object.keys(players)) {
        const p = players[pid];
        if (!p || typeof p !== 'object') continue;
        const app = p.appearance as Record<string, number> | undefined;
        if (app) {
          const h = hash(pid);
          if (app.facialHair === undefined) app.facialHair = (h >> 13) % 5;
          if (app.accessory === undefined) app.accessory = (h >> 15) % 5;
          if (app.bootColor === undefined) app.bootColor = (h >> 17) % 4;
        }
      }
    }
    return { ...data, version: 34 };
  },

  // v34 → v35: Migrate ManagerAppearance from character model to emblem badge format
  34: (data) => {
    const cm = data.careerManager as Record<string, unknown> | undefined;
    if (cm?.appearance) {
      const app = cm.appearance as Record<string, unknown>;
      // Only migrate if it's the old format (has skinTone but no badgeShape)
      if (app.skinTone != null && app.badgeShape == null) {
        app.badgeShape = 1;  // shield
        app.backgroundColor = app.outfitColor || '#1a1a2e';
        app.accentColor = app.tieColor || '#D4A017';
        app.pattern = 0;     // solid
        app.icon = 0;        // suit
      }
    }
    return { ...data, version: 35 };
  },

  // v35 → v36: Add continentalCupsWon and leagueCupsWon to CareerManager
  35: (data) => {
    const cm = data.careerManager as Record<string, unknown> | undefined;
    if (cm) {
      if (cm.continentalCupsWon == null) cm.continentalCupsWon = 0;
      if (cm.leagueCupsWon == null) cm.leagueCupsWon = 0;
    }
    return { ...data, version: 36 };
  },

  // v36 → v37: Transfer market realism — new optional fields on TransferListing.
  36: (data) => {
    return { ...data, version: 37 };
  },

  // v37 → v38: Monthly objectives (4-week cycle) + persistent coach checklist
  37: (data) => ({
    ...data,
    version: 38,
    completedCoachTaskIds: data.completedCoachTaskIds || [],
    objectivesStartWeek: data.week || 1,
  }),

  // v38 → v39: Add tactical presets (Pro feature)
  38: (data) => ({
    ...data,
    version: 39,
    tacticalPresets: data.tacticalPresets || [],
  }),

  // v39 → v40: Track completed storyline chains to prevent re-triggering
  39: (data) => ({
    ...data,
    version: 40,
    completedStorylineChainIds: data.completedStorylineChainIds || [],
  }),

  // v40 → v41: National team job system (career mode earns the role)
  40: (data) => {
    const cm = data.careerManager as Record<string, unknown> | null;
    return {
      ...data,
      version: 41,
      nationalTeamOffer: null,
      showNationalTeamOffer: false,
      careerManager: cm ? {
        ...cm,
        nationalTeamAppointedSeason: data.nationalTeam ? ((data.season as number) || 1) : null,
        nationalTeamSacked: false,
      } : cm,
    };
  },

  // v41 → v42: National team pool player tracking
  41: (data) => {
    const nt = data.nationalTeam as Record<string, unknown> | null;
    return {
      ...data,
      version: 42,
      nationalTeam: nt ? { ...nt, poolPlayerIds: nt.poolPlayerIds || [] } : null,
    };
  },

  // v42 → v43: Ballon d'Or ranking system
  42: (data) => ({
    ...data,
    version: 43,
  }),

  // v43 → v44: Player transfer cooldown + message actioned flag (optional fields, no data transform needed)
  43: (data) => ({
    ...data,
    version: 44,
  }),

  // v44 → v45: Stadium stands — replace flat stadiumLevel with per-stand levels
  44: (data) => {
    const facilities = (data.facilities || {}) as Record<string, unknown>;
    const oldLevel = (facilities.stadiumLevel as number) || 5;
    const { stadiumLevel: _, ...restFacilities } = facilities;
    // Convert legacy in-flight "stadium" upgrades to new "stadium-north" format
    const upgrade = restFacilities.upgradeInProgress as Record<string, unknown> | null;
    if (upgrade && upgrade.type === 'stadium') {
      restFacilities.upgradeInProgress = { ...upgrade, type: 'stadium-north' };
    }
    return {
      ...data,
      version: 45,
      facilities: {
        ...restFacilities,
        stadiumStands: { north: oldLevel, south: oldLevel, east: oldLevel, west: oldLevel },
      },
    };
  },

  // v45 → v46: Add continental coefficients
  45: (data) => ({
    ...data,
    version: 46,
    continentalCoefficients: {},
  }),

  // v46 → v47: Add persistent transfer page filters
  46: (data) => ({
    ...data,
    version: 47,
    transferFilters: {
      tab: 'market', posFilter: 0, searchQuery: '', sortBy: 'overall',
      faSortBy: 'overall', divFilter: 'all', newsTypeFilter: 'all', hideUnaffordable: false,
    },
  }),
  // v47→48: Consolidate transfer tabs (7→4), add showShortlistOnly
  47: (data: Record<string, unknown>) => {
    const filters = (data.transferFilters || {}) as Record<string, unknown>;
    const oldTab = filters.tab as string;
    const tabMap: Record<string, string> = {
      market: 'market', shortlist: 'market',
      incoming: 'deals', outgoing: 'deals', loans: 'deals',
      freeAgents: 'freeAgents', news: 'news',
    };
    return {
      ...data,
      version: 48,
      transferFilters: {
        ...filters,
        tab: tabMap[oldTab] || 'market',
        showShortlistOnly: oldTab === 'shortlist',
      },
    };
  },

  // v48 → v49: Add Conference Cup (third continental competition)
  48: (data) => ({
    ...data,
    version: 49,
    conferenceCup: null,
  }),

  // v49 → v50: Add personalWealth to careerManager
  49: (data) => {
    const cm = data.careerManager as Record<string, unknown> | null;
    return {
      ...data,
      version: 50,
      ...(cm ? { careerManager: { ...cm, personalWealth: cm.personalWealth ?? 0 } } : {}),
    };
  },

  // v50 → v51: Add negotiation strikes system
  50: (data) => ({
    ...data,
    negotiationStrikes: {},
    version: 51,
  }),

  // v51 → v52: Convert settings.matchSpeed from string ('normal'|'fast'|'instant') to number (ms)
  51: (data) => {
    const settings = (data.settings || {}) as Record<string, unknown>;
    const speedMap: Record<string, number> = { normal: 600, fast: 200, instant: 20 };
    const currentSpeed = settings.matchSpeed;
    const numericSpeed = typeof currentSpeed === 'string' ? (speedMap[currentSpeed] ?? 600) : (currentSpeed ?? 600);
    return {
      ...data,
      settings: { ...settings, matchSpeed: numericSpeed },
      version: 52,
    };
  },

  // v52 → v53: Add pre-season friendlies array
  52: (data) => ({
    ...data,
    friendlies: data.friendlies || [],
    version: 53,
  }),

  // v53 → v54: Backfill board objectives with structured checkType fields
  53: (data) => {
    const objectives = (data.boardObjectives || []) as Record<string, unknown>[];
    const updated = objectives.map(obj => {
      if (obj.checkType) return obj; // Already has structured fields
      const desc = (obj.description || '') as string;
      if (desc === 'Win the League') return { ...obj, checkType: 'league_position', targetMin: 1, xpReward: 40 };
      if (desc === 'Finish in Top 3') return { ...obj, checkType: 'league_position', targetMin: 3, targetOverachieve: 1, xpReward: 25, xpRewardOverachieve: 50 };
      if (desc === 'Finish in Top 6') return { ...obj, checkType: 'league_position', targetMin: 6, targetOverachieve: 3, xpReward: 40, xpRewardOverachieve: 80, budgetBoost: 2000000 };
      if (desc.includes('Top Half') || desc.includes('Reach Top Half')) return { ...obj, checkType: 'league_position', targetMin: 10, targetOverachieve: 6, xpReward: 40, xpRewardOverachieve: 80 };
      if (desc.startsWith('Avoid Replacement')) { const m = desc.match(/Top (\d+)/); return { ...obj, checkType: 'league_position', targetMin: m ? parseInt(m[1]) : 17, xpReward: 40 }; }
      if (desc === 'Stay within budget') return { ...obj, checkType: 'budget', targetMin: 0, xpReward: 15 };
      if (desc === 'Win the Cup') return { ...obj, checkType: 'cup_round', targetMin: 1, xpReward: 25 };
      if (desc === 'Reach Cup Semi-Final') return { ...obj, checkType: 'cup_round', targetMin: 2, targetOverachieve: 1, xpReward: 25, xpRewardOverachieve: 50 };
      if (desc === 'Reach Cup Quarter-Final') return { ...obj, checkType: 'cup_round', targetMin: 3, targetOverachieve: 2, xpReward: 15, xpRewardOverachieve: 30 };
      return obj;
    });
    return { ...data, boardObjectives: updated, version: 54 };
  },

  // v54 → v55: Add activeInterview for enhanced job market interview system
  54: (data) => ({
    ...data,
    activeInterview: null,
    version: 55,
  }),

  // v55 → v56: Multi-division league structure + contractStrikes
  55: (data) => {
    const playerDiv = data.playerDivision as string;
    const league = LEAGUES.find((l: { id: string }) => l.id === playerDiv);
    const countryId = league?.countryId || playerDiv;
    const countryLeagues = getLeaguesByCountry(countryId);

    const divisionClubs = { ...(data.divisionClubs as Record<string, string[]> || {}) };
    const divisionFixtures = { ...(data.divisionFixtures as Record<string, unknown[]> || {}) };
    const clubs = { ...(data.clubs as Record<string, unknown> || {}) };
    const players = { ...(data.players as Record<string, unknown> || {}) };
    const season = (data.season as number) || 1;

    for (const cl of countryLeagues) {
      if (divisionClubs[cl.id]?.length) continue;

      const leagueClubData = ALL_CLUBS.filter((cd: { divisionId: string }) => cd.divisionId === cl.id);
      const clubIds: string[] = [];

      for (const cd of leagueClubData) {
        const club = {
          id: cd.id, name: cd.name, shortName: cd.shortName,
          color: cd.color, secondaryColor: cd.secondaryColor,
          budget: cd.budget, wageBill: 0, reputation: cd.reputation,
          facilities: cd.facilities, youthRating: cd.youthRating,
          fanBase: cd.fanBase, boardPatience: cd.boardPatience,
          playerIds: [] as string[], formation: '4-3-3', lineup: [] as string[], subs: [] as string[],
          divisionId: cd.divisionId,
          stadiumName: cd.stadiumName,
          stadiumCapacity: cd.stadiumCapacity,
        };

        const squad = generateSquad(club.id, cd.squadQuality, season, cd.divisionId, /* isInitialSeason */ false, /* useRealNames */ data.communityPackEnabled === true);
        let totalWages = 0;
        for (const p of squad) {
          players[p.id] = p;
          club.playerIds.push(p.id);
          totalWages += p.wage;
        }
        club.wageBill = totalWages;

        const { lineup, subs } = selectBestLineup(squad, '4-3-3');
        club.lineup = lineup.map((p: { id: string }) => p.id);
        club.subs = subs.map((p: { id: string }) => p.id);

        clubs[club.id] = club;
        clubIds.push(club.id);
      }

      divisionClubs[cl.id] = clubIds;
      divisionFixtures[cl.id] = generateDivisionFixtures(clubIds, cl.totalWeeks || 46);
    }

    return {
      ...data,
      contractStrikes: {},
      divisionClubs,
      divisionFixtures,
      clubs,
      players,
      version: 56,
    };
  },

  // v56 → v57: Pack opening feature — openedPacks log, pity counter, last-opened week tracking
  56: (data) => ({
    ...data,
    version: 57,
    openedPacks: data.openedPacks || [],
    packPityCounter: data.packPityCounter ?? 0,
    lastPackWeek: data.lastPackWeek ?? 0,
    lastPackSeason: data.lastPackSeason ?? 0,
  }),

  // v57 → v58: one-time lineup self-heal for the player's club. Earlier pack
  // opens appended to playerIds but never touched lineup/subs, leaving
  // pulls invisible until the user pressed Optimize. Re-run the optimizer
  // once on load so existing saves self-heal retroactively. Bounded work:
  // a single club, single Hungarian pass.
  57: (data) => {
    const clubs = data.clubs as Record<string, Club> | undefined;
    const players = data.players as Record<string, Player> | undefined;
    const playerClubId = data.playerClubId as string | undefined;
    if (!clubs || !players || !playerClubId) {
      return { ...data, version: 58 };
    }
    const club = clubs[playerClubId];
    if (!club || !club.formation) {
      return { ...data, version: 58 };
    }
    // Filter strictly: any player missing the `attributes` field will crash
    // autoFillBestTeam → positionalOverall → attrs.pace. Belt-and-braces seal.
    const squad = (club.playerIds || [])
      .map(id => players[id])
      .filter((p): p is Player => !!p && typeof p === 'object' && !!(p as Player).attributes);
    if (squad.length === 0) {
      return { ...data, version: 58 };
    }
    const week = (data.week as number) ?? 1;
    const season = (data.season as number) ?? 1;
    let result: ReturnType<typeof autoFillBestTeam>;
    try {
      result = autoFillBestTeam(squad, club.formation as FormationType, week, season);
    } catch {
      // If anything in the auto-fill path throws, skip the migration step
      // rather than locking the user out of their save via SaveRecoveryDialog.
      return { ...data, version: 58 };
    }
    if (result.lineup.length === 0) {
      return { ...data, version: 58 };
    }
    return {
      ...data,
      version: 58,
      clubs: {
        ...clubs,
        [playerClubId]: {
          ...club,
          lineup: result.lineup.map(p => p.id),
          subs: result.subs.map(p => p.id),
        },
      },
    };
  },

  // v58 → v59: HalfState.usedCommentaryLines changed from Set<string> to string[].
  // Pre-v59 saves persisted `{}` (Sets don't survive JSON.stringify), which
  // breaks `.includes()` after reload. Normalize any shape to a plain array.
  // Defensive against corrupted saves where halfTimeState may be anything.
  58: (data) => {
    const half = data.halfTimeState;
    if (!half || typeof half !== 'object' || Array.isArray(half)) {
      return { ...data, version: 59 };
    }
    const obj = half as Record<string, unknown>;
    const raw = obj.usedCommentaryLines;
    const wasLegacyShape = raw !== undefined && !Array.isArray(raw);
    const normalized = Array.isArray(raw) ? raw : [];
    if (wasLegacyShape) {
      // Observability: count how many real saves hit the legacy Set shape.
      // Info-level so it doesn't page, but we can track volume in Sentry.
      Sentry.addBreadcrumb({
        category: 'saveMigration',
        level: 'info',
        message: 'v58→v59: healed halfTimeState.usedCommentaryLines from non-array',
        data: { rawType: typeof raw },
      });
    }
    return {
      ...data,
      version: 59,
      halfTimeState: { ...obj, usedCommentaryLines: normalized },
    };
  },

  // v59 → v60: Community Pack fields added to GameState.
  59: (data) => ({
    ...data,
    version: 60,
    communityPackEnabled: data.communityPackEnabled ?? false,
    cpPool: data.cpPool ?? {
      shuffleSeed: 0,
      cursor: 0,
      usedFcIds: [],
      marketListings: [],
      lastMarketRefreshWeek: 0,
    },
  }),

  // v60 → v61: added cpPool.lastSeedSeason for Phase E.7 FA-pool seeding.
  // Old saves: treat as "already past the seed window" so we don't retro-
  // inject FAs into in-progress games — seeds are a game-start mechanic.
  60: (data) => {
    const existingPool = data.cpPool as Record<string, unknown> | undefined;
    return {
      ...data,
      version: 61,
      cpPool: existingPool
        ? { ...existingPool, lastSeedSeason: existingPool.lastSeedSeason ?? 99 }
        : {
            shuffleSeed: 0,
            cursor: 0,
            usedFcIds: [],
            marketListings: [],
            lastMarketRefreshWeek: 0,
            lastSeedSeason: 99,
          },
    };
  },

  // v61 → v62: expand abbreviated first names ("E.", "A. Van") to full
  // names. Community-pack data (auto-derived from FC26 short_name) used
  // to ship as bare initials, which rendered as a lone "E." under the
  // surname on player cards. We now expand on import; this migration
  // does the same for players already saved.
  61: (data) => {
    const players = data.players as Record<string, Player> | undefined;
    if (!players || typeof players !== 'object') {
      return { ...data, version: 62 };
    }
    const next: Record<string, Player> = {};
    for (const [id, raw] of Object.entries(players)) {
      const p = raw as Player | undefined;
      if (!p || typeof p !== 'object') {
        next[id] = raw;
        continue;
      }
      const expanded = expandAbbreviatedFirstName(
        p.firstName ?? '',
        p.nationality ?? '',
        p.id ?? id,
      );
      next[id] = expanded === p.firstName ? p : { ...p, firstName: expanded };
    }
    return { ...data, version: 62, players: next };
  },

  // v62 → v63: Pack monetization revamp — the once-per-week throttle was
  // removed, Bronze became a free rewarded-ad pack with a per-day open
  // limit, and Premium / Icon packs are now consumable IAPs. Existing
  // saves get a fresh `adPackOpens` bucket so the daily-limit gate works
  // immediately. `lastPackWeek` / `lastPackSeason` are kept for save
  // compatibility but no longer enforce a cooldown.
  62: (data) => ({
    ...data,
    version: 63,
    adPackOpens: data.adPackOpens || { date: '', counts: {} },
  }),

  // v63 → v64: Pack model now supports layered methods per tier
  // (free → ad → iap → currency). Replaces the single-bucket
  // `adPackOpens.counts` with two buckets (`free`, `ad`) under a new
  // `dailyPackOpens` key. Bronze + Silver: 1 free/day + 3 ad/day.
  // Gold: 1 free/day + unlimited IAP. Premium / Icon: IAP only.
  // Migration carries the old per-tier ad count into the new `ad`
  // bucket and starts the `free` bucket empty (so users get today's
  // free pack on next open).
  63: (data) => {
    const oldBucket = data.adPackOpens as
      | { date?: string; counts?: Record<string, number> }
      | undefined;
    return {
      ...data,
      version: 64,
      dailyPackOpens: {
        date: oldBucket?.date || '',
        free: {},
        ad: oldBucket?.counts || {},
      },
    };
  },

  // v65 → v66: Staff depth + youth focus + merch player drops.
  //   - StaffMember gains optional morale/traits/contractYearsRemaining/
  //     seasonsAtClub/performance/lastInteractionWeek/lastRenewalWeek.
  //     Backfilled with sensible defaults so older saves load cleanly.
  //   - YouthAcademy gains spotlightUsesRemaining (2 per season).
  //   - YouthProspects gain optional trainingFocus and spotlightedThisSeason.
  //   - MerchState gains signatureDrop, signatureDropCooldownWeeks,
  //     signatureDropsUsedThisSeason, winStreak, derbyBuzzWeeks.
  //   The runtime `ensureStaffFields` helper also patches at use-time, so
  //   this migration is mostly belt-and-braces for clean state shape.
  65: (data) => {
    const staff = data.staff as { members?: unknown[]; availableHires?: unknown[] } | undefined;
    type StaffLike = {
      id: string; firstName: string; lastName: string; role: string;
      quality: number; wage: number;
      morale?: number; traits?: string[]; contractYearsRemaining?: number;
      seasonsAtClub?: number; performance?: unknown;
      lastInteractionWeek?: number; lastRenewalWeek?: number;
    };
    const upgradeMember = (m: StaffLike): StaffLike => ({
      ...m,
      morale: typeof m.morale === 'number' ? m.morale : 70,
      traits: Array.isArray(m.traits) ? m.traits : [],
      contractYearsRemaining: typeof m.contractYearsRemaining === 'number' ? m.contractYearsRemaining : 2,
      seasonsAtClub: typeof m.seasonsAtClub === 'number' ? m.seasonsAtClub : 0,
      performance: m.performance ?? { trainingGains: 0, youthPromotions: 0, scoutFinds: 0, injuriesPrevented: 0, weeksAtClub: 0 },
      lastInteractionWeek: typeof m.lastInteractionWeek === 'number' ? m.lastInteractionWeek : -99,
      lastRenewalWeek: typeof m.lastRenewalWeek === 'number' ? m.lastRenewalWeek : -99,
    });
    const upgradedStaff = staff ? {
      ...staff,
      members: Array.isArray(staff.members) ? (staff.members as StaffLike[]).map(upgradeMember) : [],
      availableHires: Array.isArray(staff.availableHires) ? (staff.availableHires as StaffLike[]).map(upgradeMember) : [],
    } : { members: [], availableHires: [] };

    const youth = data.youthAcademy as { prospects?: unknown[]; nextIntakePreview?: unknown[]; youthPreviewEnhanced?: boolean; spotlightUsesRemaining?: number } | undefined;
    type ProspectLike = { playerId: string; readyToPromote: boolean; developmentScore: number; trainingFocus?: string; spotlightedThisSeason?: boolean };
    const upgradedYouth = {
      prospects: Array.isArray(youth?.prospects) ? (youth!.prospects as ProspectLike[]).map(p => ({
        ...p,
        trainingFocus: p.trainingFocus ?? 'balanced',
        spotlightedThisSeason: p.spotlightedThisSeason ?? false,
      })) : [],
      nextIntakePreview: Array.isArray(youth?.nextIntakePreview) ? youth!.nextIntakePreview : [],
      youthPreviewEnhanced: !!youth?.youthPreviewEnhanced,
      spotlightUsesRemaining: typeof youth?.spotlightUsesRemaining === 'number' ? youth!.spotlightUsesRemaining : 2,
    };

    const merch = data.merchandise as Record<string, unknown> | undefined;
    const upgradedMerch = merch ? {
      ...merch,
      signatureDrop: merch.signatureDrop ?? null,
      signatureDropCooldownWeeks: typeof merch.signatureDropCooldownWeeks === 'number' ? merch.signatureDropCooldownWeeks : 0,
      signatureDropsUsedThisSeason: Array.isArray(merch.signatureDropsUsedThisSeason) ? merch.signatureDropsUsedThisSeason : [],
      winStreak: typeof merch.winStreak === 'number' ? merch.winStreak : 0,
      derbyBuzzWeeks: typeof merch.derbyBuzzWeeks === 'number' ? merch.derbyBuzzWeeks : 0,
    } : merch;

    return {
      ...data,
      version: 66,
      staff: upgradedStaff,
      youthAcademy: upgradedYouth,
      ...(upgradedMerch ? { merchandise: upgradedMerch } : {}),
    };
  },

  // v66 → v67: Player rarity tier rebalance.
  //   - Adds `rarity` field on every Player, derived from current overall +
  //     ballonDOrPlacements (legend = OVR ≥ 90 + Ballon d'Or pedigree, etc).
  //   - Recomputes value/wage with the new rarity multiplier so existing
  //     legends become more valuable on first load (matches new generation).
  //   - Refines the VALUE_AGE_MULTIPLIERS curve — peak window 24-28, sharper
  //     drop after 32. The recomputation here doesn't apply the new age curve
  //     to value (that happens naturally via `applyPlayerDevelopment` next
  //     week), so the migration is conservative: it only adds rarity and
  //     scales current value/wage by the new rarity multiplier.
  66: (data) => {
    const players = data.players as Record<string, Player> | undefined;
    let upgradedPlayers = players;
    if (players && typeof players === 'object') {
      upgradedPlayers = {};
      for (const [id, p] of Object.entries(players)) {
        if (!p || typeof p !== 'object') {
          upgradedPlayers[id] = p;
          continue;
        }
        const next: Player = { ...p };
        next.rarity = getPlayerRarity(next);
        const valueMult = getRarityValueMultiplier(next.rarity);
        const wageMult = getRarityWageMultiplier(next.rarity);
        // Only inflate — never deflate — to keep the migration safe for old
        // saves where value/wage might already include third-party tweaks.
        if (valueMult > 1) next.value = Math.round((next.value || 0) * valueMult);
        if (wageMult > 1) next.wage = Math.round((next.wage || 0) * wageMult);
        upgradedPlayers[id] = next;
      }
    }

    return {
      ...data,
      version: 67,
      ...(upgradedPlayers ? { players: upgradedPlayers } : {}),
    };
  },

  // v67 → v68: Backfill 13 GameState fields that were mutated by gameplay
  // but never written to the save payload. Pre-v68 saves silently dropped
  // `seasonTotalExpenses` (and all the other listed fields) on every
  // reload, so finance summaries, season trackers, the Pro-only
  // `tacticalPresets`, and the Community Pack opt-in survived only as
  // long as the tab stayed open. New saves carry these forward; this
  // migration seeds defaults for in-progress saves so the loader's
  // fallback path doesn't run on every load forever.
  67: (data) => {
    // Rebuilt cpPool fallback: lastSeedSeason 99 mirrors the deliberate
    // v60→v61 default — a save without a pool must never pass the
    // season-seed gate and retro-inject FC26 free agents that may already
    // exist in the world (duplicate real players). For the same reason,
    // reconstruct usedFcIds from players that already carry an fcId so
    // future market draws can't issue a second copy of them.
    let fallbackPool: Record<string, unknown> | undefined;
    if (!data.cpPool) {
      const usedFcIds: string[] = [];
      const players = data.players;
      if (players && typeof players === 'object' && !Array.isArray(players)) {
        for (const p of Object.values(players as Record<string, Record<string, unknown>>)) {
          if (p && typeof p === 'object' && typeof p.fcId === 'string' && p.fcId) usedFcIds.push(p.fcId);
        }
      }
      fallbackPool = {
        shuffleSeed: 0, cursor: 0, usedFcIds, marketListings: [],
        lastMarketRefreshWeek: 0, lastSeedSeason: 99,
      };
    }
    return {
      ...data,
      version: 68,
      contractStrikes: data.contractStrikes || {},
      tacticalPresets: data.tacticalPresets || [],
      transferFilters: data.transferFilters || {
        tab: 'market', posFilter: 0, searchQuery: '',
        sortBy: 'overall', faSortBy: 'overall', divFilter: 'all',
        newsTypeFilter: 'all', hideUnaffordable: false, showShortlistOnly: false,
      },
      pendingGemReveal: data.pendingGemReveal ?? null,
      pendingTransferTalk: data.pendingTransferTalk ?? null,
      seasonStartAvgOVR: data.seasonStartAvgOVR ?? 0,
      seasonTransfersBought: data.seasonTransfersBought || [],
      seasonTransfersSold: data.seasonTransfersSold || [],
      seasonTotalIncome: data.seasonTotalIncome ?? 0,
      seasonTotalExpenses: data.seasonTotalExpenses ?? 0,
      clubPowerRankings: data.clubPowerRankings || {},
      communityPackEnabled: data.communityPackEnabled ?? false,
      cpPool: data.cpPool || fallbackPool,
    };
  },

  // v68 → v69: SponsorOffer gained an optional `negotiation` field for the
  // multi-round haggling flow. Existing pending offers simply carry no
  // negotiation (undefined) — the field is optional, so there is nothing
  // to backfill; this is a clean version bump.
  68: (data) => ({ ...data, version: 69 }),

  // v69 → v70: GameSettings gained `performanceMode` (smoothness escape hatch
  // for low-end devices). Default off so existing saves are unchanged.
  69: (data) => {
    const settings = (data.settings ?? {}) as Record<string, unknown>;
    return {
      ...data,
      version: 70,
      settings: { ...settings, performanceMode: settings.performanceMode ?? false },
    };
  },

  // v71 → v72: HalfState gained `subbedOut` (players substituted off in an
  // earlier half — rebuilt into the engine's `unavailable` set so AI subs
  // can't "resurrect" in extra time). Mid-match saves carry halfTimeState;
  // default the field to [] so the engine's `?? []` fallback is explicit in
  // the persisted shape. v72 also adds the OPTIONAL `won` flag on
  // NationalTeamResult knockout records (shootout wins are drawn on goals);
  // legacy records need no transformation — readers fall back to a goals
  // comparison. v72 also widens `preMatchSnapshot` (Invincible-perk rewind)
  // with OPTIONAL fields (clubs, managerStats, managerProgression,
  // careerTimeline, rivalries, pairFamiliarity, clubPowerRankings,
  // sessionStats, messages, pendingPressConference) — no transformation
  // needed: snapshots lacking them simply leave the current values in
  // place on rewind.
  71: (data) => {
    const hts = data.halfTimeState as { subbedOut?: unknown } | null | undefined;
    if (!hts || typeof hts !== 'object') return { ...data, version: 72 };
    return {
      ...data,
      version: 72,
      halfTimeState: { ...hts, subbedOut: Array.isArray(hts.subbedOut) ? hts.subbedOut : [] },
    };
  },

  // v70 → v71: weekly objectives gained a `claimed` flag — base XP is now
  // claimed on the dashboard instead of auto-granted on completion. Existing
  // saves were paid under the old auto-grant rules, so mark any already-
  // completed objective as claimed (don't let it become re-claimable).
  70: (data) => {
    const objectives = Array.isArray(data.weeklyObjectives) ? data.weeklyObjectives : [];
    return {
      ...data,
      version: 71,
      weeklyObjectives: objectives.map((o) => {
        const obj = (o ?? {}) as Record<string, unknown>;
        return { ...obj, claimed: obj.claimed ?? obj.completed ?? false };
      }),
    };
  },

  // v64 → v65: National team `fifaRanking` was hardcoded to 25 on init —
  // recompute from the canonical per-nation `baseRanking` so France no
  // longer shows up as #25. Also adds `squadConfirmed: false` to any
  // active international tournament so the new pre-tournament squad
  // picker still triggers for in-progress saves.
  64: (data) => {
    const nt = data.nationalTeam as { nationality?: string; fifaRanking?: number } | null | undefined;
    let fixedNationalTeam = nt;
    if (nt && typeof nt === 'object' && nt.nationality) {
      const found = NATIONS.find(n => n.name === nt.nationality);
      fixedNationalTeam = { ...nt, fifaRanking: found?.baseRanking ?? nt.fifaRanking ?? 50 };
    }
    const tourney = data.internationalTournament as { squadConfirmed?: boolean } | null | undefined;
    let fixedTournament = tourney;
    if (tourney && typeof tourney === 'object' && tourney.squadConfirmed === undefined) {
      // Existing tournaments are already running, so treat the squad as confirmed.
      fixedTournament = { ...tourney, squadConfirmed: true };
    }
    return {
      ...data,
      version: 65,
      nationalTeam: fixedNationalTeam ?? null,
      internationalTournament: fixedTournament ?? null,
    };
  },
};

/** Lightweight structural check for a save payload *after* migration. Guards
 *  the `loadGame` apply path from crashing on malformed data when all we did
 *  was `JSON.parse` something off disk. Keep minimal — if the top-level shape
 *  is intact we trust the migration chain for everything deeper. */
export type SaveValidationResult = { ok: true } | { ok: false; reason: string };

export function validateSaveShape(data: unknown): SaveValidationResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'save root is not an object' };
  }
  const d = data as Record<string, unknown>;
  if (typeof d.playerClubId !== 'string' || !d.playerClubId) {
    return { ok: false, reason: 'missing playerClubId' };
  }
  if (!d.clubs || typeof d.clubs !== 'object' || Array.isArray(d.clubs)) {
    return { ok: false, reason: 'missing clubs map' };
  }
  if (typeof d.season !== 'number' || !Number.isFinite(d.season)) {
    return { ok: false, reason: 'missing season' };
  }
  if (typeof d.week !== 'number' || !Number.isFinite(d.week)) {
    return { ok: false, reason: 'missing week' };
  }
  const clubs = d.clubs as Record<string, unknown>;
  if (!(d.playerClubId in clubs)) {
    return { ok: false, reason: 'playerClubId not present in clubs map' };
  }
  return { ok: true };
}

/** Returns true if the save was written by a newer app than we can migrate.
 *  Loading a future-version save with an old app silently drops fields and
 *  corrupts the downgrade path — we refuse instead. */
export function isSaveFromNewerVersion(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const v = (data as { version?: unknown }).version;
  return typeof v === 'number' && Number.isFinite(v) && v > CURRENT_VERSION;
}

export function migrateSaveData(data: Record<string, unknown>): Record<string, unknown> {
  let version = (data.version || 1) as number;
  let migrated = { ...data };

  while (version < CURRENT_VERSION) {
    const migrate = migrations[version];
    if (!migrate) {
      // A gap in the migration chain — `version` is below CURRENT_VERSION
      // but no migration step exists to advance it. Without flagging this,
      // the partially-migrated save silently passes validateSaveShape and
      // loads with mixed-version data. Mark it so the caller can surface a
      // recovery prompt instead of trusting the half-migrated payload.
      Sentry.captureException(
        new Error(`saveMigration: missing migration step for version ${version}`),
        { tags: { context: 'saveMigration', fromVersion: String(version) } },
      );
      migrated = { ...migrated, migrationError: true };
      break;
    }
    try {
      migrated = migrate(migrated);
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'saveMigration', fromVersion: String(version) } });
      // Stop migration on failure — don't skip broken migrations as that corrupts downstream data
      migrated = { ...migrated, migrationError: true };
      break;
    }
    version = migrated.version as number;
  }

  return migrated;
}

export { CURRENT_VERSION };
