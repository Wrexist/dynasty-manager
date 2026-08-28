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
import { IncomingOfferNegotiation } from '@/components/game/IncomingOfferNegotiation';
import { pickRealPlayerForPack } from '@/utils/realPlayerPicker';
import { buildPlayerFromTemplate } from '@/utils/playerGen';
import type { Club, IncomingOffer } from '@/types/game';
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
  const attempt = (url: string, triesLeft: number): Promise<void> => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve();
    // The CDN resets transiently through some proxies; one blank flag ruins a
    // take, so a failed load retries a couple of times before giving up.
    img.onerror = () => (triesLeft > 0
      ? setTimeout(() => attempt(url, triesLeft - 1).then(resolve), 700)
      : resolve());
    // Same clean URL every attempt — FlagIcon will request exactly this URL,
    // so a cache-busted variant would warm the wrong cache entry. Chromium
    // does not cache network errors, so a plain retry is safe.
    img.src = url;
  });
  // Overall deadline: a reset against the proxied CDN can take seconds per
  // attempt, and a scene must never hang behind its flags — after 6s the
  // scene mounts with whatever loaded and FlagIcon's own retry handles the
  // stragglers.
  const all = Promise.all(urls.map(u => attempt(u, 3))).then(() => undefined);
  return Promise.race([all, new Promise<void>(r => setTimeout(r, 6000))]);
}

const params = new URLSearchParams(location.search);
/** Which capture scene to mount: `pack` (the store overlay) or `transfer`
 *  (an incoming-offer negotiation frozen mid-drama, for POV text-wall ads). */
const SCENE = params.get('scene') || 'pack';
/** POV text wall — the BitLife-style meme caption. Newlines via `|`. */
const POV = params.get('pov') || '';
/** Where the POV wall sits: `top` (default) or `low` — the lower third, for
 *  scenes whose upper half carries the visual (card, name, bid rows). */
const POV_POS = params.get('povPos') || 'top';
/** Slow push-in on the whole scene. A frozen-moment shot with zero repaints
 *  gives the screencast ~3 frames — technically honest, visibly a JPEG. A
 *  12s scale from 1.0 to 1.06 keeps the compositor painting and reads as
 *  cinematic tension rather than a still. */
const KENBURNS = params.get('kenburns') === '1';
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

/** BitLife-style POV wall: heavy white type, hard shadow, reads as a meme
 *  rather than brand chrome. Sits in the caption safe band. */
function PovWall({ text }: { text: string }) {
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-[200] px-6 py-6 ${POV_POS === 'low' ? 'bottom-[13%]' : 'top-[10%]'}`}
      style={{
        // Same feathered scrim as the ad captions — the wall sits over live
        // UI, and unscrimmed white type over a light card loses.
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 18%, rgba(0,0,0,0.78) 82%, rgba(0,0,0,0) 100%)',
      }}
    >
      <p
        className="text-center font-sans font-extrabold leading-[1.22] text-white whitespace-pre-line"
        style={{
          fontSize: 'clamp(20px, 5.6vw, 30px)',
          textShadow: '0 2px 0 rgba(0,0,0,0.9), 0 4px 18px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
        }}
      >
        {text.split('|').join('\n')}
      </p>
    </div>
  );
}

/**
 * Incoming-offer drama, mounted directly with crafted store state.
 *
 * The negotiation modal reads players/clubs/playerClubId/incomingOffers from
 * the store and nothing else persistent, so the scene sets exactly those keys
 * and mounts the REAL component — the footage cannot drift from the app. The
 * star is a real pool player (never invented; same realOnly contract as the
 * pack scene) and the bid lands above his market value, which is what makes
 * the frozen moment tense.
 */
function TransferScene() {
  const [offer, setOffer] = useState<IncomingOffer | null>(null);
  useEffect(() => {
    loadNationalPool().then(() => {
      // A young star, or the drama breaks: an ageing striker's market value
      // sits far below any headline bid (the first take starred a 33-year-old
      // valued at £21M against a £150M offer — "+615% above value" reads as a
      // fake screenshot). Under ~28, the bid lands 50-80% over value, which
      // is exactly the range that makes rejecting it feel insane.
      let t = null;
      for (let i = 0; i < 40; i++) {
        const c = pickRealPlayerForPack('ST', 89, 91) ?? pickRealPlayerForPack('ST', 86, 91);
        if (c && c.age <= 28) { t = c; break; }
        if (c && !t) t = c;
      }
      if (!t) { console.error('[capture] no real star available for transfer scene'); return; }
      const star = buildPlayerFromTemplate(t, 'my-club', 1);
      const mkClub = (id: string, name: string): Club => ({
        id, name, budget: 200_000_000, wageBill: 2_000_000,
        playerIds: [star.id], lineup: [], subs: [],
      } as unknown as Club);
      const o: IncomingOffer = { id: 'capture-offer', playerId: star.id, buyerClubId: 'buyer', fee: 150_000_000, week: 8 };
      useGameStore.setState({
        players: { [star.id]: star },
        clubs: { 'my-club': mkClub('my-club', 'Your Club'), buyer: mkClub('buyer', 'Real Madrid') },
        playerClubId: 'my-club',
        incomingOffers: [o],
        season: 1, week: 8, totalWeeks: 38,
      } as never);
      // Card art is same-origin but ~0.5MB; a frame shot before it decodes
      // shows a blank grey card. Warm the tier shields alongside the flags.
      for (const src of ['/player-cards/icon.webp', '/player-cards/legend.webp', '/player-cards/gold.webp']) {
        const img = new Image(); img.src = src;
      }
      preloadFlags([star]).then(() => setOffer(o));
    });
  }, []);
  if (!offer) return null;
  return <IncomingOfferNegotiation offer={offer} onClose={() => {}} />;
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
if (KENBURNS) {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes __capturePush { from { transform: scale(1); } to { transform: scale(1.06); } }
    #root { animation: __capturePush 12s linear forwards; transform-origin: 50% 42%; }
  `;
  document.head.appendChild(style);
}
createRoot(document.getElementById('root')!).render(
  <>
    {SCENE === 'transfer' ? <TransferScene /> : <Harness />}
    {POV && <PovWall text={POV} />}
  </>,
);
