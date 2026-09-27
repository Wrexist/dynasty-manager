// Walkout floodlight bank — the stadium lights that ignite over the walkout.
//
// Rendered offline with the 3d-asset-studio skill to
// public/walkout/floodlight.webp (transparent). Not part of the app build.
//
//   node <skill>/scripts/render.mjs scripts/3d/walkout/floodlight.scene.js \
//     --mode still --out public/walkout --name floodlight
//
// A 4x3 grid of lamps in a gunmetal housing on a short mast stub, turned and
// tipped down toward the pitch the way a real bank is aimed. Rendered for the
// LEFT corner; the right corner mirrors it in CSS. The lamps are emissive and
// bloomed, so the asset already reads as "on"; the page fades it in to ignite.
import * as THREE from 'three';
import {roundedBox, lathe} from 'w3d/geometry.js';
import {brushedSteel, chrome, glow, paint} from 'w3d/materials.js';

export const settings = {
  name: 'floodlight',
  mode: 'still',
  width: 560,
  margin: 0.06,
  camera: {elevation: 6, azimuth: 0, distance: 6},
  studio: {preset: 'night', envMap: 'strips', exposure: 1.1},
  floor: false,
  contact: false,
  backdrop: 'transparent',
  background: '#05060a',
  post: {bloom: {strength: 1.1, radius: 0.55}},
};

const COLS = 4;
const ROWS = 3;
const PITCH = 0.62;

export default function build() {
  const bank = new THREE.Group();
  const housingMat = paint({color: 0x2c2f36}, {roughness: 0.38, metalness: 0.7});

  const w = COLS * PITCH + 0.24;
  const h = ROWS * PITCH + 0.24;
  const housing = new THREE.Mesh(roundedBox(w, h, 0.34, 0.07, 6), housingMat);
  bank.add(housing);

  // One lamp: a chrome reflector cup around a hot emissive lens.
  const cup = lathe([[0.08, 0], [0.25, 0.02], [0.28, 0.12], [0.265, 0.14]], {segments: 64});
  const lensMat = glow({color: 0xfff4dc, intensity: 4.5});
  const cupMat = chrome({}, {roughness: 0.12});
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c - (COLS - 1) / 2) * PITCH;
      const y = (r - (ROWS - 1) / 2) * PITCH;
      const reflector = new THREE.Mesh(cup, cupMat);
      reflector.rotation.x = Math.PI / 2;
      reflector.position.set(x, y, 0.17);
      bank.add(reflector);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.2, 48), lensMat);
      lens.position.set(x, y, 0.2);
      bank.add(lens);
    }
  }

  // Top visor lip and a mast stub underneath.
  const visor = new THREE.Mesh(roundedBox(w + 0.1, 0.06, 0.5, 0.02, 3), housingMat);
  visor.position.set(0, h / 2 + 0.02, 0.1);
  bank.add(visor);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 32), brushedSteel({color: 0x6a6d74}));
  mast.position.set(0, -h / 2 - 0.55, -0.12);
  bank.add(mast);

  // Aimed down and in toward the centre of the pitch.
  bank.rotation.set(0.32, 0.42, 0.05);
  bank.position.y = 1.6;
  return [{name: 'floodlight', object: bank}];
}
