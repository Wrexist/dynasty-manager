import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { FORMATION_POSITIONS, type FormationType } from '@/types/game';
import { slotToWorld } from '../shared/PitchGeometry';

// Returns a map of slot index → current animated world position
export function useFormationTransition(formation: FormationType, isHome = true) {
  const slots = useMemo(() => FORMATION_POSITIONS[formation] || [], [formation]);

  const posRefs = useRef<THREE.Vector3[]>([]);
  const targetRefs = useRef<THREE.Vector3[]>([]);

  // Initialize on mount
  useEffect(() => {
    if (posRefs.current.length === 0) {
      posRefs.current = slots.map(s => {
        const sx = isHome ? s.x : 100 - s.x;
        const sy = isHome ? s.y : 100 - s.y;
        const [x, , z] = slotToWorld(sx, sy);
        return new THREE.Vector3(x, 0.15, z);
      });
      targetRefs.current = posRefs.current.map(p => p.clone());
    }
  }, []);

  // Update targets when formation changes
  useEffect(() => {
    const newTargets = slots.map(s => {
      const sx = isHome ? s.x : 100 - s.x;
      const sy = isHome ? s.y : 100 - s.y;
      const [x, , z] = slotToWorld(sx, sy);
      return new THREE.Vector3(x, 0.15, z);
    });
    // Ensure posRefs is big enough
    while (posRefs.current.length < newTargets.length) {
      posRefs.current.push(newTargets[posRefs.current.length].clone());
    }
    targetRefs.current = newTargets;
  }, [formation, isHome, slots]);

  // Lerp toward targets every frame
  useFrame(() => {
    posRefs.current.forEach((pos, i) => {
      if (targetRefs.current[i]) {
        pos.lerp(targetRefs.current[i], 0.08);
      }
    });
  });

  return { posRefs, slots };
}
