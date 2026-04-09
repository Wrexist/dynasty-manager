import type { Club, Player, FormationType } from '@/types/game';

export interface OpponentScoutReport {
  clubId: string;
  clubName: string;
  formation: FormationType;
  style: string;
  strengths: string[];
  weaknesses: string[];
  keyPlayer: { name: string; position: string; overall: number } | null;
  dangerRating: number; // 1-5
  tacticalAdvice: string; // suggested counter-tactic
}

/** Determine the playing style description based on tactics and formation */
function getPlayingStyle(club: Club): string {
  const formation = club.formation;
  const tactics = club.aiManagerProfile?.defaultTactics;
  if (!tactics) {
    if (formation === '3-4-3' || formation === '4-3-3') return 'Attacking';
    if (formation === '5-3-2' || formation === '4-1-4-1') return 'Defensive';
    return 'Balanced';
  }
  if (tactics.mentality === 'all-out-attack' || tactics.mentality === 'attacking') return 'Attacking';
  if (tactics.mentality === 'defensive' || tactics.mentality === 'cautious') return 'Defensive';
  if (tactics.tempo === 'fast' && tactics.pressingIntensity >= 70) return 'High Pressing';
  if (tactics.width === 'wide') return 'Wide Play';
  if (tactics.defensiveLine === 'deep') return 'Counter-Attacking';
  return 'Balanced';
}

/** Generate a scouting report for the next opponent */
export function generateScoutReport(
  opponentClub: Club,
  opponentPlayers: Player[],
  playerReputation: number,
): OpponentScoutReport {
  const squad = opponentPlayers.filter(p => p.clubId === opponentClub.id && !p.injured && !p.onLoan);
  const avgOverall = squad.length > 0 ? squad.reduce((s, p) => s + p.overall, 0) / squad.length : 50;

  // Identify key player (highest overall)
  const sorted = [...squad].sort((a, b) => b.overall - a.overall);
  const keyPlayer = sorted[0] ? { name: `${sorted[0].firstName} ${sorted[0].lastName}`, position: sorted[0].position, overall: sorted[0].overall } : null;

  // Strengths & weaknesses based on squad composition
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const avgAttr = (attr: keyof Player['attributes']) =>
    squad.length > 0 ? squad.reduce((s, p) => s + p.attributes[attr], 0) / squad.length : 50;

  if (avgAttr('shooting') >= 68) strengths.push('Clinical finishing');
  if (avgAttr('passing') >= 68) strengths.push('Good ball retention');
  if (avgAttr('defending') >= 68) strengths.push('Solid defensive unit');
  if (avgAttr('physical') >= 68) strengths.push('Physically dominant');
  if (avgAttr('pace') >= 68) strengths.push('Dangerous on the break');

  if (avgAttr('shooting') < 55) weaknesses.push('Lack cutting edge');
  if (avgAttr('defending') < 55) weaknesses.push('Vulnerable at the back');
  if (avgAttr('pace') < 55) weaknesses.push('Slow in transition');
  if (avgAttr('mental') < 55) weaknesses.push('Poor under pressure');

  const gks = squad.filter(p => p.position === 'GK');
  if (gks.length > 0 && gks[0].overall < 60) weaknesses.push('Keeper prone to errors');
  if (gks.length > 0 && gks[0].overall >= 75) strengths.push('Excellent goalkeeper');

  const youngTalent = squad.filter(p => p.age <= 22 && p.potential >= 75);
  if (youngTalent.length >= 3) strengths.push('Strong youth contingent');

  // Danger rating 1-5 based on reputation and quality
  const repDiff = opponentClub.reputation - playerReputation;
  const dangerRating = Math.max(1, Math.min(5, Math.round(3 + repDiff + (avgOverall - 65) / 10)));

  // Generate tactical counter-advice based on opponent style
  const style = getPlayingStyle(opponentClub);
  const tactics = opponentClub.aiManagerProfile?.defaultTactics;
  let tacticalAdvice = 'Play your natural game and impose your style.';
  if (style === 'High Pressing') tacticalAdvice = 'Use slow tempo to draw their press, then exploit space behind with quick passes.';
  else if (style === 'Counter-Attacking' || style === 'Defensive') tacticalAdvice = 'Dominate possession with wide play to stretch their deep block. Be patient.';
  else if (style === 'Attacking') tacticalAdvice = 'Sit deeper and hit them on the counter. Their high line is vulnerable to pace.';
  else if (style === 'Wide Play') tacticalAdvice = 'Use narrow width to congest the middle and deny crossing angles.';
  else if (tactics?.defensiveLine === 'high') tacticalAdvice = 'Their high line is exposed to through balls. Use fast tempo and direct passing.';

  return {
    clubId: opponentClub.id,
    clubName: opponentClub.name,
    formation: opponentClub.formation,
    style,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    keyPlayer,
    dangerRating,
    tacticalAdvice,
  };
}
