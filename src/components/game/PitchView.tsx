import { FormationType, FORMATION_POSITIONS, ChemistryLink } from '@/types/game';
import { PITCH_COLORS } from '@/config/ui';
import { getFitnessHexColor } from '@/utils/uiHelpers';
import { getFormationLines, buildChemistryStrengthMap, getChemistryLineColor, NEUTRAL_LINE_COLOR } from '@/utils/formationLines';
import { PlayerAvatar } from './PlayerAvatar';
import { useGameStore } from '@/store/gameStore';
import { getActiveCosmetic } from '@/utils/monetization';
import { cn } from '@/lib/utils';

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
  playerFlags?: string[];
  awayPlayerFlags?: string[];
  pairFamiliarity?: Record<string, number>;
}

export function PitchView({ formation, homeColor = PITCH_COLORS.HOME_DEFAULT, awayColor = PITCH_COLORS.AWAY_DEFAULT, awayFormation, showAway, labels, homeLabels, awayLabels, highlightIndex, onSlotClick, playerFitness, playerIds, playerOveralls, jerseyNumbers, halfPitch = false, chemistryLinks, awayPlayerIds, awayPlayerOveralls, playerFlags, awayPlayerFlags, pairFamiliarity }: PitchViewProps) {
  const homeSlots = FORMATION_POSITIONS[formation];
  const awaySlots = awayFormation ? FORMATION_POSITIONS[awayFormation] : [];
  const resolvedLabels = homeLabels || labels;

  const vpY = halfPitch ? 46 : 0;
  const vpH = halfPitch ? 59 : 105;

  const homeLines = getFormationLines(homeSlots);
  const awayLines = showAway && !halfPitch && awaySlots.length ? getFormationLines(awaySlots) : [];

  const pitchSkin = getActiveCosmetic(useGameStore.getState().monetization, 'pitch_skin');
  const pitchSkinClass = pitchSkin === 'pitch-stripes' ? 'pitch-stripes' : pitchSkin === 'pitch-checkerboard' ? 'pitch-checkerboard' : pitchSkin === 'pitch-diamond' ? 'pitch-diamond' : '';

  return (
    <div className={cn("relative w-full mx-auto", pitchSkinClass)} style={{ aspectRatio: `68/${vpH}`, maxWidth: '24rem' }}>
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

        {/* Home formation lines colored by chemistry */}
        {(() => {
          const chemMap = chemistryLinks && playerIds
            ? buildChemistryStrengthMap(chemistryLinks, pairFamiliarity)
            : null;

          return homeLines.map(([a, b], idx) => {
            const sa = homeSlots[a];
            const sb = homeSlots[b];
            const x1 = 2 + (sa.x / 100) * 64;
            const y1 = 95 - (sa.y / 100) * 39;
            const x2 = 2 + (sb.x / 100) * 64;
            const y2 = 95 - (sb.y / 100) * 39;

            let color = NEUTRAL_LINE_COLOR;
            let width = 0.35;
            let lineOpacity = 1;

            if (chemMap && playerIds?.[a] && playerIds?.[b]) {
              const idA = playerIds[a];
              const idB = playerIds[b];
              const key = idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
              const strength = chemMap.get(key);
              if (strength !== undefined) {
                color = getChemistryLineColor(strength);
                width = 0.45;
                lineOpacity = 0.6;
              }
            }

            return <line key={`hl-${idx}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} opacity={lineOpacity} strokeLinecap="round" />;
          });
        })()}

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
                  {playerFlags?.[i] ? `${playerFlags[i]} ${label}` : label}
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
                  {awayPlayerFlags?.[i] ? `${awayPlayerFlags[i]} ${label}` : label}
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
