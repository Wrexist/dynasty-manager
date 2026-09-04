/**
 * playerStanding — the derived "who has this player become" layer.
 *
 * Two things matter most here and both are pinned below: standing is a pure
 * reading of existing data (so it can never disagree with the save), and it
 * stays QUIET — a headline on every player is the same as a headline on none.
 */
import { describe, it, expect } from 'vitest';
import type { Player } from '@/types/game';
import {
  derivePlayerStanding,
  getPlayerMilestones,
  getMilestonesCrossed,
  crossedBreakthrough,
  describeGrowthArc,
} from '@/utils/playerStanding';
import {
  BREAKTHROUGH_MIN_SEASON_GROWTH,
  LOYAL_SERVICE_SEASONS,
  ONE_CLUB_SEASONS,
} from '@/config/playerStanding';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    firstName: 'Test',
    lastName: 'Player',
    age: 25,
    position: 'CM',
    overall: 75,
    potential: 80,
    careerGoals: 0,
    careerAssists: 0,
    careerAppearances: 0,
    goals: 0,
    assists: 0,
    appearances: 0,
    ...overrides,
  } as Player;
}

describe('playerStanding — milestones', () => {
  it('reports only marks actually reached, largest first', () => {
    const p = makePlayer({ careerGoals: 120, careerAppearances: 260 });
    const m = getPlayerMilestones(p);
    expect(m.filter(x => x.kind === 'goals').map(x => x.value)).toEqual([100, 50, 25]);
    expect(m.filter(x => x.kind === 'appearances').map(x => x.value)).toEqual([200, 100, 50]);
  });

  it('a player with nothing behind him has no milestones', () => {
    expect(getPlayerMilestones(makePlayer())).toEqual([]);
  });

  it('crossing reports ONLY the newly reached mark', () => {
    // The whole point: career totals fold in every season end, so without
    // this a 300-appearance veteran would re-announce 50, 100 and 200 every
    // year for the rest of his career.
    const before = makePlayer({ careerAppearances: 98 });
    const after = makePlayer({ careerAppearances: 104 });
    const crossed = getMilestonesCrossed(before, after);
    expect(crossed).toHaveLength(1);
    expect(crossed[0]).toMatchObject({ kind: 'appearances', value: 100 });
  });

  it('crossing several marks at once reports each exactly once', () => {
    const crossed = getMilestonesCrossed(
      makePlayer({ careerGoals: 20 }),
      makePlayer({ careerGoals: 55 }),
    );
    expect(crossed.map(m => m.value).sort((a, b) => a - b)).toEqual([25, 50]);
  });

  it('no movement means nothing to announce', () => {
    const p = makePlayer({ careerGoals: 120, careerAppearances: 300 });
    expect(getMilestonesCrossed(p, p)).toEqual([]);
  });
});

describe('playerStanding — breakthrough', () => {
  it('fires exactly on the crossing, not while already above', () => {
    const T = BREAKTHROUGH_MIN_SEASON_GROWTH;
    expect(crossedBreakthrough(T - 1, T)).toBe(true);
    expect(crossedBreakthrough(T, T + 3)).toBe(false);
    expect(crossedBreakthrough(0, T - 1)).toBe(false);
  });

  it('frames the same growth differently by age', () => {
    expect(describeGrowthArc(19)).toBe('breakthrough');
    expect(describeGrowthArc(26)).toBe('improving');
    expect(describeGrowthArc(31)).toBe('late-bloomer');
  });
});

describe('playerStanding — headline', () => {
  it('says nothing about an ordinary squad player', () => {
    // The restraint IS the feature.
    const s = derivePlayerStanding(makePlayer({ joinedSeason: 3 }), { season: 4 });
    expect(s.headline).toBeNull();
  });

  it('leads with a breakthrough over long service', () => {
    const s = derivePlayerStanding(
      makePlayer({ age: 19, joinedSeason: 1, careerAppearances: 120 }),
      { season: 9, seasonGrowth: BREAKTHROUGH_MIN_SEASON_GROWTH + 2 },
    );
    expect(s.headline).toMatch(/Breakthrough season/);
  });

  it('calls out long service when there is no current story', () => {
    const s = derivePlayerStanding(
      makePlayer({ joinedSeason: 1 }),
      { season: 1 + LOYAL_SERVICE_SEASONS },
    );
    expect(s.headline).toBe(`${LOYAL_SERVICE_SEASONS} seasons at the club`);
  });

  it('reserves one-club man for academy graduates', () => {
    const opts = { season: 1 + ONE_CLUB_SEASONS };
    const academy = derivePlayerStanding(
      makePlayer({ joinedSeason: 1, isFromYouthAcademy: true }), opts,
    );
    const signed = derivePlayerStanding(makePlayer({ joinedSeason: 1 }), opts);
    expect(academy.headline).toMatch(/One-club man/);
    expect(signed.headline).not.toMatch(/One-club man/);
  });

  it('falls back to career weight when nothing current is true', () => {
    const s = derivePlayerStanding(makePlayer({ careerGoals: 60 }), { season: 5 });
    expect(s.headline).toBe('Past 50 career goals');
  });

  it('unknown tenure is null, never "0 seasons"', () => {
    // Old saves predate joinedSeason. Saying "0 seasons at the club" about a
    // ten-year servant is worse than saying nothing.
    const s = derivePlayerStanding(makePlayer(), { season: 6 });
    expect(s.seasonsAtClub).toBeNull();
    expect(s.headline).toBeNull();
  });

  it('never reports negative growth as growth', () => {
    const s = derivePlayerStanding(makePlayer({ age: 34 }), { season: 5, seasonGrowth: -3 });
    expect(s.seasonGrowth).toBe(0);
  });
});

/**
 * The narration actually reaching the player.
 *
 * The derivation above is pure and easy to pin; what matters for the feature
 * is that a milestone becomes a message the manager reads. Career totals move
 * at exactly one moment — the season-end fold — so that is what this drives.
 */
describe('playerStanding — milestones reach the inbox at season end', () => {
  it('announces a career mark crossed by the season just played', async () => {
    const { useGameStore } = await import('@/store/gameStore');
    useGameStore.getState().initGame('celtic');
    const clubId = useGameStore.getState().playerClubId;
    const squad = useGameStore.getState().clubs[clubId].playerIds;
    const target = squad[0];

    // Sit him just under 100 career appearances with enough of a season to
    // cross it when the fold happens.
    useGameStore.setState({
      players: {
        ...useGameStore.getState().players,
        [target]: { ...useGameStore.getState().players[target], careerAppearances: 96, appearances: 8 },
      },
    });
    const name = useGameStore.getState().players[target];
    const before = useGameStore.getState().messages.length;

    useGameStore.getState().endSeason();

    const added = useGameStore.getState().messages.slice(0, useGameStore.getState().messages.length - before);
    const hit = added.find(m => m.title.includes(name.lastName) && /100 Appearances/i.test(m.title));
    expect(hit, `expected a 100-appearance message for ${name.lastName}`).toBeTruthy();
    expect(hit!.body).toMatch(/100 career appearances/);
  });

  it('does not re-announce a mark the player was already past', async () => {
    const { useGameStore } = await import('@/store/gameStore');
    useGameStore.getState().initGame('celtic');
    const clubId = useGameStore.getState().playerClubId;
    const target = useGameStore.getState().clubs[clubId].playerIds[0];

    // Already well past 100; a normal season must not re-fire it.
    useGameStore.setState({
      players: {
        ...useGameStore.getState().players,
        [target]: { ...useGameStore.getState().players[target], careerAppearances: 140, appearances: 6 },
      },
    });
    const name = useGameStore.getState().players[target].lastName;

    useGameStore.getState().endSeason();

    const reAnnounced = useGameStore.getState().messages
      .filter(m => m.title.includes(name) && /100 Appearances/i.test(m.title));
    expect(reAnnounced).toHaveLength(0);
  });
});
