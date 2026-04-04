import type { Player, FormationType, FormationSlot, ChemistryLink, Position } from '@/types/game';
import { POSITION_COMPATIBILITY } from '@/types/game';

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

export function getSquadInsights(
  lineupPlayers: Player[],
  formation: FormationType,
  slots: FormationSlot[],
  chemLinks: ChemistryLink[],
): SquadInsight[] {
  const insights: SquadInsight[] = [];
  if (lineupPlayers.length === 0) return insights;

  // Low fitness warning
  const lowFitnessPlayers = lineupPlayers.filter(p => p.fitness < 70);
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
  const critFitness = lineupPlayers.filter(p => p.fitness < 50);
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
    if (p.position === slot.pos) return count;
    const compat = POSITION_COMPATIBILITY[slot.pos as Position] || [];
    if (compat.includes(p.position as Position)) return count;
    return count + 1;
  }, 0);
  if (mismatched > 0) {
    insights.push({
      type: 'warning',
      icon: 'alert-triangle',
      message: `${mismatched} player${mismatched > 1 ? 's' : ''} in wrong position`,
    });
  }

  // Chemistry side comparison
  const leftLinkCount = chemLinks.filter(l => {
    const ps = lineupPlayers;
    const a = ps.find(p => p.id === l.playerIdA);
    const b = ps.find(p => p.id === l.playerIdB);
    return (a && LEFT_POSITIONS.has(a.position)) || (b && LEFT_POSITIONS.has(b.position));
  }).length;
  const rightLinkCount = chemLinks.filter(l => {
    const ps = lineupPlayers;
    const a = ps.find(p => p.id === l.playerIdA);
    const b = ps.find(p => p.id === l.playerIdB);
    return (a && RIGHT_POSITIONS.has(a.position)) || (b && RIGHT_POSITIONS.has(b.position));
  }).length;
  if (leftLinkCount > 0 && rightLinkCount === 0) {
    insights.push({ type: 'warning', icon: 'AlertTriangle', message: 'Right side has weak chemistry' });
  } else if (rightLinkCount > 0 && leftLinkCount === 0) {
    insights.push({ type: 'warning', icon: 'AlertTriangle', message: 'Left side has weak chemistry' });
  }

  // Strongest unit
  const defPlayers = lineupPlayers.filter((_, i) => slots[i] && DEF_POSITIONS.has(slots[i].pos));
  const midPlayers = lineupPlayers.filter((_, i) => slots[i] && MID_POSITIONS.has(slots[i].pos));
  const attPlayers = lineupPlayers.filter((_, i) => slots[i] && ATT_POSITIONS.has(slots[i].pos));

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

  // Positive: good chemistry
  if (chemLinks.length >= 6) {
    insights.push({
      type: 'positive',
      icon: 'check-circle',
      message: 'Strong team chemistry across the squad',
    });
  }

  return insights.slice(0, 3); // Max 3 insights to keep it clean
}
