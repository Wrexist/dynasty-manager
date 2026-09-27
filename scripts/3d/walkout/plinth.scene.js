// Walkout plinth — the stage the hero card lands on.
//
// Rendered offline with the 3d-asset-studio skill (three.js in headless
// Chromium) to public/walkout/plinth.webp. Not part of the app build.
//
//   node <skill>/scripts/render.mjs scripts/3d/walkout/plinth.scene.js \
//     --mode still --out public/walkout --name plinth
//
// A black-lacquer drum with a brushed-gold chamfer and a thin emissive ring
// inset in its top face. Deliberately colour-neutral (black + gold + warm
// white): the tier colour comes from the CSS halo behind it, so one asset
// serves every walkout tier. Seen from a low camera so the top reads as a
// shallow ellipse the card can stand on.
import * as THREE from 'three';
import {glow, gold, paint} from 'w3d/materials.js';

export const settings = {
  name: 'plinth',
  mode: 'still',
  width: 900,
  margin: 0.04,
  camera: {elevation: 13, azimuth: 0, distance: 6.2},
  studio: {preset: 'dramatic', envMap: 'softbox', exposure: 1.05},
  floor: false,
  contact: false,
  backdrop: 'transparent',
  background: '#05060a',
  post: {bloom: {strength: 0.7, radius: 0.35}},
};

export default function build() {
  const group = new THREE.Group();

  // Drum profile (radius, height), revolved. Slight flare at the base, a
  // chamfer at the top edge that the gold band sits on.
  const drumProfile = [
    [0, 0], [3.25, 0], [3.3, 0.06], [3.18, 0.5], [3.1, 0.58], [0, 0.58],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const lacquer = paint({color: 0x07080c}, {roughness: 0.16, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08});
  const drum = new THREE.Mesh(new THREE.LatheGeometry(drumProfile, 160), lacquer);
  group.add(drum);

  // Brushed-gold chamfer band around the top edge.
  const bandProfile = [
    [3.06, 0.56], [3.14, 0.57], [3.19, 0.62], [3.14, 0.68], [3.0, 0.69], [2.94, 0.66],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const band = new THREE.Mesh(new THREE.LatheGeometry(bandProfile, 160), gold({}, {roughness: 0.22}));
  group.add(band);

  // Top face: near-black satin so the inset ring has something to glow on.
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(2.96, 2.96, 0.05, 160),
    paint({color: 0x040406}, {roughness: 0.3, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.25}),
  );
  top.position.y = 0.64;
  group.add(top);

  // Emissive inset ring — the "lit stage" line. Bloom turns it into light.
  const ringMat = glow({color: 0xffd98a, intensity: 3.2});
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.017, 16, 240), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.675;
  group.add(ring);

  // A second, fainter ring on the drum's flank reads as a light strip.
  const flankMat = glow({color: 0xffc870, intensity: 1.3});
  const flank = new THREE.Mesh(new THREE.TorusGeometry(3.268, 0.016, 12, 240), flankMat);
  flank.rotation.x = Math.PI / 2;
  flank.position.y = 0.24;
  group.add(flank);

  // Engraved gold hairlines either side of the lit ring — a machined stage,
  // not a flat disc.
  for (const r of [2.18, 2.74]) {
    const line = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 240), gold({}, {roughness: 0.3}));
    line.rotation.x = Math.PI / 2;
    line.position.y = 0.668;
    group.add(line);
  }

  return [{name: 'plinth', object: group}];
}
