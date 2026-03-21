/**
 * SVG mini-avatar for players on the pitch.
 * Deterministic appearance from player ID (used as seed).
 * Features: skin tone, hair style/color, jersey with number.
 * Subtle idle bob animation via CSS.
 */

const SKIN_TONES = ['#F5D0A9', '#D4A574', '#A0785A', '#6B4423'];
const HAIR_COLORS = ['#2C1B0E', '#5C3317', '#8B6914', '#D4A843', '#C0392B', '#1A1A2E'];
const HAIR_STYLES = ['none', 'short', 'medium', 'mohawk', 'buzz', 'long'] as const;

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface PlayerAvatarProps {
  playerId: string;
  jerseyColor: string;
  jerseyNumber?: number;
  size?: number;
  isAway?: boolean;
}

export function PlayerAvatar({ playerId, jerseyColor, jerseyNumber, size = 6, isAway = false }: PlayerAvatarProps) {
  const seed = hashId(playerId);
  const skinTone = SKIN_TONES[seed % SKIN_TONES.length];
  const hairColor = HAIR_COLORS[(seed >> 4) % HAIR_COLORS.length];
  const hairStyle = HAIR_STYLES[(seed >> 8) % HAIR_STYLES.length];

  const s = size;
  const cx = s / 2;
  const headR = s * 0.22;
  const bodyW = s * 0.35;
  const bodyH = s * 0.30;
  const bodyY = s * 0.45;

  return (
    <g className={isAway ? undefined : 'player-avatar-idle'}>
      {/* Body / Jersey */}
      <rect
        x={cx - bodyW / 2}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={s * 0.06}
        fill={jerseyColor}
        opacity={isAway ? 0.85 : 1}
        stroke={isAway ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)'}
        strokeWidth={isAway ? '0.25' : '0.15'}
      />

      {/* Jersey number */}
      {jerseyNumber !== undefined && (
        <text
          x={cx}
          y={bodyY + bodyH * 0.65}
          textAnchor="middle"
          fill="white"
          fontSize={s * 0.16}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {jerseyNumber}
        </text>
      )}

      {/* Legs */}
      <line x1={cx - s * 0.08} y1={bodyY + bodyH} x2={cx - s * 0.10} y2={bodyY + bodyH + s * 0.15} stroke={skinTone} strokeWidth={s * 0.05} strokeLinecap="round" />
      <line x1={cx + s * 0.08} y1={bodyY + bodyH} x2={cx + s * 0.10} y2={bodyY + bodyH + s * 0.15} stroke={skinTone} strokeWidth={s * 0.05} strokeLinecap="round" />

      {/* Boots */}
      <circle cx={cx - s * 0.10} cy={bodyY + bodyH + s * 0.17} r={s * 0.035} fill="#1a1a1a" />
      <circle cx={cx + s * 0.10} cy={bodyY + bodyH + s * 0.17} r={s * 0.035} fill="#1a1a1a" />

      {/* Head */}
      <circle cx={cx} cy={s * 0.30} r={headR} fill={skinTone} stroke="rgba(0,0,0,0.1)" strokeWidth="0.1" />

      {/* Hair */}
      {hairStyle === 'short' && (
        <path
          d={`M ${cx - headR * 0.9} ${s * 0.30 - headR * 0.3} Q ${cx} ${s * 0.30 - headR * 1.5} ${cx + headR * 0.9} ${s * 0.30 - headR * 0.3}`}
          fill={hairColor}
        />
      )}
      {hairStyle === 'medium' && (
        <>
          <path
            d={`M ${cx - headR} ${s * 0.30 - headR * 0.2} Q ${cx} ${s * 0.30 - headR * 1.7} ${cx + headR} ${s * 0.30 - headR * 0.2}`}
            fill={hairColor}
          />
          <rect x={cx - headR * 1.05} y={s * 0.30 - headR * 0.5} width={headR * 0.3} height={headR * 0.8} rx={headR * 0.1} fill={hairColor} />
          <rect x={cx + headR * 0.75} y={s * 0.30 - headR * 0.5} width={headR * 0.3} height={headR * 0.8} rx={headR * 0.1} fill={hairColor} />
        </>
      )}
      {hairStyle === 'mohawk' && (
        <rect
          x={cx - headR * 0.15}
          y={s * 0.30 - headR * 1.4}
          width={headR * 0.3}
          height={headR * 1.0}
          rx={headR * 0.1}
          fill={hairColor}
        />
      )}
      {hairStyle === 'buzz' && (
        <path
          d={`M ${cx - headR * 0.8} ${s * 0.30 - headR * 0.5} Q ${cx} ${s * 0.30 - headR * 1.2} ${cx + headR * 0.8} ${s * 0.30 - headR * 0.5}`}
          fill={hairColor}
          opacity="0.6"
        />
      )}
      {hairStyle === 'long' && (
        <>
          <path
            d={`M ${cx - headR} ${s * 0.30} Q ${cx} ${s * 0.30 - headR * 1.8} ${cx + headR} ${s * 0.30}`}
            fill={hairColor}
          />
          <rect x={cx - headR * 1.1} y={s * 0.30 - headR * 0.3} width={headR * 0.25} height={headR * 1.3} rx={headR * 0.1} fill={hairColor} />
          <rect x={cx + headR * 0.85} y={s * 0.30 - headR * 0.3} width={headR * 0.25} height={headR * 1.3} rx={headR * 0.1} fill={hairColor} />
        </>
      )}
    </g>
  );
}
