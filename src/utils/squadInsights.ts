import type { Player, FormationType, FormationSlot, ChemistryLink, Position } from '@/types/game';
import { canPlayPosition } from '@/types/game';
import { CHEMISTRY_GOOD_THRESHOLD } from '@/config/chemistry';

export interface SquadInsight {
  type: 'warning' | 'positive' | 'info';
  icon: string;
  message: string;
}

const LEFT_POSITIONS = new Set<string>(['LB', 'LM', 'LW']);
const RIGHT_POSITIONS = new Set<string>(['RB', 'RM', 'RW']);
const DEF_POSITIONS = new Set<string>(['GK', 'CB', 'LB', 'RB']);
const MID_POSITIONS = new Set<string>(['CDM', 'CM', 'CAM', 'LM', 'RM']);
const ATT_POSITIONS = new Set<string>(['LW', 'RW', 'ST']);

function avgOverall(players: Player[]): number {
  if (players.length === 0) return 0;
  return Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length);
}

/**
 * `lineupPlayers` is index-aligned with `slots` and may contain null holes
 * (e.g. a lineup ID resolving to a deleted player). Holes are skipped, never
 * compacted — compacting would shift later players onto the wrong slot and
 * mis-attribute wrong-position warnings and unit averages. Callers must map
 * ids → players WITHOUT filter(Boolean).
 */
export function getSquadInsights(
  lineupPlayers: (Player | null)[],
  _formation: FormationType,
  slots: FormationSlot[],
  chemLinks: ChemistryLink[],
  chemBonus?: number,
): SquadInsight[] {
  const insights: SquadInsight[] = [];
  const presentPlayers = lineupPlayers.filter((p): p is Player => Boolean(p));
  if (presentPlayers.length === 0) return insights;

  // Low fitness warning (exclude critical — those get their own warning)
  const lowFitnessPlayers = presentPlayers.filter(p => p.fitness < 70 && p.fitness >= 50);
  if (lowFitnessPlayers.length >= 2) {
    insights.push({
      type: 'warning',
      icon: 'heart-pulse',
      message: `Low fitness on ${lowFitnessPlayers.length} players`,
    });
  } else if (lowFitnessPlayers.length === 1) {
    insights.push({
      type: 'warning',
      icon: 'heart-pulse',
      message: `${lowFitnessPlayers[0].lastName} has low fitness (${lowFitnessPlayers[0].fitness}%)`,
    });
  }

  // Critical fitness (< 50)
  const critFitness = presentPlayers.filter(p => p.fitness < 50);
  if (critFitness.length > 0) {
    insights.push({
      type: 'warning',
      icon: 'alert-triangle',
      message: `${critFitness.length} player${critFitness.length > 1 ? 's' : ''} at injury risk (<50% fitness)`,
    });
  }

  // Position mismatch
  const mismatched = slots.reduce((count, slot, i) => {
    const p = lineupPlayers[i];
    if (!p) return count;
    if (canPlayPosition(p, slot.pos as Position)) return count;
    return count + 1;
  }, 0);
  if (mismatched > 0) {
    insights.push({
      type: 'warning',
      icon: 'alert-triangle',
      message: `${mismatched} player${mismatched > 1 ? 's' : ''} in wrong position`,
    });
  }

  // Chemistry side comparison — use slot positions (what players are deployed as)
  const playerSlotPos = new Map<string, string>();
  lineupPlayers.forEach((p, i) => { if (p && slots[i]) playerSlotPos.set(p.id, slots[i].pos); });

  const leftLinkCount = chemLinks.filter(l => {
    const posA = playerSlotPos.get(l.playerIdA);
    const posB = playerSlotPos.get(l.playerIdB);
    return (posA && LEFT_POSITIONS.has(posA)) || (posB && LEFT_POSITIONS.has(posB));
  }).length;
  const rightLinkCount = chemLinks.filter(l => {
    const posA = playerSlotPos.get(l.playerIdA);
    const posB = playerSlotPos.get(l.playerIdB);
    return (posA && RIGHT_POSITIONS.has(posA)) || (posB && RIGHT_POSITIONS.has(posB));
  }).length;
  if (leftLinkCount > 0 && rightLinkCount === 0) {
    insights.push({ type: 'warning', icon: 'alert-triangle', message: 'Right side has weak chemistry' });
  } else if (rightLinkCount > 0 && leftLinkCount === 0) {
    insights.push({ type: 'warning', icon: 'alert-triangle', message: 'Left side has weak chemistry' });
  } else if (leftLinkCount === 0 && rightLinkCount === 0) {
    const hasFlank = lineupPlayers.some((p, i) =>
      p && slots[i] && (LEFT_POSITIONS.has(slots[i].pos) || RIGHT_POSITIONS.has(slots[i].pos))
    );
    if (hasFlank) {
      insights.push({ type: 'warning', icon: 'alert-triangle', message: 'Flanks have no chemistry links' });
    }
  }

  // Strongest unit
  const defPlayers = lineupPlayers.filter((p, i): p is Player => Boolean(p) && Boolean(slots[i]) && DEF_POSITIONS.has(slots[i].pos));
  const midPlayers = lineupPlayers.filter((p, i): p is Player => Boolean(p) && Boolean(slots[i]) && MID_POSITIONS.has(slots[i].pos));
  const attPlayers = lineupPlayers.filter((p, i): p is Player => Boolean(p) && Boolean(slots[i]) && ATT_POSITIONS.has(slots[i].pos));

  const units = [
    { name: 'Defence', avg: avgOverall(defPlayers) },
    { name: 'Midfield', avg: avgOverall(midPlayers) },
    { name: 'Attack', avg: avgOverall(attPlayers) },
  ].filter(u => u.avg > 0);

  if (units.length > 1) {
    const strongest = units.reduce((best, u) => u.avg > best.avg ? u : best, units[0]);
    const weakest = units.reduce((worst, u) => u.avg < worst.avg ? u : worst, units[0]);
    if (strongest.avg - weakest.avg >= 5) {
      insights.push({
        type: 'info',
        icon: 'flame',
        message: `${strongest.name} is strongest unit (${strongest.avg} avg)`,
      });
    }
  }

  // Positive: good chemistry (use actual bonus value, not just link count)
  if (chemBonus !== undefined ? chemBonus >= CHEMISTRY_GOOD_THRESHOLD : chemLinks.length >= 6) {
    insights.push({
      type: 'positive',
      icon: 'check-circle',
      message: 'Strong team chemistry across the squad',
    });
  }

  return insights.slice(0, 3); // Max 3 insights to keep it clean
}
