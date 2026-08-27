/**
 * Ballon d'Or top-10 boost lifecycle.
 *
 * The reign flow is the high-leverage path:
 *   - finish top-10 → boost applied, marker set, special card shown
 *   - finish top-10 again next season → marker refreshed, deltas NOT re-applied
 *   - drop out of top-10 → boost reverted (deltas subtracted), marker cleared
 *
 * Bugs here corrupt long-term player stats permanently — coverage is critical.
 */

import { describe, it, expect } from 'vitest';
import {
  applyBallonDorTop10Boost,
  revertBallonDorTop10Boost,
  hasBallonDorTop10Reign,
} from '@/utils/ballonDorBoost';
import { getPlayerCardArt } from '@/utils/uiHelpers';
import { calculateOverall } from '@/utils/playerGen';
import { BALLON_DOR_TOP10_ATTR_BOOST } from '@/config/gameBalance';
import type { Player } from '@/types/game';
import { buildPlayer } from './helpers/seasonFixtures';

function makeStarPlayer(overrides: Partial<Player> = {}): Player {
  // Use ST so shooting (35% weight) drives overall — keeps the test
  // reasoning ("boost raises overall") aligned with how `calculateOverall`
  // actually weights attributes per position.
  const attributes = overrides.attributes ?? {
    pace: 85, shooting: 90, passing: 80, defending: 40, physical: 75, mental: 82,
  };
  const position = overrides.position ?? 'ST';
  return buildPlayer({
    id: 'star',
    position,
    attributes,
    overall: calculateOverall(attributes, position),
    age: 27,
    ...overrides,
  });
}

describe('hasBallonDorTop10Reign', () => {
  it('returns false on a fresh player', () => {
    expect(hasBallonDorTop10Reign(makeStarPlayer())).toBe(false);
  });

  it('returns true after applyBallonDorTop10Boost', () => {
    const p = makeStarPlayer();
    applyBallonDorTop10Boost(p, 5);
    expect(hasBallonDorTop10Reign(p)).toBe(true);
  });

  it('returns false after revertBallonDorTop10Boost', () => {
    const p = makeStarPlayer();
    applyBallonDorTop10Boost(p, 5);
    revertBallonDorTop10Boost(p);
    expect(hasBallonDorTop10Reign(p)).toBe(false);
  });
});

describe('applyBallonDorTop10Boost', () => {
  it('adds the flat boost to every attribute (capped at 99)', () => {
    const p = makeStarPlayer();
    applyBallonDorTop10Boost(p, 5);
    // pace 85 → 88, shooting 90 → 93, passing 80 → 83, etc.
    expect(p.attributes.pace).toBe(85 + BALLON_DOR_TOP10_ATTR_BOOST);
    expect(p.attributes.shooting).toBe(90 + BALLON_DOR_TOP10_ATTR_BOOST);
    expect(p.attributes.passing).toBe(80 + BALLON_DOR_TOP10_ATTR_BOOST);
    expect(p.attributes.defending).toBe(40 + BALLON_DOR_TOP10_ATTR_BOOST);
    expect(p.attributes.physical).toBe(75 + BALLON_DOR_TOP10_ATTR_BOOST);
    expect(p.attributes.mental).toBe(82 + BALLON_DOR_TOP10_ATTR_BOOST);
  });

  it('caps boosted attributes at 99 and stores the actual delta', () => {
    // mental 98 with +3 boost would land at 101 — must cap at 99 (delta = 1).
    const p = makeStarPlayer({
      attributes: { pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70, mental: 98 },
    });
    applyBallonDorTop10Boost(p, 5);
    expect(p.attributes.mental).toBe(99);
    expect(p.ballonDOrTop10BoostDeltas?.mental).toBe(1);
    expect(p.ballonDOrTop10BoostDeltas?.pace).toBe(BALLON_DOR_TOP10_ATTR_BOOST);
  });

  it('recomputes overall after the boost', () => {
    const p = makeStarPlayer();
    const beforeOverall = p.overall;
    applyBallonDorTop10Boost(p, 5);
    expect(p.overall).toBeGreaterThan(beforeOverall);
  });

  it('records the season as the active reign marker', () => {
    const p = makeStarPlayer();
    applyBallonDorTop10Boost(p, 7);
    expect(p.ballonDOrTop10HoldSeason).toBe(7);
  });

  it('refreshes the season marker WITHOUT re-applying deltas if already boosted', () => {
    // Player makes top-10 in S5 → boost applied. Then makes top-10 in S6 →
    // marker refreshed but attributes must not double-boost.
    const p = makeStarPlayer();
    applyBallonDorTop10Boost(p, 5);
    const attrsAfterS5 = { ...p.attributes };
    const deltasAfterS5 = { ...p.ballonDOrTop10BoostDeltas };

    applyBallonDorTop10Boost(p, 6);
    expect(p.ballonDOrTop10HoldSeason).toBe(6);
    expect(p.attributes).toEqual(attrsAfterS5);
    expect(p.ballonDOrTop10BoostDeltas).toEqual(deltasAfterS5);
  });
});

describe('revertBallonDorTop10Boost', () => {
  it('subtracts the stored deltas to restore pre-boost attributes', () => {
    const p = makeStarPlayer();
    const original = { ...p.attributes };
    applyBallonDorTop10Boost(p, 5);
    revertBallonDorTop10Boost(p);
    expect(p.attributes).toEqual(original);
  });

  it('clears the reign markers after reverting', () => {
    const p = makeStarPlayer();
    applyBallonDorTop10Boost(p, 5);
    revertBallonDorTop10Boost(p);
    expect(p.ballonDOrTop10HoldSeason).toBeUndefined();
    expect(p.ballonDOrTop10BoostDeltas).toBeUndefined();
  });

  it('preserves growth/decline that happened DURING the reign', () => {
    // Season-long flow: boost applied at end of S5 → development +2 pace
    // during S6 → drop out at end of S6. The +2 dev gain must survive revert.
    const p = makeStarPlayer({
      attributes: { pace: 80, shooting: 80, passing: 80, defending: 50, physical: 70, mental: 80 },
    });
    applyBallonDorTop10Boost(p, 5);
    // Simulate +2 pace and -1 physical (training/decline) during the reign.
    p.attributes = { ...p.attributes, pace: p.attributes.pace + 2, physical: p.attributes.physical - 1 };
    revertBallonDorTop10Boost(p);
    // pace had +3 boost then +2 dev → revert -3 → 80 + 2 = 82
    expect(p.attributes.pace).toBe(82);
    // physical had +3 boost then -1 decline → revert -3 → 70 - 1 = 69
    expect(p.attributes.physical).toBe(69);
  });

  it('is a no-op when called on a player with no active boost', () => {
    const p = makeStarPlayer();
    const original = { ...p.attributes };
    revertBallonDorTop10Boost(p);
    expect(p.attributes).toEqual(original);
    expect(p.ballonDOrTop10HoldSeason).toBeUndefined();
  });

  it('clears an orphaned reign marker even if deltas are missing (defensive)', () => {
    const p = makeStarPlayer();
    p.ballonDOrTop10HoldSeason = 5; // corrupted state — marker without deltas
    revertBallonDorTop10Boost(p);
    expect(p.ballonDOrTop10HoldSeason).toBeUndefined();
  });

  it('recomputes overall after revert', () => {
    const p = makeStarPlayer();
    const beforeOverall = p.overall;
    applyBallonDorTop10Boost(p, 5);
    revertBallonDorTop10Boost(p);
    expect(p.overall).toBe(beforeOverall);
  });
});

describe('full reign cycle — apply → refresh → revert', () => {
  it('complete journey leaves attributes back at start once reign ends', () => {
    const p = makeStarPlayer();
    const original = { ...p.attributes };

    // S5: makes top-10
    applyBallonDorTop10Boost(p, 5);
    expect(p.attributes.pace).toBe(original.pace + BALLON_DOR_TOP10_ATTR_BOOST);

    // S6: still top-10 → refresh, no double-up
    applyBallonDorTop10Boost(p, 6);
    expect(p.attributes.pace).toBe(original.pace + BALLON_DOR_TOP10_ATTR_BOOST);
    expect(p.ballonDOrTop10HoldSeason).toBe(6);

    // S7: drops out → revert
    revertBallonDorTop10Boost(p);
    expect(p.attributes).toEqual(original);
    expect(p.ballonDOrTop10HoldSeason).toBeUndefined();
  });
});

describe('getPlayerCardArt — Ballon d\'Or override', () => {
  it('returns the Ballon d\'Or card when ballonDorTop10 is true', () => {
    const art = getPlayerCardArt(75, { ballonDorTop10: true });
    expect(art.src).toBe('/player-cards/ballondor.webp');
  });

  it('Ballon d\'Or override outranks every overall tier', () => {
    // Even a 99-rated icon shows the Ballon d'Or card while reigning.
    expect(getPlayerCardArt(99, { ballonDorTop10: true }).src).toBe('/player-cards/ballondor.webp');
    expect(getPlayerCardArt(50, { ballonDorTop10: true }).src).toBe('/player-cards/ballondor.webp');
  });

  it('falls back to tier shield when override is false or missing', () => {
    expect(getPlayerCardArt(92).src).toBe('/player-cards/icon.webp');
    expect(getPlayerCardArt(85, { ballonDorTop10: false }).src).toBe('/player-cards/gold.webp');
  });
});
