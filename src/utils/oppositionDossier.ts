/**
 * Opposition Dossier — scout-powered, pre-match intel builder.
 *
 * PURELY informational. `buildDossier` reads existing state (opponent squad,
 * fixtures, power rankings, scouting dept) and returns a read-only summary the
 * MatchPrep screen renders. It NEVER mutates state and NEVER influences any
 * simulation parameter — this is a monetization-invariant surface (Pro gates
 * how much of the dossier is *shown*, not what happens on the pitch).
 */

import type { Club, Match, Player, Position, FormationType, ScoutingState } from '@/types/game';
import { FORMATION_POSITIONS } from '@/types/game';
import {
  DOSSIER_MIN_BULLETS,
  DOSSIER_MAX_BULLETS,
  DOSSIER_FORM_LENGTH,
  DOSSIER_LINE_GAP,
  DOSSIER_INJURY_CONCERN,
} from '@/config/oppositionDossier';

export type FormResult = 'W' | 'D' | 'L';

const DEF_POS = new Set<string>(['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB']);
const MID_POS = new Set<string>(['CDM', 'CM', 'CAM', 'LM', 'RM']);
const ATT_POS = new Set<string>(['LW', 'RW', 'ST', 'CF']);

export type LineKey = 'defence' | 'midfield' | 'attack';

const LINE_LABEL: Record<LineKey, string> = {
  defence: 'defence',
  midfield: 'midfield',
  attack: 'attack',
};

export interface DossierDangerMan {
  id: string;
  name: string;
  position: Position;
  overall: number;
  goals: number;
  assists: number;
  appearances: number;
  /** True when picked on scoring output rather than raw rating. */
  isTopScorer: boolean;
}

export interface DossierLineupSlot {
  pos: Position;
  playerId: string;
  name: string;
  overall: number;
}

export interface OppositionDossier {
  /** Last-N results from the opponent's perspective, oldest → most recent. */
  form: FormResult[];
  dangerMan: DossierDangerMan | null;
  formation: FormationType | null;
  /** Best available XI by their strongest player per formation slot (Pro block). */
  likelyXI: DossierLineupSlot[];
  strengths: string[];
  weaknesses: string[];
  suggestedApproach: string;
  /** Bullets unlocked by scouting dept (1–3) — drives depth of strength/weakness lists. */
  scoutBulletCount: number;
  strongestLine: LineKey;
  weakestLine: LineKey;
}

interface BuildDossierArgs {
  opponent: Club;
  opponentPlayers: Player[];
  fixtures: Match[];
  clubPowerRankings: Record<string, number>;
  scouting: ScoutingState;
  /** The player's own club id, used to phrase the suggested approach. */
  myClubId?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const lineOf = (pos: string): LineKey | null => {
  if (DEF_POS.has(pos)) return 'defence';
  if (MID_POS.has(pos)) return 'midfield';
  if (ATT_POS.has(pos)) return 'attack';
  return null;
};

const avg = (arr: number[]): number =>
  arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

/** Recent results for a club, derived from the shared fixtures list. */
function deriveForm(clubId: string, fixtures: Match[], limit: number): FormResult[] {
  return fixtures
    .filter(m => m.played && (m.homeClubId === clubId || m.awayClubId === clubId))
    .sort((a, b) => a.week - b.week)
    .slice(-limit)
    .map(m => {
      const isHome = m.homeClubId === clubId;
      const gf = isHome ? m.homeGoals : m.awayGoals;
      const ga = isHome ? m.awayGoals : m.homeGoals;
      if (gf > ga) return 'W';
      if (gf < ga) return 'L';
      return 'D';
    });
}

/**
 * Danger man: the opponent's top available scorer (ties broken by rating);
 * if nobody has scored, the highest-rated available player.
 */
function pickDangerMan(players: Player[]): DossierDangerMan | null {
  const available = players.filter(Boolean).filter(p => !p.injured);
  const pool = available.length ? available : players.filter(Boolean);
  if (!pool.length) return null;

  const anyGoals = pool.some(p => (p.goals || 0) > 0);
  const sorted = [...pool].sort((a, b) => {
    if (anyGoals && (b.goals || 0) !== (a.goals || 0)) return (b.goals || 0) - (a.goals || 0);
    if (anyGoals && (b.assists || 0) !== (a.assists || 0)) return (b.assists || 0) - (a.assists || 0);
    return b.overall - a.overall;
  });
  const p = sorted[0];
  return {
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    position: p.position,
    overall: p.overall,
    goals: p.goals || 0,
    assists: p.assists || 0,
    appearances: p.appearances || 0,
    isTopScorer: anyGoals && (p.goals || 0) > 0,
  };
}

/** Greedy best-XI: fill each formation slot with the strongest unused player who fits. */
function buildLikelyXI(players: Player[], formation: FormationType | null): DossierLineupSlot[] {
  if (!formation) return [];
  const slots = FORMATION_POSITIONS[formation] || [];
  const available = players
    .filter(Boolean)
    .filter(p => !p.injured)
    .sort((a, b) => b.overall - a.overall);
  const usable = available.length ? available : players.filter(Boolean).sort((a, b) => b.overall - a.overall);
  const used = new Set<string>();
  const xi: DossierLineupSlot[] = [];

  const fits = (p: Player, pos: Position): boolean =>
    p.position === pos || (p.alternatePositions?.includes(pos) ?? false);

  for (const slot of slots) {
    const pos = slot.pos as Position;
    // First a natural/alternate fit, else the best remaining player of any kind.
    let pick = usable.find(p => !used.has(p.id) && fits(p, pos));
    if (!pick) pick = usable.find(p => !used.has(p.id));
    if (!pick) break;
    used.add(pick.id);
    xi.push({ pos, playerId: pick.id, name: `${pick.firstName} ${pick.lastName}`, overall: pick.overall });
  }
  return xi;
}

export function buildDossier(args: BuildDossierArgs): OppositionDossier {
  const { opponent, opponentPlayers, fixtures, clubPowerRankings, scouting, myClubId } = args;
  const players = (opponentPlayers || []).filter(Boolean);

  const form = deriveForm(opponent.id, fixtures || [], DOSSIER_FORM_LENGTH);
  const dangerMan = pickDangerMan(players);
  const formation = opponent.formation || null;

  // Line strength from the squad's own positions (works without a set lineup).
  const lines: Record<LineKey, number[]> = { defence: [], midfield: [], attack: [] };
  players.forEach(p => {
    const line = lineOf(p.position);
    if (line) lines[line].push(p.overall);
  });
  const lineAvg: Record<LineKey, number> = {
    defence: avg(lines.defence),
    midfield: avg(lines.midfield),
    attack: avg(lines.attack),
  };
  // Only rank lines that actually field players — an empty unit (no players at
  // those positions) isn't a "weakness", it just means a different shape.
  const populated = (Object.keys(lineAvg) as LineKey[]).filter(l => lines[l].length > 0);
  const ordered = (populated.length ? populated : (Object.keys(lineAvg) as LineKey[]))
    .sort((a, b) => lineAvg[b] - lineAvg[a]);
  const strongestLine = ordered[0];
  const weakestLine = ordered[ordered.length - 1];
  const injuries = players.filter(p => p.injured).length;

  // Scouting dept depth → how many bullets we surface (1–3).
  const scoutBulletCount = clamp(
    scouting?.maxAssignments ?? DOSSIER_MIN_BULLETS,
    DOSSIER_MIN_BULLETS,
    DOSSIER_MAX_BULLETS,
  );

  // Candidate bullets in priority order; sliced to what the scouts unlock.
  const strengthPool: string[] = [];
  if (lineAvg[strongestLine] > 0) {
    strengthPool.push(
      `Their ${LINE_LABEL[strongestLine]} is their strongest line (avg ${lineAvg[strongestLine]}).`,
    );
  }
  if (dangerMan) {
    strengthPool.push(
      dangerMan.isTopScorer
        ? `${dangerMan.name} leads their scoring with ${dangerMan.goals} goal${dangerMan.goals === 1 ? '' : 's'}.`
        : `${dangerMan.name} (${dangerMan.overall} OVR) is their standout talent.`,
    );
  }
  const topRated = [...players].sort((a, b) => b.overall - a.overall)[0];
  if (topRated && topRated.overall >= 80) {
    strengthPool.push(`Quality at the top end — ${topRated.overall} OVR ceiling in the squad.`);
  }

  const weaknessPool: string[] = [];
  if (lineAvg[weakestLine] > 0 && lineAvg[strongestLine] - lineAvg[weakestLine] >= DOSSIER_LINE_GAP) {
    weaknessPool.push(
      `Their ${LINE_LABEL[weakestLine]} is the weak spot (avg ${lineAvg[weakestLine]}).`,
    );
  }
  if (injuries >= DOSSIER_INJURY_CONCERN) {
    weaknessPool.push(`${injuries} players sidelined — their depth is stretched.`);
  }
  if (form.length >= 3) {
    const losses = form.filter(r => r === 'L').length;
    if (losses >= 2) weaknessPool.push('Poor recent form — confidence looks low.');
  }
  if (players.length > 0 && players.length < 16) {
    weaknessPool.push('Thin squad — little rotation available.');
  }

  const strengths = strengthPool.slice(0, scoutBulletCount);
  const weaknesses = weaknessPool.slice(0, scoutBulletCount);

  const likelyXI = buildLikelyXI(players, formation);

  // Suggested approach — a single sentence derived from the comparison.
  const myRank = myClubId ? clubPowerRankings?.[myClubId] : undefined;
  const oppRank = clubPowerRankings?.[opponent.id];
  const strongerOnPaper =
    typeof myRank === 'number' && typeof oppRank === 'number' ? myRank < oppRank : undefined;

  let suggestedApproach: string;
  if (weaknessPool.length && lineAvg[weakestLine] > 0 && lineAvg[strongestLine] - lineAvg[weakestLine] >= DOSSIER_LINE_GAP) {
    const target =
      weakestLine === 'defence'
        ? 'press high and target their back line'
        : weakestLine === 'midfield'
          ? 'overload the middle to control tempo'
          : 'sit compact and hit them on the break';
    suggestedApproach = `Exploit their ${LINE_LABEL[weakestLine]} — ${target}.`;
  } else if (strongerOnPaper === true) {
    suggestedApproach = 'You have the edge on paper — take the initiative and dictate play.';
  } else if (strongerOnPaper === false) {
    suggestedApproach = 'They are favourites — stay disciplined and pick your moments on the counter.';
  } else {
    suggestedApproach = 'An even contest — match their shape and stay compact.';
  }

  return {
    form,
    dangerMan,
    formation,
    likelyXI,
    strengths,
    weaknesses,
    suggestedApproach,
    scoutBulletCount,
    strongestLine,
    weakestLine,
  };
}
