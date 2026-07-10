import { describe, it, expect } from 'vitest';
import { buildEngagementNotifications, buildPersonalReminderBody, NOTIFICATION_IDS } from '@/utils/notifications';

const now = new Date(2026, 5, 19, 9, 0, 0); // 2026-06-19 09:00 local

function byId(specs: ReturnType<typeof buildEngagementNotifications>, id: number) {
  return specs.find(s => s.id === id);
}

describe('buildEngagementNotifications', () => {
  it('always schedules a come-back nudge 3 days out at 18:00', () => {
    const specs = buildEngagementNotifications({ streakCount: 0, festival: null }, now);
    const nudge = byId(specs, NOTIFICATION_IDS.inactivity);
    expect(nudge).toBeDefined();
    expect(nudge!.at.getDate()).toBe(22); // +3 days
    expect(nudge!.at.getHours()).toBe(18);
  });

  it('omits the streak reminder when there is no active streak', () => {
    const specs = buildEngagementNotifications({ streakCount: 0, festival: null }, now);
    expect(byId(specs, NOTIFICATION_IDS.streak)).toBeUndefined();
    expect(specs).toHaveLength(1); // only the come-back nudge
  });

  it('schedules a streak reminder tomorrow evening when a streak is active', () => {
    const specs = buildEngagementNotifications({ streakCount: 5, festival: null }, now);
    const streak = byId(specs, NOTIFICATION_IDS.streak);
    expect(streak).toBeDefined();
    expect(streak!.title).toContain('5');
    expect(streak!.at.getDate()).toBe(20); // +1 day
    expect(streak!.at.getHours()).toBe(18);
  });

  it('schedules a festival check-in reminder while the event is running', () => {
    const specs = buildEngagementNotifications(
      { streakCount: 0, festival: { name: '2026 World Cup Festival', endsInDays: 5 } },
      now,
    );
    const fest = byId(specs, NOTIFICATION_IDS.festival);
    expect(fest).toBeDefined();
    expect(fest!.title).toBe('2026 World Cup Festival');
    expect(fest!.body).toMatch(/check-in/i);
    expect(fest!.at.getDate()).toBe(20);
  });

  it('uses final-day wording when the festival ends tomorrow', () => {
    const specs = buildEngagementNotifications(
      { streakCount: 0, festival: { name: 'Festival', endsInDays: 1 } },
      now,
    );
    expect(byId(specs, NOTIFICATION_IDS.festival)!.body).toMatch(/final day/i);
  });

  it('omits the festival reminder once the event is over (no claimable day left)', () => {
    const specs = buildEngagementNotifications(
      { streakCount: 0, festival: { name: 'Festival', endsInDays: 0 } },
      now,
    );
    expect(byId(specs, NOTIFICATION_IDS.festival)).toBeUndefined();
  });

  it('schedules all three reminders when streak and festival are both active', () => {
    const specs = buildEngagementNotifications(
      { streakCount: 3, festival: { name: 'Festival', endsInDays: 10 } },
      now,
    );
    expect(specs.map(s => s.id).sort()).toEqual(
      [NOTIFICATION_IDS.streak, NOTIFICATION_IDS.festival, NOTIFICATION_IDS.inactivity].sort(),
    );
  });

  it('uses personalised come-back copy when personal context is provided', () => {
    const specs = buildEngagementNotifications(
      { streakCount: 0, festival: null, personal: { nextOpponent: 'Arsenal', nextCompetition: 'Cup final', incomingOffers: 0, expiringContracts: 0 } },
      now,
    );
    const nudge = byId(specs, NOTIFICATION_IDS.inactivity)!;
    expect(nudge.title).toBe('Your season is calling');
    expect(nudge.body).toContain('Cup final vs Arsenal');
  });

  it('falls back to generic come-back copy when nothing personal is available', () => {
    const specs = buildEngagementNotifications(
      { streakCount: 0, festival: null, personal: { incomingOffers: 0, expiringContracts: 0 } },
      now,
    );
    const nudge = byId(specs, NOTIFICATION_IDS.inactivity)!;
    expect(nudge.title).toBe('Your squad is waiting');
    expect(nudge.body).toMatch(/jump back/i);
  });
});

describe('buildPersonalReminderBody', () => {
  it('returns null when there is no personal context', () => {
    expect(buildPersonalReminderBody(null)).toBeNull();
    expect(buildPersonalReminderBody(undefined)).toBeNull();
  });

  it('prioritises the next fixture over everything else', () => {
    const body = buildPersonalReminderBody({
      nextOpponent: 'Chelsea',
      nextCompetition: 'league match',
      topCliffhanger: 'The title race is ON',
      incomingOffers: 3,
      expiringContracts: 2,
    });
    expect(body).toContain('vs Chelsea');
  });

  it('uses the top cliffhanger when there is no next fixture', () => {
    const body = buildPersonalReminderBody({
      topCliffhanger: 'The board is watching closely',
      incomingOffers: 2,
      expiringContracts: 0,
    });
    expect(body).toBe('The board is watching closely');
  });

  it('falls back to pending offers, then expiring contracts', () => {
    expect(buildPersonalReminderBody({ incomingOffers: 2, expiringContracts: 0 })).toContain('2 transfer offers');
    expect(buildPersonalReminderBody({ incomingOffers: 0, expiringContracts: 3 })).toContain('3 of your players');
    expect(buildPersonalReminderBody({ incomingOffers: 0, expiringContracts: 0 })).toBeNull();
  });
});
