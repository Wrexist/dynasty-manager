import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { getNation } from '@/data/nations';
import { cn } from '@/lib/utils';
import { Globe, Users, Trophy, ChevronRight } from 'lucide-react';
import { getFlag } from '@/utils/nationality';
import { Button } from '@/components/ui/button';

const NationalTeamPage = () => {
  const nationalTeam = useGameStore(s => s.nationalTeam);
  const managerNationality = useGameStore(s => s.managerNationality);
  const players = useGameStore(s => s.players);
  const setScreen = useGameStore(s => s.setScreen);

  if (!nationalTeam || !managerNationality) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-bold text-foreground font-display mb-2">No National Team</h2>
        <p className="text-sm text-muted-foreground">You haven't been assigned a national team yet.</p>
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
            <span className="text-4xl leading-none">{getFlag(managerNationality)}</span>
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
                  player.overall >= 70 ? 'bg-primary/20 text-primary' :
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
              <div
                key={i}
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
              </div>
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
