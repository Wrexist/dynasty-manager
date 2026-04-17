import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PITCH_W, PITCH_H } from '../shared/PitchGeometry';

interface WeatherLayerProps {
  weather: 'clear' | 'rain' | 'snow' | 'wind';
  mobile?: boolean;
  reducedMotion?: boolean;
}

const SPREAD_X = PITCH_W * 0.7;
const SPREAD_Z = PITCH_H * 0.7;
const SPAWN_HEIGHT = 45;

function ActiveWeather({ weather, mobile, reducedMotion }: { weather: Exclude<WeatherLayerProps['weather'], 'clear'>; mobile?: boolean; reducedMotion?: boolean }) {
  // Reduced-motion: halve particle density; they still spawn (so the scene
  // reads as "raining") but the total on-screen motion is lower.
  const baseCount = mobile
    ? (weather === 'rain' ? 700 : 450)
    : (weather === 'rain' ? 1600 : 1000);
  const count = reducedMotion ? Math.round(baseCount / 2) : baseCount;

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SPREAD_X * 2;
      pos[i * 3 + 1] = Math.random() * SPAWN_HEIGHT;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z * 2;
      if (weather === 'rain') {
        vel[i * 3] = (Math.random() - 0.5) * 2.5;
        vel[i * 3 + 1] = -(14 + Math.random() * 8);
        vel[i * 3 + 2] = 0;
      } else if (weather === 'snow') {
        vel[i * 3] = (Math.random() - 0.5) * 1.8;
        vel[i * 3 + 1] = -(1.2 + Math.random() * 1.8);
        vel[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      } else {
        vel[i * 3] = 10 + Math.random() * 8;
        vel[i * 3 + 1] = -(2 + Math.random() * 3);
        vel[i * 3 + 2] = (Math.random() - 0.5) * 2;
      }
    }
    return { positions: pos, velocities: vel };
  }, [count, weather]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  const material = useMemo(() => new THREE.PointsMaterial({
    color: weather === 'snow' ? 0xddeeff : weather === 'rain' ? 0x7799bb : 0xaabbcc,
    size: weather === 'snow' ? 0.55 : 0.22,
    transparent: true,
    opacity: weather === 'snow' ? 0.75 : 0.45,
    sizeAttenuation: true,
    depthWrite: false,
  }), [weather]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((_, delta) => {
    // Reduced-motion: freeze the particle positions so they read as "static
    // snow / rain" without the persistent flowing motion that can trigger
    // vestibular issues.
    if (reducedMotion) return;
    for (let i = 0; i < count; i++) {
      positions[i * 3] += velocities[i * 3] * delta;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3] = (Math.random() - 0.5) * SPREAD_X * 2;
        positions[i * 3 + 1] = SPAWN_HEIGHT;
        positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z * 2;
      }
      if (Math.abs(positions[i * 3]) > SPREAD_X) {
        positions[i * 3] = -Math.sign(positions[i * 3]) * SPREAD_X * 0.9;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return <points geometry={geometry} material={material} />;
}

export function WeatherLayer({ weather, mobile, reducedMotion }: WeatherLayerProps) {
  if (weather === 'clear') return null;
  return <ActiveWeather weather={weather} mobile={mobile} reducedMotion={reducedMotion} />;
}
