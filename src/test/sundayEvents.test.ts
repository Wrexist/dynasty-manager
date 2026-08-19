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
import {
  SUNDAY_EVENTS, fillSundayEventText, sundayChainClosingLine,
  type SundayEventContext, type SundayEventEffects, type SundayEventPerson,
} from '@/data/sundayEvents';
import {
  SUNDAY_DEPARTURE_DEFS, allSundayEventIds, cooldownWeekFor, pickSundayEvent,
  resolveSundayChoice,
} from '@/utils/sunday/events';
import { createSundayRng } from '@/utils/sunday/rng';
import {
  SUNDAY_CHAINS, SUNDAY_DEPARTURE_FLAG, SUNDAY_EVENT_COOLDOWN,
  SUNDAY_EVENT_DEPARTURE_GAP, SUNDAY_MIN_START, SUNDAY_PITCH_DAMAGE_HEAL,
  SUNDAY_PITCH_DAMAGE_MAX, SUNDAY_ROUGH_WEEK_FLAG,
} from '@/config/sundayLeague';
import { SUNDAY_HANDLED_EFFECT_KEYS } from '@/store/slices/sunday/actions';
import { sundayPitchQuality } from '@/store/slices/sunday/matchday';
import { assertSundayState, validateSundayState } from '@/utils/sunday/invariants';
import { sundaySeasonWeeks } from '@/utils/sunday/season';

const person: SundayEventPerson = {
  playerId: 'p1', firstName: 'Kev', lastName: 'Naylor', job: 'sparky',
  archetype: 'journeyman', position: 'CM', age: 27, clubApps: 12, available: true,
  happiness: 50, ego: 10, commitment: 12, temper: 10,
  influence: 10, overall: 45, benchedStreak: 0,
};
const keeper: SundayEventPerson = { ...person, playerId: 'gk1', firstName: 'Baz', position: 'GK' };
const absentee: SundayEventPerson = { ...person, playerId: 'p2', firstName: 'Gary', available: false, commitment: 4 };

const ctx: SundayEventContext = {
  season: 1, week: 8, balance: 300, reputation: 20, teamMorale: 60,
  squadSize: 15, availableCount: 12, lastResult: 0, winless: 0, winStreak: 0,
  leaguePosition: 4, leagueSize: 8, hasRival: true, rivalHeat: 5, hasSponsor: true,
  hasFixture: true,
  subsOwed: 40, weeksInDebt: 0, cupAlive: false, cupRoundsWon: 0, cupRoundName: null,
  captain: person, subject: person, unhappy: person,
  flags: {}, chains: [], playerStoryLive: false, clubStoryLive: false,
  chainData: {}, defectorName: null, hasNets: false,
};

describe('event catalogue integrity', () => {
  it('has unique ids', () => {
    // Through the accessor the catalogue exports for exactly this, so its
    // doc-comment stops being a claim nothing backs up.
    const ids = allSundayEventIds();
    expect(ids).toHaveLength(SUNDAY_EVENTS.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * Copy that presupposes a kick-off — "gone down in the warm-up", "Sunday is a
   * nine-thirty", "caked before kick-off", "the referee wants paying in cash on
   * Sunday". An event fires on the advance and is read at the start of the next
   * week, and the season has two or three weeks with no fixture at all, so any
   * definition that reads this way has to declare `ctx.hasFixture` or it will
   * describe an afternoon that is not going to happen.
   */
  const PRESUPPOSES_KICKOFF =
    /warm-up|kick-off|kick off|nine-thirty|on Sunday|before Sunday|Sunday is|Sunday's|Sunday morning|fixture off the list/i;

  /**
   * Definitions whose Sunday is in the PAST — "after Sunday, he explained…",
   * "there was a man on the touchline on Sunday". These are about a match that
   * has already been played, so a free week does not make them untrue. Every id
   * here is a deliberate exemption; anything else that reads like a kick-off
   * has to gate itself.
   */
  const RETROSPECTIVE = new Set([
    'wonderkid-spotted',  // "on Sunday he did something in the warm-up"
    'wonderkid-scouted',  // "there was a man on the touchline on Sunday"
    'hothead-row',        // "a full and frank exchange … on Sunday"
  ]);

  /**
   * TITLE AND BODY ONLY — the premise the manager is handed. Outcome text is
   * deliberately not scanned: "both of them turn up on Sunday" describes a
   * consequence playing out over the coming weeks, which a free week does not
   * make false. It is the premise that cannot be about a match that will never
   * be played.
   */
  const eventText = (def: (typeof SUNDAY_EVENTS)[number]) => `${def.title} ${def.body}`;

  it('gates every definition that presupposes a kick-off on there being one', () => {
    const ungated = SUNDAY_EVENTS
      .filter(def => !RETROSPECTIVE.has(def.id))
      .filter(def => PRESUPPOSES_KICKOFF.test(eventText(def)))
      .filter(def => !String(def.condition).includes('hasFixture'))
      .map(def => def.id);
    expect(
      ungated,
      `these describe a kick-off and can fire into a fixture-free week:\n${ungated.join('\n')}`,
    ).toEqual([]);
    // The exemption list may only name events that exist.
    const ids = new Set(SUNDAY_EVENTS.map(d => d.id));
    expect([...RETROSPECTIVE].filter(id => !ids.has(id))).toEqual([]);
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

  it('uses no effect key the resolver does not apply', () => {
    // The catalogue is data and the resolver is code, so an author can type an
    // effect nothing reads. `pitchDamage` was exactly that for two releases:
    // two choices paid for it, nothing applied it, and one of them was a no-op
    // dressed as a decision.
    const used = new Set<string>();
    for (const def of SUNDAY_EVENTS) {
      for (const choice of def.choices) {
        for (const key of Object.keys(choice.effects)) used.add(key);
        for (const key of Object.keys(choice.failEffects ?? {})) used.add(key);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    const unhandled = [...used].filter(k => !SUNDAY_HANDLED_EFFECT_KEYS.has(k as never));
    expect(unhandled, `effects nothing applies: ${unhandled.join(', ')}`).toEqual([]);
  });

  it('gives every chain beat a live step, and every chain a reachable ending', () => {
    // The three ways a chain silently breaks, all caught here:
    //   a beat declaring a step nothing can reach; a step with no beat at all
    //   (the story stalls at the deadline and gets closed as stranded); a
    //   terminal beat with a choice that does not end the chain (the story
    //   waits forever for a step past its terminal).
    for (const info of SUNDAY_CHAINS) {
      const beats = SUNDAY_EVENTS.filter(d => d.chain?.id === info.id);
      expect(beats.length, `${info.id} has no beats`).toBeGreaterThan(0);
      const openers = SUNDAY_EVENTS.filter(d =>
        d.choices.some(c => c.effects.startChain?.id === info.id || c.failEffects?.startChain?.id === info.id));
      expect(openers.length, `${info.id} can never start`).toBeGreaterThan(0);
      for (const opener of openers) {
        expect(opener.chain, `${opener.id} both starts ${info.id} and is a beat of a chain`).toBeUndefined();
      }
      // Chains open at step 2 — step 1 is the unchained opener.
      for (let step = 2; step <= info.terminalStep; step++) {
        const atStep = beats.filter(d => d.chain!.step === step);
        expect(atStep.length, `${info.id} has nothing at step ${step}`).toBeGreaterThan(0);
      }
      for (const beat of beats) {
        expect(beat.chain!.step, `${beat.id} declares step ${beat.chain!.step}`).toBeGreaterThanOrEqual(2);
        expect(beat.chain!.step).toBeLessThanOrEqual(info.terminalStep);
        const terminal = beat.chain!.step === info.terminalStep;
        for (const choice of beat.choices) {
          const branches = [choice.effects, choice.failEffects].filter(Boolean) as SundayEventEffects[];
          for (const fx of branches) {
            const moves = fx.endChain === info.id || fx.advanceChain === info.id;
            expect(moves, `${beat.id}/${choice.id} leaves ${info.id} where it was`).toBe(true);
            if (terminal) {
              expect(fx.endChain, `${beat.id}/${choice.id} is terminal but does not end ${info.id}`).toBe(info.id);
            }
          }
          // A gamble whose success branch ends the chain but whose failure
          // branch does not (or vice versa) strands the story half the time.
          if (choice.successChance) {
            expect(choice.failEffects, `${beat.id}/${choice.id} gambles with no failure effects`).toBeTruthy();
          }
        }
      }
    }
  });

  it('never starts a chain from inside another beat of the same chain', () => {
    for (const def of SUNDAY_EVENTS) {
      for (const choice of def.choices) {
        for (const fx of [choice.effects, choice.failEffects].filter(Boolean) as SundayEventEffects[]) {
          if (!fx.startChain) continue;
          expect(SUNDAY_CHAINS.some(c => c.id === fx.startChain!.id), `${def.id} starts an unknown chain`).toBe(true);
        }
        for (const fx of [choice.effects, choice.failEffects].filter(Boolean) as SundayEventEffects[]) {
          for (const id of [fx.advanceChain, fx.endChain].filter(Boolean)) {
            expect(def.chain?.id, `${def.id} moves ${id} without being one of its beats`).toBe(id);
          }
        }
      }
    }
  });

  it('closes every chain with a line that names the man it was about', () => {
    for (const info of SUNDAY_CHAINS) {
      for (const reason of ['gone', 'faded'] as const) {
        const line = sundayChainClosingLine(info.id, reason, 'Danny');
        expect(line.length, `${info.id}/${reason}`).toBeGreaterThan(10);
        expect(line).not.toMatch(/\{[a-zA-Z]+\}/);
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
  const squad = [person, keeper, absentee];
  const pick = (cooldowns: Record<string, number> = {}, week = 8, fired = new Set<string>()) =>
    pickSundayEvent({
      rng: createSundayRng(7, 0), ctx: { ...ctx, week }, subjects: squad, cooldowns, firedOnce: fired,
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
        rng: createSundayRng(i * 3 + 1, 0), ctx, subjects: squad, cooldowns, firedOnce: new Set(),
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
        subjects: [],
        cooldowns: {}, firedOnce: new Set(), week: 8, rivalName: null, clubName: 'c',
      });
      if (!ev) continue;
      const def = SUNDAY_EVENTS.find(d => d.id === ev.defId)!;
      expect(def.needsSubject ?? false).toBe(false);
    }
  });

  it('only ever puts a goalkeeper in the goalkeeper event', () => {
    // Isolate the event by cooling everything else down.
    const cooldowns = Object.fromEntries(
      SUNDAY_EVENTS.filter(d => d.id !== 'keeper-hungover').map(d => [d.id, 999]),
    );
    let fired = 0;
    for (let i = 0; i < 60; i++) {
      const ev = pickSundayEvent({
        rng: createSundayRng(i * 11 + 3, 0), ctx, subjects: squad, cooldowns,
        firedOnce: new Set(), week: 8, rivalName: null, clubName: 'c',
      });
      if (!ev) continue;
      expect(ev.defId).toBe('keeper-hungover');
      expect(ev.playerId).toBe(keeper.playerId);
      fired++;
    }
    expect(fired).toBeGreaterThan(0);
  });

  it('never offers a kick-off event in a week with no fixture', () => {
    // Two definitions isolated in turn — everything else cooled right down, the
    // context tuned so the one under test WOULD fire — with the only difference
    // being whether there is a Sunday for it to be about. Both are written
    // about the coming match: a man going down in the warm-up, and a referee
    // who wants paying in cash on Sunday.
    const cases: [string, SundayEventContext][] = [
      ['warm-up-injury', ctx],
      ['broke', { ...ctx, balance: 10 }],
    ];
    for (const [defId, tuned] of cases) {
      const cooldowns = Object.fromEntries(
        SUNDAY_EVENTS.filter(d => d.id !== defId).map(d => [d.id, 999]),
      );
      const draws = (hasFixture: boolean) => {
        const fired: string[] = [];
        for (let i = 0; i < 60; i++) {
          const ev = pickSundayEvent({
            rng: createSundayRng(i * 7 + 1, 0),
            ctx: { ...tuned, hasFixture },
            subjects: squad, cooldowns, firedOnce: new Set(),
            week: 8, rivalName: null, clubName: 'c',
          });
          if (ev) fired.push(ev.defId);
        }
        return fired;
      };
      expect(draws(false), `${defId} fired into a fixture-free week`).toEqual([]);
      expect(
        draws(true).length,
        `${defId} never fired at all — the isolation is wrong, not the gate`,
      ).toBeGreaterThan(0);
    }
  });

  it('does not fire the goalkeeper event when no keeper is available', () => {
    const cooldowns = Object.fromEntries(
      SUNDAY_EVENTS.filter(d => d.id !== 'keeper-hungover').map(d => [d.id, 999]),
    );
    for (let i = 0; i < 40; i++) {
      const ev = pickSundayEvent({
        rng: createSundayRng(i * 13 + 5, 0), ctx,
        subjects: [person, absentee, { ...keeper, available: false }],
        cooldowns, firedOnce: new Set(), week: 8, rivalName: null, clubName: 'c',
      });
      expect(ev).toBeNull();
    }
  });

  it('names somebody who will actually be there, unless the event is about an absentee', () => {
    const byId = new Map(squad.map(p => [p.playerId, p]));
    let sawSubjectEvent = false;
    for (let i = 0; i < 120; i++) {
      const ev = pickSundayEvent({
        rng: createSundayRng(i * 7 + 1, 0), ctx: { ...ctx, week: 8 }, subjects: squad,
        cooldowns: {}, firedOnce: new Set(), week: 8, rivalName: 'Dog & Duck', clubName: 'c',
      });
      if (!ev?.playerId) continue;
      const def = SUNDAY_EVENTS.find(d => d.id === ev.defId)!;
      sawSubjectEvent = true;
      const subject = byId.get(ev.playerId);
      if (subject && !def.subjectFilter && def.id !== 'captain-furious') {
        expect(subject.available, `${def.id} named ${subject.firstName}, who is away`).toBe(true);
      }
    }
    expect(sawSubjectEvent).toBe(true);
  });

  it('gives an event with no subject no player id at all', () => {
    for (let i = 0; i < 60; i++) {
      const ev = pickSundayEvent({
        rng: createSundayRng(i * 17 + 2, 0), ctx, subjects: squad,
        cooldowns: {}, firedOnce: new Set(), week: 8, rivalName: 'Dog & Duck', clubName: 'c',
      });
      if (!ev) continue;
      const def = SUNDAY_EVENTS.find(d => d.id === ev.defId)!;
      if (!def.needsSubject) expect(ev.playerId, def.id).toBeNull();
    }
  });

  it('leans away from more bad news the week after something bad, without banning it', () => {
    // MANAGED randomness, not removed. The damper multiplies the weight of
    // negative events; it must not zero them, or a bad month stops being
    // possible and the mode loses the thing it is about.
    const negatives = SUNDAY_EVENTS.filter(d => d.tone === 'negative' && !d.chain).map(d => d.id);
    const share = (flags: Record<string, number>) => {
      let bad = 0;
      let total = 0;
      for (let i = 0; i < 200; i++) {
        const ev = pickSundayEvent({
          rng: createSundayRng(i * 13 + 5, 0), ctx: { ...ctx, flags }, subjects: squad,
          cooldowns: {}, firedOnce: new Set(), week: 8, rivalName: 'Dog & Duck', clubName: 'c',
        });
        if (!ev) continue;
        total++;
        if (negatives.includes(ev.defId)) bad++;
      }
      return { bad, total };
    };
    const calm = share({});
    const rough = share({ [SUNDAY_ROUGH_WEEK_FLAG]: 8 });
    expect(calm.total).toBeGreaterThan(0);
    expect(rough.total).toBeGreaterThan(0);
    expect(rough.bad / rough.total).toBeLessThan(calm.bad / calm.total);
    // Still possible. Down-weighted, never banned.
    expect(rough.bad).toBeGreaterThan(0);
  });

  it('will not take a second player off you inside the departure gap', () => {
    const departures = [...SUNDAY_DEPARTURE_DEFS];
    expect(departures.length).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) {
      const ev = pickSundayEvent({
        rng: createSundayRng(i * 7 + 3, 0),
        ctx: { ...ctx, flags: { [SUNDAY_DEPARTURE_FLAG]: 8 } },
        subjects: squad, cooldowns: {}, firedOnce: new Set(),
        week: 8 + (i % SUNDAY_EVENT_DEPARTURE_GAP),
        rivalName: 'Dog & Duck', clubName: 'c',
      });
      if (!ev) continue;
      const def = SUNDAY_EVENTS.find(d => d.id === ev.defId)!;
      // Chain beats are exempt on purpose: a story that has started has to be
      // allowed to end, and the chain cap already rations those.
      if (def.chain) continue;
      expect(departures, `${ev.defId} fired inside the departure gap`).not.toContain(ev.defId);
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

  it('churns the pitch when the club plays on a bog, and grows it back', async () => {
    const s0 = useGameStore.getState();
    const before = sundayPitchQuality(s0.sunday!, s0.week);
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        pendingEvent: {
          defId: 'pitch-unplayable', season: s0.season, week: s0.week,
          title: 't', body: 'b', playerId: null,
          choices: [{ id: 'forks', label: 'f', hint: '' }],
          category: 'club',
        },
      },
    });
    const r = await useGameStore.getState().resolveSundayEvent('forks');
    expect(r).toBeTruthy();

    const damaged = useGameStore.getState().sunday!;
    expect(damaged.pitchDamage).toBeGreaterThan(0);
    expect(damaged.pitchDamage).toBeLessThanOrEqual(SUNDAY_PITCH_DAMAGE_MAX);
    expect(sundayPitchQuality(damaged, useGameStore.getState().week)).toBeLessThan(before);

    await useGameStore.getState().advanceWeek();
    const healed = useGameStore.getState().sunday!;
    expect(healed.pitchDamage).toBe(Math.max(0, damaged.pitchDamage - SUNDAY_PITCH_DAMAGE_HEAL));
    const s = useGameStore.getState();
    assertSundayState({
      sunday: s.sunday!, players: s.players, clubs: s.clubs,
      playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
    });
  });

  it('remembers a once-per-save event for longer than the event log does', async () => {
    // `firedOnce` used to be derived from `eventLog`, which is capped — so a
    // once-only event came round again after roughly five seasons of play.
    const s0 = useGameStore.getState();
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        onceFiredIds: ['social-media'],
        // The log has forgotten it entirely, exactly as it would after the cap
        // rolled over.
        eventLog: [],
      },
    });
    for (let i = 0; i < 20; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) {
        expect(s.sunday!.pendingEvent.defId).not.toBe('social-media');
        await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      }
      if (useGameStore.getState().sunday!.seasonComplete || useGameStore.getState().sunday!.folded) break;
      await useGameStore.getState().advanceWeek();
    }
    expect(useGameStore.getState().sunday!.onceFiredIds).toContain('social-media');
  });

  it('registers a once-per-save event the moment it fires', async () => {
    const s0 = useGameStore.getState();
    // Cool everything else down so the only thing that can fire is the once-only.
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        eventCooldowns: Object.fromEntries(
          SUNDAY_EVENTS.filter(d => !d.once).map(d => [d.id, 999]),
        ),
      },
    });
    for (let i = 0; i < 20 && !useGameStore.getState().sunday!.pendingEvent; i++) {
      if (useGameStore.getState().sunday!.seasonComplete) break;
      await useGameStore.getState().advanceWeek();
    }
    const pending = useGameStore.getState().sunday!.pendingEvent;
    if (!pending) return;
    expect(useGameStore.getState().sunday!.onceFiredIds).toContain(pending.defId);
  });

  it('does not roll an event on the advance that ends the season', async () => {
    const s0 = useGameStore.getState();
    const total = sundaySeasonWeeks(s0.sunday!.divisionId);
    useGameStore.setState({ week: total, sunday: { ...s0.sunday!, pendingEvent: null } });
    await useGameStore.getState().advanceWeek();
    const after = useGameStore.getState().sunday!;
    expect(after.seasonComplete).toBe(true);
    // An event rolled here would be silently discarded by the rollover.
    expect(after.pendingEvent).toBeNull();
  });

  it('does not leave a folded club holding a raffle', async () => {
    const s0 = useGameStore.getState();
    useGameStore.setState({
      sunday: { ...s0.sunday!, balance: -5000, pendingEvent: null },
    });
    await useGameStore.getState().advanceWeek();
    const after = useGameStore.getState().sunday!;
    expect(after.folded).toBe(true);
    expect(after.pendingEvent).toBeNull();
  });

  it('takes a departing player\'s story with him', async () => {
    const s0 = useGameStore.getState();
    const victim = s0.sunday!.squad.find(m => m.availability.status !== 'out')!;
    useGameStore.setState({
      sunday: {
        ...s0.sunday!,
        chains: [{
          id: 'rival-defection', step: 2, subjectId: victim.playerId,
          startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week + 4, data: {},
        }],
        pendingEvent: {
          defId: 'rival-bid', season: s0.season, week: s0.week,
          title: 't', body: 'b', playerId: victim.playerId,
          choices: [{ id: 'release', label: 'r', hint: '' }],
          category: 'rivalry',
        },
      },
    });
    await useGameStore.getState().resolveSundayEvent('release');
    const after = useGameStore.getState();
    expect(after.sunday!.squad.some(m => m.playerId === victim.playerId)).toBe(false);
    // The old flag used to survive him, blocking the chain for six weeks and
    // pointing the story at somebody who no longer existed.
    expect(after.sunday!.chains).toHaveLength(0);
    expect(Object.keys(after.sunday!.flags).some(f => f.includes(victim.playerId))).toBe(false);
    assertSundayState({
      sunday: after.sunday!, players: after.players, clubs: after.clubs,
      playerClubId: after.playerClubId, fixtures: after.fixtures, week: after.week,
    });
  });

  it('takes a released player\'s chain flags with him too', async () => {
    const s0 = useGameStore.getState();
    const victim = s0.sunday!.squad[0];
    useGameStore.setState({
      sunday: { ...s0.sunday!, flags: { [`wants-out:${victim.playerId}`]: s0.week } },
    });
    const r = await useGameStore.getState().releaseSundayPlayer(victim.playerId);
    expect(r.ok).toBe(true);
    expect(Object.keys(useGameStore.getState().sunday!.flags)).toEqual([]);
    const s = useGameStore.getState();
    assertSundayState({
      sunday: s.sunday!, players: s.players, clubs: s.clubs,
      playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
    });
  });

  it('is caught by the validator when a flag names a ghost', () => {
    const s = useGameStore.getState();
    const result = validateSundayState({
      sunday: { ...s.sunday!, flags: { 'wants-out:sun-p-sunday-club-999': 1 } },
      players: s.players, clubs: s.clubs, playerClubId: s.playerClubId,
      fixtures: s.fixtures, week: s.week,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('not in the squad');
  });

  it('does not let one event become the season', async () => {
    // MEASURED, not asserted from the config. `new-face` and `thin-squad` both
    // sat at a short cooldown and a heavy weight, and a season produced four to
    // six of each — at which point the touchline bloke asking for a game stops
    // being a moment and becomes a menu item. Play a season out and count.
    const total = sundaySeasonWeeks(useGameStore.getState().sunday!.divisionId);
    for (let i = 0; i < total + 2; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.folded || s.sunday!.seasonComplete) break;
      if (s.sunday!.pendingEvent) {
        await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      }
      await useGameStore.getState().advanceWeek();
    }
    const counts = new Map<string, number>();
    for (const entry of useGameStore.getState().sunday!.eventLog) {
      counts.set(entry.defId, (counts.get(entry.defId) ?? 0) + 1);
    }
    for (const [defId, n] of counts) {
      expect(n, `${defId} fired ${n} times in one season`).toBeLessThanOrEqual(3);
    }
  });

  it('takes a man an event has sidelined off the named side and out of the morning', async () => {
    // `warm-up-injury` has a real choice now, and both of its branches can end
    // with him unavailable. A teamsheet naming an unavailable player and an
    // arrival presenting one are both invariant violations — and a starting XI
    // containing somebody the match cannot field.
    const s0 = useGameStore.getState();
    const victim = s0.sunday!.squad.find(m => m.availability.status === 'available')!;
    await useGameStore.getState().autoPickSundayTeamsheet();
    const named = useGameStore.getState().sunday!;
    if (!named.teamsheet.includes(victim.playerId) && !named.bench.includes(victim.playerId)) {
      await useGameStore.getState().setSundayTeamsheet(
        [victim.playerId, ...named.teamsheet.filter(id => id !== victim.playerId)].slice(0, 11),
        named.bench.filter(id => id !== victim.playerId),
      );
    }
    await useGameStore.getState().arriveSundayMatch();

    useGameStore.setState({
      sunday: {
        ...useGameStore.getState().sunday!,
        pendingEvent: {
          defId: 'warm-up-injury', season: s0.season, week: useGameStore.getState().week,
          title: 't', body: 'b', playerId: victim.playerId,
          choices: [{ id: 'stand-down', label: 's', hint: '' }],
          category: 'player',
        },
      },
    });
    await useGameStore.getState().resolveSundayEvent('stand-down');

    const after = useGameStore.getState();
    const member = after.sunday!.squad.find(m => m.playerId === victim.playerId)!;
    expect(member.availability.status).toBe('out');
    expect(after.sunday!.teamsheet).not.toContain(victim.playerId);
    expect(after.sunday!.bench).not.toContain(victim.playerId);
    expect(after.sunday!.arrival?.presentIds ?? []).not.toContain(victim.playerId);
    assertSundayState({
      sunday: after.sunday!, players: after.players, clubs: after.clubs,
      playerClubId: after.playerClubId, fixtures: after.fixtures, week: after.week,
    });
  });

  it('arranges cover when sidelining a man drops the morning below a side', async () => {
    // The forfeit-by-accident case. Name exactly the legal minimum, let them
    // all turn up, then have an event take one out: the morning is a man short
    // of a fixture and nothing had recomputed the emergency guest, so a
    // playable afternoon quietly became a forfeit.
    const s0 = useGameStore.getState();
    const available = s0.sunday!.squad
      .filter(m => m.availability.status === 'available').map(m => m.playerId);
    expect(available.length).toBeGreaterThanOrEqual(SUNDAY_MIN_START);
    const named = available.slice(0, SUNDAY_MIN_START);
    await useGameStore.getState().setSundayTeamsheet(named, []);

    const arrival = await useGameStore.getState().arriveSundayMatch();
    if (!arrival || arrival.presentIds.length !== SUNDAY_MIN_START) return; // somebody cried off — not this case
    expect(arrival.forcedRingers).toBe(0);

    useGameStore.setState({
      sunday: {
        ...useGameStore.getState().sunday!,
        pendingEvent: {
          defId: 'warm-up-injury',
          season: useGameStore.getState().season,
          week: useGameStore.getState().week,
          title: 't', body: 'b', playerId: arrival.presentIds[0],
          choices: [{ id: 'stand-down', label: 's', hint: '' }],
          category: 'player',
        },
      },
    });
    await useGameStore.getState().resolveSundayEvent('stand-down');

    const after = useGameStore.getState().sunday!.arrival!;
    expect(after.presentIds).toHaveLength(SUNDAY_MIN_START - 1);
    expect(after.forcedRingers).toBe(1);

    const report = (await useGameStore.getState().playSundayMatch())!;
    expect(report.forfeited).toBe(false);
    expect(report.startedWith).toBeGreaterThanOrEqual(SUNDAY_MIN_START);
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
