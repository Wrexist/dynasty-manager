import { CareerMilestone } from '@/types/game';

/** Create a milestone entry */
export function createMilestone(
  type: CareerMilestone['type'],
  title: string,
  description: string,
  season: number,
  week: number,
  icon?: string,
): CareerMilestone {
  return { id: crypto.randomUUID(), type, title, description, season, week, icon };
}

/** Check for match-count milestones (50, 100, 200, 500) */
export function checkMatchMilestones(
  totalMatches: number,
  existing: CareerMilestone[],
  season: number,
  week: number,
): CareerMilestone | null {
  const thresholds = [50, 100, 200, 500];
  for (const t of thresholds) {
    if (totalMatches === t && !existing.some(m => m.type === 'milestone_matches' && m.description.includes(`${t}`))) {
      return createMilestone('milestone_matches', `${t} Matches`, `Reached ${t} career matches as manager.`, season, week, 'bar-chart');
    }
  }
  return null;
}

/** Icon for milestone type */
export function getMilestoneIcon(type: CareerMilestone['type']): string {
  switch (type) {
    case 'first_win': return 'trophy';
    case 'first_trophy': return 'medal';
    case 'promotion': return 'trending-up';
    case 'cup_win': return 'medal';
    case 'record_signing': return 'pen-line';
    case 'biggest_win': return 'circle';
    case 'milestone_matches': return 'bar-chart';
    case 'unbeaten_run': return 'flame';
    case 'youth_graduate': return 'star';
    case 'season_start': return 'calendar';
    default: return 'map-pin';
  }
}
