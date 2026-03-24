import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { getSuffix } from '@/utils/helpers';
import { getExpectedPosition } from '@/config/gameBalance';
import { Trophy, TrendingUp, TrendingDown, Target, Minus } from 'lucide-react';

interface MidSeasonReportProps {
  onDismiss: () => void;
}

export function MidSeasonReport({ onDismiss }: MidSeasonReportProps) {
  const { playerClubId, clubs, players, leagueTable, fixtures, boardConfidence, season } = useGameStore();
  const club = clubs[playerClubId];
  if (!club) return null;

  const entry = leagueTable.find(e => e.clubId === playerClubId);
  const pos = entry ? leagueTable.indexOf(entry) + 1 : 99;
  const expectedPos = getExpectedPosition(club.reputation);

  // Record
  const myFixtures = fixtures.filter(m => m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId));
  let wins = 0, draws = 0, losses = 0;
  for (const m of myFixtures) {
    const isHome = m.homeClubId === playerClubId;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;
  }

  // Top scorer
  const squad = club.playerIds.map(id => players[id]).filter(Boolean);
  const topScorer = squad.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals)[0];

  // Board objective status
  const onTrack = pos <= expectedPos;

  // Motivational message
  let headline = '';
  let headlineColor = 'text-foreground';
  if (pos <= 2) {
    headline = 'Title contenders! Keep pushing for glory.';
    headlineColor = 'text-emerald-400';
  } else if (pos <= expectedPos) {
    headline = 'On track. The board is pleased with your progress.';
    headlineColor = 'text-primary';
  } else if (pos <= expectedPos + 3) {
    headline = 'Room for improvement. The second half is yours to define.';
    headlineColor = 'text-amber-400';
  } else {
    headline = 'A tough first half. Time to dig deep and turn this around.';
    headlineColor = 'text-destructive';
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
          className="w-full max-w-sm"
        >
          <GlassPanel className="p-5 space-y-4 border-primary/30">
            {/* Header */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-base font-bold text-foreground font-display">Mid-Season Report</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Season {season} — Halfway Point</p>
            </div>

            {/* Position */}
            <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground">League Position</span>
              <div className="flex items-center gap-2">
                <span className={cn('text-lg font-black tabular-nums', onTrack ? 'text-emerald-400' : 'text-amber-400')}>
                  {pos}{getSuffix(pos)}
                </span>
                {onTrack ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : pos > expectedPos + 3 ? <TrendingDown className="w-4 h-4 text-destructive" /> : <Minus className="w-4 h-4 text-amber-400" />}
              </div>
            </div>

            {/* Record */}
            <div className="flex items-center justify-around text-center">
              <div>
                <p className="text-lg font-black text-emerald-400">{wins}</p>
                <p className="text-[10px] text-muted-foreground">Won</p>
              </div>
              <div>
                <p className="text-lg font-black text-amber-400">{draws}</p>
                <p className="text-[10px] text-muted-foreground">Drawn</p>
              </div>
              <div>
                <p className="text-lg font-black text-destructive">{losses}</p>
                <p className="text-[10px] text-muted-foreground">Lost</p>
              </div>
              <div>
                <p className="text-lg font-black text-foreground">{entry?.points ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Points</p>
              </div>
            </div>

            {/* Top Scorer */}
            {topScorer && (
              <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                <Target className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">Top Scorer:</span>
                <span className="text-xs font-bold text-foreground flex-1">{topScorer.lastName}</span>
                <span className="text-xs font-bold text-primary">{topScorer.goals} goals</span>
              </div>
            )}

            {/* Board confidence */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Board Confidence</span>
                <span className="text-xs font-bold text-foreground">{boardConfidence}%</span>
              </div>
              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', boardConfidence >= 60 ? 'bg-emerald-500' : boardConfidence >= 35 ? 'bg-amber-500' : 'bg-destructive')}
                  style={{ width: `${boardConfidence}%` }}
                />
              </div>
            </div>

            {/* Headline */}
            <p className={cn('text-sm font-semibold text-center', headlineColor)}>{headline}</p>

            <Button className="w-full" onClick={onDismiss}>Continue Season</Button>
          </GlassPanel>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
