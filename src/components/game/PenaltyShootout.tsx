import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { Check, ChevronRight, Hand, SkipForward, X } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { PenaltyGoalScene, type SceneShot } from '@/components/game/shootout/PenaltyGoalScene';
import { PackConfetti } from '@/components/game/pack/PackConfetti';
import { getPenaltyTakerQuality, getShootoutProgress } from '@/utils/penaltyShootout';
import { hapticError, hapticHeavy, hapticLight, hapticMedium, hapticSuccess } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import type { PenaltyKick, Player } from '@/types/game';

/**
 * Interactive penalty shootout — the emotional peak of a cup tie.
 *
 * The player picks each taker, taps the 2.5D goal to place the shot, and
 * watches the keeper dive; opponent kicks auto-play with the same staging.
 * Outcomes resolve in the store (takeAimedPenalty / revealOpponentPenalty);
 * this component owns only presentation flow. When the shootout is decided,
 * Continue routes into the existing finalize path (skipPenaltyShootout).
 */

type Stage = 'aim' | 'shooting' | 'oppWait' | 'oppShooting' | 'done';

const OPP_STEP_UP_MS = 1350;
const HAPTIC_AT_MS = 440; // roughly when the ball arrives in the scene

function kickToShot(kick: PenaltyKick, id: number): SceneShot {
  return {
    id,
    aimX: kick.aimX ?? 0,
    aimY: kick.aimY ?? 0.4,
    diveX: kick.diveX ?? 0,
    diveY: kick.diveY ?? 0.3,
    outcome: kick.outcome ?? (kick.scored ? 'goal' : 'saved'),
  };
}

function KickResultChip({ kick }: { kick: PenaltyKick | undefined }) {
  if (!kick) return <span className="w-4 h-4 rounded-full border border-white/15 bg-white/5 shrink-0" />;
  if (kick.scored) {
    return (
      <span className="w-4 h-4 rounded-full bg-emerald-500/90 flex items-center justify-center shrink-0 shadow-[0_0_10px_-2px_rgba(16,185,129,0.9)]">
        <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
      </span>
    );
  }
  const off = kick.outcome === 'off_target';
  return (
    <span className={cn('w-4 h-4 rounded-full flex items-center justify-center shrink-0', off ? 'bg-amber-500/80' : 'bg-red-500/80')}>
      <X className="w-3 h-3 text-white" strokeWidth={3.5} />
    </span>
  );
}

/** Compact taker card for the "who steps up" row. */
function TakerCard({ player, color, color2, selected, used, onSelect }: {
  player: Player;
  color: string;
  color2?: string;
  selected: boolean;
  used: boolean;
  onSelect?: () => void;
}) {
  const pen = Math.round(getPenaltyTakerQuality(player) * 99);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={used || !onSelect}
      className={cn(
        'flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border min-w-[76px] transition-all',
        'bg-card/60 backdrop-blur-md',
        selected
          ? 'border-primary shadow-[0_0_18px_-4px_hsl(43_96%_46%/0.7)] scale-[1.04]'
          : 'border-border/50',
        used && 'opacity-35',
      )}
    >
      <PlayerAvatar jerseyColor={color} secondaryColor={color2} size={30} overall={player.overall} position={player.position} />
      <span className="text-[10px] font-semibold text-foreground leading-none max-w-[70px] truncate">
        {player.lastName || player.firstName}
      </span>
      <span className="text-[9px] text-muted-foreground leading-none whitespace-nowrap">
        {player.position} · <span className="text-primary font-bold">PEN {pen}</span>
      </span>
    </button>
  );
}

export function PenaltyShootout() {
  const {
    kicks, ctx, players, clubs, currentMatchResult,
  } = useGameStore(useShallow(s => ({
    kicks: s.penaltyShootoutKicks,
    ctx: s.penaltyShootoutCtx,
    players: s.players,
    clubs: s.clubs,
    currentMatchResult: s.currentMatchResult,
  })));
  const takeAimedPenalty = useGameStore(s => s.takeAimedPenalty);
  const revealOpponentPenalty = useGameStore(s => s.revealOpponentPenalty);
  const skipAll = useGameStore(s => s.skipPenaltyShootout);
  const reducedMotion = useGameStore(s => s.settings.reducedMotion || s.settings.performanceMode);

  const progress = getShootoutProgress(kicks);
  const playerTurn = ctx ? progress.nextIsHome === ctx.playerIsHome : false;

  const [stage, setStage] = useState<Stage>(() =>
    progress.decided ? 'done' : playerTurn ? 'aim' : 'oppWait');
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [selectedTakerId, setSelectedTakerId] = useState<string | null>(null);
  const [shot, setShot] = useState<SceneShot | null>(null);
  const oppFiredForRef = useRef(-1);
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(hapticTimerRef.current), []);

  // ── Derived clubs / squads ─────────────────────────────────────────────
  const myClubId = ctx?.playerIsHome ? currentMatchResult?.homeClubId : currentMatchResult?.awayClubId;
  const oppClubId = ctx?.playerIsHome ? currentMatchResult?.awayClubId : currentMatchResult?.homeClubId;
  const myClub = myClubId ? clubs[myClubId] : undefined;
  const oppClub = oppClubId ? clubs[oppClubId] : undefined;

  const onPitch = useMemo(
    () => (myClub?.lineup ?? []).map(id => players[id]).filter(Boolean),
    [myClub, players],
  );
  const takerPool = useMemo(() => {
    const used = new Set(ctx?.usedTakerIds ?? []);
    const pool = onPitch.filter(p => !used.has(p.id));
    const list = pool.length ? pool : onPitch;
    // Real-shootout convention: the keeper only steps up when everyone else
    // has gone — generated GKs carry deceptively high mental ratings, so an
    // attribute sort alone would put them in the first five.
    return [...list].sort((a, b) => {
      const gk = (a.position === 'GK' ? 1 : 0) - (b.position === 'GK' ? 1 : 0);
      if (gk !== 0) return gk;
      return getPenaltyTakerQuality(b) - getPenaltyTakerQuality(a);
    });
  }, [onPitch, ctx?.usedTakerIds]);

  // Keeper facing the CURRENT kick (opponent GK while we shoot, ours while they do).
  const shootingAtOppGK = stage === 'aim' || stage === 'shooting';
  const keeperId = ctx ? (shootingAtOppGK
    ? (ctx.playerIsHome ? ctx.awayGKId : ctx.homeGKId)
    : (ctx.playerIsHome ? ctx.homeGKId : ctx.awayGKId)) : null;
  const keeper = keeperId ? players[keeperId] : undefined;
  const keeperClub = shootingAtOppGK ? oppClub : myClub;

  // Pre-select the best available taker whenever it becomes our turn.
  useEffect(() => {
    if (stage === 'aim' && (!selectedTakerId || !takerPool.some(p => p.id === selectedTakerId))) {
      setSelectedTakerId(takerPool[0]?.id ?? null);
    }
  }, [stage, takerPool, selectedTakerId]);

  // ── Flow control ───────────────────────────────────────────────────────
  const advance = useCallback(() => {
    setShot(null);
    setAim(null);
    const st = useGameStore.getState();
    const prog = getShootoutProgress(st.penaltyShootoutKicks);
    const c = st.penaltyShootoutCtx;
    if (prog.decided || !c) {
      hapticHeavy();
      setStage('done');
      return;
    }
    if (prog.nextIsHome === c.playerIsHome) {
      setSelectedTakerId(null);
      setStage('aim');
    } else {
      setStage('oppWait');
    }
  }, []);

  // Opponent step-up: brief suspense, then their kick resolves and animates.
  useEffect(() => {
    if (stage !== 'oppWait') return;
    if (oppFiredForRef.current === kicks.length) return;
    oppFiredForRef.current = kicks.length;
    const t = setTimeout(() => {
      const kick = revealOpponentPenalty();
      if (!kick) { advance(); return; }
      const isGoodForPlayer = !kick.scored;
      hapticTimerRef.current = setTimeout(() => (isGoodForPlayer ? hapticSuccess() : hapticError()), HAPTIC_AT_MS);
      setShot(kickToShot(kick, useGameStore.getState().penaltyShootoutKicks.length));
      setStage('oppShooting');
    }, OPP_STEP_UP_MS);
    return () => clearTimeout(t);
  }, [stage, kicks.length, revealOpponentPenalty, advance]);

  const handleShoot = () => {
    if (!aim || !selectedTakerId || stage !== 'aim') return;
    hapticMedium();
    const kick = takeAimedPenalty(selectedTakerId, aim.x, aim.y);
    if (!kick) { advance(); return; }
    hapticTimerRef.current = setTimeout(() => (kick.scored ? hapticSuccess() : hapticError()), HAPTIC_AT_MS);
    setShot(kickToShot(kick, useGameStore.getState().penaltyShootoutKicks.length));
    setStage('shooting');
  };

  if (!ctx || !currentMatchResult || !myClub || !oppClub) return null;

  // ── Presentation data ──────────────────────────────────────────────────
  const homeClub = clubs[currentMatchResult.homeClubId];
  const awayClub = clubs[currentMatchResult.awayClubId];
  const myTotal = ctx.playerIsHome ? progress.homeTotal : progress.awayTotal;
  const oppTotal = ctx.playerIsHome ? progress.awayTotal : progress.homeTotal;
  const playerWon = progress.decided && myTotal > oppTotal;
  const inSuddenDeath = kicks.filter(k => k.isHome).length > 5 || kicks.filter(k => !k.isHome).length > 5 || progress.nextRound > 5;

  const lastKick = kicks[kicks.length - 1];
  const shootingTakerName = stage === 'shooting' || stage === 'oppShooting' ? lastKick?.takerName : null;

  const maxRound = Math.max(5, ...kicks.map(k => k.round));
  const rounds = Array.from({ length: maxRound }, (_, i) => {
    const r = i + 1;
    return {
      round: r,
      home: kicks.find(k => k.round === r && k.isHome),
      away: kicks.find(k => k.round === r && !k.isHome),
    };
  });

  const nextOppTaker = (() => {
    if (stage !== 'oppWait') return null;
    const oppOnPitch = (oppClub.lineup ?? []).map(id => players[id]).filter(Boolean)
      .filter(p => p.position !== 'GK')
      .sort((a, b) => getPenaltyTakerQuality(b) - getPenaltyTakerQuality(a));
    if (!oppOnPitch.length) return null;
    const taken = kicks.filter(k => k.isHome !== ctx.playerIsHome).length;
    return oppOnPitch[taken % oppOnPitch.length];
  })();

  return (
    <div className="space-y-3 relative">
      {/* Winner confetti */}
      {stage === 'done' && playerWon && !reducedMotion && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <PackConfetti count={44} hueBase={43} hueRange={26} />
        </div>
      )}

      {/* Scoreboard */}
      <GlassPanel className="p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold">Penalty Shootout</p>
          <div className="flex items-center gap-2">
            {inSuddenDeath && !progress.decided && (
              <motion.span
                className="text-[9px] uppercase tracking-widest font-bold text-red-300 bg-red-500/15 border border-red-500/30 rounded-full px-2 py-0.5"
                animate={{ opacity: [1, 0.55, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                Sudden Death
              </motion.span>
            )}
            {!progress.decided && (
              <button
                type="button"
                onClick={() => { hapticLight(); skipAll(); }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipForward className="w-3 h-3" /> Skip
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center gap-5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: homeClub?.color }} />
            <span className="text-xs font-bold truncate">{homeClub?.shortName}</span>
          </div>
          <div className="flex items-center gap-2 text-3xl font-display font-black tabular-nums">
            <motion.span key={`h${progress.homeTotal}`} initial={{ scale: 1.6, color: '#fbbf24' }} animate={{ scale: 1, color: '#ffffff' }}>
              {progress.homeTotal}
            </motion.span>
            <span className="text-base text-muted-foreground font-normal">–</span>
            <motion.span key={`a${progress.awayTotal}`} initial={{ scale: 1.6, color: '#fbbf24' }} animate={{ scale: 1, color: '#ffffff' }}>
              {progress.awayTotal}
            </motion.span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold truncate">{awayClub?.shortName}</span>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: awayClub?.color }} />
          </div>
        </div>
      </GlassPanel>

      {/* The goal */}
      <div className="relative">
        <PenaltyGoalScene
          keeperColor={keeperClub?.color ?? '#888'}
          keeperColor2={keeperClub?.secondaryColor}
          aim={stage === 'aim' ? aim : null}
          onAim={stage === 'aim' ? (x, y) => { hapticLight(); setAim({ x, y }); } : undefined}
          shot={shot}
          onShotComplete={advance}
        />

        {/* In-goal keeper tag */}
        {keeper && stage !== 'done' && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/10 pl-1.5 pr-2.5 py-1">
            <Hand className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-semibold text-white leading-none">{keeper.lastName || keeper.firstName}</span>
            <span className="text-[9px] text-white/60 leading-none">GK {keeper.overall}</span>
          </div>
        )}

        {/* Shooter banner during a kick */}
        <AnimatePresence>
          {shootingTakerName && stage !== 'done' && (
            <motion.div
              key={`banner-${shot?.id}`}
              className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <span className="text-[11px] font-bold text-white bg-black/55 backdrop-blur-md border border-white/10 rounded-full px-3 py-1">
                {shootingTakerName}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Turn panel */}
      <AnimatePresence mode="wait">
        {stage === 'aim' && (
          <motion.div key="aim" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <GlassPanel className="p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground">
                  Round {progress.nextRound}{inSuddenDeath ? ' · Sudden death' : ''} — who steps up?
                </p>
                <p className="text-[10px] text-muted-foreground">{aim ? 'Tap Shoot — or re-aim' : 'Tap the goal to aim'}</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {takerPool.map(p => (
                  <TakerCard
                    key={p.id}
                    player={p}
                    color={myClub.color}
                    color2={myClub.secondaryColor}
                    selected={p.id === selectedTakerId}
                    used={false}
                    onSelect={() => { hapticLight(); setSelectedTakerId(p.id); }}
                  />
                ))}
              </div>
              <Button
                className={cn(
                  'w-full h-12 text-base font-bold gap-2 transition-shadow',
                  aim && 'shadow-[0_0_24px_-6px_hsl(43_96%_46%/0.9)] animate-pulse',
                )}
                disabled={!aim || !selectedTakerId}
                onClick={handleShoot}
              >
                {aim ? 'Shoot' : 'Aim first — tap the goal'}
                {aim && <ChevronRight className="w-5 h-5" />}
              </Button>
            </GlassPanel>
          </motion.div>
        )}

        {stage === 'oppWait' && nextOppTaker && (
          <motion.div key="oppwait" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <GlassPanel className="p-3">
              <div className="flex items-center gap-3">
                <TakerCard player={nextOppTaker} color={oppClub.color} color2={oppClub.secondaryColor} selected={false} used={false} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {nextOppTaker.lastName || nextOppTaker.firstName} steps up…
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {keeper ? `${keeper.lastName || keeper.firstName} guards your goal.` : 'Your keeper sets himself.'}
                  </p>
                </div>
                <motion.div
                  className="ml-auto w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                />
              </div>
            </GlassPanel>
          </motion.div>
        )}

        {stage === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          >
            <GlassPanel className={cn('p-4 text-center space-y-2', playerWon ? 'border-primary/60' : 'border-red-500/40')}>
              <p className={cn(
                'font-display font-black italic text-2xl tracking-wide',
                playerWon ? 'text-primary [text-shadow:0_0_28px_hsl(43_96%_46%/0.7)]' : 'text-red-300',
              )}>
                {playerWon ? 'SHOOTOUT WON!' : 'HEARTBREAK FROM THE SPOT'}
              </p>
              <p className="text-xs text-muted-foreground">
                {myClub.shortName} {myTotal} – {oppTotal} {oppClub.shortName} on penalties
              </p>
              <Button className="w-full h-12 text-base font-bold" onClick={() => { hapticMedium(); skipAll(); }}>
                Continue
              </Button>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kick tracker */}
      <GlassPanel className="p-3">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1.5">
          {rounds.map(r => (
            <div key={r.round} className="contents">
              <div className="flex items-center gap-1.5 min-w-0 justify-end">
                <span className="text-[10px] text-foreground/85 truncate">{r.home?.takerName ?? ''}</span>
                <KickResultChip kick={r.home} />
              </div>
              <span className={cn(
                'text-[9px] tabular-nums w-6 text-center self-center rounded-full',
                r.round > 5 ? 'text-red-300 font-bold' : 'text-muted-foreground',
              )}>
                {r.round > 5 ? 'SD' : r.round}
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                <KickResultChip kick={r.away} />
                <span className="text-[10px] text-foreground/85 truncate">{r.away?.takerName ?? ''}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}
