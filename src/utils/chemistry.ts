import type { Player, ChemistryLink } from '@/types/game';
import {
  MENTOR_SENIOR_AGE, MENTOR_JUNIOR_AGE, MENTOR_QUALITY_OVERALL_BASE, MENTOR_QUALITY_DIVISOR, MENTOR_MAX_STRENGTH,
  PARTNERSHIP_FORM_THRESHOLD, PARTNERSHIP_STRENGTH_DIVISOR, PARTNERSHIP_MAX_STRENGTH,
  ADJACENT_PAIRS,
  CHEMISTRY_BONUS_PER_STRENGTH, CHEMISTRY_BONUS_MAX,
  CHEMISTRY_EXCELLENT_THRESHOLD, CHEMISTRY_GOOD_THRESHOLD, CHEMISTRY_AVERAGE_THRESHOLD,
  MENTOR_GROWTH_BONUS_PER_STRENGTH, MENTOR_GROWTH_MAX_AGE,
} from '@/config/chemistry';

/**
 * Calculate chemistry links between players in a lineup.
 * Chemistry affects match performance through a team-wide bonus.
 *
 * Link types:
 * - nationality: Players sharing nationality build stronger understanding
 * - mentor: Experienced player (28+) paired with young talent (<22) at same position group
 * - partnership: Two players who play adjacent positions and have high combined form
 */
export function calculateChemistryLinks(players: Player[]): ChemistryLink[] {
  const links: ChemistryLink[] = [];

  const areAdjacent = (posA: string, posB: string): boolean =>
    ADJACENT_PAIRS.some(([p1, p2]) =>
      (posA === p1 && posB === p2) || (posA === p2 && posB === p1)
    );

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];

      if (!areAdjacent(a.position, b.position)) continue;

      // Nationality bond
      if (a.nationality === b.nationality) {
        const strength = a.clubId === b.clubId ? 2 : 1;
        links.push({ playerIdA: a.id, playerIdB: b.id, type: 'nationality', strength });
      }

      // Mentor bond: experienced player mentoring a young one at adjacent position
      const senior = a.age >= MENTOR_SENIOR_AGE && b.age < MENTOR_JUNIOR_AGE ? a : b.age >= MENTOR_SENIOR_AGE && a.age < MENTOR_JUNIOR_AGE ? b : null;
      const junior = senior === a ? b : a;
      if (senior && junior) {
        const mentorQuality = Math.min(MENTOR_MAX_STRENGTH, Math.floor((senior.overall - MENTOR_QUALITY_OVERALL_BASE) / MENTOR_QUALITY_DIVISOR) + 1);
        links.push({ playerIdA: senior.id, playerIdB: junior.id, type: 'mentor', strength: Math.max(1, mentorQuality) });
      }

      // Partnership bond: adjacent position players with high combined form
      if ((a.form + b.form) > PARTNERSHIP_FORM_THRESHOLD) {
        links.push({ playerIdA: a.id, playerIdB: b.id, type: 'partnership', strength: Math.min(PARTNERSHIP_MAX_STRENGTH, Math.floor((a.form + b.form - PARTNERSHIP_FORM_THRESHOLD) / PARTNERSHIP_STRENGTH_DIVISOR) + 1) });
      }
    }
  }

  return links;
}

/**
 * Calculate a team-wide chemistry bonus for match simulation.
 * Returns a modifier between 0.00 and 0.08 (0-8% bonus).
 */
export function getChemistryBonus(lineupPlayers: Player[]): number {
  const links = calculateChemistryLinks(lineupPlayers);
  if (links.length === 0) return 0;

  // Sum all link strengths, cap at reasonable max
  const totalStrength = links.reduce((sum, l) => sum + l.strength, 0);

  // Diminishing returns: first few links matter most
  // 1 link = ~1%, 5 links = ~4%, 10+ links = ~6-8%
  const bonus = Math.min(CHEMISTRY_BONUS_MAX, totalStrength * CHEMISTRY_BONUS_PER_STRENGTH);
  return bonus;
}

/**
 * Get chemistry description for UI display.
 */
export function getChemistryLabel(bonus: number): { label: string; color: string } {
  if (bonus >= CHEMISTRY_EXCELLENT_THRESHOLD) return { label: 'Excellent', color: 'text-emerald-400' };
  if (bonus >= CHEMISTRY_GOOD_THRESHOLD) return { label: 'Good', color: 'text-primary' };
  if (bonus >= CHEMISTRY_AVERAGE_THRESHOLD) return { label: 'Average', color: 'text-amber-400' };
  return { label: 'Low', color: 'text-muted-foreground' };
}

/**
 * Get the effect of a mentor link on youth development.
 * Returns an extra growth chance modifier (0.00-0.03).
 */
export function getMentorBonus(player: Player, allPlayers: Player[]): number {
  if (player.age >= MENTOR_GROWTH_MAX_AGE) return 0;

  const teammates = allPlayers.filter(p => p.clubId === player.clubId && p.id !== player.id);
  const mentorLinks = calculateChemistryLinks([player, ...teammates])
    .filter(l => l.type === 'mentor' && (l.playerIdA === player.id || l.playerIdB === player.id));

  if (mentorLinks.length === 0) return 0;

  // Best mentor provides the bonus
  const bestMentor = mentorLinks.reduce((best, l) => l.strength > best.strength ? l : best, mentorLinks[0]);
  return bestMentor.strength * MENTOR_GROWTH_BONUS_PER_STRENGTH; // 1-3% extra growth chance
}
