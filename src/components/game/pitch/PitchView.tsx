import { useMemo } from 'react';
import type { Club, Match, MatchEvent } from '@/types/game';
import { buildMatchTimeline } from '@/engine/match/choreography';
import { PitchCanvas } from './PitchCanvas';

// Live 2.5D pitch panel. Builds a deterministic MatchTimeline from the events
// revealed so far and renders it via PitchCanvas, with a broadcast-style caption
// for the most recent on-pitch event. Lazy-loaded by MatchDay so it never weighs
// on the eager bundle.

interface PitchViewProps {
  match: Match;
  homeClub: Club;
  awayClub: Club;
  /** Events revealed so far (a growing prefix during live play). */
  events: MatchEvent[];
  minute: number;
  /** True when the human manager's club is the home side. */
  playerIsHome: boolean;
  reducedMotion?: boolean;
}

const CAPTIONED_TYPES = new Set<MatchEvent['type']>([
  'goal', 'own_goal', 'penalty_scored', 'penalty_missed', 'header_goal', 'solo_goal',
  'long_range_goal', 'counter_attack_goal', 'free_kick_goal', 'extra_time_goal',
  'shot_saved', 'shot_missed', 'hit_woodwork', 'goal_line_clearance', 'goalkeeper_error',
  'yellow_card', 'red_card', 'foul', 'injury', 'substitution', 'var_check', 'var_disallowed',
]);

export default function PitchView({
  match, homeClub, awayClub, events, minute, playerIsHome, reducedMotion,
}: PitchViewProps) {
  // Rebuild as more events reveal; seed is id-stable so shown beats don't jump.
  const timeline = useMemo(
    () => buildMatchTimeline({ ...match, events }, homeClub, awayClub),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [match.id, events.length, homeClub.id, awayClub.id, homeClub.formation, awayClub.formation],
  );

  // Most recent captionable event at or before the current minute.
  const caption = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.minute <= minute && CAPTIONED_TYPES.has(e.type)) {
        return { minute: e.displayMinute || `${e.minute}'`, text: e.description };
      }
    }
    return null;
  }, [events, minute]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-black/20" style={{ aspectRatio: '68 / 104' }}>
      <PitchCanvas
        timeline={timeline}
        minute={minute}
        flip={!playerIsHome}
        reducedMotion={reducedMotion}
        className="absolute inset-0 h-full w-full"
      />
      {caption && (
        <div className="absolute inset-x-0 bottom-0 p-2">
          <div className="mx-auto max-w-[92%] rounded-lg bg-card/70 px-3 py-1.5 backdrop-blur-md border border-border/40">
            <p className="text-[11px] leading-snug text-foreground">
              <span className="font-bold text-primary tabular-nums mr-1.5">{caption.minute}</span>
              {caption.text}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
