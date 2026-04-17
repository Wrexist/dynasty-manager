import { useRef, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { FORMATION_POSITIONS, type FormationType } from '@/types/game';
import { slotToWorld } from '../shared/PitchGeometry';

/**
 * Formation slot-position animation. Returns the slot array plus a
 * `registerSlotRef(index)` callback that callers pass as `ref` on each slot
 * `<group>`. The hook mutates each registered group's `.position` inside
 * `useFrame` — this is required because R3F only commits the `position` prop
 * on React re-renders, which happen too rarely to make a prop-driven lerp
 * visible between renders.
 */
export function useFormationTransition(formation: FormationType, isHome = true, reducedMotion = false) {
  const slots = useMemo(() => FORMATION_POSITIONS[formation] || [], [formation]);

  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const currentRefs = useRef<THREE.Vector3[]>([]);
  const targetRefs = useRef<THREE.Vector3[]>([]);

  const registerSlotRef = useCallback((index: number) => (el: THREE.Group | null) => {
    groupRefs.current[index] = el;
  }, []);

  // Recompute targets whenever formation/isHome changes; seed `current` on first
  // appearance and for any newly added slot. Shrink arrays if the new formation
  // has fewer slots than a previous one.
  useEffect(() => {
    const newTargets = slots.map(s => {
      const sx = isHome ? s.x : 100 - s.x;
      const sy = isHome ? s.y : 100 - s.y;
      const [x, , z] = slotToWorld(sx, sy);
      return new THREE.Vector3(x, 0.15, z);
    });

    // Grow: seed `current` for newly added slots to the target (prevents a fly-in from origin)
    while (currentRefs.current.length < newTargets.length) {
      currentRefs.current.push(newTargets[currentRefs.current.length].clone());
    }
    // Shrink: trim stale refs so memory doesn't accumulate across formation changes
    if (currentRefs.current.length > newTargets.length) {
      currentRefs.current.length = newTargets.length;
      groupRefs.current.length = newTargets.length;
    }
    targetRefs.current = newTargets;

    // Reduced motion: snap everything immediately and write through to the live groups
    if (reducedMotion) {
      for (let i = 0; i < newTargets.length; i++) {
        currentRefs.current[i].copy(newTargets[i]);
        const g = groupRefs.current[i];
        if (g) g.position.copy(newTargets[i]);
      }
    }
  }, [formation, isHome, slots, reducedMotion]);

  useFrame((_, delta) => {
    const targets = targetRefs.current;
    const currents = currentRefs.current;
    const groups = groupRefs.current;
    if (reducedMotion) {
      for (let i = 0; i < targets.length; i++) {
        const g = groups[i];
        if (g) g.position.copy(targets[i]);
      }
      return;
    }
    const alpha = 1 - Math.pow(0.92, delta * 60);
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const current = currents[i];
      if (!target || !current) continue;
      current.lerp(target, alpha);
      const g = groups[i];
      if (g) g.position.copy(current);
    }
  });

  return { slots, registerSlotRef };
}
