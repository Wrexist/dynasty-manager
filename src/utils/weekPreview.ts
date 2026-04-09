import { Player, Match, Club, FacilitiesState, ScoutingState, LeagueTableEntry, CliffhangerItem, BoardObjective, LeagueId } from '@/types/game';
import { getSuffix } from '@/utils/helpers';
import {
  MAX_CLIFFHANGERS, CLIFFHANGER_TITLE_RACE_GAP, CLIFFHANGER_BIG_MATCH_REP_GAP,
  CLIFFHANGER_BOARD_PRESSURE_THRESHOLD, CLIFFHANGER_YOUTH_POTENTIAL_GAP,
  CLIFFHANGER_DEADLINE_WEEKS,
} from '@/config/gameBalance';
import { SUMMER_WINDOW_END, WINTER_WINDOW_END } from '@/config/transfers';

interface PreviewItem {
  icon: string;
  text: string;
  type: 'positive' | 'neutral' | 'warning';
}

interface PreviewContext {
  playerClubId: string;
  players: Record<string, Player>;
  clubs: Record<string, Club>;
  fixtures: Match[];
  facilities: FacilitiesState;
  scouting: ScoutingState;
  week: number;
  season: number;
  // Optional extended context for richer fallbacks
  boardObjectives?: BoardObjective[];
  divisionTables?: Record<LeagueId, LeagueTableEntry[]>;
  playerDivision?: LeagueId;
}

/** Generate "Next Week Preview" teaser items from current state */
export function getWeekPreview(ctx: PreviewContext): PreviewItem[] {
  const items: PreviewItem[] = [];
  const club = ctx.clubs[ctx.playerClubId];
  if (!club) return items;

  // Injury returns (players returning in 1 week)
  const returningPlayers = club.playerIds
    .map(id => ctx.players[id])
    .filter(Boolean)
    .filter(p => p.injured && p.injuryWeeks === 1);
  for (const p of returningPlayers) {
    items.push({ icon: 'heart-pulse', text: `${p.lastName} returns from injury next week!`, type: 'positive' });
  }

  // Suspensions ending
  const unsuspended = club.playerIds
    .map(id => ctx.players[id])
    .filter(Boolean)
    .filter(p => p.suspendedUntilWeek === ctx.week + 1);
  for (const p of unsuspended) {
    items.push({ icon: 'check-circle', text: `${p.lastName}'s suspension ends next week`, type: 'positive' });
  }

  // Facility upgrade completing soon
  if (ctx.facilities.upgradeInProgress && ctx.facilities.upgradeInProgress.weeksRemaining <= 2) {
    const remaining = ctx.facilities.upgradeInProgress.weeksRemaining;
    items.push({
      icon: 'wrench',
      text: `${ctx.facilities.upgradeInProgress.type} upgrade completes in ${remaining} week${remaining > 1 ? 's' : ''}!`,
      type: 'positive',
    });
  }

  // Scouting report arriving
  const completingScouts = ctx.scouting.assignments.filter(a => a.weeksRemaining <= 1);
  if (completingScouts.length > 0) {
    items.push({
      icon: 'search',
      text: `Scout report arriving from ${completingScouts[0].region}`,
      type: 'positive',
    });
  }

  // Upcoming opponent preview
  const nextMatch = ctx.fixtures.find(
    m => !m.played && m.week === ctx.week + 1 &&
      (m.homeClubId === ctx.playerClubId || m.awayClubId === ctx.playerClubId)
  );
  if (nextMatch) {
    const isHome = nextMatch.homeClubId === ctx.playerClubId;
    const oppId = isHome ? nextMatch.awayClubId : nextMatch.homeClubId;
    const opp = ctx.clubs[oppId];
    if (opp) {
      items.push({
        icon: isHome ? 'home' : 'plane',
        text: `${isHome ? 'Home' : 'Away'} vs ${opp.shortName} next week`,
        type: 'neutral',
      });
    }
  }

  // Contracts expiring warning
  const expiringContracts = club.playerIds
    .map(id => ctx.players[id])
    .filter(Boolean)
    .filter(p => p.contractEnd <= ctx.season && p.overall >= 65);
  if (expiringContracts.length > 0 && ctx.week >= 20) {
    items.push({
      icon: 'clipboard',
      text: `${expiringContracts.length} contract${expiringContracts.length > 1 ? 's' : ''} expiring — act soon!`,
      type: 'warning',
    });
  }

  return items.slice(0, 3); // Max 3 preview items
}

/** Fallback preview items when the main preview is empty.
 *  Ensures there's always SOMETHING forward-looking on the dashboard. */
export function getFallbackPreview(ctx: PreviewContext): PreviewItem[] {
  const items: PreviewItem[] = [];
  const club = ctx.clubs[ctx.playerClubId];
  if (!club) return items;

  const squad = club.playerIds.map(id => ctx.players[id]).filter(Boolean);

  // Top scorer approaching milestone
  const topScorer = squad.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  if (topScorer) {
    const nextMilestone = [5, 10, 15, 20, 25, 30].find(t => t > topScorer.goals);
    if (nextMilestone) {
      const remaining = nextMilestone - topScorer.goals;
      items.push({
        icon: 'target',
        text: `${topScorer.lastName} has ${topScorer.goals} goals — ${remaining} more for the ${nextMilestone}-goal club!`,
        type: 'positive',
      });
    }
  }

  // Youth prospect with high potential gap
  const prospect = squad
    .filter(p => p.age <= 21 && (p.potential - p.overall) >= 8)
    .sort((a, b) => (b.potential - b.overall) - (a.potential - a.overall))[0];
  if (prospect) {
    items.push({
      icon: 'sparkles',
      text: `${prospect.lastName} (${prospect.overall}) is developing — potential to reach ${prospect.potential}!`,
      type: 'positive',
    });
  }

  // Win rate this season
  const playedFixtures = ctx.fixtures.filter(
    m => m.played && (m.homeClubId === ctx.playerClubId || m.awayClubId === ctx.playerClubId)
  );
  if (playedFixtures.length >= 5) {
    const wins = playedFixtures.filter(m => {
      const isHome = m.homeClubId === ctx.playerClubId;
      const gf = isHome ? m.homeGoals : m.awayGoals;
      const ga = isHome ? m.awayGoals : m.homeGoals;
      return gf > ga;
    }).length;
    const winRate = Math.round((wins / playedFixtures.length) * 100);
    if (winRate >= 60) {
      items.push({ icon: 'trending-up', text: `${winRate}% win rate this season — keep the momentum going!`, type: 'positive' });
    } else if (winRate <= 30) {
      items.push({ icon: 'trending-down', text: `${winRate}% win rate — time to turn the season around.`, type: 'warning' });
    }
  }

  // Weeks remaining in season
  const weeksLeft = 46 - ctx.week;
  if (weeksLeft > 0 && weeksLeft <= 10) {
    items.push({ icon: 'calendar', text: `${weeksLeft} weeks left this season — every match counts now.`, type: 'neutral' });
  }

  // League position context
  if (ctx.divisionTables && ctx.playerDivision) {
    const table = ctx.divisionTables[ctx.playerDivision] || [];
    const myIdx = table.findIndex(e => e.clubId === ctx.playerClubId);
    if (myIdx >= 0 && table.length > 3) {
      const myPts = table[myIdx].points;
      if (myIdx > 0 && myIdx <= 3) {
        const leaderPts = table[0].points;
        const gap = leaderPts - myPts;
        if (gap > 0 && gap <= 6) items.push({ icon: 'trophy', text: `Just ${gap} point${gap !== 1 ? 's' : ''} off the top — the title race is on.`, type: 'positive' });
      }
      if (myIdx >= table.length - 4 && myIdx > 0) {
        const safeIdx = table.length - 4;
        const safePoints = table[safeIdx]?.points || 0;
        const gap = safePoints - myPts;
        if (gap > 0) items.push({ icon: 'alert-triangle', text: `${gap} point${gap !== 1 ? 's' : ''} from safety — every result matters.`, type: 'warning' });
      }
    }
  }

  // Injury return countdown
  const recovering = squad.filter(p => p.injured && p.injuryWeeks > 0).sort((a, b) => a.injuryWeeks - b.injuryWeeks);
  if (recovering.length > 0 && recovering[0].injuryWeeks <= 3) {
    items.push({ icon: 'heart-pulse', text: `${recovering[0].lastName} returns from injury in ${recovering[0].injuryWeeks} week${recovering[0].injuryWeeks !== 1 ? 's' : ''}.`, type: 'neutral' });
  }

  // Contract expiry warnings
  const expiring = squad.filter(p => p.contractEnd <= ctx.season);
  if (expiring.length >= 2) {
    items.push({ icon: 'file-text', text: `${expiring.length} players' contracts expire this season — consider renewals.`, type: 'warning' });
  }

  return items.slice(0, 2);
}

// ── Cliffhanger Generation ──

interface CliffhangerContext {
  playerClubId: string;
  players: Record<string, Player>;
  clubs: Record<string, Club>;
  fixtures: Match[];
  leagueTable: LeagueTableEntry[];
  week: number;
  season: number;
  boardConfidence: number;
  transferWindowOpen: boolean;
  rivalries?: Record<string, { wins: number; draws: number; losses: number; lastResult: string | null; grudgeLevel: number }>;
}

/** Generate emotionally provocative cliffhanger hooks for the "one more week" pull */
export function generateCliffhangers(ctx: CliffhangerContext): CliffhangerItem[] {
  const items: CliffhangerItem[] = [];
  const club = ctx.clubs[ctx.playerClubId];
  if (!club) return items;

  const myEntry = ctx.leagueTable.find(e => e.clubId === ctx.playerClubId);
  const myPos = myEntry ? ctx.leagueTable.indexOf(myEntry) + 1 : 99;

  // Title race tension
  if (myPos <= 4 && ctx.leagueTable.length > 0 && ctx.week >= 10) {
    const leader = ctx.leagueTable[0];
    if (leader && leader.clubId !== ctx.playerClubId) {
      const gap = leader.points - (myEntry?.points || 0);
      if (gap <= CLIFFHANGER_TITLE_RACE_GAP) {
        const leaderClub = ctx.clubs[leader.clubId];
        items.push({
          icon: 'crown',
          text: gap === 0
            ? `Level on points with ${leaderClub?.shortName || 'the leaders'} — the title race is ON`
            : `Just ${gap} point${gap > 1 ? 's' : ''} behind ${leaderClub?.shortName || 'the leaders'} — can you close the gap?`,
          category: 'title_race',
          intensity: gap <= 2 ? 'high' : 'medium',
        });
      }
    } else if (leader && leader.clubId === ctx.playerClubId && ctx.leagueTable.length > 1) {
      const chaser = ctx.leagueTable[1];
      const gap = (myEntry?.points || 0) - chaser.points;
      if (gap <= CLIFFHANGER_TITLE_RACE_GAP) {
        const chaserClub = ctx.clubs[chaser.clubId];
        items.push({
          icon: 'crown',
          text: gap <= 2
            ? `${chaserClub?.shortName || 'Your rivals'} are breathing down your neck — just ${gap} point${gap > 1 ? 's' : ''} behind!`
            : `Top of the table but ${chaserClub?.shortName || 'rivals'} are only ${gap} points back — stay focused!`,
          category: 'title_race',
          intensity: gap <= 2 ? 'high' : 'medium',
        });
      }
    }
  }

  // Upcoming big match (next week vs high-rep opponent)
  const nextMatch = ctx.fixtures.find(
    m => !m.played && m.week === ctx.week + 1 &&
      (m.homeClubId === ctx.playerClubId || m.awayClubId === ctx.playerClubId)
  );
  if (nextMatch) {
    const isHome = nextMatch.homeClubId === ctx.playerClubId;
    const oppId = isHome ? nextMatch.awayClubId : nextMatch.homeClubId;
    const opp = ctx.clubs[oppId];
    if (opp && opp.reputation - club.reputation >= CLIFFHANGER_BIG_MATCH_REP_GAP) {
      items.push({
        icon: 'swords',
        text: `${opp.shortName} next week — can your side pull off the upset?`,
        category: 'big_match',
        intensity: 'high',
      });
    } else if (opp) {
      // Check if opponent is top of table or a direct rival
      const oppEntry = ctx.leagueTable.find(e => e.clubId === oppId);
      const oppPos = oppEntry ? ctx.leagueTable.indexOf(oppEntry) + 1 : 99;
      if (oppPos <= 3 && myPos <= 6) {
        items.push({
          icon: 'swords',
          text: `Title clash — ${opp.shortName} (${oppPos === 1 ? 'league leaders' : `${oppPos}${getSuffix(oppPos)}`}) are next!`,
          category: 'big_match',
          intensity: 'high',
        });
      }
    }
  }

  // Player drama — star player with expiring contract
  const squad = club.playerIds.map(id => ctx.players[id]).filter(Boolean);
  const starWithExpiringContract = squad
    .filter(p => p.contractEnd <= ctx.season && p.overall >= 70)
    .sort((a, b) => b.overall - a.overall)[0];
  if (starWithExpiringContract && ctx.week >= 15) {
    items.push({
      icon: 'alert-triangle',
      text: `${starWithExpiringContract.lastName} (${starWithExpiringContract.overall}) is out of contract soon — will he stay?`,
      category: 'player_drama',
      intensity: 'high',
    });
  }

  // Player wanting to leave
  const unhappyStars = squad.filter(p => p.wantsToLeave && p.overall >= 65);
  if (unhappyStars.length > 0) {
    const star = unhappyStars.sort((a, b) => b.overall - a.overall)[0];
    items.push({
      icon: 'user-minus',
      text: `${star.lastName} wants out — can you convince him to stay?`,
      category: 'player_drama',
      intensity: 'medium',
    });
  }

  // Transfer deadline approaching
  if (ctx.transferWindowOpen) {
    const summerDeadlineWeek = ctx.week <= SUMMER_WINDOW_END ? SUMMER_WINDOW_END : WINTER_WINDOW_END;
    const weeksLeft = summerDeadlineWeek - ctx.week;
    if (weeksLeft > 0 && weeksLeft <= CLIFFHANGER_DEADLINE_WEEKS) {
      items.push({
        icon: 'clock',
        text: weeksLeft === 1
          ? 'Transfer deadline TOMORROW — last chance to deal!'
          : `Transfer window closes in ${weeksLeft} weeks — make your moves!`,
        category: 'transfer_deadline',
        intensity: weeksLeft === 1 ? 'high' : 'medium',
      });
    }
  }

  // Board pressure
  if (ctx.boardConfidence < CLIFFHANGER_BOARD_PRESSURE_THRESHOLD) {
    items.push({
      icon: 'alert-circle',
      text: ctx.boardConfidence < 20
        ? 'The board is losing patience — your job is on the line!'
        : 'The board is watching closely — results must improve.',
      category: 'board_pressure',
      intensity: ctx.boardConfidence < 20 ? 'high' : 'medium',
    });
  }

  // Youth breakthrough imminent
  const youngStars = squad
    .filter(p => p.age <= 21 && (p.potential - p.overall) >= CLIFFHANGER_YOUTH_POTENTIAL_GAP)
    .sort((a, b) => (b.potential - b.overall) - (a.potential - a.overall));
  if (youngStars.length > 0) {
    const prospect = youngStars[0];
    items.push({
      icon: 'sparkles',
      text: `${prospect.lastName} is on the verge of a breakthrough — keep him developing!`,
      category: 'youth_breakthrough',
      intensity: 'medium',
    });
  }

  // Record chase — player close to season goal record
  const topScorer = squad.sort((a, b) => b.goals - a.goals)[0];
  if (topScorer && topScorer.goals >= 18 && ctx.week >= 30) {
    items.push({
      icon: 'target',
      text: `${topScorer.lastName} has ${topScorer.goals} goals — can he hit 20+ this season?`,
      category: 'record_chase',
      intensity: topScorer.goals >= 20 ? 'high' : 'medium',
    });
  }

  // Revenge match — facing a club you've lost to multiple times
  if (nextMatch && ctx.rivalries) {
    const isHome = nextMatch.homeClubId === ctx.playerClubId;
    const nextOppId = isHome ? nextMatch.awayClubId : nextMatch.homeClubId;
    const record = ctx.rivalries[nextOppId];
    if (record && record.losses >= 2 && record.grudgeLevel >= 2) {
      const nextOpp = ctx.clubs[nextOppId];
      items.push({
        icon: 'swords',
        text: `Revenge match! You've lost ${record.losses} times to ${nextOpp?.shortName || 'them'} — time to settle the score.`,
        category: 'rivalry',
        intensity: 'high',
      });
    }
  }

  // Sort by intensity (high first) and return max
  const intensityOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => intensityOrder[a.intensity] - intensityOrder[b.intensity]);
  return items.slice(0, MAX_CLIFFHANGERS);
}
