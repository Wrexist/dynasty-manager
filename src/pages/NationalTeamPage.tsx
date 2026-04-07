import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { getNation } from '@/data/nations';
import { cn } from '@/lib/utils';
import { Globe, Users, Trophy, ChevronRight, CheckCircle, XCircle, Calendar, TrendingUp } from 'lucide-react';
import { FlagIcon } from '@/components/game/FlagIcon';
import { Button } from '@/components/ui/button';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';
import { NT_JOB_MIN_REPUTATION } from '@/config/gameBalance';

const NationalTeamPage = () => {
  const nationalTeam = useGameStore(s => s.nationalTeam);
  const managerNationality = useGameStore(s => s.managerNationality);
  const nationalTeamOffer = useGameStore(s => s.nationalTeamOffer);
  const players = useGameStore(s => s.players);
  const setScreen = useGameStore(s => s.setScreen);
  const gameMode = useGameStore(s => s.gameMode);
  const season = useGameStore(s => s.season);
  const careerManager = useGameStore(s => s.careerManager);
  const acceptNationalTeamOffer = useGameStore(s => s.acceptNationalTeamOffer);
  const declineNationalTeamOffer = useGameStore(s => s.declineNationalTeamOffer);

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
  const squadPlayers = nationalTeam.squad
    .map(id => players[id])
    .filter(Boolean)
    .sort((a, b) => b.overall - a.overall);

  const totalCaps = Object.values(nationalTeam.caps).reduce((s, c) => s + c, 0);
  const totalGoals = Object.values(nationalTeam.internationalGoals).reduce((s, g) => s + g, 0);

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

      {/* Formation */}
      <div className="bg-card/40 backdrop-blur-xl border border-border/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Formation</h2>
          <span className="text-sm text-primary font-mono">{nationalTeam.formation}</span>
        </div>
      </div>

      {/* Squad */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-foreground px-1">Squad ({squadPlayers.length}/{23})</h2>
        {squadPlayers.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">No players called up yet. Squad will be auto-selected before the next tournament.</p>
        ) : (
          squadPlayers.map((player, i) => (
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
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/20 hover:border-border/50 transition-colors text-left"
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
                  <p className="text-sm font-semibold text-foreground truncate">{player.firstName} {player.lastName}</p>
                  <p className="text-[10px] text-muted-foreground">{player.position} &middot; Age {player.age}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{player.internationalCaps || 0} caps</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
              </button>
            </motion.div>
          ))
        )}
      </div>

      {/* Results history */}
      {nationalTeam.results.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-foreground px-1">Recent Results</h2>
          {nationalTeam.results.slice(-10).reverse().map((result, i) => {
            const won = result.goalsFor > result.goalsAgainst;
            const drew = result.goalsFor === result.goalsAgainst;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
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
