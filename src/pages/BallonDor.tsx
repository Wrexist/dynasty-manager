import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PlayerCard } from '@/components/game/PlayerCard';
import { Button } from '@/components/ui/button';
import { ChevronDown, Trophy, Crown, Award, Play, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BallonDOrEntry, Player } from '@/types/game';
import { PremiumLaurel } from '@/components/game/icons/PremiumLaurel';
import { CardBack } from '@/components/game/pack/CardBack';
import { BallonDorCeremony } from '@/components/game/ballonDor/BallonDorCeremony';
import { useBallonCeremonySeen } from '@/hooks/useBallonCeremonySeen';

const RANK_MEDAL_COLORS: Record<number, { bg: string; text: string; border: string; glow: string }> = {
  1: { bg: 'bg-gold/15', text: 'text-gold', border: 'border-gold/35', glow: 'shadow-[0_0_24px_hsl(var(--gold)/0.28)]' },
  2: { bg: 'bg-[hsl(var(--silver))]/10', text: 'text-[hsl(var(--silver))]', border: 'border-[hsl(var(--silver))]/30', glow: 'shadow-[0_0_18px_hsl(var(--silver)/0.22)]' },
  3: { bg: 'bg-[hsl(var(--bronze))]/12', text: 'text-[hsl(var(--bronze))]', border: 'border-[hsl(var(--bronze))]/30', glow: 'shadow-[0_0_18px_hsl(var(--bronze)/0.22)]' },
};

function getMedalStyle(rank: number) {
  if (rank <= 3) return RANK_MEDAL_COLORS[rank];
  if (rank <= 10) return { bg: 'bg-primary/8', text: 'text-primary', border: 'border-primary/20', glow: '' };
  return { bg: 'bg-muted/15', text: 'text-muted-foreground', border: 'border-border/30', glow: '' };
}

const HERO_TITLE_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(180deg, color-mix(in srgb, hsl(var(--gold)) 55%, white) 0%, hsl(var(--gold)) 55%, color-mix(in srgb, hsl(var(--gold)) 62%, black) 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

/** Golden hero — sets the prestige tone for the whole page. */
const PageHero = ({ subtitle }: { subtitle: string }) => {
  const { t } = useTranslation();
  return (
  <div className="relative text-center pt-1 pb-3">
    <div
      aria-hidden
      className="absolute inset-x-0 -top-2 h-32 pointer-events-none"
      style={{ background: 'radial-gradient(ellipse 70% 90% at 50% 30%, hsl(var(--gold) / 0.18), transparent 70%)' }}
    />
    <div className="relative z-10 inline-flex items-center justify-center gap-2 mb-1.5">
      <Trophy className="w-5 h-5 text-gold drop-shadow-[0_0_10px_hsl(var(--gold)/0.6)]" />
      <h2 className="text-[26px] font-black font-display tracking-tight leading-none" style={HERO_TITLE_STYLE}>
        {t('ballonDor.title')}
      </h2>
      <Trophy className="w-5 h-5 text-gold drop-shadow-[0_0_10px_hsl(var(--gold)/0.6)] scale-x-[-1]" />
    </div>
    <p className="relative z-10 text-[11px] text-muted-foreground">{subtitle}</p>
  </div>
  );
};

const StatCell = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div>
    <p className={cn('text-lg font-black tabular-nums leading-none', highlight ? 'text-gold' : 'text-foreground')}>
      {value}
    </p>
    <p className="text-micro text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
  </div>
);

const RankingRow = ({ entry, isExpanded, onToggle, isPlayerClub }: {
  entry: BallonDOrEntry;
  isExpanded: boolean;
  onToggle: () => void;
  isPlayerClub: boolean;
}) => {
  const { t } = useTranslation();
  const style = getMedalStyle(entry.rank);
  const isPodium = entry.rank <= 3;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${entry.playerName} ranked #${entry.rank}`}
        className={cn(
          'w-full flex items-center gap-3 p-2.5 rounded-xl transition-all',
          style.bg, style.glow,
          'border', style.border,
          isPlayerClub && 'ring-1 ring-primary/30',
          'hover:brightness-110 active:scale-[0.99]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
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
            <span className="text-micro text-muted-foreground truncate">
              {entry.clubName} · {entry.position} · {entry.overall} OVR
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-right">
            <p className={cn('text-xs font-black tabular-nums leading-none', isPodium ? style.text : 'text-foreground')}>
              {entry.score.toFixed(1)}
            </p>
            <p className="text-micro text-muted-foreground mt-0.5">{t('ballonDor.pts')}</p>
          </div>
          <motion.div
            aria-hidden
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.18 }}
            className="shrink-0"
          >
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className={cn('mx-2 mt-1 mb-1.5 p-2.5 rounded-lg border', style.border, 'bg-card/40')}>
              <div className="grid grid-cols-5 gap-2 text-center">
                <StatCell label={t('ballonDor.goals')} value={entry.goals.toString()} />
                <StatCell label={t('ballonDor.assists')} value={entry.assists.toString()} />
                <StatCell label={t('ballonDor.apps')} value={entry.appearances.toString()} />
                <StatCell label={t('ballonDor.rating')} value={entry.avgRating?.toFixed(1) ?? '-'} />
                <StatCell label={t('ballonDor.age')} value={entry.age.toString()} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Reigning top-10 holders — premium grid with rank badges per card.
 *  Cards are sorted by overall (desc) since rank from a prior season
 *  doesn't necessarily map to current quality. */
const ReigningHoldersPanel = ({ holders, onNavigate, canNavigate }: {
  holders: Player[];
  onNavigate: (id: string) => void;
  canNavigate: (id: string) => boolean;
}) => {
  const { t } = useTranslation();
  return (
  <GlassPanel className="p-4 border-gold/25 relative overflow-hidden">
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{ background: 'radial-gradient(ellipse 65% 35% at 50% 0%, hsl(var(--gold) / 0.14), transparent 70%)' }}
    />
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-1.5">
        <Award className="w-3.5 h-3.5 text-gold" />
        <h3 className="text-micro uppercase tracking-[0.22em] font-black text-gold leading-none flex-1">
          {t('ballonDor.reigningTop10')}
        </h3>
        <span className="text-micro font-bold text-muted-foreground tabular-nums">
          {t('ballonDor.reigningActive', { count: holders.length })}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground/80 mb-3 leading-snug">
        {t('ballonDor.reigningBody')}
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {holders.map((p, i) => {
          const clickable = canNavigate(p.id);
          return (
            <div key={p.id} className="relative">
              <button
                type="button"
                onClick={() => clickable && onNavigate(p.id)}
                disabled={!clickable}
                className={cn(
                  'relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-xl transition-transform',
                  clickable ? 'hover:-translate-y-0.5 active:scale-[0.97]' : 'cursor-default',
                )}
                aria-label={`${p.firstName} ${p.lastName}, ${p.overall} overall`}
              >
                <PlayerCard player={p} size="sm" interactive="none" compact />
                <div
                  className={cn(
                    'absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-micro font-black tabular-nums border shadow-[0_2px_8px_rgba(0,0,0,0.55)]',
                    i < 3
                      ? 'bg-gold text-background border-gold/50'
                      : 'bg-card border-border/50 text-foreground/90',
                  )}
                >
                  {i + 1}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  </GlassPanel>
  );
};

/** "Ballon d'Or Night" — the sealed latest ceremony, waiting to be turned.
 *  Never shows a name: the whole point is that nothing is known yet. */
const NightTeaser = ({ season, onStart }: { season: number; onStart: () => void }) => {
  const { t } = useTranslation();
  return (
    <GlassPanel className="p-5 border-gold/40 relative overflow-hidden text-center">
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 20%, hsl(var(--gold) / 0.24), transparent 70%)' }} />
      <div className="relative z-10">
        <div className="flex justify-center gap-2 mb-4" aria-hidden>
          {[-10, 0, 10].map((r, i) => (
            <div key={r} className="relative w-[58px]" style={{ aspectRatio: '2 / 3', transform: `rotate(${r}deg) translateY(${i === 1 ? -6 : 4}px)` }}>
              <CardBack maskSrc="/player-cards/ballondor.webp" />
            </div>
          ))}
        </div>
        <p className="text-micro uppercase tracking-[0.32em] text-gold font-black">{t('ballonDor.night.kicker', { season })}</p>
        <p className="font-display font-black text-2xl leading-tight mt-1" style={HERO_TITLE_STYLE}>{t('ballonDor.night.title')}</p>
        <p className="text-[12px] text-muted-foreground mt-1.5 max-w-[280px] mx-auto">{t('ballonDor.night.teaserBody')}</p>
        <Button className="mt-4 w-full h-12 gap-2 font-black bg-gold text-background hover:bg-gold/90" onClick={onStart}>
          <Play className="w-4 h-4" /> {t('ballonDor.night.cta')}
        </Button>
      </div>
    </GlassPanel>
  );
};

/** The top three on stepped plinths — 2nd, 1st, 3rd, the order a podium
 *  stands in — each on the Ballon d'Or card they now wear. */
const Podium = ({ ranking, players, season, navigateToPlayer }: {
  ranking: BallonDOrEntry[];
  players: Record<string, Player>;
  season: number;
  navigateToPlayer: (id: string) => void;
}) => {
  const top = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  const stepH: Record<number, number> = { 1: 58, 2: 40, 3: 28 };
  return (
    <div className="grid grid-cols-3 items-end gap-2 pt-2">
      {top.map(entry => {
        const style = getMedalStyle(entry.rank);
        const p = players[entry.playerId];
        const isWinner = entry.rank === 1;
        return (
          <button
            key={entry.playerId}
            type="button"
            onClick={() => navigateToPlayer(entry.playerId)}
            className="flex flex-col items-center min-w-0 active:scale-[0.98] transition-transform"
          >
            <div className={cn('relative', isWinner ? '-mb-1' : '')}>
              {isWinner && (
                <div aria-hidden className="absolute -inset-4 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(closest-side, hsl(var(--gold) / 0.35), transparent)' }} />
              )}
              {p ? (
                <PlayerCard
                  player={{ ...p, overall: entry.overall, position: entry.position, ballonDOrTop10HoldSeason: season }}
                  size={isWinner ? 'md' : 'sm'}
                  interactive="none"
                  compact
                />
              ) : (
                <div className={cn('rounded-xl flex items-center justify-center', isWinner ? 'w-[110px] h-[160px]' : 'w-16 h-24', style.bg)}>
                  <Trophy className={cn('w-6 h-6', style.text)} />
                </div>
              )}
            </div>
            <p className={cn('mt-2 text-xs font-bold truncate max-w-full', style.text)}>{entry.playerName}</p>
            <div className="flex items-center justify-center gap-1 min-w-0 max-w-full">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.clubColor }} />
              <span className="text-micro text-muted-foreground truncate">{entry.clubName}</span>
            </div>
            <div
              className={cn('mt-1.5 w-full rounded-t-lg border-t border-x flex items-start justify-center pt-1', style.border, style.bg)}
              style={{ height: stepH[entry.rank] ?? 24 }}
            >
              <span className={cn('font-display font-black text-lg tabular-nums leading-none', style.text)}>{entry.rank}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

/** Body of one season's ceremony — podium, winner line, full ranking.
 *  Pulled out as a sub-component so each year in the stacked history
 *  collapses/expands independently while sharing the same layout. */
const SeasonCeremony = ({
  season,
  ranking,
  players,
  playerClubName,
  expandedRank,
  setExpandedRank,
  navigateToPlayer,
  onReplay,
}: {
  season: number;
  ranking: BallonDOrEntry[];
  players: Record<string, Player>;
  playerClubName: string;
  expandedRank: number | null;
  setExpandedRank: (rank: number | null) => void;
  navigateToPlayer: (id: string) => void;
  onReplay: () => void;
}) => {
  const { t } = useTranslation();
  const winner = ranking[0];
  const yourPlayers = ranking.filter(e => e.clubName === playerClubName);
  return (
    <div className="space-y-4">
      {ranking.length >= 3 && (
        <GlassPanel className="p-4 border-gold/30 relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 0%, hsl(var(--gold) / 0.2), transparent 70%)' }} />
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-1">
              <PremiumLaurel className="w-3 h-[18px] scale-x-[-1]" />
              <p className="text-micro text-gold uppercase tracking-[0.32em] font-black">{t('ballonDor.podium')}</p>
              <PremiumLaurel className="w-3 h-[18px]" />
            </div>
            <Podium ranking={ranking} players={players} season={season} navigateToPlayer={navigateToPlayer} />
            {winner && (
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gold/20 text-center">
                <StatCell label={t('ballonDor.goals')} value={winner.goals.toString()} />
                <StatCell label={t('ballonDor.assists')} value={winner.assists.toString()} />
                <StatCell label={t('ballonDor.rating')} value={winner.avgRating?.toFixed(1) ?? '-'} />
                <StatCell label={t('ballonDor.score')} value={winner.score.toFixed(1)} highlight />
              </div>
            )}
            <button type="button" onClick={onReplay}
              className="mt-3 w-full min-h-11 rounded-xl border border-gold/30 bg-gold/10 text-gold text-xs font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99]">
              <Play className="w-3.5 h-3.5" /> {t('ballonDor.replay')}
            </button>
          </div>
        </GlassPanel>
      )}

      {ranking.length > 3 && (
        <GlassPanel className="p-3">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <p className="text-micro text-muted-foreground uppercase tracking-[0.22em] font-bold">
              {t('ballonDor.fullRanking')}
            </p>
            <p className="text-micro text-muted-foreground tabular-nums">
              {t('ballonDor.playersCount', { count: ranking.length })}
            </p>
          </div>
          <div className="space-y-1.5">
            {ranking.slice(3).map(entry => (
              <RankingRow
                key={entry.playerId}
                entry={entry}
                isExpanded={expandedRank === entry.rank}
                onToggle={() => setExpandedRank(expandedRank === entry.rank ? null : entry.rank)}
                isPlayerClub={entry.clubName === playerClubName}
              />
            ))}
          </div>
        </GlassPanel>
      )}

      {yourPlayers.length > 0 && (
        <GlassPanel className="p-4 border-primary/20 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 0% 0%, hsl(var(--primary)/0.08), transparent 70%)' }}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-3.5 h-3.5 text-primary" />
              <p className="text-micro text-primary uppercase tracking-[0.22em] font-bold">
                {t('ballonDor.yourPlayersTop25')}
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
                    #{entry.rank}
                  </span>
                  <span className="text-xs font-bold text-foreground flex-1 truncate">
                    {entry.playerName}
                  </span>
                  <span className="text-micro text-muted-foreground shrink-0">
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
      )}
    </div>
  );
};

/** Collapsed-year header — season + winner (or "Sealed") + chevron toggle. */
const SeasonHeader = ({ season, winner, isOpen, isLatest, sealed, onToggle }: {
  season: number;
  winner: BallonDOrEntry | undefined;
  isOpen: boolean;
  isLatest: boolean;
  sealed: boolean;
  onToggle: () => void;
}) => {
  const { t } = useTranslation();
  return (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={isOpen}
    aria-label={`${t('ballonDor.season', { season })}${winner && !sealed ? ` — ${winner.playerName}` : ''}`}
    className={cn(
      'w-full flex items-center gap-3 p-3 rounded-xl border transition-all',
      'bg-card/60 backdrop-blur-xl hover:brightness-110 active:scale-[0.99]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      isLatest
        ? 'border-gold/35 shadow-[0_4px_14px_rgba(0,0,0,0.35)]'
        : 'border-border/50',
    )}
  >
    {sealed
      ? <Lock className="w-4 h-4 shrink-0 text-gold" />
      : <Trophy className={cn('w-4 h-4 shrink-0', isLatest ? 'text-gold' : 'text-muted-foreground')} />}
    <div className="flex-1 text-left min-w-0">
      <div className="flex items-center gap-2">
        <p className={cn('text-xs font-black tabular-nums', isLatest ? 'text-gold' : 'text-foreground')}>
          {t('ballonDor.season', { season })}
        </p>
        {isLatest && (
          <span className="text-micro font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/20 text-gold">
            {sealed ? t('ballonDor.sealed') : t('ballonDor.latest')}
          </span>
        )}
      </div>
      {sealed ? (
        <p className="text-[11px] text-muted-foreground truncate">{t('ballonDor.sealedLine')}</p>
      ) : winner && (
        <p className="text-[11px] text-muted-foreground truncate">
          {t('ballonDor.winnerLine', { name: winner.playerName, club: winner.clubName })}
        </p>
      )}
    </div>
    <motion.div
      aria-hidden
      animate={{ rotate: isOpen ? 180 : 0 }}
      transition={{ duration: 0.18 }}
      className="shrink-0"
    >
      <ChevronDown className="w-4 h-4 text-muted-foreground" />
    </motion.div>
  </button>
  );
};

const BallonDor = () => {
  const { t } = useTranslation();
  const { seasonHistory, playerClubId, clubs, previousScreen, players } = useGameStore(useShallow(s => ({
    seasonHistory: s.seasonHistory,
    playerClubId: s.playerClubId,
    clubs: s.clubs,
    previousScreen: s.previousScreen,
    players: s.players,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const selectPlayer = useGameStore(s => s.selectPlayer);

  const [expandedRank, setExpandedRank] = useState<{ season: number; rank: number } | null>(null);
  /** Season whose ceremony is playing, or null. */
  const [ceremonySeason, setCeremonySeason] = useState<number | null>(null);

  const seasonsWithData = useMemo(
    () => seasonHistory.filter(h => h.ballonDOrRanking && h.ballonDOrRanking.length > 0).reverse(),
    [seasonHistory],
  );

  const latestSeason = seasonsWithData[0]?.season ?? null;
  const [latestSeen, markLatestSeen] = useBallonCeremonySeen(latestSeason);

  // Default open set: only the latest season's ceremony is expanded. Tracking
  // `lastSeenLatest` in a ref lets us detect when a NEW ceremony arrives
  // (latestSeason changes) and reset the open set so the new latest replaces
  // the previously-expanded one — the prior year auto-collapses.
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(
    () => latestSeason !== null ? new Set([latestSeason]) : new Set(),
  );
  const lastSeenLatest = useRef<number | null>(latestSeason);
  useEffect(() => {
    if (latestSeason !== lastSeenLatest.current) {
      lastSeenLatest.current = latestSeason;
      setOpenSeasons(latestSeason !== null ? new Set([latestSeason]) : new Set());
      setExpandedRank(null);
    }
  }, [latestSeason]);

  const toggleSeason = (s: number) => {
    setOpenSeasons(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  // Reigning top-10 holders — derived from the live `players` map. Includes
  // both real loaded players and the synthetic global-elite ghosts seeded at
  // game-init (Real Madrid, Bayern, PSG stars when managing in England etc.).
  const reigningHolders = useMemo(() => {
    return Object.values(players)
      .filter(p => typeof p.ballonDOrTop10HoldSeason === 'number' && p.clubId)
      .sort((a, b) => b.overall - a.overall);
  }, [players]);

  const playerClubName = clubs[playerClubId]?.shortName || '';

  // Block navigation for ghost players (those whose clubId isn't in the
  // loaded clubs map) — PlayerDetail expects a real club to render.
  const canNavigateToPlayer = (id: string) => Boolean(players[id] && clubs[players[id].clubId]);

  const navigateToPlayer = (id: string) => {
    if (!canNavigateToPlayer(id)) return;
    selectPlayer(id);
    setScreen('player-detail');
  };

  const heroSubtitle = seasonsWithData.length === 0
    ? t('ballonDor.subtitle.empty')
    : seasonsWithData.length === 1
      ? t('ballonDor.subtitle.one', { season: latestSeason })
      : t('ballonDor.subtitle.many', { count: seasonsWithData.length, season: latestSeason });

  const ceremonyData = ceremonySeason !== null ? seasonsWithData.find(h => h.season === ceremonySeason) : null;
  // The reigning panel shows the new holders' cards, so it waits for the
  // night too — it would otherwise name the whole top 10.
  const latestSealed = latestSeason !== null && !latestSeen;

  return (
    <div className="max-w-lg mx-auto px-4 py-3 space-y-4 pb-8">
      <PageHero subtitle={heroSubtitle} />

      {latestSealed && latestSeason !== null && (
        <NightTeaser season={latestSeason} onStart={() => setCeremonySeason(latestSeason)} />
      )}

      {/* Reigning panel — show whenever any holder is active */}
      {reigningHolders.length > 0 && !latestSealed && (
        <ReigningHoldersPanel
          holders={reigningHolders}
          onNavigate={navigateToPlayer}
          canNavigate={canNavigateToPlayer}
        />
      )}

      {seasonsWithData.length === 0 ? (
        <>
          <GlassPanel className="p-5 text-center">
            <Crown className="w-7 h-7 text-gold/70 mx-auto mb-2" />
            <p className="text-xs text-foreground/85 font-semibold">{t('ballonDor.noCeremony')}</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-[260px] mx-auto leading-snug">
              {t('ballonDor.noCeremonyBody')}
            </p>
          </GlassPanel>
          <div className="flex justify-center pt-1">
            <Button variant="secondary" onClick={() => setScreen(previousScreen || 'dashboard')}>
              {t('ballonDor.back')}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {seasonsWithData.map((seasonData, index) => {
            const season = seasonData.season;
            const isLatest = index === 0;
            const sealed = isLatest && latestSealed;
            const isOpen = openSeasons.has(season) && !sealed;
            const ranking = seasonData.ballonDOrRanking || [];
            const winner = ranking[0];
            return (
              <div key={season} className="space-y-3">
                <SeasonHeader
                  season={season}
                  winner={winner}
                  isOpen={isOpen}
                  isLatest={isLatest}
                  sealed={sealed}
                  onToggle={() => (sealed ? setCeremonySeason(season) : toggleSeason(season))}
                />
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <SeasonCeremony
                        season={season}
                        ranking={ranking}
                        players={players}
                        playerClubName={playerClubName}
                        expandedRank={expandedRank?.season === season ? expandedRank.rank : null}
                        setExpandedRank={r => setExpandedRank(r === null ? null : { season, rank: r })}
                        navigateToPlayer={navigateToPlayer}
                        onReplay={() => setCeremonySeason(season)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {ceremonyData && (
          <BallonDorCeremony
            key={ceremonyData.season}
            season={ceremonyData.season}
            ranking={ceremonyData.ballonDOrRanking || []}
            players={players}
            playerClubName={playerClubName}
            onFinish={() => { if (ceremonyData.season === latestSeason) markLatestSeen(); }}
            onClose={() => {
              setOpenSeasons(prev => new Set(prev).add(ceremonyData.season));
              setCeremonySeason(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default BallonDor;
