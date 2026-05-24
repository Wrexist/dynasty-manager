import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackOpeningOverlay } from '@/components/game/pack/PackOpeningOverlay';
import { CelebrationModal } from '@/components/game/CelebrationModal';
import { generatePlayer } from '@/utils/playerGen';
import type { Player, Position } from '@/types/game';

/**
 * Cinematic Capture — hidden marketing-only route that cycles through the
 * highest-emotion in-app moments with synthetic data, framed for 9:16
 * screen recording on a real iPhone.
 *
 * Captured footage feeds the ad scripts in `marketing/scripts/*` via the
 * ffmpeg pipeline at `marketing/postproduction/build-ad.sh`.
 *
 * Why a varied cycle (not a single repeating beat): one 60-second screen
 * recording produces 3+ distinct money-shots to cut into separate ads —
 * a pack walkout for one creative, a trophy celebration for another,
 * a wonderkid signing for a third. No re-recording between concepts.
 *
 * Beat sequence (~25s total per loop):
 *   1. Pack walkout — Rare-Gold tier with synthetic legendary lead    (~14s)
 *   2. Trophy celebration — gold confetti + stats grid                 (~5s)
 *   3. Wonderkid signing — celebration variant with "Academy Star"     (~4s)
 *   → loop
 *
 * Synthetic data only; the real save is never touched.
 */

type Beat = 'pack' | 'trophy' | 'wonderkid';
const BEAT_ORDER: Beat[] = ['pack', 'trophy', 'wonderkid'];

const TROPHY_DWELL_MS = 5_000;
const WONDERKID_DWELL_MS = 4_000;

const LEAD_POSITION_ROTATION: Position[] = ['ST', 'CAM', 'CM', 'CB', 'GK'];

function buildLegendaryPack(seed: number): Player[] {
  const lead = LEAD_POSITION_ROTATION[seed % LEAD_POSITION_ROTATION.length];
  const otherPositions: Position[] = ['CDM', 'LW', 'RW', 'CB'];
  return [
    generatePlayer(lead, 92, 'cinematic', 1, '1'),
    ...otherPositions.map((pos) => generatePlayer(pos, 78 + Math.floor(Math.random() * 8), 'cinematic', 1, '1')),
  ];
}

const TROPHY_SCENARIOS = [
  {
    title: 'Champions of the League',
    description: 'Promoted to the Premier League after 5 seasons in the wilderness.',
    icon: 'Trophy',
    stats: [
      { label: 'Position', value: '1st' },
      { label: 'Points', value: '94' },
      { label: 'Goals', value: '88' },
      { label: 'Clean sheets', value: '21' },
    ],
  },
  {
    title: 'Cup Final Winners',
    description: 'A last-minute winner. A trophy. A story to tell.',
    icon: 'Award',
    stats: [
      { label: 'Final score', value: '2–1' },
      { label: 'Goal scorer', value: '90+3' },
      { label: 'Match rating', value: '9.4' },
      { label: 'Crowd', value: '78,210' },
    ],
  },
  {
    title: 'Manager of the Season',
    description: 'A board that wanted you sacked. An award they had to give you.',
    icon: 'Medal',
    stats: [
      { label: 'Wins', value: '28' },
      { label: 'Trophies', value: '3' },
      { label: 'Reputation', value: '★★★★★' },
      { label: 'Board confidence', value: '100' },
    ],
  },
];

const WONDERKID_SCENARIOS = [
  {
    title: 'Wonderkid Signed',
    description: '17 years old. 92 potential. Free signing.',
    icon: 'Sparkles',
    stats: [
      { label: 'Age', value: '17' },
      { label: 'Position', value: 'ST' },
      { label: 'Potential', value: '92' },
      { label: 'Fee', value: 'FREE' },
    ],
  },
  {
    title: 'Academy Graduate',
    description: 'Promoted from the youth ranks. The future starts now.',
    icon: 'GraduationCap',
    stats: [
      { label: 'Overall', value: '76' },
      { label: 'Potential', value: '88' },
      { label: 'Age', value: '18' },
      { label: 'Wage', value: '£12k/w' },
    ],
  },
];

const CinematicCapturePage = () => {
  const navigate = useNavigate();
  const [beatIndex, setBeatIndex] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const [overlayKey, setOverlayKey] = useState(0);
  const timerRef = useRef<number | null>(null);

  const beat = BEAT_ORDER[beatIndex];
  const cycleSeed = loopCount;

  // Rebuild pack contents once per loop iteration; each remount of
  // PackOpeningOverlay (key change) restarts its phase chain from `loading`.
  const players = useMemo(() => buildLegendaryPack(cycleSeed), [cycleSeed]);

  const trophy = TROPHY_SCENARIOS[cycleSeed % TROPHY_SCENARIOS.length];
  const wonderkid = WONDERKID_SCENARIOS[cycleSeed % WONDERKID_SCENARIOS.length];

  const advance = useCallback(() => {
    setBeatIndex((idx) => {
      const next = (idx + 1) % BEAT_ORDER.length;
      if (next === 0) {
        // Looped around — bump the seed so the next cycle gets fresh content
        setLoopCount((c) => c + 1);
        setOverlayKey((k) => k + 1);
      }
      return next;
    });
  }, []);

  // Auto-advance for the non-interactive beats (CelebrationModal doesn't
  // close on its own). PackOpeningOverlay drives its own close via onClose.
  useEffect(() => {
    if (beat === 'trophy' || beat === 'wonderkid') {
      const dwell = beat === 'trophy' ? TROPHY_DWELL_MS : WONDERKID_DWELL_MS;
      timerRef.current = window.setTimeout(advance, dwell);
      return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
    }
  }, [beat, overlayKey, advance]);

  const handlePackClose = useCallback(() => {
    // Tiny pause between beats so post-edit boundaries land cleanly.
    window.setTimeout(advance, 400);
  }, [advance]);

  const noop = useCallback(() => { /* cinematic loop — no state mutation */ }, []);

  useEffect(() => {
    // Force pure-black canvas so the screen recording doesn't pick up any
    // bleed-through if a portal isn't fully covering the page.
    const prev = document.body.style.background;
    document.body.style.background = 'black';
    return () => { document.body.style.background = prev; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      {beat === 'pack' && (
        <PackOpeningOverlay
          key={`pack-${overlayKey}`}
          tier="rare"
          players={players}
          onClose={handlePackClose}
          onKeep={noop}
          onQuickSell={noop}
          onKeepAll={noop}
          onSellAll={noop}
        />
      )}

      {beat === 'trophy' && (
        <CelebrationModal
          key={`trophy-${overlayKey}`}
          open
          onClose={noop}
          title={trophy.title}
          description={trophy.description}
          icon={trophy.icon}
          stats={trophy.stats}
        />
      )}

      {beat === 'wonderkid' && (
        <CelebrationModal
          key={`wonder-${overlayKey}`}
          open
          onClose={noop}
          title={wonderkid.title}
          description={wonderkid.description}
          icon={wonderkid.icon}
          stats={wonderkid.stats}
        />
      )}

      {/* Top-left status chip — current beat + loop count. Designed to be
          easily cropped out in post (or covered by the ad's hook caption). */}
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label="Exit cinematic capture"
        className="fixed top-3 left-3 z-[9999] rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase text-white/70 hover:text-white"
        style={{ fontFamily: 'monospace' }}
      >
        ✕ exit · {beat} · loop {loopCount + 1}
      </button>

      {/* Bottom-right manual advance — useful when capturing if you want to
          skip a beat mid-take. Subtle, croppable. */}
      <button
        type="button"
        onClick={() => {
          if (timerRef.current) window.clearTimeout(timerRef.current);
          if (beat === 'pack') handlePackClose(); else advance();
        }}
        aria-label="Skip to next beat"
        className="fixed bottom-3 right-3 z-[9999] rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase text-white/70 hover:text-white"
        style={{ fontFamily: 'monospace' }}
      >
        next ▸
      </button>
    </div>
  );
};

export default CinematicCapturePage;
