import { FormationType, FORMATION_POSITIONS, FormationSlot, ChemistryLink } from '@/types/game';
import { PITCH_COLORS } from '@/config/ui';
import { getFitnessHexColor } from '@/utils/uiHelpers';
import { PlayerAvatar } from './PlayerAvatar';

interface PitchViewProps {
  formation: FormationType;
  homeColor?: string;
  awayColor?: string;
  awayFormation?: FormationType;
  showAway?: boolean;
  labels?: string[];
  homeLabels?: string[];
  awayLabels?: string[];
  highlightIndex?: number;
  onSlotClick?: (index: number) => void;
  playerFitness?: number[];
  playerIds?: string[];
  playerOveralls?: number[];
  jerseyNumbers?: number[];
  halfPitch?: boolean;
  chemistryLinks?: ChemistryLink[];
  awayPlayerIds?: string[];
  awayPlayerOveralls?: number[];
}

function getChemistryLineColor(strength: number): string {
  if (strength >= 3) return '#22c55e';
  if (strength >= 2) return '#eab308';
  return '#ef4444';
}

/** Compute formation connection lines between adjacent players by row proximity. */
function getFormationLines(slots: FormationSlot[]): [number, number][] {
  // Group slots into rows by y-coordinate (within 12 units = same row)
  const indexed = slots.map((s, i) => ({ ...s, idx: i }));
  indexed.sort((a, b) => a.y - b.y);

  const rows: { idx: number; x: number; y: number }[][] = [];
  for (const s of indexed) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && Math.abs(s.y - lastRow[0].y) < 12) {
      lastRow.push({ idx: s.idx, x: s.x, y: s.y });
    } else {
      rows.push([{ idx: s.idx, x: s.x, y: s.y }]);
    }
  }

  // Sort each row by x
  rows.forEach(row => row.sort((a, b) => a.x - b.x));

  const lines: [number, number][] = [];

  // Connect within each row (adjacent players)
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i++) {
      lines.push([row[i].idx, row[i + 1].idx]);
    }
  }

  // Connect between adjacent rows
  for (let r = 0; r < rows.length - 1; r++) {
    const upper = rows[r];
    const lower = rows[r + 1];
    for (const u of upper) {
      // Connect to the 1-2 nearest players in the next row
      const sorted = [...lower].sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x));
      const nearest = sorted.slice(0, Math.min(2, sorted.length));
      for (const n of nearest) {
        // Only connect if horizontally close enough (within 45 units on the 0-100 scale)
        if (Math.abs(n.x - u.x) <= 45) {
          lines.push([u.idx, n.idx]);
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return lines.filter(([a, b]) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function PitchView({ formation, homeColor = PITCH_COLORS.HOME_DEFAULT, awayColor = PITCH_COLORS.AWAY_DEFAULT, awayFormation, showAway, labels, homeLabels, awayLabels, highlightIndex, onSlotClick, playerFitness, playerIds, playerOveralls, jerseyNumbers, halfPitch = false, chemistryLinks, awayPlayerIds, awayPlayerOveralls }: PitchViewProps) {
  const homeSlots = FORMATION_POSITIONS[formation];
  const awaySlots = awayFormation ? FORMATION_POSITIONS[awayFormation] : [];
  const resolvedLabels = homeLabels || labels;

  const vpY = halfPitch ? 46 : 0;
  const vpH = halfPitch ? 59 : 105;

  const homeLines = getFormationLines(homeSlots);
  const awayLines = showAway && !halfPitch && awaySlots.length ? getFormationLines(awaySlots) : [];

  return (
    <div className="relative w-full mx-auto" style={{ aspectRatio: `68/${vpH}`, maxWidth: '24rem' }}>
      <svg viewBox={`0 ${vpY} 68 ${vpH}`} className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Pitch */}
        <rect x="0" y="0" width="68" height="105" rx="1.5" fill={PITCH_COLORS.FILL} />
        <rect x="2" y="2" width="64" height="101" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        {/* Center */}
        <line x1="2" y1="52.5" x2="66" y2="52.5" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <circle cx="34" cy="52.5" r="9.15" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <circle cx="34" cy="52.5" r="0.5" fill={PITCH_COLORS.LINE} />
        {/* Penalty areas */}
        {!halfPitch && <rect x="13.85" y="2" width="40.3" height="16.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />}
        <rect x="13.85" y="86.5" width="40.3" height="16.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        {/* Goal areas */}
        {!halfPitch && <rect x="24.85" y="2" width="18.3" height="5.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />}
        <rect x="24.85" y="97.5" width="18.3" height="5.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        {/* Goals */}
        {!halfPitch && <rect x="29" y="0" width="10" height="2" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />}
        <rect x="29" y="103" width="10" height="2" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        {/* Penalty arcs */}
        {!halfPitch && <path d="M 26.85 18.5 A 9.15 9.15 0 0 0 41.15 18.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />}
        <path d="M 26.85 86.5 A 9.15 9.15 0 0 1 41.15 86.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />

        {/* Home formation lines */}
        {homeLines.map(([a, b], idx) => {
          const sa = homeSlots[a];
          const sb = homeSlots[b];
          const x1 = 2 + (sa.x / 100) * 64;
          const y1 = 95 - (sa.y / 100) * 39;
          const x2 = 2 + (sb.x / 100) * 64;
          const y2 = 95 - (sb.y / 100) * 39;
          return <line key={`hl-${idx}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth="0.35" strokeLinecap="round" />;
        })}

        {/* Away formation lines */}
        {awayLines.map(([a, b], idx) => {
          const sa = awaySlots[a];
          const sb = awaySlots[b];
          const x1 = 2 + ((100 - sa.x) / 100) * 64;
          const y1 = 10 + (sa.y / 100) * 39;
          const x2 = 2 + ((100 - sb.x) / 100) * 64;
          const y2 = 10 + (sb.y / 100) * 39;
          return <line key={`al-${idx}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.1)" strokeWidth="0.35" strokeLinecap="round" />;
        })}

        {/* Chemistry links (colored lines between linked players) */}
        {chemistryLinks && playerIds && chemistryLinks.map((link, idx) => {
          const idxA = playerIds.indexOf(link.playerIdA);
          const idxB = playerIds.indexOf(link.playerIdB);
          if (idxA < 0 || idxB < 0) return null;
          const slotA = homeSlots[idxA];
          const slotB = homeSlots[idxB];
          if (!slotA || !slotB) return null;
          const x1 = 2 + (slotA.x / 100) * 64;
          const y1 = 95 - (slotA.y / 100) * 39;
          const x2 = 2 + (slotB.x / 100) * 64;
          const y2 = 95 - (slotB.y / 100) * 39;
          return (
            <line
              key={`chem-${idx}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={getChemistryLineColor(link.strength)}
              strokeWidth="0.45"
              opacity="0.6"
              strokeLinecap="round"
            />
          );
        })}

        {/* Home team (bottom half) */}
        {homeSlots.map((slot, i) => {
          const cx = 2 + (slot.x / 100) * 64;
          const cy = 95 - (slot.y / 100) * 39;
          const hasAvatar = playerIds?.[i];
          const avatarSize = 6;
          const label = resolvedLabels?.[i];
          const ovr = playerOveralls?.[i];
          return (
            <g key={`h${i}`} onClick={() => onSlotClick?.(i)} className={onSlotClick ? 'cursor-pointer' : ''}>
              {onSlotClick && <circle cx={cx} cy={cy} r="5" fill="transparent" />}
              {i === highlightIndex && (
                <circle cx={cx} cy={cy} r="4.5" fill="none" stroke="#D4A843" strokeWidth="0.5" opacity="0.8">
                  <animate attributeName="r" values="3.5;5.5;3.5" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
              {hasAvatar ? (
                <g transform={`translate(${cx - avatarSize / 2}, ${cy - avatarSize / 2})`}>
                  <PlayerAvatar
                    playerId={playerIds[i]}
                    jerseyColor={homeColor}
                    jerseyNumber={jerseyNumbers?.[i]}
                    size={avatarSize}
                  />
                </g>
              ) : (
                <circle cx={cx} cy={cy} r="2.8" fill={homeColor} stroke={i === highlightIndex ? '#D4A843' : 'white'} strokeWidth={i === highlightIndex ? '0.6' : '0.4'} opacity="0.9" />
              )}
              {/* Dark info box — matching LineupEditor style */}
              <rect x={cx - 4.5} y={cy + (hasAvatar ? 3.2 : 3)} width="9" height={ovr !== undefined ? 4.2 : 2.8} rx="0.6" fill="rgba(0,0,0,0.7)" />
              {label && (
                <text x={cx} y={cy + (hasAvatar ? 5.2 : 5)} textAnchor="middle" fill="white" fontSize="1.6" fontWeight="bold" fontFamily="sans-serif">
                  {label}
                </text>
              )}
              {!label && (
                <text x={cx} y={cy + (hasAvatar ? 5.2 : 5)} textAnchor="middle" fill="#9ca3af" fontSize="1.4" fontFamily="sans-serif">
                  {slot.pos}
                </text>
              )}
              {ovr !== undefined && (
                <text x={cx} y={cy + (hasAvatar ? 7 : 6.8)} textAnchor="middle" fill="#9ca3af" fontSize="1.2" fontFamily="sans-serif">
                  {slot.pos} {ovr}
                </text>
              )}
              {playerFitness?.[i] !== undefined && (
                <>
                  <rect x={cx - 2.5} y={cy + (hasAvatar ? 7.8 : ovr !== undefined ? 7.5 : 6)} width="5" height="0.9" rx="0.45" fill="rgba(255,255,255,0.15)" />
                  <rect x={cx - 2.5} y={cy + (hasAvatar ? 7.8 : ovr !== undefined ? 7.5 : 6)} width={Math.max(0.2, (playerFitness[i] / 100) * 5)} height="0.9" rx="0.45" fill={getFitnessHexColor(playerFitness[i])} />
                </>
              )}
            </g>
          );
        })}

        {/* Away team (top half) — only shown in full pitch mode */}
        {showAway && !halfPitch && awaySlots.map((slot, i) => {
          const cx = 2 + ((100 - slot.x) / 100) * 64;
          const cy = 10 + (slot.y / 100) * 39;
          const label = awayLabels?.[i];
          const awayOvr = awayPlayerOveralls?.[i];
          return (
            <g key={`a${i}`}>
              <g transform={`translate(${cx - 6 / 2}, ${cy - 6 / 2})`}>
                <PlayerAvatar playerId={awayPlayerIds?.[i] || `away-${i}`} jerseyColor={awayColor} size={6} isAway />
              </g>
              {/* Dark info box for away team */}
              <rect x={cx - 4.5} y={cy + 3.2} width="9" height={awayOvr !== undefined ? 4.2 : 2.8} rx="0.6" fill="rgba(0,0,0,0.6)" />
              {label ? (
                <text x={cx} y={cy + 5.2} textAnchor="middle" fill="white" fontSize="1.6" fontWeight="bold" fontFamily="sans-serif">
                  {label}
                </text>
              ) : (
                <text x={cx} y={cy + 5.2} textAnchor="middle" fill="#6b7280" fontSize="1.4" fontFamily="sans-serif">
                  {slot.pos}
                </text>
              )}
              {awayOvr !== undefined && (
                <text x={cx} y={cy + 7} textAnchor="middle" fill="#9ca3af" fontSize="1.2" fontFamily="sans-serif">
                  {slot.pos} {awayOvr}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
