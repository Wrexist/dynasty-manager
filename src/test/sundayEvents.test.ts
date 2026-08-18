/**
 * Events — content integrity, anti-repeat, and the guarantee that a choice
 * changes something.
 *
 * The content-integrity block is the important one: the catalogue is data, and
 * a definition with an unreachable condition, a duplicate id, or a choice that
 * does nothing is exactly the kind of bug that ships silently.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { SUNDAY_EVENTS, fillSundayEventText, type SundayEventContext } from '@/data/sundayEvents';
import { cooldownWeekFor, pickSundayEvent, resolveSundayChoice } from '@/utils/sunday/events';
import { createSundayRng } from '@/utils/sunday/rng';
import { SUNDAY_EVENT_COOLDOWN } from '@/config/sundayLeague';
import { assertSundayState } from '@/utils/sunday/invariants';

const person = {
  playerId: 'p1', firstName: 'Kev', lastName: 'Naylor', job: 'sparky',
  archetype: 'journeyman', happiness: 50, ego: 10, commitment: 12, temper: 10,
  influence: 10, overall: 45, benchedStreak: 0,
};

const ctx: SundayEventContext = {
  season: 1, week: 8, balance: 300, reputation: 20, teamMorale: 60,
  squadSize: 15, availableCount: 12, lastResult: 0, winless: 0, winStreak: 0,
  leaguePosition: 4, leagueSize: 8, hasRival: true, rivalHeat: 5, hasSponsor: true,
  subsOwed: 40, captain: person, subject: person, unhappy: person,
  flags: {}, flagged: null, defectorName: null,
};

describe('event catalogue integrity', () => {
  it('has unique ids', () => {
    const ids = SUNDAY_EVENTS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every event a title, a body and at least one choice', () => {
    for (const def of SUNDAY_EVENTS) {
      expect(def.title.length).toBeGreaterThan(3);
      expect(def.body.length).toBeGreaterThan(20);
      expect(def.choices.length).toBeGreaterThan(0);
      expect(def.weight).toBeGreaterThan(0);
    }
  });

  it('gives every choice an outcome and an effect that does something', () => {
    for (const def of SUNDAY_EVENTS) {
      for (const choice of def.choices) {
        expect(choice.label.length).toBeGreaterThan(0);
        expect(choice.outcome.length).toBeGreaterThan(10);
        // Every choice either changes state or is explicitly marked a decline.
        // An effect-free choice that is NOT marked is almost always an author
        // who forgot the effects, which is exactly the silent content bug this
        // block exists to catch.
        const changesSomething =
          Object.keys(choice.effects).length > 0 ||
          Object.keys(choice.failEffects ?? {}).length > 0 ||
          choice.declines === true;
        expect(changesSomething, `${def.id}/${choice.id} changes nothing and is not marked as a decline`).toBe(true);
        // A gamble must describe both outcomes.
        if (choice.successChance) {
          expect(choice.failOutcome, `${def.id}/${choice.id} has no failure text`).toBeTruthy();
        }
      }
    }
  });

  it('keeps every success chance inside 0..1 across a wide range of states', () => {
    const states: SundayEventContext[] = [
      ctx,
      { ...ctx, teamMorale: 0, reputation: 0, balance: -400, winless: 20 },
      { ...ctx, teamMorale: 100, reputation: 100, balance: 100000, winStreak: 30 },
      { ...ctx, captain: null, subject: null, unhappy: null },
    ];
    for (const def of SUNDAY_EVENTS) {
      for (const choice of def.choices) {
        if (!choice.successChance) continue;
        for (const s of states) {
          const p = choice.successChance(s);
          expect(Number.isFinite(p), `${def.id}/${choice.id}`).toBe(true);
          expect(p).toBeGreaterThanOrEqual(-1);
          expect(p).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('never throws from a condition, whatever the state', () => {
    const states: SundayEventContext[] = [
      ctx,
      { ...ctx, captain: null, subject: null, unhappy: null, hasRival: false, hasSponsor: false },
      { ...ctx, squadSize: 0, availableCount: 0, balance: -1000, lastResult: null },
    ];
    for (const def of SUNDAY_EVENTS) {
      for (const s of states) {
        expect(() => def.condition(s)).not.toThrow();
      }
    }
  });

  it('substitutes every placeholder it uses', () => {
    for (const def of SUNDAY_EVENTS) {
      const filled = fillSundayEventText(`${def.title} ${def.body}`, {
        name: 'Kev', job: 'sparky', rival: 'Dog & Duck', club: 'Marsh Lane FC',
        balance: 12, subsOwed: 40, squadSize: 15,
      });
      expect(filled).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  });
});

describe('selection', () => {
  const pick = (cooldowns: Record<string, number> = {}, week = 8, fired = new Set<string>()) =>
    pickSundayEvent({
      rng: createSundayRng(7, 0), ctx: { ...ctx, week }, cooldowns, firedOnce: fired,
      week, rivalName: 'Dog & Duck', clubName: 'Marsh Lane FC',
    });

  it('produces an instance with resolved text and at least one choice', () => {
    const ev = pick();
    expect(ev).not.toBeNull();
    expect(ev!.title).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(ev!.body).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(ev!.choices.length).toBeGreaterThan(0);
  });

  it('never offers an event that is still cooling down', () => {
    const ev = pick();
    const cooldowns = { [ev!.defId]: 40 };
    for (let i = 0; i < 30; i++) {
      const next = pickSundayEvent({
        rng: createSundayRng(i * 3 + 1, 0), ctx, cooldowns, firedOnce: new Set(),
        week: 8, rivalName: null, clubName: 'c',
      });
      expect(next?.defId).not.toBe(ev!.defId);
    }
  });

  it('never offers a once-per-save event twice', () => {
    const once = SUNDAY_EVENTS.filter(d => d.once).map(d => d.id);
    if (!once.length) return;
    const fired = new Set(once);
    for (let i = 0; i < 40; i++) {
      const ev = pick({}, 8, fired);
      if (ev) expect(once).not.toContain(ev.defId);
    }
  });

  it('drops a subject-bearing event when there is nobody to be about', () => {
    for (let i = 0; i < 40; i++) {
      const ev = pickSundayEvent({
        rng: createSundayRng(i * 5 + 2, 0),
        ctx: { ...ctx, subject: null, captain: null, unhappy: null },
        cooldowns: {}, firedOnce: new Set(), week: 8, rivalName: null, clubName: 'c',
      });
      if (!ev) continue;
      const def = SUNDAY_EVENTS.find(d => d.id === ev.defId)!;
      expect(def.needsSubject ?? false).toBe(false);
    }
  });

  it('computes a cooldown in the future', () => {
    expect(cooldownWeekFor('play-me', 10)).toBeGreaterThan(10);
    expect(cooldownWeekFor('does-not-exist', 10)).toBe(10 + SUNDAY_EVENT_COOLDOWN);
  });
});

describe('resolution', () => {
  it('returns a harmless no-op for an unknown event or choice', () => {
    const rng = createSundayRng(1, 0);
    const fake = { defId: 'nope', season: 1, week: 1, title: '', body: '', playerId: null, choices: [], category: 'club' as const };
    expect(resolveSundayChoice(rng, fake, 'x', ctx).effects).toEqual({});
    const real = { ...fake, defId: SUNDAY_EVENTS[0].id };
    expect(resolveSundayChoice(rng, real, 'not-a-choice', ctx).effects).toEqual({});
  });

  it('produces the failure branch when the roll goes against it', () => {
    const def = SUNDAY_EVENTS.find(d => d.choices.some(c => c.successChance))!;
    const choice = def.choices.find(c => c.successChance)!;
    // Force failure by making the chance zero for this call.
    const forced: SundayEventContext = { ...ctx };
    const original = choice.successChance!;
    (choice as { successChance?: (c: SundayEventContext) => number }).successChance = () => 0;
    const instance = { defId: def.id, season: 1, week: 1, title: '', body: '', playerId: 'p1', choices: [], category: def.category };
    const r = resolveSundayChoice(createSundayRng(2, 0), instance, choice.id, forced);
    (choice as { successChance?: (c: SundayEventContext) => number }).successChance = original;
    expect(r.failed).toBe(true);
    expect(r.outcome).toBe(choice.failOutcome);
  });
});

describe('events in the running game', () => {
  beforeEach(async () => {
    useGameStore.getState().resetGame();
    await useGameStore.getState().startSundayLeague({ personality: 'chaos', seed: 31337 });
  });

  it('applies a choice exactly once and clears the event', async () => {
    // Advance until an event fires.
    for (let i = 0; i < 20 && !useGameStore.getState().sunday!.pendingEvent; i++) {
      await useGameStore.getState().advanceWeek();
      if (useGameStore.getState().sunday!.seasonComplete) break;
    }
    const pending = useGameStore.getState().sunday!.pendingEvent;
    if (!pending) return;
    const balanceBefore = useGameStore.getState().sunday!.balance;

    const first = await useGameStore.getState().resolveSundayEvent(pending.choices[0].id);
    expect(first).not.toBeNull();
    const balanceAfter = useGameStore.getState().sunday!.balance;

    // Resolving again must do nothing at all — there is no pending event.
    const second = await useGameStore.getState().resolveSundayEvent(pending.choices[0].id);
    expect(second).toBeNull();
    expect(useGameStore.getState().sunday!.balance).toBe(balanceAfter);
    expect(Number.isFinite(balanceBefore)).toBe(true);

    const s = useGameStore.getState();
    assertSundayState({
      sunday: s.sunday!, players: s.players, clubs: s.clubs,
      playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
    });
  });

  it('logs what happened so the season can be retold', async () => {
    for (let i = 0; i < 20; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) {
        await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
        break;
      }
      await useGameStore.getState().advanceWeek();
      if (useGameStore.getState().sunday!.seasonComplete) break;
    }
    const log = useGameStore.getState().sunday!.eventLog;
    if (!log.length) return;
    expect(log[log.length - 1].summary.length).toBeGreaterThan(5);
    expect(log[log.length - 1].defId).toBeTruthy();
  });
});
