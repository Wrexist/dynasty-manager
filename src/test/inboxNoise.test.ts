/**
 * R18 — the inbox is for things that need the manager.
 *
 * The playthrough had 67 unread messages after seven weeks (75 in this seeded
 * harness before the change). Most were routine: one message per AI-to-AI
 * transfer or loan, transfer rumours, expired bids and sponsor offers, and the
 * result of the match the manager had just watched. Those now arrive already
 * read (`INBOX_ARRIVES_READ`), and a week's AI moves are one round-up message
 * (`INBOX_AI_TRANSFER_ROUNDUP`). Anything needing a decision (a bid for one of
 * your players, a sponsor offer) still arrives unread.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { mulberry32 } from '@/utils/communityPackPool';
import { addMsg } from '@/utils/helpers';
import { INBOX_ROUNDUP_MAX_LINES } from '@/config/gameBalance';
import type { Message } from '@/types/game';

const WEEKS = 7;
const AI_MOVE = /^.+ → [^ ]+( \(Loan\))?$/;

let messages: Message[] = [];

beforeAll(async () => {
  vi.spyOn(Math, 'random').mockImplementation(mulberry32(3));
  useGameStore.getState().resetGame();
  useGameStore.getState().initGame('liverpool');
  for (let w = 0; w < WEEKS; w++) {
    useGameStore.getState().playCurrentMatch();
    await useGameStore.getState().advanceWeek();
  }
  messages = useGameStore.getState().messages;
}, 120_000);
afterAll(() => vi.restoreAllMocks());

describe('addMsg', () => {
  it('is unread unless the caller says otherwise', () => {
    const base = { week: 1, season: 1, type: 'general' as const, title: 't', body: 'b' };
    expect(addMsg([], base)[0].read).toBe(false);
    expect(addMsg([], { ...base, read: true })[0].read).toBe(true);
  });
});

describe(`inbox after ${WEEKS} weeks`, () => {
  it('has no unread information-only messages', () => {
    const unreadInfo = messages.filter(m => !m.read && (
      m.title.startsWith('Transfer round-up')
      || m.title.startsWith('Transfer Rumor')
      || m.title.startsWith('Bid Expired')
      || m.title === 'Sponsor Offer Expired'
      || m.type === 'match_result'
      || AI_MOVE.test(m.title)
    )).map(m => m.title);
    expect(unreadInfo).toEqual([]);
  });

  it('folds each week\'s AI moves into one round-up', () => {
    const roundups = messages.filter(m => m.title.startsWith('Transfer round-up'));
    expect(roundups.length).toBeGreaterThan(0);
    const perWeek = new Map<number, number>();
    for (const r of roundups) perWeek.set(r.week, (perWeek.get(r.week) ?? 0) + 1);
    for (const [week, n] of perWeek) expect(n, `week ${week}`).toBe(1);
    for (const r of roundups) {
      const n = Number(/(\d+) moves/.exec(r.title)![1]);
      const listed = r.body.split('\n').filter(line => AI_MOVE.test(line)).length;
      expect(listed).toBe(Math.min(n, INBOX_ROUNDUP_MAX_LINES));
    }
    // No week both has a round-up and single move messages.
    const singles = messages.filter(m => AI_MOVE.test(m.title));
    for (const s of singles) expect(perWeek.has(s.week), s.title).toBe(false);
  });

  it('keeps decisions unread', () => {
    const decisions = messages.filter(m => m.title.startsWith('Bid for ') || m.title === 'Sponsor Offer Received');
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.filter(m => m.read).map(m => m.title)).toEqual([]);
  });

  it('leaves well under half the messages unread', () => {
    const unread = messages.filter(m => !m.read).length;
    expect(unread).toBeLessThan(messages.length * 0.6);
  });
});
