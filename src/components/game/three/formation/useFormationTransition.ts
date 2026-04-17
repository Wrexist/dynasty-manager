import { useRef, useLayoutEffect, useMemo, useCallback } from 'react';
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

  // Stable per-index callback refs. Creating a fresh `(el) => …` on every
  // render would cause React to fire the ref callback with `null` then the
  // element on every re-render, churning groupRefs.current on every parent
  // state change.
  const slotCallbacks = useRef<Array<(el: THREE.Group | null) => void>>([]);
  const registerSlotRef = useCallback((index: number) => {
    if (!slotCallbacks.current[index]) {
      slotCallbacks.current[index] = (el) => {
        groupRefs.current[index] = el;
      };
    }
    return slotCallbacks.current[index];
  }, []);

  // Recompute targets whenever formation/isHome changes; seed `current` on first
  // appearance and for any newly added slot. Shrink arrays if the new formation
  // has fewer slots than a previous one. Runs as a layout effect so the group
  // positions are committed synchronously before the first paint — otherwise
  // tokens flash at origin for one frame before useFrame moves them.
  useLayoutEffect(() => {
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
    // Shrink: trim stale refs + callback slots so memory doesn't accumulate
    // across formation changes.
    if (currentRefs.current.length > newTargets.length) {
      currentRefs.current.length = newTargets.length;
      groupRefs.current.length = newTargets.length;
      slotCallbacks.current.length = newTargets.length;
    }
    targetRefs.current = newTargets;

    // Always seed the live group's position so first paint renders at the
    // correct spot. Reduced-motion mode additionally snaps `current` so the
    // next useFrame pass is a no-op.
    for (let i = 0; i < newTargets.length; i++) {
      if (reducedMotion) currentRefs.current[i].copy(newTargets[i]);
      const g = groupRefs.current[i];
      if (g) g.position.copy(currentRefs.current[i]);
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
