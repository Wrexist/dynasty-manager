import { memo, useEffect, useRef, useState } from 'react';
import type { Player } from '@/types/game';
import { getPlayerCardArt } from '@/utils/uiHelpers';
import { PITCH_RENDER } from '@/config/pitchChoreography';
import type { PitchHitTarget } from './PitchCanvas';

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
}

/** The card's layout width (CSS px); the frame loop scales it to the zoom. */
const BASE_W = PITCH_RENDER.CARD_TOKEN_BASE_W;

export function PitchCardLayer({ hitTargetsRef, players, homeColor, awayColor, hiddenId }: PitchCardLayerProps) {
  const [ids, setIds] = useState<string[]>([]);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const hiddenRef = useRef(hiddenId);
  hiddenRef.current = hiddenId;

  useEffect(() => {
    let raf = 0;
    let key = '';
    const frame = () => {
      const targets = hitTargetsRef.current ?? [];
      // Who is on the pitch changes rarely (a sub, a red card): re-render the
      // card list only then; every other frame just moves the cards.
      const nextKey = targets.map(t => t.id).join('|');
      if (nextKey !== key) {
        key = nextKey;
        setIds(targets.map(t => t.id));
      }
      for (const t of targets) {
        const el = nodes.current.get(t.id);
        if (!el) continue;
        // r tracks the chip radius at the current zoom; the card stands on the
        // player's spot (bottom edge just above it, so his base and the ball at
        // his feet stay visible).
        const s = (t.r * PITCH_RENDER.CARD_TOKEN_R_SCALE) / BASE_W;
        const h = BASE_W * 1.5 * s;
        el.style.transform = `translate3d(${t.x - (BASE_W * s) / 2}px, ${t.y - h - t.r * 0.18}px, 0) scale(${s})`;
        el.style.zIndex = String(Math.round(t.y));
        el.style.opacity = t.id === hiddenRef.current ? '0' : '1';
        const lit = t.highlighted ? '1' : '0';
        if (el.dataset.lit !== lit) el.dataset.lit = lit;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [hitTargetsRef]);

  if (!players) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden="true">
      {ids.map(id => {
        const p = players[id];
        if (!p) return null;
        const home = hitTargetsRef.current?.find(t => t.id === id)?.team !== 'away';
        return (
          <PitchCard
            key={id}
            player={p}
            kit={(home ? homeColor : awayColor) || '#888888'}
            nodeRef={(el) => { if (el) nodes.current.set(id, el); else nodes.current.delete(id); }}
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

/** One standee: the player's card art, his rating and position, and a band in
 *  his kit so the two sides read apart (the art is by tier, not by club). A
 *  spotlit player (on the ball, the scorer) glows gold. Memoised: the frame
 *  loop moves it by transform and never re-renders it. */
const PitchCard = memo(function PitchCard({ player, kit, nodeRef }: PitchCardProps) {
  const art = getPlayerCardArt(player.overall, {
    ballonDorTop10: typeof player.ballonDOrTop10HoldSeason === 'number',
    packFrame: player.packFrame,
  });
  return (
    <div
      ref={nodeRef}
      className="absolute left-0 top-0 origin-top-left opacity-0 transition-[opacity,filter] duration-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)] data-[lit=1]:drop-shadow-[0_0_7px_rgba(245,185,21,0.95)]"
      style={{ width: BASE_W, height: BASE_W * 1.5, willChange: 'transform', ['--kit' as string]: kit }}
    >
      <img
        src={art.src}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
        style={art.filter ? { filter: art.filter } : undefined}
      />
      {/* type-floor: graphic — a scaled pitch token, drawn like the chips' glyphs */}
      <div className="absolute left-[16%] top-[15%] flex flex-col items-center leading-none text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
        <span className="font-display text-base font-black tabular-nums">{player.overall}</span>
        <span className="mt-0.5 text-micro font-bold uppercase">{player.position}</span>
      </div>
      <div className="absolute bottom-[10%] left-[24%] right-[24%] h-[7%] rounded-full" style={{ backgroundColor: kit, boxShadow: '0 0 0 1px rgba(0,0,0,0.45)' }} />
    </div>
  );
});
