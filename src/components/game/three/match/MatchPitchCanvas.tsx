import { Suspense, useRef, useMemo, useState, useEffect, useLayoutEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PitchGeometry, PITCH_H, slotToWorld } from '../shared/PitchGeometry';
import { PlayerToken } from '../shared/PlayerToken';
import { GoalEventEffect } from './GoalEventEffect';
import { WeatherLayer } from './WeatherLayer';
import { useVisibilityFrameloop } from '../shared/useVisibilityFrameloop';
import { FORMATION_POSITIONS, type FormationType, type MatchEvent } from '@/types/game';

interface MatchPitchCanvasProps {
  homeFormation: FormationType;
  awayFormation: FormationType;
  homeLineup: string[];
  awayLineup: string[];
  homeColor: string;
  awayColor: string;
  homeClubId: string;
  visibleEvents: MatchEvent[];
  currentMin: number;
  weather?: 'clear' | 'rain' | 'snow' | 'wind';
  momentum: number;
  isMobile?: boolean;
  reducedMotion?: boolean;
}

const GOAL_EVENT_TYPES = new Set([
  'goal', 'own_goal', 'penalty_scored', 'header_goal',
  'counter_attack_goal', 'long_range_goal', 'solo_goal',
  'free_kick_goal', 'extra_time_goal', 'goalkeeper_error',
]);

// Animated player dot — lerps smoothly toward its target position.
// Position is mutated on a THREE.Group ref inside useFrame (not via prop),
// so it animates every frame rather than only on React re-renders.
function AnimatedToken({
  basePos, color, label, isHome, flashType, dimmed, highlighted, reducedMotion,
}: {
  basePos: THREE.Vector3;
  color: string;
  label: string;
  isHome: boolean;
  flashType: 'goal' | 'yellow' | 'red' | 'injury' | null;
  dimmed: boolean;
  highlighted: boolean;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const currentPos = useRef(basePos.clone());
  const targetPos = useRef(basePos.clone());

  // Seed the group's position synchronously on mount (and whenever basePos
  // changes) so the token doesn't flash at origin for one frame before useFrame
  // takes over. useLayoutEffect fires after commit but before paint, and the
  // ref is populated at that point.
  useLayoutEffect(() => {
    targetPos.current.copy(basePos);
    if (reducedMotion) currentPos.current.copy(basePos);
    if (groupRef.current) groupRef.current.position.copy(currentPos.current);
  }, [basePos, reducedMotion]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (reducedMotion) {
      groupRef.current.position.copy(targetPos.current);
      return;
    }
    const alpha = 1 - Math.pow(0.93, delta * 60);
    currentPos.current.lerp(targetPos.current, alpha);
    groupRef.current.position.copy(currentPos.current);
  });

  return (
    <group ref={groupRef}>
      <PlayerToken
        position={[0, 0, 0]}
        color={color}
        label={label}
        isHome={isHome}
        highlighted={highlighted}
        dimmed={dimmed}
        flashing={flashType}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}

function TokenLayer({
  homeFormation, awayFormation, homeLineup, awayLineup,
  homeColor, awayColor, visibleEvents, currentMin, reducedMotion,
}: Omit<MatchPitchCanvasProps, 'weather' | 'momentum' | 'isMobile' | 'homeClubId' | 'reducedMotion'> & { reducedMotion: boolean }) {
  const homeSlots = useMemo(() => FORMATION_POSITIONS[homeFormation] || [], [homeFormation]);
  const awaySlots = useMemo(() => FORMATION_POSITIONS[awayFormation] || [], [awayFormation]);

  // Pre-compute world positions once per formation/lineup change — avoids per-render Vector3 allocation
  const homeBasePosMap = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    homeSlots.forEach((slot, i) => {
      const pid = homeLineup[i];
      if (!pid) return;
      const [x, yy, z] = slotToWorld(slot.x, slot.y);
      map.set(pid, new THREE.Vector3(x, yy, z));
    });
    return map;
  }, [homeSlots, homeLineup]);

  const awayBasePosMap = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    awaySlots.forEach((slot, i) => {
      const pid = awayLineup[i];
      if (!pid) return;
      const [x, yy, z] = slotToWorld(100 - slot.x, 100 - slot.y);
      map.set(pid, new THREE.Vector3(x, yy, z));
    });
    return map;
  }, [awaySlots, awayLineup]);

  // Flash states: map playerId → flash type + expiry
  const flashState = useRef<Map<string, { type: 'goal' | 'yellow' | 'red' | 'injury'; until: number }>>(new Map());
  const processedCount = useRef(0);

  useEffect(() => {
    // Reset counter if the event stream shrinks (new match, half reset, penalty shootout)
    // — otherwise stale processedCount silently skips all events in the new match.
    if (visibleEvents.length < processedCount.current) {
      processedCount.current = 0;
      flashState.current.clear();
    }
    for (let i = processedCount.current; i < visibleEvents.length; i++) {
      const ev = visibleEvents[i];
      processedCount.current = i + 1;
      if (!ev.playerId) continue;
      if (GOAL_EVENT_TYPES.has(ev.type)) {
        flashState.current.set(ev.playerId, { type: 'goal', until: currentMin + 3 });
      } else if (ev.type === 'yellow_card') {
        flashState.current.set(ev.playerId, { type: 'yellow', until: currentMin + 2 });
      } else if (ev.type === 'red_card') {
        flashState.current.set(ev.playerId, { type: 'red', until: currentMin + 999 });
      } else if (ev.type === 'injury') {
        flashState.current.set(ev.playerId, { type: 'injury', until: currentMin + 2 });
      }
    }
  }, [visibleEvents, currentMin]);

  const sentOff = useMemo(
    () => new Set(visibleEvents.filter(e => e.type === 'red_card' && e.playerId).map(e => e.playerId!)),
    [visibleEvents],
  );

  return (
    <>
      {homeSlots.map((slot, i) => {
        const pid = homeLineup[i];
        if (!pid || sentOff.has(pid)) return null;
        const basePos = homeBasePosMap.get(pid);
        if (!basePos) return null;
        const flash = flashState.current.get(pid);
        return (
          <AnimatedToken
            key={`home-${pid}`}
            basePos={basePos}
            color={homeColor}
            label={slot.pos}
            isHome={true}
            flashType={flash && flash.until > currentMin ? flash.type : null}
            dimmed={false}
            highlighted={flash?.type === 'goal' && flash.until > currentMin}
            reducedMotion={reducedMotion}
          />
        );
      })}
      {awaySlots.map((slot, i) => {
        const pid = awayLineup[i];
        if (!pid || sentOff.has(pid)) return null;
        const basePos = awayBasePosMap.get(pid);
        if (!basePos) return null;
        const flash = flashState.current.get(pid);
        return (
          <AnimatedToken
            key={`away-${pid}`}
            basePos={basePos}
            color={awayColor}
            label={slot.pos}
            isHome={false}
            flashType={flash && flash.until > currentMin ? flash.type : null}
            dimmed={false}
            highlighted={flash?.type === 'goal' && flash.until > currentMin}
            reducedMotion={reducedMotion}
          />
        );
      })}
    </>
  );
}

function GoalLayer({
  visibleEvents, homeColor, awayColor, homeClubId, reducedMotion,
}: { visibleEvents: MatchEvent[]; homeColor: string; awayColor: string; homeClubId: string; reducedMotion: boolean }) {
  const [homeTrigger, setHomeTrigger] = useState(0);
  const [awayTrigger, setAwayTrigger] = useState(0);
  const processedGoals = useRef(0);

  useEffect(() => {
    // Reset if event stream shrinks (new match) — otherwise the goal burst path
    // silently stops firing for the new match because processedGoals is stale.
    if (visibleEvents.length < processedGoals.current) {
      processedGoals.current = 0;
    }
    for (let i = processedGoals.current; i < visibleEvents.length; i++) {
      const ev = visibleEvents[i];
      processedGoals.current = i + 1;
      if (!GOAL_EVENT_TYPES.has(ev.type)) continue;
      // own_goal scores for the OTHER team
      const scoringTeamIsHome = ev.type === 'own_goal'
        ? ev.clubId !== homeClubId
        : ev.clubId === homeClubId;
      if (scoringTeamIsHome) {
        setHomeTrigger(t => t + 1);
      } else {
        setAwayTrigger(t => t + 1);
      }
    }
  }, [visibleEvents, homeClubId]);

  return (
    <>
      <GoalEventEffect isHome={true} color={homeColor} trigger={homeTrigger} reducedMotion={reducedMotion} />
      <GoalEventEffect isHome={false} color={awayColor} trigger={awayTrigger} reducedMotion={reducedMotion} />
    </>
  );
}

function MomentumBar({ momentum, homeColor, awayColor, reducedMotion }: { momentum: number; homeColor: string; awayColor: string; reducedMotion: boolean }) {
  const homeRef = useRef<THREE.Mesh>(null!);
  const awayRef = useRef<THREE.Mesh>(null!);
  const targetHomePct = useRef(0.5);

  useEffect(() => {
    targetHomePct.current = Math.max(0.02, Math.min(0.98, (momentum + 100) / 200));
  }, [momentum]);

  useFrame((_, delta) => {
    if (!homeRef.current || !awayRef.current) return;
    const hw = homeRef.current.scale.x;
    const alpha = reducedMotion ? 1 : 1 - Math.pow(0.96, delta * 60);
    const newHw = hw + (targetHomePct.current - hw) * alpha;
    homeRef.current.scale.x = newHw;
    homeRef.current.position.x = -34 + (newHw * 68) / 2;
    awayRef.current.scale.x = 1 - newHw;
    awayRef.current.position.x = -34 + newHw * 68 + ((1 - newHw) * 68) / 2;
  });

  const barZ = -(PITCH_H / 2) - 4;

  return (
    <group position={[0, 0.4, barZ]}>
      {/* Background */}
      <mesh>
        <boxGeometry args={[68, 0.7, 1.2]} />
        <meshBasicMaterial color={0x111111} transparent opacity={0.5} />
      </mesh>
      {/* Home portion — starts at left edge x=-34 */}
      <mesh ref={homeRef} position={[-34 + 34 * 0.5, 0, 0.1]} scale={[0.5, 1, 1]}>
        <boxGeometry args={[68, 0.72, 1.3]} />
        <meshBasicMaterial color={homeColor} transparent opacity={0.8} />
      </mesh>
      {/* Away portion */}
      <mesh ref={awayRef} position={[0 + 34 * 0.5, 0, 0.1]} scale={[0.5, 1, 1]}>
        <boxGeometry args={[68, 0.72, 1.3]} />
        <meshBasicMaterial color={awayColor} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export default function MatchPitchCanvas({
  homeFormation, awayFormation, homeLineup, awayLineup,
  homeColor, awayColor, homeClubId, visibleEvents, currentMin,
  weather = 'clear', momentum, isMobile, reducedMotion = false,
}: MatchPitchCanvasProps) {
  const camY = isMobile ? 72 : 58;
  const camZ = isMobile ? 40 : 50;
  const frameloop = useVisibilityFrameloop();

  return (
    <Canvas
      frameloop={frameloop}
      camera={{ position: [0, camY, camZ], fov: 38, near: 0.1, far: 600 }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      dpr={[1, Math.min(1.5, window.devicePixelRatio)]}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <ambientLight intensity={0.95} />
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
          reducedMotion={reducedMotion}
        />
        <GoalLayer
          visibleEvents={visibleEvents}
          homeColor={homeColor}
          awayColor={awayColor}
          homeClubId={homeClubId}
          reducedMotion={reducedMotion}
        />
        <MomentumBar momentum={momentum} homeColor={homeColor} awayColor={awayColor} reducedMotion={reducedMotion} />
        {weather !== 'clear' && <WeatherLayer weather={weather} mobile={isMobile} reducedMotion={reducedMotion} />}
      </Suspense>
    </Canvas>
  );
}
