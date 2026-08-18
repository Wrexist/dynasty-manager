/**
 * Availability — the mode's defining system.
 *
 * These assertions encode the two design rules the system exists to satisfy:
 * it must be driven by attributes the manager can see, and it must never
 * silently override a hard fact (an injury, a suspension, a holiday already in
 * progress).
 */
import { describe, it, expect } from 'vitest';
import {
  AVAILABLE, isAbsenceKnown, resolveDoubt, ringRoundChance, rollSundayAvailability,
  summariseAvailability, sundayAvailabilityChance, tickAbsence,
} from '@/utils/sunday/availability';
import { createSundayRng } from '@/utils/sunday/rng';
import { generateSundayPlayer } from '@/utils/sunday/generation';
import { SUNDAY_AVAIL_MAX, SUNDAY_AVAIL_MIN } from '@/config/sundayLeague';
import type { Player, SundaySquadMember } from '@/types/game';

const ctx = { away: false, bigGame: false, hasMinibus: false, freeWeek: false };

function make(overrides: Partial<SundaySquadMember> = {}): { member: SundaySquadMember; player: Player } {
  const rng = createSundayRng(11, 0);
  const { player, member } = generateSundayPlayer({
    rng, id: 'p1', clubId: 'c', position: 'CM', quality: 44,
    ageMin: 25, ageMax: 25, season: 1, personality: 'pub', archetype: 'journeyman',
  });
  return { player, member: { ...member, ...overrides } };
}

describe('availability chance', () => {
  it('rises with commitment and is bounded at both ends', () => {
    const low = sundayAvailabilityChance(make({ commitment: 1, happiness: 0, benchedStreak: 20 }).member, ctx);
    const high = sundayAvailabilityChance(make({ commitment: 20, happiness: 100, benchedStreak: 0 }).member, ctx);
    expect(low).toBeGreaterThanOrEqual(SUNDAY_AVAIL_MIN);
    expect(high).toBeLessThanOrEqual(SUNDAY_AVAIL_MAX);
    expect(high).toBeGreaterThan(low);
  });

  it('penalises a player who keeps being left out', () => {
    const base = make({ commitment: 12, benchedStreak: 0 }).member;
    const benched = { ...base, benchedStreak: 5 };
    expect(sundayAvailabilityChance(benched, ctx)).toBeLessThan(sundayAvailabilityChance(base, ctx));
  });

  it('gets more people out for a big game and fewer for an away trip', () => {
    const m = make({ commitment: 12 }).member;
    expect(sundayAvailabilityChance(m, { ...ctx, bigGame: true })).toBeGreaterThan(sundayAvailabilityChance(m, ctx));
    expect(sundayAvailabilityChance(m, { ...ctx, away: true })).toBeLessThan(sundayAvailabilityChance(m, ctx));
    // A minibus buys the away penalty back.
    expect(sundayAvailabilityChance(m, { ...ctx, away: true, hasMinibus: true }))
      .toBe(sundayAvailabilityChance(m, ctx));
  });
});

describe('rolling availability', () => {
  it('always reports an injured player as out, whatever his commitment', () => {
    const { player, member } = make({ commitment: 20 });
    const injured = { ...player, injured: true, injuryWeeks: 3 };
    for (let i = 0; i < 30; i++) {
      const a = rollSundayAvailability(createSundayRng(i, 0), member, injured, ctx, 5);
      expect(a.status).toBe('out');
      expect(a.reason).toBe('injury');
      expect(a.warned).toBe(true);
    }
  });

  it('always reports a suspended player as out', () => {
    const { player, member } = make({ commitment: 20 });
    const banned = { ...player, suspendedUntilWeek: 9 };
    const a = rollSundayAvailability(createSundayRng(3, 0), member, banned, ctx, 5);
    expect(a.status).toBe('out');
    expect(a.reason).toBe('suspended');
    expect(a.weeksRemaining).toBe(4);
  });

  it('never re-rolls a multi-week absence already in progress', () => {
    const { player, member } = make();
    const onHoliday: SundaySquadMember = {
      ...member,
      availability: { status: 'out', reason: 'holiday', note: 'in Tenerife', warned: true, weeksRemaining: 2 },
    };
    const a = rollSundayAvailability(createSundayRng(7, 0), onHoliday, player, ctx, 4);
    expect(a).toEqual(onHoliday.availability);
  });

  it('makes everyone available on a week with no fixture', () => {
    const { player, member } = make({ commitment: 1 });
    const a = rollSundayAvailability(createSundayRng(2, 0), member, player, { ...ctx, freeWeek: true }, 3);
    expect(a.status).toBe('available');
  });

  it('never produces an out player with no reason', () => {
    const { player, member } = make({ commitment: 6, punctuality: 5 });
    for (let i = 0; i < 200; i++) {
      const a = rollSundayAvailability(createSundayRng(i * 31 + 1, 0), member, player, ctx, 3);
      if (a.status !== 'available') expect(a.reason).not.toBeNull();
      else expect(a.reason).toBeNull();
    }
  });

  it('makes a no-show unannounced by definition', () => {
    const { player, member } = make({ commitment: 4, punctuality: 2 });
    let sawNoShow = false;
    for (let i = 0; i < 400; i++) {
      const a = rollSundayAvailability(createSundayRng(i * 17 + 5, 0), member, player, ctx, 3);
      if (a.reason === 'no-show') {
        sawNoShow = true;
        expect(a.warned).toBe(false);
        expect(isAbsenceKnown(a)).toBe(false);
      }
    }
    expect(sawNoShow).toBe(true);
  });

  it('gives a punctual player warning far more often than an unreliable one', () => {
    const punctual = make({ commitment: 6, punctuality: 20 }).member;
    const flaky = make({ commitment: 6, punctuality: 1 }).member;
    const { player } = make();
    const share = (m: SundaySquadMember) => {
      let absences = 0;
      let warned = 0;
      for (let i = 0; i < 500; i++) {
        const a = rollSundayAvailability(createSundayRng(i * 13 + 3, 0), m, player, ctx, 3);
        if (a.status === 'available') continue;
        absences++;
        if (a.warned) warned++;
      }
      return absences ? warned / absences : 0;
    };
    expect(share(punctual)).toBeGreaterThan(share(flaky) + 0.15);
  });
});

describe('absence bookkeeping', () => {
  it('ticks a multi-week absence down and then clears it', () => {
    const three = { status: 'out' as const, reason: 'holiday' as const, note: null, warned: true, weeksRemaining: 3 };
    const two = tickAbsence(three);
    expect(two.weeksRemaining).toBe(2);
    expect(tickAbsence({ ...two, weeksRemaining: 1 })).toEqual(AVAILABLE);
  });

  it('resolves a doubt one way or the other, never leaving it a doubt', () => {
    const doubt = { status: 'doubt' as const, reason: 'work' as const, note: 'on nights', warned: true, weeksRemaining: 0 };
    for (let i = 0; i < 50; i++) {
      const r = resolveDoubt(createSundayRng(i, 0), doubt);
      expect(r.status === 'available' || r.status === 'out').toBe(true);
    }
  });

  it('cannot talk round the injured, the banned or the abroad', () => {
    for (const reason of ['injury', 'suspended', 'holiday'] as const) {
      const m = make().member;
      m.availability = { status: 'out', reason, note: null, warned: true, weeksRemaining: 2 };
      expect(ringRoundChance(m)).toBe(0);
    }
  });

  it('summarises a squad without double-counting', () => {
    const base = make().member;
    const squad: SundaySquadMember[] = [
      { ...base, playerId: 'a', availability: AVAILABLE },
      { ...base, playerId: 'b', availability: { status: 'doubt', reason: 'work', note: null, warned: true, weeksRemaining: 0 } },
      { ...base, playerId: 'c', availability: { status: 'out', reason: 'work', note: null, warned: true, weeksRemaining: 0 } },
      { ...base, playerId: 'd', availability: { status: 'out', reason: 'no-show', note: null, warned: false, weeksRemaining: 0 } },
    ];
    const s = summariseAvailability(squad);
    expect(s.available).toBe(1);
    expect(s.doubts).toBe(1);
    expect(s.out).toBe(2);
    expect(s.knownOut).toBe(1);
  });
});
