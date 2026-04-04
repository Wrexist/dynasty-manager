import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { StatBar } from '@/components/game/StatBar';
import { Button } from '@/components/ui/button';
import { POSITION_COMPATIBILITY, Position, TrainingModule } from '@/types/game';
import { ArrowLeft, Heart, Zap, TrendingUp, TrendingDown, Tag, X, Target, Activity, FileText, Brain, Award, HeartPulse, Stethoscope, AlertTriangle, Dumbbell, Flame, Shield, Banknote, Repeat2 } from 'lucide-react';
import { TransferApproach } from '@/components/game/TransferApproach';
import { LoanNegotiation } from '@/components/game/LoanNegotiation';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';
import { motion } from 'framer-motion';
import { getPlayerNarratives } from '@/utils/playerNarratives';
import { cn } from '@/lib/utils';
import { getRatingColor, getMoodColor, getMoodLabel } from '@/utils/uiHelpers';
import { getFlag } from '@/utils/nationality';
import { successToast, infoToast, errorToast } from '@/utils/gameToast';
import { getPersonalityLabel, getTrainingMultiplier } from '@/utils/personality';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { PlayerRadarChart } from '@/components/game/PlayerRadarChart';
import { ATTR_RATING_HIGH, ATTR_RATING_MID, ATTR_RATING_LOW, HELP_TEXTS } from '@/config/ui';
import { InfoTip } from '@/components/game/InfoTip';
import { MODULE_ATTR_MAP, STREAK_MULTIPLIERS, INDIVIDUAL_TRAINING_BONUS } from '@/config/training';
import { getTrainingEffectivenessPreview, getStreakTier } from '@/utils/training';
import { getStaffBonus } from '@/utils/staff';
import { hapticLight } from '@/utils/haptics';
import { hasPerk } from '@/utils/managerPerks';
import { getWinStreak } from '@/utils/celebrations';
import { getLeadershipBonus } from '@/utils/personality';
import { UNHAPPY_CONTAGION_WEEKS, STREAK_MORALE_THRESHOLD } from '@/config/gameBalance';

const TRAINING_MODULE_INFO: { module: TrainingModule; label: string; icon: React.ElementType; color: string }[] = [
  { module: 'fitness', label: 'Fitness', icon: Dumbbell, color: 'text-emerald-400' },
  { module: 'attacking', label: 'Attacking', icon: Flame, color: 'text-red-400' },
  { module: 'defending', label: 'Defending', icon: Shield, color: 'text-blue-400' },
  { module: 'mentality', label: 'Mentality', icon: Brain, color: 'text-purple-400' },
  { module: 'set-pieces', label: 'Set Pieces', icon: Target, color: 'text-amber-400' },
  { module: 'tactical', label: 'Tactical', icon: Zap, color: 'text-primary' },
];

const ATTR_LABELS: Record<string, string> = {
  pace: 'PAC', shooting: 'SHO', passing: 'PAS', defending: 'DEF', physical: 'PHY', mental: 'MEN',
};

const PlayerDetail = () => {
  const {
    selectedPlayerId, players, clubs, playerClubId, previousScreen,
    incomingOffers, season, week, facilities,
    training, transferWindowOpen, staff,
    fixtures, managerProgression,
  } = useGameStore(useShallow(s => ({
    selectedPlayerId: s.selectedPlayerId,
    players: s.players,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    previousScreen: s.previousScreen,
    incomingOffers: s.incomingOffers,
    season: s.season,
    week: s.week,
    facilities: s.facilities,
    training: s.training,
    transferWindowOpen: s.transferWindowOpen,
    staff: s.staff,
    fixtures: s.fixtures,
    managerProgression: s.managerProgression,
  })));

  const setScreen = useGameStore(s => s.setScreen);
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const listPlayerForSale = useGameStore(s => s.listPlayerForSale);
  const unlistPlayer = useGameStore(s => s.unlistPlayer);
  const respondToOffer = useGameStore(s => s.respondToOffer);
  const startNegotiation = useGameStore(s => s.startNegotiation);
  const setIndividualTraining = useGameStore(s => s.setIndividualTraining);

  const [showApproach, setShowApproach] = useState(false);
  const [showLoanRequest, setShowLoanRequest] = useState(false);
  const [showListConfirm, setShowListConfirm] = useState(false);

  const player = selectedPlayerId ? players[selectedPlayerId] : null;

  // Win streak for recovery guide (must be before early return to satisfy hook rules)
  const currentWinStreak = useMemo(() => getWinStreak(playerClubId, fixtures), [playerClubId, fixtures]);

  // Training widget data (memoized, must be before early return to satisfy hooks rules)
  const trainingWidgetData = useMemo(() => {
    if (!player || player.clubId !== playerClubId) return null;
    const currentFocus = (training.individualPlans || []).find(p => p.playerId === player.id)?.focus;
    const personalityMult = getTrainingMultiplier(player.personality);
    const multColor = personalityMult >= 1.15 ? 'text-emerald-400' : personalityMult <= 0.85 ? 'text-destructive' : 'text-muted-foreground';
    const ftc = getStaffBonus(staff.members, 'first-team-coach');
    const fc = getStaffBonus(staff.members, 'fitness-coach');
    const staffBonus = ftc + fc * 0.5;
    const preview = getTrainingEffectivenessPreview(training, staffBonus, [player]);
    const dominantModule = training.streaks ? Object.entries(training.streaks).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0] : null;
    const streakCount = dominantModule ? (dominantModule[1] || 0) : 0;
    const streakTier = getStreakTier(streakCount);
    return { currentFocus, personalityMult, multColor, preview, streakTier };
  }, [player, playerClubId, training, staff]);

  // Narrative tags (must be before early return to satisfy hook rules)
  const narratives = useMemo(() => player ? getPlayerNarratives(player, season, player.joinedSeason, player.isFromYouthAcademy) : [], [player, season]);

  if (!player) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-muted-foreground">This player is no longer in the game — they may have been released, retired, or transferred.</p>
        <Button variant="secondary" onClick={() => setScreen(previousScreen === 'team-detail' ? 'team-detail' : 'squad')}>Back</Button>
      </div>
    );
  }

  const club = clubs[player.clubId];
  const isOwnPlayer = player.clubId === playerClubId;
  const ratingColor = getRatingColor(player.overall);

  const playerOffers = incomingOffers.filter(o => o.playerId === player.id);

  const handleSell = () => {
    if (player.listedForSale) {
      unlistPlayer(player.id);
      infoToast(`${player.lastName} removed from transfer list.`);
    } else {
      setShowListConfirm(true);
    }
  };

  const confirmListForSale = () => {
    const result = listPlayerForSale(player.id);
    if (result.appeased) {
      successToast(`${player.lastName} appreciates your honesty!`, 'Transfer request withdrawn — morale improved.');
    } else {
      successToast(`${player.lastName} listed for sale!`, `Asking price: £${(player.value / 1_000_000).toFixed(1)}M. Offers will appear in your Inbox.`);
    }
    setShowListConfirm(false);
  };

  const handleOffer = (offerId: string, accept: boolean) => {
    const result = respondToOffer(offerId, accept);
    if (result.success) {
      successToast(result.message);
      if (accept) { selectPlayer(null); setScreen('squad'); }
    } else {
      errorToast(result.message);
    }
  };

  // Development curve
  const isGrowing = player.age < 24;
  const isDeclining = player.age >= 31;
  const devPct = Math.min(100, (player.overall / player.potential) * 100);

  // Role suitability: find all positions where this player appears as compatible
  const naturalPosition = player.position;
  const compatiblePositions = POSITION_COMPATIBILITY[naturalPosition] || [naturalPosition];

  // Morale factors
  const moraleFactors: { label: string; impact: 'positive' | 'neutral' | 'negative' }[] = [];
  if (player.appearances > 0 && week > 0) {
    const playingTimePct = player.appearances / Math.max(1, week) * 100;
    if (playingTimePct > 50) moraleFactors.push({ label: 'Regular playing time', impact: 'positive' });
    else if (playingTimePct < 20) moraleFactors.push({ label: 'Lack of playing time', impact: 'negative' });
    else moraleFactors.push({ label: 'Limited playing time', impact: 'neutral' });
  }
  if (player.form > 70) moraleFactors.push({ label: 'Good form', impact: 'positive' });
  else if (player.form < 40) moraleFactors.push({ label: 'Poor form', impact: 'negative' });
  if (player.contractEnd <= season) moraleFactors.push({ label: 'Contract expiring', impact: 'negative' });
  if (player.injured) moraleFactors.push({ label: 'Currently injured', impact: 'negative' });
  if (player.wantsToLeave) moraleFactors.push({ label: 'Wants to leave the club', impact: 'negative' });
  if (player.personality?.temperament && player.personality.temperament < 40) moraleFactors.push({ label: 'Volatile temperament', impact: 'negative' });

  // Season performance derived stats
  const goalsPerApp = player.appearances > 0 ? (player.goals / player.appearances).toFixed(2) : '0.00';
  const assistsPerApp = player.appearances > 0 ? (player.assists / player.appearances).toFixed(2) : '0.00';
  const goalContributions = player.goals + player.assists;
  const gcPerApp = player.appearances > 0 ? (goalContributions / player.appearances).toFixed(2) : '0.00';

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <button
        onClick={() => { selectPlayer(null); setScreen(previousScreen === 'team-detail' ? 'team-detail' : 'squad'); }}
        className="flex items-center gap-1 text-muted-foreground text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}>
      <GlassPanel className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center relative overflow-hidden">
              <PlayerAvatar playerId={player.id} jerseyColor={club?.color || '#888'} jerseyNumber={player.squadNumber} size={52} overall={player.overall} position={player.position} />
            <span className={cn('absolute -bottom-0.5 -right-0.5 text-[10px] font-black bg-background rounded-full w-6 h-6 flex items-center justify-center border border-border tabular-nums', ratingColor)}>
              {player.overall}
            </span>
            {player.growthDelta > 0 && (
              <TrendingUp className="absolute -top-1 -left-1 w-4 h-4 text-emerald-400" />
            )}
            {player.growthDelta < 0 && (
              <TrendingDown className="absolute -top-1 -left-1 w-4 h-4 text-destructive" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-xl font-black text-foreground">{player.firstName} {player.lastName}</p>
            <p className="text-sm text-muted-foreground">
              {player.position} · {player.age} · {getFlag(player.nationality)} {player.nationality}
              {player.potential > player.overall && <span className="text-primary"> · Pot {player.potential}</span>}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: club?.color || '#888' }} />
              <span className="text-xs text-muted-foreground">{club?.name || 'Unknown'}</span>
            </div>
          </div>
        </div>
      </GlassPanel>
      </motion.div>

      {/* Narrative Tags */}
      {narratives.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {narratives.map(n => (
            <div key={n.tag} className="flex items-center gap-1.5 bg-muted/30 border border-border/40 rounded-full px-3 py-1">
              <Award className={cn('w-3 h-3', n.color)} />
              <span className={cn('text-[10px] font-bold', n.color)}>{n.tag}</span>
            </div>
          ))}
        </div>
      )}

      {/* Transfer Request Badge */}
      {player.wantsToLeave && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-xs font-bold text-destructive">Transfer Request Submitted</span>
          {(player.lowMoraleWeeks || 0) >= UNHAPPY_CONTAGION_WEEKS && (
            <span className="text-[8px] font-bold text-destructive bg-destructive/20 px-1 py-0.5 rounded">CONTAGIOUS</span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">Low morale for {player.lowMoraleWeeks || 0} weeks</span>
        </div>
      )}

      {/* Happiness Recovery Guide */}
      {isOwnPlayer && (player.wantsToLeave || player.morale < 50) && (() => {
        const playerClub = clubs[playerClubId];
        const isInLineup = playerClub?.lineup?.includes(player.id);
        const isInSubs = playerClub?.subs?.includes(player.id);
        const isSuspended = player.suspendedUntilWeek && player.suspendedUntilWeek > week;
        const playingTimePct = player.appearances / Math.max(1, week) * 100;

        const tips: { text: string; actionable: boolean; done: boolean; warning?: boolean }[] = [];

        // Contagion warning (show first — most urgent)
        const lowWeeks = player.lowMoraleWeeks || 0;
        if (lowWeeks >= UNHAPPY_CONTAGION_WEEKS) {
          tips.push({
            text: 'Spreading unhappiness to teammates — 2 random players lose 3 morale per week',
            actionable: false,
            done: false,
            warning: true,
          });
        } else if (lowWeeks >= UNHAPPY_CONTAGION_WEEKS - 2 && lowWeeks > 0) {
          tips.push({
            text: `${UNHAPPY_CONTAGION_WEEKS - lowWeeks} more week${UNHAPPY_CONTAGION_WEEKS - lowWeeks === 1 ? '' : 's'} until unhappiness spreads to teammates`,
            actionable: true,
            done: false,
            warning: true,
          });
        }

        // Playing time (skip if injured or suspended)
        if (player.injured) {
          tips.push({ text: 'Wait for injury recovery before giving playing time', actionable: false, done: false });
        } else if (isSuspended) {
          tips.push({ text: 'Player is suspended — playing time will resume after suspension ends', actionable: false, done: false });
        } else if (!isInLineup) {
          tips.push({
            text: isInSubs
              ? 'Promote to starting XI — regular starts boost morale significantly'
              : 'Select in squad — excluded players lose 3 morale per week',
            actionable: true,
            done: false,
          });
        } else if (playingTimePct > 50) {
          tips.push({ text: 'Getting regular playing time', actionable: false, done: true });
        }

        // Poor form
        if (player.form < 40) {
          tips.push({ text: 'Poor form is hurting morale — play in winnable matches to rebuild confidence', actionable: true, done: false });
        }

        // Winning matches
        tips.push({
          text: 'Win matches — each win gives +8 morale to all squad members',
          actionable: true,
          done: false,
        });

        // Win streak
        tips.push({
          text: `Build a win streak — ${STREAK_MORALE_THRESHOLD}+ consecutive wins gives +2 morale per week`,
          actionable: true,
          done: currentWinStreak >= STREAK_MORALE_THRESHOLD,
        });

        // Leadership
        const squadPlayers = playerClub?.playerIds?.map(id => players[id]).filter(Boolean) || [];
        const totalLeadership = squadPlayers.reduce((sum, p) => sum + getLeadershipBonus(p.personality), 0);
        if (totalLeadership >= 0.15) {
          tips.push({ text: 'Strong squad leaders — +1 morale per week for everyone', actionable: false, done: true });
        } else {
          tips.push({ text: 'Sign or develop high-leadership players to boost squad morale weekly', actionable: true, done: false });
        }

        // Contract
        if (player.contractEnd <= season) {
          tips.push({
            text: 'Offer a contract renewal — expiring contracts cause morale drops',
            actionable: true,
            done: false,
          });
        }

        // Manager perk tips
        if (hasPerk(managerProgression, 'motivator')) {
          tips.push({ text: 'Motivator perk active — +5 morale boost before each match', actionable: false, done: true });
        } else {
          tips.push({ text: 'Unlock the Motivator perk for +5 pre-match morale boost', actionable: true, done: false });
        }

        if (hasPerk(managerProgression, 'iron_will')) {
          tips.push({ text: 'Iron Will perk active — no morale penalty from defeats', actionable: false, done: true });
        }

        if (hasPerk(managerProgression, 'fortress_mentality')) {
          tips.push({ text: 'Fortress Mentality active — home wins give +3 extra morale', actionable: false, done: true });
        }

        // Listing for sale (appease mechanic hint)
        if (player.wantsToLeave && !player.listedForSale) {
          tips.push({
            text: 'List for sale — rarely, players respect being allowed to leave and withdraw their request',
            actionable: true,
            done: false,
          });
        }

        // Recovery target
        tips.push({
          text: player.wantsToLeave
            ? 'Raise morale to 50+ to withdraw the transfer request'
            : 'Keep morale above 30 to prevent a transfer request',
          actionable: false,
          done: false,
        });

        return (
          <GlassPanel className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">How to Improve Happiness</p>
            <div className="space-y-2">
              {tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                    tip.warning ? 'bg-destructive' : tip.done ? 'bg-emerald-400' : tip.actionable ? 'bg-primary' : 'bg-muted-foreground'
                  )} />
                  <span className={cn(
                    tip.warning ? 'text-destructive font-semibold' : tip.done ? 'text-emerald-400' : 'text-muted-foreground'
                  )}>{tip.text}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        );
      })()}

      {/* Key Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlassPanel className="p-3 text-center">
          <Zap className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-black text-foreground tabular-nums">{player.fitness}%</p>
          <p className="text-[10px] text-muted-foreground">Fitness</p>
        </GlassPanel>
        <GlassPanel className="p-3 text-center">
          <Heart className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className={cn("text-lg font-black tabular-nums", getMoodColor(player.morale))}>{player.morale}%</p>
          <p className="text-[10px] text-muted-foreground">{getMoodLabel(player.morale)}</p>
        </GlassPanel>
        <GlassPanel className="p-3 text-center">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-black text-foreground tabular-nums">{player.form}%</p>
          <p className="text-[10px] text-muted-foreground">Form</p>
        </GlassPanel>
      </div>

      {/* Morale Factors */}
      {moraleFactors.length > 0 && (
        <GlassPanel className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Morale Factors</p>
          <div className="space-y-1">
            {moraleFactors.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  f.impact === 'positive' ? "bg-emerald-400" : f.impact === 'negative' ? "bg-destructive" : "bg-amber-400"
                )} />
                <span className="text-muted-foreground">{f.label}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Positive Status — show when no issues */}
      {isOwnPlayer && !player.injured && !player.wantsToLeave && player.morale >= 50 && moraleFactors.every(f => f.impact !== 'negative') && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
          <Heart className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">Player is fit, happy, and settled at the club</span>
        </div>
      )}

      {/* Development Curve */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Development</p>
          {isGrowing && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
              Growing
            </span>
          )}
          {isDeclining && (
            <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              Declining
            </span>
          )}
          {!isGrowing && !isDeclining && (
            <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              Peak
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground tabular-nums w-7">{player.overall}</span>
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden relative">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isGrowing ? 'bg-emerald-500' : isDeclining ? 'bg-destructive' : 'bg-primary'
              )}
              style={{ width: `${devPct}%` }}
            />
            {/* Potential marker line */}
            <div className="absolute right-0 top-0 h-full w-0.5 bg-foreground/30" />
          </div>
          <span className="text-sm font-bold text-primary tabular-nums w-7">{player.potential}</span>
        </div>
        <div className="relative mt-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Current</span>
            <span className="text-[10px] text-muted-foreground">
              Gap: {player.potential - player.overall > 0 ? `+${player.potential - player.overall}` : '0'}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">Potential <InfoTip text={HELP_TEXTS.potential} className="[&>:last-child]:absolute [&>:last-child]:left-0 [&>:last-child]:right-0 [&>:last-child]:top-full" /></span>
          </div>
          {/* Growth trajectory context */}
          {isGrowing && player.potential - player.overall > 0 && (
            <p className="text-[10px] text-emerald-400/80 mt-1.5">
              Peak years: {Math.max(player.age, 27)}-{Math.min(30, Math.max(player.age + 1, 29))} · Room to grow +{player.potential - player.overall} OVR
            </p>
          )}
          {isDeclining && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Past peak — expect gradual attribute decline each season
            </p>
          )}
        </div>
      </GlassPanel>

      {/* Individual Training Focus */}
      {isOwnPlayer && trainingWidgetData && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Training Focus</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TRAINING_MODULE_INFO.map(({ module, label, icon: Icon, color }) => {
              const isActive = trainingWidgetData.currentFocus === module;
              return (
                <button
                  key={module}
                  onClick={() => {
                    hapticLight();
                    setIndividualTraining(player.id, isActive ? null : module);
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border',
                    isActive
                      ? 'bg-primary/20 text-primary border-primary/30'
                      : 'bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50'
                  )}
                >
                  <Icon className={cn('w-3 h-3', isActive ? color : '')} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Focus bonus description */}
          {trainingWidgetData.currentFocus ? (
            <p className="text-[10px] text-emerald-400/80 mt-2">
              +50% gain for {(MODULE_ATTR_MAP[trainingWidgetData.currentFocus] || []).map(a => ATTR_LABELS[a] || a).join(', ')}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-2">No individual focus set. Assign one for +50% training gain.</p>
          )}

          {/* Divider */}
          <div className="border-t border-border/30 mt-3 pt-3 space-y-2">
            {/* Personality multiplier */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Training Multiplier</span>
              <span className={cn('text-[11px] font-semibold tabular-nums', trainingWidgetData.multColor)}>
                {trainingWidgetData.personalityMult.toFixed(2)}x
              </span>
            </div>

            {/* Expected gain rates for focused attributes */}
            {trainingWidgetData.currentFocus && (() => {
              const focusAttrs = MODULE_ATTR_MAP[trainingWidgetData.currentFocus] || [];
              const moduleRate = trainingWidgetData.preview.moduleGainRates.find(r => r.module === trainingWidgetData.currentFocus);

              if (!moduleRate) {
                return (
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Expected Gain Rate</span>
                    <p className="text-[10px] text-amber-400/80">
                      Not in the weekly schedule. Add sessions to see gains.
                    </p>
                  </div>
                );
              }

              return focusAttrs.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Expected Gain Rate</span>
                  {focusAttrs.map(attr => {
                    const effectiveRate = Math.min(100, moduleRate.expectedGainPct * trainingWidgetData.personalityMult * INDIVIDUAL_TRAINING_BONUS);
                    const barWidth = Math.min(100, effectiveRate * 4);
                    return (
                      <div key={attr} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-6">{ATTR_LABELS[attr] || attr}</span>
                        <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500/70 rounded-full transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-emerald-400 tabular-nums w-10 text-right">{effectiveRate.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Intensity & fitness impact */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Intensity</span>
              <span className="text-[11px] font-medium text-foreground capitalize">{training.intensity}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Weekly Fitness Impact</span>
              <span className={cn('text-[11px] font-semibold tabular-nums', trainingWidgetData.preview.fitnessImpact >= 0 ? 'text-emerald-400' : 'text-destructive')}>
                {trainingWidgetData.preview.fitnessImpact >= 0 ? '+' : ''}{trainingWidgetData.preview.fitnessImpact}
              </span>
            </div>

            {/* Injury risk */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className={cn('w-3 h-3', trainingWidgetData.preview.injuryRiskPct > 2 ? 'text-destructive' : 'text-muted-foreground')} />
                Injury Risk
              </span>
              <span className={cn('text-[11px] font-semibold tabular-nums',
                trainingWidgetData.preview.injuryRiskPct > 2 ? 'text-destructive' : trainingWidgetData.preview.injuryRiskPct > 1 ? 'text-amber-400' : 'text-emerald-400'
              )}>
                {trainingWidgetData.preview.injuryRiskPct}%
              </span>
            </div>

            {/* Streak info */}
            {trainingWidgetData.streakTier.tier > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Training Streak</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-foreground">{trainingWidgetData.streakTier.label}</span>
                  <span className="text-[10px] text-amber-400 tabular-nums">
                    +{((STREAK_MULTIPLIERS[trainingWidgetData.streakTier.tier] - 1) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </GlassPanel>
      )}

      {/* Role Suitability */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Role Suitability</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {compatiblePositions.map((pos: Position) => {
            const isNatural = pos === naturalPosition;
            return (
              <div
                key={pos}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border',
                  isNatural
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-border/40 bg-muted/30'
                )}
              >
                <span className={cn(
                  'text-xs font-bold',
                  isNatural ? 'text-primary' : 'text-foreground'
                )}>
                  {pos}
                </span>
                <span className={cn(
                  'text-[9px] font-medium',
                  isNatural ? 'text-primary/70' : 'text-muted-foreground'
                )}>
                  {isNatural ? 'Natural' : 'Capable'}
                </span>
              </div>
            );
          })}
        </div>
      </GlassPanel>

      {/* Grouped Attributes */}
      <GlassPanel className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Attributes</p>

        <PlayerRadarChart attributes={player.attributes} changes={player.lastAttributeChanges} />

        {/* Attack */}
        <div>
          <p className="text-[10px] text-red-400/80 uppercase tracking-wider font-semibold mb-2">Attack</p>
          <div className="space-y-2">
            <StatBar label="Pace" value={player.attributes.pace} change={player.lastAttributeChanges?.pace} />
            <StatBar label="Shooting" value={player.attributes.shooting} change={player.lastAttributeChanges?.shooting} />
          </div>
        </div>

        {/* Playmaking */}
        <div>
          <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-semibold mb-2">Playmaking</p>
          <div className="space-y-2">
            <StatBar label="Passing" value={player.attributes.passing} change={player.lastAttributeChanges?.passing} />
            <StatBar label="Mental" value={player.attributes.mental} change={player.lastAttributeChanges?.mental} />
          </div>
        </div>

        {/* Defense */}
        <div>
          <p className="text-[10px] text-blue-400/80 uppercase tracking-wider font-semibold mb-2">Defense</p>
          <div className="space-y-2">
            <StatBar label="Defending" value={player.attributes.defending} change={player.lastAttributeChanges?.defending} />
            <StatBar label="Physical" value={player.attributes.physical} change={player.lastAttributeChanges?.physical} />
          </div>
        </div>
      </GlassPanel>

      {/* Personality */}
      {player.personality && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Personality</p>
            <InfoTip text={HELP_TEXTS.personality} />
            <span className="ml-auto text-xs font-bold text-primary">{getPersonalityLabel(player.personality)}</span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Professionalism', value: player.personality.professionalism },
              { label: 'Ambition', value: player.personality.ambition },
              { label: 'Temperament', value: player.personality.temperament },
              { label: 'Loyalty', value: player.personality.loyalty },
              { label: 'Leadership', value: player.personality.leadership },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-24">{t.label}</span>
                <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', t.value >= ATTR_RATING_HIGH ? 'bg-emerald-400' : t.value >= ATTR_RATING_MID ? 'bg-sky-400' : t.value >= ATTR_RATING_LOW ? 'bg-amber-400' : 'bg-destructive')}
                    style={{ width: `${(t.value / 20) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground w-5 text-right tabular-nums">{t.value}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Season Stats */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Season Stats</p>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: 'Apps', value: player.appearances },
            { label: 'Goals', value: player.goals },
            { label: 'Assists', value: player.assists },
            { label: 'Yellow', value: player.yellowCards },
          ].map(s => (
            <div key={s.label}>
              <p className="text-lg font-black text-foreground tabular-nums">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Performance Ratios */}
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Performance</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-sm font-bold text-foreground tabular-nums">{goalsPerApp}</p>
              <p className="text-[9px] text-muted-foreground">Goals/App</p>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tabular-nums">{assistsPerApp}</p>
              <p className="text-[9px] text-muted-foreground">Assists/App</p>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tabular-nums">{gcPerApp}</p>
              <p className="text-[9px] text-muted-foreground">G+A/App</p>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* Career Stats */}
      {player.careerAppearances > 0 && (
        <GlassPanel className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Career Totals</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-black text-foreground tabular-nums">{player.careerAppearances}</p>
              <p className="text-[10px] text-muted-foreground">Apps</p>
            </div>
            <div>
              <p className="text-lg font-black text-foreground tabular-nums">{player.careerGoals}</p>
              <p className="text-[10px] text-muted-foreground">Goals</p>
            </div>
            <div>
              <p className="text-lg font-black text-foreground tabular-nums">{player.careerAssists}</p>
              <p className="text-[10px] text-muted-foreground">Assists</p>
            </div>
          </div>
          {player.careerAppearances > player.appearances && (
            <div className="mt-2 pt-2 border-t border-border/30">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs font-bold text-muted-foreground tabular-nums">
                    {(player.careerGoals / player.careerAppearances).toFixed(2)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Career G/App</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground tabular-nums">
                    {(player.careerAssists / player.careerAppearances).toFixed(2)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Career A/App</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground tabular-nums">
                    {((player.careerGoals + player.careerAssists) / player.careerAppearances).toFixed(2)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Career G+A/App</p>
                </div>
              </div>
            </div>
          )}
        </GlassPanel>
      )}

      {/* Contract */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Contract</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-bold text-foreground tabular-nums">
              £{(player.value / 1e6).toFixed(1)}M
            </p>
            <p className="text-xs text-muted-foreground">Market Value</p>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground tabular-nums">
              £{(player.wage / 1e3).toFixed(0)}K/w
            </p>
            <p className="text-xs text-muted-foreground">Wage</p>
          </div>
          <div>
            <p className={cn(
              'text-sm font-bold tabular-nums',
              player.contractEnd <= season ? 'text-destructive' : 'text-foreground'
            )}>
              Season {player.contractEnd}
            </p>
            <p className="text-xs text-muted-foreground">
              Contract Until
              {player.contractEnd <= season && (
                <span className="text-destructive ml-1">· Expiring</span>
              )}
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Transfer Clauses */}
      {(player.sellOnPercentage || player.releaseClause) && (
        <GlassPanel className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Clauses</p>
          <div className="space-y-1">
            {player.sellOnPercentage && player.sellOnClubId && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Sell-on clause</span>
                <span className="text-amber-400">{player.sellOnPercentage}% to {clubs[player.sellOnClubId]?.shortName || 'Unknown'}</span>
              </div>
            )}
            {player.releaseClause && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Release clause</span>
                <span className="text-destructive">£{(player.releaseClause / 1e6).toFixed(1)}M</span>
              </div>
            )}
          </div>
        </GlassPanel>
      )}

      {/* Injury Recovery Panel */}
      {player.injured && (() => {
        const details = player.injuryDetails;
        const progressPct = details
          ? Math.max(5, ((details.totalWeeks - details.weeksRemaining) / details.totalWeeks) * 100)
          : Math.max(5, 100 - (player.injuryWeeks / 5) * 100);
        const severityColor = details?.severity === 'severe' ? 'text-destructive' : details?.severity === 'moderate' ? 'text-orange-400' : 'text-amber-400';
        const severityBg = details?.severity === 'severe' ? 'bg-destructive/20' : details?.severity === 'moderate' ? 'bg-orange-400/20' : 'bg-amber-400/20';
        return (
          <GlassPanel className="p-4 border-destructive/30">
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="w-4 h-4 text-destructive" />
              <p className="text-sm text-destructive font-bold">
                Injured — {player.injuryWeeks} week{player.injuryWeeks !== 1 ? 's' : ''} remaining
              </p>
            </div>
            {details && (
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', severityColor, severityBg)}>
                  {details.severity}
                </span>
                <span className="text-xs text-foreground font-medium">{details.type.replace(/_/g, ' ')}</span>
              </div>
            )}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Recovery Progress</span>
                  <span>Est. return: Week {Math.min(week + player.injuryWeeks, 46)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-destructive to-amber-500 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              {details && (
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {details.reinjuryRisk > 0 && (
                    <div className="flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Re-injury risk: {Math.round(details.reinjuryRisk * 100)}%</span>
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    Fitness on return: {details.fitnessOnReturn}%
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Stethoscope className="w-3 h-3" />
                <span>Medical Center Lv.{facilities.medicalLevel}</span>
                {facilities.medicalLevel >= 5 && <span className="text-emerald-400">— Enhanced recovery</span>}
              </div>
            </div>
          </GlassPanel>
        );
      })()}

      {/* Sell Button */}
      {isOwnPlayer && (
        <Button
          variant={player.listedForSale ? 'outline' : 'secondary'}
          className="w-full gap-2"
          onClick={handleSell}
        >
          {player.listedForSale ? <X className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
          {player.listedForSale ? 'Remove from Transfer List' : 'List for Sale'}
        </Button>
      )}

      {/* Contract Renewal */}
      {isOwnPlayer && player.contractEnd <= season + 1 && (
        <Button
          variant="outline"
          className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
          onClick={() => startNegotiation(player.id, true)}
        >
          <FileText className="w-4 h-4" /> Negotiate Renewal
          <span className="text-[10px] text-muted-foreground ml-auto">
            Expires end of S{player.contractEnd}
          </span>
        </Button>
      )}

      {/* Rival Player Actions */}
      {!isOwnPlayer && transferWindowOpen && !player.onLoan && (
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full gap-2"
            onClick={() => { hapticLight(); setShowApproach(true); }}
          >
            <Banknote className="w-4 h-4" /> Make Transfer Offer
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 border-primary/30 text-primary"
            onClick={() => { hapticLight(); setShowLoanRequest(true); }}
          >
            <Repeat2 className="w-4 h-4" /> Request Loan
          </Button>
        </div>
      )}

      {/* Incoming Offers */}
      {playerOffers.length > 0 && (
        <GlassPanel className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Incoming Offers</p>
          <div className="space-y-3">
            {playerOffers.map(offer => {
              const buyer = clubs[offer.buyerClubId];
              return (
                <div key={offer.id} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: buyer?.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{buyer?.name || '?'}</p>
                    <p className="text-xs text-primary font-bold tabular-nums">
                      £{(offer.fee / 1e6).toFixed(1)}M
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-10 text-xs px-3" onClick={() => handleOffer(offer.id, true)}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" className="h-10 text-xs px-3" onClick={() => handleOffer(offer.id, false)}>
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Approach / Loan Modals */}
      {showApproach && (
        <TransferApproach playerId={player.id} onClose={() => setShowApproach(false)} />
      )}
      {showLoanRequest && (
        <LoanNegotiation playerId={player.id} onClose={() => setShowLoanRequest(false)} />
      )}

      {/* List for Sale Confirmation */}
      <ConfirmDialog
        open={showListConfirm}
        onOpenChange={setShowListConfirm}
        title="List Player for Sale?"
        description={`${player.firstName} ${player.lastName} (${player.overall} OVR) will be listed at ~£${(player.value / 1_000_000).toFixed(1)}M. Other clubs may make offers via your Inbox.`}
        confirmLabel="List for Sale"
        variant="default"
        onConfirm={confirmListForSale}
      />
    </div>
  );
};

export default PlayerDetail;
