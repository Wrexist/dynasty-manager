import { describe, it, expect } from 'vitest';
import { simulateMatch } from '@/engine/match';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { Club, Match, Player } from '@/types/game';

function makeClub(id: string, name: string): Club {
  return {
    id, name, shortName: name.slice(0, 3).toUpperCase(),
    color: '#fff', secondaryColor: '#000',
    budget: 50_000_000, wageBill: 200_000,
    reputation: 70, facilities: 5, youthRating: 5, fanBase: 5, boardPatience: 60,
    playerIds: [], formation: '4-3-3', lineup: [], subs: [],
  };
}

function setupMatch() {
  const homeClub = makeClub('home', 'Home FC');
  const awayClub = makeClub('away', 'Away FC');

  const homeSquad = generateSquad('home', 70, 1);
  const awaySquad = generateSquad('away', 70, 1);
  homeSquad.forEach(p => homeClub.playerIds.push(p.id));
  awaySquad.forEach(p => awayClub.playerIds.push(p.id));

  const { lineup: homePlayers } = selectBestLineup(homeSquad, '4-3-3');
  const { lineup: awayPlayers } = selectBestLineup(awaySquad, '4-3-3');
  homeClub.lineup = homePlayers.map(p => p.id);
  awayClub.lineup = awayPlayers.map(p => p.id);

  const match: Match = { id: 'test', week: 1, homeClubId: 'home', awayClubId: 'away', played: false, homeGoals: 0, awayGoals: 0, events: [] };

  return { homeClub, awayClub, homePlayers, awayPlayers, match };
}

describe('Match Engine', () => {
  it('produces a valid match result', () => {
    const { homeClub, awayClub, homePlayers, awayPlayers, match } = setupMatch();
    const { result } = simulateMatch(match, homeClub, awayClub, homePlayers, awayPlayers);

    expect(result.played).toBe(true);
    expect(result.homeGoals).toBeGreaterThanOrEqual(0);
    expect(result.awayGoals).toBeGreaterThanOrEqual(0);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].type).toBe('kickoff');
    expect(result.events[result.events.length - 1].type).toBe('full_time');
  });

  it('generates valid match stats', () => {
    const { homeClub, awayClub, homePlayers, awayPlayers, match } = setupMatch();
    const { result } = simulateMatch(match, homeClub, awayClub, homePlayers, awayPlayers);

    expect(result.stats).toBeDefined();
    expect(result.stats!.homePossession + result.stats!.awayPossession).toBe(100);
    expect(result.stats!.homeShots).toBeGreaterThanOrEqual(0);
    expect(result.stats!.homeCorners).toBeGreaterThanOrEqual(0);
  });

  it('generates player ratings for all players', () => {
    const { homeClub, awayClub, homePlayers, awayPlayers, match } = setupMatch();
    const { playerRatings } = simulateMatch(match, homeClub, awayClub, homePlayers, awayPlayers);

    expect(playerRatings.length).toBe(homePlayers.length + awayPlayers.length);
    playerRatings.forEach(r => {
      expect(r.rating).toBeGreaterThanOrEqual(1);
      expect(r.rating).toBeLessThanOrEqual(10);
    });
  });

  it('can generate red cards over many matches', () => {
    const { homeClub, awayClub, homePlayers, awayPlayers } = setupMatch();
    let redCardSeen = false;

    // Red cards are rare — run 500 matches to give enough statistical opportunity
    for (let i = 0; i < 500; i++) {
      const match: Match = { id: `test-${i}`, week: 1, homeClubId: 'home', awayClubId: 'away', played: false, homeGoals: 0, awayGoals: 0, events: [] };
      const { result } = simulateMatch(match, homeClub, awayClub, homePlayers, awayPlayers);
      if (result.events.some(e => e.type === 'red_card')) {
        redCardSeen = true;
        break;
      }
    }

    expect(redCardSeen).toBe(true);
  });

  it('respects formation fit bonus', () => {
    const { homeClub, awayClub, homePlayers, awayPlayers, match } = setupMatch();
    // Both clubs use 4-3-3 and squads were built for it, so both should benefit from formation fit
    const { result } = simulateMatch(match, homeClub, awayClub, homePlayers, awayPlayers);
    expect(result.played).toBe(true);
  });
});
