/**
 * Phase 5 foundation — `buildInternationalMatchTeams` assembles two match-ready
 * national-team "clubs" (player nation from the confirmed squad, opponent
 * generated on demand) so an international fixture can run through the match
 * engine. Uses the real national-team pool (loaded by the global test setup).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { buildInternationalMatchTeams } from '@/utils/internationalMatch';

const NAT = 'France';
const OPP = 'Brazil';

beforeEach(() => {
  // A standalone World Cup gives us a confirmed national squad + pool in state.
  useGameStore.getState().startWorldCup(NAT);
});

describe('buildInternationalMatchTeams', () => {
  it('builds the player nation from its confirmed squad', () => {
    const s = useGameStore.getState();
    const teams = buildInternationalMatchTeams({
      playerNation: NAT,
      opponentNation: OPP,
      nationalTeam: s.nationalTeam!,
      existingPlayers: s.players,
      season: s.season,
      communityPackEnabled: s.communityPackEnabled,
    });
    expect(teams.playerClub.id).toBe(NAT);
    expect(teams.playerClub.lineup.length).toBe(11);
    // Every starter is a real player already in state.
    for (const id of teams.playerClub.lineup) {
      expect(s.players[id]).toBeTruthy();
    }
  });

  it('generates a full opponent nation with its own players', () => {
    const s = useGameStore.getState();
    const teams = buildInternationalMatchTeams({
      playerNation: NAT,
      opponentNation: OPP,
      nationalTeam: s.nationalTeam!,
      existingPlayers: s.players,
      season: s.season,
      communityPackEnabled: s.communityPackEnabled,
    });
    expect(teams.opponentClub.id).toBe(OPP);
    expect(teams.opponentClub.lineup.length).toBe(11);
    expect(Object.keys(teams.opponentPlayers).length).toBeGreaterThanOrEqual(11);
    // Opponent starters resolve against the generated opponent players.
    for (const id of teams.opponentClub.lineup) {
      expect(teams.opponentPlayers[id]).toBeTruthy();
    }
  });

  it('does not reuse the player nation players for the opponent', () => {
    const s = useGameStore.getState();
    const teams = buildInternationalMatchTeams({
      playerNation: NAT, opponentNation: OPP, nationalTeam: s.nationalTeam!,
      existingPlayers: s.players, season: s.season, communityPackEnabled: s.communityPackEnabled,
    });
    const playerIds = new Set(teams.playerClub.playerIds);
    const overlap = teams.opponentClub.playerIds.filter(id => playerIds.has(id));
    expect(overlap).toHaveLength(0);
  });
});
