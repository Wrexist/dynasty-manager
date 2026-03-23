/**
 * Promotion/Relegation system for Dynasty Manager.
 * Handles end-of-season division movement, playoff bracket generation,
 * and replacement clubs for div-4 bottom slots.
 */

import { DivisionId, DivisionInfo, LeagueTableEntry, PlayoffState, PlayoffTie, PromotionRelegation, Club } from '@/types/game';
import { DIVISIONS } from '@/data/league';
import type { ClubData } from '@/types/game';

// ── Determine zone positions from final table ──

export interface DivisionZones {
  autoPromoted: string[];    // club IDs auto-promoted
  playoffContenders: string[]; // club IDs entering playoffs
  midTable: string[];        // safe, no movement
  autoRelegated: string[];   // club IDs auto-relegated
  replaced: string[];        // club IDs replaced (div-4 bottom)
}

export function determineZones(table: LeagueTableEntry[], division: DivisionInfo): DivisionZones {
  const ids = table.map(e => e.clubId);
  const n = ids.length;
  const { autoPromoteSlots, playoffSlots, autoRelegateSlots, replacedSlots } = division;

  const autoPromoted = ids.slice(0, autoPromoteSlots);
  const playoffContenders = ids.slice(autoPromoteSlots, autoPromoteSlots + playoffSlots);
  const safeEnd = n - autoRelegateSlots - replacedSlots;
  const midTable = ids.slice(autoPromoteSlots + playoffSlots, safeEnd);
  const autoRelegated = ids.slice(safeEnd, safeEnd + autoRelegateSlots);
  const replaced = ids.slice(n - replacedSlots);

  return { autoPromoted, playoffContenders, midTable, autoRelegated, replaced };
}

// ── Playoff bracket generation ──

/**
 * Generate a playoff bracket for a division.
 * Format: 3rd vs 6th, 4th vs 5th (two-legged semis), winners play single-leg final.
 * For div-4: 4th vs 7th, 5th vs 6th.
 */
export function generatePlayoffBracket(contenderIds: string[], divisionId: DivisionId): PlayoffState {
  if (contenderIds.length < 4) {
    return { divisionId, bracket: [], currentRound: null, promotedClubId: null };
  }

  // Standard: 1st seed (3rd place) vs 4th seed (6th place), 2nd vs 3rd
  const semi1: PlayoffTie = {
    id: crypto.randomUUID(),
    round: 'semi-leg1',
    homeClubId: contenderIds[0], // higher seed gets home first
    awayClubId: contenderIds[3],
    played: false, homeGoals: 0, awayGoals: 0,
  };
  const semi2: PlayoffTie = {
    id: crypto.randomUUID(),
    round: 'semi-leg1',
    homeClubId: contenderIds[1],
    awayClubId: contenderIds[2],
    played: false, homeGoals: 0, awayGoals: 0,
  };
  // Second legs (reversed home/away)
  const semi1leg2: PlayoffTie = {
    id: crypto.randomUUID(),
    round: 'semi-leg2',
    homeClubId: contenderIds[3],
    awayClubId: contenderIds[0],
    played: false, homeGoals: 0, awayGoals: 0,
  };
  const semi2leg2: PlayoffTie = {
    id: crypto.randomUUID(),
    round: 'semi-leg2',
    homeClubId: contenderIds[2],
    awayClubId: contenderIds[1],
    played: false, homeGoals: 0, awayGoals: 0,
  };
  // Final placeholder — clubs TBD until semis complete
  const final: PlayoffTie = {
    id: crypto.randomUUID(),
    round: 'final',
    homeClubId: '', // filled after semis
    awayClubId: '',
    played: false, homeGoals: 0, awayGoals: 0,
  };

  return {
    divisionId,
    bracket: [semi1, semi2, semi1leg2, semi2leg2, final],
    currentRound: 'semi-leg1',
    promotedClubId: null,
  };
}

/**
 * Get the aggregate winner of a two-legged semi-final.
 * Returns the winning club ID, or null if not yet decided.
 */
export function getSemiWinner(bracket: PlayoffTie[], leg1Id: string): string | null {
  const leg1 = bracket.find(t => t.id === leg1Id);
  if (!leg1 || !leg1.played) return null;

  // Find matching leg2 (same clubs, reversed)
  const leg2 = bracket.find(t =>
    t.round === 'semi-leg2' &&
    t.homeClubId === leg1.awayClubId &&
    t.awayClubId === leg1.homeClubId
  );
  if (!leg2 || !leg2.played) return null;

  const club1 = leg1.homeClubId;
  const club2 = leg1.awayClubId;
  const club1Goals = leg1.homeGoals + (leg2.awayGoals || 0);
  const club2Goals = leg1.awayGoals + (leg2.homeGoals || 0);

  if (club1Goals > club2Goals) return club1;
  if (club2Goals > club1Goals) return club2;
  // Tie: away goals rule — club with more away goals wins
  const club1Away = leg2.awayGoals || 0; // club1 scored as away in leg2
  const club2Away = leg1.awayGoals || 0; // club2 scored as away in leg1
  if (club1Away > club2Away) return club1;
  if (club2Away > club1Away) return club2;
  // Still tied: random (simulates extra time / penalties)
  return Math.random() < 0.5 ? club1 : club2;
}

/**
 * After both semi-final legs are played, populate the final with the two winners.
 */
export function populatePlayoffFinal(playoff: PlayoffState): PlayoffState {
  const semiLeg1s = playoff.bracket.filter(t => t.round === 'semi-leg1');
  if (semiLeg1s.length !== 2) return playoff;

  const winner1 = getSemiWinner(playoff.bracket, semiLeg1s[0].id);
  const winner2 = getSemiWinner(playoff.bracket, semiLeg1s[1].id);
  if (!winner1 || !winner2) return playoff;

  const newBracket = playoff.bracket.map(t => {
    if (t.round === 'final') {
      return { ...t, homeClubId: winner1, awayClubId: winner2 };
    }
    return t;
  });

  return { ...playoff, bracket: newBracket, currentRound: 'final' };
}

/**
 * After the final is played, determine the promoted club.
 */
export function resolvePlayoffFinal(playoff: PlayoffState): PlayoffState {
  const final = playoff.bracket.find(t => t.round === 'final');
  if (!final || !final.played) return playoff;

  let winnerId: string;
  if (final.homeGoals > final.awayGoals) {
    winnerId = final.homeClubId;
  } else if (final.awayGoals > final.homeGoals) {
    winnerId = final.awayClubId;
  } else {
    // Draw in final: random (extra time / penalties)
    winnerId = Math.random() < 0.5 ? final.homeClubId : final.awayClubId;
  }

  return { ...playoff, promotedClubId: winnerId, currentRound: null };
}

// ── Apply all promotions and relegations ──

/**
 * Build the full PromotionRelegation record from final tables and playoff results.
 * Also swaps club divisionIds and returns the updated clubs.
 */
export function applyPromotionRelegation(
  divisionClubs: Record<DivisionId, string[]>,
  divisionTables: Record<DivisionId, LeagueTableEntry[]>,
  playoffs: PlayoffState[],
  clubs: Record<string, Club>,
): { promRel: PromotionRelegation; updatedClubs: Record<string, Club>; updatedDivisionClubs: Record<DivisionId, string[]> } {
  const promRel: PromotionRelegation = {
    promoted: [],
    relegated: [],
    playoffWinners: [],
    replacedClubs: [],
    newClubs: [],
  };

  const newClubs = { ...clubs };
  const divOrder: DivisionId[] = ['div-1', 'div-2', 'div-3', 'div-4'];

  for (let i = 0; i < divOrder.length; i++) {
    const divId = divOrder[i];
    const div = DIVISIONS.find(d => d.id === divId)!;
    const table = divisionTables[divId] || [];
    const zones = determineZones(table, div);

    // Auto-promotions (to the division above)
    if (i > 0) {
      const higherDiv = divOrder[i - 1];
      for (const cid of zones.autoPromoted) {
        promRel.promoted.push({ clubId: cid, fromDivision: divId, toDivision: higherDiv });
        if (newClubs[cid]) newClubs[cid] = { ...newClubs[cid], divisionId: higherDiv };
      }
    }

    // Playoff winner promotion
    const playoff = playoffs.find(p => p.divisionId === divId);
    if (playoff?.promotedClubId && i > 0) {
      const higherDiv = divOrder[i - 1];
      promRel.playoffWinners.push({ clubId: playoff.promotedClubId, fromDivision: divId, toDivision: higherDiv });
      if (newClubs[playoff.promotedClubId]) {
        newClubs[playoff.promotedClubId] = { ...newClubs[playoff.promotedClubId], divisionId: higherDiv };
      }
    }

    // Auto-relegations (to the division below)
    if (i < divOrder.length - 1) {
      const lowerDiv = divOrder[i + 1];
      for (const cid of zones.autoRelegated) {
        promRel.relegated.push({ clubId: cid, fromDivision: divId, toDivision: lowerDiv });
        if (newClubs[cid]) newClubs[cid] = { ...newClubs[cid], divisionId: lowerDiv };
      }
    }

    // Replaced clubs (div-4 bottom 2)
    for (const cid of zones.replaced) {
      promRel.replacedClubs.push(cid);
    }
  }

  // Rebuild divisionClubs by applying movements to the input divisionClubs arrays.
  // This avoids relying on club.divisionId which may be stale for clubs not in any division.
  const updatedDivisionClubs: Record<DivisionId, string[]> = {
    'div-1': [...divisionClubs['div-1']],
    'div-2': [...divisionClubs['div-2']],
    'div-3': [...divisionClubs['div-3']],
    'div-4': [...divisionClubs['div-4']],
  };

  // Remove replaced clubs from div-4
  for (const cid of promRel.replacedClubs) {
    updatedDivisionClubs['div-4'] = updatedDivisionClubs['div-4'].filter(id => id !== cid);
  }

  // Apply promotions: remove from source division, add to target
  for (const p of promRel.promoted) {
    updatedDivisionClubs[p.fromDivision] = updatedDivisionClubs[p.fromDivision].filter(id => id !== p.clubId);
    updatedDivisionClubs[p.toDivision].push(p.clubId);
  }

  // Apply playoff winners: remove from source division, add to target
  for (const p of promRel.playoffWinners) {
    updatedDivisionClubs[p.fromDivision] = updatedDivisionClubs[p.fromDivision].filter(id => id !== p.clubId);
    updatedDivisionClubs[p.toDivision].push(p.clubId);
  }

  // Apply relegations: remove from source division, add to target
  for (const r of promRel.relegated) {
    updatedDivisionClubs[r.fromDivision] = updatedDivisionClubs[r.fromDivision].filter(id => id !== r.clubId);
    updatedDivisionClubs[r.toDivision].push(r.clubId);
  }

  return { promRel, updatedClubs: newClubs, updatedDivisionClubs };
}

// ── Generate replacement clubs for div-4 ──

const REPLACEMENT_NAMES = [
  { name: 'Whitehaven Town', shortName: 'WHT', color: '#FFFFFF', secondaryColor: '#0047AB' },
  { name: 'Gateshead FC', shortName: 'GAT', color: '#FFFFFF', secondaryColor: '#000000' },
  { name: 'Solihull Moors', shortName: 'SOL', color: '#FFD700', secondaryColor: '#0047AB' },
  { name: 'Woking Town', shortName: 'WOK', color: '#E01A22', secondaryColor: '#FFFFFF' },
  { name: 'Aldershot Town', shortName: 'ALD', color: '#E01A22', secondaryColor: '#0047AB' },
  { name: 'Bromley FC', shortName: 'BRO', color: '#FFFFFF', secondaryColor: '#000000' },
  { name: 'Chesterfield Town', shortName: 'CHE', color: '#0047AB', secondaryColor: '#FFFFFF' },
  { name: 'Eastleigh FC', shortName: 'EAS', color: '#0047AB', secondaryColor: '#FFFFFF' },
  { name: 'Boreham Wood', shortName: 'BWD', color: '#FFFFFF', secondaryColor: '#000000' },
  { name: 'Oldham Athletic', shortName: 'OLD', color: '#0047AB', secondaryColor: '#FFFFFF' },
  { name: 'Scunthorpe Iron', shortName: 'SCU', color: '#800020', secondaryColor: '#87CEEB' },
  { name: 'Yeovil Town', shortName: 'YEO', color: '#00A650', secondaryColor: '#FFFFFF' },
  { name: 'Halifax Town', shortName: 'HAL', color: '#0047AB', secondaryColor: '#FFFFFF' },
  { name: 'Torquay United', shortName: 'TOR', color: '#FFD700', secondaryColor: '#0047AB' },
  { name: 'Maidenhead United', shortName: 'MAI', color: '#000000', secondaryColor: '#FFFFFF' },
  { name: 'Dorking Wanderers', shortName: 'DOR', color: '#E01A22', secondaryColor: '#FFFFFF' },
];

let replacementIndex = 0;

export function generateReplacementClub(season: number): { clubData: ClubData; clubId: string } {
  const template = REPLACEMENT_NAMES[replacementIndex % REPLACEMENT_NAMES.length];
  replacementIndex++;

  const id = `replaced-${season}-${replacementIndex}-${Math.random().toString(36).slice(2, 6)}`;
  const clubData: ClubData = {
    id,
    name: template.name,
    shortName: template.shortName,
    color: template.color,
    secondaryColor: template.secondaryColor,
    budget: 3_000_000 + Math.floor(Math.random() * 3_000_000),
    reputation: 1,
    facilities: 2,
    youthRating: 2 + Math.floor(Math.random() * 2),
    fanBase: 8 + Math.floor(Math.random() * 10),
    boardPatience: 9,
    squadQuality: 42 + Math.floor(Math.random() * 6),
    league: 'foundation',
    divisionId: 'div-4',
  };

  return { clubData, clubId: id };
}

// ── Check if player's club is in any playoff ──

export function isPlayerInPlayoffs(playerClubId: string, playoffs: PlayoffState[]): boolean {
  return playoffs.some(p =>
    p.bracket.some(t =>
      (t.homeClubId === playerClubId || t.awayClubId === playerClubId) && !t.played
    )
  );
}

/**
 * Get the next unplayed playoff match for the player's club.
 */
export function getNextPlayoffMatch(playerClubId: string, playoffs: PlayoffState[]): { playoff: PlayoffState; tie: PlayoffTie } | null {
  for (const playoff of playoffs) {
    if (!playoff.currentRound) continue;
    const tie = playoff.bracket.find(t =>
      t.round === playoff.currentRound &&
      !t.played &&
      (t.homeClubId === playerClubId || t.awayClubId === playerClubId)
    );
    if (tie) return { playoff, tie };
  }
  return null;
}
