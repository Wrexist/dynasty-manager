import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useVisibilityFrameloop } from '../shared/useVisibilityFrameloop';

interface GoalBurstCanvasProps {
  hueBase: number;
  hueRange?: number;
  saturation?: number;
  lightness?: number;
  count?: number;
  speed?: number;
  reducedMotion?: boolean;
}

interface Particle {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  life: number;
  maxLife: number;
  r: number; g: number; b: number;
}

function BurstParticles({ hueBase, hueRange = 20, saturation = 96, lightness = 50, count = 150, speed = 1, onDone }: GoalBurstCanvasProps & { onDone: () => void }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const doneRef = useRef(false);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.25) * Math.PI;
      const spd = (3 + Math.random() * 7) * speed;
      const hue = ((hueBase + (Math.random() - 0.5) * hueRange) % 360) / 360;
      const sat = saturation / 100;
      const lit = (lightness + Math.random() * 20) / 100;
      const c = new THREE.Color().setHSL(hue, sat, lit);
      return {
        px: (Math.random() - 0.5) * 0.4,
        py: (Math.random() - 0.5) * 0.4,
        pz: 0,
        vx: Math.cos(angle) * Math.cos(elev) * spd,
        vy: Math.sin(elev) * spd * 0.9 + 2.5,
        vz: Math.sin(angle) * Math.cos(elev) * spd,
        life: 1,
        maxLife: (1.4 + Math.random() * 1.4) / speed,
        r: c.r, g: c.g, b: c.b,
      };
    });
  }, [count, hueBase, hueRange, saturation, lightness, speed]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return geo;
  }, [count]);

  useEffect(() => () => { geometry.dispose(); }, [geometry]);

  useFrame((_, delta) => {
    if (doneRef.current || !pointsRef.current) return;
    const posArr = geometry.attributes.position.array as Float32Array;
    const colArr = geometry.attributes.color.array as Float32Array;
    let anyAlive = false;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.life <= 0) {
        posArr[i * 3 + 1] = -999;
        continue;
      }
      p.life -= delta / p.maxLife;
      p.vx *= 0.99;
      p.vy -= delta * 9;
      p.vz *= 0.99;
      p.px += p.vx * delta;
      p.py += p.vy * delta;
      p.pz += p.vz * delta;
      posArr[i * 3] = p.px;
      posArr[i * 3 + 1] = p.py;
      posArr[i * 3 + 2] = p.pz;
      const alpha = Math.max(0, p.life);
      colArr[i * 3] = p.r * alpha;
      colArr[i * 3 + 1] = p.g * alpha;
      colArr[i * 3 + 2] = p.b * alpha;
      if (p.life > 0) anyAlive = true;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    if (!anyAlive && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial size={0.2} vertexColors transparent opacity={1} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export function GoalBurstCanvas({
  hueBase = 43, hueRange = 20, saturation = 96, lightness = 50, count = 150, speed = 1, reducedMotion = false,
}: GoalBurstCanvasProps) {
  const [mounted, setMounted] = useState(true);
  const frameloop = useVisibilityFrameloop();

  // Reduced-motion: skip the GPU burst entirely — the modal's 2D UI still reads.
  if (!mounted || reducedMotion) return null;

  // Halve particle count for motion-sensitive-but-not-disabled users is not used
  // here; callers decide by passing the full count. reducedMotion short-circuits.

  return (
    <Canvas
      frameloop={frameloop}
      camera={{ position: [0, 0, 10], fov: 55 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'default', preserveDrawingBuffer: false }}
      dpr={[1, Math.min(1.5, window.devicePixelRatio)]}
      style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
    >
      <BurstParticles
        hueBase={hueBase}
        hueRange={hueRange}
        saturation={saturation}
        lightness={lightness}
        count={count}
        speed={speed}
        onDone={() => setMounted(false)}
      />
    </Canvas>
  );
}
