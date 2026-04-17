import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

export const PITCH_W = 68;
export const PITCH_H = 105;

export function slotToWorld(x: number, y: number): [number, number, number] {
  const wx = (x / 100 - 0.5) * PITCH_W;
  const wz = -(y / 100 - 0.5) * PITCH_H;
  return [wx, 0.05, wz];
}

function PitchSurface() {
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(PITCH_W, PITCH_H, 1, 10);
    // Read Y BEFORE rotation — after rotateX(-PI/2), Y becomes the world Z axis
    const colors: number[] = [];
    const pos = geo.attributes.position;
    const stripeWidth = PITCH_H / 10;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i); // world Z after rotation
      const stripeIdx = Math.floor((y + PITCH_H / 2) / stripeWidth);
      const isLight = stripeIdx % 2 === 0;
      const r = isLight ? 0.055 : 0.04;
      const g = isLight ? 0.16 : 0.12;
      const b = isLight ? 0.055 : 0.04;
      colors.push(r, g, b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide });
    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  return <mesh geometry={geometry} material={material} />;
}

function PitchMarkings() {
  const { group, geos, mat } = useMemo(() => {
    const g = new THREE.Group();
    const m = new THREE.LineBasicMaterial({ color: 0x4a9060, transparent: true, opacity: 0.85 });
    const allGeos: THREE.BufferGeometry[] = [];

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
      allGeos.push(geo);
      g.add(new THREE.LineSegments(geo, m));
    });

    const circlePoints: number[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      circlePoints.push(Math.cos(angle) * 9.15, 0.06, Math.sin(angle) * 9.15);
    }
    const circleGeo = new THREE.BufferGeometry();
    circleGeo.setAttribute('position', new THREE.Float32BufferAttribute(circlePoints, 3));
    allGeos.push(circleGeo);
    g.add(new THREE.Line(circleGeo, m));

    for (const side of [-1, 1]) {
      const arcPoints: number[] = [];
      const centerZ = side * (PITCH_H / 2 - 11);
      for (let i = 0; i <= 32; i++) {
        const angle = Math.PI * 0.18 + (i / 32) * Math.PI * 0.64;
        const px = Math.cos(angle) * 9.15;
        const pz = centerZ - side * Math.sin(angle) * 9.15;
        if (Math.abs(pz) < PITCH_H / 2 - 16.5) arcPoints.push(px, 0.06, pz);
      }
      if (arcPoints.length >= 6) {
        const arcGeo = new THREE.BufferGeometry();
        arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcPoints, 3));
        allGeos.push(arcGeo);
        g.add(new THREE.Line(arcGeo, m));
      }
    }

    return { group: g, geos: allGeos, mat: m };
  }, []);

  useEffect(() => () => { geos.forEach(g => g.dispose()); mat.dispose(); }, [geos, mat]);

  return (
    <>
      <primitive object={group} />
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 12]} />
        <meshBasicMaterial color={0x4a9060} />
      </mesh>
      {/* Penalty spots */}
      {[-1, 1].map(side => (
        <mesh key={side} position={[0, 0.07, side * (PITCH_H / 2 - 11)]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.25, 8]} />
          <meshBasicMaterial color={0x4a9060} />
        </mesh>
      ))}
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
