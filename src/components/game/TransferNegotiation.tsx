import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { TransferListing } from '@/types/game';
import { getRatingColor, getTop3Attributes, getChanceColor, getChanceBarColor, getChanceLabel } from '@/utils/uiHelpers';
import { formatWage } from '@/utils/contracts';
import { getFlag } from '@/utils/nationality';
import {
  X, TrendingUp, TrendingDown, Minus, Users, Banknote,
  Shield, ArrowRight, RotateCcw, Handshake, XCircle, CalendarClock, Star, AlertTriangle,
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

  const player = players[listing.playerId];
  const sellerClub = listing.externalPlayer
    ? { name: 'Unattached', shortName: 'Unattached', id: '' }
    : clubs[listing.sellerClubId] || { name: 'Unknown Club', shortName: 'Unknown', id: listing.sellerClubId };
  const buyerClub = clubs[playerClubId];

  const [offerFee, setOfferFee] = useState(listing.askingPrice);
  const [finalFee, setFinalFee] = useState<number>(listing.askingPrice);
  const [phase, setPhase] = useState<Phase>('negotiate');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [counterFee, setCounterFee] = useState<number | null>(null);

  const minFee = Math.round(listing.askingPrice * 0.5);
  const maxFee = Math.round(listing.askingPrice * 1.2);
  const step = Math.max(100_000, Math.round(listing.askingPrice * 0.01));

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  useScrollLock();

  const evaluation = useMemo(() => evaluateOffer(listing.playerId, offerFee), [listing.playerId, offerFee, evaluateOffer]);

  const top3 = useMemo(() => player ? getTop3Attributes(player.attributes) : [], [player]);

  const displayChance = useMemo(() => getInterpolatedChance(offerFee / listing.askingPrice), [offerFee, listing.askingPrice]);

  const particles = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      color: i % 4 === 0 ? '#eab308' : i % 4 === 1 ? '#22c55e' : i % 4 === 2 ? '#3b82f6' : '#f59e0b',
      left: 15 + Math.random() * 70,
      yTarget: -140 - Math.random() * 180,
      xTarget: (Math.random() - 0.5) * 160,
      duration: 1.5 + Math.random() * 0.8,
      delay: Math.random() * 0.5,
      size: 4 + Math.random() * 4,
    })),
  []);

  const handleSubmitOffer = useCallback((fee: number) => {
    setPhase('thinking');
    setFinalFee(fee);
    timersRef.current.push(setTimeout(() => {
      const result = makeOfferWithNegotiation(listing.playerId, fee);
      setOutcome(result.outcome);
      setResultMessage(result.message);
      if (result.outcome === 'counter' && result.counterFee) {
        setCounterFee(result.counterFee);
      }
      setPhase('result');
    }, 1500));
  }, [listing.playerId, makeOfferWithNegotiation]);

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
      setPhase('result');
    }, 1000));
  }, [counterFee, listing.playerId, executeTransfer]);

  const handleRevise = useCallback(() => {
    setPhase('negotiate');
    setOutcome(null);
    setResultMessage('');
    setCounterFee(null);
  }, []);

  const handleCloseAfterAccepted = useCallback(() => {
    if (shortlist.includes(listing.playerId)) {
      removeFromShortlist(listing.playerId);
    }
    onClose();
  }, [shortlist, listing.playerId, removeFromShortlist, onClose]);

  if (!player || !buyerClub) return null;

  const feeRatio = offerFee / listing.askingPrice;
  const valueDiff = player.value > 0 ? ((listing.askingPrice - player.value) / player.value) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ touchAction: 'none' }} onClick={phase !== 'thinking' ? onClose : undefined} />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-sm mx-4 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden"
          initial={{ scale: 0.85, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
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
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <Handshake className="w-5 h-5 text-primary" />
                    <p className="text-sm font-bold text-foreground font-display">Transfer Negotiation</p>
                  </div>
                  <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Player Card */}
                  <motion.div
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <span className={cn('font-mono font-black text-2xl', getRatingColor(player.overall))}>
                        {player.overall}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground font-display">{player.firstName} {player.lastName}</p>
                      <p className="text-xs text-muted-foreground">{player.position} · {player.age}y · {getFlag(player.nationality)} {player.nationality}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        From <span className="text-foreground">{sellerClub.name}</span>
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        {top3.map(attr => (
                          <span key={attr.label} className="text-[10px] font-mono bg-muted/70 px-1.5 py-0.5 rounded">
                            <span className="text-muted-foreground">{attr.label}</span>{' '}
                            <span className={cn('font-bold', getRatingColor(attr.value))}>{attr.value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* Valuation Insight */}
                  <motion.div
                    className="bg-muted/20 rounded-xl p-3 space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Market Value</span>
                      <span className="text-foreground font-semibold">£{(player.value / 1e6).toFixed(1)}M</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Asking Price</span>
                      <div className="flex items-center gap-1">
                        <span className="text-primary font-bold">£{(listing.askingPrice / 1e6).toFixed(1)}M</span>
                        {valueDiff > 5 && <TrendingUp className="w-3 h-3 text-red-400" />}
                        {valueDiff < -5 && <TrendingDown className="w-3 h-3 text-emerald-400" />}
                        {Math.abs(valueDiff) <= 5 && <Minus className="w-3 h-3 text-muted-foreground" />}
                        <span className={cn('text-[10px]',
                          valueDiff > 5 ? 'text-red-400' : valueDiff < -5 ? 'text-emerald-400' : 'text-muted-foreground'
                        )}>
                          {valueDiff > 0 ? '+' : ''}{valueDiff.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Wage</span>
                      <span className="text-foreground">{formatWage(player.wage)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Form / Morale</span>
                      <div className="flex items-center gap-2">
                        <span className={cn('font-semibold', player.form >= 70 ? 'text-emerald-400' : player.form >= 40 ? 'text-amber-400' : 'text-red-400')}>
                          {player.form >= 70 ? 'Good' : player.form >= 40 ? 'Average' : 'Poor'}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className={cn('font-semibold', player.morale >= 70 ? 'text-emerald-400' : player.morale >= 40 ? 'text-amber-400' : 'text-red-400')}>
                          {player.morale >= 70 ? 'Happy' : player.morale >= 40 ? 'Content' : 'Unhappy'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Contract</span>
                      <span className="text-foreground">
                        {player.contractEnd - season} year{player.contractEnd - season !== 1 ? 's' : ''} remaining
                      </span>
                    </div>
                    {player.potential > player.overall && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Potential</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-primary" />
                          <span className={cn('font-semibold', getRatingColor(player.potential))}>
                            {player.potential}
                          </span>
                          <span className="text-[10px] text-emerald-400">+{player.potential - player.overall}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {/* Fee Slider */}
                  <motion.div
                    className="space-y-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground font-medium">Your Offer</label>
                      <span className="text-lg font-black text-primary font-display tabular-nums">
                        £{(offerFee / 1e6).toFixed(1)}M
                      </span>
                    </div>
                    <input
                      type="range"
                      min={minFee}
                      max={maxFee}
                      step={step}
                      value={offerFee}
                      onChange={(e) => setOfferFee(Number(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-full accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                      <span>£{(minFee / 1e6).toFixed(1)}M</span>
                      <span className={cn('font-semibold',
                        feeRatio >= 1 ? 'text-emerald-400' : feeRatio >= 0.8 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {Math.round(feeRatio * 100)}% of asking
                      </span>
                      <span>£{(maxFee / 1e6).toFixed(1)}M</span>
                    </div>
                  </motion.div>

                  {/* Acceptance Gauge */}
                  {evaluation && (
                    <motion.div
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Acceptance Likelihood</span>
                        <span className={cn('font-bold', getChanceColor(displayChance))}>
                          {getChanceLabel(displayChance)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', getChanceBarColor(displayChance))}
                          animate={{ width: `${displayChance * 100}%` }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Deal Impact */}
                  {evaluation && (
                    <motion.div
                      className="grid grid-cols-3 gap-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div className="bg-muted/20 rounded-lg p-2.5 flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Budget After</p>
                          <p className={cn('text-xs font-bold tabular-nums',
                            evaluation.budgetAfter >= 0 ? 'text-foreground' : 'text-red-400'
                          )}>
                            £{(evaluation.budgetAfter / 1e6).toFixed(1)}M
                          </p>
                        </div>
                      </div>
                      <div className="bg-muted/20 rounded-lg p-2.5 flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">{player.position}s / Squad</p>
                          <p className="text-xs font-bold text-foreground">
                            {evaluation.positionCount}+1 / {evaluation.totalSquadSize}+1
                          </p>
                        </div>
                      </div>
                      <div className="bg-muted/20 rounded-lg p-2.5 flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Wage Bill</p>
                          <p className="text-xs font-bold text-foreground tabular-nums">
                            +{formatWage(evaluation.wageImpact)}
                          </p>
                        </div>
                      </div>
                      {evaluation.wouldTriggerSellOn && (
                        <div className="col-span-3 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                          <p className="text-[10px] text-amber-400">
                            ~{evaluation.sellOnPct}% sell-on clause will apply to future sale
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Warnings */}
                  {evaluation && evaluation.budgetAfter < 0 && (
                    <p className="text-[10px] text-red-400 text-center font-medium">
                      Insufficient budget for this offer
                    </p>
                  )}
                  {player.contractEnd - season <= 1 && (
                    <div className="flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <p className="text-[10px] text-amber-400">
                        Contract expiring {player.contractEnd - season <= 0 ? 'this season' : 'next season'} — risky signing without renewal
                      </p>
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* ── THINKING PHASE ── */}
            {phase === 'thinking' && (
              <motion.div
                key="thinking"
                className="p-8 flex flex-col items-center justify-center gap-4 min-h-[280px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1], borderColor: ['rgba(234,179,8,0.3)', 'rgba(234,179,8,0.6)', 'rgba(234,179,8,0.3)'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Handshake className="w-7 h-7 text-primary" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground font-display">Negotiating...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sellerClub.shortName} are considering your offer
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── RESULT PHASE ── */}
            {phase === 'result' && outcome === 'accepted' && (
              <motion.div
                key="accepted"
                className="relative p-6 flex flex-col items-center justify-center gap-4 min-h-[380px] overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Celebration Particles */}
                {particles.map((p, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      backgroundColor: p.color,
                      left: `${p.left}%`,
                      top: '55%',
                      width: p.size,
                      height: p.size,
                    }}
                    animate={{
                      opacity: [1, 1, 0],
                      y: [0, p.yTarget],
                      x: [0, p.xTarget],
                      scale: [1, 0.3],
                      rotate: [0, 360],
                    }}
                    transition={{ duration: p.duration, delay: p.delay }}
                  />
                ))}

                {/* Title */}
                <motion.p
                  className="text-xl font-black text-emerald-400 font-display tracking-wide"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Deal Complete!
                </motion.p>

                {/* New Signing Card */}
                <motion.div
                  className="w-full bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center shrink-0">
                      <span className={cn('font-mono font-black text-2xl', getRatingColor(player.overall))}>
                        {player.overall}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground font-display text-base">
                        {player.firstName} {player.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {player.position} · {player.age}y · {getFlag(player.nationality)} {player.nationality}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Welcome to <span className="text-foreground font-medium">{buyerClub.name}</span>
                      </p>
                      {player.potential > player.overall && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Star className="w-3 h-3 text-primary" />
                          <span className="text-xs font-bold text-primary">{player.potential}</span>
                          <span className="text-[10px] text-muted-foreground">potential</span>
                          <span className="text-[10px] font-bold text-emerald-400">+{player.potential - player.overall}</span>
                        </div>
                      )}
                      <div className="flex gap-1.5 mt-2">
                        {top3.map(attr => (
                          <span key={attr.label} className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                            <span className="text-muted-foreground">{attr.label}</span>{' '}
                            <span className={cn('font-bold', getRatingColor(attr.value))}>{attr.value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Deal summary card */}
                <motion.div
                  className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 w-full space-y-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Transfer Fee</span>
                    <span className="text-xl font-black text-primary tabular-nums">£{(finalFee / 1e6).toFixed(1)}M</span>
                  </div>
                  <div className="h-px bg-emerald-500/20" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Wages</span>
                    <span className="text-sm font-bold text-foreground tabular-nums">{formatWage(player.wage)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Contract</span>
                    <span className="text-sm font-bold text-foreground">
                      {player.contractEnd - season} year{player.contractEnd - season !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {finalFee < listing.askingPrice && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Saved vs Asking</span>
                      <span className="text-sm font-bold text-emerald-400 tabular-nums">
                        £{((listing.askingPrice - finalFee) / 1e6).toFixed(1)}M
                      </span>
                    </div>
                  )}
                  {top3.length > 0 && (
                    <>
                      <div className="h-px bg-emerald-500/20" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Top Skills</span>
                        <div className="flex gap-1.5">
                          {top3.map(attr => (
                            <span key={attr.label} className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                              <span className="text-muted-foreground">{attr.label}</span>{' '}
                              <span className={cn('font-bold', getRatingColor(attr.value))}>{attr.value}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>

                <motion.button
                  onClick={handleCloseAfterAccepted}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all mt-1 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  Continue
                </motion.button>
              </motion.div>
            )}

            {phase === 'result' && outcome === 'rejected' && (
              <motion.div
                key="rejected"
                className="p-6 flex flex-col items-center justify-center gap-4 min-h-[300px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, x: [0, -8, 8, -6, 6, -3, 3, 0] }}
                  transition={{ scale: { type: 'spring', stiffness: 300, damping: 15 }, x: { duration: 0.5, delay: 0.2 } }}
                >
                  <XCircle className="w-10 h-10 text-red-400" />
                </motion.div>

                <motion.div
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-lg font-black text-red-400 font-display">Offer Rejected</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{resultMessage}</p>
                </motion.div>

                <motion.div
                  className="flex gap-2 w-full mt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground bg-muted/30 hover:bg-muted/50 active:scale-[0.98] transition-all"
                  >
                    Walk Away
                  </button>
                  <button
                    type="button"
                    onClick={handleRevise}
                    className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(234,179,8,0.15)]"
                  >
                    <RotateCcw className="w-4 h-4" /> Revise Offer
                  </button>
                </motion.div>
              </motion.div>
            )}

            {phase === 'result' && outcome === 'counter' && (
              <motion.div
                key="counter"
                className="p-6 flex flex-col items-center justify-center gap-4 min-h-[340px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center"
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <Handshake className="w-8 h-8 text-amber-400" />
                </motion.div>

                <motion.div
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <p className="text-lg font-black text-amber-400 font-display">Counter-Offer</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">{resultMessage}</p>
                </motion.div>

                {/* Counter details */}
                <motion.div
                  className="w-full space-y-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/20 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">Your Bid</p>
                      <p className="text-sm font-bold text-muted-foreground line-through tabular-nums">£{(offerFee / 1e6).toFixed(1)}M</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-amber-400 mb-1">They Want</p>
                      <p className="text-sm font-black text-amber-400 tabular-nums">£{counterFee ? (counterFee / 1e6).toFixed(1) : '?'}M</p>
                    </div>
                  </div>
                  {counterFee && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                        <span>Budget after: £{((buyerClub.budget - counterFee) / 1e6).toFixed(1)}M</span>
                        <span className="text-amber-400 font-semibold">
                          +£{((counterFee - offerFee) / 1e6).toFixed(1)}M more
                        </span>
                      </div>
                      {counterFee > buyerClub.budget && (
                        <p className="text-[10px] text-red-400 text-center font-medium">
                          Insufficient budget to accept this counter-offer
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>

                <motion.div
                  className="flex gap-2 w-full mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground bg-muted/30 hover:bg-muted/50 active:scale-[0.98] transition-all"
                  >
                    Walk Away
                  </button>
                  <button
                    type="button"
                    onClick={handleRevise}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-semibold text-foreground bg-muted/50 hover:bg-muted/70 active:scale-[0.98] transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Revise
                  </button>
                  {counterFee && counterFee <= buyerClub.budget && (
                    <button
                      type="button"
                      onClick={handleAcceptCounter}
                      className="flex-[1.5] flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(234,179,8,0.15)]"
                    >
                      Accept <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          {/* Sticky action buttons — always visible at bottom */}
          {phase === 'negotiate' && (
            <div className="border-t border-border/30 bg-card/95 px-4 py-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-muted-foreground bg-muted/30 hover:bg-muted/50 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitOffer(offerFee)}
                  disabled={evaluation ? evaluation.budgetAfter < 0 : false}
                  className={cn(
                    'flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-black active:scale-[0.98] transition-all',
                    evaluation && evaluation.budgetAfter < 0
                      ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_24px_rgba(234,179,8,0.25)]'
                  )}
                >
                  Submit Offer <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
