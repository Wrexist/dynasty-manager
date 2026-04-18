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
  reducedMotion?: boolean;
}

export function PlayerToken({ position, color, label, isHome, highlighted, dimmed, flashing, reducedMotion }: PlayerTokenProps) {
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

    // Tick the timer whenever we're doing any pulsing animation — previously it
    // only ticked inside `if (flashing)`, so the highlight-pulse (selected
    // player, no flash) stayed stuck at sin(0)=0 and never pulsed visibly.
    // Wrap at 2π so the number stays bounded even if a player is highlighted
    // for a long time; the sin/cos curves are 2π-periodic so wrapping is
    // visually identical and protects against fp drift on very long sessions.
    if ((flashing || highlighted) && !reducedMotion) {
      flashTimer.current = (flashTimer.current + delta * 6) % (Math.PI * 2);
    }

    if (flashing) {
      if (reducedMotion) {
        mat.color.copy(flashColor);
      } else {
        const pulse = Math.abs(Math.sin(flashTimer.current));
        mat.color.lerpColors(baseColor, flashColor, pulse);
      }
    } else {
      mat.color.copy(baseColor);
    }

    // Scale for highlighted/dimmed — reduced-motion mode pins to the static target.
    // Frame-rate corrected damping: the old `* 0.15` per frame was ~2x faster
    // at 60fps than at 30fps, visibly jerky on sub-60fps devices.
    const targetScale = highlighted
      ? (reducedMotion ? 1.08 : 1 + Math.sin(flashTimer.current * 3) * 0.08)
      : dimmed ? 0.75 : 1.0;
    if (reducedMotion) {
      meshRef.current.scale.setScalar(targetScale);
    } else {
      const alpha = 1 - Math.pow(0.85, delta * 60);
      const current = meshRef.current.scale.x;
      meshRef.current.scale.setScalar(current + (targetScale - current) * alpha);
    }
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
