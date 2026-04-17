import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { slotToWorld } from '../shared/PitchGeometry';
import { type FormationType, FORMATION_POSITIONS } from '@/types/game';

interface ChemLine {
  a: number;
  b: number;
  color: string;
  strength: number;
}

interface FormationChemLinesProps {
  formation: FormationType;
  chemLineData: ChemLine[];
  lineup: string[];
  selectedId?: string | null;
}

export function FormationChemLines({ formation, chemLineData, lineup, selectedId }: FormationChemLinesProps) {
  const slots = useMemo(() => FORMATION_POSITIONS[formation] || [], [formation]);

  return (
    <>
      {chemLineData.map(({ a, b, color, strength }, i) => {
        const slotA = slots[a];
        const slotB = slots[b];
        if (!slotA || !slotB) return null;
        const idA = lineup[a];
        const idB = lineup[b];
        if (!idA || !idB) return null;

        const isRelevant = !selectedId || idA === selectedId || idB === selectedId;
        const opacity = isRelevant ? (strength >= 3 ? 0.75 : 0.45) : 0.1;

        const [ax, ay, az] = slotToWorld(slotA.x, slotA.y);
        const [bx, by, bz] = slotToWorld(slotB.x, slotB.y);

        const points: [number, number, number][] = [
          [ax, ay + 0.2, az],
          [bx, by + 0.2, bz],
        ];

        return (
          <Line
            key={`chem-${i}`}
            points={points}
            color={color}
            lineWidth={strength >= 3 ? 2.5 : 1.5}
            transparent
            opacity={opacity}
          />
        );
      })}
    </>
  );
}
