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
import { getFlagUrl } from '@/utils/nationality';
import { loadNationalPool } from '@/data/nationalPlayerPoolAccess';
import type { Player } from '@/types/game';

/**
 * Flags are `loading="lazy"` + `decoding="async"` and come from an external
 * CDN, so during a fast capture they had not decoded when frames were grabbed.
 * `FlagIcon` then fell back to an emoji flag, which headless Chromium has no
 * font for — every card in the first cut of these ads wore a blank box. Warm
 * every flag the pack needs and only mount the overlay once they have all
 * settled (or failed, which must not hang the capture).
 */
function preloadFlags(players: Player[]): Promise<void> {
  const urls = [...new Set(players.map(p => getFlagUrl(p.nationality, 160)).filter(Boolean))];
  return Promise.all(urls.map(url => new Promise<void>(resolve => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  }))).then(() => undefined);
}

const params = new URLSearchParams(location.search);
const TIER = (params.get('tier') || 'rare') as 'rare' | 'icon' | 'premium';
const LEGEND = params.get('legend') === '1';
/** Minimum OVR for the card that closes the reveal. The hero has to be a name
 *  the viewer recognises, so the capture re-rolls until the pack deals one. */
const MIN_HERO = Number(params.get('minHero') || 0);
/** Reject any pack containing an invented player. `rollPackPlayer` falls back
 *  to a generated card when a band has no real player at the rolled position —
 *  correct in the game, wrong in an ad whose whole claim is "these are real
 *  players from FC27". A made-up name on screen contradicts the hook. */
const REAL_ONLY = params.get('realOnly') !== '0';
const HOOK = params.get('hook') || '';
const MID = params.get('mid') || '';
const CTA = params.get('cta') || '';
/** Page-time seconds. Captions are keyed to the clock the capture rig slows,
 *  so they stay in sync with the animation no matter the dilation factor. */
const HOOK_UNTIL = Number(params.get('hookUntil') || 3.4);
const MID_FROM = Number(params.get('midFrom') || 6.5);
const MID_UNTIL = Number(params.get('midUntil') || 9.5);
const CTA_FROM = Number(params.get('ctaFrom') || 13);

/**
 * Caption clock, zeroed by the capture rig rather than by mount.
 *
 * It used to start when the component mounted, which is a second or more
 * before the rig starts recording and taps the packet — so every caption
 * fired early relative to the footage and the closing CTA landed on top of
 * the card grid instead of the summary. The rig calls `window.__adClockStart`
 * at the moment it begins the take; until it does, the clock reads 0.
 */
function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    (window as unknown as { __adClockStart?: () => void }).__adClockStart = () => {
      start = performance.now();
    };
    let raf = 0;
    const tick = () => {
      setT(start === null ? 0 : (performance.now() - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
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
      className={`pointer-events-none fixed inset-x-0 z-[200] px-7 py-5 ${position === 'top' ? 'top-[18%]' : 'bottom-[12%]'}`}
      style={{
        // A scrim, because a caption sitting over the card grid was competing
        // with gold artwork and losing. Feathered rather than a hard band so
        // it reads as lighting, not as a text box.
        background: position === 'top'
          ? 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 22%, rgba(0,0,0,0.72) 78%, rgba(0,0,0,0) 100%)'
          : 'linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 22%, rgba(0,0,0,0.78) 78%, rgba(0,0,0,0) 100%)',
      }}
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
    // The real-player pool is lazily imported, and `pickRealPlayerForPack`
    // silently falls back to an INVENTED player when it is not loaded. The
    // app awaits it during init; a bare harness does not, so every ad shot
    // before this was a grid of procedurally generated names that merely
    // looked real. Load it first — the whole claim of these ads is that
    // these are FC27's actual players.
    let cancelled = false;
    loadNationalPool().then(() => {
      if (cancelled) return;
      build();
    });
    return () => { cancelled = true; };
  }, []);

  function build() {
    // Re-roll until the pack produces a hero worth headlining. Cheap (pure
    // generation, no store) and bounded, so a thin band cannot hang the run.
    const acceptable = (cards: Player[]) =>
      Math.max(...cards.map(p => p.overall)) >= MIN_HERO
      && (!REAL_ONLY || cards.every(p => p.source === 'real' || p.legendId));
    let pack = generatePackContents(TIER, 5, { forceLegendRoll: LEGEND });
    for (let i = 0; i < 400 && !acceptable(pack); i++) {
      pack = generatePackContents(TIER, 5, { forceLegendRoll: LEGEND });
    }
    if (!acceptable(pack)) {
      // Loud rather than silent: shipping an ad full of invented names because
      // the band was thin is worse than a failed capture.
      console.error(
        `[capture] could not satisfy minHero=${MIN_HERO} realOnly=${REAL_ONLY} for tier ${TIER};`
        + ` best hero was ${Math.max(...pack.map(p => p.overall))},`
        + ` sources: ${pack.map(p => p.source ?? 'generated').join(',')}`);
    }
    // Ascending so the reveal builds instead of peaking early — the best card
    // is appended last and is the closing beat. A legend, when one is rolled,
    // outranks OVR for that slot.
    const ordered = [...pack].sort((a, b) =>
      (a.legendId ? 1 : 0) - (b.legendId ? 1 : 0) || a.overall - b.overall);
    preloadFlags(ordered).then(() => setPlayers(ordered));
  }
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
