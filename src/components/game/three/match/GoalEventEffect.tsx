import { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PITCH_H, PITCH_W } from '../shared/PitchGeometry';

interface GoalBurstParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

interface GoalEventEffectProps {
  isHome: boolean; // home team scored → burst at top goal, away → bottom
  color: string;
  trigger: number; // increment to re-trigger
}

export function GoalEventEffect({ isHome, color, trigger }: GoalEventEffectProps) {
  const pointsRef = useRef<THREE.Points>(null!);
  const particles = useRef<GoalBurstParticle[]>([]);
  const [active, setActive] = useState(false);

  const goalZ = isHome ? -(PITCH_H / 2) - 2 : PITCH_H / 2 + 2;

  const baseColor = useMemo(() => {
    const c = new THREE.Color();
    try { c.set(color); } catch { c.set('#ffd700'); }
    return c;
  }, [color]);

  // Spawn particles on trigger
  useEffect(() => {
    if (trigger === 0) return;
    const count = 80;
    particles.current = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 18;
      const elevation = Math.random() * Math.PI * 0.6;
      return {
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          0.5,
          goalZ,
        ),
        velocity: new THREE.Vector3(
          Math.cos(angle) * Math.cos(elevation) * speed,
          Math.sin(elevation) * speed * 0.8 + 4,
          Math.sin(angle) * Math.cos(elevation) * speed * 0.4,
        ),
        life: 1,
        maxLife: 1.5 + Math.random() * 1.0,
        color: baseColor.clone().lerp(new THREE.Color(0xffffff), Math.random() * 0.3),
      };
    });
    setActive(true);
  }, [trigger, goalZ, baseColor]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(80 * 3);
    const col = new Float32Array(80 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (!active || !pointsRef.current) return;
    const posArr = geometry.attributes.position.array as Float32Array;
    const colArr = geometry.attributes.color.array as Float32Array;

    let anyAlive = false;
    particles.current.forEach((p, i) => {
      if (p.life <= 0) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -999; posArr[i * 3 + 2] = 0;
        return;
      }
      p.life -= delta / p.maxLife;
      p.velocity.y -= delta * 12;
      p.position.addScaledVector(p.velocity, delta);
      posArr[i * 3] = p.position.x;
      posArr[i * 3 + 1] = p.position.y;
      posArr[i * 3 + 2] = p.position.z;
      const alpha = Math.max(0, p.life);
      colArr[i * 3] = p.color.r * alpha;
      colArr[i * 3 + 1] = p.color.g * alpha;
      colArr[i * 3 + 2] = p.color.b * alpha;
      if (p.life > 0) anyAlive = true;
    });

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    if (!anyAlive) setActive(false);
  });

  if (!active) return null;

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={1.2}
        vertexColors
        transparent
        opacity={1}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
