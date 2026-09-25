/**
 * Loan development moves overall by a delta, never to the formula's answer.
 *
 * Real players carry authored ratings above `calculateOverall(attributes)` (95%
 * of them, by up to +15 — see `applyPlayerDevelopment`). The weekly loan block
 * used to set `overall = calculateOverall(...)` whenever a loanee gained an
 * attribute point, so a real youngster out on loan LOST several overall points
 * on the very tick he improved.
 *
 * The loan roll chances are forced to 1 so every week is a development tick.
 */
import { describe, it, expect, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { calculateOverall } from '@/utils/playerGen';
import type { Player } from '@/types/game';

vi.mock('@/config/gameBalance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/gameBalance')>()),
  LOAN_PLAY_CHANCE_HIGH: 1,
  LOAN_PLAY_CHANCE_LOW: 1,
  LOAN_DEV_BASE_CHANCE: 1,
}));

describe('loan development keeps an authored rating', () => {
  it('a real loanee rated above the formula never loses overall while developing', async () => {
    useGameStore.getState().initGame('celtic');
    const s = useGameStore.getState();
    const aiClubs = Object.values(s.clubs).filter(c => c.id !== s.playerClubId && c.playerIds.length > 18);
    const lender = aiClubs[0];
    const borrower = aiClubs[1];
    const source = lender.playerIds.map(id => s.players[id]).find(p => p && p.position !== 'GK')!;

    const attributes = { pace: 60, shooting: 60, passing: 60, defending: 60, physical: 60, mental: 60 };
    const authored = calculateOverall(attributes, source.position) + 8;
    const loanee: Player = {
      ...source,
      age: 19,
      attributes,
      overall: authored,
      potential: 95,
      injured: false,
      onLoan: true,
      loanFromClubId: lender.id,
      loanToClubId: borrower.id,
      clubId: borrower.id,
    };
    useGameStore.setState({
      players: { ...s.players, [loanee.id]: loanee },
      clubs: {
        ...s.clubs,
        [lender.id]: { ...lender, playerIds: lender.playerIds.filter(id => id !== loanee.id), lineup: lender.lineup.filter(id => id !== loanee.id), subs: lender.subs.filter(id => id !== loanee.id) },
        [borrower.id]: { ...borrower, playerIds: [...borrower.playerIds, loanee.id] },
      },
      activeLoans: [...s.activeLoans, {
        id: 'loan-dev-test', playerId: loanee.id, fromClubId: lender.id, toClubId: borrower.id,
        startWeek: s.week, startSeason: s.season, durationWeeks: 30, wageSplit: 100, recallClause: false,
      }],
    });

    const attrSum = (p: Player) => Object.values(p.attributes).reduce((a, b) => a + b, 0);
    for (let i = 0; i < 3; i++) await useGameStore.getState().advanceWeek();

    const after = useGameStore.getState().players[loanee.id];
    // Three forced development ticks happened...
    expect(attrSum(after)).toBeGreaterThanOrEqual(attrSum(loanee) + 3);
    // ...and each moved overall by at most what it was worth, from the authored base.
    expect(after.overall).toBeGreaterThanOrEqual(authored);
    expect(after.overall).toBeLessThanOrEqual(authored + (attrSum(after) - attrSum(loanee)));
  }, 120_000);
});
