import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GoalBurstCanvasProps {
  hueBase: number;
  hueRange?: number;
  saturation?: number;
  lightness?: number;
  count?: number;
  speed?: number;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

function BurstParticles({ hueBase, hueRange = 20, saturation = 96, lightness = 50, count = 150, speed = 1 }: GoalBurstCanvasProps) {
  const pointsRef = useRef<THREE.Points>(null!);
  const particles = useRef<Particle[]>([]);
  const started = useRef(false);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, [count]);

  useEffect(() => {
    particles.current = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.3) * Math.PI;
      const spd = (3 + Math.random() * 6) * speed;
      const hue = (hueBase + (Math.random() - 0.5) * hueRange) / 360;
      const sat = saturation / 100;
      const lit = (lightness + Math.random() * 20) / 100;
      const color = new THREE.Color();
      color.setHSL(hue, sat, lit);
      return {
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
          0,
        ),
        velocity: new THREE.Vector3(
          Math.cos(angle) * Math.cos(elevation) * spd,
          Math.sin(elevation) * spd * 0.8 + 2,
          Math.sin(angle) * Math.cos(elevation) * spd,
        ),
        life: 1,
        maxLife: (1.5 + Math.random() * 1.5) / speed,
        color,
      };
    });
    started.current = true;
  }, []);

  useFrame((_, delta) => {
    if (!started.current || !pointsRef.current) return;
    const posArr = geometry.attributes.position.array as Float32Array;
    const colArr = geometry.attributes.color.array as Float32Array;

    particles.current.forEach((p, i) => {
      p.life -= delta / p.maxLife;
      if (p.life < 0) p.life = 0;
      p.velocity.y -= delta * 8;
      p.position.addScaledVector(p.velocity, delta);
      posArr[i * 3] = p.position.x;
      posArr[i * 3 + 1] = p.position.y;
      posArr[i * 3 + 2] = p.position.z;
      const alpha = Math.max(0, p.life);
      colArr[i * 3] = p.color.r * alpha;
      colArr[i * 3 + 1] = p.color.g * alpha;
      colArr[i * 3 + 2] = p.color.b * alpha;
    });

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.18}
        vertexColors
        transparent
        opacity={1}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function GoalBurstCanvas({
  hueBase = 43, hueRange = 20, saturation = 96, lightness = 50, count = 150, speed = 1,
}: GoalBurstCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 60 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      dpr={[1, 1.5]}
      style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
    >
      <BurstParticles
        hueBase={hueBase}
        hueRange={hueRange}
        saturation={saturation}
        lightness={lightness}
        count={count}
        speed={speed}
      />
    </Canvas>
  );
}
