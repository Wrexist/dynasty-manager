import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { PitchGeometry, slotToWorld } from '../shared/PitchGeometry';
import { PlayerToken } from '../shared/PlayerToken';
import { FormationChemLines } from './FormationChemLines';
import { useFormationTransition } from './useFormationTransition';
import { Html } from '@react-three/drei';
import { type FormationType } from '@/types/game';
import type { Player } from '@/types/game';

interface ChemLink {
  playerIdA: string;
  playerIdB: string;
}

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
  chemLinks?: ChemLink[];
  selectedId?: string | null;
  onTokenTap?: (playerId: string) => void;
  onSlotTap?: (slotIndex: number) => void;
  week?: number;
  showOverall?: boolean;
  cameraPreset?: 'half' | 'full';
}

function TokensLayer({
  formation, lineup, players, clubColor,
  selectedId, onTokenTap, onSlotTap, showOverall, week, chemLinks,
}: Omit<FormationCanvasProps, 'chemLineData' | 'cameraPreset'>) {
  const { posRefs, slots } = useFormationTransition(formation, true);

  // Compute selected player's chem partners to dim unrelated players
  const selectedChemPartners = useMemo(() => {
    if (!selectedId || !chemLinks) return new Set<string>();
    const partners = new Set<string>();
    for (const link of chemLinks) {
      if (link.playerIdA === selectedId) partners.add(link.playerIdB);
      if (link.playerIdB === selectedId) partners.add(link.playerIdA);
    }
    return partners;
  }, [selectedId, chemLinks]);

  return (
    <>
      {slots.map((slot, i) => {
        const pid = lineup[i];
        const player = pid ? players[pid] : null;
        const pos = posRefs.current[i];
        if (!pos) return null;

        const isSelected = selectedId === pid;
        const isFaded = !!selectedId && !isSelected && !!pid && !selectedChemPartners.has(pid);
        const label = player
          ? (showOverall ? `${player.overall}` : player.position)
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
                <Html center>
                  <div
                    style={{ width: 38, height: 38, cursor: 'pointer', opacity: 0 }}
                    onClick={() => onTokenTap?.(pid)}
                  />
                </Html>
              </>
            ) : (
              <group>
                {/* Empty slot indicator */}
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.9, 1.45, 16]} />
                  <meshBasicMaterial color={0xffffff} transparent opacity={isSelected ? 0.35 : 0.12} />
                </mesh>
                <Html center>
                  <div
                    style={{ width: 38, height: 38, cursor: 'pointer', opacity: 0 }}
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
  chemLineData, chemLinks, selectedId, onTokenTap, onSlotTap,
  week, showOverall, cameraPreset = 'half',
}: FormationCanvasProps) {
  const camPos: [number, number, number] = cameraPreset === 'half' ? [0, 42, 32] : [0, 58, 52];
  const lookAt: [number, number, number] = cameraPreset === 'half' ? [0, 0, 18] : [0, 0, 0];

  return (
    <Canvas
      camera={{ position: camPos, fov: 42, near: 0.1, far: 400 }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      dpr={[1, Math.min(1.5, window.devicePixelRatio)]}
      style={{ width: '100%', height: '100%', display: 'block' }}
      onCreated={({ camera }) => {
        camera.lookAt(...lookAt);
        camera.updateProjectionMatrix();
      }}
    >
      <ambientLight intensity={0.95} />
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
          chemLinks={chemLinks}
        />
      </Suspense>
    </Canvas>
  );
}
