import { TacticalInstructions, TrainingState, TrainingModule, ScoutRegion, FacilitiesState, TacticalPreset, StadiumStands, Position } from '@/types/game';
import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import { GROWTH_YOUTH_PER_PROMOTION, STAT_MAX as CAREER_STAT_MAX } from '@/config/managerCareer';
import { createAssignment } from '@/utils/scouting';
import { STARTING_TACTICAL_FAMILIARITY, FACILITY_COST_PER_LEVEL, FACILITY_BASE_UPGRADE_WEEKS, FACILITY_MAX_LEVEL, STAND_COST_PER_LEVEL, STAND_BASE_UPGRADE_WEEKS, MAX_SQUAD_SIZE } from '@/config/gameBalance';
import { MAX_TACTICAL_PRESETS } from '@/config/monetization';
import { STAFF_HIRING_FEE_WEEKS } from '@/config/staff';
import { STAND_INFO } from '@/utils/facilities';
import { placePlayerInClub } from '../helpers/rosterOps';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

export const createSystemsSlice = (set: Set, get: Get) => ({
  tactics: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 } as TacticalInstructions,
  training: {
    schedule: { mon: 'fitness', tue: 'attacking', wed: 'defending', thu: 'mentality', fri: 'tactical' },
    intensity: 'medium', individualPlans: [], tacticalFamiliarity: STARTING_TACTICAL_FAMILIARITY,
  } as TrainingState,
  staff: { members: [], availableHires: [] } as GameState['staff'],
  scouting: { maxAssignments: 1, assignments: [], reports: [], discoveredPlayers: [] } as GameState['scouting'],
  youthAcademy: { prospects: [], nextIntakePreview: [], youthPreviewEnhanced: false } as GameState['youthAcademy'],
  facilities: { trainingLevel: 5, youthLevel: 5, stadiumStands: { north: 5, south: 5, east: 5, west: 5 }, medicalLevel: 5, recoveryLevel: 5, upgradeInProgress: null } as GameState['facilities'],
  financeHistory: [] as GameState['financeHistory'],
  tacticalPresets: [] as TacticalPreset[],

  setTactics: (partial: Partial<TacticalInstructions>) => set(s => ({ tactics: { ...s.tactics, ...partial } })),

  saveTacticalPreset: (name: string) => {
    const state = get();
    if (state.tacticalPresets.length >= MAX_TACTICAL_PRESETS) return;
    const club = state.clubs[state.playerClubId];
    if (!club) return;
    const preset: TacticalPreset = {
      id: crypto.randomUUID(),
      name,
      formation: club.formation,
      tactics: { ...state.tactics },
      createdAt: new Date().toISOString(),
    };
    set({ tacticalPresets: [...state.tacticalPresets, preset] });
  },

  loadTacticalPreset: (presetId: string) => {
    const state = get();
    const preset = state.tacticalPresets.find(p => p.id === presetId);
    if (!preset) return;
    const club = state.clubs[state.playerClubId];
    if (!club) return;
    set({
      tactics: { ...preset.tactics },
      clubs: { ...state.clubs, [state.playerClubId]: { ...club, formation: preset.formation } },
    });
  },

  deleteTacticalPreset: (presetId: string) => set(s => ({
    tacticalPresets: s.tacticalPresets.filter(p => p.id !== presetId),
  })),

  updateTraining: (schedule: Partial<TrainingState['schedule']>, intensity?: TrainingState['intensity']) => set(s => {
    // Clear drill for any day whose module changed
    const newDrillSchedule = { ...(s.training.drillSchedule || {}) };
    for (const day of Object.keys(schedule) as (keyof TrainingState['schedule'])[]) {
      if (schedule[day] !== s.training.schedule[day]) {
        delete newDrillSchedule[day];
      }
    }
    return {
      training: {
        ...s.training,
        schedule: { ...s.training.schedule, ...schedule },
        intensity: intensity || s.training.intensity,
        drillSchedule: newDrillSchedule,
      },
    };
  }),

  updateDrillSchedule: (drills: Partial<TrainingState['drillSchedule']>) => set(s => ({
    training: {
      ...s.training,
      drillSchedule: { ...(s.training.drillSchedule || {}), ...drills },
    },
  })),

  setIndividualTraining: (playerId: string, focus: TrainingModule | null) => set(s => {
    const plans = (s.training.individualPlans || []).filter(p => p.playerId !== playerId);
    if (focus) plans.push({ playerId, focus });
    return { training: { ...s.training, individualPlans: plans } };
  }),

  setPlayerPrimaryPosition: (playerId: string, newPosition: Position) => set(s => {
    const player = s.players[playerId];
    if (!player) return {};
    if (player.position === newPosition) return {};
    // Guard: only allow promoting an existing alternate — we don't teach
    // the player a brand-new position.
    const alts = player.alternatePositions || [];
    if (!alts.includes(newPosition)) return {};
    // Swap: old primary slots into alternates; chosen alt becomes primary.
    // Keep the rest of the alternates order stable so repeat swaps stay
    // predictable for the UI.
    const nextAlts: Position[] = [
      player.position,
      ...alts.filter(p => p !== newPosition),
    ];
    return {
      players: {
        ...s.players,
        [playerId]: {
          ...player,
          position: newPosition,
          alternatePositions: nextAlts,
        },
      },
    };
  }),

  hireStaff: (staffId: string) => {
    const state = get();
    const hire = state.staff.availableHires.find(s => s.id === staffId);
    if (!hire) return;
    const club = state.clubs[state.playerClubId];
    if (!club) return;
    const hiringFee = hire.wage * STAFF_HIRING_FEE_WEEKS;
    if (club.budget < hiringFee) return;
    // One staff per role — auto-release existing holder
    const existing = state.staff.members.find(s => s.role === hire.role);
    const membersAfterRelease = existing
      ? state.staff.members.filter(s => s.id !== existing.id)
      : state.staff.members;
    const newClub = { ...club, budget: club.budget - hiringFee };
    const newMembers = [...membersAfterRelease, hire];
    const newAvailable = state.staff.availableHires.filter(s => s.id !== staffId);
    const scoutCount = newMembers.filter(s => s.role === 'scout').length;
    let newMessages = state.messages;
    if (existing) {
      newMessages = addMsg(newMessages, {
        week: state.week, season: state.season, type: 'general',
        title: `${existing.firstName} ${existing.lastName} Released`,
        body: `${existing.firstName} ${existing.lastName} has been released to make room for a new ${hire.role.replace(/-/g, ' ')}.`,
      });
    }
    newMessages = addMsg(newMessages, {
      week: state.week, season: state.season, type: 'general',
      title: `${hire.firstName} ${hire.lastName} Hired`,
      body: `${hire.firstName} ${hire.lastName} has joined your staff as ${hire.role.replace(/-/g, ' ')}. Hiring fee: £${Math.round(hiringFee / 1000)}K.`,
    });
    set({
      staff: { members: newMembers, availableHires: newAvailable },
      clubs: { ...state.clubs, [state.playerClubId]: newClub },
      scouting: { ...state.scouting, maxAssignments: scoutCount },
      messages: newMessages,
    });
  },

  fireStaff: (staffId: string) => {
    const state = get();
    const member = state.staff.members.find(s => s.id === staffId);
    if (!member) return;
    const newMembers = state.staff.members.filter(s => s.id !== staffId);
    const scoutCount = newMembers.filter(s => s.role === 'scout').length;
    // Trim active assignments to match new scout capacity (keep oldest/most progressed)
    const trimmedAssignments = state.scouting.assignments.slice(0, scoutCount);
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: `${member.firstName} ${member.lastName} Released`,
      body: `${member.firstName} ${member.lastName} has been released from your staff.`,
    });
    set({
      staff: { ...state.staff, members: newMembers },
      scouting: { ...state.scouting, maxAssignments: scoutCount, assignments: trimmedAssignments },
      messages: newMessages,
    });
  },

  assignScout: (region: ScoutRegion) => {
    const state = get();
    if (state.scouting.assignments.length >= state.scouting.maxAssignments) return;
    const assignment = createAssignment(region);
    set({
      scouting: { ...state.scouting, assignments: [...state.scouting.assignments, assignment] },
    });
  },

  cancelAssignment: (assignmentId: string) => {
    const state = get();
    set({
      scouting: { ...state.scouting, assignments: state.scouting.assignments.filter(a => a.id !== assignmentId) },
    });
  },

  boostScoutReports: () => {
    const state = get();
    const boostedReports = state.scouting.reports.map(r => ({
      ...r,
      knowledgeLevel: Math.min(100, r.knowledgeLevel + 30),
    }));
    set({
      scouting: { ...state.scouting, reports: boostedReports },
    });
  },

  dismissScoutReport: (reportId: string) => {
    const state = get();
    const report = state.scouting.reports.find(r => r.id === reportId);
    set({
      scouting: { ...state.scouting, reports: state.scouting.reports.filter(r => r.id !== reportId) },
      ...(report ? { scoutWatchList: state.scoutWatchList.filter(id => id !== report.playerId) } : {}),
    });
  },

  addToWatchList: (playerId: string) => set(s => ({
    scoutWatchList: s.scoutWatchList.includes(playerId) ? s.scoutWatchList : [...s.scoutWatchList, playerId],
  })),

  removeFromWatchList: (playerId: string) => set(s => ({
    scoutWatchList: s.scoutWatchList.filter(id => id !== playerId),
  })),

  promoteYouth: (playerId: string) => {
    const state = get();
    const prospect = state.youthAcademy.prospects.find(p => p.playerId === playerId);
    if (!prospect) return { success: false, message: 'Prospect not found.' };
    const player = state.players[playerId];
    if (!player) return { success: false, message: 'Player not found.' };
    const club = { ...state.clubs[state.playerClubId] };
    if (club.playerIds.length >= MAX_SQUAD_SIZE) return { success: false, message: `Squad is full (${MAX_SQUAD_SIZE} players). Release or sell a player first.` };
    const updatedPlayer = { ...player, isFromYouthAcademy: true, joinedSeason: player.joinedSeason ?? state.season };
    club.wageBill += updatedPlayer.wage;
    const promotedClubs = placePlayerInClub({ ...state.clubs, [club.id]: club }, club.id, playerId);
    const newProspects = state.youthAcademy.prospects.filter(p => p.playerId !== playerId);
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'development',
      title: `${player.lastName} Promoted`,
      body: `${player.firstName} ${player.lastName} (${player.position}, ${player.overall} OVR) has been promoted to the first team!`,
    });
    const youthMilestone = player.potential >= 70
      ? { id: crypto.randomUUID(), type: 'youth_graduate' as const, title: 'Youth Graduate', description: `${player.firstName} ${player.lastName} (${player.position}, pot. ${player.potential}) promoted from the academy.`, season: state.season, week: state.week, icon: 'star' }
      : null;
    set({
      players: { ...state.players, [playerId]: updatedPlayer },
      youthAcademy: { ...state.youthAcademy, prospects: newProspects },
      clubs: promotedClubs,
      messages: newMessages,
      careerTimeline: youthMilestone ? [...state.careerTimeline, youthMilestone] : state.careerTimeline,
    });
    // Career mode: grow youth development stat
    const postState = get();
    if (postState.gameMode === 'career' && postState.careerManager) {
      const cm = { ...postState.careerManager, attributes: { ...postState.careerManager.attributes } };
      cm.attributes.youthDevelopment = Math.min(CAREER_STAT_MAX, cm.attributes.youthDevelopment + GROWTH_YOUTH_PER_PROMOTION);
      set({ careerManager: cm });
    }
    return { success: true };
  },

  releaseYouth: (playerId: string) => {
    const state = get();
    const prospect = state.youthAcademy.prospects.find(p => p.playerId === playerId);
    if (!prospect) return;
    const newProspects = state.youthAcademy.prospects.filter(p => p.playerId !== playerId);
    const { [playerId]: _removed, ...restPlayers } = state.players;
    set({
      youthAcademy: { ...state.youthAcademy, prospects: newProspects },
      players: restPlayers,
    });
  },

  startUpgrade: (type: 'training' | 'youth' | 'medical' | 'recovery' | 'stadium-north' | 'stadium-south' | 'stadium-east' | 'stadium-west') => {
    const state = get();
    if (state.facilities.upgradeInProgress) return;

    const isStand = type.startsWith('stadium-');
    let currentLevel: number;
    let cost: number;
    let upgradeWeeks: number;
    let displayName: string;

    if (isStand) {
      const stand = type.replace('stadium-', '') as keyof StadiumStands;
      currentLevel = state.facilities.stadiumStands[stand];
      if (currentLevel >= FACILITY_MAX_LEVEL) return;
      cost = (currentLevel + 1) * STAND_COST_PER_LEVEL;
      upgradeWeeks = STAND_BASE_UPGRADE_WEEKS + currentLevel;
      displayName = STAND_INFO[stand].label;
    } else {
      const key = `${type}Level` as keyof Pick<FacilitiesState, 'trainingLevel' | 'youthLevel' | 'medicalLevel' | 'recoveryLevel'>;
      currentLevel = state.facilities[key] as number;
      if (currentLevel >= FACILITY_MAX_LEVEL) return;
      cost = (currentLevel + 1) * FACILITY_COST_PER_LEVEL;
      upgradeWeeks = FACILITY_BASE_UPGRADE_WEEKS + currentLevel;
      displayName = type.charAt(0).toUpperCase() + type.slice(1);
    }

    const club = state.clubs[state.playerClubId];
    if (!club || club.budget < cost) return;
    const newClub = { ...club, budget: club.budget - cost };
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: `${displayName} Upgrade Started`,
      body: `Upgrading ${displayName} to level ${currentLevel + 1}. Estimated completion: ${upgradeWeeks} weeks.`,
    });
    set({
      facilities: { ...state.facilities, upgradeInProgress: { type, weeksRemaining: upgradeWeeks, totalWeeks: upgradeWeeks } },
      clubs: { ...state.clubs, [state.playerClubId]: newClub },
      messages: newMessages,
    });
  },
});
