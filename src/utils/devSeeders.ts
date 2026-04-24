/**
 * Dev-only state seeders used by the DevToolsPanel. Everything in here
 * mutates the live game store via direct `setState` so we can test
 * features without playing through a full season.
 *
 * These helpers intentionally bypass the normal game logic; do NOT
 * import or reference them from production code paths.
 */

import { useGameStore } from '@/store/gameStore';
import type { BallonDOrEntry, Player, SeasonHistory } from '@/types/game';

/**
 * Seed the current season's SeasonHistory with a synthetic Ballon d'Or
 * ranking built from the 25 highest-rated players on the pitch right
 * now. Fills in plausible goals/assists/avgRating so the page has
 * something interesting to render.
 */
export function seedBallonDor(): { count: number } {
  const state = useGameStore.getState();
  const allPlayers = Object.values(state.players);

  const top25 = [...allPlayers]
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 25);

  const ranking: BallonDOrEntry[] = top25.map((p, i) => {
    const baseGoals = Math.max(5, Math.round((p.overall - 55) * 0.5));
    const baseAssists = Math.max(2, Math.round((p.overall - 55) * 0.25));
    const scorer = p.position === 'ST' || p.position === 'LW' || p.position === 'RW';
    const goals = Math.max(1, baseGoals + (scorer ? 8 : 0) - i);
    const assists = Math.max(0, baseAssists + 2 - Math.floor(i / 3));
    return {
      playerId: p.id,
      playerName: `${p.firstName} ${p.lastName}`,
      clubName: state.clubs[p.clubId]?.shortName || 'Free Agent',
      clubColor: state.clubs[p.clubId]?.color || '#64748b',
      position: p.position,
      overall: p.overall,
      age: p.age,
      rank: i + 1,
      score: Math.max(10, Math.round(100 - i * 3.2)),
      goals,
      assists,
      appearances: 28 + Math.round(Math.random() * 10),
      avgRating: 6.5 + ((p.overall - 55) / 45) * 2.2,
    };
  });

  const existingIdx = state.seasonHistory.findIndex((h) => h.season === state.season);
  let nextHistory: SeasonHistory[];
  if (existingIdx >= 0) {
    nextHistory = state.seasonHistory.map((h, i) =>
      i === existingIdx ? { ...h, ballonDOrRanking: ranking } : h,
    );
  } else {
    const winner = top25[0];
    nextHistory = [
      ...state.seasonHistory,
      {
        season: state.season,
        position: 0,
        points: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        topScorer: {
          name: winner ? `${winner.firstName} ${winner.lastName}` : '—',
          goals: ranking[0]?.goals ?? 0,
        },
        boardVerdict: 'good',
        ballonDOrRanking: ranking,
      },
    ];
  }

  useGameStore.setState({ seasonHistory: nextHistory });
  return { count: ranking.length };
}

/** Find the player club's first player with some matchable criterion. */
function pickPlayerClubPlayer(predicate: (p: Player) => boolean): Player | null {
  const state = useGameStore.getState();
  const club = state.clubs[state.playerClubId];
  if (!club) return null;
  for (const id of club.playerIds || []) {
    const p = state.players[id];
    if (p && predicate(p)) return p;
  }
  return null;
}

/** Give the player club a cash injection. Use negative to simulate loss. */
export function adjustBudget(delta: number): void {
  const state = useGameStore.getState();
  const club = state.clubs[state.playerClubId];
  if (!club) return;
  useGameStore.setState({
    clubs: {
      ...state.clubs,
      [state.playerClubId]: { ...club, budget: club.budget + delta },
    },
  });
}

/** Refresh every squad player's fitness to 100 and clear injuries. */
export function healSquad(): { healed: number; fitnessReset: number } {
  const state = useGameStore.getState();
  const club = state.clubs[state.playerClubId];
  if (!club) return { healed: 0, fitnessReset: 0 };

  let healed = 0;
  let fitnessReset = 0;
  const nextPlayers = { ...state.players };
  for (const id of club.playerIds || []) {
    const p = nextPlayers[id];
    if (!p) continue;
    const wasInjured = p.injured;
    nextPlayers[id] = {
      ...p,
      fitness: 100,
      injured: false,
      injuryWeeks: 0,
    };
    if (wasInjured) healed += 1;
    if (p.fitness < 100) fitnessReset += 1;
  }

  useGameStore.setState({ players: nextPlayers });
  return { healed, fitnessReset };
}

/** Pick a random squad player and inflict a short injury on them. */
export function injectInjury(): { playerName: string } | null {
  const state = useGameStore.getState();
  const club = state.clubs[state.playerClubId];
  if (!club) return null;
  const eligibleIds = (club.playerIds || []).filter((id) => {
    const p = state.players[id];
    return p && !p.injured;
  });
  if (eligibleIds.length === 0) return null;
  const victimId = eligibleIds[Math.floor(Math.random() * eligibleIds.length)];
  const victim = state.players[victimId];
  if (!victim) return null;
  useGameStore.setState({
    players: {
      ...state.players,
      [victimId]: { ...victim, injured: true, injuryWeeks: 3 + Math.floor(Math.random() * 4) },
    },
  });
  return { playerName: `${victim.firstName} ${victim.lastName}` };
}

/** Flip the first non-injured squad player's wantsToLeave flag. */
export function toggleWantsToLeave(): { playerName: string; nowWants: boolean } | null {
  const player = pickPlayerClubPlayer((p) => !p.injured);
  if (!player) return null;
  const state = useGameStore.getState();
  const nextWants = !player.wantsToLeave;
  useGameStore.setState({
    players: {
      ...state.players,
      [player.id]: { ...player, wantsToLeave: nextWants },
    },
  });
  return { playerName: `${player.firstName} ${player.lastName}`, nowWants: nextWants };
}

/** Set the pack pity counter to (threshold - 1) so the next pull is pity. */
export function armPackPity(): void {
  const state = useGameStore.getState();
  // Threshold is in @/config/packs; read at runtime rather than import so we
  // can't accidentally drift when the constant changes.
  const PITY = 9; // PACK_PITY_THRESHOLD — one shy so next open hits pity
  useGameStore.setState({ packPityCounter: Math.max(state.packPityCounter, PITY) });
}

/** Navigate to the player detail screen for the first squad player. */
export function inspectFirstPlayer(): void {
  const state = useGameStore.getState();
  const club = state.clubs[state.playerClubId];
  const id = club?.playerIds?.[0];
  if (!id) return;
  state.selectPlayer(id);
}

/** Open a rival team's detail page. Picks the first non-player club. */
export function inspectRivalClub(): void {
  const state = useGameStore.getState();
  const rivalId = Object.keys(state.clubs).find((id) => id !== state.playerClubId);
  if (!rivalId) return;
  state.selectClub(rivalId);
}
