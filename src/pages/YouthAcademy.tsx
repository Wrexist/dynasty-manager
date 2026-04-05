import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { GraduationCap, Star, TrendingUp, ArrowUpRight, Trash2, Wrench, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getRatingColor, getRatingBadgeClasses, getPotentialInfo, getTop3Attributes } from '@/utils/uiHelpers';
import { getFlag } from '@/utils/nationality';
import { getStaffBonus } from '@/utils/staff';
import { hapticLight } from '@/utils/haptics';
import { PAGE_HINTS } from '@/config/ui';
import { AdRewardButton } from '@/components/game/AdRewardButton';
import { PageHint } from '@/components/game/PageHint';
import { Position } from '@/types/game';

const SQUAD_SUB_NAV = [
  { screen: 'squad' as const, label: 'Squad' },
  { screen: 'training' as const, label: 'Training' },
  { screen: 'staff' as const, label: 'Staff' },
  { screen: 'youth-academy' as const, label: 'Youth' },
];

function posBadgeColor(pos: Position): string {
  if (pos === 'GK') return 'bg-amber-500/20 text-amber-400';
  if (['CB', 'LB', 'RB'].includes(pos)) return 'bg-blue-500/20 text-blue-400';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'bg-emerald-500/20 text-emerald-400';
  return 'bg-red-500/20 text-red-400';
}

function devBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 40) return 'bg-primary';
  return 'bg-amber-500';
}

const YouthAcademy = () => {
  const { youthAcademy, players, clubs, playerClubId, facilities, staff } = useGameStore(useShallow(s => ({
    youthAcademy: s.youthAcademy,
    players: s.players,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    facilities: s.facilities,
    staff: s.staff,
  })));
  const promoteYouth = useGameStore(s => s.promoteYouth);
  const releaseYouth = useGameStore(s => s.releaseYouth);
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const [confirmReleaseId, setConfirmReleaseId] = useState<string | null>(null);
  const [youthPreviewEnhanced, setYouthPreviewEnhanced] = useState(false);
  const club = clubs[playerClubId];

  const youthCoachQuality = useMemo(() => getStaffBonus(staff.members, 'youth-coach'), [staff.members]);
  const youthLevel = facilities.youthLevel;

  // Dev speed bonus from coach + facility
  const devSpeedBonus = useMemo(() => {
    const coachBonus = youthCoachQuality * 0.3;
    const facilityBonus = youthLevel * 0.2;
    return Math.round((coachBonus + facilityBonus) * 100);
  }, [youthCoachQuality, youthLevel]);

  // Count graduates in current squad
  const graduatesInSquad = useMemo(() => {
    if (!club) return 0;
    return club.playerIds.filter(id => players[id]?.isFromYouthAcademy).length;
  }, [club, players]);

  return (
    <div className="max-w-lg mx-auto">
      <SubNav items={SQUAD_SUB_NAV} />
      <PageHint screen="youthAcademy" title={PAGE_HINTS.youthAcademy.title} body={PAGE_HINTS.youthAcademy.body} />
      <div className="px-4 pb-4 space-y-3">
        <h2 className="text-lg font-display font-bold text-foreground">Youth Academy</h2>

        {/* Academy Stats Summary */}
        <GlassPanel className="p-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-display font-bold text-foreground tabular-nums">{youthAcademy.prospects.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Prospects</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-display font-bold text-emerald-400 tabular-nums">{graduatesInSquad}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Graduates</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-display font-bold text-primary tabular-nums">+{devSpeedBonus}%</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dev. Speed</p>
            </div>
          </div>
        </GlassPanel>

        {/* Academy Quality */}
        <GlassPanel className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Academy Quality</h3>
              <span className="text-sm font-bold text-primary tabular-nums">{club?.youthRating || 0}/10</span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-2 rounded-sm transition-colors',
                    i < (club?.youthRating || 5) ? 'bg-primary' : 'bg-muted/30'
                  )}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>Coach: {youthCoachQuality > 0 ? `${youthCoachQuality}/10` : 'None'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Wrench className="w-3 h-3" />
                <span>Facility Lv. {youthLevel}</span>
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* Prospects */}
        {youthAcademy.prospects.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Youth Prospects</h3>
            {youthAcademy.prospects.map((prospect, i) => {
              const player = players[prospect.playerId];
              if (!player) return null;
              const potentialInfo = getPotentialInfo(player.potential);
              const top3 = getTop3Attributes(player.attributes);
              return (
                <motion.div
                  key={prospect.playerId}
                  initial={i < 10 ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.2 }}
                >
                  <GlassPanel className="p-0 overflow-hidden">
                    {/* Clickable card body */}
                    <div
                      onClick={() => { hapticLight(); selectPlayer(player.id); }}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${player.firstName} ${player.lastName}`}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlayer(player.id); } }}
                      className="p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Top row: Avatar + Info + Potential */}
                      <div className="flex items-center gap-3">
                        {/* Player Avatar */}
                        <div className="relative shrink-0">
                          <PlayerAvatar
                            jerseyColor={club?.color || '#333'}
                            size={44}
                            overall={player.overall}
                            position={player.position}
                          />
                          {/* Overall badge overlay */}
                          <div className={cn(
                            'absolute -bottom-1 -right-1 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border border-background',
                            getRatingBadgeClasses(player.overall)
                          )}>
                            {player.overall}
                          </div>
                        </div>

                        {/* Player Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-foreground text-sm truncate">
                              {getFlag(player.nationality)} {player.firstName[0]}. {player.lastName}
                            </p>
                            <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', posBadgeColor(player.position))}>
                              {player.position}
                            </span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{player.age}y</span>
                          </div>
                        </div>

                        {/* Potential */}
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 justify-end">
                            <Star className={cn('w-3 h-3', potentialInfo.fillClass)} />
                            <span className={cn('text-sm font-bold tabular-nums', potentialInfo.textClass)}>{player.potential}</span>
                          </div>
                          <span className={cn('text-[9px] font-medium', potentialInfo.textClass)}>{potentialInfo.label}</span>
                        </div>
                      </div>

                      {/* Top 3 Attributes */}
                      <div className="flex items-center gap-1.5 mt-2.5">
                        {top3.map(attr => (
                          <div key={attr.label} className="flex items-center gap-1 bg-muted/30 rounded-md px-2 py-1">
                            <span className="text-[9px] text-muted-foreground font-medium">{attr.label}</span>
                            <span className={cn('text-[10px] font-bold tabular-nums', getRatingColor(attr.value))}>{attr.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Development Progress */}
                      <div className="mt-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">Development</span>
                          <span className={cn(
                            'text-[10px] font-semibold tabular-nums',
                            prospect.developmentScore >= 80 ? 'text-emerald-400' : prospect.developmentScore >= 40 ? 'text-primary' : 'text-amber-400'
                          )}>
                            {Math.round(prospect.developmentScore)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', devBarColor(prospect.developmentScore))}
                            style={{ width: `${prospect.developmentScore}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action buttons — separated from clickable area */}
                    <div className="flex gap-2 px-3 pb-3 pt-1">
                      {prospect.readyToPromote ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); hapticLight(); promoteYouth(prospect.playerId); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 active:scale-[0.97] transition-all"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" /> Promote to Squad
                        </button>
                      ) : (
                        <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted/20 text-muted-foreground/50 text-xs font-medium cursor-default">
                          <ArrowUpRight className="w-3.5 h-3.5" /> Not Ready
                        </div>
                      )}
                      {confirmReleaseId === prospect.playerId ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); releaseYouth(prospect.playerId); setConfirmReleaseId(null); }}
                            className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-destructive/20 text-destructive text-xs font-bold active:scale-[0.97] transition-all min-h-[36px]"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmReleaseId(null); }}
                            className="py-2 px-3 rounded-lg bg-muted/30 text-muted-foreground text-xs font-semibold min-h-[36px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmReleaseId(prospect.playerId); }}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 active:scale-[0.97] transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </GlassPanel>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <GlassPanel className="p-8 text-center space-y-2">
            <GraduationCap className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-semibold text-muted-foreground">No youth prospects yet</p>
            <p className="text-xs text-muted-foreground/60">New intake arrives at the end of each season. Upgrade your facilities for better prospects.</p>
          </GlassPanel>
        )}

        {/* Ad Reward: Youth Preview */}
        <AdRewardButton rewardType="youth_preview" onRewardClaimed={() => setYouthPreviewEnhanced(true)} />

        {/* Next Intake */}
        {youthAcademy.nextIntakePreview.length > 0 && (
          <GlassPanel className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Next Intake Preview</h3>
            <div className="space-y-2">
              {youthAcademy.nextIntakePreview.map((preview, i) => {
                const potInfo = getPotentialInfo(preview.estimatedPotential);
                return (
                  <div key={i} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', posBadgeColor(preview.position))}>
                        {preview.position}
                      </span>
                      <span className="text-xs text-muted-foreground">Incoming prospect</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Star className={cn('w-3 h-3', potInfo.fillClass)} />
                      <span className={cn('text-xs font-semibold', potInfo.textClass)}>
                        {youthPreviewEnhanced ? `${preview.estimatedPotential} — ` : ''}{potInfo.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        )}
      </div>
    </div>
  );
};

export default YouthAcademy;
