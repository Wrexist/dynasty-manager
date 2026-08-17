/**
 * Regression: money must stay bounded, and the world must not shrink or age out.
 *
 * Both were measured over 12 seasons before these mechanics existed:
 *
 * 1. **Money stopped being a constraint around season 6.** Income scales with
 *    success, the only recurring cost is wages (which the manager controls),
 *    and facility upgrades are capped — so cash piled up with nothing to spend
 *    it on. Mean club budget went £63M → £190M and the player's £331M → £1663M.
 *    The board now keeps a working reserve and reinvests a share of anything
 *    above it. Measured after: mean £54M → £38M, player £233M → £186M — flat.
 *
 * 2. **The world shrank and aged.** Not because of retirement — regeneration
 *    only ever filled a squad back to MIN_SQUAD_SIZE, so every squad decayed to
 *    that floor and stayed there. Average squad 30.4 → 26.3, population
 *    5132 → 4635 falling monotonically, under-21s 851 → 356 while over-33s grew
 *    510 → 1456. Topping up to the WORKING squad size with academy-age intake
 *    holds it: population 5331 → 5260 (−1.3%), under-21s recovering to 737, mean
 *    age peaking at 28.6 and coming back down — with FORCED_RETIREMENT_AGE
 *    untouched at 40.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  BOARD_RESERVE_WAGE_MULTIPLE, BOARD_MIN_RESERVE, BOARD_REINVESTMENT_RATE,
  BOARD_REINVESTMENT_MIN_SURPLUS, REGEN_TARGET_SQUAD_SIZE,
  REGEN_YOUTH_AGE_MAX, FORCED_RETIREMENT_AGE, MIN_SQUAD_SIZE,
} from '@/config/gameBalance';

const CLUB = 'manchester-city';

function fresh() {
  localStorage.clear();
  useGameStore.getState().resetGame();
  useGameStore.getState().initGame(CLUB);
}

describe('board reinvestment bounds the surplus', () => {
  beforeEach(fresh);

  it('skims a hoard down toward the working reserve', () => {
    const s = useGameStore.getState();
    const club = s.clubs[s.playerClubId];
    const hoard = 2_000_000_000; // the late-game state we measured
    useGameStore.setState({ clubs: { ...s.clubs, [club.id]: { ...club, budget: hoard } } });

    useGameStore.getState().endSeason();

    const after = useGameStore.getState().clubs[useGameStore.getState().playerClubId];
    expect(after.budget).toBeLessThan(hoard);
    // Bounded by the rule, not merely reduced: reserve + the share left behind.
    const reserve = Math.max(BOARD_MIN_RESERVE, after.wageBill * BOARD_RESERVE_WAGE_MULTIPLE);
    const maxKept = reserve + (hoard - reserve) * (1 - BOARD_REINVESTMENT_RATE);
    // Season rewards land before the skim, so allow headroom for prize money.
    expect(after.budget).toBeLessThanOrEqual(maxKept * 1.5);
  });

  it('leaves a club sitting on a modest balance alone', () => {
    const s = useGameStore.getState();
    const club = s.clubs[s.playerClubId];
    // Comfortably inside the floor — nothing to reinvest.
    const modest = BOARD_MIN_RESERVE - BOARD_REINVESTMENT_MIN_SURPLUS - 1;
    useGameStore.setState({ clubs: { ...s.clubs, [club.id]: { ...club, budget: modest } } });

    useGameStore.getState().endSeason();

    const after = useGameStore.getState().clubs[useGameStore.getState().playerClubId];
    // Prize money can only push it UP; the skim must not have taken anything.
    expect(after.budget).toBeGreaterThanOrEqual(modest);
  });

  it('never drives a club negative', () => {
    useGameStore.getState().endSeason();
    const clubs = Object.values(useGameStore.getState().clubs);
    const broke = clubs.filter(c => c.budget < 0).length;
    // The sink only ever removes a share of a SURPLUS above a floor, so it
    // cannot be what pushes a club under.
    expect(broke).toBe(0);
  });
});

describe('the world restocks itself', () => {
  beforeEach(fresh);

  it('tops squads up to the working size, not the bare minimum', () => {
    expect(REGEN_TARGET_SQUAD_SIZE).toBeGreaterThan(MIN_SQUAD_SIZE);

    useGameStore.getState().endSeason();

    const s = useGameStore.getState();
    const clubIds = [...new Set(Object.values(s.divisionClubs).flat())];
    const sizes = clubIds.map(id => s.clubs[id]?.playerIds.length ?? 0).filter(n => n > 0);
    expect(sizes.length).toBeGreaterThan(0);
    // Squads decaying to the floor is exactly what drained the population.
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(REGEN_TARGET_SQUAD_SIZE);
  });

  it('brings in academy-age players, so the world keeps making youth', () => {
    const before = useGameStore.getState();
    const beforeIds = new Set(Object.keys(before.players));

    useGameStore.getState().endSeason();

    const after = useGameStore.getState();
    const intake = Object.values(after.players).filter(p => !beforeIds.has(p.id) && p.clubId);
    expect(intake.length, 'rollover produced no new players at all').toBeGreaterThan(0);
    const youth = intake.filter(p => p.age <= REGEN_YOUTH_AGE_MAX);
    expect(youth.length, 'no academy-age intake — the world will age out').toBeGreaterThan(0);
  });

  it('does not achieve this by retiring players earlier', () => {
    // The measured drain was never retirement, and the fix must not quietly
    // become one: this constant is deliberately unchanged.
    expect(FORCED_RETIREMENT_AGE).toBe(40);
  });
});
