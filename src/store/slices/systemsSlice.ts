import { TacticalInstructions, TrainingState, TrainingModule, ScoutRegion, FacilitiesState, TacticalPreset } from '@/types/game';
import type { GameState } from '../storeTypes';
import { addMsg } from '@/utils/helpers';
import { GROWTH_YOUTH_PER_PROMOTION, STAT_MAX as CAREER_STAT_MAX } from '@/config/managerCareer';
import { createAssignment } from '@/utils/scouting';
import { STARTING_TACTICAL_FAMILIARITY, FACILITY_COST_PER_LEVEL, FACILITY_BASE_UPGRADE_WEEKS, FACILITY_MAX_LEVEL } from '@/config/gameBalance';
import { MAX_TACTICAL_PRESETS } from '@/config/monetization';

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
  youthAcademy: { prospects: [], nextIntakePreview: [] } as GameState['youthAcademy'],
  facilities: { trainingLevel: 5, youthLevel: 5, stadiumLevel: 5, medicalLevel: 5, recoveryLevel: 5, upgradeInProgress: null } as GameState['facilities'],
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

  hireStaff: (staffId: string) => {
    const state = get();
    const hire = state.staff.availableHires.find(s => s.id === staffId);
    if (!hire) return;
    const club = state.clubs[state.playerClubId];
    if (!club) return;
    // One staff per role — auto-release existing holder
    const existing = state.staff.members.find(s => s.role === hire.role);
    const membersAfterRelease = existing
      ? state.staff.members.filter(s => s.id !== existing.id)
      : state.staff.members;
    const newClub = { ...club, budget: club.budget - hire.wage * 4 };
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
      body: `${hire.firstName} ${hire.lastName} has joined your staff as ${hire.role.replace(/-/g, ' ')}.`,
    });
    set({
      staff: { members: newMembers, availableHires: newAvailable },
      clubs: { ...state.clubs, [state.playerClubId]: newClub },
      scouting: { ...state.scouting, maxAssignments: Math.max(1, scoutCount) },
      messages: newMessages,
    });
  },

  fireStaff: (staffId: string) => {
    const state = get();
    const member = state.staff.members.find(s => s.id === staffId);
    if (!member) return;
    const newMembers = state.staff.members.filter(s => s.id !== staffId);
    const scoutCount = newMembers.filter(s => s.role === 'scout').length;
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: `${member.firstName} ${member.lastName} Released`,
      body: `${member.firstName} ${member.lastName} has been released from your staff.`,
    });
    set({
      staff: { ...state.staff, members: newMembers },
      scouting: { ...state.scouting, maxAssignments: Math.max(1, scoutCount) },
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

  addToWatchList: (playerId: string) => set(s => ({
    scoutWatchList: s.scoutWatchList.includes(playerId) ? s.scoutWatchList : [...s.scoutWatchList, playerId],
  })),

  removeFromWatchList: (playerId: string) => set(s => ({
    scoutWatchList: s.scoutWatchList.filter(id => id !== playerId),
  })),

  promoteYouth: (playerId: string) => {
    const state = get();
    const prospect = state.youthAcademy.prospects.find(p => p.playerId === playerId);
    if (!prospect) return;
    const player = state.players[playerId];
    if (!player) return;
    const updatedPlayer = { ...player, isFromYouthAcademy: true, joinedSeason: player.joinedSeason ?? state.season };
    const club = { ...state.clubs[state.playerClubId] };
    club.playerIds = [...club.playerIds, playerId];
    club.wageBill += updatedPlayer.wage;
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
      clubs: { ...state.clubs, [club.id]: club },
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

  startUpgrade: (type: 'training' | 'youth' | 'stadium' | 'medical' | 'recovery') => {
    const state = get();
    if (state.facilities.upgradeInProgress) return;
    const key = `${type}Level` as keyof Pick<FacilitiesState, 'trainingLevel' | 'youthLevel' | 'stadiumLevel' | 'medicalLevel' | 'recoveryLevel'>;
    const currentLevel = state.facilities[key] as number;
    if (currentLevel >= FACILITY_MAX_LEVEL) return;
    const cost = (currentLevel + 1) * FACILITY_COST_PER_LEVEL;
    const club = state.clubs[state.playerClubId];
    if (!club || club.budget < cost) return;
    const newClub = { ...club, budget: club.budget - cost };
    const upgradeWeeks = FACILITY_BASE_UPGRADE_WEEKS + currentLevel;
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Upgrade Started`,
      body: `Upgrading ${type} facility to level ${currentLevel + 1}. Estimated completion: ${upgradeWeeks} weeks.`,
    });
    set({
      facilities: { ...state.facilities, upgradeInProgress: { type, weeksRemaining: upgradeWeeks, totalWeeks: upgradeWeeks } },
      clubs: { ...state.clubs, [state.playerClubId]: newClub },
      messages: newMessages,
    });
  },
});
