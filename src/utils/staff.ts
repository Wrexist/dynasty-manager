import { StaffMember, StaffRole } from '@/types/game';
import { pick } from './helpers';
import {
  STAFF_WAGE_PER_QUALITY, STAFF_WAGE_RANDOM_RANGE, STAFF_QUALITY_MIN, STAFF_QUALITY_MAX,
  INITIAL_BASE_QUALITY_BONUS, INITIAL_BASE_QUALITY_CAP,
  ASSISTANT_MANAGER_VARIANCE, FITNESS_COACH_OFFSET, FITNESS_COACH_VARIANCE,
  SCOUT_MIN_REPUTATION, SCOUT_OFFSET, SCOUT_VARIANCE,
  YOUTH_COACH_MIN_REPUTATION, YOUTH_COACH_OFFSET, YOUTH_COACH_VARIANCE,
  MARKET_QUALITY_BASE, MARKET_QUALITY_RANGE,
} from '@/config/staff';

const FIRST_NAMES = ['James', 'Carlos', 'Marco', 'Stefan', 'Pierre', 'Antonio', 'Rui', 'Hans', 'Igor', 'Luis', 'Erik', 'Sergio', 'Fabio', 'Nuno', 'Andre'];
const LAST_NAMES = ['Silva', 'Martinez', 'Weber', 'Rossi', 'Dupont', 'Andersen', 'Kowalski', 'Fernandez', 'Santos', 'Nielsen', 'Bianchi', 'Mueller', 'Costa', 'Pereira', 'Garcia'];

export function generateStaffMember(role: StaffRole, quality: number): StaffMember {
  return {
    id: crypto.randomUUID(),
    firstName: pick(FIRST_NAMES),
    lastName: pick(LAST_NAMES),
    role,
    quality: Math.max(STAFF_QUALITY_MIN, Math.min(STAFF_QUALITY_MAX, quality)),
    wage: Math.round(quality * STAFF_WAGE_PER_QUALITY + Math.random() * STAFF_WAGE_RANDOM_RANGE),
  };
}

export function generateInitialStaff(reputation: number): StaffMember[] {
  const baseQuality = Math.min(INITIAL_BASE_QUALITY_CAP, reputation + INITIAL_BASE_QUALITY_BONUS);
  const staff: StaffMember[] = [
    generateStaffMember('assistant-manager', baseQuality + Math.floor(Math.random() * ASSISTANT_MANAGER_VARIANCE)),
    generateStaffMember('fitness-coach', baseQuality + FITNESS_COACH_OFFSET + Math.floor(Math.random() * FITNESS_COACH_VARIANCE)),
  ];
  if (reputation >= SCOUT_MIN_REPUTATION) {
    staff.push(generateStaffMember('scout', baseQuality + SCOUT_OFFSET + Math.floor(Math.random() * SCOUT_VARIANCE)));
  }
  if (reputation >= YOUTH_COACH_MIN_REPUTATION) {
    staff.push(generateStaffMember('youth-coach', baseQuality + YOUTH_COACH_OFFSET + Math.floor(Math.random() * YOUTH_COACH_VARIANCE)));
  }
  return staff;
}

export function generateStaffMarket(): StaffMember[] {
  const roles: StaffRole[] = ['first-team-coach', 'fitness-coach', 'goalkeeping-coach', 'scout', 'youth-coach', 'physio'];
  return roles.map(role => generateStaffMember(role, MARKET_QUALITY_BASE + Math.floor(Math.random() * MARKET_QUALITY_RANGE)));
}

export function getStaffBonus(staff: StaffMember[], role: StaffRole): number {
  const member = staff.filter(s => s.role === role).sort((a, b) => b.quality - a.quality)[0];
  return member ? member.quality : 0;
}

/** Combined training staff bonus used by the engine: first-team-coach + fitness-coach * 0.5 */
export function getTrainingStaffBonus(staff: StaffMember[]): number {
  return getStaffBonus(staff, 'first-team-coach') + getStaffBonus(staff, 'fitness-coach') * 0.5;
}
