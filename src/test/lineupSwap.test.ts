/**
 * The tactics board's swap rule. A swap is an exchange — each player lands
 * exactly where the other was — so neither list ever changes length and a
 * normal swap can never bump an unrelated sub to the reserves.
 */
import { describe, it, expect } from 'vitest';
import { applyLineupSwap, emptySlotId } from '@/utils/lineupSwap';

const XI = ['gk', 'lb', 'cb1', 'cb2', 'rb', 'lm', 'cm1', 'cm2', 'rm', 'st1', 'st2'];
const SUBS = ['s1', 's2', 's3'];
const state = () => ({ lineup: [...XI], subs: [...SUBS] });

describe('applyLineupSwap', () => {
  it('exchanges two starters and touches nobody else', () => {
    const r = applyLineupSwap(state(), 'lb', 'st1')!;
    expect(r.lineup[1]).toBe('st1');
    expect(r.lineup[9]).toBe('lb');
    expect(r.subs).toEqual(SUBS);
  });

  it('puts a starter swapped with a sub in THAT sub\'s bench spot, in either tap order', () => {
    for (const [a, b] of [['rb', 's2'], ['s2', 'rb']]) {
      const r = applyLineupSwap(state(), a, b)!;
      expect(r.lineup[4]).toBe('s2');
      expect(r.subs).toEqual(['s1', 'rb', 's3']);
    }
  });

  it('never lengthens a full bench: a starter swapped with a reserve becomes the reserve', () => {
    const r = applyLineupSwap(state(), 'reserve', 'cm1')!;
    expect(r.lineup[6]).toBe('reserve');
    expect(r.subs).toEqual(SUBS);
    expect(r.lineup).not.toContain('cm1');
    expect(r.subs).not.toContain('cm1');
  });

  it('exchanges two subs, and a sub with a reserve', () => {
    expect(applyLineupSwap(state(), 's1', 's3')!.subs).toEqual(['s3', 's2', 's1']);
    expect(applyLineupSwap(state(), 's2', 'reserve')!.subs).toEqual(['s1', 'reserve', 's3']);
  });

  it('moves a starter into an empty slot and leaves a hole behind', () => {
    const s = state();
    s.lineup[10] = '';
    const r = applyLineupSwap(s, 'st1', emptySlotId(10))!;
    expect(r.lineup[10]).toBe('st1');
    expect(r.lineup[9]).toBe('');
  });

  it('fills an empty slot from the bench, and the bench just gets shorter', () => {
    const s = state();
    s.lineup[10] = '';
    const r = applyLineupSwap(s, 's2', emptySlotId(10))!;
    expect(r.lineup[10]).toBe('s2');
    expect(r.subs).toEqual(['s1', 's3']);
  });

  it('has nothing to do for the same player, two reserves, or an empty slot as the mover', () => {
    expect(applyLineupSwap(state(), 'cb1', 'cb1')).toBeNull();
    expect(applyLineupSwap(state(), 'res1', 'res2')).toBeNull();
    expect(applyLineupSwap(state(), emptySlotId(3), 'cb1')).toBeNull();
  });

  it('never mutates its input', () => {
    const s = state();
    applyLineupSwap(s, 'rb', 's2');
    expect(s).toEqual(state());
  });
});
