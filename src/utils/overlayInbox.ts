/**
 * Inbox fallbacks for popups that went past the per-advance cap.
 *
 * When one advance produces more blocking popups than
 * `BLOCKING_POPUPS_PER_ADVANCE`, the informational ones are filed to the inbox
 * instead of queueing up behind each other (see `utils/presentationQueue.ts`).
 * These build that message from the same data the popup would have shown, so
 * the cap costs the player a tap, never the information.
 *
 * Stored strings, so English — like every other message the store writes
 * (`src/i18n/index.ts`: "anything that produces stored strings stay English").
 */
import type { GameState } from '@/store/storeTypes';
import type { InboxNote, Player } from '@/types/game';
import type { Celebration } from '@/utils/celebrations';
import type { Achievement } from '@/utils/achievements';
import { formatMoney, getSuffix } from '@/utils/helpers';

type Digest = NonNullable<GameState['weeklyDigest']>;

function listNames(names: string[], max = 3): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

export function digestNote(digest: Digest, week: number): InboxNote {
  const net = digest.incomeEarned - digest.expensesPaid;
  const lines = [`Net income: ${formatMoney(net, { signed: true })}.`];
  if (digest.injuriesThisWeek.length > 0) lines.push(`Injured: ${listNames(digest.injuriesThisWeek)}.`);
  if (digest.recoveriesThisWeek.length > 0) lines.push(`Back from injury: ${listNames(digest.recoveriesThisWeek)}.`);
  if (digest.offersReceived > 0) lines.push(`${digest.offersReceived} transfer offer${digest.offersReceived === 1 ? '' : 's'} received.`);
  if (digest.contractWarnings.length > 0) lines.push(`Contracts running down: ${listNames(digest.contractWarnings)}.`);
  if (digest.scoutReportsCompleted > 0) lines.push(`${digest.scoutReportsCompleted} scout report${digest.scoutReportsCompleted === 1 ? '' : 's'} ready.`);
  const completed = digest.objectiveProgress.filter(o => o.completed).map(o => o.title);
  if (completed.length > 0) lines.push(`Objectives complete: ${listNames(completed)} — claim the XP under More on your Dashboard.`);
  if (digest.moraleChange !== 0) lines.push(`Squad morale ${digest.moraleChange > 0 ? 'up' : 'down'} ${Math.abs(digest.moraleChange)}.`);
  return { type: 'general', title: `Week ${week} summary`, body: lines.join('\n') };
}

export function celebrationNote(celebration: Pick<Celebration, 'title' | 'description'>): InboxNote {
  return { type: 'general', title: celebration.title, body: celebration.description };
}

export function achievementNote(achievement: Pick<Achievement, 'title' | 'description'>): InboxNote {
  return {
    type: 'general',
    title: `Achievement unlocked: ${achievement.title}`,
    body: `${achievement.description}\n\nSee every achievement in your Trophy Cabinet.`,
  };
}

export function gemNote(gem: { playerId: string; region: string }, player: Player | undefined): InboxNote {
  const name = player ? `${player.firstName} ${player.lastName}` : 'A hidden gem';
  const detail = player ? ` (${player.position}, ${player.age}, potential ${player.potential})` : '';
  return {
    type: 'transfer',
    title: `Hidden gem: ${name}`,
    body: `Your scouts in ${gem.region} have found ${name}${detail}. The full report is waiting in Scouting.`,
    playerId: player?.id,
  };
}

export function farewellNotes(farewells: GameState['pendingFarewell']): InboxNote[] {
  return farewells.map(f => ({
    type: 'general' as const,
    title: `Farewell, ${f.playerName}`,
    body: [
      `${f.playerName} leaves after ${f.seasonsServed} season${f.seasonsServed === 1 ? '' : 's'} at the club.`,
      ...f.stats.map(s => `${s.label}: ${s.value}`),
    ].join('\n'),
    playerId: f.playerId,
  }));
}

export function midSeasonNote(args: { position: number; points: number; boardConfidence: number }): InboxNote {
  const { position, points, boardConfidence } = args;
  return {
    type: 'board',
    title: 'Mid-season report',
    body: `Halfway point: ${position}${getSuffix(position)} with ${points} point${points === 1 ? '' : 's'}. Board confidence stands at ${Math.round(boardConfidence)}%.`,
  };
}
