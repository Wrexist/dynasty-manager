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
      return createMilestone('milestone_matches', `${t} Matches`, `Reached ${t} career matches as manager.`, season, week, '📊');
    }
  }
  return null;
}

/** Icon for milestone type */
export function getMilestoneIcon(type: CareerMilestone['type']): string {
  switch (type) {
    case 'first_win': return '🏆';
    case 'first_trophy': return '🥇';
    case 'promotion': return '⬆️';
    case 'cup_win': return '🏅';
    case 'record_signing': return '✍️';
    case 'biggest_win': return '⚽';
    case 'milestone_matches': return '📊';
    case 'unbeaten_run': return '🔥';
    case 'youth_graduate': return '🌟';
    case 'season_start': return '📅';
    default: return '📌';
  }
}
