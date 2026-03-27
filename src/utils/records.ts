import { ClubRecords, Match, Player } from '@/types/game';

export function createEmptyRecords(): ClubRecords {
  return {
    allTimeTopScorer: null,
    allTimeTopAssister: null,
    bestSeasonPoints: null,
    worstSeasonPoints: null,
    biggestWin: null,
    mostGoalsInSeason: null,
    fewestGoalsAgainst: null,
    highestLeaguePosition: null,
    cupWins: 0,
    seasonsManaged: 0,
    hallOfFame: [],
  };
}

export function updateRecords(
  records: ClubRecords,
  season: number,
  position: number,
  points: number,
  goalsFor: number,
  goalsAgainst: number,
  topScorer: { name: string; goals: number } | null,
  topAssister: { name: string; assists: number } | null,
  biggestWinMargin: { margin: number; description: string } | null,
  cupWon: boolean | number,
): ClubRecords {
  const updated = { ...records };
  updated.seasonsManaged++;

  if (topScorer && (!updated.allTimeTopScorer || topScorer.goals > updated.allTimeTopScorer.value)) {
    updated.allTimeTopScorer = { name: topScorer.name, value: topScorer.goals, season, detail: 'goals in a season' };
  }

  if (topAssister && (!updated.allTimeTopAssister || topAssister.assists > updated.allTimeTopAssister.value)) {
    updated.allTimeTopAssister = { name: topAssister.name, value: topAssister.assists, season, detail: 'assists in a season' };
  }

  if (!updated.bestSeasonPoints || points > updated.bestSeasonPoints.value) {
    updated.bestSeasonPoints = { name: `Season ${season}`, value: points, season, detail: 'points' };
  }

  if (!updated.worstSeasonPoints || points < updated.worstSeasonPoints.value) {
    updated.worstSeasonPoints = { name: `Season ${season}`, value: points, season, detail: 'points' };
  }

  if (!updated.mostGoalsInSeason || goalsFor > updated.mostGoalsInSeason.value) {
    updated.mostGoalsInSeason = { name: `Season ${season}`, value: goalsFor, season, detail: 'goals scored' };
  }

  if (!updated.fewestGoalsAgainst || goalsAgainst < updated.fewestGoalsAgainst.value) {
    updated.fewestGoalsAgainst = { name: `Season ${season}`, value: goalsAgainst, season, detail: 'goals conceded' };
  }

  if (!updated.highestLeaguePosition || position < updated.highestLeaguePosition.value) {
    updated.highestLeaguePosition = { name: `Season ${season}`, value: position, season, detail: 'league position' };
  }

  if (biggestWinMargin && (!updated.biggestWin || biggestWinMargin.margin > updated.biggestWin.value)) {
    updated.biggestWin = { name: biggestWinMargin.description, value: biggestWinMargin.margin, season };
  }

  if (cupWon) {
    updated.cupWins += typeof cupWon === 'number' ? cupWon : 1;
  }

  // Hall of Fame: top scorer each season with 10+ goals
  if (topScorer && topScorer.goals >= 10) {
    updated.hallOfFame = [
      ...updated.hallOfFame,
      { name: topScorer.name, value: topScorer.goals, season, detail: 'Golden Boot' },
    ].slice(-20); // Keep last 20 entries
  }

  return updated;
}

/** Find biggest win margin from played fixtures for a specific club */
export function findBiggestWin(fixtures: Match[], clubId: string): { margin: number; description: string } | null {
  let best: { margin: number; description: string } | null = null;
  for (const m of fixtures) {
    if (!m.played) continue;
    let margin = 0;
    let desc = '';
    if (m.homeClubId === clubId) {
      margin = m.homeGoals - m.awayGoals;
      if (margin > 0) desc = `${m.homeGoals}-${m.awayGoals}`;
    } else if (m.awayClubId === clubId) {
      margin = m.awayGoals - m.homeGoals;
      if (margin > 0) desc = `${m.awayGoals}-${m.homeGoals} (away)`;
    }
    if (margin > 0 && (!best || margin > best.margin)) {
      best = { margin, description: desc };
    }
  }
  return best;
}

/** Check if any player is chasing a club record this season */
export interface RecordChase {
  playerName: string;
  current: number;
  record: number;
  label: string;
}

export function getActiveRecordChases(
  records: ClubRecords,
  squad: Player[],
  fixtures: Match[],
  clubId: string,
): RecordChase[] {
  const chases: RecordChase[] = [];

  // Top scorer chasing goal record
  if (records.allTimeTopScorer) {
    const record = records.allTimeTopScorer.value;
    const topScorer = squad.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals)[0];
    if (topScorer && topScorer.goals >= record - 3 && topScorer.goals < record) {
      chases.push({
        playerName: topScorer.lastName,
        current: topScorer.goals,
        record,
        label: 'season goal record',
      });
    }
  }

  // Clean sheet chase
  const playedFixtures = fixtures.filter(m => m.played && (m.homeClubId === clubId || m.awayClubId === clubId));
  const cleanSheets = playedFixtures.filter(m => (m.homeClubId === clubId ? m.awayGoals : m.homeGoals) === 0).length;
  if (records.fewestGoalsAgainst && cleanSheets >= 10) {
    // Not a direct comparison, but interesting to surface
    chases.push({
      playerName: 'Your defense',
      current: cleanSheets,
      record: cleanSheets + 3, // just show progress
      label: 'clean sheets this season',
    });
  }

  return chases.slice(0, 1); // Only show the most interesting one
}
