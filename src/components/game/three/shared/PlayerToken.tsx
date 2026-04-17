import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

interface PlayerTokenProps {
  position: [number, number, number];
  color: string;
  label?: string;
  isHome: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  flashing?: 'goal' | 'yellow' | 'red' | 'injury' | null;
}

export function PlayerToken({ position, color, label, isHome, highlighted, dimmed, flashing }: PlayerTokenProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const flashTimer = useRef(0);

  const baseColor = useMemo(() => {
    try { return new THREE.Color(color); } catch { return new THREE.Color('#ffffff'); }
  }, [color]);

  const flashColor = useMemo(() => {
    if (flashing === 'goal') return new THREE.Color(0xffd700);
    if (flashing === 'yellow') return new THREE.Color(0xfbbf24);
    if (flashing === 'red') return new THREE.Color(0xef4444);
    if (flashing === 'injury') return new THREE.Color(0xff3333);
    return baseColor;
  }, [flashing, baseColor]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;

    if (flashing) {
      flashTimer.current += 0.1;
      const pulse = Math.abs(Math.sin(flashTimer.current * 6));
      (meshRef.current.material as THREE.MeshBasicMaterial).color.lerpColors(baseColor, flashColor, pulse);
    } else {
      (meshRef.current.material as THREE.MeshBasicMaterial).color.copy(baseColor);
    }

    if (highlighted) {
      const s = 1 + Math.sin(t * 3) * 0.08;
      meshRef.current.scale.setScalar(s);
    } else {
      meshRef.current.scale.setScalar(dimmed ? 0.75 : 1);
    }
  });

  return (
    <group position={position}>
      {/* Glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.3, 1.8, 16]} />
        <meshBasicMaterial color={baseColor} transparent opacity={dimmed ? 0.05 : 0.15} />
      </mesh>

      {/* Main disc */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <circleGeometry args={[1.2, 16]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>

      {/* White border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
        <ringGeometry args={[1.2, 1.45, 16]} />
        <meshBasicMaterial color={isHome ? 0xffffff : 0xcccccc} transparent opacity={dimmed ? 0.2 : 0.6} />
      </mesh>

      {/* Label */}
      {label && !dimmed && (
        <Html center position={[0, 1.2, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui',
          }}>
            {label}
          </span>
        </Html>
      )}
    </group>
  );
}
