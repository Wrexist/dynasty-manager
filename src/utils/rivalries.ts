import type { Club, HeadToHeadRecord, Match, RivalSummary } from '@/types/game';
import { DERBIES, getDerbyIntensity, getDerbyName } from '@/data/league';
import { RIVAL_MIN_GRUDGE, RIVAL_MIN_MEETINGS } from '@/config/ui';

interface DeriveRivalsParams {
  playerClubId: string;
  clubs: Record<string, Club>;
  rivalries: Record<string, HeadToHeadRecord>;
  fixtures: Match[];
  /** Current week — only meetings from this week onward count as "upcoming". */
  currentWeek: number;
}

/**
 * Current run of identical results (from `clubId`'s perspective) against a
 * single opponent, using played fixtures only. Fixtures cover the current
 * season, so this is the in-season streak — cheap and correct within the year.
 * Returns null when the two clubs haven't met (decisively or otherwise) yet.
 */
function headToHeadStreak(
  clubId: string,
  oppId: string,
  fixtures: Match[],
): { type: 'W' | 'D' | 'L'; count: number } | null {
  const results = fixtures
    .filter(
      m =>
        m.played &&
        ((m.homeClubId === clubId && m.awayClubId === oppId) ||
          (m.homeClubId === oppId && m.awayClubId === clubId)),
    )
    .sort((a, b) => a.week - b.week)
    .map(m => {
      const isHome = m.homeClubId === clubId;
      const gf = isHome ? m.homeGoals : m.awayGoals;
      const ga = isHome ? m.awayGoals : m.homeGoals;
      if (gf > ga) return 'W' as const;
      if (gf < ga) return 'L' as const;
      return 'D' as const;
    });

  if (results.length === 0) return null;

  const type = results[results.length - 1];
  let count = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === type; i--) count++;
  return { type, count };
}

/** Earliest unplayed fixture week (>= currentWeek) between the two clubs. */
function nextMeetingWeek(
  clubId: string,
  oppId: string,
  fixtures: Match[],
  currentWeek: number,
): number | null {
  const upcoming = fixtures
    .filter(
      m =>
        !m.played &&
        m.week >= currentWeek &&
        ((m.homeClubId === clubId && m.awayClubId === oppId) ||
          (m.homeClubId === oppId && m.awayClubId === clubId)),
    )
    .sort((a, b) => a.week - b.week);
  return upcoming.length > 0 ? upcoming[0].week : null;
}

function buildSummary(
  playerClubId: string,
  rivalClub: Club,
  record: HeadToHeadRecord | undefined,
  fixtures: Match[],
  currentWeek: number,
): RivalSummary {
  const wins = record?.wins ?? 0;
  const draws = record?.draws ?? 0;
  const losses = record?.losses ?? 0;
  const decisive = wins + losses;
  return {
    clubId: rivalClub.id,
    name: rivalClub.name,
    shortName: rivalClub.shortName,
    color: rivalClub.color,
    secondaryColor: rivalClub.secondaryColor,
    derbyName: getDerbyName(playerClubId, rivalClub.id),
    derbyIntensity: getDerbyIntensity(playerClubId, rivalClub.id),
    wins,
    draws,
    losses,
    meetings: wins + draws + losses,
    grudgeLevel: record?.grudgeLevel ?? 0,
    streak: headToHeadStreak(playerClubId, rivalClub.id, fixtures),
    nextMeetingWeek: nextMeetingWeek(playerClubId, rivalClub.id, fixtures, currentWeek),
    dominance: decisive > 0 ? wins / decisive : 0.5,
  };
}

/**
 * Build the "Your Rivals" list for the Rivalries Hub, purely derived from
 * existing state. A club qualifies as a rival when EITHER:
 *   (a) it's a hardcoded derby opponent of the player's club AND currently in
 *       the same division, OR
 *   (b) it has a head-to-head record with grudgeLevel >= RIVAL_MIN_GRUDGE or
 *       at least RIVAL_MIN_MEETINGS total meetings.
 *
 * Sorted derby-intensity → grudge → meetings (all descending) so the sharpest
 * rivalries surface first.
 */
export function deriveRivals({
  playerClubId,
  clubs,
  rivalries,
  fixtures,
  currentWeek,
}: DeriveRivalsParams): RivalSummary[] {
  if (!playerClubId || !clubs[playerClubId]) return [];
  const playerClub = clubs[playerClubId];
  const rivalIds = new Set<string>();

  // (a) Hardcoded derbies in the same division.
  for (const derby of DERBIES) {
    let partnerId: string | null = null;
    if (derby.clubIdA === playerClubId) partnerId = derby.clubIdB;
    else if (derby.clubIdB === playerClubId) partnerId = derby.clubIdA;
    if (!partnerId) continue;
    const partner = clubs[partnerId];
    if (partner && partner.divisionId === playerClub.divisionId) rivalIds.add(partnerId);
  }

  // (b) Repeat opponents from head-to-head records.
  for (const [oppId, record] of Object.entries(rivalries || {})) {
    if (oppId === playerClubId || !clubs[oppId]) continue;
    const meetings = record.wins + record.draws + record.losses;
    if (record.grudgeLevel >= RIVAL_MIN_GRUDGE || meetings >= RIVAL_MIN_MEETINGS) {
      rivalIds.add(oppId);
    }
  }

  const summaries = Array.from(rivalIds).map(id =>
    buildSummary(playerClubId, clubs[id], rivalries?.[id], fixtures, currentWeek),
  );

  summaries.sort(
    (a, b) =>
      b.derbyIntensity - a.derbyIntensity ||
      b.grudgeLevel - a.grudgeLevel ||
      b.meetings - a.meetings ||
      a.name.localeCompare(b.name),
  );

  return summaries;
}
