/**
 * Regression: scouted players are real people, and never the same person twice.
 *
 * Club squads are built from the FC26 pool via `pickUnclaimedRealPlayer` +
 * `buildPlayerFromTemplate`, so every club in the world is full of real names.
 * Scouting was the one surface still calling `generatePlayer` directly, which
 * produces a procedural identity — you scouted "John Smith" out of a league of
 * actual footballers.
 *
 * The claim matters as much as the name: without `claimRealPlayer` the same
 * person could be scouted twice, or scouted while already on a club's books.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { completeAssignment, createAssignment } from '@/utils/scouting';
import { resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import { NATIONALITY_NAME_POOLS, FALLBACK_LAST_NAMES } from '@/config/namePool';
import type { ScoutRegion } from '@/types/game';

/** Every surname the PROCEDURAL generator can produce. A scouted player whose
 *  surname is outside this set can only have come from the real pool — that is
 *  what makes this test discriminate, rather than passing on any non-empty
 *  name. */
const PROCEDURAL_SURNAMES = new Set<string>([
  ...FALLBACK_LAST_NAMES,
  ...Object.values(NATIONALITY_NAME_POOLS).flatMap(p => p.lastNames ?? []),
].map(n => n.toLowerCase()));

const REGIONS: ScoutRegion[] = ['europe', 'south-america'];

function reportsFor(region: ScoutRegion, runs: number) {
  const players: ReturnType<typeof completeAssignment>['players'] = [];
  for (let i = 0; i < runs; i++) {
    const assignment = createAssignment(region);
    const { players: found } = completeAssignment(assignment, 7, 1, 1);
    players.push(...found);
  }
  return players;
}

describe('scouting draws real identities', () => {
  beforeEach(() => resetRealPlayerClaims());

  it('draws identities the procedural generator could not have produced', () => {
    const players = reportsFor('europe', 30);
    expect(players.length).toBeGreaterThan(0);
    const fromRealPool = players.filter(p => !PROCEDURAL_SURNAMES.has(p.lastName.trim().toLowerCase()));
    // Against the old code — a bare `generatePlayer` call — this is 0 by
    // construction: every surname it can emit is in the procedural pool.
    expect(fromRealPool.length, 'no scouted player came from the real pool').toBeGreaterThan(0);
    for (const p of players) {
      // Mononym templates ("Isco") deliberately carry an empty firstName so
      // the card renders one name, not "Isco Isco" — assert on the display
      // name rather than on both fields.
      expect(`${p.firstName} ${p.lastName}`.trim().length).toBeGreaterThan(0);
      expect(p.lastName.trim().length).toBeGreaterThan(0);
      expect(p.overall).toBeGreaterThan(0);
      expect(p.overall).toBeLessThanOrEqual(99);
      // Scouted players belong to nobody until signed.
      expect(p.clubId).toBe('');
    }
  });

  it('never scouts the same person twice', () => {
    const players = REGIONS.flatMap(r => reportsFor(r, 20));
    const names = players.map(p => `${p.firstName} ${p.lastName}`.toLowerCase());
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes, `duplicate scouted identities: ${[...new Set(dupes)].slice(0, 5).join(', ')}`).toEqual([]);
  });

  it('still returns a report when the real pool cannot satisfy the draw', () => {
    // Exhausting the pool must fall back to procedural generation rather than
    // producing no player at all — a scout assignment always returns something.
    const players = reportsFor('europe', 200);
    expect(players.length).toBeGreaterThan(100);
    for (const p of players) expect(p.id).toBeTruthy();
  });
});
