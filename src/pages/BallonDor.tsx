import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PlayerCard } from '@/components/game/PlayerCard';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Trophy, Crown, Sparkles, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BallonDOrEntry, Player } from '@/types/game';

const RANK_MEDAL_COLORS: Record<number, { bg: string; text: string; border: string; glow: string }> = {
  1: { bg: 'bg-[hsl(43,96%,46%)]/15', text: 'text-[hsl(43,96%,62%)]', border: 'border-[hsl(43,96%,46%)]/35', glow: 'shadow-[0_0_24px_hsl(43,96%,46%,0.28)]' },
  2: { bg: 'bg-[hsl(var(--silver))]/10', text: 'text-[hsl(var(--silver))]', border: 'border-[hsl(var(--silver))]/30', glow: 'shadow-[0_0_18px_hsl(var(--silver)/0.22)]' },
  3: { bg: 'bg-[hsl(var(--bronze))]/12', text: 'text-[hsl(var(--bronze))]', border: 'border-[hsl(var(--bronze))]/30', glow: 'shadow-[0_0_18px_hsl(var(--bronze)/0.22)]' },
};

function getMedalStyle(rank: number) {
  if (rank <= 3) return RANK_MEDAL_COLORS[rank];
  if (rank <= 10) return { bg: 'bg-primary/8', text: 'text-primary', border: 'border-primary/20', glow: '' };
  return { bg: 'bg-muted/15', text: 'text-muted-foreground', border: 'border-border/30', glow: '' };
}

function getRankLabel(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

/** Animated golden hero — sets the prestige tone for the whole page. */
const PageHero = ({ subtitle }: { subtitle: string }) => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: 'easeOut' }}
    className="relative text-center pt-1 pb-3"
  >
    {/* Ambient halo behind the title */}
    <div
      aria-hidden
      className="absolute inset-x-0 -top-2 h-32 pointer-events-none"
      style={{
        background:
          'radial-gradient(ellipse 70% 90% at 50% 30%, hsl(43,96%,46%,0.18), transparent 70%)',
      }}
    />
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.05, duration: 0.5, type: 'spring', bounce: 0.35 }}
      className="relative z-10 inline-flex items-center justify-center gap-2 mb-1.5"
    >
      <div className="relative">
        <Trophy className="w-5 h-5 text-[hsl(43,96%,56%)] drop-shadow-[0_0_10px_hsl(43,96%,46%,0.6)]" />
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <h2
        className="text-[26px] font-black font-display tracking-tight leading-none"
        style={{
          background: 'linear-gradient(180deg, #ffe9a8 0%, #f4c84a 55%, #b8862c 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.4))',
        }}
      >
        Ballon d&rsquo;Or
      </h2>
      <Trophy className="w-5 h-5 text-[hsl(43,96%,56%)] drop-shadow-[0_0_10px_hsl(43,96%,46%,0.6)] scale-x-[-1]" />
    </motion.div>
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="relative z-10 text-[11px] text-muted-foreground"
    >
      {subtitle}
    </motion.p>
    {/* Decorative gold rule */}
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
      className="relative z-10 mx-auto mt-3 h-px w-32 origin-center"
      style={{
        background: 'linear-gradient(90deg, transparent, hsl(43,96%,46%,0.55), transparent)',
      }}
    />
  </motion.div>
);

const WinnerSpotlight = ({ entry, player, onNavigate }: { entry: BallonDOrEntry; player: Player | null; onNavigate: () => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9, y: 24 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ duration: 0.6, type: 'spring', bounce: 0.25 }}
  >
    <button type="button" onClick={onNavigate} className="w-full text-left group">
      <GlassPanel className="p-5 text-center border-[hsl(43,96%,46%)]/35 relative overflow-hidden transition-all group-hover:brightness-110 group-active:scale-[0.99]">
        {/* Layered gold radial wash */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, hsl(43,96%,46%,0.22), transparent 60%),' +
              'radial-gradient(circle at 0% 100%, hsl(43,96%,46%,0.10), transparent 55%),' +
              'radial-gradient(circle at 100% 100%, hsl(43,96%,46%,0.10), transparent 55%)',
          }}
        />
        <motion.div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(43,96%,46%,0.55), transparent)' }}
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="relative z-10 inline-flex items-center gap-1.5 text-[10px] text-[hsl(43,96%,62%)] uppercase tracking-[0.22em] font-black mb-3"
        >
          <Sparkles className="w-3 h-3" />
          Winner
          <Sparkles className="w-3 h-3" />
        </motion.p>

        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.25, duration: 0.6, type: 'spring' }}
          className="relative z-10 mx-auto mb-3 inline-block"
        >
          {player ? (
            <div className="relative">
              <div
                className="absolute -inset-3 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, hsl(43,96%,46%,0.35), transparent 70%)' }}
              />
              <PlayerCard
                player={{ ...player, overall: entry.overall, position: entry.position }}
                size="lg"
                interactive="none"
                compact
              />
              <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-[hsl(43,96%,46%)] flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.5),0_0_18px_hsl(43,96%,46%,0.55)]">
                <Trophy className="w-4 h-4 text-[hsl(43,15%,15%)]" />
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-[hsl(43,96%,46%)]/15 border-2 border-[hsl(43,96%,46%)]/40 flex items-center justify-center shadow-[0_0_30px_hsl(43,96%,46%,0.35)]">
              <Trophy className="w-10 h-10 text-[hsl(43,96%,56%)]" />
            </div>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="relative z-10 text-2xl font-black text-foreground font-display"
        >
          {entry.playerName}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.4 }}
          className="relative z-10 flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mt-1.5"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full ring-1 ring-white/15" style={{ backgroundColor: entry.clubColor }} />
            <span className="text-[12px] text-muted-foreground">{entry.clubName}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/60">·</span>
          <span className="text-[12px] font-bold text-primary tabular-nums">{entry.overall} OVR</span>
          <span className="text-[10px] text-muted-foreground/60">·</span>
          <span className="text-[11px] text-muted-foreground">{entry.position}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.4 }}
          className="relative z-10 grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-[hsl(43,96%,46%)]/20"
        >
          <StatCell label="Goals" value={entry.goals.toString()} />
          <StatCell label="Assists" value={entry.assists.toString()} />
          <StatCell label="Rating" value={entry.avgRating?.toFixed(1) ?? '-'} />
          <StatCell label="Score" value={entry.score.toFixed(1)} highlight />
        </motion.div>
      </GlassPanel>
    </button>
  </motion.div>
);

const StatCell = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div>
    <p className={cn('text-lg font-black tabular-nums leading-none', highlight ? 'text-[hsl(43,96%,62%)]' : 'text-foreground')}>
      {value}
    </p>
    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
  </div>
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
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.32, ease: 'easeOut' }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 p-2.5 rounded-xl transition-all',
          style.bg, style.glow,
          'border', style.border,
          isPlayerClub && 'ring-1 ring-primary/30',
          'hover:brightness-110 active:scale-[0.99]',
        )}
      >
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-black text-xs tabular-nums',
          isPodium ? 'bg-gradient-to-br shadow-inner' : '',
          entry.rank === 1 && 'from-[hsl(var(--gold))] to-[hsl(var(--gold)/0.7)] text-black',
          entry.rank === 2 && 'from-[hsl(var(--silver))] to-[hsl(var(--silver)/0.7)] text-black',
          entry.rank === 3 && 'from-[hsl(var(--bronze))] to-[hsl(var(--bronze)/0.7)] text-black',
          !isPodium && 'bg-muted/30 text-muted-foreground',
        )}>
          {entry.rank}
        </div>

        <div className="flex-1 min-w-0 text-left">
          <p className={cn('text-xs font-bold truncate', isPodium ? style.text : 'text-foreground')}>
            {entry.playerName}
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.clubColor }} />
            <span className="text-[10px] text-muted-foreground truncate">
              {entry.clubName} · {entry.position} · {entry.overall} OVR
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-right">
            <p className={cn('text-xs font-black tabular-nums leading-none', isPodium ? style.text : 'text-foreground')}>
              {entry.score.toFixed(1)}
            </p>
            <p className="text-[8px] text-muted-foreground mt-0.5">pts</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className={cn('mx-2 mt-1 mb-1.5 p-2.5 rounded-lg border', style.border, 'bg-card/40')}>
              <div className="grid grid-cols-5 gap-2 text-center">
                <StatCell label="Goals" value={entry.goals.toString()} />
                <StatCell label="Assists" value={entry.assists.toString()} />
                <StatCell label="Apps" value={entry.appearances.toString()} />
                <StatCell label="Rating" value={entry.avgRating?.toFixed(1) ?? '-'} />
                <StatCell label="Age" value={entry.age.toString()} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/** Reigning top-10 holders — premium grid with rank badges per card.
 *  Cards are sorted by overall (desc) since rank from a prior season
 *  doesn't necessarily map to current quality. */
const ReigningHoldersPanel = ({ holders, onNavigate, canNavigate }: {
  holders: Player[];
  onNavigate: (id: string) => void;
  canNavigate: (id: string) => boolean;
}) => (
  <GlassPanel className="p-4 border-[hsl(43,96%,46%)]/25 relative overflow-hidden">
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          'radial-gradient(ellipse 65% 35% at 50% 0%, hsl(43,96%,46%,0.14), transparent 70%),' +
          'radial-gradient(circle at 12% 100%, hsl(43,96%,46%,0.08), transparent 55%),' +
          'radial-gradient(circle at 88% 100%, hsl(43,96%,46%,0.06), transparent 60%)',
      }}
    />
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-md bg-[hsl(43,96%,46%)]/15 border border-[hsl(43,96%,46%)]/30 flex items-center justify-center">
          <Award className="w-3.5 h-3.5 text-[hsl(43,96%,62%)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[10px] uppercase tracking-[0.22em] font-black text-[hsl(43,96%,62%)] leading-none">
            Reigning Top 10
          </h3>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground tabular-nums px-1.5 py-0.5 rounded-md bg-muted/20 border border-border/30">
          {holders.length} active
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground/80 mb-3 leading-snug">
        Carrying the Ballon d&rsquo;Or card and a stats boost until the next ceremony.
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {holders.map((p, i) => {
          const clickable = canNavigate(p.id);
          const isTop3 = i < 3;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.04 * i + 0.1, duration: 0.4, ease: 'easeOut' }}
              className="relative"
            >
              <button
                type="button"
                onClick={() => clickable && onNavigate(p.id)}
                disabled={!clickable}
                className={cn(
                  'relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-xl transition-transform',
                  clickable ? 'hover:-translate-y-0.5 active:scale-[0.97] cursor-pointer' : 'cursor-default',
                )}
                aria-label={`${p.firstName} ${p.lastName}, ${p.overall} overall${clickable ? ' — view details' : ''}`}
              >
                <PlayerCard player={p} size="sm" interactive="none" compact />
                {/* Rank badge — top-left corner */}
                <div
                  className={cn(
                    'absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black tabular-nums',
                    'border shadow-[0_2px_8px_rgba(0,0,0,0.55)]',
                    isTop3
                      ? 'bg-gradient-to-br from-[hsl(43,96%,56%)] to-[hsl(43,96%,38%)] text-black border-[hsl(43,96%,30%)]'
                      : 'bg-card border-border/50 text-foreground/90',
                  )}
                >
                  {i + 1}
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  </GlassPanel>
);

/** Empty state shown when no season ranking exists yet (game has just started). */
const EmptyStateMessage = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.15, duration: 0.4 }}
  >
    <GlassPanel className="p-5 text-center relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, hsl(43,96%,46%,0.08), transparent 70%)',
        }}
      />
      <Crown className="w-7 h-7 text-[hsl(43,96%,56%)]/70 mx-auto mb-2 relative z-10" />
      <p className="text-xs text-foreground/85 font-semibold relative z-10">No ceremony yet</p>
      <p className="text-[11px] text-muted-foreground mt-1 max-w-[260px] mx-auto leading-snug relative z-10">
        Complete a full season to crown the next Ballon d&rsquo;Or winner and reveal the world&rsquo;s top 25.
      </p>
    </GlassPanel>
  </motion.div>
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

  const seasonsWithData = useMemo(
    () => seasonHistory.filter(h => h.ballonDOrRanking && h.ballonDOrRanking.length > 0).reverse(),
    [seasonHistory],
  );

  // Reigning top-10 holders — derived from the live `players` map. Includes
  // both real loaded players and the synthetic global-elite ghosts seeded at
  // game-init (Real Madrid, Bayern, PSG stars when managing in England etc.).
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

  // Block navigation for ghost players (those whose clubId isn't in the
  // loaded clubs map) — PlayerDetail expects a real club to render.
  const canNavigateToPlayer = (playerId: string): boolean => {
    const p = players[playerId];
    if (!p) return false;
    return Boolean(clubs[p.clubId]);
  };

  const navigateToPlayer = (playerId: string) => {
    if (!canNavigateToPlayer(playerId)) return;
    selectPlayer(playerId);
    setScreen('player-detail');
  };

  const heroSubtitle = seasonsWithData.length === 0
    ? 'A new era begins. Complete a season to crown the next legend.'
    : `Season ${activeSeason} — the 25 finest of the year.`;

  return (
    <div className="max-w-lg mx-auto px-4 py-3 space-y-4 pb-8">
      <PageHero subtitle={heroSubtitle} />

      {/* Season selector — pill toggle, only when 2+ seasons exist */}
      {seasonsWithData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="flex items-center justify-center"
        >
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-card/60 backdrop-blur-xl border border-border/50 shadow-[0_4px_18px_rgba(0,0,0,0.35)]">
            {seasonsWithData.slice(0, 5).map(h => (
              <button
                key={h.season}
                onClick={() => { setSelectedSeason(h.season); setExpandedRank(null); }}
                className={cn(
                  'px-3 py-1 rounded-lg text-[11px] font-black tabular-nums transition-all',
                  h.season === activeSeason
                    ? 'bg-[hsl(43,96%,46%)]/20 text-[hsl(43,96%,62%)] shadow-inner ring-1 ring-[hsl(43,96%,46%)]/35'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
                )}
              >
                S{h.season}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Reigning panel — show whenever any holder is active */}
      {reigningHolders.length > 0 && (
        <ReigningHoldersPanel
          holders={reigningHolders}
          onNavigate={navigateToPlayer}
          canNavigate={canNavigateToPlayer}
        />
      )}

      {seasonsWithData.length === 0 ? (
        <>
          <EmptyStateMessage />
          <div className="flex justify-center pt-1">
            <Button variant="secondary" onClick={() => setScreen(previousScreen || 'dashboard')}>
              Back
            </Button>
          </div>
        </>
      ) : (
        <>
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
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.12, duration: 0.45, type: 'spring' }}
                  >
                    <button
                      type="button"
                      onClick={() => navigateToPlayer(entry.playerId)}
                      className={cn(
                        'w-full p-3 rounded-xl text-center border transition-all hover:brightness-110 active:scale-[0.99] backdrop-blur-sm',
                        style.bg, style.border, style.glow,
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-2 font-black text-sm shadow-inner',
                        entry.rank === 2 && 'bg-gradient-to-br from-[hsl(var(--silver))] to-[hsl(var(--silver)/0.7)] text-black',
                        entry.rank === 3 && 'bg-gradient-to-br from-[hsl(var(--bronze))] to-[hsl(var(--bronze)/0.7)] text-black',
                      )}>
                        {entry.rank}
                      </div>
                      <p className={cn('text-xs font-bold truncate', style.text)}>{entry.playerName}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full ring-1 ring-white/15" style={{ backgroundColor: entry.clubColor }} />
                        <span className="text-[10px] text-muted-foreground truncate">{entry.clubName}</span>
                      </div>
                      <p className={cn('text-base font-black mt-1 tabular-nums leading-none', style.text)}>
                        {entry.score.toFixed(1)}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{entry.goals}G · {entry.assists}A</p>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Full ranking list (4-25) */}
          {ranking.length > 3 && (
            <GlassPanel className="p-3">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.22em] font-bold">
                  Full Ranking
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {ranking.length} players
                </p>
              </div>
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
              <GlassPanel className="p-4 border-primary/20 relative overflow-hidden">
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse 60% 50% at 0% 0%, hsl(var(--primary)/0.08), transparent 70%)' }}
                />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-3.5 h-3.5 text-primary" />
                    <p className="text-[10px] text-primary uppercase tracking-[0.22em] font-bold">
                      Your Players in Top 25
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {yourPlayers.map(entry => (
                      <button
                        key={entry.playerId}
                        type="button"
                        onClick={() => navigateToPlayer(entry.playerId)}
                        className="w-full flex items-center gap-3 text-left hover:bg-primary/5 rounded-lg p-1.5 transition-colors"
                      >
                        <span className="text-xs font-black text-primary tabular-nums w-7 shrink-0">
                          {getRankLabel(entry.rank)}
                        </span>
                        <span className="text-xs font-bold text-foreground flex-1 truncate">
                          {entry.playerName}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {entry.goals}G · {entry.assists}A
                        </span>
                        <span className="text-xs font-black text-primary tabular-nums shrink-0">
                          {entry.score.toFixed(1)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </GlassPanel>
            );
          })()}
        </>
      )}
    </div>
  );
};

export default BallonDor;
