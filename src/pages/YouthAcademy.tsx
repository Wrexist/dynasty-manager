import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { GraduationCap, Star, TrendingUp, ArrowUpRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRatingBadgeClasses, getPotentialInfo } from '@/utils/uiHelpers';
import { PAGE_HINTS } from '@/config/ui';
import { AdRewardButton } from '@/components/game/AdRewardButton';
import { PageHint } from '@/components/game/PageHint';

const SQUAD_SUB_NAV = [
  { screen: 'squad' as const, label: 'Squad' },
  { screen: 'training' as const, label: 'Training' },
  { screen: 'staff' as const, label: 'Staff' },
  { screen: 'youth-academy' as const, label: 'Youth' },
];

const YouthAcademy = () => {
  const { youthAcademy, players, clubs, playerClubId, promoteYouth, releaseYouth } = useGameStore();
  const [confirmReleaseId, setConfirmReleaseId] = useState<string | null>(null);
  const [youthPreviewEnhanced, setYouthPreviewEnhanced] = useState(false);
  const club = clubs[playerClubId];

  return (
    <div className="max-w-lg mx-auto">
      <SubNav items={SQUAD_SUB_NAV} />
      <PageHint screen="youthAcademy" title={PAGE_HINTS.youthAcademy.title} body={PAGE_HINTS.youthAcademy.body} />
      <div className="px-4 pb-4 space-y-3">
        <h2 className="text-lg font-display font-bold text-foreground">Youth Academy</h2>

        {/* Academy Quality */}
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Academy Quality</h3>
            <div className="flex items-center gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-4 rounded-sm',
                    i < (club?.youthRating || 5) ? 'bg-primary' : 'bg-muted/30'
                  )}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Higher academy quality produces better youth prospects each season.
          </p>
        </GlassPanel>

        {/* Prospects */}
        {youthAcademy.prospects.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Youth Prospects</h3>
            {youthAcademy.prospects.map(prospect => {
              const player = players[prospect.playerId];
              if (!player) return null;
              return (
                <GlassPanel key={prospect.playerId} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                        getRatingBadgeClasses(player.overall)
                      )}>
                        {player.overall}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{player.firstName} {player.lastName}</p>
                        <p className="text-xs text-muted-foreground">{player.position} · Age {player.age}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs font-semibold text-emerald-400">{player.potential}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Potential</span>
                      </div>
                    </div>
                  </div>
                  {/* Development Progress */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">Development</span>
                      <span className="text-[10px] font-semibold text-primary">{prospect.developmentScore}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${prospect.developmentScore}%` }} />
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {prospect.readyToPromote && (
                      <button
                        onClick={() => promoteYouth(prospect.playerId)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" /> Promote
                      </button>
                    )}
                    {confirmReleaseId === prospect.playerId ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { releaseYouth(prospect.playerId); setConfirmReleaseId(null); }} className="flex items-center justify-center gap-1 py-2.5 px-3 rounded-lg bg-destructive/20 text-destructive text-xs font-bold min-h-[44px]">Confirm</button>
                        <button onClick={() => setConfirmReleaseId(null)} className="py-2.5 px-3 rounded-lg bg-muted/30 text-muted-foreground text-xs font-semibold min-h-[44px]">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmReleaseId(prospect.playerId)}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Release
                      </button>
                    )}
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        ) : (
          <GlassPanel className="p-6 text-center">
            <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No youth prospects yet</p>
            <p className="text-xs text-muted-foreground mt-1">New intake arrives at the end of each season</p>
          </GlassPanel>
        )}

        {/* Ad Reward: Youth Preview */}
        <AdRewardButton rewardType="youth_preview" onRewardClaimed={() => setYouthPreviewEnhanced(true)} />

        {/* Next Intake */}
        {youthAcademy.nextIntakePreview.length > 0 && (
          <GlassPanel className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Next Intake Preview</h3>
            <div className="space-y-1.5">
              {youthAcademy.nextIntakePreview.map((preview, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{preview.position}</span>
                  <div className="flex items-center gap-1">
                    <Star className={cn('w-3 h-3', getPotentialInfo(preview.estimatedPotential).fillClass)} />
                    <span className="text-xs text-muted-foreground">
                      {youthPreviewEnhanced ? `${preview.estimatedPotential} — ` : ''}{getPotentialInfo(preview.estimatedPotential).label} potential
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        )}
      </div>
    </div>
  );
};

export default YouthAcademy;
