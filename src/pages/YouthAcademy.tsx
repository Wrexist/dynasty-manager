import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PremiumProgress } from '@/components/game/PremiumProgress';
import { PlayerCard, PLAYER_CARD_SIZE_PX } from '@/components/game/PlayerCard';
import { StatusPill } from '@/components/game/StatusPill';
import { PlayerStatusBadges } from '@/components/game/PlayerStatusBadges';
import { GraduationCap, Star, ArrowUpRight, Trash2, Wrench, Users, X, Check, Zap, Brain, Target, Dumbbell, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getPotentialInfo, posBadgeColor, getRatingColor } from '@/utils/uiHelpers';
import { getStaffBonus } from '@/utils/staff';
import { hapticLight } from '@/utils/haptics';
import { PAGE_HINTS } from '@/config/ui';
import { AdRewardButton } from '@/components/game/AdRewardButton';
import { successToast, infoToast, errorToast } from '@/utils/gameToast';
import { PageHint } from '@/components/game/PageHint';
import type { YouthFocus } from '@/types/game';

const FOCUS_OPTIONS: { id: YouthFocus; label: string; short: string; Icon: typeof Star; tone: string }[] = [
  { id: 'balanced', label: 'Balanced', short: 'BAL', Icon: Star, tone: 'text-muted-foreground' },
  { id: 'technical', label: 'Technical', short: 'TEC', Icon: Target, tone: 'text-primary' },
  { id: 'physical', label: 'Physical', short: 'PHY', Icon: Dumbbell, tone: 'text-emerald-400' },
  { id: 'mental', label: 'Mental', short: 'MEN', Icon: Brain, tone: 'text-cyan-400' },
];

function devBarTone(score: number): 'emerald' | 'primary' | 'amber' | 'rose' {
  if (score >= 80) return 'emerald';
  if (score >= 70) return 'primary';
  if (score >= 60) return 'amber';
  return 'rose';
}

const YouthAcademy = () => {
  const { youthAcademy, players, clubs, playerClubId, facilities, staff, season, week } = useGameStore(useShallow(s => ({
    youthAcademy: s.youthAcademy,
    players: s.players,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    facilities: s.facilities,
    staff: s.staff,
    season: s.season,
    week: s.week,
  })));
  const promoteYouth = useGameStore(s => s.promoteYouth);
  const releaseYouth = useGameStore(s => s.releaseYouth);
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const setYouthFocus = useGameStore(s => s.setYouthFocus);
  const spotlightYouth = useGameStore(s => s.spotlightYouth);
  const [confirmReleaseId, setConfirmReleaseId] = useState<string | null>(null);
  const [focusEditorId, setFocusEditorId] = useState<string | null>(null);
  const youthPreviewEnhanced = youthAcademy.youthPreviewEnhanced;
  const club = clubs[playerClubId];
  const spotlightUsesRemaining = youthAcademy.spotlightUsesRemaining ?? 2;

  const youthCoachQuality = useMemo(() => getStaffBonus(staff.members, 'youth-coach'), [staff.members]);
  const youthLevel = facilities.youthLevel;

  const devSpeedBonus = useMemo(() => {
    const coachBonus = youthCoachQuality * 0.3;
    const facilityBonus = youthLevel * 0.2;
    return Math.round((coachBonus + facilityBonus) * 100);
  }, [youthCoachQuality, youthLevel]);

  const graduatesInSquad = useMemo(() => {
    if (!club) return 0;
    return club.playerIds.filter(id => players[id]?.isFromYouthAcademy).length;
  }, [club, players]);

  const readyCount = useMemo(
    () => youthAcademy.prospects.filter(p => p.readyToPromote).length,
    [youthAcademy.prospects],
  );

  const handlePromote = (playerId: string) => {
    hapticLight();
    const yp = players[playerId];
    const r = promoteYouth(playerId);
    if (r.success) {
      successToast('Player Promoted', `${yp?.firstName ?? ''} ${yp?.lastName ?? ''} joins the first team`);
    } else {
      errorToast(r.message || 'Cannot promote player.');
    }
  };

  const handleRelease = (playerId: string) => {
    const rp = players[playerId];
    releaseYouth(playerId);
    setConfirmReleaseId(null);
    infoToast('Player Released', `${rp?.firstName ?? ''} ${rp?.lastName ?? ''} has left the academy`);
  };

  const handleSpotlight = (playerId: string) => {
    hapticLight();
    const r = spotlightYouth(playerId);
    if (r.success) successToast('Spotlight Session', r.message);
    else errorToast(r.message);
  };

  const handleFocusChange = (playerId: string, focus: YouthFocus) => {
    hapticLight();
    setYouthFocus(playerId, focus);
    setFocusEditorId(null);
  };

  return (
    <div className="max-w-lg mx-auto">
      <PageHint screen="youthAcademy" title={PAGE_HINTS.youthAcademy.title} body={PAGE_HINTS.youthAcademy.body} />
      <div className="px-4 pb-4 space-y-3">
        <h2 className="text-lg font-display font-bold text-foreground">Youth Academy</h2>

        {/* Academy Stats Summary */}
        <GlassPanel className="p-3">
          <div className="grid grid-cols-4 gap-3">
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
            <div className="text-center">
              <p className={cn('text-lg font-display font-bold tabular-nums', spotlightUsesRemaining > 0 ? 'text-amber-400' : 'text-muted-foreground')}>{spotlightUsesRemaining}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Spotlights</p>
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Youth Prospects
                <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">({youthAcademy.prospects.length})</span>
              </h3>
              {readyCount > 0 && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/15 px-2 py-0.5 rounded-full tabular-nums">
                  {readyCount} ready
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 justify-items-center pt-1">
              {youthAcademy.prospects.map((prospect, i) => {
                const player = players[prospect.playerId];
                if (!player) return null;
                const isConfirming = confirmReleaseId === prospect.playerId;
                const focus = (prospect.trainingFocus ?? 'balanced') as YouthFocus;
                const focusDef = FOCUS_OPTIONS.find(f => f.id === focus) || FOCUS_OPTIONS[0];
                const FocusIcon = focusDef.Icon;
                const isFocusEditing = focusEditorId === prospect.playerId;
                const canSpotlight = spotlightUsesRemaining > 0 && !prospect.spotlightedThisSeason;

                return (
                  <motion.div
                    key={prospect.playerId}
                    initial={i < 10 ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                    className="flex flex-col items-center"
                  >
                    <div className="relative">
                      <PlayerCard
                        player={player}
                        size="lg"
                        interactive="detail"
                        showConditionView={false}
                        onDetailClick={(p) => selectPlayer(p.id)}
                      />

                      {/* Top-right overlay pills — mirrors Squad page pattern */}
                      <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
                        <PlayerStatusBadges
                          player={player}
                          season={season}
                          week={week}
                          hideContract
                          contextBadge={
                            prospect.readyToPromote ? (
                              <StatusPill
                                tone="emerald"
                                Icon={ArrowUpRight}
                                label="READY"
                                title="Ready for first team"
                              />
                            ) : null
                          }
                        />
                      </div>
                    </div>

                    {/* Development bar — matches PlayerCard lg width */}
                    <div className="mt-1.5" style={{ width: PLAYER_CARD_SIZE_PX.lg }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Dev</span>
                        <span className={cn('text-[9px] font-semibold tabular-nums', getRatingColor(prospect.developmentScore))}>
                          {Math.round(prospect.developmentScore)}%
                        </span>
                      </div>
                      <PremiumProgress
                        size="sm"
                        animate={false}
                        tone={devBarTone(prospect.developmentScore)}
                        value={prospect.developmentScore}
                      />
                    </div>

                    {/* Focus + Spotlight row */}
                    <div className="mt-1.5 flex items-center gap-1" style={{ width: PLAYER_CARD_SIZE_PX.lg }}>
                      {!isFocusEditing ? (
                        <button
                          type="button"
                          onClick={() => { hapticLight(); setFocusEditorId(prospect.playerId); }}
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-muted/20 hover:bg-muted/40 active:scale-[0.97] transition-all"
                        >
                          <FocusIcon className={cn('w-2.5 h-2.5', focusDef.tone)} />
                          <span className={cn('text-[9px] font-bold tracking-wider', focusDef.tone)}>{focusDef.short}</span>
                          <ChevronDown className="w-2.5 h-2.5 text-muted-foreground/60" />
                        </button>
                      ) : (
                        <div className="flex-1 grid grid-cols-4 gap-0.5">
                          {FOCUS_OPTIONS.map(opt => {
                            const Active = opt.Icon;
                            const isCurrent = opt.id === focus;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => handleFocusChange(prospect.playerId, opt.id)}
                                className={cn(
                                  'flex items-center justify-center py-1 rounded-md active:scale-[0.94] transition-all',
                                  isCurrent ? 'bg-primary/25 ring-1 ring-primary/40' : 'bg-muted/20 hover:bg-muted/40',
                                )}
                                title={opt.label}
                              >
                                <Active className={cn('w-2.5 h-2.5', isCurrent ? 'text-primary' : opt.tone)} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => canSpotlight && handleSpotlight(prospect.playerId)}
                        disabled={!canSpotlight}
                        className={cn(
                          'flex items-center gap-0.5 py-1 px-1.5 rounded-md transition-all',
                          prospect.spotlightedThisSeason
                            ? 'bg-amber-400/20 text-amber-400 cursor-default'
                            : canSpotlight
                              ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/30 active:scale-[0.94]'
                              : 'bg-muted/20 text-muted-foreground/40 cursor-not-allowed',
                        )}
                      >
                        <Zap className="w-2.5 h-2.5" />
                        <span className="text-[8px] font-bold tracking-wider">BOOST</span>
                      </button>
                    </div>

                    {/* Action row */}
                    <div className="mt-1.5 flex gap-1" style={{ width: PLAYER_CARD_SIZE_PX.lg }}>
                      {isConfirming ? (
                        <>
                          <button
                            onClick={() => handleRelease(prospect.playerId)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-destructive/20 text-destructive text-[10px] font-bold active:scale-[0.97] transition-all"
                            aria-label="Confirm release"
                          >
                            <Check className="w-3 h-3" /> Release
                          </button>
                          <button
                            onClick={() => setConfirmReleaseId(null)}
                            className="px-2 py-1.5 rounded-md bg-muted/30 text-muted-foreground active:scale-[0.97] transition-all"
                            aria-label="Cancel release"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          {prospect.readyToPromote ? (
                            <button
                              onClick={() => handlePromote(prospect.playerId)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/30 active:scale-[0.97] transition-all"
                            >
                              <ArrowUpRight className="w-3 h-3" /> Promote
                            </button>
                          ) : (
                            <div className="flex-1 py-1.5 rounded-md bg-muted/20 text-muted-foreground/50 text-[10px] font-medium text-center cursor-default">
                              Developing
                            </div>
                          )}
                          <button
                            onClick={() => { hapticLight(); setConfirmReleaseId(prospect.playerId); }}
                            className="px-2 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-[0.97] transition-all"
                            aria-label="Release player"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          <GlassPanel className="p-8 text-center space-y-2">
            <GraduationCap className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-semibold text-muted-foreground">No youth prospects yet</p>
            <p className="text-xs text-muted-foreground/60">New intake arrives at the end of each season. Upgrade your facilities for better prospects.</p>
          </GlassPanel>
        )}

        {/* Ad Reward: Youth Preview */}
        <AdRewardButton rewardType="youth_preview" onRewardClaimed={() => { useGameStore.getState().applyYouthPreview(); }} />

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
