/**
 * Every upgrade card tells the truth.
 *
 * Three of the ten used to lie, and nothing in the codebase could tell:
 *
 *   - Floodlights (£450, the most expensive thing in the mode) advertised
 *     "+1 commitment growth". It was implemented NOWHERE.
 *   - Goal Nets advertised "fewer refereeing rows". No such system existed.
 *   - Clubhouse Access advertised a "post-match morale boost" that was a
 *     single +2 at the till and nothing on any Sunday afterwards.
 *
 * The fix is structural rather than a one-off correction: each upgrade
 * declares its effects as `SundayUpgradeEffectKey`s, and the PROBES map below
 * is typed `Record<SundayUpgradeEffectKey, Probe>`, so the compiler refuses a
 * new key with no probe and this file refuses a claimed key whose probe does
 * not fire. Adding a sentence to an `effectText` therefore costs a key, and a
 * key costs a test against the real system.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { buildWeekLedger, sundayWeeklyBurn } from '@/utils/sunday/finance';
import { createSundayRng } from '@/utils/sunday/rng';
import { buildMatchdayTeam, sundayTacticFit } from '@/utils/sunday/match';
import { sundayPitchQuality } from '@/store/slices/sunday/matchday';
import { sundayAvailabilityChance } from '@/utils/sunday/availability';
import { developSundayPlayer, sundaySeasonWeeks } from '@/utils/sunday/season';
import { generateSundayRecruit } from '@/utils/sunday/generation';
import { SUNDAY_EVENTS } from '@/data/sundayEvents';
import type { SundayEventContext } from '@/data/sundayEvents';
import {
  SUNDAY_UPGRADES, SUNDAY_FLOODLIGHT_COMMITMENT_GROWTH,
  SUNDAY_CLUBHOUSE_POSTMATCH_MORALE, SUNDAY_KIT_MORALE_PER_LEVEL,
  SUNDAY_KIT_REP_PER_LEVEL, SUNDAY_UPGRADE_UPKEEP_PER_LEVEL,
  SUNDAY_MORALE_WIN, SUNDAY_MORALE_DRAW, SUNDAY_MORALE_LOSS,
  SUNDAY_MORALE_HEAVY_LOSS, SUNDAY_MORALE_FORFEIT, SUNDAY_HEAVY_LOSS_MARGIN,
  SUNDAY_RINGER_MORALE,
} from '@/config/sundayLeague';
import type {
  Player, SundaySquadMember, SundayUpgradeEffectKey, SundayUpgradeState,
} from '@/types/game';

const SEED = 31337;

function member(over: Partial<SundaySquadMember> = {}): SundaySquadMember {
  return {
    playerId: 'p1', archetype: 'journeyman', job: 'sparky',
    commitment: 10, punctuality: 10, ego: 10, loyalty: 10, temper: 10, influence: 10,
    condition: 10, injuryProne: 10, happiness: 60, benchedStreak: 0, startedStreak: 0,
    clubApps: 0, clubGoals: 0, clubAssists: 0, clubMotm: 0, joinedSeason: 1,
    availability: { status: 'available', reason: null, note: null, warned: true, weeksRemaining: 0 },
    friends: [], rivals: [], formerTeammates: [], appsWith: {},
    unsettled: false, subsOwed: 0, memories: [], promise: null,
    ...over,
  };
}

function outfielder(id: string, position: Player['position'] = 'CM'): Player {
  return {
    id, firstName: 'Test', lastName: id, age: 24, position, nationality: 'England',
    overall: 50, potential: 55, value: 0, wage: 0, contractEnd: 99, clubId: 'sunday-club',
    attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50 },
    form: 55, fitness: 100, morale: 60, injured: false, injuryWeeks: 0,
    goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0,
    careerGoals: 0, careerAssists: 0, careerAppearances: 0,
  };
}

const upgrades = (id: SundayUpgradeState['id'], level: number): SundayUpgradeState[] => [{ id, level }];

/** A probe returns nothing and throws (via expect) when the effect is absent. */
type Probe = () => void | Promise<void>;

/**
 * One probe per effect key, against the system that actually implements it.
 *
 * `Record<SundayUpgradeEffectKey, Probe>` is the load-bearing part: TypeScript
 * will not compile this file if a key exists with no probe here.
 */
const PROBES: Record<SundayUpgradeEffectKey, Probe> = {
  'morale-on-purchase': async () => {
    const s0 = useGameStore.getState();
    useGameStore.setState({ sunday: { ...s0.sunday!, balance: 5000, reputation: 100, teamMorale: 50 } });
    const before = useGameStore.getState().sunday!.teamMorale;
    await useGameStore.getState().buySundayUpgrade('kit');
    expect(useGameStore.getState().sunday!.teamMorale).toBe(before + SUNDAY_KIT_MORALE_PER_LEVEL);
  },
  'reputation-on-purchase': async () => {
    const s0 = useGameStore.getState();
    useGameStore.setState({ sunday: { ...s0.sunday!, balance: 5000, reputation: 50 } });
    const before = useGameStore.getState().sunday!.reputation;
    await useGameStore.getState().buySundayUpgrade('kit');
    expect(useGameStore.getState().sunday!.reputation).toBe(before + SUNDAY_KIT_REP_PER_LEVEL);
  },
  'pitch-quality': () => {
    const s = useGameStore.getState().sunday!;
    const bare = sundayPitchQuality({ ...s, upgrades: [], pitchDamage: 0 }, 1);
    const rolled = sundayPitchQuality({ ...s, upgrades: upgrades('pitch', 3), pitchDamage: 0 }, 1);
    expect(rolled).toBeGreaterThan(bare);
  },
  'outfield-attributes': () => {
    const xi = Array.from({ length: 11 }, (_, i) => outfielder(`x${i}`, i === 0 ? 'GK' : 'CM'));
    const squad = xi.map(p => member({ playerId: p.id }));
    const base = { xi, squad, tacticId: 'route-one' as const, pitchQuality: 50, glovesLevel: 0, coachLevel: 0, teamMorale: 55, isPlayerClub: true };
    const without = buildMatchdayTeam({ ...base, ballsLevel: 0 });
    const withBalls = buildMatchdayTeam({ ...base, ballsLevel: 2 });
    const sum = (t: { players: Player[] }) => t.players
      .filter(p => p.position !== 'GK')
      .reduce((n, p) => n + p.attributes.shooting + p.attributes.passing, 0);
    expect(sum(withBalls)).toBeGreaterThan(sum(without));
  },
  'keeper-quality': () => {
    const xi = Array.from({ length: 11 }, (_, i) => outfielder(`g${i}`, i === 0 ? 'GK' : 'CM'));
    const squad = xi.map(p => member({ playerId: p.id }));
    const base = { xi, squad, tacticId: 'route-one' as const, pitchQuality: 50, ballsLevel: 0, coachLevel: 0, teamMorale: 55, isPlayerClub: true };
    const keeper = (t: { players: Player[] }) => t.players.find(p => p.position === 'GK')!;
    const without = keeper(buildMatchdayTeam({ ...base, glovesLevel: 0 }));
    const withGloves = keeper(buildMatchdayTeam({ ...base, glovesLevel: 2 }));
    expect(withGloves.overall + withGloves.attributes.defending)
      .toBeGreaterThan(without.overall + without.attributes.defending);
  },
  'injury-treatment-free': () => {
    const base = {
      rng: createSundayRng(1, 0), divisionId: 'sun-4' as const, personality: 'pub' as const,
      reputation: 20, sponsors: [], playedIds: [], squad: [], redCards: 0, injuries: 2,
      chargeLeagueFee: false, ringers: 0, fixture: null,
    };
    expect(buildWeekLedger({ ...base, upgrades: [] }).lines.some(l => l.kind === 'medical')).toBe(true);
    expect(buildWeekLedger({ ...base, upgrades: upgrades('physio', 1) }).lines.some(l => l.kind === 'medical')).toBe(false);
  },
  'injury-heal-faster': async () => {
    // The physio's heal is an extra chance per week inside the weekly advance.
    // A long lay-off and a short run of weeks keeps both arms off the floor,
    // so the comparison is between two positive numbers.
    const weeksLeft = async (physio: number) => {
      useGameStore.getState().resetGame();
      await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
      const s = useGameStore.getState();
      const injuredId = s.sunday!.squad[0].playerId;
      useGameStore.setState({
        players: { ...s.players, [injuredId]: { ...s.players[injuredId], injured: true, injuryWeeks: 30 } },
        sunday: { ...s.sunday!, upgrades: physio ? upgrades('physio', 3) : [] },
      });
      for (let i = 0; i < 8; i++) {
        const cur = useGameStore.getState();
        if (cur.sunday!.folded || cur.sunday!.seasonComplete) break;
        if (cur.sunday!.pendingEvent) await cur.resolveSundayEvent(cur.sunday!.pendingEvent.choices[0].id);
        await useGameStore.getState().advanceWeek();
      }
      return useGameStore.getState().players[injuredId]?.injuryWeeks ?? 0;
    };
    const treated = await weeksLeft(3);
    const untreated = await weeksLeft(0);
    expect(untreated).toBeGreaterThan(0);
    expect(treated).toBeLessThan(untreated);
  },
  'travel-half': () => {
    const base = {
      rng: createSundayRng(1, 0), divisionId: 'sun-4' as const, personality: 'pub' as const,
      reputation: 20, sponsors: [], playedIds: [], squad: [], redCards: 0, injuries: 0,
      chargeLeagueFee: false, ringers: 0, fixture: { home: false, derby: false, forfeited: false },
    };
    const full = buildWeekLedger({ ...base, upgrades: [] }).lines.find(l => l.kind === 'travel')!;
    const bussed = buildWeekLedger({ ...base, upgrades: upgrades('minibus', 1) }).lines.find(l => l.kind === 'travel')!;
    expect(bussed.amount).toBeGreaterThan(full.amount);
  },
  'away-availability': () => {
    const m = member();
    const away = sundayAvailabilityChance(m, { away: true, bigGame: false, hasMinibus: false, freeWeek: false });
    const bussed = sundayAvailabilityChance(m, { away: true, bigGame: false, hasMinibus: true, freeWeek: false });
    expect(bussed).toBeGreaterThan(away);
  },
  'commitment-growth': async () => {
    // THE CLAIM THAT WAS IMPLEMENTED NOWHERE. Run a season out with and
    // without the lights and compare the squad's commitment after the summer.
    const commitmentAfterSeason = async (floodlights: boolean) => {
      useGameStore.getState().resetGame();
      await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
      const s = useGameStore.getState();
      useGameStore.setState({
        sunday: { ...s.sunday!, upgrades: floodlights ? upgrades('floodlights', 1) : [] },
      });
      const before = useGameStore.getState().sunday!.squad.map(m => m.commitment);
      const total = sundaySeasonWeeks(useGameStore.getState().sunday!.divisionId);
      for (let i = 0; i < total + 2; i++) {
        const cur = useGameStore.getState();
        if (cur.sunday!.folded || cur.sunday!.seasonComplete) break;
        if (cur.sunday!.pendingEvent) await cur.resolveSundayEvent(cur.sunday!.pendingEvent.choices[0].id);
        await useGameStore.getState().advanceWeek();
      }
      if (useGameStore.getState().sunday!.folded) return null;
      const ids = new Set(useGameStore.getState().sunday!.squad.map(m => m.playerId));
      await useGameStore.getState().endSundaySeason();
      const after = useGameStore.getState().sunday!.squad.filter(m => ids.has(m.playerId));
      return { before, after: after.map(m => m.commitment) };
    };
    const lit = await commitmentAfterSeason(true);
    const dark = await commitmentAfterSeason(false);
    expect(lit, 'the lit club folded — reseed the probe').not.toBeNull();
    expect(dark).not.toBeNull();
    const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
    // Same seed, same squad, same season: the only difference is the lights.
    expect(sum(lit!.after) - sum(dark!.after))
      .toBeGreaterThanOrEqual(SUNDAY_FLOODLIGHT_COMMITMENT_GROWTH);
  },
  'no-disputed-goal-row': () => {
    const def = SUNDAY_EVENTS.find(e => e.id === 'ref-decision');
    expect(def, 'the disputed-goal row is the only refereeing row in the catalogue').toBeTruthy();
    const ctx = { lastResult: 1, hasNets: false } as unknown as SundayEventContext;
    expect(def!.condition!(ctx)).toBe(true);
    expect(def!.condition!({ ...ctx, hasNets: true })).toBe(false);
  },
  'post-match-morale': async () => {
    // THE ONE-TIME BUMP MASQUERADING AS A STANDING EFFECT. The shared match
    // engine is unseeded, so two runs of "the same" fixture are not
    // comparable — instead play ONE home match and reconstruct the morale
    // arithmetic from the report it produced. Squad morale must land on the
    // figure that INCLUDES the clubhouse term, and the term must not be zero.
    useGameStore.getState().resetGame();
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
    let played = false;
    for (let guard = 0; guard < 12 && !played; guard++) {
      const cur = useGameStore.getState();
      if (cur.sunday!.folded || cur.sunday!.seasonComplete) break;
      if (cur.sunday!.pendingEvent) await cur.resolveSundayEvent(cur.sunday!.pendingEvent.choices[0].id);
      const fixture = cur.fixtures.find(f => f.week === cur.week && f.homeClubId === cur.playerClubId);
      if (!fixture) { await useGameStore.getState().advanceWeek(); continue; }
      // No derby, no promises, a known starting morale: everything else in the
      // sum is then readable off the report.
      useGameStore.setState({
        sunday: {
          ...useGameStore.getState().sunday!,
          upgrades: upgrades('clubhouse', 2),
          teamMorale: 55,
          rivalry: null,
          squad: useGameStore.getState().sunday!.squad.map(m => ({ ...m, promise: null })),
        },
      });
      await useGameStore.getState().arriveSundayMatch();
      const report = await useGameStore.getState().playSundayMatch();
      expect(report).toBeTruthy();
      const after = useGameStore.getState().sunday!.teamMorale;
      const margin = Math.abs(report!.goalsFor - report!.goalsAgainst);
      const base = report!.forfeited
        ? SUNDAY_MORALE_FORFEIT
        : report!.goalsFor > report!.goalsAgainst ? SUNDAY_MORALE_WIN
          : report!.goalsFor === report!.goalsAgainst ? SUNDAY_MORALE_DRAW
            : margin >= SUNDAY_HEAVY_LOSS_MARGIN ? SUNDAY_MORALE_HEAVY_LOSS : SUNDAY_MORALE_LOSS;
      const clubhouse = report!.forfeited ? 0 : 2 * SUNDAY_CLUBHOUSE_POSTMATCH_MORALE;
      const withoutIt = 55 + base - report!.ringersUsed * SUNDAY_RINGER_MORALE;
      expect(clubhouse, 'the clubhouse term must not be zero').toBeGreaterThan(0);
      expect(after).toBe(Math.max(0, Math.min(100, withoutIt + clubhouse)));
      played = true;
    }
    expect(played, 'never reached a home fixture — reseed the probe').toBe(true);
  },
  'recruit-quality': () => {
    const opts = {
      season: 1, week: 4, reputation: 30, personality: 'pub' as const, needs: [],
      rivalName: null, vouchName: 'Kev', voucherId: null, town: 'Wrexham', index: 0,
      divisionId: 'sun-4' as const, source: 'mate' as const,
    };
    const mean = (clubhouse: number) => {
      let total = 0;
      for (let seed = 0; seed < 40; seed++) {
        total += generateSundayRecruit({
          ...opts, rng: createSundayRng(seed, 0), clubhouseLevel: clubhouse,
        }).player.overall;
      }
      return total / 40;
    };
    expect(mean(2)).toBeGreaterThan(mean(0));
  },
  'growth-rate': () => {
    const young = { ...outfielder('y1'), age: 20, minutesPlayed: 900 };
    const sum = (p: Player) => Object.values(p.attributes).reduce((n, v) => n + v, 0);
    let coached = 0, uncoached = 0;
    for (let seed = 0; seed < 30; seed++) {
      coached += sum(developSundayPlayer(createSundayRng(seed, 0), young, member(), 3).player);
      uncoached += sum(developSundayPlayer(createSundayRng(seed, 0), young, member(), 0).player);
    }
    expect(coached).toBeGreaterThan(uncoached);
  },
  'tactical-fit': () => {
    const xi = Array.from({ length: 11 }, (_, i) => outfielder(`f${i}`, i === 0 ? 'GK' : 'CM'));
    expect(sundayTacticFit('route-one', xi, 3)).toBeGreaterThan(sundayTacticFit('route-one', xi, 0));
  },
};

beforeEach(async () => {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

describe('upgrade cards tell the truth', () => {
  it('every upgrade declares at least one effect', () => {
    for (const u of SUNDAY_UPGRADES) {
      expect(u.effects.length, `${u.name} claims "${u.effectText}" and declares no effect`).toBeGreaterThan(0);
    }
  });

  it('every declared effect is probed against the system that implements it', () => {
    const claimed = new Set(SUNDAY_UPGRADES.flatMap(u => u.effects));
    for (const key of claimed) {
      expect(PROBES[key], `${key} is claimed by an upgrade and has no probe`).toBeTruthy();
    }
    // And nothing sits in the union unused — a key with no owner is a claim
    // nobody is making, which is how the dead ones survived.
    for (const key of Object.keys(PROBES) as SundayUpgradeEffectKey[]) {
      expect(claimed.has(key), `${key} is probed but no upgrade claims it`).toBe(true);
    }
  });

  it('every upgrade that costs money also costs upkeep to keep', () => {
    // The trade-off has to be universal, or the tree's cheap corners become
    // free again. Measured on the LEDGER rather than on `sundayWeeklyBurn`,
    // because the minibus legitimately lowers the total burn — it halves a
    // bigger travel bill than the upkeep it adds, which is the whole point of
    // buying it.
    expect(SUNDAY_UPGRADE_UPKEEP_PER_LEVEL).toBeGreaterThan(0);
    const base = {
      rng: createSundayRng(1, 0), divisionId: 'sun-4' as const, personality: 'pub' as const,
      reputation: 20, sponsors: [], playedIds: [], squad: [], redCards: 0, injuries: 0,
      chargeLeagueFee: false, ringers: 0, fixture: null,
    };
    for (const u of SUNDAY_UPGRADES) {
      const line = buildWeekLedger({ ...base, upgrades: [{ id: u.id, level: 1 }] })
        .lines.find(l => l.kind === 'upkeep');
      expect(line, u.name).toBeTruthy();
      expect(line!.amount, u.name).toBe(-SUNDAY_UPGRADE_UPKEEP_PER_LEVEL);
    }
    // And the figure the manager checks before he buys includes it.
    expect(sundayWeeklyBurn('sun-4', [{ id: 'pitch', level: 2 }]))
      .toBe(sundayWeeklyBurn('sun-4', []) + 2 * SUNDAY_UPGRADE_UPKEEP_PER_LEVEL);
  });

  for (const [key, probe] of Object.entries(PROBES) as [SundayUpgradeEffectKey, Probe][]) {
    it(`does what it says: ${key}`, async () => {
      await probe();
    }, 180_000);
  }
});
