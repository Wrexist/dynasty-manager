import { describe, it, expect } from 'vitest';
import { buildEngagementNotifications, NOTIFICATION_IDS } from '@/utils/notifications';

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
});
