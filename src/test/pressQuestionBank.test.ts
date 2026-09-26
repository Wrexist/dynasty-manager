/**
 * The press question bank is loaded lazily.
 *
 * ~65 kB of question prose used to ride in the main chunk, which had ~34 kB of
 * headroom left under `mainChunkHardLimitBytes`. It now lives in
 * `pressQuestionBank.ts` and is dynamic-imported. These tests pin the two
 * things that keep that true and safe:
 *
 *  - no production module imports the bank's VALUES statically (a single one
 *    would pull the whole bank back into the main chunk, silently);
 *  - a conference generated before the bank has arrived still works (neutral
 *    fallback question), and one generated after comes from the bank.
 */
import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'test' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('press question bank', () => {
  it('is never imported statically for its values outside tests', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter(file => {
      const src = readFileSync(file, 'utf8');
      return src.split('\n').some(line =>
        /from ['"]@\/data\/pressQuestionBank['"]/.test(line) && !/^\s*import type\b/.test(line));
    });
    expect(offenders).toEqual([]);
  });

  it('falls back to a neutral question before the bank loads, then draws from the bank', async () => {
    vi.resetModules();
    const press = await import('@/data/pressConferences');
    const { QUESTIONS } = await import('@/data/pressQuestionBank');

    // The module schedules its own load on a timer; nothing has run yet.
    expect(press.getLoadedPressQuestionBank()).toBeNull();
    const early = press.generatePressConference('post_win', true);
    expect(early.options).toHaveLength(3);
    expect(early.hasProOption).toBe(false);
    expect(QUESTIONS.post_win.some(q => q.question === early.question)).toBe(false);

    await press.loadPressQuestionBank();
    const late = press.generatePressConference('post_win', true);
    expect(QUESTIONS.post_win.some(q => q.question === late.question)).toBe(true);
    expect(late.options).toHaveLength(4);
  });
});
