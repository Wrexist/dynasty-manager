import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { PitchGeometry, slotToWorld } from '../shared/PitchGeometry';
import { PlayerToken } from '../shared/PlayerToken';
import { FormationChemLines } from './FormationChemLines';
import { useFormationTransition } from './useFormationTransition';
import { Html } from '@react-three/drei';
import { type FormationType, FORMATION_POSITIONS } from '@/types/game';
import type { Player } from '@/types/game';

interface ChemLine {
  a: number;
  b: number;
  color: string;
  strength: number;
}

interface FormationCanvasProps {
  formation: FormationType;
  lineup: string[];
  players: Record<string, Player>;
  clubColor: string;
  chemLineData: ChemLine[];
  selectedId?: string | null;
  onTokenTap?: (playerId: string) => void;
  onSlotTap?: (slotIndex: number) => void;
  week?: number;
  showOverall?: boolean;
  // Camera preset: 'half' = half pitch (LineupEditor), 'full' = full pitch (formation review)
  cameraPreset?: 'half' | 'full';
}

function TokensLayer({
  formation, lineup, players, clubColor,
  selectedId, onTokenTap, onSlotTap, showOverall, week,
}: Omit<FormationCanvasProps, 'chemLineData' | 'cameraPreset'>) {
  const { posRefs, slots } = useFormationTransition(formation, true);
  const selectedChemPartners = new Set<string>();

  return (
    <>
      {slots.map((slot, i) => {
        const pid = lineup[i];
        const player = pid ? players[pid] : null;
        const pos = posRefs.current[i];
        if (!pos) return null;

        const isSelected = selectedId === pid;
        const isFaded = !!selectedId && !isSelected && !!pid && !selectedChemPartners.has(pid);
        const label = showOverall && player
          ? `${player.overall}`
          : player
            ? `${player.position}`
            : slot.pos;

        return (
          <group key={`slot-${i}`} position={[pos.x, pos.y, pos.z]}>
            {player ? (
              <>
                <PlayerToken
                  position={[0, 0, 0]}
                  color={clubColor}
                  isHome={true}
                  label={label}
                  highlighted={isSelected}
                  dimmed={isFaded}
                  flashing={null}
                />
                {/* Invisible hit area */}
                <Html center>
                  <div
                    style={{ width: 36, height: 36, cursor: 'pointer', opacity: 0 }}
                    onClick={() => onTokenTap?.(pid)}
                  />
                </Html>
              </>
            ) : (
              <group>
                {/* Empty slot ring */}
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.9, 1.4, 16]} />
                  <meshBasicMaterial color={0xffffff} transparent opacity={0.15} />
                </mesh>
                <Html center>
                  <div
                    style={{ width: 36, height: 36, cursor: 'pointer', opacity: 0 }}
                    onClick={() => onSlotTap?.(i)}
                  />
                </Html>
              </group>
            )}
          </group>
        );
      })}
    </>
  );
}

export default function FormationCanvas({
  formation, lineup, players, clubColor,
  chemLineData, selectedId, onTokenTap, onSlotTap,
  week, showOverall, cameraPreset = 'half',
}: FormationCanvasProps) {
  // Half-pitch: look at defensive half (y 46-105 in pitch space → negative Z in world)
  const camPos: [number, number, number] = cameraPreset === 'half'
    ? [0, 40, 30]
    : [0, 55, 48];
  const camTarget: [number, number, number] = cameraPreset === 'half'
    ? [0, 0, 20]
    : [0, 0, 0];

  return (
    <Canvas
      camera={{ position: camPos, fov: 45, near: 0.1, far: 300 }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      dpr={[1, 1.5]}
      style={{ width: '100%', height: '100%', display: 'block' }}
      onCreated={({ camera }) => {
        camera.lookAt(...camTarget);
        camera.updateProjectionMatrix();
      }}
    >
      <ambientLight intensity={0.9} />
      <Suspense fallback={null}>
        <PitchGeometry />
        <FormationChemLines
          formation={formation}
          chemLineData={chemLineData}
          lineup={lineup}
          selectedId={selectedId}
        />
        <TokensLayer
          formation={formation}
          lineup={lineup}
          players={players}
          clubColor={clubColor}
          selectedId={selectedId}
          onTokenTap={onTokenTap}
          onSlotTap={onSlotTap}
          showOverall={showOverall}
          week={week}
        />
      </Suspense>
    </Canvas>
  );
}
