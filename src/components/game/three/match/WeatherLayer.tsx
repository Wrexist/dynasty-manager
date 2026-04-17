import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PITCH_W, PITCH_H } from '../shared/PitchGeometry';

interface WeatherLayerProps {
  weather: 'clear' | 'rain' | 'snow' | 'wind';
  mobile?: boolean;
}

const SPREAD_X = PITCH_W * 0.6;
const SPREAD_Z = PITCH_H * 0.6;
const SPAWN_HEIGHT = 40;

export function WeatherLayer({ weather, mobile }: WeatherLayerProps) {
  if (weather === 'clear') return null;

  const count = mobile
    ? (weather === 'rain' ? 600 : 400)
    : (weather === 'rain' ? 1400 : 900);

  const positions = useRef<Float32Array>(new Float32Array(count * 3));
  const velocities = useRef<Float32Array>(new Float32Array(count * 3));
  const pointsRef = useRef<THREE.Points>(null!);

  // Initialize
  useMemo(() => {
    for (let i = 0; i < count; i++) {
      positions.current[i * 3] = (Math.random() - 0.5) * SPREAD_X * 2;
      positions.current[i * 3 + 1] = Math.random() * SPAWN_HEIGHT;
      positions.current[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z * 2;
      if (weather === 'rain') {
        velocities.current[i * 3] = (Math.random() - 0.5) * 2;
        velocities.current[i * 3 + 1] = -(12 + Math.random() * 8);
        velocities.current[i * 3 + 2] = 0;
      } else if (weather === 'snow') {
        velocities.current[i * 3] = (Math.random() - 0.5) * 1.5;
        velocities.current[i * 3 + 1] = -(1.5 + Math.random() * 2);
        velocities.current[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      } else {
        // wind
        velocities.current[i * 3] = 8 + Math.random() * 6;
        velocities.current[i * 3 + 1] = -(2 + Math.random() * 3);
        velocities.current[i * 3 + 2] = (Math.random() - 0.5) * 2;
      }
    }
  }, [count, weather]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions.current, 3));
    return geo;
  }, [positions]);

  useFrame((_, delta) => {
    const pos = positions.current;
    const vel = velocities.current;
    for (let i = 0; i < count; i++) {
      pos[i * 3] += vel[i * 3] * delta;
      pos[i * 3 + 1] += vel[i * 3 + 1] * delta;
      pos[i * 3 + 2] += vel[i * 3 + 2] * delta;
      // Wrap
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = (Math.random() - 0.5) * SPREAD_X * 2;
        pos[i * 3 + 1] = SPAWN_HEIGHT;
        pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z * 2;
      }
      if (Math.abs(pos[i * 3]) > SPREAD_X) {
        pos[i * 3] = -Math.sign(pos[i * 3]) * SPREAD_X;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  });

  const material = useMemo(() => new THREE.PointsMaterial({
    color: weather === 'snow' ? 0xddeeff : weather === 'rain' ? 0x88aabb : 0xaaccdd,
    size: weather === 'snow' ? 0.5 : 0.2,
    transparent: true,
    opacity: weather === 'snow' ? 0.7 : 0.4,
    sizeAttenuation: true,
    depthWrite: false,
  }), [weather]);

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
