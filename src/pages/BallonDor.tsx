import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PlayerCard } from '@/components/game/PlayerCard';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Trophy, Crown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { darken, lighten } from '@/utils/colorUtils';
import { BallonDOrEntry, Player } from '@/types/game';

const RANK_MEDAL_COLORS: Record<number, { bg: string; text: string; border: string; glow: string }> = {
  1: { bg: 'bg-[hsl(43,96%,46%)]/20', text: 'text-[hsl(43,96%,56%)]', border: 'border-[hsl(43,96%,46%)]/40', glow: 'shadow-[0_0_20px_hsl(43,96%,46%,0.3)]' },
  2: { bg: 'bg-[hsl(var(--silver))]/10', text: 'text-[hsl(var(--silver))]', border: 'border-[hsl(var(--silver))]/30', glow: 'shadow-[0_0_15px_hsl(var(--silver)/0.2)]' },
  3: { bg: 'bg-[hsl(var(--bronze))]/15', text: 'text-[hsl(var(--bronze))]', border: 'border-[hsl(var(--bronze))]/30', glow: 'shadow-[0_0_15px_hsl(var(--bronze)/0.2)]' },
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

const WinnerSpotlight = ({ entry, player, onNavigate }: { entry: BallonDOrEntry; player: Player | null; onNavigate: () => void }) => (
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

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="relative z-10 text-[10px] text-[hsl(43,96%,56%)] uppercase tracking-[0.2em] font-bold mb-3"
        >
          Ballon d'Or Winner
        </motion.p>

        {/* Player shield with trophy badge — fall back to a trophy medallion
            if the player record is no longer available (retired / saved out
            of squad). The shield's OVR / position are pinned to the BD-night
            snapshot so historical winners always show their season values. */}
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, duration: 0.6, type: 'spring' }}
          className="relative z-10 mx-auto mb-3 inline-block"
        >
          {player ? (
            <div className="relative">
              <PlayerCard
                player={{ ...player, overall: entry.overall, position: entry.position }}
                size="lg"
                interactive="none"
                compact
              />
              <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-[hsl(43,96%,46%)]/95 border-2 border-[hsl(43,96%,46%)] flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.5)]">
                <Trophy className="w-4 h-4 text-[hsl(43,15%,15%)]" />
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-[hsl(43,96%,46%)]/15 border-2 border-[hsl(43,96%,46%)]/30 flex items-center justify-center shadow-[0_0_30px_hsl(43,96%,46%,0.25)]">
              <Trophy className="w-10 h-10 text-[hsl(43,96%,56%)]" />
            </div>
          )}
        </motion.div>

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
          className="relative z-10 grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-[hsl(43,96%,46%)]/20"
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
            <p className="text-lg font-black text-foreground tabular-nums">{entry.avgRating?.toFixed(1) ?? '-'}</p>
            <p className="text-[10px] text-muted-foreground">Avg Rating</p>
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
          entry.rank === 1 && 'from-[hsl(var(--gold))] to-[hsl(var(--gold)/0.7)] text-black',
          entry.rank === 2 && 'from-[hsl(var(--silver))] to-[hsl(var(--silver)/0.7)] text-black',
          entry.rank === 3 && 'from-[hsl(var(--bronze))] to-[hsl(var(--bronze)/0.7)] text-black',
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
              <div className="grid grid-cols-5 gap-2 text-center">
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
                  <p className="text-sm font-black text-foreground tabular-nums">{entry.avgRating?.toFixed(1) ?? '-'}</p>
                  <p className="text-[9px] text-muted-foreground">Rating</p>
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

/** Liquid-glass panel showing the current reigning top-10 holders.
 *  Always rendered when at least one player holds the BdO card — at game
 *  start this is the seeded top 10, after season-end it's the latest cycle's
 *  top 10. Cards are sorted by overall (desc) since rank from a prior season
 *  doesn't necessarily map to current quality. */
const ReigningHoldersPanel = ({ holders, onNavigate }: { holders: Player[]; onNavigate: (id: string) => void }) => (
  <GlassPanel className="p-4 border-[hsl(43,96%,46%)]/25 relative overflow-hidden">
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          'radial-gradient(circle at 12% 0%, hsl(43,96%,46%,0.12), transparent 55%),' +
          'radial-gradient(circle at 88% 100%, hsl(43,96%,46%,0.08), transparent 60%)',
      }}
      aria-hidden
    />
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-[hsl(43,96%,56%)]" />
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[hsl(43,96%,56%)]">
          Reigning Top 10
        </h3>
        <span className="ml-auto text-[10px] text-muted-foreground">{holders.length} active</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Carrying the Ballon d'Or card and a stats boost until the next ceremony.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {holders.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onNavigate(p.id)}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-xl"
            aria-label={`${p.firstName} ${p.lastName}, ${p.overall} overall — view details`}
          >
            <PlayerCard player={p} size="sm" interactive="none" compact />
          </button>
        ))}
      </div>
    </div>
  </GlassPanel>
);

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

  // Current reigning top-10 holders — derived from the live `players` map so
  // it stays accurate after retirements/transfers between ceremonies.
  const reigningHolders = useMemo(() => {
    return Object.values(players)
      .filter(p => typeof p.ballonDOrTop10HoldSeason === 'number' && p.clubId)
      .sort((a, b) => b.overall - a.overall);
  }, [players]);

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
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h2 className="text-xl font-black text-foreground font-display">Ballon d'Or</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Complete a full season to see the next top 25 ranked.
          </p>
        </motion.div>
        {reigningHolders.length > 0 && (
          <ReigningHoldersPanel holders={reigningHolders} onNavigate={navigateToPlayer} />
        )}
        <div className="text-center">
          <Button variant="secondary" onClick={() => setScreen(previousScreen || 'dashboard')}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Season selector */}
      {seasonsWithData.length > 1 && (
        <div className="flex items-center gap-1 justify-end">
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

      {/* Reigning top-10 — visible whenever any player still holds the card */}
      {reigningHolders.length > 0 && (
        <ReigningHoldersPanel holders={reigningHolders} onNavigate={navigateToPlayer} />
      )}

      {/* Winner spotlight */}
      {winner && (
        <WinnerSpotlight
          entry={winner}
          player={players[winner.playerId] ?? null}
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
                    entry.rank === 2 && 'bg-gradient-to-br from-[hsl(var(--silver))] to-[hsl(var(--silver)/0.7)] text-black',
                    entry.rank === 3 && 'bg-gradient-to-br from-[hsl(var(--bronze))] to-[hsl(var(--bronze)/0.7)] text-black',
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
