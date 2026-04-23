import { describe, it, expect } from 'vitest';
import { scrubPII } from '@/utils/sentry';

describe('scrubPII', () => {
  it('redacts values at sensitive keys', () => {
    const input = {
      managerName: 'Alex Ferguson',
      firstName: 'Alex',
      lastName: 'Ferguson',
      email: 'alex@example.com',
      user: { id: 42 },
      clubName: 'Red Devils FC',
      innocent: 'kept',
    };
    const out = scrubPII(input) as Record<string, unknown>;
    expect(out.managerName).toBe('[REDACTED]');
    expect(out.firstName).toBe('[REDACTED]');
    expect(out.lastName).toBe('[REDACTED]');
    expect(out.email).toBe('[REDACTED]');
    expect(out.user).toBe('[REDACTED]');
    expect(out.clubName).toBe('[REDACTED]');
    expect(out.innocent).toBe('kept');
  });

  it('redacts bulky save-state keys', () => {
    const input = {
      players: { p1: { id: 'p1', name: 'Someone' } },
      clubs: { c1: { id: 'c1' } },
      fixtures: [{ id: 'f1' }],
      messages: [{ body: 'hi' }],
      transferMarket: [{ playerId: 'p1' }],
      freeAgents: ['p2', 'p3'],
      okay: 123,
    };
    const out = scrubPII(input) as Record<string, unknown>;
    expect(out.players).toBe('[REDACTED]');
    expect(out.clubs).toBe('[REDACTED]');
    expect(out.fixtures).toBe('[REDACTED]');
    expect(out.messages).toBe('[REDACTED]');
    expect(out.transferMarket).toBe('[REDACTED]');
    expect(out.freeAgents).toBe('[REDACTED]');
    expect(out.okay).toBe(123);
  });

  it('recurses into nested objects', () => {
    const input = {
      context: {
        player: {
          name: 'Leaked',
          id: 'safe',
        },
      },
    };
    const out = scrubPII(input) as { context: { player: Record<string, unknown> } };
    expect(out.context.player.name).toBe('[REDACTED]');
    expect(out.context.player.id).toBe('safe');
  });

  it('truncates long strings', () => {
    const longString = 'x'.repeat(1200);
    const out = scrubPII({ payload: longString }) as { payload: string };
    expect(out.payload.length).toBeLessThan(longString.length);
    expect(out.payload).toContain('truncated');
  });

  it('caps long arrays and appends a summary element', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i);
    const out = scrubPII({ items: arr }) as { items: unknown[] };
    expect(out.items.length).toBe(21); // 20 capped + 1 summary element
    expect(out.items[20]).toMatch(/\+30 more/);
  });

  it('returns primitives unchanged', () => {
    expect(scrubPII(42)).toBe(42);
    expect(scrubPII('short')).toBe('short');
    expect(scrubPII(true)).toBe(true);
    expect(scrubPII(null)).toBe(null);
    expect(scrubPII(undefined)).toBe(undefined);
  });

  it('does not mutate the input', () => {
    const input = { managerName: 'Pep', nested: { email: 'p@x.com' } };
    const snapshot = JSON.parse(JSON.stringify(input));
    scrubPII(input);
    expect(input).toEqual(snapshot);
  });

  it('stops at the depth limit', () => {
    // Build a chain deeper than MAX_DEPTH (6)
    let deep: Record<string, unknown> = { end: 'here' };
    for (let i = 0; i < 10; i++) deep = { nest: deep };
    const out = scrubPII(deep) as Record<string, unknown>;
    // Walk down — somewhere before the bottom we hit the sentinel
    let cursor: unknown = out;
    let hit = false;
    for (let i = 0; i < 10; i++) {
      if (cursor === '[DEPTH_LIMIT]') { hit = true; break; }
      if (typeof cursor !== 'object' || cursor === null) break;
      cursor = (cursor as Record<string, unknown>).nest;
    }
    expect(hit).toBe(true);
  });

  it('is case-insensitive at key matching', () => {
    const input = { Name: 'X', EMAIL: 'y@z', UserName: 'u' };
    const out = scrubPII(input) as Record<string, unknown>;
    expect(out.Name).toBe('[REDACTED]');
    expect(out.EMAIL).toBe('[REDACTED]');
    expect(out.UserName).toBe('[REDACTED]');
  });
});
