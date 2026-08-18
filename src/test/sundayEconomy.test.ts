/**
 * The books.
 *
 * The economy's contract is that `balance` is always the sum of its ledger and
 * nothing changes it behind the ledger's back. These tests hold that line, and
 * check the three ways out of trouble (fundraiser, chasing subs, sponsors) plus
 * the one way the run ends.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { buildWeekLedger, ledgerNet, splitLedger, sundayWeeklyBurn } from '@/utils/sunday/finance';
import { createSundayRng } from '@/utils/sunday/rng';
import { assertSundayState } from '@/utils/sunday/invariants';
import {
  SUNDAY_BANKRUPT_GRACE_WEEKS, SUNDAY_FORFEIT_FINE, SUNDAY_FUNDRAISER_COOLDOWN,
  SUNDAY_REFEREE_FEE, SUNDAY_SUBS_PER_PLAYER, getSundayDivision, getSundayUpgrade,
  sundayUpgradeCost,
} from '@/config/sundayLeague';
import type { SundaySquadMember } from '@/types/game';

const SEED = 909;

function check() {
  const s = useGameStore.getState();
  assertSundayState({
    sunday: s.sunday!, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
  });
}

beforeEach(async () => {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'moneyball', seed: SEED });
});

function squadOf(n: number, commitment: number): SundaySquadMember[] {
  return Array.from({ length: n }, (_, i) => ({
    playerId: `p${i}`, archetype: 'journeyman' as const, job: 'sparky',
    commitment, punctuality: 10, ego: 10, loyalty: 10, temper: 10, influence: 10,
    condition: 10, injuryProne: 10, happiness: 60, benchedStreak: 0, startedStreak: 0,
    clubApps: 0, clubGoals: 0, clubAssists: 0, clubMotm: 0, joinedSeason: 1,
    availability: { status: 'available' as const, reason: null, note: null, warned: true, weeksRemaining: 0 },
    friends: [], rivals: [], unsettled: false, subsOwed: 0,
  }));
}

describe('the weekly ledger', () => {
  const base = {
    divisionId: 'sun-4' as const, personality: 'pub' as const, reputation: 20,
    upgrades: [], sponsors: [], redCards: 0, injuries: 0, chargeLeagueFee: false, ringers: 0,
  };

  it('charges the referee and the pitch for a home fixture', () => {
    const squad = squadOf(11, 12);
    const r = buildWeekLedger({
      ...base, rng: createSundayRng(1, 0), squad,
      playedIds: squad.map(m => m.playerId),
      fixture: { home: true, derby: false, forfeited: false },
    });
    const kinds = r.lines.map(l => l.kind);
    expect(kinds).toContain('referee');
    expect(kinds).toContain('pitch');
    expect(kinds).not.toContain('travel');
    expect(r.lines.find(l => l.kind === 'referee')!.amount).toBe(-SUNDAY_REFEREE_FEE);
  });

  it('charges travel instead of pitch hire away from home', () => {
    const squad = squadOf(11, 12);
    const r = buildWeekLedger({
      ...base, rng: createSundayRng(1, 0), squad,
      playedIds: squad.map(m => m.playerId),
      fixture: { home: false, derby: false, forfeited: false },
    });
    const kinds = r.lines.map(l => l.kind);
    expect(kinds).toContain('travel');
    expect(kinds).not.toContain('pitch');
  });

  it('collects more subs from a committed squad than an unreliable one', () => {
    const collect = (commitment: number) => {
      let total = 0;
      for (let i = 0; i < 40; i++) {
        const squad = squadOf(11, commitment);
        const r = buildWeekLedger({
          ...base, rng: createSundayRng(i * 7 + 1, 0), squad,
          playedIds: squad.map(m => m.playerId),
          fixture: { home: true, derby: false, forfeited: false },
        });
        total += r.subsCollected;
      }
      return total;
    };
    expect(collect(20)).toBeGreaterThan(collect(2));
  });

  it('puts unpaid subs on the tab rather than losing them', () => {
    const squad = squadOf(11, 2);
    const r = buildWeekLedger({
      ...base, rng: createSundayRng(5, 0), squad,
      playedIds: squad.map(m => m.playerId),
      fixture: { home: true, derby: false, forfeited: false },
    });
    const owed = Object.values(r.subsOwed).reduce((n, v) => n + v, 0);
    expect(r.subsCollected + owed).toBe(11 * SUNDAY_SUBS_PER_PLAYER);
  });

  it('fines an unfulfilled fixture and charges nothing for a match not played', () => {
    const r = buildWeekLedger({
      ...base, rng: createSundayRng(1, 0), squad: [], playedIds: [],
      fixture: { home: true, derby: false, forfeited: true },
    });
    expect(r.lines.find(l => l.kind === 'fine')!.amount).toBe(-SUNDAY_FORFEIT_FINE);
    expect(r.lines.some(l => l.kind === 'referee')).toBe(false);
  });

  it('always nets out to the sum of its own lines', () => {
    const squad = squadOf(11, 12);
    const r = buildWeekLedger({
      ...base, rng: createSundayRng(9, 0), squad,
      playedIds: squad.map(m => m.playerId),
      fixture: { home: true, derby: true, forfeited: false },
      redCards: 2, injuries: 1, chargeLeagueFee: true, ringers: 2,
    });
    expect(ledgerNet(r.lines)).toBe(r.net);
    const { income, expenses } = splitLedger(r.lines);
    expect(income - expenses).toBe(r.net);
  });

  it('quotes a weekly burn that matches the division it is asked about', () => {
    expect(sundayWeeklyBurn('sun-4', [])).toBeLessThan(sundayWeeklyBurn('sun-prem', []));
    // A minibus halves travel, so it must lower the quote.
    expect(sundayWeeklyBurn('sun-4', [{ id: 'minibus', level: 1 }])).toBeLessThan(sundayWeeklyBurn('sun-4', []));
  });
});

describe('balance and the ledger stay in step', () => {
  it('every recorded week ends on the balance the ledger implies', async () => {
    for (let i = 0; i < 8; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      await useGameStore.getState().advanceWeek();
    }
    const sunday = useGameStore.getState().sunday!;
    expect(sunday.ledger.length).toBeGreaterThan(0);
    // The last recorded balance is the current one (nothing has been spent
    // since the advance).
    expect(sunday.ledger[sunday.ledger.length - 1].balance).toBe(sunday.balance);
    check();
  });
});

describe('the ways out of trouble', () => {
  it('a fundraiser raises money and then refuses until the cooldown lapses', async () => {
    const before = useGameStore.getState().sunday!.balance;
    const first = await useGameStore.getState().runSundayFundraiser();
    expect(first.ok).toBe(true);
    expect(first.raised).toBeGreaterThan(0);
    expect(useGameStore.getState().sunday!.balance).toBe(before + first.raised);

    const second = await useGameStore.getState().runSundayFundraiser();
    expect(second.ok).toBe(false);
    expect(second.raised).toBe(0);

    for (let i = 0; i < SUNDAY_FUNDRAISER_COOLDOWN; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      await useGameStore.getState().advanceWeek();
    }
    expect((await useGameStore.getState().runSundayFundraiser()).ok).toBe(true);
    check();
  });

  it('chasing subs recovers most of the tab and costs goodwill', async () => {
    const s0 = useGameStore.getState();
    useGameStore.setState({
      sunday: { ...s0.sunday!, squad: s0.sunday!.squad.map(m => ({ ...m, subsOwed: 10 })) },
    });
    const owed = useGameStore.getState().sunday!.squad.reduce((n, m) => n + m.subsOwed, 0);
    const balanceBefore = useGameStore.getState().sunday!.balance;
    const moraleBefore = useGameStore.getState().sunday!.teamMorale;

    const r = await useGameStore.getState().chaseSundaySubs();
    expect(r.ok).toBe(true);
    expect(r.recovered).toBeGreaterThan(0);
    expect(r.recovered).toBeLessThanOrEqual(owed);
    expect(useGameStore.getState().sunday!.balance).toBe(balanceBefore + r.recovered);
    expect(useGameStore.getState().sunday!.teamMorale).toBeLessThan(moraleBefore);
    check();
  });

  it('refuses to chase a tab that does not exist', async () => {
    const r = await useGameStore.getState().chaseSundaySubs();
    expect(r.ok).toBe(false);
    expect(r.recovered).toBe(0);
  });
});

describe('spending', () => {
  it('buys an upgrade once, charges exactly its cost, and will not overspend', async () => {
    const s0 = useGameStore.getState();
    useGameStore.setState({ sunday: { ...s0.sunday!, balance: 5000, reputation: 100 } });
    const cost = sundayUpgradeCost('kit', 0);
    const before = useGameStore.getState().sunday!.balance;

    const r = await useGameStore.getState().buySundayUpgrade('kit');
    expect(r.ok).toBe(true);
    expect(useGameStore.getState().sunday!.balance).toBe(before - cost);
    expect(useGameStore.getState().sunday!.upgrades.find(u => u.id === 'kit')!.level).toBe(1);

    // Buy it out, then check it refuses.
    const max = getSundayUpgrade('kit').maxLevel;
    for (let lvl = 1; lvl < max; lvl++) await useGameStore.getState().buySundayUpgrade('kit');
    const overshoot = await useGameStore.getState().buySundayUpgrade('kit');
    expect(overshoot.ok).toBe(false);
    expect(useGameStore.getState().sunday!.upgrades.find(u => u.id === 'kit')!.level).toBe(max);
    check();
  });

  it('refuses an upgrade the club cannot afford, and takes no money', async () => {
    const s0 = useGameStore.getState();
    useGameStore.setState({ sunday: { ...s0.sunday!, balance: 1, reputation: 100 } });
    const r = await useGameStore.getState().buySundayUpgrade('floodlights');
    expect(r.ok).toBe(false);
    expect(useGameStore.getState().sunday!.balance).toBe(1);
    expect(useGameStore.getState().sunday!.upgrades).toHaveLength(0);
  });

  it('refuses an upgrade the club has not earned the standing for', async () => {
    const s0 = useGameStore.getState();
    useGameStore.setState({ sunday: { ...s0.sunday!, balance: 5000, reputation: 0 } });
    const r = await useGameStore.getState().buySundayUpgrade('floodlights');
    expect(r.ok).toBe(false);
    expect(useGameStore.getState().sunday!.balance).toBe(5000);
  });
});

describe('running out of money', () => {
  it('does not fold on a single week in the red', async () => {
    const s0 = useGameStore.getState();
    useGameStore.setState({ sunday: { ...s0.sunday!, balance: -250 } });
    const s1 = useGameStore.getState();
    if (s1.sunday!.pendingEvent) await s1.resolveSundayEvent(s1.sunday!.pendingEvent.choices[0].id);
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().sunday!.folded).toBe(false);
    expect(useGameStore.getState().sunday!.weeksInDebt).toBeGreaterThan(0);
  });

  it('folds once the hole has been left open for the whole grace period', async () => {
    // Driven off the counter rather than by playing weeks: the mode gives the
    // manager real ways out (the "there is nothing in the account" event, a
    // fundraiser), and a test that plays on auto-pilot ends up measuring those
    // instead of the rule it is about.
    const s0 = useGameStore.getState();
    useGameStore.setState({
      sunday: { ...s0.sunday!, balance: -250, weeksInDebt: SUNDAY_BANKRUPT_GRACE_WEEKS - 1, pendingEvent: null },
    });
    await useGameStore.getState().advanceWeek();
    const sunday = useGameStore.getState().sunday!;
    expect(sunday.folded).toBe(true);
    expect(sunday.foldReason).toBeTruthy();
    expect(useGameStore.getState().currentScreen).toBe('sunday-history');
  });

  it('folds when the overdraft passes the point of no return', async () => {
    const s0 = useGameStore.getState();
    useGameStore.setState({ sunday: { ...s0.sunday!, balance: -5000, pendingEvent: null } });
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().sunday!.folded).toBe(true);
  });

  it('a folded club cannot advance another week', async () => {
    const s0 = useGameStore.getState();
    useGameStore.setState({ sunday: { ...s0.sunday!, folded: true, foldReason: 'test' } });
    const week = useGameStore.getState().week;
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().week).toBe(week);
    expect(useGameStore.getState().currentScreen).toBe('sunday-history');
  });
});

describe('division economics', () => {
  it('scales fees and gates upward through the pyramid', () => {
    const four = getSundayDivision('sun-4');
    const prem = getSundayDivision('sun-prem');
    expect(prem.leagueFee).toBeGreaterThan(four.leagueFee);
    expect(prem.pitchHire).toBeGreaterThan(four.pitchHire);
    expect(prem.gateBase).toBeGreaterThan(four.gateBase);
    expect(prem.titlePrize).toBeGreaterThan(four.titlePrize);
  });
});
