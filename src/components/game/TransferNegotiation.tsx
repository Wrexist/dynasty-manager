import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { TransferListing } from '@/types/game';
import { getRatingColor, getTop3Attributes, getChanceColor, getChanceBarColor, getChanceLabel } from '@/utils/uiHelpers';
import { formatWage } from '@/utils/contracts';
import { formatMoney } from '@/utils/helpers';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';
import { NEGOTIATION_SLIDER_MIN_RATIO, NEGOTIATION_SLIDER_MAX_RATIO, NEGOTIATION_MAX_STRIKES } from '@/config/transfers';
import { FlagIcon } from '@/components/game/FlagIcon';
import { StrikeIndicator } from '@/components/game/StrikeIndicator';
import {
  X, TrendingUp, TrendingDown,
  ArrowRight, RotateCcw, Handshake, XCircle, Star, AlertTriangle, Wallet, Users, Unlock, Lock,
} from 'lucide-react';

function getInterpolatedChance(ratio: number): number {
  if (ratio >= 1.0) return 0.85;
  if (ratio >= 0.8) return 0.40 + (ratio - 0.8) / 0.2 * 0.45;
  if (ratio >= 0.5) return 0.10 + (ratio - 0.5) / 0.3 * 0.30;
  return 0.10;
}

interface Props {
  listing: TransferListing;
  onClose: () => void;
}

type Phase = 'negotiate' | 'thinking' | 'result';
type Outcome = 'accepted' | 'rejected' | 'counter';

export function TransferNegotiation({ listing, onClose }: Props) {
  const { players, clubs, playerClubId, season, shortlist } = useGameStore(useShallow(s => ({
    players: s.players,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    season: s.season,
    shortlist: s.shortlist,
  })));
  const evaluateOffer = useGameStore(s => s.evaluateOffer);
  const makeOfferWithNegotiation = useGameStore(s => s.makeOfferWithNegotiation);
  const executeTransfer = useGameStore(s => s.executeTransfer);
  const removeFromShortlist = useGameStore(s => s.removeFromShortlist);
  const getPlayerStrikes = useGameStore(s => s.getPlayerStrikes);
  const isNegotiationLocked = useGameStore(s => s.isNegotiationLocked);
  const recordNegotiationStrike = useGameStore(s => s.recordNegotiationStrike);
  const clearNegotiationStrikes = useGameStore(s => s.clearNegotiationStrikes);

  const player = players[listing.playerId];
  const rawSellerClub = listing.externalPlayer ? null : clubs[listing.sellerClubId];
  const sellerClub = rawSellerClub
    ? { ...rawSellerClub, shortName: rawSellerClub.shortName || rawSellerClub.name || 'Unknown' }
    : { name: 'Unattached', shortName: 'Unattached', id: '' };
  const buyerClub = clubs[playerClubId];

  const [offerFee, setOfferFee] = useState(listing.askingPrice);
  const [finalFee, setFinalFee] = useState<number>(listing.askingPrice);
  const [phase, setPhase] = useState<Phase>('negotiate');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [counterFee, setCounterFee] = useState<number | null>(null);
  const [lastCounterFee, setLastCounterFee] = useState<number | null>(null);
  const [strikeCount, setStrikeCount] = useState(() => getPlayerStrikes(listing.playerId));
  const [latestStrikeOutcome, setLatestStrikeOutcome] = useState<'rejected' | 'accepted' | null>(null);
  const lockout = isNegotiationLocked(listing.playerId);

  const minFee = Math.round(listing.askingPrice * NEGOTIATION_SLIDER_MIN_RATIO);
  const maxFee = Math.round(listing.askingPrice * NEGOTIATION_SLIDER_MAX_RATIO);
  const step = Math.max(100_000, Math.round(listing.askingPrice * 0.01));

  // Position helpers for markers on the slider track
  const trackPercent = (value: number) => Math.min(100, Math.max(0, ((value - minFee) / (maxFee - minFee)) * 100));
  const askingPercent = trackPercent(listing.askingPrice);
  const zone80Percent = trackPercent(listing.askingPrice * 0.8);
  const counterMarkerPercent = lastCounterFee ? trackPercent(lastCounterFee) : null;

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  useScrollLock();

  const evaluation = useMemo(() => evaluateOffer(listing.playerId, offerFee), [listing.playerId, offerFee, evaluateOffer]);

  const top3 = useMemo(() => player ? getTop3Attributes(player.attributes) : [], [player]);

  const displayChance = useMemo(() => getInterpolatedChance(offerFee / listing.askingPrice), [offerFee, listing.askingPrice]);

  const particles = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      color: i % 4 === 0 ? '#10b981' : i % 4 === 1 ? '#22c55e' : i % 4 === 2 ? '#3b82f6' : '#38bdf8',
      left: 15 + Math.random() * 70,
      yTarget: -140 - Math.random() * 180,
      xTarget: (Math.random() - 0.5) * 160,
      duration: 1.5 + Math.random() * 0.8,
      delay: Math.random() * 0.5,
      size: 4 + Math.random() * 4,
    })),
  []);

  const handleSubmitOffer = useCallback((fee: number) => {
    setLastCounterFee(null);
    setLatestStrikeOutcome(null);
    setPhase('thinking');
    setFinalFee(fee);
    timersRef.current.push(setTimeout(() => {
      const result = makeOfferWithNegotiation(listing.playerId, fee);
      setOutcome(result.outcome);
      setResultMessage(result.message);
      if (result.outcome === 'counter' && result.counterFee) {
        setCounterFee(result.counterFee);
      }
      if (result.outcome === 'rejected') {
        const newStrikes = recordNegotiationStrike(listing.playerId);
        setStrikeCount(newStrikes);
        setLatestStrikeOutcome('rejected');
      } else if (result.outcome === 'accepted') {
        clearNegotiationStrikes(listing.playerId);
        setStrikeCount(0);
        setLatestStrikeOutcome('accepted');
      }
      setPhase('result');
    }, 1500));
  }, [listing.playerId, makeOfferWithNegotiation, recordNegotiationStrike, clearNegotiationStrikes]);

  const handleAcceptCounter = useCallback(() => {
    if (!counterFee) return;
    const fee = counterFee;
    setPhase('thinking');
    setFinalFee(fee);
    setCounterFee(null);
    timersRef.current.push(setTimeout(() => {
      const result = executeTransfer(listing.playerId, fee);
      setOutcome(result.success ? 'accepted' : 'rejected');
      setResultMessage(result.message);
      if (result.success) {
        clearNegotiationStrikes(listing.playerId);
        setStrikeCount(0);
        setLatestStrikeOutcome('accepted');
      }
      setPhase('result');
    }, 1000));
  }, [counterFee, listing.playerId, executeTransfer, clearNegotiationStrikes]);

  const handleRevise = useCallback(() => {
    setPhase('negotiate');
    setOutcome(null);
    setResultMessage('');
    setLatestStrikeOutcome(null);
    if (counterFee) {
      setOfferFee(counterFee);
      setLastCounterFee(counterFee);
    }
    setCounterFee(null);
  }, [counterFee]);

  const handleCloseAfterAccepted = useCallback(() => {
    if (shortlist.includes(listing.playerId)) {
      removeFromShortlist(listing.playerId);
    }
    onClose();
  }, [shortlist, listing.playerId, removeFromShortlist, onClose]);

  if (!player || !buyerClub) return null;

  const feeRatio = offerFee / listing.askingPrice;
  const valueDiff = player.value > 0 ? ((listing.askingPrice - player.value) / player.value) * 100 : 0;
  const hasPotential = player.potential > player.overall;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center pt-[env(safe-area-inset-top,40px)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ touchAction: 'none' }} onClick={phase !== 'thinking' ? onClose : undefined} />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-sm bg-card/95 backdrop-blur-xl border border-border/50 rounded-b-2xl sm:rounded-2xl overflow-hidden sm:mx-4"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          <div className="max-h-[85vh] overflow-y-auto overscroll-contain">
          {/* ── NEGOTIATE PHASE ── */}
          <AnimatePresence mode="wait">
            {phase === 'negotiate' && (
              <motion.div
                key="negotiate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Lockout screen — if cooldown is active */}
                {lockout.locked && (
                  <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[260px]">
                    <motion.div
                      className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    >
                      <Lock className="w-7 h-7 text-red-400" />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-lg font-black text-red-400 font-display">Negotiations Locked</p>
                      <p className="text-xs text-muted-foreground mt-1.5 max-w-[260px]">
                        You've been rejected 3 times. The seller refuses to negotiate for now.
                      </p>
                      <p className="text-sm font-bold text-foreground mt-3 tabular-nums">
                        {lockout.weeksRemaining} week{lockout.weeksRemaining !== 1 ? 's' : ''} remaining
                      </p>
                    </div>
                    <StrikeIndicator strikes={NEGOTIATION_MAX_STRIKES} latestOutcome={null} />
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-3 rounded-xl text-sm font-bold text-muted-foreground bg-muted/30 hover:bg-muted/50 active:scale-[0.98] transition-all mt-2"
                    >
                      Close
                    </button>
                  </div>
                )}

                {/* Player Header — compact hero section */}
                {!lockout.locked && (<><div className="p-4 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buy Player</p>
                      {strikeCount > 0 && <StrikeIndicator strikes={strikeCount} latestOutcome={null} />}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 -mr-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 relative">
                      <span className={cn('font-mono font-black text-2xl', getRatingColor(player.overall))}>
                        {player.overall}
                      </span>
                      {hasPotential && (
                        <span className="absolute -top-1 -right-1 bg-primary/20 border border-primary/40 rounded-md px-1 py-px text-[9px] font-bold text-primary flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" />{player.potential}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground font-display text-base leading-tight">{player.firstName} {player.lastName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {player.position} · {player.age}y · <FlagIcon nationality={player.nationality} size={14} /> {player.nationality}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                        From <span className="text-foreground/80">{sellerClub.name}</span>
                      </p>
                    </div>
                  </div>
                  {/* Top attributes */}
                  <div className="flex gap-1.5 mt-2.5">
                    {top3.map(attr => (
                      <span key={attr.label} className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                        <span className="text-muted-foreground">{attr.label}</span>{' '}
                        <span className={cn('font-bold', getRatingColor(attr.value))}>{attr.value}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-border/30" />

                {/* Price section */}
                <div className="px-4 pt-3 pb-2">
                  {/* Value vs Asking — inline */}
                  <div className="flex items-center justify-between text-xs mb-3">
                    <div>
                      <span className="text-muted-foreground">Value </span>
                      <span className="text-foreground font-semibold">{formatMoney(player.value)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Asking </span>
                      <span className="text-primary font-bold">{formatMoney(listing.askingPrice)}</span>
                      {valueDiff > 5 && <TrendingUp className="w-3 h-3 text-red-400" />}
                      {valueDiff < -5 && <TrendingDown className="w-3 h-3 text-emerald-400" />}
                      <span className={cn('text-[10px]',
                        valueDiff > 5 ? 'text-red-400' : valueDiff < -5 ? 'text-emerald-400' : 'text-muted-foreground'
                      )}>
                        {valueDiff > 0 ? '+' : ''}{valueDiff.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Release clause hint */}
                  {player.releaseClause && (
                    <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 mb-3">
                      <Unlock className="w-3 h-3 text-emerald-400 shrink-0" />
                      <p className="text-[10px] text-emerald-400">
                        Release clause: <span className="font-bold">{formatMoney(player.releaseClause)}</span> — guaranteed acceptance
                      </p>
                    </div>
                  )}

                  {/* Your Offer */}
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs text-muted-foreground font-medium">Your Offer</span>
                    <span className="text-xl font-black text-primary font-display tabular-nums">
                      {formatMoney(offerFee)}
                    </span>
                  </div>

                  {/* Enhanced Slider with zone colors and markers */}
                  <div className="relative pt-5 pb-5">
                    {/* Zone-colored track background */}
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full overflow-hidden flex pointer-events-none">
                      <div className="bg-red-500/20 h-full" style={{ width: `${zone80Percent}%` }} />
                      <div className="bg-amber-500/20 h-full" style={{ width: `${askingPercent - zone80Percent}%` }} />
                      <div className="bg-emerald-500/20 h-full" style={{ width: `${100 - askingPercent}%` }} />
                    </div>

                    {/* Asking price marker */}
                    <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${askingPercent}%` }}>
                      <div className="absolute left-0 top-3 bottom-3 w-px bg-primary/50" />
                      <span className="absolute top-0 text-[9px] font-semibold text-primary/70 -translate-x-1/2 whitespace-nowrap">
                        Asking
                      </span>
                    </div>

                    {/* Counter-offer marker (visible after revise) */}
                    {counterMarkerPercent != null && (
                      <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${counterMarkerPercent}%` }}>
                        <div className="absolute left-0 top-3 bottom-3 w-px bg-amber-400/50" />
                        <span className="absolute bottom-0 text-[9px] font-semibold text-amber-400/70 -translate-x-1/2 whitespace-nowrap">
                          Counter
                        </span>
                      </div>
                    )}

                    {/* Slider input */}
                    <input
                      type="range"
                      min={minFee}
                      max={maxFee}
                      step={step}
                      value={offerFee}
                      onChange={(e) => setOfferFee(Number(e.target.value))}
                      className="relative z-10 w-full h-1.5 bg-transparent rounded-full accent-primary cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:cursor-pointer [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums -mt-2">
                    <span>{formatMoney(minFee)}</span>
                    <span className={cn('font-semibold',
                      feeRatio >= 1 ? 'text-emerald-400' : feeRatio >= 0.8 ? 'text-amber-400' : 'text-red-400'
                    )}>
                      {Math.round(feeRatio * 100)}% of asking
                    </span>
                    <span>{formatMoney(maxFee)}</span>
                  </div>

                  {/* Acceptance bar — inline with label and percentage */}
                  {evaluation && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Acceptance</span>
                        <span className={cn('font-bold text-[11px]', getChanceColor(displayChance))}>
                          {getChanceLabel(displayChance)} ({Math.round(displayChance * 100)}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', getChanceBarColor(displayChance))}
                          animate={{ width: `${displayChance * 100}%` }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-border/30" />

                {/* Deal Impact — compact row */}
                {evaluation && (
                  <div className="px-4 py-2.5">
                    <div className="flex items-center gap-3 text-[11px]">
                      <div className="flex items-center gap-1.5 flex-1">
                        <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Budget:</span>
                        <span className={cn('font-bold tabular-nums', evaluation.budgetAfter >= 0 ? 'text-foreground' : 'text-red-400')}>
                          {formatMoney(evaluation.budgetAfter)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Squad:</span>
                        <span className="font-bold text-foreground">{evaluation.totalSquadSize + 1}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Wage:</span>
                        <span className="font-bold text-foreground tabular-nums">+{formatWage(evaluation.wageImpact)}</span>
                      </div>
                    </div>

                    {/* Warnings */}
                    {evaluation.wouldTriggerSellOn && (
                      <p className="text-[10px] text-amber-400/80 mt-1.5">
                        ~{evaluation.sellOnPct}% sell-on clause will apply to future sale
                      </p>
                    )}
                    {evaluation.budgetAfter < 0 && (
                      <p className="text-[10px] text-red-400 font-medium mt-1.5 text-center">
                        Insufficient budget for this offer
                      </p>
                    )}
                    {player.contractEnd - season <= 1 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        <p className="text-[10px] text-amber-400">
                          Contract expiring {player.contractEnd - season <= 0 ? 'this season' : 'next season'}
                        </p>
                      </div>
                    )}
                    {evaluation.totalSquadSize + 1 > MAX_SQUAD_SIZE && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                        <p className="text-[10px] text-red-400 font-medium">
                          Squad full ({MAX_SQUAD_SIZE} players) — sell or release a player first
                        </p>
                      </div>
                    )}
                  </div>
                )}
                </>)}
              </motion.div>
            )}

            {/* ── THINKING PHASE ── */}
            {phase === 'thinking' && (
              <motion.div
                key="thinking"
                className="p-8 flex flex-col items-center justify-center gap-4 min-h-[260px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center"
                  animate={{ scale: [1, 1.08, 1], borderColor: ['rgba(16,185,129,0.3)', 'rgba(16,185,129,0.6)', 'rgba(16,185,129,0.3)'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Handshake className="w-6 h-6 text-primary" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground font-display">Negotiating...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sellerClub.shortName} are considering your {formatMoney(finalFee)} offer
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── RESULT: ACCEPTED ── */}
            {phase === 'result' && outcome === 'accepted' && (
              <motion.div
                key="accepted"
                className="relative p-5 flex flex-col items-center justify-center gap-3 min-h-[320px] overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {particles.map((p, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{ backgroundColor: p.color, left: `${p.left}%`, top: '50%', width: p.size, height: p.size }}
                    animate={{ opacity: [1, 1, 0], y: [0, p.yTarget], x: [0, p.xTarget], scale: [1, 0.3], rotate: [0, 360] }}
                    transition={{ duration: p.duration, delay: p.delay }}
                  />
                ))}

                <motion.p
                  className="text-lg font-black text-emerald-400 font-display tracking-wide"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Deal Complete!
                </motion.p>

                {/* Signing card */}
                <motion.div
                  className="w-full bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-3.5"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <span className={cn('font-mono font-black text-xl', getRatingColor(player.overall))}>
                        {player.overall}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground font-display">{player.firstName} {player.lastName}</p>
                      <p className="text-[11px] text-muted-foreground">{player.position} · {player.age}y · <FlagIcon nationality={player.nationality} size={14} /></p>
                      <p className="text-[11px] text-emerald-400/80 mt-0.5">Welcome to {buyerClub.name}</p>
                    </div>
                  </div>
                </motion.div>

                {/* Deal summary */}
                <motion.div
                  className="w-full space-y-2 text-xs"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Fee</span>
                    <span className="text-base font-black text-primary tabular-nums">{formatMoney(finalFee)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Wages</span>
                    <span className="font-bold text-foreground tabular-nums">{formatWage(player.wage)}</span>
                  </div>
                  {finalFee < listing.askingPrice && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Saved</span>
                      <span className="font-bold text-emerald-400 tabular-nums">{formatMoney(listing.askingPrice - finalFee)}</span>
                    </div>
                  )}
                </motion.div>

                <motion.button
                  onClick={handleCloseAfterAccepted}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                >
                  Continue
                </motion.button>
              </motion.div>
            )}

            {/* ── RESULT: REJECTED ── */}
            {phase === 'result' && outcome === 'rejected' && (
              <motion.div
                key="rejected"
                className="p-6 flex flex-col items-center justify-center gap-4 min-h-[260px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, x: [0, -8, 8, -6, 6, -3, 3, 0] }}
                  transition={{ scale: { type: 'spring', stiffness: 300, damping: 15 }, x: { duration: 0.5, delay: 0.2 } }}
                >
                  <XCircle className="w-8 h-8 text-red-400" />
                </motion.div>

                <motion.div className="text-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <p className="text-lg font-black text-red-400 font-display">Rejected</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{resultMessage}</p>
                </motion.div>

                {/* Strike indicator */}
                <motion.div
                  className="flex flex-col items-center gap-1.5"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28 }}
                >
                  <StrikeIndicator strikes={strikeCount} latestOutcome="rejected" />
                  <p className="text-[10px] text-muted-foreground">
                    Strike {strikeCount}/{NEGOTIATION_MAX_STRIKES}
                  </p>
                </motion.div>

                {/* Final attempt warning */}
                {strikeCount === NEGOTIATION_MAX_STRIKES - 1 && (
                  <motion.p
                    className="text-[11px] font-semibold text-amber-400"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    Final attempt — make it count!
                  </motion.p>
                )}

                <motion.div className="flex gap-2 w-full mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                  <button type="button" onClick={onClose}
                    className={cn(
                      'py-2.5 rounded-xl text-sm font-semibold text-muted-foreground bg-muted/30 hover:bg-muted/50 active:scale-[0.98] transition-all',
                      strikeCount >= NEGOTIATION_MAX_STRIKES ? 'flex-1' : 'flex-1'
                    )}>
                    Walk Away
                  </button>
                  {strikeCount < NEGOTIATION_MAX_STRIKES ? (
                    <button type="button" onClick={handleRevise}
                      className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all">
                      <RotateCcw className="w-4 h-4" /> Revise Offer
                    </button>
                  ) : (
                    <div className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-red-400/70 bg-red-500/10 border border-red-500/20">
                      <Lock className="w-4 h-4" /> Locked Out
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* ── RESULT: COUNTER ── */}
            {phase === 'result' && outcome === 'counter' && (
              <motion.div
                key="counter"
                className="p-5 flex flex-col items-center justify-center gap-3 min-h-[300px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="w-14 h-14 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center"
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <Handshake className="w-7 h-7 text-amber-400" />
                </motion.div>

                <motion.div className="text-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <p className="text-lg font-black text-amber-400 font-display">Counter-Offer</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">{resultMessage}</p>
                </motion.div>

                {/* Price comparison */}
                <motion.div className="w-full" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <div className="flex items-center justify-center gap-3 py-3">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Your Bid</p>
                      <p className="text-sm font-bold text-muted-foreground line-through tabular-nums">{formatMoney(offerFee)}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                    <div className="text-center">
                      <p className="text-[10px] text-amber-400 mb-0.5">They Want</p>
                      <p className="text-base font-black text-amber-400 tabular-nums">{counterFee ? formatMoney(counterFee) : '?'}</p>
                    </div>
                  </div>

                  {/* Visual comparison bar — Your Bid / Counter / Asking on a scale */}
                  {counterFee && (() => {
                    const barMin = Math.min(offerFee, minFee);
                    const barMax = Math.max(counterFee, maxFee) * 1.05;
                    const barRange = barMax - barMin;
                    const bidPct = ((offerFee - barMin) / barRange) * 100;
                    const counterPct = ((counterFee - barMin) / barRange) * 100;
                    const askPct = ((listing.askingPrice - barMin) / barRange) * 100;
                    return (
                      <div className="relative h-2 bg-muted/30 rounded-full mx-2 mb-3">
                        {/* Fill from bid to counter */}
                        <div className="absolute top-0 bottom-0 bg-amber-500/20 rounded-full" style={{ left: `${bidPct}%`, width: `${counterPct - bidPct}%` }} />
                        {/* Your bid marker */}
                        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-muted-foreground border border-background" style={{ left: `${bidPct}%`, transform: `translate(-50%, -50%)` }} />
                        {/* Asking price marker */}
                        <div className="absolute top-0 bottom-0 w-px bg-primary/40" style={{ left: `${askPct}%` }} />
                        {/* Counter marker */}
                        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 border border-background" style={{ left: `${counterPct}%`, transform: `translate(-50%, -50%)` }} />
                        {/* Labels */}
                        <span className="absolute -bottom-3.5 text-[8px] text-muted-foreground -translate-x-1/2" style={{ left: `${bidPct}%` }}>You</span>
                        <span className="absolute -top-3.5 text-[8px] text-primary/60 -translate-x-1/2" style={{ left: `${askPct}%` }}>Ask</span>
                        <span className="absolute -bottom-3.5 text-[8px] text-amber-400 -translate-x-1/2" style={{ left: `${counterPct}%` }}>Counter</span>
                      </div>
                    );
                  })()}

                  {counterFee && (
                    <div className="text-center text-[10px] text-muted-foreground mt-2">
                      Budget after: <span className={cn('font-semibold', buyerClub.budget - counterFee >= 0 ? 'text-foreground' : 'text-red-400')}>{formatMoney(buyerClub.budget - counterFee)}</span>
                      <span className="mx-1.5">·</span>
                      <span className="text-amber-400">+{formatMoney(counterFee - offerFee)} more</span>
                    </div>
                  )}
                  {counterFee && counterFee > buyerClub.budget && (
                    <p className="text-[10px] text-red-400 text-center font-medium mt-1">
                      Insufficient budget
                    </p>
                  )}
                </motion.div>

                <motion.div className="flex gap-2 w-full mt-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                  <button type="button" onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground bg-muted/30 hover:bg-muted/50 active:scale-[0.98] transition-all">
                    Walk Away
                  </button>
                  <button type="button" onClick={handleRevise}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-semibold text-foreground bg-muted/50 hover:bg-muted/70 active:scale-[0.98] transition-all">
                    <RotateCcw className="w-3.5 h-3.5" /> Revise
                  </button>
                  {counterFee && counterFee <= buyerClub.budget && (
                    <button type="button" onClick={handleAcceptCounter}
                      className="flex-[1.5] flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all">
                      Accept <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          {/* Sticky action buttons */}
          {phase === 'negotiate' && !lockout.locked && (
            <div className="border-t border-border/30 bg-card/95 px-4 py-3">
              <button
                type="button"
                onClick={() => handleSubmitOffer(offerFee)}
                disabled={!evaluation || evaluation.budgetAfter < 0}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black active:scale-[0.98] transition-all',
                  evaluation && evaluation.budgetAfter < 0
                    ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
                )}
              >
                Submit Offer — {formatMoney(offerFee)} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
