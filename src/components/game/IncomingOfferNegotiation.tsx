import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { IncomingOffer } from '@/types/game';
import { getRatingColor, getTop3Attributes, getChanceColor, getChanceBarColor, getChanceLabel } from '@/utils/uiHelpers';
import { formatWage } from '@/utils/contracts';
import { getFlag } from '@/utils/nationality';
import { INCOMING_NEGOTIATE_MAX_MULTIPLIER } from '@/config/transfers';
import {
  X, Banknote, Users, Shield, ArrowRight, RotateCcw, Handshake, XCircle,
} from 'lucide-react';

interface Props {
  offer: IncomingOffer;
  onClose: () => void;
}

type Phase = 'negotiate' | 'thinking' | 'result';
type Outcome = 'accepted' | 'rejected' | 'counter';

export function IncomingOfferNegotiation({ offer, onClose }: Props) {
  const { players, clubs, playerClubId, evaluateIncomingCounter, negotiateIncomingOffer, acceptIncomingOfferAtFee, season } = useGameStore();

  const player = players[offer.playerId];
  const buyerClub = clubs[offer.buyerClubId];
  const sellerClub = clubs[playerClubId];

  const minFee = offer.fee;
  const maxFee = Math.max(Math.round((player?.value || offer.fee) * INCOMING_NEGOTIATE_MAX_MULTIPLIER), Math.round(offer.fee * 1.1));
  const step = Math.max(100_000, Math.round((maxFee - minFee) * 0.01));

  const [counterFee, setCounterFee] = useState(Math.round((minFee + maxFee) / 2));
  const [finalFee, setFinalFee] = useState(offer.fee);
  const [phase, setPhase] = useState<Phase>('negotiate');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [buyerCounterFee, setBuyerCounterFee] = useState<number | null>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  useScrollLock();

  const evaluation = useMemo(() => evaluateIncomingCounter(offer.id, counterFee), [offer.id, counterFee, evaluateIncomingCounter]);

  const top3 = useMemo(() => player ? getTop3Attributes(player.attributes) : [], [player]);

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

  const handleSubmitCounter = useCallback((fee: number) => {
    setPhase('thinking');
    setFinalFee(fee);
    timersRef.current.push(setTimeout(() => {
      const result = negotiateIncomingOffer(offer.id, fee);
      setOutcome(result.outcome);
      setResultMessage(result.message);
      if (result.outcome === 'counter' && result.counterFee) {
        setBuyerCounterFee(result.counterFee);
      }
      setPhase('result');
    }, 1500));
  }, [offer.id, negotiateIncomingOffer]);

  const handleAcceptBuyerCounter = useCallback(() => {
    if (!buyerCounterFee) return;
    const fee = buyerCounterFee;
    setPhase('thinking');
    setFinalFee(fee);
    setBuyerCounterFee(null);
    timersRef.current.push(setTimeout(() => {
      const result = acceptIncomingOfferAtFee(offer.id, fee);
      setOutcome(result.success ? 'accepted' : 'rejected');
      setResultMessage(result.message);
      setPhase('result');
    }, 1000));
  }, [buyerCounterFee, offer.id, acceptIncomingOfferAtFee]);

  const handleRevise = useCallback(() => {
    setPhase('negotiate');
    setOutcome(null);
    setResultMessage('');
    setBuyerCounterFee(null);
  }, []);

  if (!player || !buyerClub || !sellerClub) return null;

  const feeRatio = counterFee / offer.fee;
  const valueDiff = player.value > 0 ? ((offer.fee - player.value) / player.value) * 100 : 0;

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
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" style={{ touchAction: 'none' }} onClick={phase === 'negotiate' ? onClose : undefined} />

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
                    <p className="text-sm font-bold text-foreground font-display">Counter-Offer</p>
                  </div>
                  <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
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
                        Bid from <span className="text-foreground">{buyerClub.name}</span>
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
                      <span className="text-muted-foreground">Their Offer</span>
                      <span className="text-primary font-bold">£{(offer.fee / 1e6).toFixed(1)}M</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">vs Value</span>
                      <span className={cn('font-semibold text-xs',
                        valueDiff >= 5 ? 'text-emerald-400' : valueDiff <= -5 ? 'text-red-400' : 'text-muted-foreground'
                      )}>
                        {valueDiff > 0 ? '+' : ''}{valueDiff.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Wage Saved</span>
                      <span className="text-emerald-400 font-semibold">{formatWage(player.wage)}/wk</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Contract</span>
                      <span className="text-foreground">
                        {player.contractEnd - season} year{player.contractEnd - season !== 1 ? 's' : ''} remaining
                      </span>
                    </div>
                  </motion.div>

                  {/* Fee Slider */}
                  <motion.div
                    className="space-y-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground font-medium">Your Counter-Offer</label>
                      <span className="text-lg font-black text-primary font-display tabular-nums">
                        £{(counterFee / 1e6).toFixed(1)}M
                      </span>
                    </div>
                    <input
                      type="range"
                      min={minFee}
                      max={maxFee}
                      step={step}
                      value={counterFee}
                      onChange={(e) => setCounterFee(Number(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-full accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                      <span>£{(minFee / 1e6).toFixed(1)}M</span>
                      <span className={cn('font-semibold',
                        feeRatio <= 1.1 ? 'text-emerald-400' : feeRatio <= 1.3 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {Math.round(feeRatio * 100)}% of bid
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
                        <span className={cn('font-bold', getChanceColor(evaluation.acceptChance))}>
                          {getChanceLabel(evaluation.acceptChance)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', getChanceBarColor(evaluation.acceptChance))}
                          animate={{ width: `${evaluation.acceptChance * 100}%` }}
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
                          <p className="text-xs font-bold text-emerald-400 tabular-nums">
                            £{(evaluation.budgetAfter / 1e6).toFixed(1)}M
                          </p>
                        </div>
                      </div>
                      <div className="bg-muted/20 rounded-lg p-2.5 flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Squad After</p>
                          <p className="text-xs font-bold text-foreground">
                            {evaluation.squadSizeAfter}
                          </p>
                        </div>
                      </div>
                      <div className="bg-muted/20 rounded-lg p-2.5 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">{player.position}s Left</p>
                          <p className={cn('text-xs font-bold', evaluation.positionCountAfter <= 1 ? 'text-red-400' : 'text-foreground')}>
                            {evaluation.positionCountAfter}
                          </p>
                        </div>
                      </div>
                    </motion.div>
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
                    {buyerClub.shortName || buyerClub.name} are considering your counter-offer
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

            {/* ── RESULT: ACCEPTED ── */}
            {phase === 'result' && outcome === 'accepted' && (
              <motion.div
                key="accepted"
                className="relative p-6 flex flex-col items-center justify-center gap-4 min-h-[340px] overflow-hidden"
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

                <motion.p
                  className="text-xl font-black text-emerald-400 font-display tracking-wide"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Sale Complete!
                </motion.p>

                {/* Deal summary */}
                <motion.div
                  className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 w-full space-y-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center shrink-0">
                      <span className={cn('font-mono font-black text-xl', getRatingColor(player.overall))}>
                        {player.overall}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground font-display">
                        {player.firstName} {player.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {player.position} · {player.age}y · Sold to <span className="text-foreground font-medium">{buyerClub.name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-emerald-500/20" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Transfer Fee</span>
                    <span className="text-xl font-black text-primary tabular-nums">£{(finalFee / 1e6).toFixed(1)}M</span>
                  </div>
                  {finalFee > offer.fee && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Extra Earned</span>
                      <span className="text-sm font-bold text-emerald-400 tabular-nums">
                        +£{((finalFee - offer.fee) / 1e6).toFixed(1)}M
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Wage Saved</span>
                    <span className="text-sm font-bold text-foreground">{formatWage(player.wage)}/wk</span>
                  </div>
                </motion.div>

                <motion.button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all mt-1 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Continue
                </motion.button>
              </motion.div>
            )}

            {/* ── RESULT: REJECTED ── */}
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
                  <p className="text-lg font-black text-red-400 font-display">Counter Rejected</p>
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
                    <RotateCcw className="w-4 h-4" /> Revise Counter
                  </button>
                </motion.div>
              </motion.div>
            )}

            {/* ── RESULT: COUNTER-OFFER ── */}
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
                  <p className="text-lg font-black text-amber-400 font-display">Revised Offer</p>
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
                      <p className="text-[10px] text-muted-foreground mb-1">You Asked</p>
                      <p className="text-sm font-bold text-muted-foreground line-through tabular-nums">£{(counterFee / 1e6).toFixed(1)}M</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-amber-400 mb-1">They Offer</p>
                      <p className="text-sm font-black text-amber-400 tabular-nums">£{buyerCounterFee ? (buyerCounterFee / 1e6).toFixed(1) : '?'}M</p>
                    </div>
                  </div>
                  {buyerCounterFee && (
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                      <span>Budget after: £{((sellerClub.budget + buyerCounterFee) / 1e6).toFixed(1)}M</span>
                      <span className="text-emerald-400 font-semibold">
                        +£{((buyerCounterFee - offer.fee) / 1e6).toFixed(1)}M vs original
                      </span>
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
                  {buyerCounterFee && (
                    <button
                      type="button"
                      onClick={handleAcceptBuyerCounter}
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

          {/* Sticky action buttons — negotiate phase */}
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
                  onClick={() => handleSubmitCounter(counterFee)}
                  className="flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-black bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_0_24px_rgba(234,179,8,0.25)]"
                >
                  Submit Counter <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
