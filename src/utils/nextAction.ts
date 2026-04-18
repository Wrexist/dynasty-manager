import type { Club, Player, Match } from '@/types/game';
import type { ElementType } from 'react';

export interface NextAction {
  key: string;
  /** Higher = higher priority */
  priority: number;
  icon: ElementType;
  label: string;
  title: string;
  description: string;
  urgent?: boolean;
  /** Screen to navigate to (caller wires this) */
  target: 'squad' | 'season-summary' | 'dashboard';
}

export interface NextActionContext {
  seasonOver: boolean;
  lineupIncomplete: boolean;
  nextMatch: Match | null;
  opponent: Club | null;
  expiringPlayers: Player[];
  week: number;
  lateSeasonWeekThreshold: number;
  icons: {
    Trophy: ElementType;
    Users: ElementType;
    AlertTriangle: ElementType;
  };
}

/**
 * Return dashboard next-actions ranked by priority.
 * Caller picks the first N (typically 2) and renders `NextActionCard`s.
 *
 * Priorities are layered so that critical match-day blockers (lineup
 * incomplete before a match) always beat slower-burn reminders
 * (expiring contracts). Add new actions by appending a collector block
 * and picking a `priority` in the same numeric space.
 */
export function getNextActions(ctx: NextActionContext): NextAction[] {
  const { seasonOver, lineupIncomplete, nextMatch, opponent, expiringPlayers, week, lateSeasonWeekThreshold, icons } = ctx;
  const actions: NextAction[] = [];

  // Priority 100: season is over — the only meaningful action is rolling to the next.
  if (seasonOver) {
    actions.push({
      key: 'season-over',
      priority: 100,
      icon: icons.Trophy,
      label: 'Season Complete',
      title: 'Start the next season',
      description: 'All matches are finished. Tap here to see the season summary and advance.',
      target: 'season-summary',
    });
  }

  // Priority 90: lineup incomplete with a match this week.
  if (!seasonOver && nextMatch && lineupIncomplete) {
    actions.push({
      key: 'lineup-match',
      priority: 90,
      icon: icons.Users,
      label: 'Match Day — Action Required',
      title: 'Lineup incomplete',
      description: `You play ${opponent?.shortName || 'next'} but have fewer than 11 starters. Fix your lineup now.`,
      urgent: true,
      target: 'squad',
    });
  }

  // Priority 80: lineup incomplete, no match yet.
  if (!seasonOver && !nextMatch && lineupIncomplete) {
    actions.push({
      key: 'lineup-no-match',
      priority: 80,
      icon: icons.Users,
      label: 'Action Required',
      title: 'Your lineup isn\'t set',
      description: 'You need 11 players in your starting lineup before your first match.',
      urgent: true,
      target: 'squad',
    });
  }

  // Priority 60: late-season contract urgency for key players (OVR ≥ 70).
  if (!seasonOver && week >= lateSeasonWeekThreshold) {
    const keyExpiring = expiringPlayers.filter(p => p.overall >= 70);
    if (keyExpiring.length > 0) {
      const star = [...keyExpiring].sort((a, b) => b.overall - a.overall)[0];
      const extra = keyExpiring.length - 1;
      actions.push({
        key: 'contract-urgent',
        priority: 60,
        icon: icons.AlertTriangle,
        label: 'Contract Urgent',
        title: `${star.lastName}'s contract expiring`,
        description:
          extra > 0
            ? `${star.firstName} ${star.lastName} and ${extra} other key player${extra === 1 ? '' : 's'} will leave on a free if not renewed this season.`
            : `${star.firstName} ${star.lastName} will leave on a free unless you negotiate a renewal.`,
        urgent: true,
        target: 'squad',
      });
    }
  }

  // Deduplicate by key (safety; collectors shouldn't double-add but be defensive)
  // and sort by priority descending.
  const seen = new Set<string>();
  const unique = actions.filter(a => {
    if (seen.has(a.key)) return false;
    seen.add(a.key);
    return true;
  });
  unique.sort((a, b) => b.priority - a.priority);
  return unique;
}
