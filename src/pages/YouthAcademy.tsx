import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PremiumProgress } from '@/components/game/PremiumProgress';
import { PlayerCard } from '@/components/game/PlayerCard';
import { GraduationCap, Star, ArrowUpRight, Trash2, Users, X, Check, Zap, Brain, Target, Dumbbell, Wrench, Crosshair, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getPotentialInfo, posBadgeColor, getRatingColor } from '@/utils/uiHelpers';
import { getStaffBonus } from '@/utils/staff';
import { hapticLight } from '@/utils/haptics';
import { PAGE_HINTS } from '@/config/ui';
import { AdRewardButton } from '@/components/game/AdRewardButton';
import { successToast, infoToast, errorToast } from '@/utils/gameToast';
import { PageHint } from '@/components/game/PageHint';
import type { Player, PositionTrainingPlan, YouthFocus, YouthProspect } from '@/types/game';

const FOCUS_OPTIONS: { id: YouthFocus; label: string; Icon: typeof Star; hint: string }[] = [
  { id: 'balanced', label: 'Balanced', Icon: Star, hint: 'Even growth across all areas.' },
  { id: 'technical', label: 'Technical', Icon: Target, hint: 'Extra growth in shooting, passing and mental.' },
  { id: 'physical', label: 'Physical', Icon: Dumbbell, hint: 'Extra growth in pace, physical and defending.' },
  { id: 'mental', label: 'Mental', Icon: Brain, hint: 'Extra growth in mental, passing and defending.' },
];

function devBarTone(score: number): 'emerald' | 'primary' | 'amber' | 'rose' {
  if (score >= 80) return 'emerald';
  if (score >= 70) return 'primary';
  if (score >= 60) return 'amber';
  return 'rose';
}

interface ProspectRowProps {
  prospect: YouthProspect;
  player: Player;
  positionPlan?: PositionTrainingPlan;
  spotlightUsesRemaining: number;
  index: number;
  onOpen: (id: string) => void;
  onFocus: (id: string, focus: YouthFocus) => void;
  onSpotlight: (id: string) => void;
  onPromote: (id: string) => void;
  onRelease: (id: string) => void;
}

function ProspectRow({
  prospect, player, positionPlan, spotlightUsesRemaining, index,
  onOpen, onFocus, onSpotlight, onPromote, onRelease,
}: ProspectRowProps) {
  const { t } = useTranslation();
  const [confirmRelease, setConfirmRelease] = useState(false);
  const focus = (prospect.trainingFocus ?? 'balanced') as YouthFocus;
  const focusDef = FOCUS_OPTIONS.find(f => f.id === focus) || FOCUS_OPTIONS[0];
  const canSpotlight = spotlightUsesRemaining > 0 && !prospect.spotlightedThisSeason;
  const potInfo = getPotentialInfo(player.potential);
  const dev = Math.round(prospect.developmentScore);

  return (
    <motion.div
      initial={index < 10 ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.2 }}
    >
      <GlassPanel className={cn('p-3 space-y-3', prospect.readyToPromote && 'ring-1 ring-emerald-400/40')}>
        {/* Identity: tap anywhere to open the player (position training lives there) */}
        <button
          type="button"
          onClick={() => onOpen(player.id)}
          className="w-full flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
          aria-label={`Open ${player.firstName} ${player.lastName}`}
        >
          <div className="shrink-0 pointer-events-none">
            <PlayerCard player={player} size="sm" interactive="none" showConditionView={false} />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn('text-micro font-bold px-1.5 py-0.5 rounded', posBadgeColor(player.position))}>
                {player.position}
              </span>
              <p className="text-sm font-semibold text-foreground truncate">
                {player.firstName} {player.lastName}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Age {player.age}</span>
              <span aria-hidden>·</span>
              <span className={cn('font-bold tabular-nums', getRatingColor(player.overall))}>{player.overall} OVR</span>
              <span aria-hidden>·</span>
              <span className={cn('flex items-center gap-0.5 truncate', potInfo.textClass)}>
                <Star className={cn('w-3.5 h-3.5 shrink-0', potInfo.fillClass)} />
                {potInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PremiumProgress size="sm" animate={false} tone={devBarTone(dev)} value={dev} className="flex-1" />
              <span className={cn('text-micro font-semibold tabular-nums w-9 text-right', getRatingColor(dev))}>{dev}%</span>
            </div>
            {positionPlan && (
              <p className="text-micro text-primary flex items-center gap-1">
                <Crosshair className="w-3.5 h-3.5" />
                Learning {positionPlan.position} · {Math.floor(positionPlan.progress)}%
              </p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {prospect.readyToPromote && (
              <span className="text-micro font-bold text-emerald-400 bg-emerald-400/15 px-2 py-0.5 rounded-full">
                {t('youthAcademy.ready')}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
          </div>
        </button>

        {/* Coaching focus — labelled segmented control */}
        <div>
          <div role="radiogroup" aria-label="Coaching focus" className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-muted/20">
            {FOCUS_OPTIONS.map(opt => {
              const active = opt.id === focus;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => !active && onFocus(player.id, opt.id)}
                  className={cn(
                    'min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-md transition-all active:scale-[0.96]',
                    active ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  <opt.Icon className="w-4 h-4" />
                  <span className="text-micro font-semibold">{opt.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-micro text-muted-foreground mt-1.5">{focusDef.hint}</p>
        </div>

        {/* Actions */}
        {confirmRelease ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onRelease(player.id)}
              className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg bg-destructive/20 text-destructive text-xs font-bold active:scale-[0.98] transition-all"
              aria-label={t('youthAcademy.confirmRelease')}
            >
              <Check className="w-4 h-4" /> Release {player.lastName}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRelease(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-muted/30 text-muted-foreground active:scale-[0.98] transition-all"
              aria-label={t('youthAcademy.cancelRelease')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => canSpotlight && onSpotlight(player.id)}
              disabled={!canSpotlight}
              className={cn(
                'flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all',
                prospect.spotlightedThisSeason
                  ? 'bg-amber-400/15 text-amber-400 cursor-default'
                  : canSpotlight
                    ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 active:scale-[0.98]'
                    : 'bg-muted/20 text-muted-foreground/60 cursor-not-allowed',
              )}
            >
              <Zap className="w-4 h-4" />
              {prospect.spotlightedThisSeason ? 'Spotlighted' : 'Spotlight'}
            </button>
            {prospect.readyToPromote ? (
              <button
                type="button"
                onClick={() => onPromote(player.id)}
                className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 active:scale-[0.98] transition-all"
              >
                <ArrowUpRight className="w-4 h-4" /> Promote
              </button>
            ) : (
              <div className="flex-1 min-h-[44px] flex items-center justify-center rounded-lg bg-muted/10 text-muted-foreground text-xs">
                Developing
              </div>
            )}
            <button
              type="button"
              onClick={() => { hapticLight(); setConfirmRelease(true); }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-[0.98] transition-all"
              aria-label={t('youthAcademy.releasePlayer')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </GlassPanel>
    </motion.div>
  );
}

const YouthAcademy = () => {
  const { youthAcademy, players, clubs, playerClubId, facilities, staff, positionPlans } = useGameStore(useShallow(s => ({
    youthAcademy: s.youthAcademy,
    players: s.players,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    facilities: s.facilities,
    staff: s.staff,
    positionPlans: s.training.positionPlans,
  })));
  const promoteYouth = useGameStore(s => s.promoteYouth);
  const releaseYouth = useGameStore(s => s.releaseYouth);
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const setYouthFocus = useGameStore(s => s.setYouthFocus);
  const spotlightYouth = useGameStore(s => s.spotlightYouth);
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

  // Ready-to-promote first, then furthest along — the decisions sit on top.
  const sortedProspects = useMemo(
    () => youthAcademy.prospects
      .filter(p => players[p.playerId])
      .sort((a, b) => Number(b.readyToPromote) - Number(a.readyToPromote) || b.developmentScore - a.developmentScore),
    [youthAcademy.prospects, players],
  );
  const readyCount = sortedProspects.filter(p => p.readyToPromote).length;

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
  };

  const stats: { label: string; value: string; tone: string }[] = [
    { label: 'Prospects', value: String(sortedProspects.length), tone: 'text-foreground' },
    { label: 'Graduates', value: String(graduatesInSquad), tone: 'text-emerald-400' },
    { label: 'Dev. Speed', value: `+${devSpeedBonus}%`, tone: 'text-primary' },
    { label: 'Spotlights', value: String(spotlightUsesRemaining), tone: spotlightUsesRemaining > 0 ? 'text-amber-400' : 'text-muted-foreground' },
  ];

  return (
    <div className="max-w-lg mx-auto">
      <PageHint screen="youthAcademy" title={PAGE_HINTS.youthAcademy.title} body={PAGE_HINTS.youthAcademy.body} />
      <div className="px-4 pb-4 space-y-3">
        {/* Header: title, academy quality and the four numbers in one panel */}
        <GlassPanel className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-display font-bold text-foreground leading-tight">Youth Academy</h2>
              <div className="flex items-center gap-3 text-micro text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />Coach {youthCoachQuality > 0 ? `${youthCoachQuality}/10` : 'none'}</span>
                <span className="flex items-center gap-1"><Wrench className="w-3.5 h-3.5" />Facility Lv. {youthLevel}</span>
              </div>
            </div>
            <span className="text-sm font-bold text-primary tabular-nums">{youthLevel}/10</span>
          </div>
          {/* Reads the facilities slice — the static club.youthRating never reflects upgrades. */}
          <div className="flex items-center gap-1" aria-label={`Academy quality ${youthLevel} of 10`}>
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className={cn('flex-1 h-1.5 rounded-sm', i < youthLevel ? 'bg-primary' : 'bg-muted/30')} />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 pt-1">
            {stats.map(s => (
              <div key={s.label} className="text-center rounded-lg bg-muted/15 py-2">
                <p className={cn('text-lg font-display font-bold tabular-nums leading-tight', s.tone)}>{s.value}</p>
                <p className="text-micro text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* Prospects */}
        {sortedProspects.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-foreground">
                Prospects <span className="text-xs text-muted-foreground tabular-nums">({sortedProspects.length})</span>
              </h3>
              {readyCount > 0 && (
                <span className="text-micro font-bold text-emerald-400 bg-emerald-400/15 px-2 py-0.5 rounded-full tabular-nums">
                  {readyCount} ready to promote
                </span>
              )}
            </div>
            <p className="text-micro text-muted-foreground px-1">
              Tap a prospect to open them and train a second position. Spotlight gives a one-off development boost.
            </p>
            {sortedProspects.map((prospect, i) => (
              <ProspectRow
                key={prospect.playerId}
                prospect={prospect}
                player={players[prospect.playerId]}
                positionPlan={(positionPlans || []).find(p => p.playerId === prospect.playerId)}
                spotlightUsesRemaining={spotlightUsesRemaining}
                index={i}
                onOpen={selectPlayer}
                onFocus={handleFocusChange}
                onSpotlight={handleSpotlight}
                onPromote={handlePromote}
                onRelease={handleRelease}
              />
            ))}
          </section>
        ) : (
          <GlassPanel className="p-8 text-center space-y-2">
            <GraduationCap className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-semibold text-muted-foreground">No youth prospects yet</p>
            <p className="text-xs text-muted-foreground/70">New intake arrives at the end of each season. Upgrade your facilities for better prospects.</p>
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
                  <div key={i} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-micro font-bold px-1.5 py-0.5 rounded', posBadgeColor(preview.position))}>
                        {preview.position}
                      </span>
                      <span className="text-xs text-muted-foreground">Incoming prospect</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Star className={cn('w-3.5 h-3.5', potInfo.fillClass)} />
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
