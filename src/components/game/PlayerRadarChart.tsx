import { memo, useCallback } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { CHART_COLORS, PLAYER_RADAR } from '@/config/ui';
import type { PlayerAttributes } from '@/types/game';

interface PlayerRadarChartProps {
  attributes: PlayerAttributes;
  changes?: Partial<Record<keyof PlayerAttributes, number>>;
}

const ATTR_MAP: { attr: string; key: keyof PlayerAttributes }[] = [
  { attr: 'PAC', key: 'pace' },
  { attr: 'SHO', key: 'shooting' },
  { attr: 'PAS', key: 'passing' },
  { attr: 'DEF', key: 'defending' },
  { attr: 'PHY', key: 'physical' },
  { attr: 'MEN', key: 'mental' },
];

export const PlayerRadarChart = memo(function PlayerRadarChart({ attributes, changes }: PlayerRadarChartProps) {
  const radarData = ATTR_MAP.map(({ attr, key }) => ({
    attr,
    key,
    value: attributes[key],
  }));

  const renderTick = useCallback(({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
    const item = ATTR_MAP.find(d => d.attr === payload.value);
    const change = item ? changes?.[item.key] : undefined;

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          textAnchor="middle"
          fontSize={PLAYER_RADAR.LABEL_FONT_SIZE}
          fill="hsl(var(--muted-foreground))"
          dy={0}
        >
          {payload.value}
        </text>
        {change != null && change !== 0 && (
          <text
            textAnchor="middle"
            fontSize={PLAYER_RADAR.CHANGE_FONT_SIZE}
            fontWeight="bold"
            fill={change > 0 ? PLAYER_RADAR.CHANGE_POSITIVE_COLOR : PLAYER_RADAR.CHANGE_NEGATIVE_COLOR}
            dy={12}
            aria-label={change > 0 ? `Increased by ${change}` : `Decreased by ${Math.abs(change)}`}
          >
            {change > 0 ? `▲+${change}` : `▼${change}`}
          </text>
        )}
      </g>
    );
  }, [changes]);

  return (
    <div style={{ width: '100%', height: PLAYER_RADAR.HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={PLAYER_RADAR.OUTER_RADIUS}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="attr" tick={renderTick} />
          <PolarRadiusAxis domain={[0, 99]} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke={CHART_COLORS.PRIMARY}
            fill={CHART_COLORS.PRIMARY}
            fillOpacity={CHART_COLORS.FILL_OPACITY_PRIMARY}
            strokeWidth={CHART_COLORS.STROKE_WIDTH}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
});
