import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FORMATION_POSITIONS, type FormationType, type MatchEvent } from '@/types/game';
import { slotToWorld } from '../shared/PitchGeometry';

export interface TokenPosition {
  playerId: string;
  world: THREE.Vector3;
  isHome: boolean;
  label: string;
  flashing: 'goal' | 'yellow' | 'red' | 'injury' | null;
}

const GOAL_EVENT_TYPES = new Set([
  'goal', 'own_goal', 'penalty_scored', 'header_goal',
  'counter_attack_goal', 'long_range_goal', 'solo_goal',
  'free_kick_goal', 'extra_time_goal', 'goalkeeper_error',
]);

// Build base positions for a team's formation
function buildBasePositions(
  formation: FormationType,
  lineup: string[],
  isHome: boolean,
): Map<string, THREE.Vector3> {
  const slots = FORMATION_POSITIONS[formation] || [];
  const map = new Map<string, THREE.Vector3>();
  slots.forEach((slot, i) => {
    const pid = lineup[i];
    if (!pid) return;
    // Mirror away team: x = 100 - slot.x, y = 100 - slot.y (both axes flipped)
    const sx = isHome ? slot.x : 100 - slot.x;
    const sy = isHome ? slot.y : 100 - slot.y;
    const [wx, , wz] = slotToWorld(sx, sy);
    map.set(pid, new THREE.Vector3(wx, 0.15, wz));
  });
  return map;
}

export function useMatchPositions(
  homeFormation: FormationType,
  awayFormation: FormationType,
  homeLineup: string[],
  awayLineup: string[],
  visibleEvents: MatchEvent[],
  currentMin: number,
) {
  const homeBase = useMemo(
    () => buildBasePositions(homeFormation, homeLineup, true),
    [homeFormation, homeLineup],
  );
  const awayBase = useMemo(
    () => buildBasePositions(awayFormation, awayLineup, false),
    [awayFormation, awayLineup],
  );

  // Current world positions (animated refs)
  const posRefs = useRef<Map<string, THREE.Vector3>>(new Map());
  const targetRefs = useRef<Map<string, THREE.Vector3>>(new Map());
  const flashState = useRef<Map<string, { type: 'goal' | 'yellow' | 'red' | 'injury'; until: number }>>(new Map());

  // Whenever lineup or formation changes, seed posRefs from bases
  useEffect(() => {
    const allBase = new Map([...homeBase, ...awayBase]);
    allBase.forEach((pos, pid) => {
      if (!posRefs.current.has(pid)) {
        posRefs.current.set(pid, pos.clone());
      }
      targetRefs.current.set(pid, pos.clone());
    });
  }, [homeBase, awayBase]);

  // Process latest event to drive position offsets
  const lastProcessedEvent = useRef(-1);
  useEffect(() => {
    for (let i = lastProcessedEvent.current + 1; i < visibleEvents.length; i++) {
      const ev = visibleEvents[i];
      lastProcessedEvent.current = i;

      const isHomeEvent = homeLineup.includes(ev.playerId || '');
      const base = isHomeEvent ? homeBase : awayBase;

      if (GOAL_EVENT_TYPES.has(ev.type) && ev.playerId) {
        // Move scorer toward opponent goal
        const basePos = base.get(ev.playerId);
        if (basePos) {
          const targetZ = isHomeEvent ? -PITCH_PUSH : PITCH_PUSH;
          const newTarget = basePos.clone();
          newTarget.z = targetZ;
          targetRefs.current.set(ev.playerId, newTarget);
          flashState.current.set(ev.playerId, { type: 'goal', until: currentMin + 3 });
          setTimeout(() => targetRefs.current.set(ev.playerId, basePos.clone()), 4000);
        }
        // Assist player
        if (ev.assistPlayerId) {
          const assistBase = homeBase.get(ev.assistPlayerId) || awayBase.get(ev.assistPlayerId);
          if (assistBase) {
            const t = assistBase.clone();
            t.z += isHomeEvent ? -5 : 5;
            targetRefs.current.set(ev.assistPlayerId, t);
            setTimeout(() => targetRefs.current.set(ev.assistPlayerId, assistBase.clone()), 3000);
          }
        }
      }

      if (ev.type === 'yellow_card' && ev.playerId) {
        flashState.current.set(ev.playerId, { type: 'yellow', until: currentMin + 2 });
      }
      if (ev.type === 'red_card' && ev.playerId) {
        flashState.current.set(ev.playerId, { type: 'red', until: currentMin + 99 });
      }
      if (ev.type === 'injury' && ev.playerId) {
        flashState.current.set(ev.playerId, { type: 'injury', until: currentMin + 2 });
      }
    }
  }, [visibleEvents.length, homeLineup, awayLineup, homeBase, awayBase, currentMin]);

  // Lerp positions toward targets every frame
  useFrame(() => {
    targetRefs.current.forEach((target, pid) => {
      let current = posRefs.current.get(pid);
      if (!current) {
        current = target.clone();
        posRefs.current.set(pid, current);
      }
      current.lerp(target, 0.06);
    });
  });

  // Build token snapshot from refs
  const tokens = useMemo((): TokenPosition[] => {
    const result: TokenPosition[] = [];
    const sentOff = new Set(
      visibleEvents.filter(e => e.type === 'red_card').map(e => e.playerId).filter(Boolean),
    );

    homeLineup.forEach((pid, i) => {
      if (!pid || sentOff.has(pid)) return;
      const base = homeBase.get(pid);
      if (!base) return;
      const flash = flashState.current.get(pid);
      result.push({
        playerId: pid,
        world: base,
        isHome: true,
        label: `${i + 1}`,
        flashing: flash && flash.until > currentMin ? flash.type : null,
      });
    });

    awayLineup.forEach((pid, i) => {
      if (!pid || sentOff.has(pid)) return;
      const base = awayBase.get(pid);
      if (!base) return;
      const flash = flashState.current.get(pid);
      result.push({
        playerId: pid,
        world: base,
        isHome: false,
        label: `${i + 1}`,
        flashing: flash && flash.until > currentMin ? flash.type : null,
      });
    });

    return result;
  }, [homeLineup, awayLineup, homeBase, awayBase, visibleEvents, currentMin]);

  return { tokens, posRefs };
}

const PITCH_PUSH = 20;
