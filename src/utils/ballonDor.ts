import { Player, Club, LeagueTableEntry, BallonDOrEntry, ContinentalTournamentState, CupState, LeagueCupState, InternationalTournamentState, InternationalKnockoutRound, Position } from '@/types/game';
import {
  BALLON_DOR_TOP_N, BALLON_DOR_MIN_APPEARANCES, BALLON_DOR_WEIGHTS,
  BALLON_DOR_VALUE_BOOST,
  BALLON_DOR_POSITION_MULTIPLIERS, BALLON_DOR_YELLOW_PENALTY,
  BALLON_DOR_RED_PENALTY, BALLON_DOR_DIVISION_BONUS,
  BALLON_DOR_DIVISION_COUNTING_SCALE,
  BALLON_DOR_CONTINENTAL_BONUS,
  BALLON_DOR_LEAGUE_TITLE_BONUS,
  BALLON_DOR_DOMESTIC_CUP_WIN_BONUS,
  BALLON_DOR_LEAGUE_CUP_WIN_BONUS,
  BALLON_DOR_INTL_TOURNAMENT_BONUS,
  BALLON_DOR_ELITE_CLUB_BONUS,
  BALLON_DOR_MAX_PER_DIVISION,
} from '@/config/gameBalance';
import { LEAGUES, ALL_CLUBS } from '@/data/league';
import { CLUB_TEMPLATES } from '@/data/playerTemplates';

const DEFAULT_POSITION_MULTIPLIER = { goals: 1.0, assists: 1.5, cleanSheets: 0 };

/** Compute a player's average match rating, falling back to an estimate from overall. */
function getAvgRating(player: Player): number {
  if (player.seasonRatedMatches && player.seasonRatedMatches > 0) {
    return (player.seasonRatingTotal || 0) / player.seasonRatedMatches;
  }
  // Unrated players: estimate slightly below average based on overall
  return 4.5 + (player.overall / 100) * 2.0;
}

/**
 * Determine a club's deepest continental round and return the corresponding bonus.
 */
function getContinentalBonusForClub(
  clubId: string,
  championsCup: ContinentalTournamentState | null,
  shieldCup: ContinentalTournamentState | null,
  conferenceCup?: ContinentalTournamentState | null,
): number {
  let bonus = 0;

  for (const [tournament, config] of [
    [championsCup, BALLON_DOR_CONTINENTAL_BONUS.champions_cup] as const,
    [shieldCup, BALLON_DOR_CONTINENTAL_BONUS.shield_cup] as const,
    [conferenceCup || null, BALLON_DOR_CONTINENTAL_BONUS.conference_cup] as const,
  ]) {
    if (!tournament) continue;

    // Check if club won
    if (tournament.winnerId === clubId) {
      bonus = Math.max(bonus, config.winner);
      continue;
    }

    // Check knockout rounds (deepest first)
    const knockoutRounds: ('F' | 'SF' | 'QF' | 'R16')[] = ['F', 'SF', 'QF', 'R16'];
    let found = false;
    for (const round of knockoutRounds) {
      const tie = tournament.knockoutTies.find(t => t.round === round && (t.homeClubId === clubId || t.awayClubId === clubId));
      if (tie) {
        bonus = Math.max(bonus, config[round]);
        found = true;
        break;
      }
    }
    if (found) continue;

    // Group stage participation
    const group = tournament.groups.find(g => g.clubIds.includes(clubId));
    if (group) {
      bonus = Math.max(bonus, config.group);
    }
  }

  return bonus;
}

/**
 * Determine the deepest international-tournament round a nation reached
 * (or `null` if they didn't qualify). Returns the matching bonus value
 * from BALLON_DOR_INTL_TOURNAMENT_BONUS — winner outranks final, etc.
 */
function getIntlTournamentBonusForNation(
  nationality: string,
  tournament: InternationalTournamentState | null | undefined,
): number {
  if (!tournament || !nationality) return 0;
  // Winner outranks every other stage.
  if (tournament.winner === nationality) return BALLON_DOR_INTL_TOURNAMENT_BONUS.winner;
  // Walk knockout rounds from deepest (final) outwards. A nation that lost
  // in the SF still reached the SF — check membership in tie home/away.
  const rounds: InternationalKnockoutRound[] = ['F', 'SF', 'QF', 'R16'];
  for (const round of rounds) {
    const tie = tournament.knockoutTies.find(t => t.round === round && (t.homeNation === nationality || t.awayNation === nationality));
    if (tie) return BALLON_DOR_INTL_TOURNAMENT_BONUS[round];
  }
  // Group-stage participation only — no bonus per design.
  const inGroup = tournament.groups.some(g => g.teams.includes(nationality));
  if (inGroup) return BALLON_DOR_INTL_TOURNAMENT_BONUS.group;
  return 0;
}

/**
 * Synthesise Ballon d'Or candidates for elite clubs not present in the
 * loaded game state.
 *
 * Architectural context: `initGame` only loads clubs from the player's
 * country (English pyramid for a Manchester City save, Spanish for a
 * Real Madrid save, etc.). That keeps memory + per-tick cost small but
 * means the BdO candidate pool excludes Real Madrid / Bayern / PSG /
 * Inter etc. when you're managing in England, which is unrealistic —
 * the real award is voted across every league simultaneously.
 *
 * This function fills that gap by pulling FC26 templates for elite
 * clubs that *aren't* in the loaded `clubs` map, generating plausible
 * season output for each star, and producing pre-scored BdO entries.
 * Stats are stochastic but anchored on the player's `ovr` and position
 * so a 92-rated forward typically posts 25-35 goals while a 82-rated
 * CB might post 3-7. League outcome is assumed favourable (top-3
 * finish) since we cannot model their actual season.
 */
/** Internal scored shape — adds divisionId to the public BallonDOrEntry so
 *  the league-diversity cap can run before we strip the field for the
 *  serialised history entry. */
type ScoredEntry = BallonDOrEntry & { _divisionId: string };

function getGlobalEliteEntries(loadedClubIds: Set<string>): ScoredEntry[] {
  const w = BALLON_DOR_WEIGHTS;
  const entries: ScoredEntry[] = [];
  const clubMetaById: Record<string, { shortName: string; color: string; divisionId: string }> = {};
  for (const cd of ALL_CLUBS) {
    clubMetaById[cd.id] = { shortName: cd.shortName, color: cd.color, divisionId: cd.divisionId };
  }
  const clubColorById = clubMetaById; // alias kept for the existing ghost block readability

  for (const clubId of Object.keys(BALLON_DOR_ELITE_CLUB_BONUS)) {
    if (loadedClubIds.has(clubId)) continue;
    const templates = CLUB_TEMPLATES[clubId] || [];
    if (templates.length === 0) continue;

    // Take the top 4 by ovr — mirrors how real BdO clusters the same club
    const topStars = [...templates].sort((a, b) => b.ovr - a.ovr).slice(0, 4);
    const eliteBonus = BALLON_DOR_ELITE_CLUB_BONUS[clubId] ?? 0;
    const meta = clubColorById[clubId] || { shortName: clubId.slice(0, 3).toUpperCase(), color: '#888', divisionId: '' };

    for (let idx = 0; idx < topStars.length; idx++) {
      const t = topStars[idx];
      const pm = BALLON_DOR_POSITION_MULTIPLIERS[t.pos] || DEFAULT_POSITION_MULTIPLIER;

      // Position-aware synthetic season output. Anchored on overall —
      // a 92-rated striker scores more than an 84-rated one. Tuned to
      // match a real-world star's *typical* season output so ghosts and
      // loaded-club stars compete fairly. Cluster cap (idx-scaled drop)
      // ensures only one or two players per ghost club land in the top
      // 10, leaving room for Premier League / loaded-pyramid stars.
      const ovrLift = Math.max(0, (t.ovr - 80) / 14);
      // Cluster decay — deeper squad members get progressively weaker
      // stats so a Tier-S club doesn't claim 4 top-10 spots from synthetic
      // output alone. idx 0 = full strength, idx 3 = ~70%.
      const clusterDecay = 1 - idx * 0.10;
      const isAttacker = (['ST', 'LW', 'RW', 'CAM'] as Position[]).includes(t.pos);
      const isMidfielder = (['CM', 'CDM', 'LM', 'RM'] as Position[]).includes(t.pos);
      const goalsBase = isAttacker ? 11 : isMidfielder ? 3 : 1;
      const goalsRng = isAttacker ? 10 : isMidfielder ? 4 : 2;
      const assistsBase = isAttacker ? 5 : isMidfielder ? 5 : 1;
      const assistsRng = isAttacker ? 7 : isMidfielder ? 5 : 2;
      const goals = Math.max(0, Math.round((goalsBase + ovrLift * 4 + (Math.random() - 0.5) * goalsRng) * clusterDecay));
      const assists = Math.max(0, Math.round((assistsBase + ovrLift * 2.5 + (Math.random() - 0.5) * assistsRng) * clusterDecay));
      const apps = 32 + Math.floor(Math.random() * 8);
      // Avg rating tracks ovr but caps at 7.4 so ghosts can't outrun
      // real loaded-club stars on rating alone.
      const avgRating = Math.max(6.4, Math.min(7.4, 6.3 + (t.ovr - 75) / 26 + (Math.random() - 0.5) * 0.4));

      // Synthetic team finish — assume mid-pack of the top 5 (positions
      // 3-6). Every elite club can drop here in a "down" season; this
      // makes ghosts feel like averages, not always champions.
      const teamPosition = idx === 0 ? 3 : idx === 1 ? 4 : idx === 2 ? 5 : 6;
      const totalTeams = 20;
      const divisionTier = 1;
      const isTierS = eliteBonus >= 90;
      // League title only for Tier-S top star, and rarely (1 in 4) so it
      // emerges in maybe 1-2 ghost clubs per season — much more realistic
      // than the previous "every club's #1 wins their league".
      const ghostWonLeague = idx === 0 && isTierS && Math.random() < 0.25;

      // Apply the same scoring formula as real candidates so synthetic
      // entries compete on equal footing.
      const countingScale = BALLON_DOR_DIVISION_COUNTING_SCALE[divisionTier] ?? 1;
      const ratingScale = countingScale;
      const overallScore = t.ovr * w.overall;
      const goalScore = goals * w.goals * pm.goals * countingScale;
      const assistScore = assists * w.assists * pm.assists * countingScale;
      const appScore = Math.min(apps, 46) * w.appearances;
      const formScore = (72 / 100) * 20 * w.form; // realistic form, not peak
      const positionNorm = (totalTeams - teamPosition) / Math.max(1, totalTeams - 1);
      const positionBonus = Math.sqrt(Math.max(0, positionNorm)) * 30 * w.teamPosition;
      // No clean-sheet team data for synthetic squads — approximate using
      // a typical top-club value so GKs/CBs aren't unfairly punished.
      const teamCleanSheets = 12;
      const cleanSheetScore = teamCleanSheets * w.cleanSheets * pm.cleanSheets * countingScale;
      const ratingScore = avgRating * 10 * w.avgRating * ratingScale;
      const divisionScore = (BALLON_DOR_DIVISION_BONUS[divisionTier] ?? 0) * w.divisionTier;
      // League title only when the synthetic season modelled a champion
      // performance for this player (set above in `ghostWonLeague`).
      const leagueTitleScore = ghostWonLeague ? BALLON_DOR_LEAGUE_TITLE_BONUS * w.leagueTitle : 0;
      const eliteScore = eliteBonus * w.eliteClub;

      const score = overallScore + goalScore + assistScore + appScore + formScore
        + positionBonus + cleanSheetScore + ratingScore + divisionScore
        + leagueTitleScore + eliteScore;

      entries.push({
        playerId: `__bdo-ghost-${t.fcId || `${clubId}-${t.fn}-${t.ln}`}`,
        playerName: `${t.fn} ${t.ln}`,
        clubName: meta.shortName,
        clubColor: meta.color,
        position: t.pos,
        overall: t.ovr,
        age: t.age,
        rank: 0,
        score: Math.round(score * 10) / 10,
        goals,
        assists,
        appearances: apps,
        avgRating: Math.round(avgRating * 10) / 10,
        _divisionId: meta.divisionId,
      });
    }
  }
  return entries;
}

/**
 * Calculate a player's Ballon d'Or score based on season performance.
 * Position-aware formula considers goals, assists, overall rating, average
 * match rating, appearances, form, team finishing position, clean sheets,
 * discipline, division tier, continental tournament performance, league
 * title, domestic cup, league cup, and international tournament wins.
 */
function calculatePlayerScore(
  player: Player,
  teamPosition: number,
  totalTeams: number,
  teamCleanSheets: number,
  divisionTier: number,
  continentalBonus: number,
  leagueTitleWon: boolean,
  domesticCupWon: boolean,
  leagueCupWon: boolean,
  intlTournamentBonus: number,
  eliteClubBonus: number,
): number {
  const w = BALLON_DOR_WEIGHTS;
  const pm = BALLON_DOR_POSITION_MULTIPLIERS[player.position] || DEFAULT_POSITION_MULTIPLIER;

  // Counting-stat scale by division tier. Goals/assists/clean sheets in
  // lower tiers count progressively less — a 30-goal Foundation League
  // striker shouldn't outrank a 25-goal Premier League elite. v70: avg
  // rating now uses the same scale (no sqrt softening) so a Championship
  // CB averaging 8.3 doesn't outrun a Premier League striker averaging
  // 7.4. Match sim does adjust ratings by opponent strength but the gap
  // between top-5 and the rest is large enough that the cushioning was
  // actively hurting realism.
  const countingScale = BALLON_DOR_DIVISION_COUNTING_SCALE[divisionTier] ?? 0.08;
  const ratingScale = countingScale;

  // Base score from overall rating (0-100 scale)
  const overallScore = player.overall * w.overall;

  // Position-scaled and division-scaled goal/assist contributions
  const goalScore = player.goals * w.goals * pm.goals * countingScale;
  const assistScore = player.assists * w.assists * pm.assists * countingScale;

  // Appearance bonus — rewards consistent availability
  const appScore = Math.min(player.appearances, 46) * w.appearances;

  // Form bonus (0-100 scale → 0-20 range)
  const formScore = (player.form / 100) * 20 * w.form;

  // Team position bonus — sqrt curve flattens top-team advantage
  const positionNorm = (totalTeams - teamPosition) / Math.max(1, totalTeams - 1);
  const positionBonus = Math.sqrt(Math.max(0, positionNorm)) * 30 * w.teamPosition;

  // Position-scaled and division-scaled clean sheet bonus
  const cleanSheetScore = teamCleanSheets * w.cleanSheets * pm.cleanSheets * countingScale;

  // Average match rating (0-10 scale, scaled up for meaningful impact).
  // Same division scale as counting stats — see countingScale comment.
  const ratingScore = getAvgRating(player) * 10 * w.avgRating * ratingScale;

  // Discipline penalty — yellow and red cards hurt ranking
  const disciplineScore = -(player.yellowCards * BALLON_DOR_YELLOW_PENALTY + player.redCards * BALLON_DOR_RED_PENALTY) * w.discipline;

  // Division tier bonus — higher divisions rewarded (additive, on top of
  // the counting-stat scale)
  const divisionScore = (BALLON_DOR_DIVISION_BONUS[divisionTier] ?? 0) * w.divisionTier;

  // Continental tournament bonus — deep runs in Champions Cup / Shield Cup
  const continentalScore = continentalBonus * w.continentalBonus;

  // Trophy bonuses — silverware finally moves the needle.
  // League title is on top of the existing sqrt teamPosition curve so
  // champions clearly pull away from runners-up.
  const leagueTitleScore = leagueTitleWon ? BALLON_DOR_LEAGUE_TITLE_BONUS * w.leagueTitle : 0;
  const domesticCupScore = domesticCupWon ? BALLON_DOR_DOMESTIC_CUP_WIN_BONUS * w.domesticCup : 0;
  const leagueCupScore = leagueCupWon ? BALLON_DOR_LEAGUE_CUP_WIN_BONUS * w.leagueCup : 0;
  // Elite-club prestige bonus — players at real-world heavyweight clubs
  // (Real Madrid, Man City, Bayern, PSG, etc.) carry a flat boost to
  // mirror real BdO voting bias toward clubs that win UCL trophies and
  // dominate transfer markets. See BALLON_DOR_ELITE_CLUB_BONUS for tiers.
  const eliteScore = eliteClubBonus * w.eliteClub;

  // International tournament — applied per-nationality so a Brazilian
  // World Cup winner gets the bonus regardless of where their club plays.
  const intlScore = intlTournamentBonus * w.intlTournament;

  return overallScore + goalScore + assistScore + appScore + formScore
    + positionBonus + cleanSheetScore + ratingScore + disciplineScore + divisionScore + continentalScore
    + leagueTitleScore + domesticCupScore + leagueCupScore + intlScore + eliteScore;
}

/**
 * Get the value boost multiplier for a given rank.
 * Uses the defined thresholds with linear interpolation.
 */
export function getBallonDOrValueBoost(rank: number): number {
  if (rank > BALLON_DOR_TOP_N) return 0;

  const thresholds = Object.entries(BALLON_DOR_VALUE_BOOST)
    .map(([k, v]) => ({ rank: Number(k), boost: v }))
    .sort((a, b) => a.rank - b.rank);

  // Exact match
  for (const t of thresholds) {
    if (rank === t.rank) return t.boost;
  }

  // Find surrounding thresholds and interpolate
  for (let i = 0; i < thresholds.length - 1; i++) {
    if (rank > thresholds[i].rank && rank < thresholds[i + 1].rank) {
      const lower = thresholds[i];
      const upper = thresholds[i + 1];
      const t = (rank - lower.rank) / (upper.rank - lower.rank);
      return lower.boost + (upper.boost - lower.boost) * t;
    }
  }

  // Below lowest threshold
  if (rank < thresholds[0].rank) return thresholds[0].boost;
  // Above highest defined threshold but still in top 25
  return thresholds[thresholds.length - 1].boost;
}

/**
 * Calculate the Ballon d'Or top 25 for the season.
 * Returns the ranking entries and does NOT mutate any state.
 *
 * Trophy state (`cup`, `leagueCup`, `internationalTournament`) is optional —
 * historic seasons from older saves may not carry it. Missing state is
 * treated as "no trophy bonus" rather than throwing.
 */
export function calculateBallonDOr(
  allPlayers: Player[],
  clubs: Record<string, Club>,
  leagueTable: LeagueTableEntry[],
  divisionTables: Record<string, LeagueTableEntry[]>,
  championsCup?: ContinentalTournamentState | null,
  shieldCup?: ContinentalTournamentState | null,
  conferenceCup?: ContinentalTournamentState | null,
  cup?: CupState | null,
  leagueCup?: LeagueCupState | null,
  internationalTournament?: InternationalTournamentState | null,
  /** When true, synthesise candidates for elite clubs not loaded in the
   *  player's country pyramid (Real Madrid / Bayern / PSG when in
   *  England, etc.). Default false to keep pure-fixture unit tests
   *  clean; production seasonEnd opts in. */
  injectGlobalElites: boolean = false,
): BallonDOrEntry[] {
  // No ranking possible without league data or players
  if (leagueTable.length === 0 && Object.keys(divisionTables).length === 0) return [];
  if (allPlayers.length === 0) return [];

  const totalTeams = leagueTable.length || 20;

  // Build a lookup: clubId → league position, clean sheets, division tier,
  // and whether they won their division (1st place gets the league-title bonus).
  const clubPositionMap: Record<string, { position: number; totalTeams: number; cleanSheets: number; divisionTier: number; wonLeague: boolean }> = {};

  // Map division IDs to quality tiers
  const divisionTierMap: Record<string, number> = {};
  for (const league of LEAGUES) {
    divisionTierMap[league.id] = league.qualityTier;
  }

  for (let i = 0; i < leagueTable.length; i++) {
    const entry = leagueTable[i];
    const club = clubs[entry.clubId];
    clubPositionMap[entry.clubId] = {
      position: i + 1,
      totalTeams,
      cleanSheets: entry.cleanSheets || 0,
      divisionTier: club ? (divisionTierMap[club.divisionId] ?? 4) : 4,
      wonLeague: i === 0,
    };
  }
  // Also include other division tables
  for (const [, table] of Object.entries(divisionTables)) {
    const divTotal = table.length || 20;
    for (let i = 0; i < table.length; i++) {
      const entry = table[i];
      if (!clubPositionMap[entry.clubId]) {
        const club = clubs[entry.clubId];
        clubPositionMap[entry.clubId] = {
          position: i + 1,
          totalTeams: divTotal,
          cleanSheets: entry.cleanSheets || 0,
          divisionTier: club ? (divisionTierMap[club.divisionId] ?? 4) : 4,
          wonLeague: i === 0,
        };
      }
    }
  }

  const domesticCupWinnerId = cup?.winner || null;
  const leagueCupWinnerId = leagueCup?.winner || null;

  // Synthesise BdO entries for elite clubs not in the loaded country pyramid
  // (e.g. Real Madrid / Bayern / PSG when you're managing in England). See
  // getGlobalEliteEntries for the rationale.
  const loadedClubIds = new Set(Object.keys(clubs));
  const ghostEntries = injectGlobalElites ? getGlobalEliteEntries(loadedClubIds) : [];

  // Score every eligible player
  const realScored: ScoredEntry[] = allPlayers
    .filter(p => p.appearances >= BALLON_DOR_MIN_APPEARANCES && p.clubId)
    .map(p => {
      const clubPos = clubPositionMap[p.clubId] || { position: 10, totalTeams: 20, cleanSheets: 0, divisionTier: 4, wonLeague: false };
      const contBonus = getContinentalBonusForClub(p.clubId, championsCup || null, shieldCup || null, conferenceCup || null);
      const domesticCupWon = p.clubId === domesticCupWinnerId;
      const leagueCupWon = p.clubId === leagueCupWinnerId;
      const intlBonus = getIntlTournamentBonusForNation(p.nationality, internationalTournament || null);
      const eliteBonus = BALLON_DOR_ELITE_CLUB_BONUS[p.clubId] ?? 0;
      const score = calculatePlayerScore(
        p,
        clubPos.position,
        clubPos.totalTeams,
        clubPos.cleanSheets,
        clubPos.divisionTier,
        contBonus,
        clubPos.wonLeague,
        domesticCupWon,
        leagueCupWon,
        intlBonus,
        eliteBonus,
      );
      const club = clubs[p.clubId];
      const avgRating = Math.round(getAvgRating(p) * 10) / 10;
      return {
        playerId: p.id,
        playerName: `${p.firstName} ${p.lastName}`,
        clubName: club?.shortName || '',
        clubColor: club?.color || '#888',
        position: p.position,
        overall: p.overall,
        age: p.age,
        rank: 0,
        score: Math.round(score * 10) / 10,
        goals: p.goals,
        assists: p.assists,
        appearances: p.appearances,
        avgRating,
        _divisionId: club?.divisionId || '',
      };
    });

  // Merge real game-state candidates with synthesised global elites and
  // re-sort the combined pool. Ghost entries are ranked alongside real
  // ones, which is what the player should see — a Real Madrid winger and
  // a Manchester City striker competing on the same leaderboard.
  const sorted = [...realScored, ...ghostEntries].sort((a, b) => {
    // Primary: score descending
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreakers: goals → assists → appearances → overall
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    if (b.appearances !== a.appearances) return b.appearances - a.appearances;
    return b.overall - a.overall;
  });

  // Soft per-division cap: walk in score order, accept everyone until a
  // division reaches BALLON_DOR_MAX_PER_DIVISION, then defer further
  // candidates from that division. Backfill the deferred ones at the end
  // if the top 25 isn't full (e.g. only one or two real-world divisions
  // are represented in this save). Empty divisionId (loose ghost / data
  // gap) is treated as uncapped so we never starve a load with sparse
  // metadata.
  const accepted: ScoredEntry[] = [];
  const deferred: ScoredEntry[] = [];
  const divisionCounts = new Map<string, number>();
  for (const entry of sorted) {
    if (accepted.length >= BALLON_DOR_TOP_N) break;
    const div = entry._divisionId;
    if (!div) {
      accepted.push(entry);
      continue;
    }
    const count = divisionCounts.get(div) ?? 0;
    if (count >= BALLON_DOR_MAX_PER_DIVISION) {
      deferred.push(entry);
      continue;
    }
    accepted.push(entry);
    divisionCounts.set(div, count + 1);
  }
  for (const entry of deferred) {
    if (accepted.length >= BALLON_DOR_TOP_N) break;
    accepted.push(entry);
  }

  // Strip the internal _divisionId before returning so the serialised
  // BallonDOrEntry stays clean.
  const scored: BallonDOrEntry[] = accepted.map(e => ({
    playerId: e.playerId,
    playerName: e.playerName,
    clubName: e.clubName,
    clubColor: e.clubColor,
    position: e.position,
    overall: e.overall,
    age: e.age,
    rank: e.rank,
    score: e.score,
    goals: e.goals,
    assists: e.assists,
    appearances: e.appearances,
    avgRating: e.avgRating,
  }));

  // Assign ranks
  scored.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  return scored;
}
