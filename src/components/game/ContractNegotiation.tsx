import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { cn } from '@/lib/utils';
import { X, ArrowRight, Check, AlertTriangle, Minus, Plus, Calendar } from 'lucide-react';
import { formatWage, getPreferredYears, getYearsAdjustment, getAcceptanceHint } from '@/utils/contracts';
import { getMoodColor, getMoodLabel, getRatingColor, posBadgeColor } from '@/utils/uiHelpers';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useFlash } from '@/hooks/useFlash';
import { motion } from 'framer-motion';
import { hapticMedium, hapticHeavy, hapticLight } from '@/utils/haptics';
import { errorToast } from '@/utils/gameToast';
import { FlagIcon } from '@/components/game/FlagIcon';
import { CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS, CONTRACT_MAX_STRIKES } from '@/config/contracts';

export function ContractNegotiation() {
  const { activeNegotiation, players, clubs, playerClubId } = useGameStore(useShallow(s => ({
    activeNegotiation: s.activeNegotiation, players: s.players, clubs: s.clubs, playerClubId: s.playerClubId,
  })));
  const submitWageOffer = useGameStore(s => s.submitWageOffer);
  const cancelNegotiation = useGameStore(s => s.cancelNegotiation);
  const getContractStrikes = useGameStore(s => s.getContractStrikes);
  const [customWage, setCustomWage] = useState<number | null>(null);
  const [customYears, setCustomYears] = useState<number | null>(null);
  const submittingRef = useRef(false);

  useScrollLock(!!activeNegotiation);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(containerRef, !!activeNegotiation);
  useEscapeClose(cancelNegotiation, !!activeNegotiation);

  useEffect(() => {
    if (activeNegotiation) hapticMedium();
  }, [activeNegotiation]);

  // Reset submitting guard when negotiation state changes (new round or complete)
  useEffect(() => {
    submittingRef.current = false;
  }, [activeNegotiation?.round, activeNegotiation?.status]);

  // Celebratory / warning haptic when the negotiation resolves
  useEffect(() => {
    if (activeNegotiation?.status === 'accepted') hapticHeavy();
    else if (activeNegotiation?.status === 'rejected') hapticLight();
  }, [activeNegotiation?.status]);

  // Flash Demand / Mood when they change between rounds so the player notices
  const demandFlash = useFlash(activeNegotiation?.demandedWage ?? 0);
  const moodFlash = useFlash(activeNegotiation?.playerMood ?? 0);

  if (!activeNegotiation) return null;

  const player = players[activeNegotiation.playerId];
  if (!player) return null;

  const strikes = getContractStrikes(activeNegotiation.playerId);
  const isComplete = activeNegotiation.status === 'accepted' || activeNegotiation.status === 'rejected';
  const currentYears = customYears ?? activeNegotiation.contractYears;
  const currentWage = customWage ?? activeNegotiation.offeredWage;
  // Guard against demandedWage <= 0 (corrupted save / malformed offer) —
  // same degenerate case the slider block below already handles. Without
  // this the readout renders "Infinity% of demand".
  const gap = activeNegotiation.demandedWage > 0 ? currentWage / activeNegotiation.demandedWage : 0;
  const preferredYears = getPreferredYears(activeNegotiation.playerAge);
  const yearsDiff = currentYears - preferredYears;
  const yearsAdj = getYearsAdjustment(activeNegotiation.playerAge, currentYears);
  const yearsAdjPct = Math.round(yearsAdj * 100);
  const acceptanceHint = getAcceptanceHint(
    gap,
    activeNegotiation.playerAge,
    currentYears,
    activeNegotiation.playerMood,
    currentWage,
  );

  const handleSubmit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const result = submitWageOffer(customWage ?? activeNegotiation.offeredWage, customYears ?? activeNegotiation.contractYears);
    if (result && !result.success) {
      // Blocked up-front (e.g. can't afford the agent fee) — negotiation
      // state didn't change, so the round/status effect won't reset the
      // guard. Surface the reason and re-enable the button.
      errorToast(result.message);
      submittingRef.current = false;
      return;
    }
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
        ref={containerRef}
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="bg-card border border-border/50 rounded-2xl w-full max-w-sm overflow-hidden max-h-[85vh] overflow-y-auto"
        style={{ overscrollBehavior: 'contain' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-negotiation-title"
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
              <p id="contract-negotiation-title" className="text-sm font-bold text-foreground">
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
                {strikes > 0 && (
                  <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded leading-none', strikes >= CONTRACT_MAX_STRIKES ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>
                    {strikes}/{CONTRACT_MAX_STRIKES}
                  </span>
                )}
              </div>
            </div>
          </div>
          {!isComplete && (
            <button type="button" onClick={cancelNegotiation} className="p-1.5 rounded-lg hover:bg-muted/50">
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
                {strikes >= CONTRACT_MAX_STRIKES ? (
                  <p className="text-[10px] text-red-400 mt-1">Max attempts reached — player locked for cooldown period.</p>
                ) : strikes > 0 ? (
                  <p className="text-[10px] text-amber-400 mt-1">Attempt {strikes}/{CONTRACT_MAX_STRIKES} — {CONTRACT_MAX_STRIKES - strikes} more before cooldown.</p>
                ) : null}
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
                <GlassPanel className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Player Demands</p>
                  <p
                    className={cn(
                      'text-xl font-black tabular-nums rounded px-1 transition-colors',
                      'bg-gradient-to-b from-foreground/95 to-foreground/70 bg-clip-text text-transparent',
                      demandFlash,
                    )}
                  >
                    {formatWage(activeNegotiation.demandedWage)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">for {preferredYears} yr{preferredYears !== 1 ? 's' : ''}</p>
                </GlassPanel>
                <GlassPanel className="p-3 text-center ring-1 ring-primary/30">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Your Offer</p>
                  <p className="text-xl font-black tabular-nums bg-gradient-to-b from-primary to-primary/70 bg-clip-text text-transparent">
                    {formatWage(customWage ?? activeNegotiation.offeredWage)}
                  </p>
                  <p className={cn('text-[10px] mt-1 font-medium', yearsDiff === 0 ? 'text-emerald-400' : yearsDiff > 0 ? 'text-emerald-400' : 'text-destructive')}>
                    for {currentYears} yr{currentYears !== 1 ? 's' : ''}
                  </p>
                </GlassPanel>
              </div>

              {/* Player mood */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Player Mood</span>
                <span className={cn('font-semibold rounded px-1 transition-colors', moodColor, moodFlash)}>
                  {getMoodLabel(activeNegotiation.playerMood)}
                  ({activeNegotiation.playerMood}%)
                </span>
              </div>

              {/* Contract Length Selector */}
              <div className={cn(
                'rounded-xl p-3 space-y-2 border',
                yearsDiff === 0 ? 'bg-emerald-500/5 border-emerald-500/20' :
                yearsDiff > 0 ? 'bg-emerald-500/5 border-emerald-500/15' :
                yearsDiff >= -1 ? 'bg-amber-500/5 border-amber-500/20' :
                'bg-red-500/5 border-red-500/20',
              )}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Contract Length</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCustomYears(Math.max(CONTRACT_MIN_YEARS, currentYears - 1))}
                      disabled={currentYears <= CONTRACT_MIN_YEARS}
                      className="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted/80 disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-foreground font-bold w-14 text-center text-sm">{currentYears} yr{currentYears !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => setCustomYears(Math.min(CONTRACT_MAX_YEARS, currentYears + 1))}
                      disabled={currentYears >= CONTRACT_MAX_YEARS}
                      className="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center hover:bg-muted/80 disabled:opacity-30 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Years preference visual: dots showing 1-5 with preferred marked */}
                <div className="flex items-center justify-center gap-1">
                  {Array.from({ length: CONTRACT_MAX_YEARS }, (_, i) => i + 1).map(yr => {
                    const filled = yr <= currentYears;
                    const wanted = yr <= preferredYears;
                    return (
                      <div key={yr} className="flex flex-col items-center gap-0.5">
                        <div
                          className={cn(
                            'w-6 h-1.5 rounded-full transition-all bg-gradient-to-b',
                            filled && wanted && 'from-emerald-300 via-emerald-500 to-emerald-700 shadow-lg',
                            filled && !wanted && 'from-emerald-300 to-emerald-600 opacity-40',
                            !filled && wanted && 'from-rose-300 to-rose-600 opacity-60',
                            !filled && !wanted && 'bg-foreground/5',
                          )}
                        />
                        {yr === preferredYears && (
                          <span className="text-[8px] text-muted-foreground leading-none">wanted</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Years feedback */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className={cn(
                    'font-medium',
                    yearsDiff === 0 ? 'text-emerald-400' :
                    yearsDiff > 0 ? 'text-emerald-400' :
                    yearsDiff >= -1 ? 'text-amber-400' : 'text-red-400',
                  )}>
                    {yearsDiff === 0 ? `Matches preferred (${preferredYears} yr${preferredYears !== 1 ? 's' : ''})` :
                     yearsDiff > 0 ? `+${yearsDiff} yr${yearsDiff !== 1 ? 's' : ''} over preferred — player pleased` :
                     `${yearsDiff} yr${yearsDiff !== -1 ? 's' : ''} under preferred — player unhappy`}
                  </span>
                  {yearsAdjPct !== 0 && (
                    <span className={cn(
                      'font-bold tabular-nums',
                      yearsAdjPct > 0 ? 'text-emerald-400' : 'text-red-400',
                    )}>
                      {yearsAdjPct > 0 ? '+' : ''}{yearsAdjPct}%
                    </span>
                  )}
                </div>
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
                  const rawRange = activeNegotiation.demandedWage; // half of min→max window
                  const dynamicStep = Math.max(100, Math.min(1000, Math.round(rawRange / 15)));
                  // Anchor min/max to exact multiples of the step so demandedWage is always a
                  // legal stop — otherwise the slider can only offer £42K or £44K when the
                  // demand is £43K and the user can't hit 100%.
                  const sliderMin = Math.floor((activeNegotiation.demandedWage * 0.5) / dynamicStep) * dynamicStep;
                  const sliderMax = Math.ceil((activeNegotiation.demandedWage * 1.5) / dynamicStep) * dynamicStep;
                  const sliderRange = sliderMax - sliderMin;
                  // Guard against a demandedWage of 0 (corrupted save / malformed
                  // offer) so percentage math doesn't divide by zero and render
                  // `width: NaN%` markers. The slider degrades to a flat zero
                  // state — no negative values, no crash.
                  if (sliderRange <= 0) {
                    return (
                      <div className="text-center text-[11px] text-muted-foreground py-2">
                        Slider unavailable for this offer.
                      </div>
                    );
                  }
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
                {/* Acceptance hint — accounts for both wage AND years */}
                <p className={cn('text-[10px] text-right', acceptanceHint.colorClass)}>
                  {acceptanceHint.text}
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
                  <GlassPanel className="p-3 space-y-1.5 text-xs">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Budget Impact</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Wage bill change</span>
                      <span className={cn('font-semibold tabular-nums', wageDiff > 0 ? 'text-amber-400' : wageDiff < 0 ? 'text-emerald-400' : 'text-foreground')}>
                        {wageDiff > 0 ? '+' : ''}{formatWage(wageDiff)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Upfront cost</span>
                      <span className="text-foreground tabular-nums">£{(totalCost / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Budget after</span>
                      <span className={cn('font-semibold tabular-nums', club.budget - totalCost < 0 ? 'text-destructive' : 'text-foreground')}>
                        £{((club.budget - totalCost) / 1e6).toFixed(1)}M
                      </span>
                    </div>
                  </GlassPanel>
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
