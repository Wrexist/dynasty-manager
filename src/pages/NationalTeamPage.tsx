import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { getNation, getNationRanking } from '@/data/nations';
import { getUpcomingTournament } from '@/utils/international';
import { cn } from '@/lib/utils';
import { Globe, Users, Trophy, ChevronRight, ChevronDown, CheckCircle, XCircle, Calendar, TrendingUp, Shuffle, Flag, X, Check } from 'lucide-react';
import { FlagIcon } from '@/components/game/FlagIcon';
import { PlayerCard } from '@/components/game/PlayerCard';
import { PlayerStatusBadges } from '@/components/game/PlayerStatusBadges';
import { StatusPill } from '@/components/game/StatusPill';
import { Button } from '@/components/ui/button';
import { PageHint } from '@/components/game/PageHint';
import { LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import { PAGE_HINTS } from '@/config/ui';
import { NT_JOB_MIN_REPUTATION, NATIONAL_SQUAD_SIZE, LINEUP_SIZE } from '@/config/gameBalance';
import { FORMATIONS } from '@/config/tactics';
import { FORMATION_POSITIONS, type FormationType, type Player } from '@/types/game';
import { selectBestLineup } from '@/utils/playerGen';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { successToast, errorToast } from '@/utils/gameToast';

// Position groups & quotas — mirrors NationalSquadPicker so the National
// Team page and the pre-tournament picker speak the same language.
const POSITION_GROUPS = [
  { key: 'GK', label: 'Goalkeepers', positions: ['GK'] as string[] },
  { key: 'DEF', label: 'Defenders', positions: ['CB', 'LB', 'RB'] as string[] },
  { key: 'MID', label: 'Midfielders', positions: ['CDM', 'CM', 'CAM', 'LM', 'RM'] as string[] },
  { key: 'FWD', label: 'Forwards', positions: ['LW', 'RW', 'ST'] as string[] },
] as const;

type PositionBucket = 'GK' | 'DEF' | 'MID' | 'FWD';

const POSITION_QUOTAS: Record<PositionBucket, { min: number; recommended: number }> = {
  GK: { min: 2, recommended: 3 },
  DEF: { min: 5, recommended: 7 },
  MID: { min: 4, recommended: 7 },
  FWD: { min: 2, recommended: 6 },
};

const POOL_DISPLAY_LIMIT = 50;

function bucketForPosition(pos: string): PositionBucket {
  if (pos === 'GK') return 'GK';
  if (['CB', 'LB', 'RB'].includes(pos)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
  return 'FWD';
}

const NationalTeamPage = () => {
  const { nationalTeam, managerNationality, players, setScreen, updateNationalSquad, setNationalFormation, internationalTournament, selectPlayer } = useGameStore(useShallow(s => ({
    nationalTeam: s.nationalTeam,
    managerNationality: s.managerNationality,
    players: s.players,
    setScreen: s.setScreen,
    updateNationalSquad: s.updateNationalSquad,
    setNationalFormation: s.setNationalFormation,
    internationalTournament: s.internationalTournament,
    selectPlayer: s.selectPlayer,
  })));
  const nationalTeamOffer = useGameStore(s => s.nationalTeamOffer);
  const gameMode = useGameStore(s => s.gameMode);
  const season = useGameStore(s => s.season);
  const week = useGameStore(s => s.week);
  const careerManager = useGameStore(s => s.careerManager);
  const acceptNationalTeamOffer = useGameStore(s => s.acceptNationalTeamOffer);
  const declineNationalTeamOffer = useGameStore(s => s.declineNationalTeamOffer);

  const [showFormationPicker, setShowFormationPicker] = useState(false);
  const [editingSquad, setEditingSquad] = useState(false);

  // Fully-sorted eligible pool — every nation player who could be called up.
  const eligibleAll = useMemo<Player[]>(() => {
    if (!managerNationality) return [];
    return Object.values(players)
      .filter(p => p.nationality === managerNationality && !p.injured && p.age >= 17)
      .sort((a, b) => b.overall - a.overall);
  }, [players, managerNationality]);

  const squadPlayers = useMemo<Player[]>(() => {
    if (!nationalTeam) return [];
    return nationalTeam.squad
      .map(id => players[id])
      .filter(Boolean)
      .sort((a, b) => b.overall - a.overall);
  }, [nationalTeam, players]);

  const squadSet = useMemo(() => new Set(nationalTeam?.squad || []), [nationalTeam?.squad]);

  // Edit pool = top 50 by overall, plus any currently-selected players who
  // happen to fall outside the top 50 so the manager can still see / drop them.
  const editPool = useMemo<Player[]>(() => {
    const top = eligibleAll.slice(0, POOL_DISPLAY_LIMIT);
    const seen = new Set(top.map(p => p.id));
    const extras: Player[] = [];
    for (const id of squadSet) {
      if (!seen.has(id)) {
        const p = players[id];
        if (p) extras.push(p);
      }
    }
    return [...top, ...extras].sort((a, b) => b.overall - a.overall);
  }, [eligibleAll, squadSet, players]);

  // Group squad by position bucket for the view-mode card grid.
  const groupedSquad = useMemo(() => {
    const groups: Record<PositionBucket, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of squadPlayers) groups[bucketForPosition(p.position)].push(p);
    return groups;
  }, [squadPlayers]);

  // Group the edit pool the same way, so picking is organised by position.
  const groupedPool = useMemo(() => {
    const groups: Record<PositionBucket, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of editPool) groups[bucketForPosition(p.position)].push(p);
    return groups;
  }, [editPool]);

  // Live counts of the selected squad, by bucket — drives the quota chips.
  const counts = useMemo<Record<PositionBucket, number>>(() => {
    const c: Record<PositionBucket, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const p of squadPlayers) c[bucketForPosition(p.position)]++;
    return c;
  }, [squadPlayers]);

  const lineupSet = useMemo(() => new Set(nationalTeam?.lineup || []), [nationalTeam?.lineup]);
  const subsSet = useMemo(() => new Set(nationalTeam?.subs || []), [nationalTeam?.subs]);

  // Show offer card when there's a pending offer and no national team yet
  if (!nationalTeam && nationalTeamOffer?.status === 'pending' && managerNationality) {
    const nation = getNation(managerNationality);
    return (
      <div className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-5">
        <PageHint screen="nationalTeam" title={PAGE_HINTS.nationalTeam.title} body={PAGE_HINTS.nationalTeam.body} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(LIQUID_GLASS_SURFACE, 'border border-primary/40 p-6 shadow-[0_0_30px_hsl(var(--primary)/0.15)]')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-teal-500/5 pointer-events-none" />
          <div className="relative space-y-5">
            {/* Flag + Title */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: nation?.color || '#333' }}
              >
                <FlagIcon nationality={managerNationality} size={48} />
              </div>
              <div>
                <p className="text-xs text-primary font-semibold uppercase tracking-wider">National Team Offer</p>
                <h1 className="text-xl font-bold text-foreground font-display">{managerNationality}</h1>
              </div>
            </div>

            {/* Offer message */}
            <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
              <p className="text-sm text-foreground/90 leading-relaxed">
                The {managerNationality} Football Association has been impressed by your managerial career and would like to offer you the position of national team manager.
              </p>
            </div>

            {/* Offer details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/20 rounded-lg p-3 border border-border/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Role</p>
                <p className="text-sm font-semibold text-foreground">Head Coach</p>
              </div>
              <div className="bg-muted/20 rounded-lg p-3 border border-border/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Dual Role</p>
                <p className="text-sm font-semibold text-foreground">Club + Country</p>
              </div>
            </div>

            {/* Expiry notice */}
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Offer expires Season {nationalTeamOffer.expiresSeason} Week {nationalTeamOffer.expiresWeek}
            </p>

            {/* Accept / Decline buttons */}
            <div className="flex gap-3">
              <Button
                className="flex-1 h-11 font-bold gap-2"
                onClick={acceptNationalTeamOffer}
              >
                <CheckCircle className="w-4 h-4" />
                Accept
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11 font-bold gap-2"
                onClick={declineNationalTeamOffer}
              >
                <XCircle className="w-4 h-4" />
                Decline
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!nationalTeam || !managerNationality) {
    // Career mode without national team: show progress toward being offered the job
    const isCareer = gameMode === 'career';
    const reputation = careerManager?.reputationScore ?? 0;
    const progress = isCareer ? Math.min(Math.round((reputation / NT_JOB_MIN_REPUTATION) * 100), 100) : 0;

    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center space-y-4">
        <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
        <h2 className="text-lg font-bold text-foreground font-display">No National Team</h2>
        {isCareer && managerNationality ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Build your reputation to attract the attention of the {managerNationality} FA.
            </p>
            <div className="max-w-xs mx-auto space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Reputation</span>
                <span>{reputation} / {NT_JOB_MIN_REPUTATION}</span>
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                {progress >= 100 ? 'You meet the reputation requirement — an offer may come soon!' : `${100 - progress}% more reputation needed`}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">You haven't been assigned a national team yet.</p>
        )}
      </div>
    );
  }

  const nation = getNation(managerNationality);
  const ranking = getNationRanking(managerNationality);
  const upcoming = getUpcomingTournament(season, week, managerNationality);

  const totalCaps = Object.values(nationalTeam.caps).reduce((s, c) => s + c, 0);
  const totalGoals = Object.values(nationalTeam.internationalGoals).reduce((s, g) => s + g, 0);

  const handleTogglePlayer = (playerId: string) => {
    hapticLight();
    const current = [...nationalTeam.squad];
    if (current.includes(playerId)) {
      const newSquad = current.filter(id => id !== playerId);
      const newLineup = nationalTeam.lineup.filter(id => id !== playerId);
      const newSubs = nationalTeam.subs.filter(id => id !== playerId);
      updateNationalSquad(newSquad, newLineup, newSubs);
    } else if (current.length < NATIONAL_SQUAD_SIZE) {
      updateNationalSquad([...current, playerId], nationalTeam.lineup, nationalTeam.subs);
    }
  };

  const handleAutoFill = () => {
    hapticLight();
    const squadPlayerObjs = nationalTeam.squad.map(id => players[id]).filter(Boolean);
    if (squadPlayerObjs.length < 7) return;
    const { lineup, subs } = selectBestLineup(squadPlayerObjs, nationalTeam.formation);
    updateNationalSquad(
      nationalTeam.squad,
      lineup.map(p => p.id),
      subs.map(p => p.id).slice(0, 7),
    );
    successToast('Lineup set!', 'Best XI selected based on form and fitness.');
  };

  // Fill the squad to NATIONAL_SQUAD_SIZE by walking position quotas first
  // (so coverage is guaranteed) then topping up by overall.
  const handleAutoPickSquad = () => {
    hapticMedium();
    const next = new Set<string>();
    const order: PositionBucket[] = ['GK', 'DEF', 'MID', 'FWD'];
    for (const bucket of order) {
      const candidates = eligibleAll.filter(p => bucketForPosition(p.position) === bucket);
      const quota = POSITION_QUOTAS[bucket].recommended;
      for (let i = 0; i < Math.min(quota, candidates.length) && next.size < NATIONAL_SQUAD_SIZE; i++) {
        next.add(candidates[i].id);
      }
    }
    for (const p of eligibleAll) {
      if (next.size >= NATIONAL_SQUAD_SIZE) break;
      next.add(p.id);
    }
    const squadIds = Array.from(next);
    const squadObjs = squadIds.map(id => players[id]).filter(Boolean);
    let lineup: string[] = [];
    let subs: string[] = [];
    if (squadObjs.length >= 7) {
      const best = selectBestLineup(squadObjs, nationalTeam.formation);
      lineup = best.lineup.map(p => p.id);
      subs = best.subs.map(p => p.id).slice(0, 7);
    }
    updateNationalSquad(squadIds, lineup, subs);
    successToast('Squad auto-picked!', `${squadIds.length} players called up.`);
  };

  const handleClearSquad = () => {
    hapticLight();
    updateNationalSquad([], [], []);
  };

  const handleFormationChange = (f: FormationType) => {
    hapticLight();
    setNationalFormation(f);
    setShowFormationPicker(false);
    // Re-select lineup for new formation
    const squadPlayerObjs = nationalTeam.squad.map(id => players[id]).filter(Boolean);
    if (squadPlayerObjs.length >= 7) {
      const { lineup, subs } = selectBestLineup(squadPlayerObjs, f);
      updateNationalSquad(
        nationalTeam.squad,
        lineup.map(p => p.id),
        subs.map(p => p.id).slice(0, 7),
      );
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-5">
      <PageHint screen="nationalTeam" title={PAGE_HINTS.nationalTeam.title} body={PAGE_HINTS.nationalTeam.body} />
      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10 p-5')}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: nation?.color || '#333' }}
          >
            <FlagIcon nationality={managerNationality} size={48} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground font-display">{managerNationality}</h1>
            <p className="text-sm text-muted-foreground">World Ranking: #{ranking}</p>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {squadPlayers.length} players</span>
              <span>{totalCaps} caps</span>
              <span>{totalGoals} goals</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Upcoming / current tournament tile — always tappable */}
      {upcoming && (
        <motion.button
          type="button"
          onClick={() => {
            if (internationalTournament && !internationalTournament.squadConfirmed) {
              setScreen('national-squad-picker');
            } else {
              setScreen('international-tournament');
            }
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            LIQUID_GLASS_SURFACE,
            'w-full border border-primary/30 p-4 text-left hover:border-primary/60 transition-colors',
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Flag className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em]">
                {upcoming.season === season ? 'This Season' : 'Coming Up'}
              </p>
              <p className="text-sm font-bold text-foreground truncate">{upcoming.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {upcoming.inProgress
                  ? `Live now · Week ${week}`
                  : upcoming.weeksAway === 0
                    ? `Kicks off this week · Wk ${upcoming.startWeek}, S${upcoming.season}`
                    : `Starts Wk ${upcoming.startWeek}, Season ${upcoming.season} · ${upcoming.weeksAway} week${upcoming.weeksAway === 1 ? '' : 's'} away`}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </motion.button>
      )}

      {/* Tenure (career mode) */}
      {gameMode === 'career' && careerManager?.nationalTeamAppointedSeason && (
        <div className={cn(LIQUID_GLASS_SURFACE, 'flex items-center gap-3 border border-white/10 px-4 py-3')}>
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Appointed Season {careerManager.nationalTeamAppointedSeason}</p>
            <p className="text-sm font-semibold text-foreground">{season - careerManager.nationalTeamAppointedSeason} season{season - careerManager.nationalTeamAppointedSeason !== 1 ? 's' : ''} in charge</p>
          </div>
          {nationalTeam.results.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Record</p>
              <p className="text-sm font-mono font-semibold text-foreground">
                {nationalTeam.results.filter(r => r.goalsFor > r.goalsAgainst).length}W {nationalTeam.results.filter(r => r.goalsFor === r.goalsAgainst).length}D {nationalTeam.results.filter(r => r.goalsFor < r.goalsAgainst).length}L
              </p>
            </div>
          )}
        </div>
      )}

      {/* Formation Picker */}
      <div className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10 p-4')}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-foreground">Formation</h2>
          <button
            onClick={() => setShowFormationPicker(!showFormationPicker)}
            className="flex items-center gap-1 text-sm text-primary font-mono hover:text-primary/80 transition-colors"
          >
            {nationalTeam.formation}
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showFormationPicker && 'rotate-180')} />
          </button>
        </div>
        <AnimatePresence>
          {showFormationPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-1.5 pt-3 border-t border-border/20 mt-2">
                {FORMATIONS.map(f => {
                  const slotCount = FORMATION_POSITIONS[f]?.length || 0;
                  if (slotCount < 11) return null;
                  return (
                    <button
                      key={f}
                      onClick={() => handleFormationChange(f)}
                      className={cn(
                        'px-2 py-1.5 rounded-lg text-xs font-mono transition-colors',
                        f === nationalTeam.formation
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-muted/20 text-muted-foreground hover:bg-muted/40 border border-transparent'
                      )}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Auto-fill button */}
        {squadPlayers.length >= 7 && (
          <button
            onClick={handleAutoFill}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" /> Auto-select best XI
          </button>
        )}
      </div>

      {/* Squad Management */}
      <div className="space-y-3">
        {/* Header row — squad size + edit toggle */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-bold text-foreground">Squad</h2>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              <span className={cn(
                squadPlayers.length === NATIONAL_SQUAD_SIZE && 'text-emerald-400',
                squadPlayers.length > NATIONAL_SQUAD_SIZE && 'text-destructive',
              )}>
                {squadPlayers.length}
              </span>
              <span> / {NATIONAL_SQUAD_SIZE} called up</span>
              {editingSquad && squadPlayers.length < NATIONAL_SQUAD_SIZE && (
                <span> · {NATIONAL_SQUAD_SIZE - squadPlayers.length} slot{NATIONAL_SQUAD_SIZE - squadPlayers.length === 1 ? '' : 's'} open</span>
              )}
            </p>
          </div>
          <button
            onClick={() => {
              hapticLight();
              // Block "Done" below a starting XI — the international sim has
              // no roster to field otherwise. Clear remains available while
              // editing, but you can't leave the editor short-handed.
              if (editingSquad && squadPlayers.length < LINEUP_SIZE) {
                errorToast(
                  'Squad too small',
                  `Call up at least ${LINEUP_SIZE} players before finishing (currently ${squadPlayers.length}).`,
                );
                return;
              }
              setEditingSquad(!editingSquad);
            }}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full transition-colors font-semibold active:scale-[0.97]',
              editingSquad
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/40 text-foreground hover:bg-muted/60'
            )}
          >
            {editingSquad ? 'Done' : 'Edit Squad'}
          </button>
        </div>

        {/* Position quota chips — visible in both modes so the manager
            always knows what's needed (e.g. need at least 2 GK, 5 DEF, …). */}
        <div className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10 p-3')}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.18em]">Squad Composition</p>
              <p className="text-[10px] text-muted-foreground/80 font-mono tabular-nums">
                {squadPlayers.length}/{NATIONAL_SQUAD_SIZE}
              </p>
            </div>
            {/* Overall progress bar */}
            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden mb-3">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-300 ease-out',
                  squadPlayers.length === NATIONAL_SQUAD_SIZE
                    ? 'bg-emerald-400'
                    : squadPlayers.length > NATIONAL_SQUAD_SIZE
                      ? 'bg-destructive'
                      : 'bg-primary',
                )}
                style={{ width: `${Math.min(100, (squadPlayers.length / NATIONAL_SQUAD_SIZE) * 100)}%` }}
              />
            </div>
            {/* Position quota chips */}
            <div className="grid grid-cols-4 gap-1.5">
              {(['GK', 'DEF', 'MID', 'FWD'] as const).map(key => {
                const quota = POSITION_QUOTAS[key];
                const c = counts[key];
                const meetsMin = c >= quota.min;
                const meetsRecommended = c >= quota.recommended;
                const tone = !meetsMin
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : meetsRecommended
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-sky-500/10 border-sky-500/40 text-sky-300';
                return (
                  <div
                    key={key}
                    className={cn('rounded-xl border py-2 text-center', tone)}
                    title={`Min ${quota.min} · Recommended ${quota.recommended}`}
                  >
                    <p className="text-[9px] uppercase tracking-[0.2em] opacity-80">{key}</p>
                    <p className="font-display font-black tabular-nums leading-none mt-0.5">
                      <span className="text-base">{c}</span>
                      <span className="text-[10px] opacity-60"> /{quota.recommended}</span>
                    </p>
                    {!meetsMin && (
                      <p className="text-[8px] mt-0.5 opacity-90">need {quota.min - c}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick actions — only useful while editing */}
            {editingSquad && (
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoPickSquad}
                  className="flex-1 h-9 gap-1.5 text-xs"
                >
                  <Shuffle className="w-3.5 h-3.5" /> Auto-pick best 23
                </Button>
                {squadPlayers.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSquad}
                    className="h-9 px-3 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Clear
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card grid — view mode shows current squad grouped by bucket;
            edit mode shows the top 50 eligible pool grouped the same way. */}
        {editingSquad ? (
          <div className="space-y-4">
            <p className="text-[10px] text-muted-foreground px-1">
              Tap a card to call up or release. Showing top {POOL_DISPLAY_LIMIT} eligible players from {managerNationality}.
            </p>
            {POSITION_GROUPS.map(group => {
              const poolPlayers = groupedPool[group.key as PositionBucket];
              if (poolPlayers.length === 0) return null;
              const c = counts[group.key as PositionBucket];
              const quota = POSITION_QUOTAS[group.key as PositionBucket];
              const meetsMin = c >= quota.min;
              return (
                <div key={group.key} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
                      {group.label}
                    </p>
                    <p className={cn(
                      'text-[10px] font-mono tabular-nums',
                      !meetsMin ? 'text-amber-300' : 'text-muted-foreground',
                    )}>
                      {c}/{quota.recommended} picked
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 justify-items-center">
                    {poolPlayers.map((player) => {
                      const inSquad = squadSet.has(player.id);
                      const disabled = !inSquad && squadPlayers.length >= NATIONAL_SQUAD_SIZE;
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => !disabled && handleTogglePlayer(player.id)}
                          disabled={disabled}
                          className={cn(
                            'relative rounded-2xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                            inSquad
                              ? 'shadow-[0_0_0_2px_hsl(var(--primary)/0.7),0_0_18px_hsl(var(--primary)/0.35)]'
                              : disabled
                                ? 'opacity-35 cursor-not-allowed grayscale'
                                : 'active:scale-[0.97]',
                          )}
                        >
                          <PlayerCard
                            player={player}
                            size="lg"
                            interactive="none"
                            showConditionView={false}
                          />
                          {inSquad && (
                            <div className="absolute -top-1.5 -left-1.5 w-7 h-7 rounded-full bg-primary text-primary-foreground border-2 border-background flex items-center justify-center shadow-lg z-10">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {squadPlayers.length === 0 ? (
              <div className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10 p-6 text-center space-y-2')}>
                <Users className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-foreground font-semibold">No squad called up</p>
                <p className="text-[11px] text-muted-foreground">
                  Tap "Edit Squad" to call up players, or use Auto-pick to select your best 23.
                </p>
              </div>
            ) : (
              POSITION_GROUPS.map(group => {
                const groupPlayers = groupedSquad[group.key as PositionBucket];
                if (groupPlayers.length === 0) return null;
                return (
                  <div key={group.key} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
                        {group.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        {groupPlayers.length}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 justify-items-center">
                      {groupPlayers.map((player) => {
                        const isStarter = lineupSet.has(player.id);
                        const isSub = subsSet.has(player.id);
                        return (
                          <div
                            key={player.id}
                            className={cn('relative', player.injured && 'opacity-70')}
                          >
                            <PlayerCard
                              player={player}
                              size="lg"
                              interactive="detail"
                              showConditionView={false}
                              onDetailClick={(p) => selectPlayer(p.id)}
                            />
                            <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
                              <PlayerStatusBadges
                                player={player}
                                season={season}
                                week={week}
                                hideContract
                                contextBadge={
                                  isStarter ? (
                                    <StatusPill tone="emerald" label="XI" title="In starting XI" />
                                  ) : isSub ? (
                                    <StatusPill tone="amber" label="SUB" title="On the bench" />
                                  ) : null
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Results history */}
      {nationalTeam.results.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-foreground px-1">Recent Results</h2>
          {nationalTeam.results.slice(-10).reverse().map((result) => {
            const won = result.goalsFor > result.goalsAgainst;
            const drew = result.goalsFor === result.goalsAgainst;
            return (
              <motion.div
                key={`${result.season}-${result.opponent}-${result.round}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-card/30 border border-border/20"
              >
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                  won ? 'bg-emerald-500/20 text-emerald-400' :
                  drew ? 'bg-amber-500/20 text-amber-400' :
                  'bg-destructive/20 text-destructive'
                )}>
                  {won ? 'W' : drew ? 'D' : 'L'}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">vs {result.opponent}</p>
                  <p className="text-[10px] text-muted-foreground">{result.tournament} &middot; {result.round}</p>
                </div>
                <p className="text-sm font-mono font-bold text-foreground">{result.goalsFor} - {result.goalsAgainst}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* View Tournament Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setScreen('international-tournament')}
      >
        <Trophy className="w-4 h-4 mr-2" />
        View International Tournament
      </Button>
    </div>
  );
};

export default NationalTeamPage;
