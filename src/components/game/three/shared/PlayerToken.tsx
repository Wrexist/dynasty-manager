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
  const flashTimer = useRef(0);
  const prevFlashing = useRef<string | null | undefined>(null);

  const baseColor = useMemo(() => {
    const c = new THREE.Color();
    try { c.set(color); } catch { c.set('#ffffff'); }
    return c;
  }, [color]);

  const flashColor = useMemo(() => {
    if (flashing === 'goal') return new THREE.Color(0xffd700);
    if (flashing === 'yellow') return new THREE.Color(0xfbbf24);
    if (flashing === 'red') return new THREE.Color(0xef4444);
    if (flashing === 'injury') return new THREE.Color(0xff3333);
    return baseColor.clone();
  }, [flashing, baseColor]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;

    // Reset timer when flash state changes
    if (prevFlashing.current !== flashing) {
      flashTimer.current = 0;
      prevFlashing.current = flashing;
    }

    if (flashing) {
      flashTimer.current += delta * 6;
      const pulse = Math.abs(Math.sin(flashTimer.current));
      mat.color.lerpColors(baseColor, flashColor, pulse);
    } else {
      mat.color.copy(baseColor);
    }

    // Scale for highlighted/dimmed
    const targetScale = highlighted ? 1 + Math.sin(flashTimer.current * 3) * 0.08 : dimmed ? 0.75 : 1.0;
    meshRef.current.scale.setScalar(
      meshRef.current.scale.x + (targetScale - meshRef.current.scale.x) * 0.15,
    );
  });

  return (
    <group position={position}>
      {/* Shadow/glow ring on pitch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.2, 1.9, 20]} />
        <meshBasicMaterial color={baseColor} transparent opacity={dimmed ? 0.04 : highlighted ? 0.25 : 0.12} />
      </mesh>

      {/* Main disc */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <circleGeometry args={[1.15, 20]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>

      {/* White border ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
        <ringGeometry args={[1.15, 1.45, 20]} />
        <meshBasicMaterial
          color={isHome ? 0xffffff : 0xdddddd}
          transparent
          opacity={dimmed ? 0.15 : highlighted ? 0.9 : 0.55}
        />
      </mesh>

      {/* Label */}
      {label && (
        <Html
          center
          position={[0, 1.4, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          distanceFactor={28}
        >
          <span style={{
            fontSize: '11px',
            fontWeight: 800,
            color: '#fff',
            textShadow: '0 0 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '0.02em',
          }}>
            {label}
          </span>
        </Html>
      )}
    </group>
  );
}
