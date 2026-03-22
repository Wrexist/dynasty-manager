import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { FileText, X, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { formatWage } from '@/utils/contracts';
import { getMoodColor, getMoodLabel } from '@/utils/uiHelpers';
import { useScrollLock } from '@/hooks/useScrollLock';

export function ContractNegotiation() {
  const { activeNegotiation, submitWageOffer, cancelNegotiation, players } = useGameStore();
  const [customWage, setCustomWage] = useState<number | null>(null);

  useScrollLock(!!activeNegotiation);

  if (!activeNegotiation) return null;

  const player = players[activeNegotiation.playerId];
  if (!player) return null;

  const isComplete = activeNegotiation.status === 'accepted' || activeNegotiation.status === 'rejected';
  const gap = (customWage || activeNegotiation.offeredWage) / activeNegotiation.demandedWage;

  const handleSubmit = () => {
    submitWageOffer(customWage || activeNegotiation.offeredWage);
    setCustomWage(null);
  };

  const moodColor = getMoodColor(activeNegotiation.playerMood);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" style={{ touchAction: 'none' }}>
      <div className="bg-card border border-border/50 rounded-2xl w-full max-w-sm overflow-hidden max-h-[85vh] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-bold text-foreground">
                {activeNegotiation.type === 'renewal' ? 'Contract Renewal' : 'New Contract'}
              </p>
              <p className="text-xs text-muted-foreground">{player.firstName} {player.lastName} · Round {activeNegotiation.round}/3</p>
            </div>
          </div>
          {!isComplete && (
            <button onClick={cancelNegotiation} className="p-1.5 rounded-lg hover:bg-muted/50">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Status */}
          {activeNegotiation.status === 'accepted' && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-emerald-400">Deal Agreed!</p>
                <p className="text-xs text-muted-foreground">{player.lastName} signs at {formatWage(activeNegotiation.offeredWage)} for {activeNegotiation.contractYears} year(s)</p>
              </div>
            </div>
          )}

          {activeNegotiation.status === 'rejected' && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-sm font-bold text-destructive">Negotiations Collapsed</p>
                <p className="text-xs text-muted-foreground">{player.lastName} has rejected the offer and walked away.</p>
              </div>
            </div>
          )}

          {!isComplete && (
            <>
              {/* Player demand vs your offer */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Player Demands</p>
                  <p className="text-lg font-bold text-foreground">{formatWage(activeNegotiation.demandedWage)}</p>
                </div>
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Your Offer</p>
                  <p className="text-lg font-bold text-primary">{formatWage(customWage || activeNegotiation.offeredWage)}</p>
                </div>
              </div>

              {/* Player mood */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Player Mood</span>
                <span className={cn('font-semibold', moodColor)}>
                  {getMoodLabel(activeNegotiation.playerMood)}
                  ({activeNegotiation.playerMood}%)
                </span>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Contract Length</span>
                  <span className="text-foreground">{activeNegotiation.contractYears} year(s)</span>
                </div>
                <div className="flex justify-between">
                  <span>Agent Fee</span>
                  <span className="text-foreground">£{(activeNegotiation.agentFee / 1000).toFixed(0)}K</span>
                </div>
                {activeNegotiation.loyaltyBonus > 0 && (
                  <div className="flex justify-between">
                    <span>Loyalty Bonus</span>
                    <span className="text-foreground">£{(activeNegotiation.loyaltyBonus / 1000).toFixed(0)}K</span>
                  </div>
                )}
              </div>

              {/* Wage slider */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Adjust wage offer</label>
                <input
                  type="range"
                  min={Math.round(activeNegotiation.demandedWage * 0.5)}
                  max={Math.round(activeNegotiation.demandedWage * 1.5)}
                  step={1000}
                  value={customWage || activeNegotiation.offeredWage}
                  onChange={(e) => setCustomWage(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{formatWage(Math.round(activeNegotiation.demandedWage * 0.5))}</span>
                  <span className={cn('font-semibold', gap >= 0.95 ? 'text-emerald-400' : gap >= 0.8 ? 'text-amber-400' : 'text-destructive')}>
                    {Math.round(gap * 100)}% of demand
                  </span>
                  <span>{formatWage(Math.round(activeNegotiation.demandedWage * 1.5))}</span>
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                Submit Offer <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {isComplete && (
            <button
              onClick={cancelNegotiation}
              className="w-full bg-muted/50 text-foreground py-2.5 rounded-xl font-semibold text-sm hover:bg-muted/70 transition-all"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
