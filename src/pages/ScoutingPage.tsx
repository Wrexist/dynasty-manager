import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { Search, Globe, MapPin, Eye, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScoutRegion } from '@/types/game';
import { getPotentialInfo } from '@/utils/uiHelpers';
import { SCOUTING_KNOWLEDGE_THRESHOLDS } from '@/config/ui';

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

const ScoutingPage = () => {
  const { scouting, players, assignScout, cancelAssignment } = useGameStore();

  return (
    <div className="max-w-lg mx-auto">
      <SubNav items={MARKET_SUB_NAV} />
      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-foreground">Scouting</h2>
          <span className="text-xs text-muted-foreground">
            {scouting.assignments.length}/{scouting.maxAssignments} scouts active
          </span>
        </div>

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

        {/* Scout Reports */}
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
      </div>
    </div>
  );
};

export default ScoutingPage;
