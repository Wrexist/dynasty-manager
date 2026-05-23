import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackOpeningOverlay } from '@/components/game/pack/PackOpeningOverlay';
import { generatePlayer } from '@/utils/playerGen';
import type { Player, Position } from '@/types/game';

/**
 * Cinematic Capture — a hidden marketing-only route that loops the highest-
 * emotion pack-opening animation with synthetic data, framed for 9:16
 * screen recording on a real iPhone.
 *
 * Output use case: paste the captured footage into `marketing/scripts/*`
 * ad concepts via the ffmpeg pipeline at `marketing/postproduction/build-ad.sh`.
 *
 * Why a separate route instead of an in-game overlay:
 *   - No game chrome (status bar, bottom nav) intrudes into the recording.
 *   - Synthetic data means we never leak the user's real save into an ad.
 *   - Looping is automatic so the user can record 60+ seconds in one take
 *     and pick the best 8-second walkout in post.
 *
 * This page mounts the existing `PackOpeningOverlay` component verbatim —
 * the same one that fires during real pack opens — so the captured footage
 * is byte-identical to what a real player sees in the App Store screenshots.
 */

// 5 cards per Rare-Gold/Icon pack. The lead position rotates each loop so
// captures don't all look the same — variety helps when picking the
// best take in post.
const LEAD_POSITION_ROTATION: Position[] = ['ST', 'CAM', 'CM', 'CB', 'GK'];

function buildLegendaryPack(seed: number): Player[] {
  // Quality 92 on the lead card guarantees an 88+ overall → walkout reveal.
  // The other four are 78-86 for a believable Rare-Gold supporting cast.
  const lead = LEAD_POSITION_ROTATION[seed % LEAD_POSITION_ROTATION.length];
  const otherPositions: Position[] = ['CDM', 'LW', 'RW', 'CB'];
  return [
    generatePlayer(lead, 92, 'cinematic', 1, '1'),
    ...otherPositions.map((pos) => generatePlayer(pos, 78 + Math.floor(Math.random() * 8), 'cinematic', 1, '1')),
  ];
}

const CinematicCapturePage = () => {
  const navigate = useNavigate();
  const [loopIndex, setLoopIndex] = useState(0);
  const [overlayKey, setOverlayKey] = useState(0);

  // Rebuild the pack contents whenever the loop iterates — each iteration
  // is a fresh PackOpeningOverlay instance (`key` change forces remount and
  // restarts the phase chain from `loading`).
  const players = useMemo(() => buildLegendaryPack(loopIndex), [loopIndex]);

  const handleClose = useCallback(() => {
    // Tiny pause between loops so post-edit beat boundaries land cleanly
    // when chopping the recording into ad clips.
    window.setTimeout(() => {
      setLoopIndex((i) => i + 1);
      setOverlayKey((k) => k + 1);
    }, 500);
  }, []);

  // Keep playing — handlers stubbed to no-op so the overlay's "Keep" / "Sell"
  // buttons don't crash; we don't write any state for a cinematic loop.
  const noop = useCallback(() => { /* cinematic loop — no state mutation */ }, []);

  useEffect(() => {
    // Force dark background so screen recording doesn't pick up any
    // bleed-through if the overlay portal isn't fully covering the page.
    const prev = document.body.style.background;
    document.body.style.background = 'black';
    return () => { document.body.style.background = prev; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <PackOpeningOverlay
        key={overlayKey}
        tier="rare"
        players={players}
        onClose={handleClose}
        onKeep={noop}
        onQuickSell={noop}
        onKeepAll={noop}
        onSellAll={noop}
      />

      {/* Exit chip — portal-style fixed position above the overlay's z-stack.
          Subtle so it's easy to crop out of the final ad in post; the
          overlay portal uses z-[60ish] in the app so 9999 sits clearly above. */}
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label="Exit cinematic capture"
        className="fixed top-3 left-3 z-[9999] rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-3 py-1.5 text-[11px] tracking-widest uppercase text-white/70 hover:text-white"
        style={{ fontFamily: 'monospace' }}
      >
        Exit · Loop {loopIndex + 1}
      </button>
    </div>
  );
};

export default CinematicCapturePage;
