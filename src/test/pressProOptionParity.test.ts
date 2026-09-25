/**
 * Regression: the Pro press-conference answer must be flavour, not power.
 *
 * `generatePressConference(ctx, true)` adds a fourth, Pro-only answer, and
 * `respondToPress` applies its effects to squad morale (read by the match
 * engine), board confidence and fan mood. The authored Pro effects beat every
 * free answer on at least one stat in most questions — 74 of 88 gave more
 * board confidence than any free option — so paying moved sim parameters,
 * which the monetization contract forbids.
 *
 * Every question in every context is drawn deterministically (memory reset,
 * Math.random pinned to the question's slot) and, per stat, the Pro answer
 * must not exceed the best free answer to the same question.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { QUESTIONS, generatePressConference, resetPressConferenceMemory } from '@/data/pressConferences';
import type { PressConference } from '@/types/game';

const realRandom = Math.random;
afterAll(() => { Math.random = realRandom; resetPressConferenceMemory(); });

const STATS = ['morale', 'boardConfidence', 'fanMood'] as const;
const FREE_TONES = ['confident', 'humble', 'deflect'];

describe('Pro press answer never out-scores the free answers', () => {
  const contexts = Object.keys(QUESTIONS) as PressConference['context'][];

  it('covers questions that carry a Pro answer', () => {
    const withPro = contexts.flatMap(c => QUESTIONS[c]).filter(q => q.proOption).length;
    expect(withPro).toBeGreaterThan(0);
  });

  for (const context of contexts) {
    it(`${context}: per stat, Pro effect <= best free effect`, () => {
      const pool = QUESTIONS[context];
      for (let i = 0; i < pool.length; i++) {
        resetPressConferenceMemory();
        Math.random = () => (i + 0.5) / pool.length;
        const press = generatePressConference(context, true);
        expect(press.question).toBe(pool[i].question);
        if (!pool[i].proOption) continue;

        const free = press.options.filter(o => FREE_TONES.includes(o.tone));
        const pro = press.options.filter(o => !FREE_TONES.includes(o.tone));
        expect(free).toHaveLength(3);
        expect(pro).toHaveLength(1);
        for (const stat of STATS) {
          const bestFree = Math.max(...free.map(o => o.effects[stat]));
          expect(pro[0].effects[stat], `${context} #${i} ${stat}`).toBeLessThanOrEqual(bestFree);
        }
      }
    });
  }
});
