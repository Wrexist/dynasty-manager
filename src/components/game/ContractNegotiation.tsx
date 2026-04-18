import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { X, ArrowRight, Check, AlertTriangle, Minus, Plus, Calendar, ShieldCheck } from 'lucide-react';
import { formatWage, getPreferredYears, getYearsAdjustment, getAcceptanceHint, getReleaseClauseTier } from '@/utils/contracts';
import { getMoodColor, getMoodLabel, getRatingColor, posBadgeColor } from '@/utils/uiHelpers';
import { useScrollLock } from '@/hooks/useScrollLock';
import { motion } from 'framer-motion';
import { hapticMedium, hapticHeavy } from '@/utils/haptics';
import { playSfxTransferAccepted } from '@/utils/audio';
import { FlagIcon } from '@/components/game/FlagIcon';
import { CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS, CONTRACT_MAX_STRIKES, RELEASE_CLAUSE_FAIR_MULTIPLIER, RELEASE_CLAUSE_MODERATE_MULTIPLIER } from '@/config/contracts';

export function ContractNegotiation() {
  const { activeNegotiation, players, clubs, playerClubId } = useGameStore(useShallow(s => ({
    activeNegotiation: s.activeNegotiation, players: s.players, clubs: s.clubs, playerClubId: s.playerClubId,
  })));
  const submitWageOffer = useGameStore(s => s.submitWageOffer);
  const cancelNegotiation = useGameStore(s => s.cancelNegotiation);
  const getContractStrikes = useGameStore(s => s.getContractStrikes);
  const [customWage, setCustomWage] = useState<number | null>(null);
  const [customYears, setCustomYears] = useState<number | null>(null);
  const [customClause, setCustomClause] = useState<number | null>(null);
  const [clauseEnabled, setClauseEnabled] = useState<boolean | null>(null);
  const submittingRef = useRef(false);

  useScrollLock(!!activeNegotiation);

  useEffect(() => {
    if (activeNegotiation) hapticMedium();
  }, [activeNegotiation]);

  // Reset submitting guard when negotiation state changes (new round or complete)
  useEffect(() => {
    submittingRef.current = false;
  }, [activeNegotiation?.round, activeNegotiation?.status]);

  // Celebrate a successful signing with sound + stronger haptic
  useEffect(() => {
    if (activeNegotiation?.status === 'accepted') {
      playSfxTransferAccepted();
      hapticHeavy();
    }
  }, [activeNegotiation?.status]);

  if (!activeNegotiation) return null;

  const player = players[activeNegotiation.playerId];
  if (!player) return null;

  const strikes = getContractStrikes(activeNegotiation.playerId);
  const isComplete = activeNegotiation.status === 'accepted' || activeNegotiation.status === 'rejected';
  const currentYears = customYears ?? activeNegotiation.contractYears;
  const gap = (customWage ?? activeNegotiation.offeredWage) / activeNegotiation.demandedWage;
  const preferredYears = getPreferredYears(activeNegotiation.playerAge);
  const yearsDiff = currentYears - preferredYears;
  const yearsAdj = getYearsAdjustment(activeNegotiation.playerAge, currentYears);
  const yearsAdjPct = Math.round(yearsAdj * 100);

  // Release clause state — derive effective values from user overrides + current offer.
  // Default clause scales with player quality: stars demand a harder-to-trigger
  // multiplier so they can't be plucked cheaply; role players get a slim default.
  const playerValue = activeNegotiation.playerValue ?? player.value;
  const minClauseRequired = activeNegotiation.minClauseRequired;
  const clauseIsMandatory = !!(minClauseRequired && minClauseRequired > 0);
  const defaultClauseMultiplier = player.overall >= 85
    ? 3.0
    : player.overall >= 75
      ? 2.0
      : RELEASE_CLAUSE_FAIR_MULTIPLIER;
  const suggestedClause = Math.max(
    minClauseRequired ?? 1,
    Math.round(playerValue * defaultClauseMultiplier),
  );
  // If the player demands a clause, the toggle is force-on (user can't turn it
  // off). Otherwise it respects the manager's choice.
  const clauseOn = clauseIsMandatory ? true : (clauseEnabled ?? (activeNegotiation.releaseClause ? true : false));
  const effectiveClauseAmount = clauseOn ? (customClause ?? activeNegotiation.releaseClause ?? suggestedClause) : 0;
  const clauseTier = getReleaseClauseTier(effectiveClauseAmount || undefined, playerValue);
  // Lowball guard: a clause below ~1.2× value is trivially triggerable.
  const clauseLowball = clauseOn && effectiveClauseAmount > 0 && effectiveClauseAmount < playerValue * 1.2;
  // Demanded clause unmet — show a hard warning and disable submit (we'll wire it).
  const clauseBelowMin = clauseIsMandatory && effectiveClauseAmount < (minClauseRequired || 0);
  const acceptanceHint = getAcceptanceHint(gap, activeNegotiation.playerAge, currentYears, activeNegotiation.playerMood, effectiveClauseAmount || undefined, playerValue);

  const handleSubmit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    submitWageOffer(
      customWage ?? activeNegotiation.offeredWage,
      customYears ?? activeNegotiation.contractYears,
      clauseOn ? effectiveClauseAmount : 0,
    );
    setCustomWage(null);
    setCustomYears(null);
    setCustomClause(null);
    setClauseEnabled(null);
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
                {strikes > 0 && (
                  <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded leading-none', strikes >= CONTRACT_MAX_STRIKES ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>
                    {strikes}/{CONTRACT_MAX_STRIKES}
                  </span>
                )}
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
                <p className="text-xs text-muted-foreground">
                  {player.lastName} signs at {formatWage(activeNegotiation.offeredWage)} for {activeNegotiation.contractYears} year(s)
                  {activeNegotiation.releaseClause && activeNegotiation.releaseClause > 0 ? ` · Release clause £${(activeNegotiation.releaseClause / 1e6).toFixed(1)}M` : ''}
                </p>
              </div>
            </div>
          )}

          {activeNegotiation.status === 'rejected' && (() => {
            const clauseRefusal = clauseIsMandatory && clauseBelowMin;
            return (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="text-sm font-bold text-destructive">Negotiations Collapsed</p>
                  <p className="text-xs text-muted-foreground">
                    {clauseRefusal
                      ? `${player.lastName} walked away — they asked for a release clause and didn't get one.`
                      : `${player.lastName} has rejected the offer and walked away.`}
                  </p>
                  {clauseRefusal ? (
                    <p className="text-[10px] text-amber-400 mt-1">Player locked for ~4 weeks. Offer a clause of at least £{((minClauseRequired || 0) / 1e6).toFixed(1)}M next time.</p>
                  ) : strikes >= CONTRACT_MAX_STRIKES ? (
                    <p className="text-[10px] text-red-400 mt-1">Max attempts reached — player locked for cooldown period.</p>
                  ) : strikes > 0 ? (
                    <p className="text-[10px] text-amber-400 mt-1">Attempt {strikes}/{CONTRACT_MAX_STRIKES} — {CONTRACT_MAX_STRIKES - strikes} more before cooldown.</p>
                  ) : null}
                </div>
              </div>
            );
          })()}

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
                  <p className="text-[10px] text-muted-foreground mt-1">for {preferredYears} yr{preferredYears !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Your Offer</p>
                  <p className="text-lg font-bold text-primary">{formatWage(customWage ?? activeNegotiation.offeredWage)}</p>
                  <p className={cn('text-[10px] mt-1 font-medium', yearsDiff === 0 ? 'text-emerald-400' : yearsDiff > 0 ? 'text-emerald-400' : 'text-red-400')}>
                    for {currentYears} yr{currentYears !== 1 ? 's' : ''}
                  </p>
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
                  {[1, 2, 3, 4, 5].map(yr => (
                    <div key={yr} className="flex flex-col items-center gap-0.5">
                      <div className={cn(
                        'w-6 h-1.5 rounded-full transition-colors',
                        yr <= currentYears
                          ? yr <= preferredYears ? 'bg-emerald-500' : 'bg-emerald-500/40'
                          : yr <= preferredYears ? 'bg-red-400/50' : 'bg-muted/30',
                      )} />
                      {yr === preferredYears && (
                        <span className="text-[8px] text-muted-foreground leading-none">wanted</span>
                      )}
                    </div>
                  ))}
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
                {/* Acceptance hint — accounts for both wage AND years */}
                <p className={cn('text-[10px] text-right', acceptanceHint.colorClass)}>
                  {acceptanceHint.text}
                </p>
              </div>

              {/* Release Clause — optional protection for the player */}
              <div className={cn(
                'rounded-xl p-3 space-y-2 border',
                clauseBelowMin
                  ? 'bg-destructive/10 border-destructive/40'
                  : clauseOn
                    ? clauseTier === 'fair' ? 'bg-emerald-500/5 border-emerald-500/25'
                      : clauseTier === 'moderate' ? 'bg-amber-500/5 border-amber-500/20'
                      : clauseTier === 'high' ? 'bg-muted/20 border-border/40'
                      : 'bg-destructive/5 border-destructive/20'
                    : 'bg-muted/20 border-border/40',
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Release Clause
                      {clauseIsMandatory && <span className="ml-1 text-amber-400 font-semibold">· required</span>}
                    </span>
                  </div>
                  <button
                    onClick={() => !clauseIsMandatory && setClauseEnabled(!clauseOn)}
                    disabled={clauseIsMandatory}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-md font-semibold border transition-colors',
                      clauseOn ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-muted/50 border-border/40 text-muted-foreground',
                      clauseIsMandatory && 'cursor-not-allowed opacity-80',
                    )}
                  >
                    {clauseOn ? 'Included' : 'Not offered'}
                  </button>
                </div>

                {clauseIsMandatory && (
                  <p className="text-[10px] text-amber-400">
                    This player demands a release clause of at least <span className="font-semibold">£{((minClauseRequired || 0) / 1e6).toFixed(1)}M</span> as a condition of signing.
                  </p>
                )}

                {clauseOn && (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={Math.max(1_000_000, minClauseRequired ?? Math.round(playerValue))}
                        max={Math.max(2_000_000, Math.round(playerValue * (RELEASE_CLAUSE_MODERATE_MULTIPLIER + 1)))}
                        step={Math.max(100_000, Math.round(playerValue * 0.05))}
                        value={Math.max(minClauseRequired ?? 0, effectiveClauseAmount)}
                        onChange={(e) => setCustomClause(Number(e.target.value))}
                        style={{ touchAction: 'auto' }}
                        className="w-full h-1.5 rounded-full accent-primary cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-foreground tabular-nums min-w-[56px] text-right">
                        £{(effectiveClauseAmount / 1e6).toFixed(1)}M
                      </span>
                    </div>
                    <p className={cn(
                      'text-[10px]',
                      clauseTier === 'fair' ? 'text-emerald-400/80' :
                      clauseTier === 'moderate' ? 'text-amber-400/80' :
                      clauseTier === 'high' ? 'text-muted-foreground' :
                      'text-destructive/80',
                    )}>
                      {clauseTier === 'fair' && 'Fair clause — appeals to the player (acceptance boost)'}
                      {clauseTier === 'moderate' && 'Moderate clause — small acceptance boost'}
                      {clauseTier === 'high' && 'High clause — unlikely to trigger, little appeal to player'}
                      {clauseTier === 'none' && `Clause below £${(playerValue / 1e6).toFixed(1)}M value — not a real protection`}
                    </p>
                    {clauseLowball && clauseTier !== 'none' && (
                      <p className="text-[10px] text-destructive/80 flex items-start gap-1">
                        <span>⚠</span>
                        <span>Rivals will trigger this easily — consider raising above £{(playerValue * 1.5 / 1e6).toFixed(1)}M.</span>
                      </p>
                    )}
                  </>
                )}
                {!clauseOn && (
                  <p className="text-[10px] text-muted-foreground">
                    Adding a release clause gives the player a guaranteed exit price — they'll be more willing to sign.
                  </p>
                )}
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

              {/* Submit — disabled when a demanded clause minimum isn't met */}
              <button
                onClick={handleSubmit}
                disabled={clauseBelowMin}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all',
                  clauseBelowMin
                    ? 'bg-muted/40 text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]',
                )}
              >
                {clauseBelowMin ? `Clause below £${((minClauseRequired || 0) / 1e6).toFixed(1)}M demand` : <>Submit Offer <ArrowRight className="w-4 h-4" /></>}
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
