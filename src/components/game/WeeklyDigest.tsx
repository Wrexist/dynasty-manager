import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import {
  DollarSign, Heart, AlertTriangle, Activity, Mail,
  TrendingUp, Dumbbell, Check, Circle, FileText, Search,
  ChevronDown, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatBarColor } from '@/utils/uiHelpers';

// ── Animation helpers ──

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

function sectionAnim(delay: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { ...spring, delay },
  };
}

function itemAnim(base: number, index: number) {
  return {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    transition: { ...spring, delay: base + index * 0.06 },
  };
}

// ── Animated stat bar for development items ──

function DevBar({ attribute, newValue, delay }: { attribute: string; newValue: number; delay: number }) {
  const pct = Math.min(100, (newValue / 99) * 100);
  const barColor = getStatBarColor(pct);
  const abbr = attribute.slice(0, 3).toUpperCase();

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] text-muted-foreground font-mono w-7 shrink-0">{abbr}</span>
      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.3, duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-mono font-bold text-foreground w-5 text-right">{newValue}</span>
      <motion.span
        className="text-[10px] font-bold text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15, delay: delay + 0.7 }}
      >
        +1
      </motion.span>
    </div>
  );
}

// ── Section header with gold accent ──

function SectionLabel({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <motion.div className="flex items-center gap-2 pt-1" {...sectionAnim(delay)}>
      <div className="w-4 h-px bg-primary/50" />
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{children}</p>
    </motion.div>
  );
}

// ── Main component ──

export function WeeklyDigest() {
  const digest = useGameStore(s => s.weeklyDigest);
  const week = useGameStore(s => s.week);
  const [devExpanded, setDevExpanded] = useState(false);

  const dismiss = () => {
    useGameStore.setState({ weeklyDigest: null });
  };

  if (!digest) return null;

  const netIncome = digest.incomeEarned - digest.expensesPaid;
  const hasEvents = digest.injuriesThisWeek.length > 0 || digest.recoveriesThisWeek.length > 0 || digest.offersReceived > 0;

  // Group development by player
  const devByPlayer: Record<string, { playerName: string; attrs: { attribute: string; newValue: number }[] }> = {};
  for (const d of digest.playerDevelopment) {
    if (!devByPlayer[d.playerName]) devByPlayer[d.playerName] = { playerName: d.playerName, attrs: [] };
    devByPlayer[d.playerName].attrs.push({ attribute: d.attribute, newValue: d.newValue });
  }
  const devEntries = Object.values(devByPlayer);
  const DEV_LIMIT = 4;
  const visibleDev = devExpanded ? devEntries : devEntries.slice(0, DEV_LIMIT);
  const hiddenDevCount = devEntries.length - DEV_LIMIT;

  // Headline
  const headline = digest.injuriesThisWeek.length >= 2
    ? 'Tough week — multiple injuries'
    : digest.moraleChange >= 8
    ? 'Spirits are soaring!'
    : digest.moraleChange <= -8
    ? 'Morale took a hit this week'
    : netIncome >= 200_000
    ? 'A great week for the finances'
    : digest.recoveriesThisWeek.length >= 2
    ? 'Good news from the treatment room'
    : digest.offersReceived >= 3
    ? 'Phones ringing off the hook!'
    : null;

  const headlineColor = digest.moraleChange >= 8 || netIncome >= 200_000 || digest.recoveriesThisWeek.length >= 2
    ? 'text-emerald-400'
    : digest.injuriesThisWeek.length >= 2 || digest.moraleChange <= -8
    ? 'text-destructive'
    : 'text-primary';

  // Track section delay for staggering
  let d = 0;
  const nextDelay = (step = 0.1) => { d += step; return d; };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 backdrop-blur-[2px] px-4 pb-8 safe-area-bottom"
        onClick={dismiss}
        onKeyDown={e => { if (e.key === 'Escape') dismiss(); }}
        role="dialog"
        aria-label="Weekly Summary"
      >
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="w-full max-w-sm bg-card/95 backdrop-blur-xl border border-primary/20 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.08)]"
          onClick={e => e.stopPropagation()}
        >
          {/* Scrollable content */}
          <div className="relative">
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-hide">

              {/* ── Header ── */}
              <motion.div className="flex items-center justify-between" {...sectionAnim(nextDelay(0))}>
                <div className="flex items-center gap-2">
                  <div className="bg-primary/15 border border-primary/30 rounded-lg px-2 py-0.5">
                    <span className="text-xs font-bold text-primary font-display">W{week}</span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground font-display">Summary</h3>
                </div>
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Weekly Digest</span>
              </motion.div>

              {/* ── Headline ── */}
              {headline && (
                <motion.p
                  className={cn('text-xs font-semibold', headlineColor)}
                  {...sectionAnim(nextDelay())}
                >
                  {headline}
                </motion.p>
              )}

              {/* ── Finance Row ── */}
              <motion.div className="flex gap-2" {...sectionAnim(nextDelay())}>
                {/* Net Income */}
                <div className={cn(
                  'flex-1 rounded-xl px-3 py-2.5 border',
                  netIncome >= 0
                    ? 'bg-emerald-500/8 border-emerald-500/20'
                    : 'bg-red-500/8 border-red-500/20'
                )}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <motion.div
                      animate={netIncome >= 0 ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.6, delay: 0.5 }}
                    >
                      <DollarSign className={cn('w-3.5 h-3.5', netIncome >= 0 ? 'text-emerald-400' : 'text-red-400')} />
                    </motion.div>
                    <span className="text-[10px] text-muted-foreground">Net Income</span>
                  </div>
                  <p className={cn('text-base font-bold tabular-nums', netIncome >= 0 ? 'text-emerald-400' : 'text-destructive')}>
                    {netIncome >= 0 ? '+' : ''}£{(Math.abs(netIncome) / 1e3).toFixed(0)}K
                  </p>
                </div>

                {/* Morale */}
                <div className={cn(
                  'flex-1 rounded-xl px-3 py-2.5 border',
                  digest.moraleChange > 0
                    ? 'bg-emerald-500/8 border-emerald-500/20'
                    : digest.moraleChange < 0
                    ? 'bg-red-500/8 border-red-500/20'
                    : 'bg-muted/30 border-border/30'
                )}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <motion.div
                      animate={digest.moraleChange > 0 ? { scale: [1, 1.25, 1] } : {}}
                      transition={{ duration: 0.5, delay: 0.6, repeat: 1 }}
                    >
                      <Heart className={cn(
                        'w-3.5 h-3.5',
                        digest.moraleChange > 0 ? 'text-emerald-400' : digest.moraleChange < 0 ? 'text-red-400' : 'text-muted-foreground'
                      )} />
                    </motion.div>
                    <span className="text-[10px] text-muted-foreground">Morale</span>
                  </div>
                  <p className={cn('text-base font-bold tabular-nums', digest.moraleChange > 0 ? 'text-emerald-400' : digest.moraleChange < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    {digest.moraleChange > 0 ? '+' : ''}{digest.moraleChange} pts
                  </p>
                </div>
              </motion.div>

              {/* ── Events ── */}
              {hasEvents && (
                <motion.div className="space-y-1.5" {...sectionAnim(nextDelay())}>
                  {digest.injuriesThisWeek.map((name, i) => (
                    <motion.div
                      key={`inj-${name}`}
                      className="flex items-center gap-2 text-xs bg-red-500/5 border-l-2 border-red-500 rounded-r-lg px-3 py-1.5"
                      {...itemAnim(d, i)}
                    >
                      <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                      <span className="text-destructive">{name} injured in training</span>
                    </motion.div>
                  ))}
                  {digest.recoveriesThisWeek.map((name, i) => (
                    <motion.div
                      key={`rec-${name}`}
                      className="flex items-center gap-2 text-xs bg-emerald-500/5 border-l-2 border-emerald-500 rounded-r-lg px-3 py-1.5"
                      {...itemAnim(d, digest.injuriesThisWeek.length + i)}
                    >
                      <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="text-emerald-400">{name} recovered from injury</span>
                    </motion.div>
                  ))}
                  {digest.offersReceived > 0 && (
                    <motion.div
                      className="flex items-center gap-2 text-xs bg-primary/5 border-l-2 border-primary rounded-r-lg px-3 py-1.5"
                      {...itemAnim(d, digest.injuriesThisWeek.length + digest.recoveriesThisWeek.length)}
                    >
                      <Mail className="w-3 h-3 text-primary shrink-0" />
                      <span className="text-foreground">{digest.offersReceived} new transfer offer{digest.offersReceived > 1 ? 's' : ''}</span>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ── Player Development ── */}
              {devEntries.length > 0 && (
                <div className="space-y-1.5">
                  <SectionLabel delay={nextDelay()}>Development</SectionLabel>
                  <AnimatePresence mode="popLayout">
                    {visibleDev.map((entry, pi) => (
                      <motion.div
                        key={entry.playerName}
                        className="bg-muted/20 rounded-lg px-3 py-2 space-y-1"
                        {...itemAnim(d, pi)}
                        layout
                      >
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="text-xs font-semibold text-foreground truncate">{entry.playerName}</span>
                        </div>
                        {entry.attrs.map((a, ai) => (
                          <DevBar
                            key={a.attribute}
                            attribute={a.attribute}
                            newValue={a.newValue}
                            delay={d + pi * 0.06 + ai * 0.1}
                          />
                        ))}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {hiddenDevCount > 0 && (
                    <motion.button
                      className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors w-full justify-center py-1"
                      onClick={() => setDevExpanded(!devExpanded)}
                      {...sectionAnim(d + 0.1)}
                    >
                      <span>{devExpanded ? 'Show less' : `+${hiddenDevCount} more player${hiddenDevCount > 1 ? 's' : ''}`}</span>
                      <motion.div animate={{ rotate: devExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-3 h-3" />
                      </motion.div>
                    </motion.button>
                  )}
                </div>
              )}

              {/* ── Training Gains ── */}
              {digest.trainingGains.length > 0 && (
                <div className="space-y-1.5">
                  <SectionLabel delay={nextDelay()}>Training</SectionLabel>
                  <motion.div className="flex flex-wrap gap-1.5" {...sectionAnim(d + 0.05)}>
                    {digest.trainingGains.slice(0, 6).map((g, i) => (
                      <motion.div
                        key={i}
                        className="inline-flex items-center gap-1.5 bg-muted/30 border border-border/30 rounded-full px-2.5 py-1 text-[11px]"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ ...spring, delay: d + 0.05 + i * 0.05 }}
                      >
                        <Dumbbell className="w-2.5 h-2.5 text-primary shrink-0" />
                        <span className="text-foreground truncate max-w-[120px]">{g.playerName}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-primary font-medium">{g.attribute}</span>
                      </motion.div>
                    ))}
                    {digest.trainingGains.length > 6 && (
                      <span className="inline-flex items-center text-[10px] text-muted-foreground px-2 py-1">
                        +{digest.trainingGains.length - 6} more
                      </span>
                    )}
                  </motion.div>
                </div>
              )}

              {/* ── Objectives ── */}
              {digest.objectiveProgress.length > 0 && (
                <div className="space-y-1.5">
                  <SectionLabel delay={nextDelay()}>Objectives</SectionLabel>
                  {digest.objectiveProgress.map((obj, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center gap-2 text-xs"
                      {...itemAnim(d, i)}
                    >
                      {obj.completed ? (
                        <>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 15, delay: d + i * 0.06 + 0.15 }}
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          </motion.div>
                          <span className="text-emerald-400 flex-1">{obj.title}</span>
                          <motion.span
                            className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 drop-shadow-[0_0_4px_hsl(43_96%_46%/0.4)]"
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: d + i * 0.06 + 0.3 }}
                          >
                            <Zap className="w-2.5 h-2.5 inline -mt-px mr-0.5" />
                            +{obj.xpEarned} XP
                          </motion.span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                          <span className="text-muted-foreground flex-1">{obj.title}</span>
                        </>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* ── Contract Warnings ── */}
              {digest.contractWarnings.length > 0 && (
                <motion.div
                  className="flex items-center gap-2 text-xs bg-amber-500/5 border-l-2 border-amber-400 rounded-r-lg px-3 py-1.5"
                  {...sectionAnim(nextDelay())}
                >
                  <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-amber-400">{digest.contractWarnings.length} contract{digest.contractWarnings.length > 1 ? 's' : ''} expiring soon</span>
                </motion.div>
              )}

              {/* ── Scout Reports ── */}
              {digest.scoutReportsCompleted > 0 && (
                <motion.div
                  className="flex items-center gap-2 text-xs bg-primary/5 border-l-2 border-primary rounded-r-lg px-3 py-1.5"
                  {...sectionAnim(nextDelay(0.05))}
                >
                  <Search className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-foreground">{digest.scoutReportsCompleted} scout report{digest.scoutReportsCompleted > 1 ? 's' : ''} ready</span>
                </motion.div>
              )}

            </div>

            {/* Bottom gradient fade for scroll hint */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card/95 to-transparent" />
          </div>

          {/* ── Continue Button ── */}
          <motion.div
            className="px-5 pb-4 pt-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: d + 0.15 }}
          >
            <Button className="w-full" onClick={dismiss}>
              Continue
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
