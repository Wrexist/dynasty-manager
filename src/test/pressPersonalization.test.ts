/**
 * Press questions name the actual opponent / player / table position.
 *
 * Every question was generic ("A great result today…") no matter who you had
 * just beaten. Questions can now carry a `personalized` variant, filled from
 * facts the save knows (`buildPressQuestionVars`); a variant is used only when
 * EVERY placeholder in it has a value, so a missing fact falls back to the
 * generic line instead of leaving a hole.
 *
 * The Pro option must keep mirroring a free option's effects —
 * `pressProOptionParity.test.ts` covers the generic path; this file checks the
 * personalised path leaves every effect untouched.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  generatePressConference, resetPressConferenceMemory, loadPressQuestionBank,
  buildPressQuestionVars, personalizeQuestion, ordinal, type PressQuestionVars,
} from '@/data/pressConferences';
import { QUESTIONS } from '@/data/pressQuestionBank';
import { PRESS_SCORER_MIN_GOALS } from '@/config/gameBalance';
import { useGameStore } from '@/store/gameStore';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import type { Player, PressConference } from '@/types/game';
import { tick } from './helpers/eventLoop';

const FULL_VARS: Required<PressQuestionVars> = {
  opponent: 'Rivals FC', scorer: 'Sam Striker', scorerGoals: 9, signing: 'Nico New',
  listed: 'Lou Listed', injuredCount: 4, position: '3rd',
};

const realRandom = Math.random;
beforeAll(() => loadPressQuestionBank());
beforeEach(() => { localStorage.clear(); resetPressConferenceMemory(); });
afterEach(() => { Math.random = realRandom; });

const contexts = Object.keys(QUESTIONS) as PressConference['context'][];

describe('personalised question templates', () => {
  it('exist, differ from the generic line, and use only known facts', () => {
    const personalised = contexts.flatMap(c => QUESTIONS[c]).filter(q => q.personalized);
    expect(personalised.length).toBeGreaterThanOrEqual(15);
    for (const q of personalised) {
      expect(q.personalized).not.toBe(q.question);
      const keys = [...q.personalized!.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
      expect(keys.length, q.personalized).toBeGreaterThan(0);
      for (const k of keys) expect(Object.keys(FULL_VARS), q.personalized).toContain(k);
    }
  });

  it('every generated personalised question is fully filled', () => {
    for (const context of contexts) {
      const pool = QUESTIONS[context];
      for (let i = 0; i < pool.length; i++) {
        resetPressConferenceMemory();
        Math.random = () => (i + 0.5) / pool.length;
        const press = generatePressConference(context, true, FULL_VARS);
        if (pool[i].personalized) {
          expect(press.question).toBe(personalizeQuestion(pool[i], FULL_VARS));
          expect(press.question).not.toMatch(/[{}]/);
        } else {
          expect(press.question).toBe(pool[i].question);
        }
      }
    }
  });

  it('falls back to the generic question when a fact is missing', () => {
    const idx = QUESTIONS.new_signing.findIndex(q => q.personalized?.includes('{signing}'));
    expect(idx).toBeGreaterThanOrEqual(0);
    Math.random = () => (idx + 0.5) / QUESTIONS.new_signing.length;
    const press = generatePressConference('new_signing', false, { opponent: 'X' });
    expect(press.question).toBe(QUESTIONS.new_signing[idx].question);
  });

  it('personalising never changes an answer or its effects (Pro included)', () => {
    for (const context of contexts) {
      const pool = QUESTIONS[context];
      for (let i = 0; i < pool.length; i++) {
        Math.random = () => (i + 0.5) / pool.length;
        resetPressConferenceMemory();
        const plain = generatePressConference(context, true);
        resetPressConferenceMemory();
        const personal = generatePressConference(context, true, FULL_VARS);
        expect(personal.options).toEqual(plain.options);
      }
    }
  });

  it('remembers the question, not its wording, so a personalised repeat is still a repeat', () => {
    Math.random = () => 0;
    const first = generatePressConference('post_win', false, FULL_VARS);
    expect(first.question).toContain('Rivals FC');
    const second = generatePressConference('post_win', false, FULL_VARS);
    expect(second.question).not.toBe(first.question);
    const secondGeneric = generatePressConference('post_win', false);
    expect(secondGeneric.question).not.toBe(QUESTIONS.post_win[0].question);
  });
});

function p(over: Partial<Player>): Player {
  return {
    id: 'x', firstName: 'A', lastName: 'B', age: 25, position: 'CM', nationality: 'England',
    overall: 70, potential: 72, value: 1, wage: 1, clubId: 'me', contractEnd: 3,
    goals: 0, assists: 0, appearances: 5, careerGoals: 0, careerAssists: 0, careerAppearances: 5,
    fitness: 90, morale: 70, form: 60, injured: false, injuryWeeks: 0, yellowCards: 0, redCards: 0,
    attributes: { pace: 60, shooting: 60, passing: 60, defending: 60, physical: 60, mental: 60 },
    ...over,
  };
}

describe('buildPressQuestionVars', () => {
  const players: Record<string, Player> = {
    s: p({ id: 's', firstName: 'Sam', lastName: 'Striker', goals: PRESS_SCORER_MIN_GOALS + 2 }),
    n: p({ id: 'n', firstName: 'Nico', lastName: 'New' }),
    l: p({ id: 'l', firstName: 'Lou', lastName: 'Listed', listedForSale: true }),
    i: p({ id: 'i', injured: true, injuryWeeks: 3 }),
  };
  const base = {
    clubs: { me: { name: 'Me United', playerIds: ['s', 'n', 'l', 'i'] }, them: { name: 'Them City', playerIds: [] } },
    players,
    playerClubId: 'me',
    seasonTransfersBought: [{ playerName: 'Nico New' }, { playerName: 'Gone Already' }],
    leagueTable: [{ clubId: 'them' }, { clubId: 'x' }, { clubId: 'me' }],
  };

  it('reads the opponent, scorer, signing, listed player, injuries and position', () => {
    const vars = buildPressQuestionVars(base, { homeClubId: 'them', awayClubId: 'me' });
    expect(vars).toEqual({
      opponent: 'Them City', scorer: 'Sam Striker', scorerGoals: PRESS_SCORER_MIN_GOALS + 2,
      signing: 'Nico New', listed: 'Lou Listed', injuredCount: 1, position: '3rd',
    });
  });

  it('leaves out facts that are not true enough to say', () => {
    const quiet = {
      ...base,
      players: { ...players, s: { ...players.s, goals: PRESS_SCORER_MIN_GOALS - 1 }, i: { ...players.i, injured: false } },
      seasonTransfersBought: [{ playerName: 'Gone Already' }],
    };
    const vars = buildPressQuestionVars(quiet, null);
    expect(vars.opponent).toBeUndefined();
    expect(vars.scorer).toBeUndefined();
    expect(vars.signing).toBeUndefined();
    expect(vars.injuredCount).toBeUndefined();
  });

  it('formats ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(ordinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th', '112th']);
  });
});

describe('post-match press conference in the live game', () => {
  it('names the opponent the player just faced', { timeout: 120_000 }, async () => {
    // Seeded so the run is reproducible; `afterEach` restores Math.random.
    let seed = 12345;
    Math.random = () => {
      seed = (seed + 0x6D2B79F5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    await useGameStore.getState().initGame('manchester-city');
    const opponentVariants = new Set(
      (['post_win', 'post_loss', 'post_draw'] as const).flatMap(c => QUESTIONS[c])
        .filter(q => q.personalized && /^[^{]*\{opponent\}[^{]*$/.test(q.personalized))
        .map(q => q.question),
    );
    let checked = 0;
    for (let w = 0; w < 30 && checked === 0; w++) {
      await useGameStore.getState().advanceWeek();
      const match = useGameStore.getState().playCurrentMatch();
      await tick();
      const press = useGameStore.getState().pendingPressConference;
      if (!match || !press) continue;
      const me = useGameStore.getState().playerClubId;
      const oppId = match.homeClubId === me ? match.awayClubId : match.homeClubId;
      const oppName = useGameStore.getState().clubs[oppId].name;
      // The generic wording of an opponent-variant question must never reach
      // the player when the opponent is known.
      expect(opponentVariants.has(press.question), press.question).toBe(false);
      if (press.question.includes(oppName)) checked++;
      useGameStore.setState({ pendingPressConference: null });
    }
    expect(checked).toBeGreaterThan(0);
  });
});
