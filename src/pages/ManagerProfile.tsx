import { useGameStore } from '@/store/gameStore';
import { getSuffix } from '@/utils/helpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Trophy, Star, TrendingUp, Shield, ScrollText, Clock, BarChart3, Crown, User, Shirt, Glasses, UserCircle, Briefcase, Sparkles, Globe, Eye, Flame, GraduationCap, Compass, Award } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ACHIEVEMENTS } from '@/utils/achievements';
import { cn } from '@/lib/utils';
import type { RecordEntry } from '@/types/game';
import { getMilestoneIcon } from '@/utils/milestones';
import { isPro, getActiveCosmetic } from '@/utils/monetization';
import { ProUpsell } from '@/components/game/ProUpsell';

const AVATAR_ICONS: Record<string, React.ElementType> = {
  'avatar-classic': User,
  'avatar-tracksuit': Shirt,
  'avatar-tactical': Glasses,
  'avatar-veteran': UserCircle,
  'avatar-modern': Briefcase,
  'avatar-youth': Sparkles,
  'avatar-continental': Globe,
  'avatar-stoic': Eye,
  'avatar-fiery': Flame,
  'avatar-professor': GraduationCap,
  'avatar-pioneer': Compass,
  'avatar-legend': Award,
};

const RecordRow = ({ label, record }: { label: string; record: RecordEntry | null }) => {
  if (!record) return null;
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/20 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="font-semibold text-foreground">{record.value}</span>
        {record.detail && <span className="text-muted-foreground ml-1">{record.detail}</span>}
        <span className="text-[10px] text-muted-foreground ml-1.5">S{record.season}</span>
      </div>
    </div>
  );
};

// Lazy-load career overview to avoid circular imports
import { lazy, Suspense } from 'react';
const CareerOverviewLazy = lazy(() => import('./CareerOverview'));

const ManagerProfile = () => {
  const { season, seasonHistory, unlockedAchievements, managerStats, clubs, playerClubId, clubRecords, careerTimeline, monetization, gameMode, careerManager } = useGameStore();

  // In career mode, show the career overview page instead
  if (gameMode === 'career' && careerManager) {
    return <Suspense fallback={null}><CareerOverviewLazy /></Suspense>;
  }
  const club = clubs[playerClubId];
  const avatarId = getActiveCosmetic(monetization, 'avatar');
  const AvatarIcon = (avatarId && AVATAR_ICONS[avatarId]) || Shield;
  const userIsPro = isPro(monetization);

  const totalMatches = managerStats.totalWins + managerStats.totalDraws + managerStats.totalLosses;
  const winRate = totalMatches > 0 ? Math.round((managerStats.totalWins / totalMatches) * 100) : 0;
  const titles = seasonHistory.filter(h => h.position === 1).length;
  const topFinishes = seasonHistory.filter(h => h.position <= 3).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <h2 className="text-lg font-display font-bold text-foreground">Manager Profile</h2>

      {/* Overview */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <AvatarIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-foreground">{club?.name || 'Manager'}</p>
              {isPro(monetization) && <Crown className="w-3.5 h-3.5 text-primary" />}
            </div>
            {getActiveCosmetic(monetization, 'title_badge') && (
              <p className="text-[10px] text-primary font-semibold">{getActiveCosmetic(monetization, 'title_badge')?.replace('badge-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
            )}
            <p className="text-xs text-muted-foreground">Season {season} · {seasonHistory.length} season{seasonHistory.length !== 1 ? 's' : ''} managed</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xl font-black text-primary tabular-nums">{winRate}%</p>
            <p className="text-[10px] text-muted-foreground">Win Rate</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-foreground tabular-nums">{titles}</p>
            <p className="text-[10px] text-muted-foreground">Titles</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-foreground tabular-nums">{topFinishes}</p>
            <p className="text-[10px] text-muted-foreground">Top 3</p>
          </div>
        </div>
      </GlassPanel>

      {/* Match Record */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Career Record</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{managerStats.totalWins}</p>
            <p className="text-[10px] text-muted-foreground">Won</p>
          </div>
          <div>
            <p className="text-lg font-bold text-amber-400 tabular-nums">{managerStats.totalDraws}</p>
            <p className="text-[10px] text-muted-foreground">Drawn</p>
          </div>
          <div>
            <p className="text-lg font-bold text-destructive tabular-nums">{managerStats.totalLosses}</p>
            <p className="text-[10px] text-muted-foreground">Lost</p>
          </div>
        </div>
      </GlassPanel>

      {/* Season History */}
      {seasonHistory.length > 0 && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Season History</h3>
          </div>
          <div className="space-y-2">
            {seasonHistory.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Season {h.season}</span>
                <span className={cn(
                  'font-semibold',
                  h.position <= 3 ? 'text-primary' : h.position <= 10 ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {h.position}{getSuffix(h.position)} · {h.points}pts
                </span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded',
                  h.boardVerdict === 'excellent' ? 'bg-emerald-500/20 text-emerald-400' :
                  h.boardVerdict === 'good' ? 'bg-primary/20 text-primary' :
                  h.boardVerdict === 'acceptable' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-destructive/20 text-destructive'
                )}>
                  {h.boardVerdict}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* League Position Chart */}
      {seasonHistory.length >= 2 && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Position Over Seasons</h3>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={seasonHistory.map(h => ({ season: `S${h.season}`, position: h.position, points: h.points }))}>
              <XAxis dataKey="season" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis
                reversed
                domain={[1, 20]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={25}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [`${value}${value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th'}`, 'Position']}
              />
              <Line type="monotone" dataKey="position" stroke="hsl(43, 96%, 46%)" strokeWidth={2} dot={{ fill: 'hsl(43, 96%, 46%)', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </GlassPanel>
      )}

      {/* Club Records */}
      {clubRecords.seasonsManaged > 0 && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ScrollText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Club Records</h3>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-3">
            <div className="text-center py-2">
              <p className="text-xl font-black text-primary tabular-nums">{clubRecords.cupWins}</p>
              <p className="text-[10px] text-muted-foreground">Cup Wins</p>
            </div>
            <div className="text-center py-2">
              <p className="text-xl font-black text-foreground tabular-nums">{clubRecords.seasonsManaged}</p>
              <p className="text-[10px] text-muted-foreground">Seasons</p>
            </div>
          </div>
          {userIsPro ? (
            <>
              <RecordRow label="Top Scorer" record={clubRecords.allTimeTopScorer} />
              <RecordRow label="Top Assister" record={clubRecords.allTimeTopAssister} />
              <RecordRow label="Best Points" record={clubRecords.bestSeasonPoints} />
              <RecordRow label="Worst Points" record={clubRecords.worstSeasonPoints} />
              <RecordRow label="Most Goals" record={clubRecords.mostGoalsInSeason} />
              <RecordRow label="Best Defence" record={clubRecords.fewestGoalsAgainst} />
              <RecordRow label="Best Position" record={clubRecords.highestLeaguePosition} />
              <RecordRow label="Biggest Win" record={clubRecords.biggestWin} />
            </>
          ) : (
            <ProUpsell feature="Historical Record Book" className="mt-2" />
          )}

          {clubRecords.hallOfFame.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-[10px] font-semibold text-primary mb-2">Hall of Fame</p>
              <div className="space-y-1">
                {clubRecords.hallOfFame.slice(-5).reverse().map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground">{entry.name}</span>
                    <span className="text-muted-foreground">{entry.value} goals · S{entry.season}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassPanel>
      )}

      {/* Career Timeline */}
      {careerTimeline.length > 0 && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Career Timeline</h3>
          </div>
          <div className="relative pl-4 border-l-2 border-primary/30 space-y-3">
            {[...careerTimeline].reverse().slice(0, 10).map((m) => (
              <div key={m.id} className="relative">
                <div className="absolute -left-[21px] top-0.5 w-3 h-3 rounded-full bg-primary/80 border-2 border-background" />
                <div className="flex items-start gap-2">
                  <DynamicIcon name={m.icon || getMilestoneIcon(m.type)} className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground">{m.description}</p>
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">Season {m.season} · Week {m.week}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {careerTimeline.length > 10 && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              + {careerTimeline.length - 10} earlier milestones
            </p>
          )}
        </GlassPanel>
      )}

      {/* Achievements */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Achievements ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map(a => {
            const unlocked = unlockedAchievements.includes(a.id);
            return (
              <div
                key={a.id}
                className={cn(
                  'p-2.5 rounded-lg border text-center',
                  unlocked
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-muted/10 border-border/30 opacity-40'
                )}
              >
                <DynamicIcon name={a.icon} className="w-5 h-5 text-primary mx-auto" />
                <p className="text-[10px] font-semibold text-foreground mt-1">{a.title}</p>
                <p className="text-[9px] text-muted-foreground">{a.description}</p>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
};

export default ManagerProfile;
