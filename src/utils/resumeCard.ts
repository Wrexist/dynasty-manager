/**
 * "Continue where you left off" resume-card logic (G5).
 *
 * Pure priority selection over signals the Dashboard already computes — no new
 * state shape. Returns the single highest-priority pending decision a returning
 * player should be pointed at, or null when there's nothing pressing. The card
 * itself is session-scoped (shown once per app session) in the component.
 */
import type { GameScreen } from '@/types/game';

export interface ResumeSignals {
  /** Fewer than 11 resolvable players in the starting XI. */
  lineupIncomplete: boolean;
  /** Pending incoming transfer offers awaiting a response. */
  incomingOffers: number;
  /** An unplayed fixture scheduled for the current week. */
  unplayedMatchThisWeek: boolean;
  /** A high-rated squad player is out of contract at season end. */
  expiringStarContract: boolean;
}

export interface ResumeItem {
  /** Stable reason id (also used for analytics + session de-dupe). */
  reason: 'lineup' | 'offer' | 'match' | 'contract';
  /** In-game screen the card deep-links to. */
  screen: GameScreen;
  title: string;
  description: string;
  /** lucide icon name. */
  icon: string;
}

/**
 * Choose the top pending item. Priority (highest first): finish the lineup →
 * respond to a transfer offer → play this week's match → renew an expiring
 * star. Returns null when nothing is pending.
 */
export function selectResumeItem(signals: ResumeSignals): ResumeItem | null {
  if (signals.lineupIncomplete) {
    return {
      reason: 'lineup',
      screen: 'tactics',
      title: 'Finish your lineup',
      description: 'Your starting XI is incomplete — set it before kickoff.',
      icon: 'clipboard',
    };
  }
  if (signals.incomingOffers > 0) {
    return {
      reason: 'offer',
      screen: 'transfers',
      title: 'Transfer offers waiting',
      description: `You have ${signals.incomingOffers} offer${signals.incomingOffers === 1 ? '' : 's'} to respond to.`,
      icon: 'handshake',
    };
  }
  if (signals.unplayedMatchThisWeek) {
    return {
      reason: 'match',
      screen: 'match-prep',
      title: 'Match day is here',
      description: "Prep your side — there's a fixture waiting this week.",
      icon: 'swords',
    };
  }
  if (signals.expiringStarContract) {
    return {
      reason: 'contract',
      screen: 'squad',
      title: 'A key player is out of contract',
      description: 'Renew before they can walk for free at season end.',
      icon: 'file-text',
    };
  }
  return null;
}
