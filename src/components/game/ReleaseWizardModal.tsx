import { useMemo, useState } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/game';
import { getRatingColor, posBadgeColor } from '@/utils/uiHelpers';
import { formatWage } from '@/utils/contracts';
import { formatMoney } from '@/utils/helpers';
import { FlagIcon } from '@/components/game/FlagIcon';
import { calcReleaseImpact } from '@/utils/releaseCalc';
import { MIN_SQUAD_SIZE } from '@/config/gameBalance';
import { errorToast, successToast } from '@/utils/gameToast';
import { hapticHeavy, hapticLight } from '@/utils/haptics';
import { X, Skull, Wallet, Users, AlertTriangle, ArrowRight, CheckCircle2, Circle, Sparkles } from 'lucide-react';

interface Props {
  candidates: Player[];
  onClose: () => void;
}

export function ReleaseWizardModal({ candidates, onClose }: Props) {
  const { clubs, playerClubId, players, season, week, totalWeeks } = useGameStore(useShallow(s => ({
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    players: s.players,
    season: s.season,
    week: s.week,
    totalWeeks: s.totalWeeks,
  })));
  const releasePlayer = useGameStore(s => s.releasePlayer);

  useScrollLock();
  useEscapeClose(onClose);

  const club = clubs[playerClubId];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const impactByPlayer = useMemo(() => {
    const map: Record<string, ReturnType<typeof calcReleaseImpact>> = {};
    for (const p of candidates) {
      map[p.id] = calcReleaseImpact(p, season, week, totalWeeks);
    }
    return map;
  }, [candidates, season, week, totalWeeks]);

  const totals = useMemo(() => {
    let totalCost = 0;
    let totalWeeklyWageSaved = 0;
    let fanDelta = 0;
    let boardDelta = 0;
    for (const id of selectedIds) {
      const p = players[id];
      const i = impactByPlayer[id];
      if (!p || !i) continue;
      totalCost += i.clauseCost;
      totalWeeklyWageSaved += p.wage;
      fanDelta += i.fanMoodDelta;
      boardDelta += i.boardConfidenceDelta;
    }
    return { totalCost, totalWeeklyWageSaved, fanDelta, boardDelta };
  }, [selectedIds, impactByPlayer, players]);

  if (!club) return null;

  const remainingSquadSize = club.playerIds.length - selectedIds.size;
  const canAfford = club.budget >= totals.totalCost;
  const wouldDropBelowMin = remainingSquadSize < MIN_SQUAD_SIZE;
  const blocked = selectedIds.size === 0 || !canAfford || wouldDropBelowMin || busy;

  const toggle = (id: string) => {
    hapticLight();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (blocked) return;
    setBusy(true);
    hapticHeavy();
    const sortedIds = [...selectedIds].sort((a, b) => impactByPlayer[a].clauseCost - impactByPlayer[b].clauseCost);
    let releasedCount = 0;
    let firstFailure: string | null = null;
    for (const id of sortedIds) {
      const result = releasePlayer(id);
      if (result.success) releasedCount++;
      else if (!firstFailure) firstFailure = result.message;
    }
    setBusy(false);
    if (releasedCount > 0) {
      successToast(
        `${releasedCount} player${releasedCount === 1 ? '' : 's'} released`,
        firstFailure ? `Stopped early: ${firstFailure}` : 'Wages cleared from the books.',
      );
    } else if (firstFailure) {
      errorToast(firstFailure);
    }
    onClose();
  };

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
          className="relative w-full max-w-sm max-h-[90vh] overflow-hidden bg-card/95 backdrop-blur-xl border border-destructive/30 rounded-b-2xl sm:rounded-2xl sm:mx-4 shadow-[0_0_60px_-12px_rgba(239,68,68,0.35)] flex flex-col"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="release-wizard-title"
        >
          <div className="p-4 pb-3 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Skull className="w-3.5 h-3.5 text-destructive" aria-hidden />
                <p id="release-wizard-title" className="text-xs font-semibold text-destructive uppercase tracking-wider">Release Multiple Players</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 -mr-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Pick fringe squad members to release in one go. Each costs a one-time clause based on their remaining wages.
            </p>
          </div>

          <div className="h-px bg-border/30 shrink-0" />

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
            {candidates.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                No obvious release candidates right now — everyone's either active or already on the move.
              </p>
            ) : candidates.map(p => {
              const i = impactByPlayer[p.id];
              const selected = selectedIds.has(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors text-left',
                    selected
                      ? 'border-destructive/40 bg-destructive/10'
                      : 'border-border/30 bg-muted/20 hover:bg-muted/30',
                  )}
                >
                  {selected
                    ? <CheckCircle2 className="w-4 h-4 text-destructive shrink-0" />
                    : <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  }
                  <span className={cn('text-[11px] font-bold tabular-nums w-7 text-center', getRatingColor(p.overall))}>{p.overall}</span>
                  <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded leading-none shrink-0', posBadgeColor(p.position))}>{p.position}</span>
                  <FlagIcon nationality={p.nationality} size={12} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-foreground truncate leading-tight">{p.firstName[0]}. {p.lastName}</p>
                    <p className="text-[9px] text-muted-foreground tabular-nums">{p.age}y · {formatWage(p.wage)} · {p.appearances} apps</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-black text-destructive tabular-nums">{formatMoney(i.clauseCost)}</p>
                    {i.reasons.length > 0 && (
                      <p className="text-[8px] text-amber-400 uppercase tracking-wider">Risky</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="h-px bg-border/30 shrink-0" />

          <div className="px-4 py-2.5 grid grid-cols-2 gap-2 shrink-0">
            <SummaryTile
              icon={<Wallet className="w-3.5 h-3.5" />}
              label="Clause total"
              value={formatMoney(totals.totalCost)}
              tone={canAfford ? 'neutral' : 'bad'}
            />
            <SummaryTile
              icon={<Sparkles className="w-3.5 h-3.5" />}
              label="Wage saved/wk"
              value={formatWage(totals.totalWeeklyWageSaved)}
              tone="good"
            />
            <SummaryTile
              icon={<Users className="w-3.5 h-3.5" />}
              label="Squad after"
              value={`${remainingSquadSize}`}
              tone={wouldDropBelowMin ? 'bad' : remainingSquadSize <= MIN_SQUAD_SIZE + 1 ? 'warn' : 'neutral'}
            />
            <SummaryTile
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              label="Mood ripple"
              value={totals.fanDelta < 0 ? `${totals.fanDelta} fans, ${totals.boardDelta} board` : 'No backlash'}
              tone={totals.fanDelta < 0 ? 'warn' : 'neutral'}
            />
          </div>

          {wouldDropBelowMin && (
            <p className="text-[10px] text-destructive flex items-center gap-1.5 px-4 pb-1 shrink-0">
              <AlertTriangle className="w-3 h-3" />
              Squad would fall below minimum ({MIN_SQUAD_SIZE}).
            </p>
          )}
          {!canAfford && !wouldDropBelowMin && totals.totalCost > 0 && (
            <p className="text-[10px] text-destructive flex items-center gap-1.5 px-4 pb-1 shrink-0">
              <AlertTriangle className="w-3 h-3" />
              Short by {formatMoney(totals.totalCost - club.budget)}.
            </p>
          )}

          <div className="border-t border-border/30 bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] space-y-2 shrink-0">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={blocked}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black transition-all',
                blocked
                  ? 'bg-muted/40 text-muted-foreground/60 cursor-not-allowed'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98] shadow-[0_0_24px_rgba(239,68,68,0.35)]',
              )}
            >
              Release {selectedIds.size} · {formatMoney(totals.totalCost)} <ArrowRight className="w-4 h-4" />
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

function SummaryTile({ icon, label, value, tone }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const valueColor =
    tone === 'bad' ? 'text-destructive' :
    tone === 'warn' ? 'text-amber-400' :
    tone === 'good' ? 'text-emerald-400' :
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
