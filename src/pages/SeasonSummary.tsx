import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getSuffix } from '@/utils/helpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { Trophy, Star, Award, Users, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { DIVISIONS } from '@/data/league';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { VERDICT_COLORS, VERDICT_LABELS } from '@/config/ui';

const AWARD_ICONS: Record<string, string> = {
  'Golden Boot': 'footprints',
  'Golden Glove': 'shield-check',
  'Playmaker of the Season': 'target',
  'Young Player of the Season': 'star',
  'Manager of the Season': 'medal',
  'Team of the Season': 'star',
};

const AWARD_STAT_LABELS: Record<string, string> = {
  'Golden Boot': 'goals',
  'Golden Glove': 'GA',
  'Playmaker of the Season': 'assists',
  'Young Player of the Season': 'OVR',
  'Team of the Season': 'OVR',
};

const SeasonSummary = () => {
  const { seasonHistory, season, setScreen, playerClubId, clubs, leagueTable } = useGameStore();
  const latest = seasonHistory[seasonHistory.length - 1];
  const [showBestXI, setShowBestXI] = useState(false);

  // Near-miss detection: check if player barely missed a milestone
  const nearMiss = (() => {
    if (!latest || !leagueTable || leagueTable.length === 0) return null;
    const pos = latest.position;
    const pts = latest.points;
    // Find the team just above in the final table
    const aboveEntry = leagueTable[pos - 2]; // pos-1 is 0-indexed player, pos-2 is team above
    if (!aboveEntry) return null;
    const gap = aboveEntry.points - pts;
    if (gap > 3 || gap <= 0) return null;

    // Missed the title by 1-3 points
    if (pos === 2 && gap <= 3) {
      return { text: `Missed the title by just ${gap} point${gap !== 1 ? 's' : ''}`, type: 'title' as const };
    }
    // Missed auto-promotion (positions 1-2 for div-2/3, 1-3 for div-4)
    const div = DIVISIONS.find(d => d.id === latest.divisionId);
    const autoPromoSlots = div?.id === 'div-4' ? 3 : 2;
    if (pos === autoPromoSlots + 1 && gap <= 3 && !latest.promoted) {
      return { text: `Missed automatic promotion by ${gap} point${gap !== 1 ? 's' : ''}`, type: 'promotion' as const };
    }
    // Narrowly avoided relegation
    const totalClubs = leagueTable.length;
    const relegationLine = totalClubs - 2; // bottom 3 get relegated
    if (pos === relegationLine && gap <= 3 && !latest.relegated) {
      return { text: `Survived relegation by just ${gap} point${gap !== 1 ? 's' : ''}`, type: 'survival' as const };
    }
    return null;
  })();

  if (!latest) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">No season data yet.</p>
        <Button className="mt-4" onClick={() => setScreen('dashboard')}>Back</Button>
      </div>
    );
  }

  const playerClubShort = clubs[playerClubId]?.shortName || '';
  const individualAwards = (latest.awards || []).filter(a => a.name !== 'Team of the Season');
  const bestXI = (latest.awards || []).filter(a => a.name === 'Team of the Season');
  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="text-center mb-6">
          <Trophy className="w-12 h-12 text-primary mx-auto mb-2" />
          <h2 className="text-2xl font-black text-foreground font-display">Season {latest.season} Complete</h2>
        </div>

        {/* Promotion/Relegation Banner */}
        {latest.promoted && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, type: 'spring' }}>
            <GlassPanel className="p-5 text-center border-emerald-500/50 bg-emerald-500/10">
              <ArrowUp className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-black text-emerald-400 font-display">PROMOTED!</p>
              {latest.divisionId && (
                <p className="text-sm text-emerald-300/80 mt-1">
                  Moving up to the {DIVISIONS.find(d => d.tier === (DIVISIONS.find(dd => dd.id === latest.divisionId)?.tier || 2) - 1)?.name || 'higher division'}
                </p>
              )}
            </GlassPanel>
          </motion.div>
        )}
        {latest.relegated && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, type: 'spring' }}>
            <GlassPanel className="p-5 text-center border-destructive/50 bg-destructive/10">
              <ArrowDown className="w-10 h-10 text-destructive mx-auto mb-2" />
              <p className="text-2xl font-black text-destructive font-display">RELEGATED</p>
              {latest.divisionId && (
                <p className="text-sm text-destructive/80 mt-1">
                  Dropping to the {DIVISIONS.find(d => d.tier === (DIVISIONS.find(dd => dd.id === latest.divisionId)?.tier || 1) + 1)?.name || 'lower division'}
                </p>
              )}
            </GlassPanel>
          </motion.div>
        )}

        {/* Division */}
        {latest.divisionId && (
          <p className="text-xs text-center text-muted-foreground">
            {DIVISIONS.find(d => d.id === latest.divisionId)?.name}
          </p>
        )}

        {/* Final Position */}
        <GlassPanel className="p-6 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Final Position</p>
          <p className="text-6xl font-black text-primary">{latest.position}<span className="text-lg">{getSuffix(latest.position)}</span></p>
          <p className="text-lg font-bold text-foreground mt-1">{latest.points} Points</p>
        </GlassPanel>

        {/* Near-Miss Banner */}
        {nearMiss && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, duration: 0.5, type: 'spring' }}>
            <GlassPanel className={cn(
              'p-4 text-center',
              nearMiss.type === 'title' ? 'border-primary/50 bg-primary/5' :
              nearMiss.type === 'promotion' ? 'border-amber-500/50 bg-amber-500/5' :
              'border-emerald-500/50 bg-emerald-500/5'
            )}>
              <p className={cn(
                'text-lg font-black font-display uppercase tracking-wide',
                nearMiss.type === 'title' ? 'text-primary' :
                nearMiss.type === 'promotion' ? 'text-amber-400' :
                'text-emerald-400'
              )}>
                {nearMiss.type === 'survival' ? 'GREAT ESCAPE!' : 'SO CLOSE!'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{nearMiss.text}</p>
              {nearMiss.type !== 'survival' && (
                <p className="text-[10px] text-primary/70 mt-2 font-medium">Next season is your chance.</p>
              )}
            </GlassPanel>
          </motion.div>
        )}

        {/* Record */}
        <GlassPanel className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 text-center">Record</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { label: 'W', value: latest.won, color: 'text-emerald-400' },
              { label: 'D', value: latest.drawn, color: 'text-muted-foreground' },
              { label: 'L', value: latest.lost, color: 'text-destructive' },
              { label: 'GF', value: latest.goalsFor, color: 'text-foreground' },
              { label: 'GA', value: latest.goalsAgainst, color: 'text-foreground' },
            ].map(s => (
              <div key={s.label}>
                <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* Top Scorer */}
        <GlassPanel className="p-4 flex items-center gap-3">
          <Star className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Top Scorer</p>
            <p className="text-sm font-bold text-foreground">{latest.topScorer.name}</p>
          </div>
          <p className="text-lg font-black text-primary">{latest.topScorer.goals} goals</p>
        </GlassPanel>

        {/* Cup Result */}
        {latest.cupResult && (
          <GlassPanel className="p-4 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Dynasty Cup</p>
              <p className="text-sm font-bold text-foreground">{latest.cupResult}</p>
            </div>
            {latest.cupResult === 'Winner' && (
              <Trophy className="w-5 h-5 text-primary" />
            )}
          </GlassPanel>
        )}

        {/* Season Awards */}
        {individualAwards.length > 0 && (
          <GlassPanel className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Season Awards</p>
            </div>
            <div className="space-y-2.5">
              {individualAwards.map((award, i) => (
                <motion.div
                  key={`${award.name}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.3 }}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-lg',
                    award.recipientClub === playerClubShort ? 'bg-primary/10 border border-primary/20' : 'bg-muted/20'
                  )}
                >
                  <DynamicIcon name={AWARD_ICONS[award.name] || 'trophy'} className="w-5 h-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{award.name}</p>
                    <p className={cn('text-xs font-bold truncate', award.recipientClub === playerClubShort ? 'text-primary' : 'text-foreground')}>
                      {award.recipientName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{award.recipientClub}</p>
                  </div>
                  {award.stat !== undefined && (
                    <p className="text-sm font-black text-foreground tabular-nums">
                      {award.stat} <span className="text-[10px] text-muted-foreground font-normal">{AWARD_STAT_LABELS[award.name] || ''}</span>
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </GlassPanel>
        )}

        {/* Team of the Season (collapsible) */}
        {bestXI.length > 0 && (
          <GlassPanel className="p-4">
            <button
              onClick={() => setShowBestXI(!showBestXI)}
              className="flex items-center gap-2 w-full"
            >
              <Users className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider flex-1 text-left">Team of the Season</p>
              {showBestXI ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {showBestXI && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 space-y-1.5"
              >
                {bestXI.map((p, i) => (
                  <div
                    key={`xi-${i}`}
                    className={cn(
                      'flex items-center justify-between text-xs py-1 px-2 rounded',
                      p.recipientClub === playerClubShort ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                    )}
                  >
                    <span className="truncate">{p.recipientName}</span>
                    <span className="text-muted-foreground ml-2 shrink-0">{p.recipientClub} · {p.stat}</span>
                  </div>
                ))}
                {bestXI.filter(p => p.recipientClub === playerClubShort).length > 0 && (
                  <p className="text-[10px] text-primary text-center mt-1">
                    {bestXI.filter(p => p.recipientClub === playerClubShort).length} of your players made the Best XI!
                  </p>
                )}
              </motion.div>
            )}
          </GlassPanel>
        )}

        {/* Board Verdict */}
        <GlassPanel className="p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Board Verdict</p>
          <p className={cn('text-xl font-bold', VERDICT_COLORS[latest.boardVerdict])}>
            {VERDICT_LABELS[latest.boardVerdict]}
          </p>
        </GlassPanel>

        {/* Season History */}
        {seasonHistory.length > 1 && (
          <GlassPanel className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">History</p>
            <div className="space-y-1.5">
              {seasonHistory.map(sh => (
                <div key={sh.season} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Season {sh.season}</span>
                  <span className="font-bold text-foreground">
                    {sh.position}{getSuffix(sh.position)} · {sh.points}pts
                    {sh.cupResult === 'Winner' ? ' · Cup Winner' : sh.cupResult === 'Final' ? ' · Cup Final' : ''}
                  </span>
                </div>
              ))}
            </div>
          </GlassPanel>
        )}

        {latest.position === 1 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
            <GlassPanel className="p-4 border-primary/50 bg-primary/5 text-center">
              <Star className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-sm font-bold text-primary">Champions! Prestige Mode Unlocked</p>
              <p className="text-xs text-muted-foreground mt-1">Start a new journey with bonuses from your success.</p>
              <Button variant="outline" className="mt-3 border-primary/40 text-primary" onClick={() => setScreen('prestige')}>
                View Prestige Options
              </Button>
            </GlassPanel>
          </motion.div>
        )}

        <Button className="w-full h-12 text-base font-bold" onClick={() => setScreen('dashboard')}>
          Start Season {season}
        </Button>
      </motion.div>
    </div>
  );
};

export default SeasonSummary;
