import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { PlayerCard, PLAYER_CARD_SIZE_PX } from '@/components/game/PlayerCard';
import { CardBack } from '@/components/game/pack/CardBack';
import { WalkoutReveal } from '@/components/game/pack/WalkoutReveal';
import { WalkoutStadium } from '@/components/game/pack/WalkoutStadium';
import { PackConfetti } from '@/components/game/pack/PackConfetti';
import { PremiumLaurel } from '@/components/game/icons/PremiumLaurel';
import { BALLON_DOR_CEREMONY } from '@/config/ui';

import { ceremonyOrder, revealStyleFor } from '@/utils/ballonDorCeremony';
import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';
import { playPackSfx } from '@/utils/packAudio';
import { cn } from '@/lib/utils';
import type { BallonDOrEntry, Player } from '@/types/game';

/** The Ballon d'Or card face every top-10 finisher wears. */
const BDO_ART = '/player-cards/ballondor.webp';
const GOLD = '#e8ad0c';

type Phase = 'intro' | 'deck' | 'drumroll' | 'walkout' | 'finale';

interface BallonDorCeremonyProps {
  season: number;
  ranking: BallonDOrEntry[];
  players: Record<string, Player>;
  /** The user's club short name — its finishers get a "Your player" glow. */
  playerClubName: string;
  /** Watched to the end or skipped. The host marks the season seen. */
  onFinish: () => void;
  /** Leave the ceremony. `toRankings` asks the host to open the full page. */
  onClose: (toRankings: boolean) => void;
}

/** The card as it should read on the night: the season's rating and
 *  position (not today's), wearing the Ballon d'Or face. */
function ceremonyPlayer(entry: BallonDOrEntry, players: Record<string, Player>, season: number): Player | null {
  const p = players[entry.playerId];
  if (!p) return null;
  return { ...p, overall: entry.overall, position: entry.position, ballonDOrTop10HoldSeason: season };
}

function cardWidth(): number {
  const h = typeof window === 'undefined' ? 844 : window.innerHeight;
  const w = typeof window === 'undefined' ? 390 : window.innerWidth;
  // Leaves room for the header, the rank, the name plate and the hint.
  return Math.round(Math.max(150, Math.min(230, (h - 400) / 1.5, w * 0.58)));
}

/** A finisher the save no longer holds (retired, or a world-elite ghost):
 *  the same silhouette and plate, drawn without the player card. */
function GhostFace({ entry }: { entry: BallonDOrEntry }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3"
      style={{ WebkitMaskImage: `url(${BDO_ART})`, maskImage: `url(${BDO_ART})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }}>
      <img src={BDO_ART} alt="" className="absolute inset-0 w-full h-full" draggable={false} />
      <div className="relative z-10">
        <p className="font-display font-black text-4xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{entry.overall}</p>
        <p className="font-display font-bold text-sm text-white/90">{entry.position}</p>
        <p className="mt-2 font-display font-black text-base text-white leading-tight">{entry.playerName}</p>
      </div>
    </div>
  );
}

/** One ceremony card: face-down on the Ballon d'Or back, turned on tap. */
function CeremonyCard({ entry, player, faceUp, width, podium, reduced }: {
  entry: BallonDOrEntry;
  player: Player | null;
  faceUp: boolean;
  width: number;
  podium: boolean;
  reduced: boolean;
}) {
  const flipMs = podium ? BALLON_DOR_CEREMONY.podiumFlipMs : BALLON_DOR_CEREMONY.flipMs;
  return (
    <div className="relative" style={{ width, aspectRatio: '2 / 3', perspective: 1400 }}>
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ rotateY: faceUp ? 180 : 0, scale: faceUp && !reduced ? [1, podium ? 1.1 : 1.05, 1] : 1 }}
        transition={reduced
          ? { duration: 0 }
          : { rotateY: { duration: flipMs / 1000, ease: [0.3, 1.25, 0.4, 1] }, scale: { duration: flipMs / 1000, times: [0, 0.45, 1] } }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
          <CardBack maskSrc={BDO_ART} revealed={faceUp} />
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          aria-hidden={!faceUp}
        >
          {/* Mounted only once turned: a face-down card must not carry the
              name in the DOM, where a screen reader (or a text search) would
              read it before the reveal. */}
          {faceUp && (player ? (
            <div style={{ transform: `scale(${width / PLAYER_CARD_SIZE_PX.xl})`, transformOrigin: 'center' }}>
              <PlayerCard player={player} size="xl" interactive="none" showConditionView={false} />
            </div>
          ) : (
            <GhostFace entry={entry} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Ballon d'Or Night — the season's top 10, dealt face-down and turned one at
 * a time from 10th to the winner. Ranks 10–4 flip fast; 3 and 2 slow down;
 * the winner gets the pack walkout (flag, position, rating, then the name).
 *
 * Presentation only: the ranking was fixed at season end and nothing here can
 * change it. Rendered through a portal, because both hosts (the Ballon d'Or
 * page and the season summary) sit inside animated — transformed — parents,
 * and a transformed ancestor would pin a `fixed` overlay to itself.
 */
export function BallonDorCeremony({ season, ranking, players, playerClubName, onFinish, onClose }: BallonDorCeremonyProps) {
  const { t } = useTranslation();
  const reduced = !!useReducedMotionPref();
  const order = useMemo(() => ceremonyOrder(ranking), [ranking]);
  const total = order.length;
  const [phase, setPhase] = useState<Phase>('intro');
  const [idx, setIdx] = useState(0);
  const [faceUp, setFaceUp] = useState(false);
  const cardW = useMemo(cardWidth, []);
  const finished = useRef(false);

  const current = order[idx];
  const style = current ? revealStyleFor(current.rank) : 'quick';
  const currentPlayer = current ? ceremonyPlayer(current, players, season) : null;
  const winner = order[total - 1];
  const winnerPlayer = winner ? ceremonyPlayer(winner, players, season) : null;
  const isYours = (e: BallonDOrEntry) => !!playerClubName && e.clubName === playerClubName;
  const yourCount = order.filter(isYours).length;
  const revealedCount = phase === 'finale' ? total : idx + (faceUp ? 1 : 0);

  const finish = useCallback(() => {
    setPhase('finale');
    if (!finished.current) { finished.current = true; onFinish(); }
  }, [onFinish]);

  // The held breath before the winner. JS-timed, so it asks reduced motion.
  useEffect(() => {
    if (phase !== 'drumroll') return;
    playPackSfx('charge');
    const ms = reduced ? 350 : BALLON_DOR_CEREMONY.drumrollMs;
    const id = window.setTimeout(() => {
      hapticHeavy();
      if (winnerPlayer) setPhase('walkout');
      else finish();
    }, ms);
    return () => window.clearTimeout(id);
  }, [phase, reduced, winnerPlayer, finish]);

  const advance = () => {
    if (phase === 'intro') { hapticLight(); setPhase('deck'); return; }
    if (phase !== 'deck' || !current) return;
    if (!faceUp) {
      if (style === 'winner') { hapticMedium(); setPhase('drumroll'); return; }
      setFaceUp(true);
      if (style === 'podium') { hapticHeavy(); playPackSfx('rare-pull'); }
      else { hapticMedium(); playPackSfx('standard-pull'); }
      return;
    }
    if (idx + 1 < total) { hapticLight(); setIdx(idx + 1); setFaceUp(false); }
  };

  if (total === 0 || typeof document === 'undefined') return null;

  const stageLit = phase === 'deck' && faceUp;
  const hint = phase === 'intro'
    ? t('ballonDor.night.tapToBegin')
    : phase === 'deck'
      ? (faceUp ? t('ballonDor.night.tapToContinue') : t('ballonDor.night.tapToReveal'))
      : '';

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[80] overflow-hidden bg-black text-white select-none"
      role="dialog"
      aria-modal="true"
      aria-label={t('ballonDor.night.title')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.35 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 80% 55% at 50% 48%, ${GOLD}2e 0%, rgba(4,4,8,0.92) 58%, #000 92%)` }}
      />
      {phase !== 'walkout' && <WalkoutStadium accent={GOLD} revealed={stageLit} legendary={style === 'podium' && stageLit} />}

      {/* ── Header: title, progress pips, skip ── */}
      {phase !== 'walkout' && (
        // Above the stadium rig (whose floodlights sit at the top edge), on its
        // own backing, so the title and Skip stay legible against the lights.
        <div className="absolute inset-x-0 top-0 z-40 pt-[max(env(safe-area-inset-top),12px)] pb-5 px-4 bg-gradient-to-b from-black via-black/90 to-transparent">
          <div className="max-w-lg mx-auto flex items-start justify-between gap-3">
            <div>
              <p className="text-micro uppercase tracking-[0.3em] text-gold/80 font-bold">{t('ballonDor.night.kicker', { season })}</p>
              <p className="font-display font-black text-lg leading-tight text-white">{t('ballonDor.night.title')}</p>
            </div>
            {phase !== 'finale' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); finish(); }}
                className="min-h-11 px-3 rounded-full text-micro uppercase tracking-[0.2em] font-semibold text-white/80 bg-white/[0.07] border border-white/20 active:scale-[0.96]"
              >
                {t('ballonDor.night.skipAll')}
              </button>
            )}
          </div>
          <div className="max-w-lg mx-auto mt-3 flex items-center gap-1.5" aria-label={t('ballonDor.night.progress', { revealed: revealedCount, total })}>
            {order.map((e, i) => {
              const shown = i < revealedCount;
              return (
                <div
                  key={e.playerId}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors duration-300',
                    shown ? (e.rank <= 3 ? 'bg-gold shadow-[0_0_8px_hsl(var(--gold)/0.8)]' : 'bg-gold/70') : 'bg-white/15',
                    shown && isYours(e) && 'ring-1 ring-primary',
                  )}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stage ── */}
      {(phase === 'intro' || phase === 'deck' || phase === 'drumroll') && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 pt-20 pb-24 cursor-pointer"
          onClick={advance}
          role="button"
          tabIndex={0}
          aria-label={hint || t('ballonDor.night.title')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); } }}
        >
          {phase === 'intro' ? (
            <motion.div
              className="text-center"
              initial={reduced ? false : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative mx-auto mb-6" style={{ width: cardW * 0.62, aspectRatio: '2 / 3' }}>
                <div className="absolute -inset-10 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(closest-side, ${GOLD}55, transparent)` }} />
                <CardBack maskSrc={BDO_ART} />
              </div>
              <div className="inline-flex items-center gap-2 mb-2">
                <PremiumLaurel className="w-3 h-[18px] scale-x-[-1]" />
                <p className="text-micro uppercase tracking-[0.34em] text-gold font-black">{t('ballonDor.night.kicker', { season })}</p>
                <PremiumLaurel className="w-3 h-[18px]" />
              </div>
              <h1 className="font-display font-black text-[40px] leading-none tracking-tight"
                style={{ backgroundImage: `linear-gradient(180deg, #fff3c4, ${GOLD} 55%, #8a5a00)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                {t('ballonDor.night.title')}
              </h1>
              <p className="mt-3 text-sm text-white/75 max-w-[280px] mx-auto">{t('ballonDor.night.subtitle')}</p>
            </motion.div>
          ) : current && (
            <>
              {/* Rank — the headline of every beat. */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={`rank-${current.rank}-${phase}`}
                  className={cn('font-display font-black leading-none tracking-tight mb-3',
                    style === 'quick' ? 'text-[44px] text-white' : 'text-[56px]')}
                  style={style === 'quick' ? undefined : { backgroundImage: `linear-gradient(180deg, #fff3c4, ${GOLD} 60%, #8a5a00)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
                  initial={reduced ? false : { opacity: 0, y: -10, scale: 1.2 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0, y: 8 }}
                  transition={{ duration: 0.35 }}
                >
                  {phase === 'drumroll' ? t('ballonDor.night.rank', { rank: 1 }) : t('ballonDor.night.rank', { rank: current.rank })}
                </motion.p>
              </AnimatePresence>

              {/* The card, dealt into the spotlight. */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`card-${current.playerId}`}
                  className="relative"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 80, rotate: -6, scale: 0.9 }}
                  animate={phase === 'drumroll' && !reduced
                    ? { opacity: 1, y: 0, rotate: 0, scale: [1, 1.04, 1] }
                    : { opacity: 1, y: 0, rotate: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, x: -140, rotate: -8, scale: 0.85 }}
                  transition={phase === 'drumroll' && !reduced
                    ? { scale: { duration: 0.6, repeat: Infinity }, default: { duration: 0.3 } }
                    : { duration: BALLON_DOR_CEREMONY.dealMs / 1000, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
                    style={{
                      top: -cardW * 0.3, width: cardW * 2, height: cardW * 2,
                      background: `radial-gradient(closest-side, ${GOLD}${faceUp || phase === 'drumroll' ? '66' : '33'}, transparent)`,
                    }} />
                  {isYours(current) && faceUp && (
                    <div className="absolute -inset-2 rounded-2xl ring-2 ring-primary/80 shadow-[0_0_24px_hsl(var(--primary)/0.6)] pointer-events-none" />
                  )}
                  <CeremonyCard
                    entry={current}
                    player={currentPlayer}
                    faceUp={faceUp}
                    width={cardW}
                    podium={style === 'podium'}
                    reduced={reduced}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Name plate — only once turned; fixed height so nothing jumps. */}
              <div className="mt-4 h-[92px] w-full max-w-sm text-center">
                <AnimatePresence mode="wait">
                  {phase === 'drumroll' ? (
                    <motion.p key="drum" className="font-display font-black text-xl text-gold"
                      initial={reduced ? false : { opacity: 0 }} animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.2, repeat: Infinity }}>
                      {t('ballonDor.night.drumroll')}
                    </motion.p>
                  ) : faceUp ? (
                    <motion.div key={`plate-${current.playerId}`}
                      initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: reduced ? 0 : (style === 'podium' ? 0.6 : 0.25) }}>
                      {isYours(current) && (
                        <span className="inline-block mb-1 px-2 py-0.5 rounded-full text-micro font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/40">
                          {t('ballonDor.night.yourPlayer')}
                        </span>
                      )}
                      <p className="font-display font-black text-2xl leading-tight text-white">{current.playerName}</p>
                      <div className="mt-1 flex items-center justify-center gap-2 text-[12px] text-white/70">
                        <span className="inline-block w-2 h-2 rounded-full ring-1 ring-white/20" style={{ backgroundColor: current.clubColor }} />
                        <span>{current.clubName}</span>
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">{current.goals} {t('ballonDor.goals')} · {current.assists} {t('ballonDor.assists')}</span>
                        {current.avgRating != null && (<><span aria-hidden>·</span><span className="tabular-nums">{current.avgRating.toFixed(1)}</span></>)}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </>
          )}

          {hint && (
            <motion.p
              className="absolute bottom-[max(env(safe-area-inset-bottom),20px)] inset-x-0 text-center text-micro uppercase tracking-[0.3em] text-white/60"
              animate={reduced ? { opacity: 0.7 } : { opacity: [0.35, 0.85, 0.35] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              {hint}
            </motion.p>
          )}
        </div>
      )}

      {stageLit && style === 'podium' && !reduced && <PackConfetti count={18} hueBase={44} hueRange={14} />}

      {/* ── The winner walks out ── */}
      {phase === 'walkout' && winnerPlayer && (
        <div className="absolute inset-0 z-30">
          <WalkoutReveal
            player={winnerPlayer}
            badgeLabel={t('ballonDor.night.winnerBadge')}
            hidePotential
            onComplete={finish}
            onAdvance={finish}
          />
        </div>
      )}

      {/* ── Finale: the crowned winner and the whole top 10 ── */}
      {phase === 'finale' && winner && (
        <motion.div
          className="absolute inset-0 z-20 overflow-y-auto pt-24 pb-[max(env(safe-area-inset-bottom),20px)] px-4"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="max-w-lg mx-auto text-center">
            <div className="relative mx-auto" style={{ width: cardW * 0.8, aspectRatio: '2 / 3' }}>
              <div className="absolute -inset-8 rounded-full pointer-events-none" style={{ background: `radial-gradient(closest-side, ${GOLD}55, transparent)` }} />
              {winnerPlayer ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div style={{ transform: `scale(${(cardW * 0.8) / PLAYER_CARD_SIZE_PX.xl})` }}>
                    <PlayerCard player={winnerPlayer} size="xl" interactive="none" showConditionView={false} />
                  </div>
                </div>
              ) : <GhostFace entry={winner} />}
            </div>
            <p className="mt-4 text-micro uppercase tracking-[0.3em] text-gold font-black">{t('ballonDor.night.crowned', { season })}</p>
            <p className="font-display font-black text-3xl leading-tight">{winner.playerName}</p>
            <p className="text-[12px] text-white/70">{winner.clubName} · {winner.goals} {t('ballonDor.goals')} · {winner.assists} {t('ballonDor.assists')}</p>
            {yourCount > 0 && (
              <p className="mt-2 text-[12px] font-bold text-primary">{t('ballonDor.night.yourPlayersNote', { count: yourCount })}</p>
            )}

            <div className="mt-5 space-y-1.5 text-left">
              {[...order].reverse().map(e => (
                <div key={e.playerId}
                  className={cn('flex items-center gap-3 px-3 py-2 rounded-xl border',
                    e.rank === 1 ? 'bg-gold/15 border-gold/40' : e.rank <= 3 ? 'bg-white/[0.06] border-white/15' : 'bg-white/[0.03] border-white/10',
                    isYours(e) && 'ring-1 ring-primary/60')}>
                  <span className={cn('w-7 text-center font-display font-black tabular-nums', e.rank === 1 ? 'text-gold' : 'text-white/80')}>{e.rank}</span>
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.clubColor }} />
                  <span className="flex-1 min-w-0 truncate text-sm font-bold">{e.playerName}</span>
                  <span className="text-micro text-white/60 shrink-0">{e.clubName}</span>
                  <span className="text-sm font-black tabular-nums text-gold/90 shrink-0">{e.score.toFixed(1)}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onClose(true)}
                className="min-h-11 rounded-xl border border-gold/40 bg-gold/10 text-gold text-sm font-bold active:scale-[0.98]">
                {t('ballonDor.night.seeRankings')}
              </button>
              <button type="button" onClick={() => onClose(false)}
                className="min-h-11 rounded-xl bg-gold text-black text-sm font-black active:scale-[0.98]">
                {t('ballonDor.night.done')}
              </button>
            </div>
          </div>
          {!reduced && <PackConfetti count={30} hueBase={46} hueRange={18} />}
        </motion.div>
      )}
    </motion.div>,
    document.body,
  );
}
