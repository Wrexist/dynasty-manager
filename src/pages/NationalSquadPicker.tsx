import { useMemo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { getNation, getNationRanking } from '@/data/nations';
import { cn } from '@/lib/utils';
import {
  Globe,
  Trophy,
  CheckCircle,
  Shuffle,
  ChevronRight,
  Calendar,
  AlertTriangle,
  X,
} from 'lucide-react';
import { FlagIcon } from '@/components/game/FlagIcon';
import { Button } from '@/components/ui/button';
import { PageHint } from '@/components/game/PageHint';
import { LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import { getRatingBadge } from '@/utils/uiHelpers';
import { PAGE_HINTS } from '@/config/ui';
import { NATIONAL_SQUAD_SIZE } from '@/config/gameBalance';
import { selectBestLineup } from '@/utils/playerGen';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { successToast } from '@/utils/gameToast';
import type { Player } from '@/types/game';

const POSITION_GROUPS = [
  { key: 'GK', label: 'Goalkeepers', positions: ['GK'] as string[] },
  { key: 'DEF', label: 'Defenders', positions: ['CB', 'LB', 'RB'] as string[] },
  { key: 'MID', label: 'Midfielders', positions: ['CDM', 'CM', 'CAM', 'LM', 'RM'] as string[] },
  { key: 'FWD', label: 'Forwards', positions: ['LW', 'RW', 'ST'] as string[] },
] as const;

const POSITION_QUOTAS: Record<string, { min: number; recommended: number }> = {
  GK: { min: 2, recommended: 3 },
  DEF: { min: 5, recommended: 7 },
  MID: { min: 4, recommended: 7 },
  FWD: { min: 2, recommended: 6 },
};

const POOL_DISPLAY_LIMIT = 50;

function bucketForPosition(pos: string): 'GK' | 'DEF' | 'MID' | 'FWD' {
  if (pos === 'GK') return 'GK';
  if (['CB', 'LB', 'RB'].includes(pos)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
  return 'FWD';
}

const NationalSquadPicker = () => {
  const {
    nationalTeam,
    managerNationality,
    players,
    clubs,
    internationalTournament,
    setScreen,
    confirmNationalSquad,
  } = useGameStore(
    useShallow(s => ({
      nationalTeam: s.nationalTeam,
      managerNationality: s.managerNationality,
      players: s.players,
      clubs: s.clubs,
      internationalTournament: s.internationalTournament,
      setScreen: s.setScreen,
      confirmNationalSquad: s.confirmNationalSquad,
    })),
  );

  // Eligible pool (real players matching the manager's nationality, available to pick).
  const eligible = useMemo<Player[]>(() => {
    if (!managerNationality) return [];
    return Object.values(players)
      .filter(p => p.nationality === managerNationality && !p.injured && p.age >= 17)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, POOL_DISPLAY_LIMIT);
  }, [players, managerNationality]);

  // Local picker state — initialised from the auto-selected default.
  const [pickedIds, setPickedIds] = useState<Set<string>>(() => {
    return new Set(nationalTeam?.squad ?? []);
  });

  // If the underlying squad changes (e.g. tournament regenerated), resync once.
  useEffect(() => {
    setPickedIds(new Set(nationalTeam?.squad ?? []));
  }, [nationalTeam?.squad]);

  const pickedPlayers = useMemo<Player[]>(() => {
    return Array.from(pickedIds)
      .map(id => players[id])
      .filter(Boolean)
      .sort((a, b) => b.overall - a.overall);
  }, [pickedIds, players]);

  const counts = useMemo(() => {
    const result = { GK: 0, DEF: 0, MID: 0, FWD: 0 } as Record<'GK' | 'DEF' | 'MID' | 'FWD', number>;
    for (const p of pickedPlayers) {
      result[bucketForPosition(p.position)]++;
    }
    return result;
  }, [pickedPlayers]);

  const handleToggle = useCallback(
    (id: string) => {
      hapticLight();
      setPickedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else if (next.size < NATIONAL_SQUAD_SIZE) {
          next.add(id);
        }
        return next;
      });
    },
    [],
  );

  const handleAutoFill = useCallback(() => {
    hapticMedium();
    const next = new Set<string>();
    // Walk the position quotas first to ensure coverage, then top up by overall.
    const remaining = [...eligible];
    const order: ('GK' | 'DEF' | 'MID' | 'FWD')[] = ['GK', 'DEF', 'MID', 'FWD'];
    for (const bucket of order) {
      const quota = POSITION_QUOTAS[bucket].recommended;
      const candidates = remaining.filter(p => bucketForPosition(p.position) === bucket);
      for (let i = 0; i < Math.min(quota, candidates.length) && next.size < NATIONAL_SQUAD_SIZE; i++) {
        next.add(candidates[i].id);
      }
    }
    for (const p of remaining) {
      if (next.size >= NATIONAL_SQUAD_SIZE) break;
      next.add(p.id);
    }
    setPickedIds(next);
  }, [eligible]);

  const handleClear = useCallback(() => {
    hapticLight();
    setPickedIds(new Set());
  }, []);

  const handleConfirm = useCallback(() => {
    if (!nationalTeam) return;
    if (pickedPlayers.length !== NATIONAL_SQUAD_SIZE) return;

    // Best-XI from the picked squad for the team's current formation.
    const formation = nationalTeam.formation;
    const { lineup, subs } = selectBestLineup(pickedPlayers, formation);

    const squadIds = pickedPlayers.map(p => p.id);
    const lineupIds = lineup.map(p => p.id);
    const subIds = subs.map(p => p.id).slice(0, 7);

    confirmNationalSquad(squadIds, lineupIds, subIds);
    successToast('Squad locked in!', 'Your nation is ready for kick-off.');
  }, [nationalTeam, pickedPlayers, confirmNationalSquad]);

  if (!nationalTeam || !managerNationality || !internationalTournament) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center space-y-4">
        <Globe className="w-10 h-10 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-bold text-foreground font-display">No tournament to prepare for</h2>
        <p className="text-sm text-muted-foreground">There is no upcoming international tournament right now.</p>
        <Button variant="outline" onClick={() => setScreen('national-team')}>Back to National Team</Button>
      </div>
    );
  }

  const nation = getNation(managerNationality);
  const ranking = getNationRanking(managerNationality);
  const tournament = internationalTournament;
  const remaining = NATIONAL_SQUAD_SIZE - pickedPlayers.length;
  const positionWarnings: string[] = [];
  for (const [key, quota] of Object.entries(POSITION_QUOTAS)) {
    const c = counts[key as keyof typeof counts];
    if (c < quota.min) {
      positionWarnings.push(`Need at least ${quota.min} ${key === 'GK' ? 'goalkeepers' : key.toLowerCase()} (currently ${c})`);
    }
  }
  const canConfirm = pickedPlayers.length === NATIONAL_SQUAD_SIZE && positionWarnings.length === 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-32 space-y-4">
      <PageHint
        screen="nationalSquadPicker"
        title={PAGE_HINTS.nationalSquadPicker.title}
        body={PAGE_HINTS.nationalSquadPicker.body}
      />

      {/* Hero — flag, country, tournament, ranking */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          LIQUID_GLASS_SURFACE,
          'border border-primary/30 p-5 shadow-[0_0_30px_hsl(var(--primary)/0.18)]',
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-amber-500/5 pointer-events-none" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
              style={{ backgroundColor: nation?.color || '#333' }}
            >
              <FlagIcon nationality={managerNationality} size={48} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em]">Squad Selection</p>
              <h1 className="text-xl font-bold text-foreground font-display truncate">{managerNationality}</h1>
              <p className="text-xs text-muted-foreground">World Ranking #{ranking}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-muted/20 rounded-xl p-3 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Tournament
              </p>
              <p className="text-sm font-semibold text-foreground leading-tight">{tournament.name}</p>
            </div>
            <div className="bg-muted/20 rounded-xl p-3 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Kick-off
              </p>
              <p className="text-sm font-semibold text-foreground leading-tight">
                Week {tournament.currentWeek}, Season {tournament.season}
              </p>
              <p className="text-[10px] text-muted-foreground">First match next week</p>
            </div>
          </div>

          {/* Selection status */}
          <div className="bg-card/40 rounded-xl p-3 border border-border/30 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Selected</p>
              <p className="text-sm font-mono font-bold text-foreground">
                <span className={cn(remaining < 0 && 'text-destructive', remaining === 0 && 'text-emerald-400')}>
                  {pickedPlayers.length}
                </span>
                <span className="text-muted-foreground"> / {NATIONAL_SQUAD_SIZE}</span>
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  pickedPlayers.length === NATIONAL_SQUAD_SIZE
                    ? 'bg-emerald-400'
                    : pickedPlayers.length > NATIONAL_SQUAD_SIZE
                      ? 'bg-destructive'
                      : 'bg-primary',
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (pickedPlayers.length / NATIONAL_SQUAD_SIZE) * 100)}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {(['GK', 'DEF', 'MID', 'FWD'] as const).map(key => {
                const quota = POSITION_QUOTAS[key];
                const c = counts[key];
                const ok = c >= quota.min;
                return (
                  <div
                    key={key}
                    className={cn(
                      'rounded-lg py-1.5 text-center border',
                      ok
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300',
                    )}
                  >
                    <p className="text-[9px] uppercase tracking-wider">{key}</p>
                    <p className="text-sm font-mono font-bold">{c}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoFill}
              className="flex-1 h-9 gap-1.5 text-xs"
            >
              <Shuffle className="w-3.5 h-3.5" /> Auto-pick best 23
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-9 px-3 text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Top 50 pool, grouped by position */}
      <div className="space-y-3">
        {POSITION_GROUPS.map(group => {
          const groupPlayers = eligible.filter(p => group.positions.includes(p.position));
          if (groupPlayers.length === 0) return null;

          return (
            <div key={group.key} className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{group.label}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {counts[group.key as keyof typeof counts]} picked
                </p>
              </div>
              <div className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {groupPlayers.map((player, i) => {
                    const isPicked = pickedIds.has(player.id);
                    const isFull = pickedIds.size >= NATIONAL_SQUAD_SIZE;
                    const club = player.clubId ? clubs[player.clubId] : null;
                    return (
                      <motion.button
                        key={player.id}
                        type="button"
                        onClick={() => handleToggle(player.id)}
                        disabled={!isPicked && isFull}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.012, 0.2) }}
                        className={cn(
                          'w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-left',
                          isPicked
                            ? 'bg-primary/15 border-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.2)]'
                            : isFull
                              ? 'bg-card/20 border-border/10 opacity-40 cursor-not-allowed'
                              : 'bg-card/30 border-border/20 hover:border-border/60',
                        )}
                      >
                        <div className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 border',
                          getRatingBadge(player.overall),
                        )}>
                          {player.overall}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {player.firstName} {player.lastName}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {player.position} · Age {player.age}
                            {club ? ` · ${club.shortName}` : ' · External'}
                            {(player.internationalCaps ?? 0) > 0 && ` · ${player.internationalCaps} caps`}
                          </p>
                        </div>
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center shrink-0 border',
                            isPicked
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-transparent text-transparent border-border/40',
                          )}
                        >
                          {isPicked ? <CheckCircle className="w-4 h-4" /> : <ChevronRight className="w-3 h-3" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm bar (sticky) */}
      <div className="fixed inset-x-0 bottom-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <div className={cn(
            LIQUID_GLASS_SURFACE,
            'border border-white/10 p-3 space-y-2 shadow-2xl',
          )}>
            {positionWarnings.length > 0 && (
              <div className="flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{positionWarnings[0]}</span>
              </div>
            )}
            <Button
              className="w-full h-12 font-bold text-sm gap-2"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              <CheckCircle className="w-4 h-4" />
              {canConfirm
                ? `Lock in squad of ${NATIONAL_SQUAD_SIZE} & start ${tournament.name}`
                : pickedPlayers.length < NATIONAL_SQUAD_SIZE
                  ? `Pick ${remaining} more player${remaining === 1 ? '' : 's'}`
                  : 'Adjust squad to meet position minimums'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NationalSquadPicker;
