/** Marketing ad-capture harness — the page `capture.html` mounts.
 *
 *  NOT part of the shipped app: nothing imports it, and Vite's build input is
 *  `index.html` only, so it never reaches a bundle. It exists so ad footage is
 *  regenerated from the real components rather than hand-recorded, and so it
 *  cannot drift from what the app actually does.
 *
 *  Renders the real PackOpeningOverlay with a Hall of Legends pull, plus a
 *  caption layer burned into the frames (the container's ffmpeg build has no
 *  drawtext filter, and doing captions in the DOM keeps them in the app's own
 *  type and palette anyway).
 */
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import '@/index.css';
import { PackOpeningOverlay } from '@/components/game/pack/PackOpeningOverlay';
import { generatePackContents } from '@/utils/packGeneration';
import { useGameStore } from '@/store/gameStore';
import type { Player } from '@/types/game';

const params = new URLSearchParams(location.search);
const TIER = (params.get('tier') || 'rare') as 'rare' | 'icon' | 'premium';
const LEGEND = params.get('legend') !== '0';
const HOOK = params.get('hook') || '';
const MID = params.get('mid') || '';
const CTA = params.get('cta') || '';
/** Page-time seconds. Captions are keyed to the clock the capture rig slows,
 *  so they stay in sync with the animation no matter the dilation factor. */
const HOOK_UNTIL = Number(params.get('hookUntil') || 3.4);
const MID_FROM = Number(params.get('midFrom') || 6.5);
const MID_UNTIL = Number(params.get('midUntil') || 9.5);
const CTA_FROM = Number(params.get('ctaFrom') || 13);

function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => { setT((performance.now() - start) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

function Caption({ text, position }: { text: string; position: 'top' | 'bottom' }) {
  return (
    <div
      // Safe band, not the frame edge. Two things eat the edges: the 9:19.5
      // capture is centre-cropped to 9:16, and TikTok's own chrome (username,
      // caption, action rail) covers roughly the bottom fifth and right edge.
      // A hook clipped by either is a dead ad.
      className={`pointer-events-none fixed inset-x-0 z-[200] px-7 ${position === 'top' ? 'top-[20%]' : 'bottom-[26%]'}`}
    >
      <p
        className="text-center font-display font-black uppercase leading-[1.05] tracking-tight text-white"
        style={{
          fontSize: 'clamp(26px, 8.2vw, 42px)',
          textShadow: '0 4px 22px rgba(0,0,0,0.92), 0 1px 3px rgba(0,0,0,1)',
        }}
      >
        {text}
      </p>
    </div>
  );
}

function Harness() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const t = useClock();
  useEffect(() => {
    const pack = generatePackContents(TIER, 5, { forceLegendRoll: LEGEND });
    const legend = pack.filter(p => p.legendId);
    // Ascending so the reveal builds instead of peaking early; the hall card
    // is appended last and is the closing beat.
    const rest = pack.filter(p => !p.legendId).sort((a, b) => a.overall - b.overall);
    setPlayers([...rest, ...legend]);
  }, []);
  if (!players) return null;
  return (
    <>
      <PackOpeningOverlay tier={TIER} players={players} onClose={() => {}} onKeepAll={() => {}} onSellAll={() => {}} />
      {HOOK && t < HOOK_UNTIL && <Caption text={HOOK} position="top" />}
      {MID && t >= MID_FROM && t < MID_UNTIL && <Caption text={MID} position="top" />}
      {CTA && t >= CTA_FROM && <Caption text={CTA} position="bottom" />}
    </>
  );
}

useGameStore.setState({ retiredLegends: [] });
createRoot(document.getElementById('root')!).render(<Harness />);
