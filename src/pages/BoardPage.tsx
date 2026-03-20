import { useGameStore } from '@/store/gameStore';
import { getSuffix } from '@/utils/helpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Target, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getConfidenceColor, getConfidenceRisk } from '@/utils/uiHelpers';
import { usePlayerClub, useLeaguePosition } from '@/hooks/useGameSelectors';

const BoardPage = () => {
  const { boardConfidence, boardObjectives, clubs, playerClubId, leagueTable, season, seasonHistory } = useGameStore();

  const club = usePlayerClub();
  const pos = useLeaguePosition();

  const riskLevel = getConfidenceRisk(boardConfidence);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <h2 className="text-lg font-display font-bold text-foreground">Board Room</h2>

      {/* Confidence Meter */}
      <GlassPanel className={cn('p-4', riskLevel === 'danger' && 'border-destructive/30')}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Board Confidence</h3>
          <span className={cn('text-2xl font-black font-display tabular-nums',
            getConfidenceColor(boardConfidence).textClass
          )}>
            {boardConfidence}%
          </span>
        </div>
        <div className="w-full h-3 bg-muted/50 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700',
              getConfidenceColor(boardConfidence).bgClass
            )}
            style={{ width: `${boardConfidence}%` }}
          />
        </div>

        {/* Risk Level */}
        <div className="flex items-center gap-2 mt-3">
          {riskLevel === 'safe' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : riskLevel === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-destructive" />
          )}
          <span className={cn('text-xs font-semibold',
            riskLevel === 'safe' ? 'text-emerald-400' : riskLevel === 'warning' ? 'text-amber-400' : 'text-destructive'
          )}>
            {riskLevel === 'safe' ? 'Position Secure' : riskLevel === 'warning' ? 'Under Pressure' : 'Job at Risk'}
          </span>
        </div>
      </GlassPanel>

      {/* Board Review */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Board Statement</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {boardConfidence >= 80
            ? `The board is extremely pleased with your leadership of ${club?.name || 'the club'}. Your work has exceeded expectations and the fans are behind you.`
            : boardConfidence >= 60
            ? `The board is satisfied with the current direction. Continue building on recent performances and results.`
            : boardConfidence >= 40
            ? `The board has noted some inconsistency in results. While your position is not under immediate threat, improvement is expected.`
            : boardConfidence >= 20
            ? `The board is growing increasingly concerned. Unless results improve significantly in the coming weeks, we may need to consider our options.`
            : `The board's patience has been severely tested. Immediate improvement is required or your position will become untenable.`
          }
        </p>
      </GlassPanel>

      {/* Season Objectives */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Season {season} Objectives</h3>
        </div>
        <div className="space-y-2.5">
          {boardObjectives.map(obj => (
            <div key={obj.id} className="flex items-start gap-2.5">
              {obj.completed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Circle className={cn('w-4 h-4 shrink-0 mt-0.5',
                  obj.priority === 'critical' ? 'text-destructive' : obj.priority === 'important' ? 'text-amber-400' : 'text-muted-foreground'
                )} />
              )}
              <div className="flex-1">
                <p className={cn('text-sm', obj.completed ? 'text-muted-foreground line-through' : 'text-foreground')}>
                  {obj.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-[10px] font-semibold uppercase',
                    obj.priority === 'critical' ? 'text-destructive' : obj.priority === 'important' ? 'text-amber-400' : 'text-muted-foreground'
                  )}>
                    {obj.priority}
                  </span>
                  {typeof pos === 'number' && (
                    <span className="text-[10px] text-muted-foreground">Currently {pos}{getSuffix(pos)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Club Philosophy */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Club Philosophy</h3>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Club Reputation</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={cn('w-3 h-3 rounded-sm', i < (club?.reputation || 3) ? 'bg-primary' : 'bg-muted/30')} />
              ))}
            </div>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Board Patience</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className={cn('w-2 h-3 rounded-sm', i < (club?.boardPatience || 5) ? 'bg-amber-400' : 'bg-muted/30')} />
              ))}
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* History */}
      {seasonHistory.length > 0 && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Previous Seasons</h3>
          <div className="space-y-1.5">
            {seasonHistory.map(h => (
              <div key={h.season} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Season {h.season}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{h.position}{getSuffix(h.position)}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold',
                    h.boardVerdict === 'excellent' ? 'bg-emerald-500/20 text-emerald-400'
                    : h.boardVerdict === 'good' ? 'bg-primary/20 text-primary'
                    : h.boardVerdict === 'acceptable' ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-destructive/20 text-destructive'
                  )}>
                    {h.boardVerdict}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
};

export default BoardPage;
