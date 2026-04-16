import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { getNation } from '@/data/nations';
import { cn } from '@/lib/utils';
import { Globe, Users, Trophy, ChevronRight, ChevronDown, CheckCircle, XCircle, Calendar, TrendingUp, Check, Shuffle } from 'lucide-react';
import { FlagIcon } from '@/components/game/FlagIcon';
import { Button } from '@/components/ui/button';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';
import { NT_JOB_MIN_REPUTATION } from '@/config/gameBalance';
import { FORMATIONS } from '@/config/tactics';
import { FORMATION_POSITIONS, type FormationType } from '@/types/game';
import { selectBestLineup } from '@/utils/playerGen';
import { hapticLight } from '@/utils/haptics';
import { successToast } from '@/utils/gameToast';

const NationalTeamPage = () => {
  const { nationalTeam, managerNationality, players, clubs, setScreen, updateNationalSquad, setNationalFormation, internationalTournament } = useGameStore(useShallow(s => ({
    nationalTeam: s.nationalTeam,
    managerNationality: s.managerNationality,
    players: s.players,
    clubs: s.clubs,
    setScreen: s.setScreen,
    updateNationalSquad: s.updateNationalSquad,
    setNationalFormation: s.setNationalFormation,
    internationalTournament: s.internationalTournament,
  })));
  const nationalTeamOffer = useGameStore(s => s.nationalTeamOffer);
  const gameMode = useGameStore(s => s.gameMode);
  const season = useGameStore(s => s.season);
  const careerManager = useGameStore(s => s.careerManager);
  const acceptNationalTeamOffer = useGameStore(s => s.acceptNationalTeamOffer);
  const declineNationalTeamOffer = useGameStore(s => s.declineNationalTeamOffer);

  const [showFormationPicker, setShowFormationPicker] = useState(false);
  const [editingSquad, setEditingSquad] = useState(false);

  // All eligible players for squad selection (hooks must be before early return)
  const eligiblePlayers = useMemo(() => {
    if (!managerNationality) return [];
    return Object.values(players)
      .filter(p => p.nationality === managerNationality && !p.injured && p.age >= 17)
      .sort((a, b) => b.overall - a.overall);
  }, [players, managerNationality]);

  const squadPlayers = useMemo(() => {
    if (!nationalTeam) return [];
    return nationalTeam.squad
      .map(id => players[id])
      .filter(Boolean)
      .sort((a, b) => b.overall - a.overall);
  }, [nationalTeam, players]);

  const squadSet = useMemo(() => new Set(nationalTeam?.squad || []), [nationalTeam?.squad]);

  // Group squad by position for display
  const positionGroups = useMemo(() => {
    const groups: Record<string, typeof squadPlayers> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of squadPlayers) {
      if (p.position === 'GK') groups.GK.push(p);
      else if (['CB', 'LB', 'RB'].includes(p.position)) groups.DEF.push(p);
      else if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.position)) groups.MID.push(p);
      else groups.FWD.push(p);
    }
    return groups;
  }, [squadPlayers]);

  const lineupSet = useMemo(() => new Set(nationalTeam?.lineup || []), [nationalTeam?.lineup]);

  // Show offer card when there's a pending offer and no national team yet
  if (!nationalTeam && nationalTeamOffer?.status === 'pending' && managerNationality) {
    const nation = getNation(managerNationality);
    return (
      <div className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-5">
        <PageHint screen="nationalTeam" title={PAGE_HINTS.nationalTeam.title} body={PAGE_HINTS.nationalTeam.body} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-primary/40 bg-card/60 backdrop-blur-xl p-6 shadow-[0_0_30px_hsl(var(--primary)/0.15)]"
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
    } else if (current.length < 23) {
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
        className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5"
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
            <p className="text-sm text-muted-foreground">FIFA Ranking: #{nationalTeam.fifaRanking}</p>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {squadPlayers.length} players</span>
              <span>{totalCaps} caps</span>
              <span>{totalGoals} goals</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tenure (career mode) */}
      {gameMode === 'career' && careerManager?.nationalTeamAppointedSeason && (
        <div className="flex items-center gap-3 bg-card/40 backdrop-blur-xl border border-border/30 rounded-xl px-4 py-3">
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
      <div className="bg-card/40 backdrop-blur-xl border border-border/30 rounded-xl p-4">
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
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-foreground">Squad ({squadPlayers.length}/23)</h2>
          <button
            onClick={() => setEditingSquad(!editingSquad)}
            className={cn(
              'text-xs px-3 py-1 rounded-full transition-colors',
              editingSquad
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            )}
          >
            {editingSquad ? 'Done' : 'Edit Squad'}
          </button>
        </div>

        {editingSquad ? (
          /* Squad editing view — show all eligible players with toggle */
          <div className="space-y-1 max-h-[50vh] overflow-y-auto scrollbar-hide">
            {eligiblePlayers.map(player => {
              const inSquad = squadSet.has(player.id);
              const isFull = nationalTeam.squad.length >= 23;
              return (
                <button
                  key={player.id}
                  onClick={() => handleTogglePlayer(player.id)}
                  disabled={!inSquad && isFull}
                  className={cn(
                    'w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-left',
                    inSquad
                      ? 'bg-primary/10 border-primary/30'
                      : isFull
                        ? 'bg-card/20 border-border/10 opacity-40'
                        : 'bg-card/30 border-border/20 hover:border-border/50'
                  )}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                    player.overall >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                    player.overall >= 70 ? 'bg-sky-500/20 text-sky-400' :
                    player.overall >= 60 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-muted/20 text-muted-foreground'
                  )}>
                    {player.overall}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{player.firstName} {player.lastName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {player.position} · Age {player.age} · {player.internationalCaps || 0} caps
                      {player.clubId && clubs[player.clubId] ? ` · ${clubs[player.clubId].shortName}` : ' · External'}
                    </p>
                  </div>
                  {inSquad && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* Normal squad view — grouped by position */
          <>
            {(['GK', 'DEF', 'MID', 'FWD'] as const).map(group => {
              const groupPlayers = positionGroups[group];
              if (groupPlayers.length === 0) return null;
              return (
                <div key={group}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-1">{group === 'GK' ? 'Goalkeepers' : group === 'DEF' ? 'Defenders' : group === 'MID' ? 'Midfielders' : 'Forwards'}</p>
                  {groupPlayers.map((player, i) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          useGameStore.setState({ selectedPlayerId: player.id });
                          setScreen('player-detail');
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left mb-1',
                          lineupSet.has(player.id)
                            ? 'bg-card/50 border-primary/20'
                            : 'bg-card/30 border-border/20 hover:border-border/50'
                        )}
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                          player.overall >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                          player.overall >= 70 ? 'bg-sky-500/20 text-sky-400' :
                          player.overall >= 60 ? 'bg-amber-500/20 text-amber-400' :
                          'bg-muted/20 text-muted-foreground'
                        )}>
                          {player.overall}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {lineupSet.has(player.id) && <span className="text-primary text-[9px] mr-1">XI</span>}
                            {player.firstName} {player.lastName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {player.position} &middot; Age {player.age}
                            {player.clubId && clubs[player.clubId] ? ` · ${clubs[player.clubId].shortName}` : ' · External'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">{player.internationalCaps || 0} caps</p>
                          {player.injured && internationalTournament && internationalTournament.phase !== 'complete' && (
                            <p className="text-[9px] text-destructive font-semibold">Injured</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              );
            })}
            {squadPlayers.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">No players called up yet. Tap "Edit Squad" to select players, or the squad will be auto-selected before the next tournament.</p>
            )}
          </>
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
