import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { X, ArrowRight, Check, AlertTriangle, Minus, Plus } from 'lucide-react';
import { formatWage, getPreferredYears } from '@/utils/contracts';
import { getMoodColor, getMoodLabel, getRatingColor, posBadgeColor } from '@/utils/uiHelpers';
import { useScrollLock } from '@/hooks/useScrollLock';
import { motion } from 'framer-motion';
import { hapticMedium } from '@/utils/haptics';
import { FlagIcon } from '@/components/game/FlagIcon';
import { CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS } from '@/config/contracts';

export function ContractNegotiation() {
  const { activeNegotiation, players, clubs, playerClubId } = useGameStore(useShallow(s => ({
    activeNegotiation: s.activeNegotiation, players: s.players, clubs: s.clubs, playerClubId: s.playerClubId,
  })));
  const submitWageOffer = useGameStore(s => s.submitWageOffer);
  const cancelNegotiation = useGameStore(s => s.cancelNegotiation);
  const [customWage, setCustomWage] = useState<number | null>(null);
  const [customYears, setCustomYears] = useState<number | null>(null);
  const submittingRef = useRef(false);

  useScrollLock(!!activeNegotiation);

  useEffect(() => {
    if (activeNegotiation) hapticMedium();
  }, [activeNegotiation]);

  // Reset submitting guard when negotiation state changes (new round or complete)
  useEffect(() => {
    submittingRef.current = false;
  }, [activeNegotiation?.round, activeNegotiation?.status]);

  if (!activeNegotiation) return null;

  const player = players[activeNegotiation.playerId];
  if (!player) return null;

  const isComplete = activeNegotiation.status === 'accepted' || activeNegotiation.status === 'rejected';
  const currentYears = customYears ?? activeNegotiation.contractYears;
  const gap = (customWage ?? activeNegotiation.offeredWage) / activeNegotiation.demandedWage;
  const preferredYears = getPreferredYears(activeNegotiation.playerAge);
  const yearsDiff = currentYears - preferredYears;

  const handleSubmit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    submitWageOffer(customWage ?? activeNegotiation.offeredWage, customYears ?? activeNegotiation.contractYears);
    setCustomWage(null);
    setCustomYears(null);
  };

  const moodColor = getMoodColor(activeNegotiation.playerMood);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      style={{ touchAction: 'none' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="bg-card border border-border/50 rounded-2xl w-full max-w-sm overflow-hidden max-h-[85vh] overflow-y-auto"
        style={{ overscrollBehavior: 'contain' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              'bg-gradient-to-b from-white/[0.06] to-transparent border border-white/[0.06]',
            )}>
              <span className={cn('font-display font-bold text-lg tabular-nums leading-none', getRatingColor(player.overall))}>
                {player.overall}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">
                {activeNegotiation.type === 'renewal' ? 'Contract Renewal' : 'New Contract'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <FlagIcon nationality={player.nationality} size={14} />
                <span className="text-xs text-muted-foreground truncate">{player.firstName} {player.lastName}</span>
                <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded leading-none', posBadgeColor(player.position))}>
                  {player.position}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{player.age}y</span>
                <span className="text-[10px] text-muted-foreground">· R{activeNegotiation.round}/3</span>
              </div>
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
              {/* Current wage context */}
              {activeNegotiation.type === 'renewal' && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Current wage</span>
                  <span className="text-foreground font-semibold">{formatWage(player.wage)}</span>
                </div>
              )}

              {/* Player demand vs your offer */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Player Demands</p>
                  <p className="text-lg font-bold text-foreground">{formatWage(activeNegotiation.demandedWage)}</p>
                </div>
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Your Offer</p>
                  <p className="text-lg font-bold text-primary">{formatWage(customWage ?? activeNegotiation.offeredWage)}</p>
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

              {/* Contract Length Selector */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contract Length</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCustomYears(Math.max(CONTRACT_MIN_YEARS, currentYears - 1))}
                      disabled={currentYears <= CONTRACT_MIN_YEARS}
                      className="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted/80 disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-foreground font-semibold w-14 text-center">{currentYears} yr(s)</span>
                    <button
                      onClick={() => setCustomYears(Math.min(CONTRACT_MAX_YEARS, currentYears + 1))}
                      disabled={currentYears >= CONTRACT_MAX_YEARS}
                      className="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted/80 disabled:opacity-30 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {yearsDiff !== 0 && (
                  <p className={cn('text-[10px] text-right', yearsDiff > 0 ? 'text-emerald-400' : 'text-amber-400')}>
                    {yearsDiff > 0 ? `+${yearsDiff} yr over` : `${yearsDiff} yr under`} player preferred ({preferredYears} yr)
                  </p>
                )}
              </div>

              {/* Other details */}
              <div className="space-y-1.5 text-xs text-muted-foreground">
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

              {/* Wage slider with zone coloring */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Adjust wage offer</label>
                {(() => {
                  const sliderMin = Math.round(activeNegotiation.demandedWage * 0.5);
                  const sliderMax = Math.round(activeNegotiation.demandedWage * 1.5);
                  const sliderRange = sliderMax - sliderMin;
                  const dynamicStep = Math.max(100, Math.min(1000, Math.round(sliderRange / 30)));
                  const pct80 = ((activeNegotiation.demandedWage * 0.8 - sliderMin) / sliderRange) * 100;
                  const pctDemand = ((activeNegotiation.demandedWage - sliderMin) / sliderRange) * 100;
                  return (
                    <div className="relative pt-5 pb-5" style={{ touchAction: 'auto' }}>
                      {/* Zone-colored track */}
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full overflow-hidden flex pointer-events-none">
                        <div className="bg-red-500/20 h-full" style={{ width: `${pct80}%` }} />
                        <div className="bg-amber-500/20 h-full" style={{ width: `${pctDemand - pct80}%` }} />
                        <div className="bg-emerald-500/20 h-full" style={{ width: `${100 - pctDemand}%` }} />
                      </div>

                      {/* Demand marker */}
                      <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${pctDemand}%` }}>
                        <div className="absolute left-0 top-3 bottom-3 w-px bg-primary/50" />
                        <span className="absolute top-0 text-[9px] font-semibold text-primary/70 -translate-x-1/2 whitespace-nowrap">
                          Demand
                        </span>
                      </div>

                      <input
                        type="range"
                        min={sliderMin}
                        max={sliderMax}
                        step={dynamicStep}
                        value={customWage ?? activeNegotiation.offeredWage}
                        onChange={(e) => setCustomWage(Number(e.target.value))}
                        style={{ touchAction: 'auto' }}
                        className="relative z-10 w-full h-1.5 bg-transparent rounded-full accent-primary cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:cursor-pointer [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent"
                      />
                    </div>
                  );
                })()}
                <div className="flex justify-between text-[10px] text-muted-foreground -mt-2">
                  <span>{formatWage(Math.round(activeNegotiation.demandedWage * 0.5))}</span>
                  <span className={cn('font-semibold', gap >= 0.95 ? 'text-emerald-400' : gap >= 0.8 ? 'text-amber-400' : 'text-destructive')}>
                    {Math.round(gap * 100)}% of demand
                  </span>
                  <span>{formatWage(Math.round(activeNegotiation.demandedWage * 1.5))}</span>
                </div>
                {/* Mood impact hint */}
                <p className={cn('text-[10px] text-right', gap >= 0.85 ? 'text-emerald-400/70' : gap >= 0.7 ? 'text-amber-400/70' : 'text-red-400/70')}>
                  {gap >= 1 ? 'Meets demand — will accept' : gap >= 0.9 ? 'Close — likely to accept if mood is good' : gap >= 0.8 ? 'Below demand — mood will dip slightly' : gap >= 0.7 ? 'Lowball — mood will drop' : 'Very low — mood will drop significantly'}
                </p>
              </div>

              {/* Budget Impact */}
              {(() => {
                const club = clubs[playerClubId];
                if (!club) return null;
                const offeredWage = customWage ?? activeNegotiation.offeredWage;
                const wageDiff = offeredWage - player.wage;
                const totalCost = activeNegotiation.agentFee + (activeNegotiation.loyaltyBonus || 0);
                return (
                  <div className="bg-muted/20 rounded-lg p-3 space-y-1.5 text-xs">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Budget Impact</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Wage bill change</span>
                      <span className={cn('font-semibold', wageDiff > 0 ? 'text-amber-400' : wageDiff < 0 ? 'text-emerald-400' : 'text-foreground')}>
                        {wageDiff > 0 ? '+' : ''}{formatWage(wageDiff)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Upfront cost</span>
                      <span className="text-foreground">£{(totalCost / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Budget after</span>
                      <span className={cn('font-semibold', club.budget - totalCost < 0 ? 'text-red-400' : 'text-foreground')}>
                        £{((club.budget - totalCost) / 1e6).toFixed(1)}M
                      </span>
                    </div>
                  </div>
                );
              })()}

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
      </motion.div>
    </motion.div>
  );
}
