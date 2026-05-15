import { useMemo } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { Player } from '@/types/game';
import { getRatingColor, getTop3Attributes } from '@/utils/uiHelpers';
import { formatWage } from '@/utils/contracts';
import { formatMoney } from '@/utils/helpers';
import { FlagIcon } from '@/components/game/FlagIcon';
import { PlayerCard } from '@/components/game/PlayerCard';
import { calcReleaseImpact } from '@/utils/releaseCalc';
import { RELEASE_CLAUSE_PERCENTAGE } from '@/config/transfers';
import { MIN_SQUAD_SIZE } from '@/config/gameBalance';
import { hapticHeavy } from '@/utils/haptics';
import {
  X, Skull, Wallet, Users, Heart, Megaphone, ShieldAlert, AlertTriangle, ArrowRight, Sparkles,
} from 'lucide-react';

interface Props {
  player: Player;
  onClose: () => void;
  onReleased: () => void;
}

export function ReleasePlayerModal({ player, onClose, onReleased }: Props) {
  const { clubs, playerClubId, players, season, week, totalWeeks, fanMood, boardConfidence } = useGameStore(useShallow(s => ({
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    players: s.players,
    season: s.season,
    week: s.week,
    totalWeeks: s.totalWeeks,
    fanMood: s.fanMood,
    boardConfidence: s.boardConfidence,
  })));
  const releasePlayer = useGameStore(s => s.releasePlayer);

  useScrollLock();
  useEscapeClose(onClose);

  const club = clubs[playerClubId];

  const top3 = useMemo(() => getTop3Attributes(player.attributes), [player]);
  const impact = useMemo(() => calcReleaseImpact(player, season, week, totalWeeks), [player, season, week, totalWeeks]);

  const positionCount = useMemo(() => {
    if (!club) return 0;
    return club.playerIds.filter(id => players[id]?.position === player.position).length;
  }, [club, players, player.position]);

  if (!club) return null;

  const canAfford = club.budget >= impact.clauseCost;
  const wouldDropBelowMin = club.playerIds.length <= MIN_SQUAD_SIZE;
  const blocked = !canAfford || wouldDropBelowMin;

  const handleRelease = () => {
    if (blocked) return;
    hapticHeavy();
    const result = releasePlayer(player.id);
    if (result.success) {
      onReleased();
      onClose();
    }
  };

  const yearsRemaining = Math.max(0, player.contractEnd - season);
  const clausePct = Math.round(RELEASE_CLAUSE_PERCENTAGE * 100);

  const nextFanMood = Math.max(0, Math.min(100, fanMood + impact.fanMoodDelta));
  const nextBoardConfidence = Math.max(0, Math.min(100, boardConfidence + impact.boardConfidenceDelta));

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center pt-[env(safe-area-inset-top,40px)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" style={{ touchAction: 'none' }} onClick={onClose} />

        <motion.div
          className="relative w-full max-w-sm max-h-[88vh] overflow-y-auto bg-card/95 backdrop-blur-xl border border-destructive/30 rounded-b-2xl sm:rounded-2xl sm:mx-4 shadow-[0_0_60px_-12px_rgba(239,68,68,0.35)]"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="release-title"
        >
          <div className="p-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Skull className="w-3.5 h-3.5 text-destructive" aria-hidden />
                <p id="release-title" className="text-xs font-semibold text-destructive uppercase tracking-wider">Release Player</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 -mr-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <PlayerCard player={player} size="md" interactive="none" compact />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground font-display text-base leading-tight">{player.firstName} {player.lastName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {player.position} · {player.age}y · <FlagIcon nationality={player.nationality} size={14} /> {player.nationality}
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  Wage: <span className="text-foreground/80">{formatWage(player.wage)}</span>
                  <span className="mx-1">·</span>
                  Contract: <span className="text-foreground/80">{yearsRemaining}y left</span>
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 mt-2.5">
              {top3.map(attr => (
                <span key={attr.label} className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                  <span className="text-muted-foreground">{attr.label}</span>{' '}
                  <span className={cn('font-bold', getRatingColor(attr.value))}>{attr.value}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="h-px bg-border/30" />

          <div className="px-4 pt-3 pb-3 space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Remaining wages</span>
              <span className="text-foreground/80 tabular-nums">{formatMoney(impact.fullSeverance)} <span className="text-muted-foreground/60">over {impact.remainingWeeks}w</span></span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Release clause</span>
              <span className="text-foreground/80 tabular-nums">{clausePct}% of remaining</span>
            </div>

            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-wider text-destructive/80 font-bold">One-time cost</span>
                <span className="text-2xl font-black font-display text-destructive tabular-nums leading-none">
                  {formatMoney(impact.clauseCost)}
                </span>
              </div>
              {impact.savingsVsFullSeverance > 0 && (
                <p className="text-[10px] text-emerald-400/80 mt-1 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Saves {formatMoney(impact.savingsVsFullSeverance)} vs. paying out the full contract
                </p>
              )}
            </div>
          </div>

          <div className="h-px bg-border/30" />

          <div className="px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Impact</p>
            <div className="grid grid-cols-2 gap-2">
              <ImpactTile
                icon={<Wallet className="w-3.5 h-3.5" />}
                label="Budget after"
                value={formatMoney(club.budget - impact.clauseCost)}
                tone={canAfford ? 'neutral' : 'bad'}
              />
              <ImpactTile
                icon={<Users className="w-3.5 h-3.5" />}
                label={`${player.position} cover`}
                value={`${Math.max(0, positionCount - 1)} left`}
                tone={positionCount <= 2 ? 'warn' : 'neutral'}
              />
              <ImpactTile
                icon={<Heart className="w-3.5 h-3.5" />}
                label="Fan mood"
                value={impact.fanMoodDelta < 0 ? `${impact.fanMoodDelta} → ${Math.round(nextFanMood)}` : `${Math.round(fanMood)} (no change)`}
                tone={impact.fanMoodDelta < 0 ? 'bad' : 'neutral'}
              />
              <ImpactTile
                icon={<ShieldAlert className="w-3.5 h-3.5" />}
                label="Board"
                value={impact.boardConfidenceDelta < 0 ? `${impact.boardConfidenceDelta} → ${Math.round(nextBoardConfidence)}` : `${Math.round(boardConfidence)} (no change)`}
                tone={impact.boardConfidenceDelta < 0 ? 'bad' : 'neutral'}
              />
            </div>

            {impact.reasons.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Megaphone className="w-3 h-3 text-amber-400" />
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Backlash risk</p>
                </div>
                <ul className="space-y-0.5 pl-4">
                  {impact.reasons.map(r => (
                    <li key={r.tag} className="text-[10px] text-amber-300/90 list-disc">{r.label}</li>
                  ))}
                </ul>
              </div>
            )}

            {wouldDropBelowMin && (
              <p className="text-[10px] text-destructive flex items-center gap-1.5 mt-1">
                <AlertTriangle className="w-3 h-3" />
                Squad is at the minimum size ({MIN_SQUAD_SIZE}) — sign cover first.
              </p>
            )}
            {!canAfford && !wouldDropBelowMin && (
              <p className="text-[10px] text-destructive flex items-center gap-1.5 mt-1">
                <AlertTriangle className="w-3 h-3" />
                Insufficient funds — short by {formatMoney(impact.clauseCost - club.budget)}.
              </p>
            )}
          </div>

          <div className="border-t border-border/30 bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] space-y-2">
            <button
              type="button"
              onClick={handleRelease}
              disabled={blocked}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black transition-all',
                blocked
                  ? 'bg-muted/40 text-muted-foreground/60 cursor-not-allowed'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98] shadow-[0_0_24px_rgba(239,68,68,0.35)]',
              )}
            >
              Release for {formatMoney(impact.clauseCost)} <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ImpactTile({ icon, label, value, tone }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'neutral' | 'warn' | 'bad';
}) {
  const valueColor =
    tone === 'bad' ? 'text-destructive' :
    tone === 'warn' ? 'text-amber-400' :
    'text-foreground';
  return (
    <div className="rounded-lg border border-border/30 bg-muted/20 px-2.5 py-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-[12px] font-bold tabular-nums mt-1 leading-tight', valueColor)}>{value}</p>
    </div>
  );
}
