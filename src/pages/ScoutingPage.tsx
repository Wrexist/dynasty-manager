import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { Search, Globe, MapPin, Eye, Clock, Star, StarOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScoutRegion } from '@/types/game';
import { getPotentialInfo } from '@/utils/uiHelpers';
import { AdRewardButton } from '@/components/game/AdRewardButton';
import { SCOUTING_KNOWLEDGE_THRESHOLDS, PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';

const MARKET_SUB_NAV = [
  { screen: 'transfers' as const, label: 'Transfers' },
  { screen: 'scouting' as const, label: 'Scouting' },
];

const REGION_INFO: { region: ScoutRegion; label: string; weeks: number; description: string }[] = [
  { region: 'domestic', label: 'Domestic', weeks: 2, description: 'Quick results, familiar players' },
  { region: 'europe', label: 'Europe', weeks: 3, description: 'High quality, moderate cost' },
  { region: 'south-america', label: 'South America', weeks: 4, description: 'Young talent, high potential' },
  { region: 'africa', label: 'Africa', weeks: 4, description: 'Raw talent, bargain fees' },
  { region: 'asia', label: 'Asia', weeks: 5, description: 'Hidden gems, longer scouting' },
];

const SCOUTING_TABS = ['Overview', 'Watch List'] as const;

const ScoutingPage = () => {
  const { scouting, players, scoutWatchList, assignScout, cancelAssignment, addToWatchList, removeFromWatchList } = useGameStore();
  const [activeTab, setActiveTab] = useState<typeof SCOUTING_TABS[number]>('Overview');

  return (
    <div className="max-w-lg mx-auto">
      <SubNav items={MARKET_SUB_NAV} />
      <PageHint screen="scouting" title={PAGE_HINTS.scouting.title} body={PAGE_HINTS.scouting.body} />
      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-foreground">Scouting</h2>
          <span className="text-xs text-muted-foreground">
            {scouting.assignments.length}/{scouting.maxAssignments} scouts active
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
          {SCOUTING_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors',
                activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Overview' && (<>
        {/* Active Assignments */}
        {scouting.assignments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Active Assignments</h3>
            {scouting.assignments.map(a => {
              const progress = ((a.totalWeeks - a.weeksRemaining) / a.totalWeeks) * 100;
              const regionInfo = REGION_INFO.find(r => r.region === a.region);
              return (
                <GlassPanel key={a.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">{regionInfo?.label}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{a.weeksRemaining}w remaining</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <button
                      onClick={() => cancelAssignment(a.id)}
                      className="text-[10px] text-destructive hover:text-destructive/80 font-semibold shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        )}

        {/* Ad Reward: Reveal Potential */}
        <AdRewardButton rewardType="scout_potential" onRewardClaimed={() => { /* Potential revealed via UI hint */ }} />

        {/* Scout Reports */}
        {scouting.reports.length === 0 && (
          <GlassPanel className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No scout reports yet</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Assign scouts to regions above to discover new talent</p>
          </GlassPanel>
        )}
        {scouting.reports.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Scout Reports</h3>
            {scouting.reports.slice(0, 10).map(report => {
              const player = players[report.playerId];
              if (!player) return null;
              return (
                <GlassPanel key={report.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                        getPotentialInfo(report.estimatedOverall).bgClass
                      )}>
                        {report.knowledgeLevel >= SCOUTING_KNOWLEDGE_THRESHOLDS.REVEAL_OVERALL ? report.estimatedOverall : '??'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {report.knowledgeLevel >= SCOUTING_KNOWLEDGE_THRESHOLDS.REVEAL_IDENTITY ? `${player.firstName} ${player.lastName}` : 'Unknown Player'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {player.position} · Age {player.age}
                          {report.knowledgeLevel < SCOUTING_KNOWLEDGE_THRESHOLDS.REVEAL_OVERALL && ' · Partially scouted'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold',
                          report.recommendation === 'sign' ? 'bg-emerald-500/20 text-emerald-400'
                          : report.recommendation === 'monitor' ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-destructive/20 text-destructive'
                        )}>
                          {report.recommendation.toUpperCase()}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Eye className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">{report.knowledgeLevel}%</span>
                        </div>
                      </div>
                      <button
                        onClick={() => scoutWatchList.includes(report.playerId) ? removeFromWatchList(report.playerId) : addToWatchList(report.playerId)}
                        className="p-1 rounded-md hover:bg-primary/20 transition-colors"
                        title={scoutWatchList.includes(report.playerId) ? 'Remove from watch list' : 'Add to watch list'}
                      >
                        <Star className={cn('w-4 h-4', scoutWatchList.includes(report.playerId) ? 'text-primary fill-primary' : 'text-muted-foreground')} />
                      </button>
                    </div>
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        )}

        {/* Assign New Scout */}
        {scouting.assignments.length < scouting.maxAssignments && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Send Scout</h3>
            {REGION_INFO.map(({ region, label, weeks, description }) => (
              <GlassPanel
                key={region}
                className="p-3 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => assignScout(region)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{weeks}w</span>
                </div>
              </GlassPanel>
            ))}
          </div>
        )}

        {scouting.assignments.length === 0 && scouting.reports.length === 0 && (
          <GlassPanel className="p-6 text-center">
            <Search className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No scouting activity</p>
            <p className="text-xs text-muted-foreground mt-1">Send scouts to discover new talent for your squad</p>
          </GlassPanel>
        )}
        </>)}

        {activeTab === 'Watch List' && (
          <div className="space-y-2">
            {scoutWatchList.length > 0 ? (
              scoutWatchList.map(pid => {
                const player = players[pid];
                if (!player) return null;
                return (
                  <GlassPanel key={pid} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                          getPotentialInfo(player.overall).bgClass
                        )}>
                          {player.overall}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{player.firstName} {player.lastName}</p>
                          <p className="text-xs text-muted-foreground">{player.position} · Age {player.age} · Pot. {player.potential}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromWatchList(pid)}
                        className="p-1.5 rounded-md hover:bg-destructive/20 transition-colors"
                        title="Remove from watch list"
                      >
                        <StarOff className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </GlassPanel>
                );
              })
            ) : (
              <GlassPanel className="p-6 text-center">
                <Star className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No players on watch list</p>
                <p className="text-xs text-muted-foreground mt-1">Add players from scout reports to keep track of them</p>
              </GlassPanel>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoutingPage;
