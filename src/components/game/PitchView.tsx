import { FormationType, FORMATION_POSITIONS } from '@/types/game';
import { PITCH_COLORS } from '@/config/ui';
import { PlayerAvatar } from './PlayerAvatar';

interface PitchViewProps {
  formation: FormationType;
  homeColor?: string;
  awayColor?: string;
  awayFormation?: FormationType;
  showAway?: boolean;
  labels?: string[];
  homeLabels?: string[];
  highlightIndex?: number;
  onSlotClick?: (index: number) => void;
  playerFitness?: number[];
  playerIds?: string[];
  jerseyNumbers?: number[];
}

function getFitnessColor(fitness: number): string {
  if (fitness >= 80) return '#22c55e';
  if (fitness >= 60) return '#eab308';
  if (fitness >= 40) return '#f97316';
  return '#ef4444';
}

export function PitchView({ formation, homeColor = PITCH_COLORS.HOME_DEFAULT, awayColor = PITCH_COLORS.AWAY_DEFAULT, awayFormation, showAway, labels, homeLabels, highlightIndex, onSlotClick, playerFitness, playerIds, jerseyNumbers }: PitchViewProps) {
  const homeSlots = FORMATION_POSITIONS[formation];
  const awaySlots = awayFormation ? FORMATION_POSITIONS[awayFormation] : [];
  const resolvedLabels = homeLabels || labels;

  return (
    <div className="relative w-full aspect-[68/105] max-w-sm mx-auto">
      <svg viewBox="0 0 68 105" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Pitch */}
        <rect x="0" y="0" width="68" height="105" rx="1.5" fill={PITCH_COLORS.FILL} />
        <rect x="2" y="2" width="64" height="101" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        {/* Center */}
        <line x1="2" y1="52.5" x2="66" y2="52.5" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <circle cx="34" cy="52.5" r="9.15" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <circle cx="34" cy="52.5" r="0.5" fill={PITCH_COLORS.LINE} />
        {/* Penalty areas */}
        <rect x="13.85" y="2" width="40.3" height="16.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <rect x="13.85" y="86.5" width="40.3" height="16.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        {/* Goal areas */}
        <rect x="24.85" y="2" width="18.3" height="5.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <rect x="24.85" y="97.5" width="18.3" height="5.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        {/* Goals */}
        <rect x="29" y="0" width="10" height="2" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <rect x="29" y="103" width="10" height="2" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        {/* Penalty arcs */}
        <path d="M 26.85 18.5 A 9.15 9.15 0 0 0 41.15 18.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <path d="M 26.85 86.5 A 9.15 9.15 0 0 1 41.15 86.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />

        {/* Home team (bottom half) — spread from near goal (y≈95) to just past center (y≈56) */}
        {homeSlots.map((slot, i) => {
          const cx = 2 + (slot.x / 100) * 64;
          const cy = 95 - (slot.y / 100) * 39;
          const hasAvatar = playerIds?.[i];
          const avatarSize = 6;
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
                <>
                  <circle cx={cx} cy={cy} r="2.8" fill={homeColor} stroke={i === highlightIndex ? '#D4A843' : 'white'} strokeWidth={i === highlightIndex ? '0.6' : '0.4'} opacity="0.9" />
                  {resolvedLabels?.[i] && (
                    <text x={cx} y={cy + 0.7} textAnchor="middle" fill="white" fontSize="1.8" fontWeight="bold" fontFamily="monospace">
                      {resolvedLabels[i]}
                    </text>
                  )}
                </>
              )}
              <text x={cx} y={cy - (hasAvatar ? 3.5 : 4)} textAnchor="middle" fill="#9ca3af" fontSize="1.4" fontFamily="sans-serif">
                {slot.pos}
              </text>
              {playerFitness?.[i] !== undefined && (
                <>
                  <rect x={cx - 2.5} y={cy + (hasAvatar ? 4 : 3.5)} width="5" height="0.9" rx="0.45" fill="rgba(255,255,255,0.15)" />
                  <rect x={cx - 2.5} y={cy + (hasAvatar ? 4 : 3.5)} width={Math.max(0.2, (playerFitness[i] / 100) * 5)} height="0.9" rx="0.45" fill={getFitnessColor(playerFitness[i])} />
                </>
              )}
            </g>
          );
        })}

        {/* Away team (top half) — spread from near goal (y≈10) to just past center (y≈49) */}
        {showAway && awaySlots.map((slot, i) => {
          const cx = 2 + ((100 - slot.x) / 100) * 64;
          const cy = 10 + (slot.y / 100) * 39;
          return (
            <g key={`a${i}`}>
              <g transform={`translate(${cx - 6 / 2}, ${cy - 6 / 2})`}>
                <PlayerAvatar playerId={`away-${i}`} jerseyColor={awayColor} size={6} isAway />
              </g>
              <text x={cx} y={cy - 4} textAnchor="middle" fill="#6b7280" fontSize="1.4" fontFamily="sans-serif">
                {slot.pos}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
