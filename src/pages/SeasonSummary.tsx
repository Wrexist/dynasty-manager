import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { getSuffix } from '@/utils/helpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { Trophy, Star, Award, Users, ChevronDown, ChevronUp, ArrowDown } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { LEAGUES } from '@/data/league';
import { AdRewardButton } from '@/components/game/AdRewardButton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { VERDICT_COLORS, VERDICT_LABELS } from '@/config/ui';
import { hapticHeavy } from '@/utils/haptics';
import { PageHint } from '@/components/game/PageHint';

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
  const { seasonHistory, season, playerClubId, clubs, leagueTable, gameMode, careerManager } = useGameStore(useShallow((s) => ({
    seasonHistory: s.seasonHistory,
    season: s.season,
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    leagueTable: s.leagueTable,
    gameMode: s.gameMode,
    careerManager: s.careerManager,
  })));
  const setScreen = useGameStore((s) => s.setScreen);
  const latest = seasonHistory[seasonHistory.length - 1];
  const [showBestXI, setShowBestXI] = useState(false);

  // Near-miss detection: check if player barely missed a milestone
  const nearMiss = (() => {
    if (!latest || !leagueTable || leagueTable.length === 0) return null;
    const pos = latest.position;
    if (pos < 2) return null;
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
    // Narrowly avoided being replaced (bottom N clubs)
    const league = LEAGUES.find(l => l.id === latest.divisionId);
    const replacedSlots = league?.replacedSlots || 3;
    const totalClubs = leagueTable.length;
    const replacedLine = totalClubs - replacedSlots;
    if (pos === replacedLine && gap <= 3 && !latest.replaced) {
      return { text: `Survived replacement by just ${gap} point${gap !== 1 ? 's' : ''}`, type: 'survival' as const };
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
      <PageHint
        screen="season-summary"
        title="Season Summary"
        body="Review your season performance — final position, awards, and key stats. This summary only appears once at season end, so take a moment to review before moving on."
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-4">
        <div className="text-center mb-6">
          <Trophy className="w-12 h-12 text-primary mx-auto mb-2" />
          <h2 className="text-2xl font-black text-foreground font-display">Season {latest.season} Complete</h2>
        </div>

        {/* Replaced Clubs Banner */}
        {latest.replaced && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.6, type: 'spring' }} onAnimationComplete={() => hapticHeavy()}>
            <GlassPanel className="p-5 text-center border-destructive/50 bg-destructive/10">
              <ArrowDown className="w-10 h-10 text-destructive mx-auto mb-2" />
              <p className="text-2xl font-black text-destructive font-display">REPLACED</p>
              <p className="text-sm text-destructive/80 mt-1">
                Your club finished in the replacement zone and has been replaced for next season.
              </p>
            </GlassPanel>
          </motion.div>
        )}

        {/* League */}
        {latest.divisionId && (
          <p className="text-xs text-center text-muted-foreground">
            {LEAGUES.find(l => l.id === latest.divisionId)?.name}
          </p>
        )}

        {/* Final Position */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
        <GlassPanel className="p-6 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Final Position</p>
          <p className="text-6xl font-black text-primary">{latest.position}<span className="text-lg">{getSuffix(latest.position)}</span></p>
          <p className="text-lg font-bold text-foreground mt-1">{latest.points} Points</p>
        </GlassPanel>
        </motion.div>

        {/* Near-Miss Banner */}
        {nearMiss && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, duration: 0.5, type: 'spring' }}>
            <GlassPanel className={cn(
              'p-4 text-center',
              nearMiss.type === 'title' ? 'border-primary/50 bg-primary/5' :
              'border-emerald-500/50 bg-emerald-500/5'
            )}>
              <p className={cn(
                'text-lg font-black font-display uppercase tracking-wide',
                nearMiss.type === 'title' ? 'text-primary' :
                'text-emerald-400'
              )}>
                {nearMiss.type === 'survival' ? 'GREAT ESCAPE!' : 'SO CLOSE!'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{nearMiss.text}</p>
              {nearMiss.type === 'title' && (
                <p className="text-[10px] text-primary/70 mt-2 font-medium">Next season is your chance.</p>
              )}
            </GlassPanel>
          </motion.div>
        )}

        {/* Record */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
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
        </motion.div>

        {/* Top Scorer */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>
        <GlassPanel className="p-4 flex items-center gap-3">
          <Star className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Top Scorer</p>
            <p className="text-sm font-bold text-foreground">{latest.topScorer.name}</p>
          </div>
          <p className="text-lg font-black text-primary">{latest.topScorer.goals} goals</p>
        </GlassPanel>
        </motion.div>

        {/* Cup Results */}
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
        {latest.leagueCupResult && (
          <GlassPanel className="p-4 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">League Cup</p>
              <p className="text-sm font-bold text-foreground">{latest.leagueCupResult}</p>
            </div>
            {latest.leagueCupResult === 'Winner' && (
              <Trophy className="w-5 h-5 text-emerald-400" />
            )}
          </GlassPanel>
        )}
        {latest.championsCupResult && (
          <GlassPanel className="p-4 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-blue-400" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Champions Cup</p>
              <p className="text-sm font-bold text-foreground">{latest.championsCupResult}</p>
            </div>
            {latest.championsCupResult === 'Winner' && (
              <Trophy className="w-5 h-5 text-blue-400" />
            )}
          </GlassPanel>
        )}
        {latest.shieldCupResult && (
          <GlassPanel className="p-4 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-orange-400" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Shield Cup</p>
              <p className="text-sm font-bold text-foreground">{latest.shieldCupResult}</p>
            </div>
            {latest.shieldCupResult === 'Winner' && (
              <Trophy className="w-5 h-5 text-orange-400" />
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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.4 }}>
        <GlassPanel className="p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Board Verdict</p>
          <p className={cn('text-xl font-bold', VERDICT_COLORS[latest.boardVerdict])}>
            {VERDICT_LABELS[latest.boardVerdict]}
          </p>
        </GlassPanel>
        </motion.div>

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
                    {sh.championsCupResult === 'Winner' ? ' · CC Winner' : ''}
                    {sh.shieldCupResult === 'Winner' ? ' · SC Winner' : ''}
                    {sh.leagueCupResult === 'Winner' ? ' · LC Winner' : ''}
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

        {/* Ad Reward: Season Bonus */}
        <AdRewardButton rewardType="season_bonus" onRewardClaimed={() => { useGameStore.getState().applySeasonBonus(); }} />

        {/* Career Mode: Season-End Update */}
        {gameMode === 'career' && careerManager && (
          <GlassPanel className="p-4 space-y-3">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Career Update</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Reputation: </span>
                <span className="text-foreground font-semibold capitalize">{(careerManager.reputationTier ?? 'unknown').replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Age: </span>
                <span className="text-foreground font-semibold">{careerManager.age}</span>
              </div>
            </div>
            {careerManager.contract ? (
              <p className="text-xs text-muted-foreground">
                Contract runs until end of Season {careerManager.contract.endSeason}
              </p>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                <p className="text-xs text-amber-400 font-semibold mb-2">You are currently without a club</p>
                <Button size="sm" className="w-full h-8 text-xs" onClick={() => setScreen('job-market')}>
                  Enter Job Market
                </Button>
              </div>
            )}
            {careerManager.awardsWon.filter(a => a.season === season - 1).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {careerManager.awardsWon.filter(a => a.season === season - 1).map((award, idx) => (
                  <span key={idx} className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-lg font-semibold">
                    {award.type === 'manager_of_month' ? 'Manager of the Month' : 'Manager of the Season'}
                  </span>
                ))}
              </div>
            )}
            {careerManager.contract?.bonuses.some(b => b.met) && (
              <p className="text-[10px] text-emerald-400 font-semibold">
                Bonuses earned: {careerManager.contract.bonuses.filter(b => b.met).map(b => b.condition.replace('_', ' ')).join(', ')}
              </p>
            )}
          </GlassPanel>
        )}

        <Button
          className="w-full h-12 text-base font-bold"
          onClick={() => setScreen(gameMode === 'career' && careerManager && !careerManager.contract ? 'job-market' : 'dashboard')}
        >
          {gameMode === 'career' && careerManager && !careerManager.contract ? 'Find a New Club' : `Start Season ${season}`}
        </Button>
      </motion.div>
    </div>
  );
};

export default SeasonSummary;
