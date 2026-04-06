import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/game/GlassPanel';
import { cn } from '@/lib/utils';
import { hapticMedium } from '@/utils/haptics';
import type { PenaltyKick } from '@/types/game';

export function PenaltyShootout() {
  const kicks = useGameStore(s => s.penaltyShootoutKicks);
  const revealIndex = useGameStore(s => s.penaltyShootoutRevealIndex);
  const revealNext = useGameStore(s => s.revealNextPenaltyKick);
  const skipAll = useGameStore(s => s.skipPenaltyShootout);

  const revealed = kicks.slice(0, revealIndex);
  const allRevealed = revealIndex >= kicks.length;
  const lastKick = revealed[revealed.length - 1];
  const homeScore = lastKick?.homeTotal ?? 0;
  const awayScore = lastKick?.awayTotal ?? 0;

  // Group kicks by round for display
  const rounds: { round: number; home?: PenaltyKick; away?: PenaltyKick }[] = [];
  for (const kick of revealed) {
    let r = rounds.find(rd => rd.round === kick.round);
    if (!r) { r = { round: kick.round }; rounds.push(r); }
    if (kick.isHome) r.home = kick; else r.away = kick;
  }

  return (
    <GlassPanel className="p-4">
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
            <span className={cn('w-6 text-center font-bold', r.home?.scored ? 'text-emerald-400' : 'text-destructive')}>
              {r.home ? (r.home.scored ? '●' : '○') : ''}
            </span>
            <span className="flex-1" />
            <span className={cn('w-6 text-center font-bold', r.away?.scored ? 'text-emerald-400' : 'text-destructive')}>
              {r.away ? (r.away.scored ? '●' : '○') : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      {!allRevealed ? (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => { hapticMedium(); revealNext(); }}>
            Next Kick
          </Button>
          <Button variant="outline" className="flex-1" onClick={skipAll}>
            Skip to Result
          </Button>
        </div>
      ) : null}
    </GlassPanel>
  );
}
