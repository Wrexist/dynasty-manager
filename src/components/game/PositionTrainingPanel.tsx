import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PremiumProgress } from '@/components/game/PremiumProgress';
import { Crosshair, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { errorToast, successToast } from '@/utils/gameToast';
import { getPositionTrainingEta, getTrainablePositions } from '@/utils/positionTraining';
import type { Player, Position } from '@/types/game';

/**
 * Pick ONE neighbouring position for a player to learn, and watch it fill.
 * Lives on PlayerDetail, so it covers both the squad and academy prospects.
 */
export function PositionTrainingPanel({ player }: { player: Player }) {
  const plan = useGameStore(s => (s.training.positionPlans || []).find(p => p.playerId === player.id));
  const setPositionTraining = useGameStore(s => s.setPositionTraining);
  const options = getTrainablePositions(player);

  const choose = (pos: Position | null) => {
    hapticLight();
    const r = setPositionTraining(player.id, pos);
    if (r.success) successToast('Position Training', r.message);
    else errorToast(r.message);
  };

  return (
    <GlassPanel className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Crosshair className="w-3.5 h-3.5 text-primary" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Position Training</p>
      </div>

      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {player.lastName} already plays every position next to {player.position}.
        </p>
      ) : plan ? (
        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">
              Learning <span className="font-bold text-primary">{plan.position}</span>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {Math.floor(plan.progress)}% · ~{getPositionTrainingEta(plan, player)} wk left
            </p>
          </div>
          <PremiumProgress size="sm" tone="primary" value={plan.progress} />
          {player.injured && (
            <p className="text-xs text-amber-400">Injured — progress slowed until fit.</p>
          )}
          <button
            type="button"
            onClick={() => choose(null)}
            className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg bg-muted/20 text-muted-foreground text-xs font-semibold hover:bg-muted/40 active:scale-[0.98] transition-all"
          >
            <X className="w-3.5 h-3.5" /> Stop training
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Pick one position to learn. When finished it counts as natural in lineups and subs.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {options.map(pos => (
              <button
                key={pos}
                type="button"
                onClick={() => choose(pos)}
                className={cn(
                  'min-h-[44px] rounded-lg border border-border/50 bg-muted/20 text-sm font-bold text-foreground',
                  'hover:bg-primary/15 hover:border-primary/40 active:scale-[0.97] transition-all',
                )}
              >
                {pos}
                <span className="block text-[11px] font-medium text-muted-foreground">
                  ~{getPositionTrainingEta({ progress: 0 }, player)} wk
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </GlassPanel>
  );
}
