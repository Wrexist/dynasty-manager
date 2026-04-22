import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, HeartPulse, Layers } from 'lucide-react';
import type { MatchEvent, Player, Club } from '@/types/game';
import { FlagIcon } from '@/components/game/FlagIcon';
import { YellowCardIcon, RedCardIcon } from '@/components/game/PlayerAvatar';
import { getRatingHex } from '@/utils/uiHelpers';
import {
  getEventLabel, getEventTone, EVENT_TONE_CLASS, isStructuredEvent,
} from '@/utils/matchEventDisplay';

interface CommentaryRowProps {
  event: MatchEvent;
  players: Record<string, Player>;
  clubs: Record<string, Club>;
  /** Optional fallback club color when clubs[ev.clubId] is a virtual-opponent. */
  fallbackColor?: string;
  /** Verbose description to show beneath the label (for commentary/ambient rows). */
  description?: string;
  /** When true, renders compact (smaller text, smaller chips) for the first-half recap. */
  compact?: boolean;
}

/** Small pill: flag + name + rating — matches the look used in MatchReview. */
function PlayerChip({
  player,
  variant = 'primary',
  size = 'md',
}: {
  player: Player;
  variant?: 'primary' | 'gk' | 'own-goal';
  size?: 'sm' | 'md';
}) {
  const accent = variant === 'gk' ? '#f87171'
    : variant === 'own-goal' ? '#f59e0b'
    : getRatingHex(player.overall);
  const flagSize = size === 'sm' ? 10 : 12;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border bg-background/40',
        size === 'sm' ? 'text-[10px]' : 'text-[11px]',
        variant === 'own-goal' && 'border-dashed'
      )}
      style={{ borderColor: accent }}
    >
      {variant === 'gk' && <span className="text-[9px] font-bold text-red-400 uppercase">GK</span>}
      <FlagIcon nationality={player.nationality} size={flagSize} />
      <span className="font-semibold text-foreground leading-none">
        {player.firstName[0]}. {player.lastName}
      </span>
      <span className="text-[10px] font-bold tabular-nums leading-none" style={{ color: accent }}>
        {player.overall}
      </span>
    </span>
  );
}

/**
 * Live/recap match commentary row. Renders a structured line matching the
 * Key Highlights aesthetic — minute + label pill + player chip(s) + team dot —
 * instead of long prose, so the user can scan what happened at a glance.
 *
 * Ambient events (`commentary`, `kickoff`, `half_time`, `full_time`,
 * `ai_tactical_change`) fall back to dimmed prose since they don't map to a
 * single player action.
 */
export function CommentaryRow({
  event: ev,
  players,
  clubs,
  fallbackColor,
  description,
  compact = false,
}: CommentaryRowProps) {
  const tone = getEventTone(ev.type);
  const toneClass = EVENT_TONE_CLASS[tone];
  const label = getEventLabel(ev.type);
  const teamColor = clubs[ev.clubId]?.color ?? fallbackColor ?? '#888';
  const shooter = ev.playerId ? players[ev.playerId] : null;
  const assistOrOut = ev.assistPlayerId ? players[ev.assistPlayerId] : null;
  const gk = ev.goalkeeperId ? players[ev.goalkeeperId] : null;

  // Ambient prose — keep as subtle italic text with minute prefix
  if (!isStructuredEvent(ev.type)) {
    const isTactical = ev.type === 'ai_tactical_change';
    return (
      <div
        className={cn(
          'flex items-start gap-2',
          compact ? 'text-[11px]' : 'text-xs',
          isTactical
            ? 'text-blue-300 italic rounded-lg border border-blue-400/30 bg-blue-500/10 px-2 py-1.5'
            : 'text-muted-foreground/70 italic'
        )}
      >
        <span className={cn('font-mono shrink-0 text-primary/80 tabular-nums', compact ? 'w-6' : 'w-8')}>
          {ev.minute}'
        </span>
        {isTactical && <Layers className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />}
        <span className="flex-1">{description ?? ev.description}</span>
      </div>
    );
  }

  const isGoalish = tone === 'goal' || ev.type === 'own_goal';
  const isCard = ev.type === 'yellow_card' || ev.type === 'red_card';
  const isSubstitution = ev.type === 'substitution';
  // A sub is forced if the outgoing player has a matching injury event this minute.
  const forcedSub = isSubstitution && !!ev.assistPlayerId && typeof ev.description === 'string'
    && ev.description.toLowerCase().includes('injured');

  return (
    <div
      className={cn(
        'flex items-center gap-2 animate-[fadeSlideIn_0.2s_ease-out]',
        compact ? 'text-[11px]' : 'text-sm',
        isCard && 'rounded-lg border px-2 py-1.5',
        ev.type === 'yellow_card' && 'border-amber-400/45 bg-amber-500/10',
        ev.type === 'red_card' && 'border-red-500/55 bg-red-500/15 shadow-[0_0_14px_rgba(239,68,68,0.25)]',
        isGoalish && 'font-semibold'
      )}
    >
      <span className={cn('font-mono shrink-0 text-primary tabular-nums', compact ? 'w-6 text-[10px]' : 'w-8 text-xs')}>
        {ev.minute}'
      </span>

      {/* Label pill with optional card icon */}
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-bold uppercase tracking-wider shrink-0',
          compact ? 'text-[9px]' : 'text-[10px]',
          toneClass.text,
          toneClass.pill
        )}
      >
        {ev.type === 'yellow_card' && <YellowCardIcon size={compact ? 9 : 10} />}
        {ev.type === 'red_card' && <RedCardIcon size={compact ? 9 : 10} />}
        <span>{label}</span>
      </span>

      {/* Player info */}
      <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
        {isSubstitution && shooter && assistOrOut ? (
          <>
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="w-3 h-3 text-emerald-400 shrink-0" />
              <PlayerChip player={shooter} size={compact ? 'sm' : 'md'} />
            </span>
            <span className="inline-flex items-center gap-1 opacity-75">
              <ArrowDown className="w-3 h-3 text-red-400 shrink-0" />
              {forcedSub && <HeartPulse className="w-3 h-3 text-destructive shrink-0" />}
              <PlayerChip player={assistOrOut} size={compact ? 'sm' : 'md'} />
            </span>
          </>
        ) : shooter ? (
          <>
            <PlayerChip
              player={shooter}
              variant={ev.type === 'own_goal' ? 'own-goal' : 'primary'}
              size={compact ? 'sm' : 'md'}
            />
            {ev.type === 'goalkeeper_error' && gk && (
              <PlayerChip player={gk} variant="gk" size={compact ? 'sm' : 'md'} />
            )}
            {isGoalish && assistOrOut && ev.type !== 'own_goal' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-primary/70">
                <span>assist</span>
                <FlagIcon nationality={assistOrOut.nationality} size={10} />
                <span>{assistOrOut.lastName}</span>
              </span>
            )}
          </>
        ) : null}
      </div>

      {/* Team color dot */}
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
    </div>
  );
}
