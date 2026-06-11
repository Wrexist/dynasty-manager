import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/game/GlassPanel';
import { cn } from '@/lib/utils';
import { hapticError, hapticLight, hapticSuccess } from '@/utils/haptics';
import type { PenaltyKick } from '@/types/game';

/**
 * Shared gradient defs for every PenaltyMark — rendered once per shootout.
 * Each mark used to carry its own <defs> with the same hardcoded id, so a
 * 10-kick shootout emitted 10 duplicate `pk-scored`/`pk-missed` ids
 * (invalid SVG; renderers silently resolve the first).
 */
function PenaltyMarkDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="pk-scored" cx="35%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#A7F3D0" />
          <stop offset="55%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
        <radialGradient id="pk-missed" cx="35%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#FCA5A5" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#7F1D1D" stopOpacity="0.05" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function PenaltyMark({ scored }: { scored: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden="true">
      {scored ? (
        <circle cx="8" cy="8" r="5.5" fill={`url(#pk-scored)`} stroke="#34D399" strokeOpacity="0.55" strokeWidth="0.6" />
      ) : (
        <>
          <circle cx="8" cy="8" r="5.5" fill={`url(#pk-missed)`} stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.2" />
          <path d="M5.5 5.5 L10.5 10.5 M10.5 5.5 L5.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.85" />
        </>
      )}
    </svg>
  );
}

export function PenaltyShootout() {
  const kicks = useGameStore(s => s.penaltyShootoutKicks);
  const revealIndex = useGameStore(s => s.penaltyShootoutRevealIndex);
  const revealNext = useGameStore(s => s.revealNextPenaltyKick);
  const skipAll = useGameStore(s => s.skipPenaltyShootout);
  const playerClubId = useGameStore(s => s.playerClubId);
  const currentMatchResult = useGameStore(s => s.currentMatchResult);

  const revealed = kicks.slice(0, revealIndex);
  const allRevealed = revealIndex >= kicks.length;
  const lastKick = revealed[revealed.length - 1];
  const homeScore = lastKick?.homeTotal ?? 0;
  const awayScore = lastKick?.awayTotal ?? 0;

  // Differentiated haptic on each new kick reveal — your striker scoring is
  // different from your goalkeeper saving. Player team goal / opponent miss
  // = success; player team miss / opponent goal = error. Matches the live-
  // match scoring pattern (hapticSuccess on userScored, hapticHeavy on opp).
  const lastFeltIndexRef = useRef(0);
  useEffect(() => {
    if (!lastKick || !currentMatchResult) return;
    if (revealIndex <= lastFeltIndexRef.current) return;
    lastFeltIndexRef.current = revealIndex;
    const isPlayerHome = currentMatchResult.homeClubId === playerClubId;
    const isPlayerKick = lastKick.isHome === isPlayerHome;
    const goodForPlayer = isPlayerKick ? lastKick.scored : !lastKick.scored;
    if (goodForPlayer) hapticSuccess();
    else hapticError();
  }, [revealIndex, lastKick, currentMatchResult, playerClubId]);

  // Group kicks by round for display
  const rounds: { round: number; home?: PenaltyKick; away?: PenaltyKick }[] = [];
  for (const kick of revealed) {
    let r = rounds.find(rd => rd.round === kick.round);
    if (!r) { r = { round: kick.round }; rounds.push(r); }
    if (kick.isHome) r.home = kick; else r.away = kick;
  }

  return (
    <GlassPanel className="p-4">
      <PenaltyMarkDefs />
      <p className="text-sm font-bold text-primary text-center mb-3">Penalty Shootout</p>

      {/* Scoreboard */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <span className="text-2xl font-bold tabular-nums">{homeScore}</span>
        <span className="text-xs text-muted-foreground">-</span>
        <span className="text-2xl font-bold tabular-nums">{awayScore}</span>
      </div>

      {/* Kick-by-kick display */}
      <div className="space-y-1 mb-4 max-h-48 overflow-y-auto">
        {rounds.map((r) => (
          <div key={r.round} className="flex items-center gap-2 text-xs">
            <span className="w-6 text-muted-foreground tabular-nums text-right">{r.round}</span>
            <span className={cn('w-6 flex justify-center', r.home?.scored ? 'text-emerald-400' : 'text-destructive')}>
              {r.home ? <PenaltyMark scored={r.home.scored} /> : null}
            </span>
            <span className="flex-1" />
            <span className={cn('w-6 flex justify-center', r.away?.scored ? 'text-emerald-400' : 'text-destructive')}>
              {r.away ? <PenaltyMark scored={r.away.scored} /> : null}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      {!allRevealed ? (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => { hapticLight(); revealNext(); }}>
            Next Kick
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => { hapticLight(); skipAll(); }}>
            Skip to Result
          </Button>
        </div>
      ) : null}
    </GlassPanel>
  );
}
