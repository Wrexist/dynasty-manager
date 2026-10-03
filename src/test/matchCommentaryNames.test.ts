/**
 * Filler commentary names the players actually on the pitch: the side in
 * possession for {mid}/{wide}/{fwd}…, the defending side for {oppDef}/{oppGk};
 * a line whose roles a side cannot fill falls back to a team line; no
 * placeholder ever reaches the screen.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { commentaryCast, generateCommentary, type CommentaryCast } from '@/utils/matchCommentary';
import type { Player } from '@/types/game';

const realRandom = Math.random;
afterEach(() => { Math.random = realRandom; });

function seeded(seed: number) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

const home: CommentaryCast = { gk: ['Raya'], def: ['Saliba', 'Gabriel'], mid: ['Rice', 'Odegaard'], wide: ['Saka', 'Martinelli'], fwd: ['Gyokeres'] };
const away: CommentaryCast = { gk: ['Ederson'], def: ['Dias', 'Stones'], mid: ['Rodri', 'Foden'], wide: ['Doku'], fwd: ['Haaland'] };
const HOME_NAMES = Object.values(home).flat();
const AWAY_NAMES = Object.values(away).flat();

function lines(n: number, isHome: boolean, cast = { home, away }) {
  Math.random = seeded(7);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(generateCommentary(20 + (i % 15), 'ARS', 'MCI', 0, 0, isHome, 0, undefined, undefined, 0, [], cast));
  }
  return out;
}

describe('player-named commentary', () => {
  it('names players most of the time, never leaves a placeholder', () => {
    const out = lines(300, true);
    expect(out.every(l => !/\{\w+\}/.test(l))).toBe(true);
    const named = out.filter(l => [...HOME_NAMES, ...AWAY_NAMES].some(n => l.includes(n)));
    expect(named.length / out.length).toBeGreaterThan(0.4);
  });

  it('only the defending side defends: away names appear only as defenders/keeper', () => {
    for (const l of lines(300, true)) {
      for (const n of ['Rodri', 'Foden', 'Doku', 'Haaland']) expect(l).not.toContain(n);
    }
  });

  it('two-midfielder lines name two different players', () => {
    for (const l of lines(400, true)) {
      if (l.includes(' and ') && l.includes('exchanging passes')) {
        const [a, b] = l.split(' and ');
        expect(b.startsWith(a)).toBe(false);
      }
    }
  });

  it('falls back to team lines when a side has no striker', () => {
    const noFwd = { home: { ...home, fwd: [] }, away };
    const out = lines(300, true, noFwd);
    expect(out.every(l => !l.includes('Gyokeres') && !/\{\w+\}/.test(l))).toBe(true);
  });

  it('builds the cast by role from the players on the pitch', () => {
    const p = (lastName: string, position: string) => ({ lastName, position } as Player);
    expect(commentaryCast([p('Raya', 'GK'), p('Saliba', 'CB'), p('Rice', 'CDM'), p('Saka', 'RW'), p('Gyokeres', 'ST')]))
      .toEqual({ gk: ['Raya'], def: ['Saliba'], mid: ['Rice'], wide: ['Saka'], fwd: ['Gyokeres'] });
  });
});
