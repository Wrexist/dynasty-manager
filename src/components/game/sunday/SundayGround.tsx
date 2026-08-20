/**
 * The ground, drawn.
 *
 * WHY A PICTURE. The Clubhouse's job is to answer "what has this club become?"
 * and it used to answer with ten stacked panels of catalogue prose. But every
 * one of those ten upgrades is a PHYSICAL THING — a roller, a set of nets, a
 * minibus, a bloke with a clipboard — and a Sunday club's progress is the one
 * kind of progress you can actually see from the touchline. So the screen opens
 * on the ground itself, and buying something puts it in the picture.
 *
 * EVERY MARK IS LOAD-BEARING. Nothing here is invented decoration: the surface
 * changes colour and gains mown stripes with the `pitch` level, the goal gains
 * nets, the pylons appear, the portakabin becomes a clubhouse, shirts appear on
 * the line one per `kit` level, a van fills the parking bay, a figure appears in
 * the dugout, the ball pile grows, the physio's bag and stretcher arrive, the
 * keeper's hands turn from bare to gloved, and the perimeter fence becomes named
 * hoardings when there are sponsors. Read the scene and you have read the save.
 *
 * THE HIT TARGETS ARE REAL BUTTONS, NOT SVG. Ten 44px targets are laid over the
 * drawing at hand-placed anchors that match where each thing is drawn, as
 * ordinary `<button>`s: an SVG `<g>` with an onClick is not focusable, not
 * announced, and not 44px. The anchors are spaced so no two targets overlap at
 * 375px — see the table above `HOTSPOTS`.
 *
 * BUDGET. Inline SVG only: no images, no CSS beyond Tailwind utilities the app
 * already ships, no framer-motion, and no `backdrop-filter` anywhere near it.
 * The expensive layers — the sky wash, the floodlight glow, the vignette, the
 * terraced skyline — are gated behind `detectPitchQuality`, which returns the
 * `battery` tier under reduced motion / performance mode and therefore draws
 * flat fills and nothing else.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { detectPitchQuality } from '@/utils/pitchQuality';
import type { SundayUpgradeId } from '@/types/game';
import type { SundayUpgradeSceneItem } from '@/utils/sunday/view';

/** Where each upgrade's hit target sits, as a share of the box.
 *
 *  Spaced so that no two 44x44 targets overlap at 375px wide (the scene is
 *  343x225 there): every pair differs by at least 44px on one axis. Check that
 *  again if you move one. */
const HOTSPOTS: Record<SundayUpgradeId, { x: number; y: number }> = {
  floodlights: { x: 11.3, y: 13.3 },
  kit: { x: 10.9, y: 37.1 },
  clubhouse: { x: 27.2, y: 31.4 },
  nets: { x: 50, y: 41 },
  minibus: { x: 86.3, y: 31.4 },
  'keeper-gloves': { x: 80.6, y: 52.4 },
  coach: { x: 13.8, y: 76 },
  balls: { x: 31.9, y: 88.1 },
  physio: { x: 49.4, y: 88.1 },
  pitch: { x: 66.3, y: 78 },
};

/** The playing surface, by how much has been spent on it. Four steps, because
 *  `pitch` has three levels and the club starts with none. */
const TURF = ['#3d4630', '#3b5533', '#356b35', '#2c7d3a'];

export interface SundayGroundProps {
  /** Every upgrade with its level — `sundayUpgradeScene(sunday).items`. */
  items: readonly SundayUpgradeSceneItem[];
  /** Club colours, for the kit on the line and the van in the car park. */
  color: string;
  secondaryColor: string;
  /** Live sponsors, in order. Their names go on the perimeter boards. */
  sponsorNames: readonly string[];
  selected: SundayUpgradeId | null;
  onSelect: (id: SundayUpgradeId) => void;
}

export function SundayGround({
  items, color, secondaryColor, sponsorNames, selected, onSelect,
}: SundayGroundProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPref();
  const quality = useMemo(() => detectPitchQuality(reduceMotion), [reduceMotion]);
  const rich = quality.gradient;
  const detailed = quality.tier === 'high';

  const level = (id: SundayUpgradeId) => items.find(i => i.id === id)?.level ?? 0;
  const pitch = level('pitch');
  const kit = level('kit');
  const coach = level('coach');
  const balls = level('balls');
  const physio = level('physio');
  const clubhouse = level('clubhouse');
  const gloves = level('keeper-gloves');
  const hasNets = level('nets') > 0;
  const hasLights = level('floodlights') > 0;
  const hasBus = level('minibus') > 0;

  const turf = TURF[Math.min(pitch, TURF.length - 1)];
  /** Line paint is the thing a groundsman actually owns. */
  const lineOpacity = 0.22 + pitch * 0.24;
  const boards = sponsorNames.slice(0, 3);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#0b1220]">
      <svg
        viewBox="0 0 320 210"
        className="block w-full h-auto"
        role="img"
        aria-label={t('sunday.club.groundAlt')}
      >
        {rich && (
          <defs>
            <linearGradient id="sg-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16233c" />
              <stop offset="100%" stopColor="#2b3a4e" />
            </linearGradient>
            <radialGradient id="sg-lamp">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
          </defs>
        )}

        {/* ── Sky ── */}
        <rect x="0" y="0" width="320" height="66" fill={rich ? 'url(#sg-sky)' : '#1b2942'} />

        {/* ── The street behind the ground ── */}
        {detailed && (
          <g fill="#131c2e">
            <path d="M0 66V50h26l8-7 8 7h20v16z" />
            <path d="M62 66V44h34l7-6 7 6h18v22z" />
            <path d="M196 66V48h30l8-7 8 7h26v18z" />
            <path d="M276 66V52h44v14z" />
          </g>
        )}
        {detailed && (
          <g fill="#0f172a" opacity="0.9">
            <ellipse cx="150" cy="64" rx="14" ry="9" />
            <ellipse cx="172" cy="65" rx="10" ry="7" />
          </g>
        )}

        {/* ── Floodlights ── */}
        {hasLights && (
          <g>
            {rich && (
              <>
                <ellipse cx="36" cy="60" rx="52" ry="46" fill="url(#sg-lamp)" />
                <ellipse cx="284" cy="60" rx="52" ry="46" fill="url(#sg-lamp)" />
              </>
            )}
            {[36, 284].map(x => (
              <g key={x} stroke="#64748b" strokeWidth="1.6" fill="none">
                <path d={`M${x - 3} 90 L${x - 1} 26 M${x + 3} 90 L${x + 1} 26`} />
                <path d={`M${x - 2.4} 74h4.8M${x - 1.8} 58h3.6M${x - 1.4} 42h2.8`} strokeWidth="1" />
                <rect x={x - 11} y="14" width="22" height="10" fill="#475569" stroke="none" />
                <g fill="#fef3c7" stroke="none">
                  <rect x={x - 9} y="16" width="7" height="6" />
                  <rect x={x + 2} y="16" width="7" height="6" />
                </g>
              </g>
            ))}
          </g>
        )}

        {/* ── The clubhouse, or the portakabin standing in for one ── */}
        {clubhouse === 0 ? (
          <g>
            <rect x="60" y="62" width="54" height="28" fill="#3f4756" />
            <rect x="60" y="60" width="54" height="4" fill="#586274" />
            <rect x="70" y="72" width="10" height="18" fill="#28303d" />
            <rect x="90" y="70" width="14" height="9" fill="#1f2a3a" />
          </g>
        ) : (
          <g>
            <path d="M56 90V56l31-14 31 14v34z" fill="#6b3f34" />
            <path d="M56 56l31-14 31 14z" fill="#8a4f40" />
            <rect x="80" y="70" width="14" height="20" fill="#2b1f1a" />
            <rect x="62" y="62" width="12" height="10" fill={clubhouse >= 2 ? '#fde68a' : '#1f2a3a'} />
            <rect x="100" y="62" width="12" height="10" fill={clubhouse >= 2 ? '#fde68a' : '#1f2a3a'} />
            {clubhouse >= 2 && (
              <>
                <rect x="118" y="70" width="20" height="20" fill="#5c372e" />
                <rect x="122" y="74" width="12" height="8" fill="#fde68a" />
                <rect x="74" y="46" width="26" height="7" rx="1" fill="#1f2a3a" />
                <rect x="76" y="48" width="22" height="3" rx="1" fill={color} />
              </>
            )}
          </g>
        )}

        {/* ── The kit, on the line ── */}
        <path d="M6 68 L54 74" stroke="#64748b" strokeWidth="0.8" fill="none" opacity="0.5" />
        {Array.from({ length: kit }, (_, i) => {
          const x = 12 + i * 15;
          const y = 69 + i * 1.6;
          return (
            <g key={i}>
              <path
                d={`M${x} ${y}l-4 3 2 3 2-1v9h10v-9l2 1 2-3-4-3z`}
                fill={color}
                stroke={secondaryColor}
                strokeWidth="0.8"
              />
            </g>
          );
        })}

        {/* ── The car park ── */}
        <rect x="236" y="56" width="80" height="34" fill="#232c3c" />
        <path d="M248 58v30M268 58v30M288 58v30" stroke="#3b465c" strokeWidth="0.8" />
        {hasBus && (
          <g>
            <rect x="244" y="62" width="60" height="20" rx="3" fill={color} />
            <rect x="248" y="65" width="14" height="8" rx="1" fill="#cbd5e1" opacity="0.75" />
            <rect x="266" y="65" width="14" height="8" rx="1" fill="#cbd5e1" opacity="0.75" />
            <rect x="284" y="65" width="14" height="8" rx="1" fill="#cbd5e1" opacity="0.75" />
            <rect x="244" y="74" width="60" height="3" fill={secondaryColor} />
            <circle cx="256" cy="83" r="4" fill="#111827" />
            <circle cx="292" cy="83" r="4" fill="#111827" />
          </g>
        )}

        {/* ── Perimeter fence and the boards on it ── */}
        <rect x="40" y="84" width="240" height="12" fill="#1c2536" />
        {boards.length === 0 ? (
          <path
            d="M52 84v12M76 84v12M100 84v12M124 84v12M148 84v12M172 84v12M196 84v12M220 84v12M244 84v12M268 84v12"
            stroke="#2f3a4f"
            strokeWidth="1.4"
          />
        ) : (
          boards.map((name, i) => {
            const w = 236 / boards.length;
            const x = 42 + i * w;
            return (
              <g key={name}>
                <rect x={x} y="85" width={w - 4} height="10" rx="1" fill={i % 2 ? secondaryColor : color} />
                <text
                  x={x + (w - 4) / 2}
                  y="92.6"
                  textAnchor="middle"
                  fontSize="6"
                  fontWeight="700"
                  fill={i % 2 ? color : secondaryColor}
                >
                  {name.slice(0, 14).toUpperCase()}
                </text>
              </g>
            );
          })
        )}

        {/* ── The goal ── */}
        {hasNets && (
          <path
            d="M138 78h44M138 84h44M138 90h44M138 96h44M142 76v20M148 76v20M154 76v20M160 76v20M166 76v20M172 76v20M178 76v20"
            stroke="#e2e8f0"
            strokeWidth="0.5"
            opacity="0.5"
          />
        )}
        <path d="M136 96V76h48v20" stroke="#f8fafc" strokeWidth="2.4" fill="none" strokeLinecap="square" />

        {/* ── The pitch ── */}
        <path d="M60 96h200l52 84H8z" fill={turf} />
        {pitch >= 2 && (
          <g fill="#ffffff" opacity="0.045">
            <path d="M60 96h34l-13 84H8z" />
            <path d="M128 96h33l-13 84h-33z" />
            <path d="M195 96h33l25 84h-33z" />
          </g>
        )}
        {pitch === 0 && (
          /* Bald patches. A pitch nobody rolls is mud in the goalmouth and
             mud where the wingers turn. */
          <g fill="#5a4f38" opacity="0.7">
            <ellipse cx="160" cy="112" rx="26" ry="7" />
            <ellipse cx="96" cy="158" rx="22" ry="9" />
            <ellipse cx="236" cy="150" rx="18" ry="7" />
          </g>
        )}
        <g stroke="#f8fafc" fill="none" strokeWidth="1.2" opacity={lineOpacity}>
          <path d="M60 96h200l52 84H8z" />
          <path d="M118 96h84v24h-84z" />
          <path d="M138 96h44v10h-44z" />
          <path d="M29 146h262" />
          <ellipse cx="160" cy="146" rx="46" ry="13" />
        </g>

        {/* ── The keeper, warming up ── */}
        <g>
          <circle cx="258" cy="100" r="4.4" fill="#c68642" />
          <path d="M253 105h10v14h-10z" fill={secondaryColor} />
          <path d="M254 119l-1 9h3l2-9M262 119l1 9h-3l-2-9" fill="#1f2937" />
          <circle cx="250" cy="110" r="3.2" fill={gloves > 0 ? color : '#c68642'} />
          <circle cx="266" cy="110" r="3.2" fill={gloves > 0 ? color : '#c68642'} />
          {gloves >= 2 && (
            <g stroke={secondaryColor} strokeWidth="0.8" fill="none">
              <circle cx="250" cy="110" r="3.2" />
              <circle cx="266" cy="110" r="3.2" />
            </g>
          )}
        </g>

        {/* ── The apron, and everything stacked on it ── */}
        <rect x="0" y="180" width="320" height="30" fill="#26302a" />

        {/* Dugout */}
        <g>
          <path d="M6 182v-22l34-12 34 12v22z" fill="#2b3444" />
          <path d="M6 160l34-12 34 12z" fill="#3b465c" />
          <rect x="14" y="172" width="52" height="4" rx="1" fill="#4b5768" />
          {coach >= 1 && (
            <g>
              <circle cx="30" cy="164" r="4" fill="#c68642" />
              <path d="M25 169h10v13H25z" fill="#1f2937" />
              <rect x="34" y="170" width="7" height="5" rx="1" fill="#e2e8f0" />
            </g>
          )}
          {coach >= 2 && (
            <g>
              <rect x="46" y="158" width="22" height="16" rx="1" fill="#e2e8f0" />
              <path d="M50 162h14M50 166h10M50 170h14" stroke="#334155" strokeWidth="1" />
            </g>
          )}
          {coach >= 3 && (
            <g>
              <circle cx="58" cy="178" r="3.4" fill="#c68642" />
              <path d="M54 182h8v6h-8z" fill="#334155" />
            </g>
          )}
        </g>

        {/* Balls */}
        <g>
          {balls === 0 ? (
            <ellipse cx="102" cy="198" rx="9" ry="6" fill="#cbd5e1" opacity="0.8" />
          ) : balls === 1 ? (
            <g fill="#e2e8f0">
              <circle cx="94" cy="198" r="6" />
              <circle cx="106" cy="200" r="6" />
              <circle cx="100" cy="189" r="6" />
            </g>
          ) : (
            <g>
              <path d="M86 202a16 13 0 0 1 32 0z" fill="#334155" />
              <g fill="#e2e8f0">
                <circle cx="94" cy="196" r="6" />
                <circle cx="107" cy="197" r="6" />
                <circle cx="100" cy="187" r="6" />
              </g>
              <path d="M86 202h32" stroke="#94a3b8" strokeWidth="1.4" />
            </g>
          )}
        </g>

        {/* Physio */}
        {physio > 0 && (
          <g>
            <rect x="138" y="190" width="20" height="14" rx="2" fill="#dc2626" />
            <path d="M146 193h4v8h-4zM142 196h12v2h-12z" fill="#fef2f2" />
            {physio >= 2 && (
              <g>
                <rect x="162" y="196" width="30" height="5" rx="2" fill="#94a3b8" />
                <path d="M164 201v5M190 201v5" stroke="#64748b" strokeWidth="1.6" />
              </g>
            )}
            {physio >= 3 && (
              <g fill="#38bdf8">
                <rect x="164" y="186" width="4" height="8" rx="1" />
                <rect x="170" y="186" width="4" height="8" rx="1" />
                <rect x="176" y="186" width="4" height="8" rx="1" />
              </g>
            )}
          </g>
        )}

        {rich && <rect x="0" y="0" width="320" height="210" fill="#000" opacity="0.12" />}
      </svg>

      {/* ── The hit targets ── */}
      {items.map(item => {
        const spot = HOTSPOTS[item.id];
        const on = selected === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-pressed={on}
            aria-label={t('sunday.club.groundSpot', {
              name: item.name, n: item.level, max: item.maxLevel,
            })}
            className={cn(
              'absolute w-11 h-11 -ml-[22px] -mt-[22px] rounded-full',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300',
              on && 'ring-2 ring-amber-300 bg-amber-300/10',
            )}
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            {/* A dot, so an unselected thing still says "there is something
                here" without covering the drawing. Owned reads brighter than
                not-owned: the scene's job is to show what the club HAS. */}
            <span
              aria-hidden
              className={cn(
                'block w-1.5 h-1.5 rounded-full mx-auto',
                on ? 'bg-amber-300' : item.owned ? 'bg-white/45' : 'bg-white/15',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
