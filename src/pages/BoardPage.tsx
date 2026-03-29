import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getSuffix } from '@/utils/helpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { AnimatedNumber } from '@/components/game/AnimatedNumber';
import { PageHint } from '@/components/game/PageHint';
import {
  Target, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, Circle,
  TrendingUp, TrendingDown, Swords, DollarSign, Flame, Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { getConfidenceColor, getConfidenceRisk } from '@/utils/uiHelpers';
import { usePlayerClub, useLeaguePosition } from '@/hooks/useGameSelectors';
import {
  CONFIDENCE_WIN_CHANGE, CONFIDENCE_LOSS_CHANGE, CONFIDENCE_WIN_STREAK_BONUS,
  CONFIDENCE_LOSS_STREAK_PENALTY, CONFIDENCE_STREAK_LENGTH,
  getExpectedPosition,
} from '@/config/gameBalance';

/* ── Animated SVG circular gauge ── */
function ConfidenceGauge({ value }: { value: number }) {
  const radius = 70;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  // Gauge spans 240 degrees (from 150° to 390°)
  const arcLength = (240 / 360) * circumference;
  const filled = (value / 100) * arcLength;

  const { textClass } = getConfidenceColor(value);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="180" height="160" viewBox="0 0 180 160" className="overflow-visible">
        {/* Subtle glow behind the gauge */}
        <defs>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(0 70% 50%)" />
            <stop offset="40%" stopColor="hsl(35 90% 50%)" />
            <stop offset="100%" stopColor="hsl(145 70% 45%)" />
          </linearGradient>
        </defs>
        {/* Background arc */}
        <circle
          cx="90" cy="95" r={radius}
          fill="none"
          stroke="hsl(var(--muted) / 0.2)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          transform="rotate(150 90 95)"
        />
        {/* Filled arc */}
        <motion.circle
          cx="90" cy="95" r={radius}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: arcLength - filled }}
          transition={{ duration: 1.2, ease: [0.33, 1, 0.68, 1] }}
          transform="rotate(150 90 95)"
          filter="url(#gauge-glow)"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <AnimatedNumber
          value={value}
          formatFn={(n) => Math.round(n) + '%'}
          className={cn('text-4xl font-black font-display tabular-nums', textClass)}
          duration={800}
        />
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
          Confidence
        </span>
      </div>
    </div>
  );
}

/* ── Stagger animation wrapper ── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ── Page ── */
const BoardPage = () => {
  const { boardConfidence, boardObjectives, season, seasonHistory } = useGameStore();
  const club = usePlayerClub();
  const pos = useLeaguePosition();

  const riskLevel = getConfidenceRisk(boardConfidence);

  // Generate dynamic "how to improve" tips
  const tips = useMemo(() => {
    if (!club) return [];
    const t: { icon: React.ReactNode; text: string; priority: 'high' | 'medium' | 'low' }[] = [];
    const expectedPos = getExpectedPosition(club.reputation);

    if (boardConfidence < 40) {
      t.push({ icon: <Swords className="w-4 h-4" />, text: `Win matches — each win adds +${CONFIDENCE_WIN_CHANGE}% confidence`, priority: 'high' });
    }
    if (typeof pos === 'number' && pos > expectedPos) {
      t.push({ icon: <TrendingUp className="w-4 h-4" />, text: `Improve league position (${pos}${getSuffix(pos)} → target top ${expectedPos})`, priority: 'high' });
    }
    if (boardConfidence < 60) {
      t.push({ icon: <Flame className="w-4 h-4" />, text: `Build a ${CONFIDENCE_STREAK_LENGTH}-match win streak for +${CONFIDENCE_WIN_STREAK_BONUS}% bonus`, priority: 'medium' });
    }
    if (club.budget < 0) {
      t.push({ icon: <DollarSign className="w-4 h-4" />, text: 'Get finances under control — overspending hurts confidence', priority: 'high' });
    }
    if (boardConfidence >= 60 && typeof pos === 'number' && pos <= expectedPos) {
      t.push({ icon: <Award className="w-4 h-4" />, text: 'Keep up the good work — maintain your league position', priority: 'low' });
    }
    // Always show a loss warning
    t.push({ icon: <TrendingDown className="w-4 h-4" />, text: `Avoid defeats — each loss costs ${Math.abs(CONFIDENCE_LOSS_CHANGE)}% (losing streak: ${Math.abs(CONFIDENCE_LOSS_STREAK_PENALTY)}% extra)`, priority: 'medium' });

    return t;
  }, [boardConfidence, club, pos]);

  const completedCount = boardObjectives.filter(o => o.completed).length;
  const objectiveProgress = boardObjectives.length > 0 ? (completedCount / boardObjectives.length) * 100 : 0;

  return (
    <motion.div
      className="max-w-lg mx-auto px-4 py-4 space-y-3"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <PageHint
        screen="board"
        title="Board Room"
        body="The board tracks your performance against seasonal objectives. Keep confidence high by meeting targets — drop too low and you risk the sack. Check verdicts after each objective deadline."
      />

      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <h2 className="text-lg font-display font-bold text-foreground">Board Room</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-primary/40 to-transparent" />
      </motion.div>

      {/* Confidence Gauge Card */}
      <motion.div variants={fadeUp}>
        <GlassPanel className={cn(
          'p-5 border-primary/20',
          riskLevel === 'danger' && 'border-destructive/40',
        )}>
          <ConfidenceGauge value={boardConfidence} />

          {/* Risk Badge */}
          <div className="flex justify-center mt-2">
            <div className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
              riskLevel === 'safe' ? 'bg-emerald-500/15 text-emerald-400' :
              riskLevel === 'warning' ? 'bg-amber-500/15 text-amber-400' :
              'bg-destructive/15 text-destructive',
            )}>
              {riskLevel === 'safe' ? <ShieldCheck className="w-3.5 h-3.5" /> :
               riskLevel === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> :
               <ShieldAlert className="w-3.5 h-3.5" />}
              {riskLevel === 'safe' ? 'Position Secure' : riskLevel === 'warning' ? 'Under Pressure' : 'Job at Risk'}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Chairman's Statement */}
      <motion.div variants={fadeUp}>
        <GlassPanel className="p-4 border-primary/10">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Chairman's Statement</p>
          <div className="relative pl-3 border-l-2 border-primary/30">
            <p className="text-sm text-foreground/90 leading-relaxed italic">
              {boardConfidence >= 80
                ? `"The board is extremely pleased with your leadership of ${club?.name || 'the club'}. Your work has exceeded expectations and the fans are behind you."`
                : boardConfidence >= 60
                ? `"The board is satisfied with the current direction. Continue building on recent performances."`
                : boardConfidence >= 40
                ? `"The board has noted some inconsistency. While your position is not under immediate threat, improvement is expected."`
                : boardConfidence >= 20
                ? `"The board is growing increasingly concerned. Unless results improve significantly, we may need to consider our options."`
                : `"The board's patience has been severely tested. Immediate improvement is required or your position will become untenable."`
              }
            </p>
          </div>
        </GlassPanel>
      </motion.div>

      {/* How to Improve Confidence */}
      <motion.div variants={fadeUp}>
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">How to Gain Confidence</h3>
          </div>
          <div className="space-y-2">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className={cn(
                  'mt-0.5 shrink-0',
                  tip.priority === 'high' ? 'text-primary' :
                  tip.priority === 'medium' ? 'text-amber-400' : 'text-emerald-400',
                )}>
                  {tip.icon}
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Season Objectives */}
      <motion.div variants={fadeUp}>
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Season {season} Objectives</h3>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {completedCount}/{boardObjectives.length} complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${objectiveProgress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            />
          </div>

          <div className="space-y-2.5">
            {boardObjectives.map(obj => (
              <div key={obj.id} className={cn(
                "flex items-start gap-2.5 p-2 rounded-lg transition-colors",
                obj.completed ? "bg-emerald-500/5" : "bg-transparent",
              )}>
                {obj.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className={cn('w-4 h-4 shrink-0 mt-0.5',
                    obj.priority === 'critical' ? 'text-destructive' : obj.priority === 'important' ? 'text-amber-400' : 'text-muted-foreground'
                  )} />
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', obj.completed ? 'text-muted-foreground line-through' : 'text-foreground')}>
                    {obj.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('text-[10px] font-semibold uppercase',
                      obj.priority === 'critical' ? 'text-destructive' : obj.priority === 'important' ? 'text-amber-400' : 'text-muted-foreground'
                    )}>
                      {obj.priority}
                    </span>
                    {typeof pos === 'number' && !obj.completed && (
                      <span className="text-[10px] text-muted-foreground">Currently {pos}{getSuffix(pos)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Club Philosophy */}
      <motion.div variants={fadeUp}>
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Club Philosophy</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Club Reputation</span>
                <span className="text-foreground font-semibold">{club?.reputation || 3}/5</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <motion.div
                    key={i}
                    className={cn('h-2 flex-1 rounded-sm', i < (club?.reputation || 3) ? 'bg-primary' : 'bg-muted/20')}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
                    style={{ transformOrigin: 'left' }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Board Patience</span>
                <span className="text-foreground font-semibold">{club?.boardPatience || 5}/10</span>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 10 }, (_, i) => (
                  <motion.div
                    key={i}
                    className={cn('h-2 flex-1 rounded-sm', i < (club?.boardPatience || 5) ? 'bg-amber-400' : 'bg-muted/20')}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.3, delay: 0.6 + i * 0.03 }}
                    style={{ transformOrigin: 'left' }}
                  />
                ))}
              </div>
            </div>
            {typeof pos === 'number' && club && (
              <div className="flex justify-between text-xs pt-1 border-t border-border/30">
                <span className="text-muted-foreground">Expected Position</span>
                <span className="text-foreground font-semibold">Top {getExpectedPosition(club.reputation)}</span>
              </div>
            )}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Season History */}
      {seasonHistory.length > 0 && (
        <motion.div variants={fadeUp}>
          <GlassPanel className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Previous Seasons</h3>
            <div className="space-y-2">
              {seasonHistory.map((h, i) => (
                <motion.div
                  key={h.season}
                  className="flex items-center justify-between py-1.5"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-14">Season {h.season}</span>
                    <span className="text-sm font-semibold text-foreground">{h.position}{getSuffix(h.position)}</span>
                  </div>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold',
                    h.boardVerdict === 'excellent' ? 'bg-emerald-500/15 text-emerald-400'
                    : h.boardVerdict === 'good' ? 'bg-primary/15 text-primary'
                    : h.boardVerdict === 'acceptable' ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-destructive/15 text-destructive'
                  )}>
                    {h.boardVerdict}
                  </span>
                </motion.div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* Bottom spacer for safe-area */}
      <div className="h-2" />
    </motion.div>
  );
};

export default BoardPage;
