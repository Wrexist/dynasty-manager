import { TacticalInstructions, TrainingState, TrainingModule, ScoutRegion, FacilitiesState, TacticalPreset, StadiumStands, YouthFocus } from '@/types/game';
import type { GameState } from '../storeTypes';
import { addMsg, safeRandomUUID } from '@/utils/helpers';
import { GROWTH_YOUTH_PER_PROMOTION, STAT_MAX as CAREER_STAT_MAX } from '@/config/managerCareer';
import { createAssignment } from '@/utils/scouting';
import { STARTING_TACTICAL_FAMILIARITY, FACILITY_COST_PER_LEVEL, FACILITY_BASE_UPGRADE_WEEKS, FACILITY_MAX_LEVEL, STAND_COST_PER_LEVEL, STAND_BASE_UPGRADE_WEEKS, MAX_SQUAD_SIZE } from '@/config/gameBalance';
import { MAX_TACTICAL_PRESETS } from '@/config/monetization';
import {
  STAFF_HIRING_FEE_WEEKS,
  STAFF_PRAISE_GAIN, STAFF_CRITICIZE_LOSS, STAFF_INTERACTION_COOLDOWN,
  STAFF_RENEWAL_FEE_WEEKS, STAFF_RENEWAL_WAGE_RAISE, STAFF_RENEWAL_COOLDOWN, STAFF_CONTRACT_YEARS,
  STAFF_MARKET_REFRESH_FEE, STAFF_MARKET_REFRESH_COOLDOWN,
} from '@/config/staff';
import { generateStaffMarket, ensureStaffFields, absWeek } from '@/utils/staff';
import { STAND_INFO } from '@/utils/facilities';
import { selectBestLineup } from '@/utils/playerGen';
import { placePlayerInClub } from '../helpers/rosterOps';
import { assignNumberOnJoin } from '@/utils/squadNumbers';

const SPOTLIGHT_DEV_BOOST = 22;
const SPOTLIGHT_DEFAULT_USES = 2;

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
  youthAcademy: { prospects: [], nextIntakePreview: [], youthPreviewEnhanced: false, spotlightUsesRemaining: SPOTLIGHT_DEFAULT_USES } as GameState['youthAcademy'],
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
      id: safeRandomUUID(),
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
    let updatedClub = { ...club, formation: preset.formation };
    // Formation change must rebuild the lineup for the new shape (mirrors
    // clubSlice.setFormation) — otherwise the same 11 ids map onto the new
    // formation's slots and play out of position.
    if (preset.formation !== club.formation) {
      const squad = club.playerIds.map(id => state.players[id]).filter(Boolean);
      const { lineup, subs } = selectBestLineup(squad, preset.formation, state.week);
      updatedClub = { ...updatedClub, lineup: lineup.map(p => p.id), subs: subs.map(p => p.id) };
    }
    set({
      tactics: { ...preset.tactics },
      clubs: { ...state.clubs, [state.playerClubId]: updatedClub },
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
      staff: { ...state.staff, members: newMembers, availableHires: newAvailable },
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

  praiseStaff: (staffId: string) => {
    const state = get();
    const idx = state.staff.members.findIndex(s => s.id === staffId);
    if (idx < 0) return { success: false, message: 'Staff member not found.' };
    const member = ensureStaffFields(state.staff.members[idx]);
    // Absolute-week math so cooldowns survive season rollover.
    const nowAbs = absWeek(state.season, state.week);
    const lastAbs = member.lastInteractionWeek ?? -99;
    const weeksSince = nowAbs - lastAbs;
    if (weeksSince < STAFF_INTERACTION_COOLDOWN) {
      const left = STAFF_INTERACTION_COOLDOWN - weeksSince;
      return { success: false, message: `Cooldown: ${left} week${left === 1 ? '' : 's'} until you can talk to them again.` };
    }
    const traits = member.traits || [];
    // Motivators get more from being praised; veterans appreciate recognition slightly less.
    const gain = STAFF_PRAISE_GAIN + (traits.includes('motivator') ? 4 : 0) + (traits.includes('veteran') ? -1 : 0);
    const updated: typeof member = {
      ...member,
      morale: Math.min(100, (member.morale ?? 70) + gain),
      lastInteractionWeek: nowAbs,
    };
    const newMembers = state.staff.members.slice();
    newMembers[idx] = updated;
    set({ staff: { ...state.staff, members: newMembers } });
    return { success: true, message: `${member.firstName} appreciates the recognition (+${gain} morale).` };
  },

  criticizeStaff: (staffId: string) => {
    const state = get();
    const idx = state.staff.members.findIndex(s => s.id === staffId);
    if (idx < 0) return { success: false, message: 'Staff member not found.' };
    const member = ensureStaffFields(state.staff.members[idx]);
    const nowAbs = absWeek(state.season, state.week);
    const lastAbs = member.lastInteractionWeek ?? -99;
    const weeksSince = nowAbs - lastAbs;
    if (weeksSince < STAFF_INTERACTION_COOLDOWN) {
      const left = STAFF_INTERACTION_COOLDOWN - weeksSince;
      return { success: false, message: `Cooldown: ${left} week${left === 1 ? '' : 's'} until you can talk to them again.` };
    }
    const loss = STAFF_CRITICIZE_LOSS + ((member.traits || []).includes('veteran') ? -1 : 0);
    const updated: typeof member = {
      ...member,
      morale: Math.max(0, (member.morale ?? 70) - loss),
      lastInteractionWeek: nowAbs,
    };
    const newMembers = state.staff.members.slice();
    newMembers[idx] = updated;
    set({ staff: { ...state.staff, members: newMembers } });
    return { success: true, message: `${member.firstName} took the criticism on board (-${loss} morale).` };
  },

  renewStaffContract: (staffId: string) => {
    const state = get();
    const idx = state.staff.members.findIndex(s => s.id === staffId);
    if (idx < 0) return { success: false, message: 'Staff member not found.' };
    const member = ensureStaffFields(state.staff.members[idx]);
    const nowAbs = absWeek(state.season, state.week);
    const lastRenew = member.lastRenewalWeek ?? -99;
    if (nowAbs - lastRenew < STAFF_RENEWAL_COOLDOWN) {
      return { success: false, message: 'They renewed recently — wait before negotiating again.' };
    }
    const club = state.clubs[state.playerClubId];
    if (!club) return { success: false, message: 'No active club.' };
    const fee = Math.round(member.wage * STAFF_RENEWAL_FEE_WEEKS);
    if (club.budget < fee) return { success: false, message: `Need £${Math.round(fee / 1000)}K to renew.` };
    const newWage = Math.round(member.wage * (1 + STAFF_RENEWAL_WAGE_RAISE));
    const updated: typeof member = {
      ...member,
      wage: newWage,
      contractYearsRemaining: Math.max(member.contractYearsRemaining ?? 0, 0) + STAFF_CONTRACT_YEARS,
      morale: Math.min(100, (member.morale ?? 70) + 6),
      lastRenewalWeek: nowAbs,
    };
    const newMembers = state.staff.members.slice();
    newMembers[idx] = updated;
    const newClub = { ...club, budget: club.budget - fee };
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'general',
      title: `${member.firstName} ${member.lastName} Renewed`,
      body: `Contract extended by ${STAFF_CONTRACT_YEARS} seasons. New wage £${Math.round(newWage / 1000)}K/w. Renewal fee: £${Math.round(fee / 1000)}K.`,
    });
    set({
      staff: { ...state.staff, members: newMembers },
      clubs: { ...state.clubs, [state.playerClubId]: newClub },
      messages: newMessages,
    });
    return { success: true, message: `Contract renewed for ${STAFF_CONTRACT_YEARS} more seasons.` };
  },

  refreshStaffMarket: () => {
    const state = get();
    const club = state.clubs[state.playerClubId];
    if (!club) return { success: false, message: 'No active club.' };
    const lastWeek = state.staff.lastMarketRefreshWeek ?? -99;
    const lastSeason = state.staff.lastMarketRefreshSeason ?? -99;
    const sameSeason = lastSeason === state.season;
    const weeksSince = sameSeason ? state.week - lastWeek : 99;
    if (sameSeason && weeksSince < STAFF_MARKET_REFRESH_COOLDOWN) {
      const left = STAFF_MARKET_REFRESH_COOLDOWN - weeksSince;
      return { success: false, message: `Network needs ${left} more week${left === 1 ? '' : 's'} to find new candidates.` };
    }
    if (club.budget < STAFF_MARKET_REFRESH_FEE) {
      return { success: false, message: `Need £${Math.round(STAFF_MARKET_REFRESH_FEE / 1000)}K to scout new candidates.` };
    }
    const newAvailable = generateStaffMarket();
    const newClub = { ...club, budget: club.budget - STAFF_MARKET_REFRESH_FEE };
    set({
      staff: {
        ...state.staff,
        availableHires: newAvailable,
        lastMarketRefreshWeek: state.week,
        lastMarketRefreshSeason: state.season,
      },
      clubs: { ...state.clubs, [state.playerClubId]: newClub },
    });
    return { success: true, message: 'Fresh staff candidates have been identified.' };
  },

  assignScout: (region: ScoutRegion) => {
    const state = get();
    if (state.scouting.assignments.length >= state.scouting.maxAssignments) {
      // Surfaced to the caller — silently no-oping here let the UI toast a
      // false "Scout Assigned" success at max assignments.
      return { success: false, message: 'All scouts are already on assignment.' };
    }
    const assignment = createAssignment(region);
    set({
      scouting: { ...state.scouting, assignments: [...state.scouting.assignments, assignment] },
    });
    return { success: true };
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
    if (!state.clubs[state.playerClubId]) return { success: false, message: 'Club not found.' };
    const club = { ...state.clubs[state.playerClubId] };
    if (club.playerIds.length >= MAX_SQUAD_SIZE) return { success: false, message: `Squad is full (${MAX_SQUAD_SIZE} players). Release or sell a player first.` };
    const updatedPlayer = { ...player, isFromYouthAcademy: true, joinedSeason: player.joinedSeason ?? state.season };
    assignNumberOnJoin(updatedPlayer, [...club.playerIds, playerId], state.players, state.clubRecords?.retiredNumbers);
    club.wageBill += updatedPlayer.wage;
    const promotedClubs = placePlayerInClub({ ...state.clubs, [club.id]: club }, club.id, playerId);
    const newProspects = state.youthAcademy.prospects.filter(p => p.playerId !== playerId);
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'development',
      title: `${player.lastName} Promoted`,
      body: `${player.firstName} ${player.lastName} (${player.position}, ${player.overall} OVR) has been promoted to the first team!`,
    });
    const youthMilestone = player.potential >= 70
      ? { id: safeRandomUUID(), type: 'youth_graduate' as const, title: 'Youth Graduate', description: `${player.firstName} ${player.lastName} (${player.position}, pot. ${player.potential}) promoted from the academy.`, season: state.season, week: state.week, icon: 'star' }
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

  setYouthFocus: (playerId: string, focus: YouthFocus) => {
    const state = get();
    const idx = state.youthAcademy.prospects.findIndex(p => p.playerId === playerId);
    if (idx < 0) return;
    const newProspects = state.youthAcademy.prospects.slice();
    newProspects[idx] = { ...newProspects[idx], trainingFocus: focus };
    set({ youthAcademy: { ...state.youthAcademy, prospects: newProspects } });
  },

  spotlightYouth: (playerId: string) => {
    const state = get();
    const remaining = state.youthAcademy.spotlightUsesRemaining ?? SPOTLIGHT_DEFAULT_USES;
    if (remaining <= 0) return { success: false, message: 'No spotlight sessions left this season.' };
    const idx = state.youthAcademy.prospects.findIndex(p => p.playerId === playerId);
    if (idx < 0) return { success: false, message: 'Prospect not found.' };
    const prospect = state.youthAcademy.prospects[idx];
    if (prospect.spotlightedThisSeason) return { success: false, message: 'Already spotlighted this season.' };
    const player = state.players[playerId];
    if (!player) return { success: false, message: 'Player not found.' };
    const newProspects = state.youthAcademy.prospects.slice();
    newProspects[idx] = {
      ...prospect,
      developmentScore: Math.min(100, prospect.developmentScore + SPOTLIGHT_DEV_BOOST),
      spotlightedThisSeason: true,
      readyToPromote: prospect.readyToPromote || (player.overall >= 55 || (prospect.developmentScore + SPOTLIGHT_DEV_BOOST) >= 80),
    };
    const newMessages = addMsg(state.messages, {
      week: state.week, season: state.season, type: 'development',
      title: `${player.firstName} ${player.lastName} Spotlight`,
      body: `${player.firstName} got an extended development session. Development +${SPOTLIGHT_DEV_BOOST}.`,
    });
    set({
      youthAcademy: {
        ...state.youthAcademy,
        prospects: newProspects,
        spotlightUsesRemaining: remaining - 1,
      },
      messages: newMessages,
    });
    return { success: true, message: `${player.firstName} ${player.lastName} got a development boost.` };
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
