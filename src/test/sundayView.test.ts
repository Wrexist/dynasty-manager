/**
 * The view layer — the single place the Sunday screens read from.
 *
 * These helpers exist so two screens cannot disagree about the same club, so
 * the assertions are mostly about AGREEMENT: the summary's numbers are the
 * canonical helpers' numbers, the squad join drops exactly what a dangling id
 * requires it to drop, and the news feed's ordering rule is the one its
 * docblock claims.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  sundayClubSummary, sundayNewsFeed, sundayOppositionCard, sundaySponsorBoards,
  sundaySquadView, sundayUpgradeScene,
} from '@/utils/sunday/view';
import { summariseAvailability } from '@/utils/sunday/availability';
import { sundayUpgradeUpkeep, sundayWeeklyBurn } from '@/utils/sunday/finance';
import { sundayPitchQuality } from '@/store/slices/sunday/matchday';
import { buildSundayTable } from '@/utils/sunday/season';
import { SUNDAY_UPGRADES, sundayUpgradeCost } from '@/config/sundayLeague';
import type { SundaySponsorDeal, SundayState } from '@/types/game';

const SEED = 5150;

beforeEach(async () => {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

describe('sundaySquadView', () => {
  it('joins every member to his Player, in squad order', () => {
    const s = useGameStore.getState();
    const rows = sundaySquadView(s.sunday!, s.players);
    expect(rows).toHaveLength(s.sunday!.squad.length);
    rows.forEach((row, i) => {
      expect(row.member.playerId).toBe(s.sunday!.squad[i].playerId);
      expect(row.player.id).toBe(row.member.playerId);
    });
  });

  it('drops a member whose Player has gone rather than yielding a hole', () => {
    // The project's own gotcha: mapping ids to players ALWAYS needs a
    // filter(Boolean), and doing it in five screens is five chances to forget.
    const s = useGameStore.getState();
    const players = { ...s.players };
    delete players[s.sunday!.squad[0].playerId];
    const rows = sundaySquadView(s.sunday!, players);
    expect(rows).toHaveLength(s.sunday!.squad.length - 1);
    expect(rows.every(r => !!r.player)).toBe(true);
  });
});

describe('sundayClubSummary', () => {
  it('takes every number from the helper that owns it', () => {
    const s = useGameStore.getState();
    const sunday = s.sunday!;
    const summary = sundayClubSummary(sunday, s.week);
    const avail = summariseAvailability(sunday.squad);

    expect(summary.balance).toBe(sunday.balance);
    expect(summary.reputation).toBe(sunday.reputation);
    expect(summary.morale).toBe(sunday.teamMorale);
    expect(summary.squadSize).toBe(sunday.squad.length);
    expect(summary.pitch).toBe(sundayPitchQuality(sunday, s.week));
    expect(summary.available).toBe(avail.available);
    expect(summary.selectable).toBe(avail.selectable);
    expect(summary.doubts).toBe(avail.doubts);
    expect(summary.out).toBe(avail.out);
    expect(summary.burn).toBe(sundayWeeklyBurn(sunday.divisionId, sunday.upgrades));
    expect(summary.upkeep).toBe(sundayUpgradeUpkeep(sunday.divisionId, sunday.upgrades));
  });

  it('reports both readings of availability, differing by the doubts', () => {
    const s = useGameStore.getState();
    const sunday: SundayState = {
      ...s.sunday!,
      squad: s.sunday!.squad.map((m, i) => (i < 3
        ? { ...m, availability: { status: 'doubt' as const, reason: 'work' as const, note: null, warned: true, weeksRemaining: 0 } }
        : m)),
    };
    const summary = sundayClubSummary(sunday, s.week);
    expect(summary.doubts).toBe(3);
    expect(summary.selectable).toBe(summary.available + summary.doubts);
  });

  it('counts the upkeep inside the burn, not beside it', () => {
    const s = useGameStore.getState();
    const withCoach: SundayState = { ...s.sunday!, upgrades: [{ id: 'coach', level: 2 }] };
    const bare = sundayClubSummary({ ...s.sunday!, upgrades: [] }, s.week);
    const kitted = sundayClubSummary(withCoach, s.week);
    expect(bare.upkeep).toBe(0);
    expect(kitted.upkeep).toBeGreaterThan(0);
    expect(kitted.burn - bare.burn).toBe(kitted.upkeep);
  });
});

describe('sundayNewsFeed', () => {
  it('merges every source and tags each entry with where it came from', async () => {
    // Play a handful of weeks so there is something in each list.
    for (let i = 0; i < 6; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      await useGameStore.getState().advanceWeek();
    }
    const sunday = useGameStore.getState().sunday!;
    const feed = sundayNewsFeed(sunday, 100);
    expect(feed.length).toBeGreaterThan(0);
    for (const e of feed) {
      expect(e.text).toBeTruthy();
      expect(['week', 'event', 'record', 'rivalry', 'memory']).toContain(e.kind);
    }
    // Ids are unique, so a list can key on them.
    expect(new Set(feed.map(e => e.id)).size).toBe(feed.length);
    // Every week-log line is present and at the front.
    const weekEntries = feed.filter(e => e.kind === 'week');
    expect(weekEntries).toHaveLength(Math.min(sunday.weekLog.length, 100));
    expect(feed.slice(0, weekEntries.length).every(e => e.kind === 'week')).toBe(true);
  });

  it('keys two same-kind memories in the same week apart', () => {
    // The collision this pins is real and was found by CI, not imagined: a man
    // came back from a lay-off (a memory `week.ts` then tagged `motm`, since
    // retagged `comeback`) and ran the game the same week (a real `motm` from
    // `memories.ts`) — same season, same week, same kind. The retag removed
    // that one pair, not the class: nothing stops two same-kind memories in
    // one week, so the tuple still cannot key the feed and the id carries an
    // index. Built directly rather than played for, because a scenario that
    // shows up in roughly one run in six is not a test.
    const s = useGameStore.getState();
    const [first] = s.sunday!.squad;
    const twice = {
      ...first,
      memories: [
        { season: 1, week: 3, kind: 'motm' as const, text: 'Back after 2 weeks out.', weight: 4 },
        { season: 1, week: 3, kind: 'motm' as const, text: 'Ran the game — 8.9 and everyone knew it.', weight: 6 },
      ],
    };
    const sunday: SundayState = { ...s.sunday!, squad: [twice, ...s.sunday!.squad.slice(1)] };
    const feed = sundayNewsFeed(sunday, 200);
    const mine = feed.filter(e => e.playerId === first.playerId);
    expect(mine).toHaveLength(2);
    expect(new Set(feed.map(e => e.id)).size).toBe(feed.length);
  });

  it('puts this week first, then the dated entries newest first', () => {
    const s = useGameStore.getState();
    const sunday: SundayState = {
      ...s.sunday!,
      weekLog: ['oldest line', 'newest line'],
      rivalry: s.sunday!.rivalry ? { ...s.sunday!.rivalry, story: ['old feud', 'new feud'] } : null,
      eventLog: [
        { season: 1, week: 2, defId: 'a', summary: 'early' },
        { season: 2, week: 1, defId: 'b', summary: 'late' },
      ],
      records: [],
      squad: s.sunday!.squad.map(m => ({ ...m, memories: [] })),
    };
    const feed = sundayNewsFeed(sunday, 100);
    expect(feed.map(e => e.text)).toEqual([
      'newest line', 'oldest line',   // the week in progress, newest first
      'late', 'early',                // dated, newest first
      'new feud', 'old feud',         // the undated feud diary, newest first
    ]);
  });

  it('honours the limit and never throws on an empty club', () => {
    const s = useGameStore.getState();
    expect(sundayNewsFeed(s.sunday!, 3).length).toBeLessThanOrEqual(3);
    expect(sundayNewsFeed(s.sunday!, 0)).toEqual([]);
    const empty: SundayState = {
      ...s.sunday!, weekLog: [], eventLog: [], records: [], rivalry: null,
      squad: s.sunday!.squad.map(m => ({ ...m, memories: [] })),
    };
    expect(sundayNewsFeed(empty)).toEqual([]);
  });
});

describe('sundayOppositionCard', () => {
  it('reads the position off the same table the season is judged on', async () => {
    for (let i = 0; i < 5; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      await useGameStore.getState().advanceWeek();
    }
    const s = useGameStore.getState();
    const sunday = s.sunday!;
    const oppId = sunday.divisionClubIds.find(id => id !== s.playerClubId)!;
    const card = sundayOppositionCard(oppId, sunday, s.clubs, s.fixtures);
    const table = buildSundayTable(s.fixtures, sunday.divisionClubIds);

    expect(card.club?.id).toBe(oppId);
    expect(card.position).toBe(table.findIndex(r => r.clubId === oppId) + 1);
    expect(card.played).toBe(table.find(r => r.clubId === oppId)!.played);
    expect(card.formation).toBe(s.clubs[oppId].formation);
    expect(card.tactic).toBe(sunday.divisionStyles[oppId] ?? null);
    expect(card.form.length).toBeLessThanOrEqual(5);
    for (const r of card.form) expect(['W', 'D', 'L']).toContain(r);
  });

  it('says "no idea" rather than guessing for a club it has no style for', () => {
    const s = useGameStore.getState();
    const oppId = s.sunday!.divisionClubIds.find(id => id !== s.playerClubId)!;
    const sunday: SundayState = { ...s.sunday!, divisionStyles: {} };
    expect(sundayOppositionCard(oppId, sunday, s.clubs, s.fixtures).tactic).toBeNull();
  });

  it('does not fall over on a club that is not in the division', () => {
    const s = useGameStore.getState();
    const card = sundayOppositionCard('nobody', s.sunday!, s.clubs, s.fixtures);
    expect(card.club).toBeNull();
    expect(card.position).toBeNull();
    expect(card.form).toEqual([]);
  });
});

describe('sundayUpgradeScene', () => {
  it('lists every upgrade, owned or not, and quotes the buy action\'s price', () => {
    const s = useGameStore.getState();
    const sunday: SundayState = { ...s.sunday!, upgrades: [{ id: 'pitch', level: 1 }] };
    const scene = sundayUpgradeScene(sunday);
    expect(scene.items).toHaveLength(SUNDAY_UPGRADES.length);
    expect(scene.totalLevels).toBe(1);

    const pitch = scene.items.find(i => i.id === 'pitch')!;
    expect(pitch.owned).toBe(true);
    expect(pitch.level).toBe(1);
    expect(pitch.nextCost).toBe(sundayUpgradeCost('pitch', 1));

    const nets = scene.items.find(i => i.id === 'nets')!;
    expect(nets.owned).toBe(false);
    expect(nets.nextCost).toBe(sundayUpgradeCost('nets', 0));
  });

  it('stops offering a next level once an upgrade is maxed', () => {
    const s = useGameStore.getState();
    const info = SUNDAY_UPGRADES.find(u => u.id === 'coach')!;
    const scene = sundayUpgradeScene({ ...s.sunday!, upgrades: [{ id: 'coach', level: info.maxLevel }] });
    const coach = scene.items.find(i => i.id === 'coach')!;
    expect(coach.maxed).toBe(true);
    expect(coach.nextCost).toBeNull();
  });
});

describe('sundaySponsorBoards', () => {
  const deal = (over: Partial<SundaySponsorDeal> = {}): SundaySponsorDeal => ({
    id: 'd1', name: 'Kebab House', blurb: 'Open late.', weekly: 12, signOn: 30,
    expiresSeason: 2, condition: 'win-streak', conditionTarget: 4, conditionProgress: 1,
    conditionText: 'Win four on the bounce.', ...over,
  });

  it('turns condition progress into a ratio and says when it is met', () => {
    const s = useGameStore.getState();
    const boards = sundaySponsorBoards({ ...s.sunday!, sponsors: [deal()] }, 1);
    expect(boards[0].progress).toBeCloseTo(0.25);
    expect(boards[0].met).toBe(false);
    expect(boards[0].seasonsLeft).toBe(2);

    const done = sundaySponsorBoards({ ...s.sunday!, sponsors: [deal({ conditionProgress: 9 })] }, 1);
    expect(done[0].progress).toBe(1);
    expect(done[0].met).toBe(true);
  });

  it('reports no progress bar for a deal with no condition', () => {
    const s = useGameStore.getState();
    const boards = sundaySponsorBoards(
      { ...s.sunday!, sponsors: [deal({ condition: 'none', conditionTarget: 0 })] }, 3,
    );
    expect(boards[0].progress).toBeNull();
    expect(boards[0].met).toBe(true);
    expect(boards[0].seasonsLeft).toBe(0);
  });
});
