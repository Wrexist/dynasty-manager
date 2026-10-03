import { memo, useEffect, useRef, useState } from 'react';
import type { Player } from '@/types/game';
import { PlayerPortrait } from '@/components/game/PlayerPortrait';
import { getPlayerCardArt } from '@/utils/uiHelpers';
import { getPlayerDisplayName } from '@/utils/playerDisplay';
import { getPlayerPortrait } from '@/utils/playerPortrait';
import { PITCH_RENDER } from '@/config/pitchChoreography';
import type { PitchBallScreen, PitchHitTarget } from './PitchCanvas';
import { declutterLabels, pitchCardBox, type PitchLabel } from './pitchGeometry';
import { drawFootball, identityOrientation, liftScale } from './pitchBall';

// Cards mode for the live pitch: a player card stands on every player's spot.
//
// The renderers (Canvas and WebGL alike) keep doing the football — they draw
// the turf, the ball and each player's planted base, and publish every player's
// screen position each frame (`hitTargetsRef`, the same list tap-to-inspect
// uses). This layer only reads that list and moves one DOM card per player by
// transform, so the cards are the game's real card art (tier shield, pack frame,
// Ballon d'Or) on either renderer, and nothing here can drift from the play.

interface PitchCardLayerProps {
  hitTargetsRef: React.MutableRefObject<PitchHitTarget[] | null>;
  players: Record<string, Player> | undefined;
  homeColor: string;
  awayColor: string;
  /** A card not to draw — the scorer's, while his celebration card is out. */
  hiddenId?: string | null;
  /** The ball's published screen position: drawn ABOVE every card, so a
   *  card standing near it can never hide it. */
  ballRef?: React.MutableRefObject<PitchBallScreen | null>;
}

/** The card's layout width (CSS px); the frame loop scales it to the zoom. */
const BASE_W = PITCH_RENDER.CARD_TOKEN_BASE_W;
const LABEL_H = PITCH_RENDER.CARD_TOKEN_LABEL_H;
const IDENTITY = identityOrientation();

export function PitchCardLayer({ hitTargetsRef, players, homeColor, awayColor, hiddenId, ballRef }: PitchCardLayerProps) {
  const [ids, setIds] = useState<string[]>([]);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const hiddenRef = useRef(hiddenId);
  hiddenRef.current = hiddenId;
  const ballEl = useRef<HTMLCanvasElement>(null);
  const ballRefRef = useRef(ballRef);
  ballRefRef.current = ballRef;
  // One stable ref callback per player: an inline arrow is a new prop every
  // render, which defeated PitchCard's memo and re-attached all 22 refs each
  // time the parent re-rendered (every match minute).
  const refCallbacks = useRef(new Map<string, (el: HTMLDivElement | null) => void>());
  const refFor = (id: string) => {
    let cb = refCallbacks.current.get(id);
    if (!cb) {
      cb = (el) => { if (el) nodes.current.set(id, el); else nodes.current.delete(id); };
      refCallbacks.current.set(id, cb);
    }
    return cb;
  };

  useEffect(() => {
    let raf = 0;
    let key = '';
    let shown = new Set<string>();
    // Label widths in layout px (unaffected by the transform), measured once —
    // and again once the web font has loaded, or a first measure taken in the
    // fallback font would undercount every name.
    const labelW = new Map<string, number>();
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) labelW.clear(); });
    const frame = () => {
      const targets = hitTargetsRef.current ?? [];
      // Who is on the pitch changes rarely (a sub, a red card): re-render the
      // card list only then; every other frame just moves the cards.
      const nextKey = targets.map(t => t.id).join('|');
      if (nextKey !== key) {
        key = nextKey;
        setIds(targets.map(t => t.id));
      }
      const labels: PitchLabel[] = [];
      for (const t of targets) {
        const el = nodes.current.get(t.id);
        if (!el) continue;
        // r tracks the chip radius at the current zoom; the card and its name
        // stand on the player's spot (the label's bottom edge just above it,
        // so his base and the ball at his feet stay visible).
        const b = pitchCardBox(t);
        el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) scale(${b.scale})`;
        el.style.zIndex = String(Math.round(t.y));
        el.style.opacity = t.id === hiddenRef.current ? '0' : '1';
        const lit = t.highlighted ? '1' : '0';
        if (el.dataset.lit !== lit) el.dataset.lit = lit;
        if (t.id === hiddenRef.current) continue;
        let w = labelW.get(t.id);
        if (w == null) {
          w = (el.querySelector('[data-name]') as HTMLElement | null)?.offsetWidth || BASE_W;
          labelW.set(t.id, w);
        }
        labels.push({
          id: t.id, lit: t.highlighted,
          cx: t.x, bottom: b.y + (BASE_W * 1.5 + LABEL_H) * b.scale,
          w: w * b.scale, h: LABEL_H * b.scale,
        });
      }
      // The ball, above every card.
      const b = ballRefRef.current?.current;
      const bEl = ballEl.current;
      if (bEl) {
        if (b) {
          // Same football as the renderer, same orientation: drawn on a small
          // canvas with room for its halo, above every card.
          const rr = b.r * liftScale(b.lift, b.r);
          const pad = rr * PITCH_RENDER.BALL_HALO_R;
          const dpr = Math.min(window.devicePixelRatio || 1, 3);
          const px = Math.ceil(pad * 2 * dpr);
          if (bEl.width !== px) { bEl.width = px; bEl.height = px; }
          bEl.style.width = `${pad * 2}px`;
          bEl.style.height = `${pad * 2}px`;
          bEl.style.transform = `translate3d(${b.x - pad}px, ${b.y - b.lift - pad}px, 0)`;
          bEl.style.opacity = '1';
          const ctx = bEl.getContext?.('2d');
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, pad * 2, pad * 2);
            const halo = ctx.createRadialGradient(pad, pad, rr * 0.6, pad, pad, pad);
            halo.addColorStop(0, `rgba(255,255,255,${PITCH_RENDER.BALL_HALO_ALPHA})`);
            halo.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = halo;
            ctx.fillRect(0, 0, pad * 2, pad * 2);
            drawFootball(ctx, pad, pad, rr, b.o ?? IDENTITY);
          }
        } else bEl.style.opacity = '0';
      }
      // Bunched players: one readable name beats three overprinted ones.
      const hide = declutterLabels(labels, shown);
      shown = new Set(labels.filter(l => !hide.has(l.id)).map(l => l.id));
      for (const l of labels) {
        const name = nodes.current.get(l.id)?.querySelector('[data-name]') as HTMLElement | null;
        if (!name) continue;
        const v = hide.has(l.id) ? '0' : '1';
        if (name.dataset.show !== v) name.dataset.show = v;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [hitTargetsRef]);

  if (!players) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden="true">
      {/* The ball, above every card: the renderer's football, rolling. */}
      <canvas
        ref={ballEl}
        data-testid="pitch-ball"
        className="absolute left-0 top-0 opacity-0"
        style={{ zIndex: 100000, willChange: 'transform' }}
      />
      {ids.map(id => {
        const p = players[id];
        if (!p) return null;
        const home = hitTargetsRef.current?.find(t => t.id === id)?.team !== 'away';
        return (
          <PitchCard
            key={id}
            player={p}
            kit={(home ? homeColor : awayColor) || '#888888'}
            nodeRef={refFor(id)}
          />
        );
      })}
    </div>
  );
}

interface PitchCardProps {
  player: Player;
  kit: string;
  nodeRef: (el: HTMLDivElement | null) => void;
}

/** One standee: the player's card (tier shield or pack frame, his portrait
 *  when the catalogue has one, his rating and position) with his name on a
 *  label under it, underlined in his kit so the two sides read apart (the art
 *  is by tier, not by club). A spotlit player (on the ball, the scorer) glows
 *  gold. Memoised: the frame loop moves it by transform and never re-renders it. */
const PitchCard = memo(function PitchCard({ player, kit, nodeRef }: PitchCardProps) {
  const art = getPlayerCardArt(player.overall, {
    ballonDorTop10: typeof player.ballonDOrTop10HoldSeason === 'number',
    packFrame: player.packFrame,
  });
  const portrait = getPlayerPortrait(player);
  return (
    <div
      ref={nodeRef}
      className="absolute left-0 top-0 origin-top-left opacity-0 transition-[opacity,filter] duration-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)] data-[lit=1]:drop-shadow-[0_0_7px_rgba(245,185,21,0.95)]"
      style={{ width: BASE_W, height: BASE_W * 1.5 + LABEL_H, willChange: 'transform' }}
    >
      <div className="absolute inset-x-0 top-0" style={{ height: BASE_W * 1.5 }}>
        <img
          src={art.src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
          style={art.filter ? { filter: art.filter } : undefined}
        />
        {portrait && <PlayerPortrait key={portrait.src} src={portrait.src} chip={false} frame={art.src} centered />}
        {/* type-floor: graphic — a scaled pitch token, drawn like the chips' glyphs */}
        {/* Rating and position side by side, under the face, so the face
            has the top of the card to itself. */}
        <div className="absolute inset-x-0 top-[63%] flex items-baseline justify-center gap-[3px] leading-none text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
          <span className="font-display text-sm font-black tabular-nums">{player.overall}</span>
          <span className="text-micro font-bold uppercase opacity-90">{player.position}</span>
        </div>
      </div>
      {/* The name, under the card. Wider than the card if it must be — a
          name is worth more than the gap between two cards. */}
      {/* type-floor: graphic — scaled with the token */}
      <div
        data-name
        className="absolute bottom-0 left-1/2 flex max-w-[88px] -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-[3px] bg-black/75 px-1 text-micro font-bold uppercase leading-none text-white transition-opacity duration-200 data-[show=0]:opacity-0"
        style={{ height: LABEL_H - 1, boxShadow: `inset 0 -2px 0 ${kit}` }}
      >
        <span className="truncate">{getPlayerDisplayName(player)}</span>
      </div>
    </div>
  );
});
