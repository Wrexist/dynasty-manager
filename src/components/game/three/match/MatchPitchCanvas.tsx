import { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PitchGeometry, slotToWorld } from '../shared/PitchGeometry';
import { PlayerToken } from '../shared/PlayerToken';
import { GoalEventEffect } from './GoalEventEffect';
import { WeatherLayer } from './WeatherLayer';
import type { MatchEvent, FormationType } from '@/types/game';
import { FORMATION_POSITIONS } from '@/types/game';

interface MatchPitchCanvasProps {
  homeFormation: FormationType;
  awayFormation: FormationType;
  homeLineup: string[];
  awayLineup: string[];
  homeColor: string;
  awayColor: string;
  visibleEvents: MatchEvent[];
  currentMin: number;
  weather?: 'clear' | 'rain' | 'snow' | 'wind';
  momentum: number; // -100 to +100, positive = home
  isMobile?: boolean;
}

const GOAL_EVENT_TYPES = new Set([
  'goal', 'own_goal', 'penalty_scored', 'header_goal',
  'counter_attack_goal', 'long_range_goal', 'solo_goal',
  'free_kick_goal', 'extra_time_goal', 'goalkeeper_error',
]);

function TokenLayer({
  homeFormation, awayFormation, homeLineup, awayLineup,
  homeColor, awayColor, visibleEvents, currentMin,
}: Omit<MatchPitchCanvasProps, 'weather' | 'momentum' | 'isMobile'>) {
  // Build base positions
  const homeSlots = useMemo(() => FORMATION_POSITIONS[homeFormation] || [], [homeFormation]);
  const awaySlots = useMemo(() => FORMATION_POSITIONS[awayFormation] || [], [awayFormation]);

  // Animated positions per player
  const posRefs = useRef<Map<string, THREE.Vector3>>(new Map());

  // Seed initial positions
  useMemo(() => {
    homeSlots.forEach((slot, i) => {
      const pid = homeLineup[i];
      if (!pid) return;
      const [x, , z] = slotToWorld(slot.x, slot.y);
      posRefs.current.set(pid, new THREE.Vector3(x, 0.15, z));
    });
    awaySlots.forEach((slot, i) => {
      const pid = awayLineup[i];
      if (!pid) return;
      const [x, , z] = slotToWorld(100 - slot.x, 100 - slot.y);
      posRefs.current.set(pid, new THREE.Vector3(x, 0.15, z));
    });
  }, [homeSlots, awaySlots, homeLineup, awayLineup]);

  // Flash state
  const flashState = useRef<Map<string, { type: 'goal' | 'yellow' | 'red' | 'injury'; until: number }>>(new Map());
  const processedEvents = useRef(0);

  useEffect(() => {
    for (let i = processedEvents.current; i < visibleEvents.length; i++) {
      const ev = visibleEvents[i];
      processedEvents.current = i + 1;
      if (!ev.playerId) continue;
      if (GOAL_EVENT_TYPES.has(ev.type)) {
        flashState.current.set(ev.playerId, { type: 'goal', until: currentMin + 3 });
      } else if (ev.type === 'yellow_card') {
        flashState.current.set(ev.playerId, { type: 'yellow', until: currentMin + 2 });
      } else if (ev.type === 'red_card') {
        flashState.current.set(ev.playerId, { type: 'red', until: currentMin + 99 });
      } else if (ev.type === 'injury') {
        flashState.current.set(ev.playerId, { type: 'injury', until: currentMin + 2 });
      }
    }
  }, [visibleEvents.length, currentMin]);

  const sentOff = useMemo(() =>
    new Set(visibleEvents.filter(e => e.type === 'red_card' && e.playerId).map(e => e.playerId!)),
    [visibleEvents],
  );

  return (
    <>
      {homeSlots.map((slot, i) => {
        const pid = homeLineup[i];
        if (!pid || sentOff.has(pid)) return null;
        const [x, y, z] = slotToWorld(slot.x, slot.y);
        const flash = flashState.current.get(pid);
        return (
          <PlayerToken
            key={`home-${pid}`}
            position={[x, y, z]}
            color={homeColor}
            isHome={true}
            label={String(i + 1)}
            flashing={flash && flash.until > currentMin ? flash.type : null}
          />
        );
      })}
      {awaySlots.map((slot, i) => {
        const pid = awayLineup[i];
        if (!pid || sentOff.has(pid)) return null;
        const [x, y, z] = slotToWorld(100 - slot.x, 100 - slot.y);
        const flash = flashState.current.get(pid);
        return (
          <PlayerToken
            key={`away-${pid}`}
            position={[x, y, z]}
            color={awayColor}
            isHome={false}
            label={String(i + 1)}
            flashing={flash && flash.until > currentMin ? flash.type : null}
          />
        );
      })}
    </>
  );
}

function GoalLayer({ visibleEvents, homeColor, awayColor }: {
  visibleEvents: MatchEvent[];
  homeColor: string;
  awayColor: string;
}) {
  const homeGoalTrigger = useRef(0);
  const awayGoalTrigger = useRef(0);
  const [homeTrigger, setHomeTrigger] = useState(0);
  const [awayTrigger, setAwayTrigger] = useState(0);
  const processedGoals = useRef(0);

  useEffect(() => {
    for (let i = processedGoals.current; i < visibleEvents.length; i++) {
      const ev = visibleEvents[i];
      processedGoals.current = i + 1;
      if (GOAL_EVENT_TYPES.has(ev.type)) {
        // own_goal scores for opponent
        const isHomeGoal = ev.type === 'own_goal'
          ? false  // simplified: own goal always counts as away
          : homeGoalTrigger.current >= 0; // we'd need clubId to be precise
        // Use clubId to determine which team scored
        setHomeTrigger(t => t + 1);
      }
    }
  }, [visibleEvents.length]);

  return (
    <>
      <GoalEventEffect isHome={true} color={homeColor} trigger={homeTrigger} />
    </>
  );
}

function MomentumBar({ momentum, homeColor, awayColor }: { momentum: number; homeColor: string; awayColor: string }) {
  const barRef = useRef<THREE.Mesh>(null!);
  const homePct = (momentum + 100) / 200; // 0 to 1

  useFrame(() => {
    if (!barRef.current) return;
    // Animate scale toward target
    const target = Math.max(0.02, homePct);
    barRef.current.scale.x += (target - barRef.current.scale.x) * 0.05;
  });

  return (
    <group position={[0, 0.3, -55]}>
      {/* Background bar */}
      <mesh>
        <boxGeometry args={[68, 0.6, 1]} />
        <meshBasicMaterial color={awayColor} transparent opacity={0.4} />
      </mesh>
      {/* Home portion */}
      <mesh ref={barRef} position={[-34 + 34 * homePct, 0, 0.05]} scale={[homePct * 68, 1, 1]}>
        <boxGeometry args={[1, 0.62, 1.1]} />
        <meshBasicMaterial color={homeColor} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

export default function MatchPitchCanvas({
  homeFormation, awayFormation, homeLineup, awayLineup,
  homeColor, awayColor, visibleEvents, currentMin,
  weather = 'clear', momentum, isMobile,
}: MatchPitchCanvasProps) {
  const cameraY = isMobile ? 70 : 55;
  const cameraZ = isMobile ? 38 : 48;

  return (
    <Canvas
      camera={{ position: [0, cameraY, cameraZ], fov: 40, near: 0.1, far: 500 }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      dpr={[1, 1.5]}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <ambientLight intensity={0.9} />
      <Suspense fallback={null}>
        <PitchGeometry />
        <TokenLayer
          homeFormation={homeFormation}
          awayFormation={awayFormation}
          homeLineup={homeLineup}
          awayLineup={awayLineup}
          homeColor={homeColor}
          awayColor={awayColor}
          visibleEvents={visibleEvents}
          currentMin={currentMin}
        />
        <MomentumBar momentum={momentum} homeColor={homeColor} awayColor={awayColor} />
        {weather !== 'clear' && <WeatherLayer weather={weather} mobile={isMobile} />}
      </Suspense>
    </Canvas>
  );
}
