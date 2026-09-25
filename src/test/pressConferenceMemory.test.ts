/**
 * Press "recently asked" memory survives a cold launch.
 *
 * The ring buffer that keeps the same question from coming back lived in
 * module memory, so every launch started from nothing — and the first press
 * conference of a session could repeat the last one of the previous session.
 * It is now mirrored to device storage (STORAGE_KEYS.PRESS_RECENT_QUESTIONS),
 * bounded, and read back on first use.
 *
 * "Cold launch" is simulated with `vi.resetModules()`: a fresh copy of the
 * module has an empty in-memory buffer, exactly like a relaunch, while
 * localStorage (the device) is kept.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { STORAGE_KEYS, readPressRecentQuestions, writePressRecentQuestions } from '@/store/helpers/persistence';
import { QUESTIONS } from '@/data/pressQuestionBank';

async function freshModule() {
  vi.resetModules();
  const mod = await import('@/data/pressConferences');
  await mod.loadPressQuestionBank();
  return mod;
}

const realRandom = Math.random;
beforeEach(() => { localStorage.clear(); });
afterEach(() => { Math.random = realRandom; });

describe('press recency memory', () => {
  it('does not repeat the last question after a relaunch', async () => {
    Math.random = () => 0; // pick() takes the first eligible question
    const first = (await freshModule()).generatePressConference('post_win');
    expect(first.question).toBe(QUESTIONS.post_win[0].question);

    // Relaunch: new module instance, same device storage.
    const second = (await freshModule()).generatePressConference('post_win');
    expect(second.question).not.toBe(first.question);
    expect(second.question).toBe(QUESTIONS.post_win[1].question);
  });

  it('stores short hashes, bounded per context, not question prose', async () => {
    const mod = await freshModule();
    for (let i = 0; i < 40; i++) {
      mod.generatePressConference('post_win');
      mod.generatePressConference('post_loss');
      mod.generatePressConference('injury_crisis');
    }
    const raw = localStorage.getItem(STORAGE_KEYS.PRESS_RECENT_QUESTIONS)!;
    expect(raw.length).toBeLessThan(400);
    const stored = JSON.parse(raw) as Record<string, string[]>;
    for (const list of Object.values(stored)) {
      expect(list.length).toBeLessThanOrEqual(mod.PRESS_RECENT_MEMORY);
      for (const id of list) expect(id.length).toBeLessThanOrEqual(16);
    }
    expect(raw).not.toContain('great result');
  });

  it('reset clears the stored record too', async () => {
    const mod = await freshModule();
    mod.generatePressConference('post_draw');
    expect(localStorage.getItem(STORAGE_KEYS.PRESS_RECENT_QUESTIONS)).not.toBeNull();
    mod.resetPressConferenceMemory();
    expect(localStorage.getItem(STORAGE_KEYS.PRESS_RECENT_QUESTIONS)).toBeNull();
  });

  it('treats a corrupt or oversized record as bounded data, never a crash', async () => {
    localStorage.setItem(STORAGE_KEYS.PRESS_RECENT_QUESTIONS, '{not json');
    expect(readPressRecentQuestions()).toEqual({});

    localStorage.setItem(STORAGE_KEYS.PRESS_RECENT_QUESTIONS, JSON.stringify({
      post_win: ['a', 7, null, 'x'.repeat(200), ...Array.from({ length: 50 }, (_, i) => `k${i}`)],
      post_loss: 'nope',
    }));
    const read = readPressRecentQuestions();
    expect(read.post_win.length).toBeLessThanOrEqual(8);
    expect(read.post_win.every(k => typeof k === 'string' && k.length <= 16)).toBe(true);
    expect(read.post_loss).toBeUndefined();

    writePressRecentQuestions({ post_win: Array.from({ length: 30 }, (_, i) => `k${i}`) });
    expect(readPressRecentQuestions().post_win.length).toBeLessThanOrEqual(8);

    const mod = await freshModule();
    expect(() => mod.generatePressConference('post_win')).not.toThrow();
  });
});
