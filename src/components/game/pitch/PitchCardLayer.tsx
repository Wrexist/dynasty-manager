import { memo, useEffect, useRef, useState } from 'react';
import type { Player } from '@/types/game';
import { PlayerPortrait } from '@/components/game/PlayerPortrait';
import { getPlayerCardArt } from '@/utils/uiHelpers';
import { getPlayerDisplayName } from '@/utils/playerDisplay';
import { getPlayerPortrait } from '@/utils/playerPortrait';
import { PITCH_RENDER } from '@/config/pitchChoreography';
import type { PitchHitTarget } from './PitchCanvas';
import { pitchCardBox } from './pitchGeometry';

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
const LABEL_H = PITCH_RENDER.CARD_TOKEN_LABEL_H;

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
        // r tracks the chip radius at the current zoom; the card and its name
        // stand on the player's spot (the label's bottom edge just above it,
        // so his base and the ball at his feet stay visible).
        const b = pitchCardBox(t);
        el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) scale(${b.scale})`;
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
        {portrait && <PlayerPortrait key={portrait.src} src={portrait.src} chip={false} frame={art.src} />}
        {/* type-floor: graphic — a scaled pitch token, drawn like the chips' glyphs */}
        <div className="absolute left-[15%] top-[14%] flex flex-col items-center leading-none text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
          <span className="font-display text-base font-black tabular-nums">{player.overall}</span>
          <span className="mt-0.5 text-micro font-bold uppercase">{player.position}</span>
        </div>
      </div>
      {/* The name, under the card. Wider than the card if it must be — a
          name is worth more than the gap between two cards. */}
      {/* type-floor: graphic — scaled with the token */}
      <div
        className="absolute bottom-0 left-1/2 flex max-w-[88px] -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-[3px] bg-black/75 px-1 text-micro font-bold uppercase leading-none text-white"
        style={{ height: LABEL_H - 1, boxShadow: `inset 0 -2px 0 ${kit}` }}
      >
        <span className="truncate">{getPlayerDisplayName(player)}</span>
      </div>
    </div>
  );
});
