import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronDown, ChevronUp, Trophy, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { darken, lighten } from '@/utils/colorUtils';
import { BallonDOrEntry } from '@/types/game';

const RANK_MEDAL_COLORS: Record<number, { bg: string; text: string; border: string; glow: string }> = {
  1: { bg: 'bg-[hsl(43,96%,46%)]/20', text: 'text-[hsl(43,96%,56%)]', border: 'border-[hsl(43,96%,46%)]/40', glow: 'shadow-[0_0_20px_hsl(43,96%,46%,0.3)]' },
  2: { bg: 'bg-gray-300/10', text: 'text-gray-300', border: 'border-gray-300/30', glow: 'shadow-[0_0_15px_rgba(209,213,219,0.2)]' },
  3: { bg: 'bg-amber-700/15', text: 'text-amber-600', border: 'border-amber-700/30', glow: 'shadow-[0_0_15px_rgba(180,83,9,0.2)]' },
};

function getMedalStyle(rank: number) {
  if (rank <= 3) return RANK_MEDAL_COLORS[rank];
  if (rank <= 10) return { bg: 'bg-primary/8', text: 'text-primary', border: 'border-primary/20', glow: '' };
  return { bg: 'bg-muted/20', text: 'text-muted-foreground', border: 'border-border/30', glow: '' };
}

function getRankLabel(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

const WinnerSpotlight = ({ entry, onNavigate }: { entry: BallonDOrEntry; onNavigate: () => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8, y: 30 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ duration: 0.8, type: 'spring', bounce: 0.3 }}
  >
    <button
      type="button"
      onClick={onNavigate}
      className="w-full text-left"
    >
      <GlassPanel className="p-6 text-center border-[hsl(43,96%,46%)]/30 relative overflow-hidden hover:brightness-110 transition-all">
        {/* Gold shimmer overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-[hsl(43,96%,46%)]/10 via-transparent to-[hsl(43,96%,46%)]/5 pointer-events-none"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Trophy icon */}
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, duration: 0.6, type: 'spring' }}
          className="relative z-10 mx-auto mb-3"
        >
          <div className="w-20 h-20 rounded-full bg-[hsl(43,96%,46%)]/15 border-2 border-[hsl(43,96%,46%)]/30 flex items-center justify-center mx-auto shadow-[0_0_30px_hsl(43,96%,46%,0.25)]">
            <Trophy className="w-10 h-10 text-[hsl(43,96%,56%)]" />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="relative z-10 text-[10px] text-[hsl(43,96%,56%)] uppercase tracking-[0.2em] font-bold mb-1"
        >
          Ballon d'Or Winner
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="relative z-10 text-2xl font-black text-foreground font-display"
        >
          {entry.playerName}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="relative z-10 flex items-center justify-center gap-3 mt-2"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.clubColor }} />
            <span className="text-sm text-muted-foreground">{entry.clubName}</span>
          </div>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-sm font-bold text-primary">{entry.overall} OVR</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{entry.position}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="relative z-10 grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[hsl(43,96%,46%)]/20"
        >
          <div>
            <p className="text-lg font-black text-foreground tabular-nums">{entry.goals}</p>
            <p className="text-[10px] text-muted-foreground">Goals</p>
          </div>
          <div>
            <p className="text-lg font-black text-foreground tabular-nums">{entry.assists}</p>
            <p className="text-[10px] text-muted-foreground">Assists</p>
          </div>
          <div>
            <p className="text-lg font-black text-[hsl(43,96%,56%)] tabular-nums">{entry.score.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">Score</p>
          </div>
        </motion.div>
      </GlassPanel>
    </button>
  </motion.div>
);

const RankingRow = ({ entry, index, isExpanded, onToggle, isPlayerClub }: {
  entry: BallonDOrEntry;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  isPlayerClub: boolean;
}) => {
  const style = getMedalStyle(entry.rank);
  const isPodium = entry.rank <= 3;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.35, ease: 'easeOut' }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-xl transition-all',
          style.bg, style.glow,
          'border', style.border,
          isPlayerClub && 'ring-1 ring-primary/30',
          'hover:brightness-110 active:scale-[0.99]',
        )}
      >
        {/* Rank badge */}
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-sm tabular-nums',
          isPodium ? 'bg-gradient-to-br' : '',
          entry.rank === 1 && 'from-[hsl(43,96%,46%)] to-[hsl(35,90%,35%)] text-black',
          entry.rank === 2 && 'from-gray-300 to-gray-400 text-black',
          entry.rank === 3 && 'from-amber-600 to-amber-800 text-black',
          !isPodium && 'bg-muted/30 text-muted-foreground',
        )}>
          {entry.rank}
        </div>

        {/* Player card */}
        <div
          className="w-8 h-10 rounded-md flex flex-col items-center justify-center shrink-0 border relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${lighten(entry.clubColor, 0.1)} 0%, ${darken(entry.clubColor, 0.35)} 100%)`,
            borderColor: darken(entry.clubColor, 0.15),
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10 pointer-events-none" />
          <span className="relative z-10 text-[8px] font-bold text-white/70">{entry.position}</span>
          <span className="relative z-10 text-sm font-black text-white drop-shadow-md tabular-nums">{entry.overall}</span>
        </div>

        {/* Name and club */}
        <div className="flex-1 min-w-0 text-left">
          <p className={cn('text-xs font-bold truncate', isPodium ? style.text : 'text-foreground')}>
            {entry.playerName}
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.clubColor }} />
            <span className="text-[10px] text-muted-foreground truncate">{entry.clubName}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className={cn('text-xs font-black tabular-nums', isPodium ? style.text : 'text-foreground')}>
              {entry.score.toFixed(1)}
            </p>
            <p className="text-[9px] text-muted-foreground">pts</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded stats */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className={cn('mx-2 mt-1 mb-2 p-3 rounded-lg border', style.border, 'bg-card/40')}>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-sm font-black text-foreground tabular-nums">{entry.goals}</p>
                  <p className="text-[9px] text-muted-foreground">Goals</p>
                </div>
                <div>
                  <p className="text-sm font-black text-foreground tabular-nums">{entry.assists}</p>
                  <p className="text-[9px] text-muted-foreground">Assists</p>
                </div>
                <div>
                  <p className="text-sm font-black text-foreground tabular-nums">{entry.appearances}</p>
                  <p className="text-[9px] text-muted-foreground">Apps</p>
                </div>
                <div>
                  <p className="text-sm font-black text-foreground tabular-nums">{entry.age}</p>
                  <p className="text-[9px] text-muted-foreground">Age</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const BallonDor = () => {
  const { seasonHistory, playerClubId, clubs, previousScreen, players } = useGameStore(useShallow(s => ({
    seasonHistory: s.seasonHistory,
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    previousScreen: s.previousScreen,
    players: s.players,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const selectPlayer = useGameStore(s => s.selectPlayer);

  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [expandedRank, setExpandedRank] = useState<number | null>(null);

  // Find seasons that have Ballon d'Or data
  const seasonsWithData = useMemo(
    () => seasonHistory.filter(h => h.ballonDOrRanking && h.ballonDOrRanking.length > 0).reverse(),
    [seasonHistory],
  );

  const activeSeason = selectedSeason ?? seasonsWithData[0]?.season ?? null;
  const activeData = seasonsWithData.find(h => h.season === activeSeason);
  const ranking = activeData?.ballonDOrRanking || [];
  const winner = ranking[0];

  const playerClubName = clubs[playerClubId]?.shortName || '';

  const navigateToPlayer = (playerId: string) => {
    if (!players[playerId]) return;
    selectPlayer(playerId);
    setScreen('player-detail');
  };

  if (seasonsWithData.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center space-y-3">
        <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-muted-foreground">
          The Ballon d'Or ceremony takes place at the end of each season.
        </p>
        <p className="text-xs text-muted-foreground">
          Complete a full season to see the top 25 players ranked.
        </p>
        <Button variant="secondary" onClick={() => setScreen(previousScreen || 'dashboard')}>Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setScreen(previousScreen || 'dashboard')}
          className="flex items-center gap-1 text-muted-foreground text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Season selector */}
        {seasonsWithData.length > 1 && (
          <div className="flex items-center gap-1">
            {seasonsWithData.slice(0, 5).map(h => (
              <button
                key={h.season}
                onClick={() => { setSelectedSeason(h.season); setExpandedRank(null); }}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all',
                  h.season === activeSeason
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50',
                )}
              >
                S{h.season}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <h2 className="text-xl font-black text-foreground font-display">
          Ballon d'Or — Season {activeSeason}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          The 25 best players of the season
        </p>
      </motion.div>

      {/* Winner spotlight */}
      {winner && (
        <WinnerSpotlight
          entry={winner}
          onNavigate={() => navigateToPlayer(winner.playerId)}
        />
      )}

      {/* Podium (2nd and 3rd) */}
      {ranking.length >= 3 && (
        <div className="grid grid-cols-2 gap-3">
          {[ranking[1], ranking[2]].map((entry, i) => {
            const style = getMedalStyle(entry.rank);
            return (
              <motion.div
                key={entry.playerId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.5, type: 'spring' }}
              >
                <button
                  type="button"
                  onClick={() => navigateToPlayer(entry.playerId)}
                  className={cn(
                    'w-full p-3 rounded-xl text-center border transition-all hover:brightness-110',
                    style.bg, style.border, style.glow,
                  )}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-2 font-black text-sm',
                    entry.rank === 2 && 'bg-gradient-to-br from-gray-300 to-gray-400 text-black',
                    entry.rank === 3 && 'bg-gradient-to-br from-amber-600 to-amber-800 text-black',
                  )}>
                    {entry.rank}
                  </div>
                  <p className={cn('text-xs font-bold truncate', style.text)}>{entry.playerName}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.clubColor }} />
                    <span className="text-[10px] text-muted-foreground">{entry.clubName}</span>
                  </div>
                  <p className={cn('text-sm font-black mt-1 tabular-nums', style.text)}>
                    {entry.score.toFixed(1)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{entry.goals}G · {entry.assists}A</p>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Full ranking list (4-25) */}
      {ranking.length > 3 && (
        <GlassPanel className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Full Ranking
          </p>
          <div className="space-y-1.5">
            {ranking.slice(3).map((entry, i) => (
              <RankingRow
                key={entry.playerId}
                entry={entry}
                index={i}
                isExpanded={expandedRank === entry.rank}
                onToggle={() => setExpandedRank(expandedRank === entry.rank ? null : entry.rank)}
                isPlayerClub={entry.clubName === playerClubName}
              />
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Your players highlight */}
      {(() => {
        const yourPlayers = ranking.filter(e => e.clubName === playerClubName);
        if (yourPlayers.length === 0) return null;
        return (
          <GlassPanel className="p-4 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] text-primary uppercase tracking-wider font-bold">
                Your Players in Top 25
              </p>
            </div>
            <div className="space-y-2">
              {yourPlayers.map(entry => (
                <button
                  key={entry.playerId}
                  type="button"
                  onClick={() => navigateToPlayer(entry.playerId)}
                  className="w-full flex items-center gap-3 text-left hover:bg-primary/5 rounded-lg p-1.5 transition-colors"
                >
                  <span className="text-xs font-black text-primary tabular-nums w-6">
                    {getRankLabel(entry.rank)}
                  </span>
                  <span className="text-xs font-bold text-foreground flex-1 truncate">
                    {entry.playerName}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {entry.goals}G · {entry.assists}A
                  </span>
                  <span className="text-xs font-black text-primary tabular-nums">
                    {entry.score.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          </GlassPanel>
        );
      })()}
    </div>
  );
};

export default BallonDor;
