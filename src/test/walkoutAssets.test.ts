import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WALKOUT_PLINTH_SRC } from '@/components/game/pack/WalkoutReveal';
import { WALKOUT_FLOODLIGHT_SRC } from '@/components/game/pack/WalkoutStadium';

/**
 * The walkout's stage and floodlights are offline 3D renders. A missing file
 * does not break anything visibly — the <img> just draws nothing and the card
 * floats over a void — so the link between what the code references, what
 * ships, and the scene that produced it is pinned here.
 */
const root = process.cwd();
const referenced = [WALKOUT_PLINTH_SRC, WALKOUT_FLOODLIGHT_SRC];

describe('walkout 3D assets', () => {
  it('every referenced asset ships as a transparent webp', () => {
    for (const src of referenced) {
      const file = join(root, 'public', src);
      expect(existsSync(file), `missing ${src}`).toBe(true);
      expect(src.endsWith('.webp'), `${src} is not webp`).toBe(true);
      // RIFF....WEBP, and a VP8X header (the extended format carries alpha).
      const head = readFileSync(file).subarray(0, 16).toString('latin1');
      expect(head.slice(0, 4)).toBe('RIFF');
      expect(head.slice(8, 16)).toBe('WEBPVP8X');
    }
  });

  it('nothing unreferenced ships in public/walkout', () => {
    const shipped = readdirSync(join(root, 'public/walkout')).map(f => `/walkout/${f}`);
    for (const f of shipped) expect(referenced, `unreferenced ${f}`).toContain(f);
  });

  it('every asset has the scene source it is rendered from', () => {
    for (const src of referenced) {
      const name = src.split('/').pop()!.replace(/\.webp$/, '');
      expect(existsSync(join(root, 'scripts/3d/walkout', `${name}.scene.js`)), `no scene for ${src}`).toBe(true);
    }
  });
});
