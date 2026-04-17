import { useMemo } from 'react';
import * as THREE from 'three';

// Real pitch dimensions in world units (meters)
export const PITCH_W = 68;
export const PITCH_H = 105;

// Convert formation slot coords (0-100) to world space
export function slotToWorld(x: number, y: number): [number, number, number] {
  const wx = (x / 100 - 0.5) * PITCH_W;
  const wz = -(y / 100 - 0.5) * PITCH_H;
  return [wx, 0.05, wz];
}

function PitchSurface() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(PITCH_W, PITCH_H, 1, 10);
    geo.rotateX(-Math.PI / 2);
    const colors: number[] = [];
    const pos = geo.attributes.position;
    const stripeWidth = PITCH_H / 10;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const stripeIdx = Math.floor((z + PITCH_H / 2) / stripeWidth);
      const isLight = stripeIdx % 2 === 0;
      const v = isLight ? 0.13 : 0.10;
      colors.push(v * 0.4, v, v * 0.4);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  const material = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide }), []);

  return <mesh geometry={geometry} material={material} />;
}

function PitchMarkings() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: 0x3d7a50, transparent: true, opacity: 0.8 });

    const hw = PITCH_W / 2;
    const hh = PITCH_H / 2;
    const y = 0.06;

    const segs: Array<[number, number, number, number]> = [
      [-hw, -hh, -hw, hh], [-hw, hh, hw, hh], [hw, hh, hw, -hh], [hw, -hh, -hw, -hh],
      [-hw, 0, hw, 0],
      [-20.16, hh, -20.16, hh - 16.5], [-20.16, hh - 16.5, 20.16, hh - 16.5], [20.16, hh - 16.5, 20.16, hh],
      [-20.16, -hh, -20.16, -hh + 16.5], [-20.16, -hh + 16.5, 20.16, -hh + 16.5], [20.16, -hh + 16.5, 20.16, -hh],
      [-9.16, hh, -9.16, hh - 5.5], [-9.16, hh - 5.5, 9.16, hh - 5.5], [9.16, hh - 5.5, 9.16, hh],
      [-9.16, -hh, -9.16, -hh + 5.5], [-9.16, -hh + 5.5, 9.16, -hh + 5.5], [9.16, -hh + 5.5, 9.16, -hh],
      [-3.66, hh, -3.66, hh + 2.4], [-3.66, hh + 2.4, 3.66, hh + 2.4], [3.66, hh + 2.4, 3.66, hh],
      [-3.66, -hh, -3.66, -hh - 2.4], [-3.66, -hh - 2.4, 3.66, -hh - 2.4], [3.66, -hh - 2.4, 3.66, -hh],
    ];

    segs.forEach(([x1, z1, x2, z2]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([x1, y, z1, x2, y, z2], 3));
      g.add(new THREE.LineSegments(geo, mat));
    });

    // Center circle
    const circlePoints: number[] = [];
    for (let i = 0; i <= 48; i++) {
      const angle = (i / 48) * Math.PI * 2;
      circlePoints.push(Math.cos(angle) * 9.15, 0.06, Math.sin(angle) * 9.15);
    }
    const circleGeo = new THREE.BufferGeometry();
    circleGeo.setAttribute('position', new THREE.Float32BufferAttribute(circlePoints, 3));
    g.add(new THREE.Line(circleGeo, mat));

    return g;
  }, []);

  return (
    <>
      <primitive object={group} />
      {/* Center spot */}
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 8]} />
        <meshBasicMaterial color={0x3d7a50} />
      </mesh>
    </>
  );
}

export function PitchGeometry() {
  return (
    <group>
      <PitchSurface />
      <PitchMarkings />
    </group>
  );
}
