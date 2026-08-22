/**
 * SundayFace — the portrait renderer.
 *
 * Three things are worth pinning and the rest is taste:
 *
 *   1. DETERMINISM. The same player draws the same face, every render, in any
 *      order. A portrait that changed between two renders would read as save
 *      corruption.
 *   2. IT NEVER CRASHES. `Player.appearance` is optional and indices arrive
 *      from a persisted save, so an out-of-range or absent value has to
 *      produce a face rather than an exception.
 *   3. UNIQUE `<defs>` IDS. Twenty faces in a list with one gradient id is the
 *      classic silent SVG bug — every instance paints with whichever mounted
 *      last. `useId` is the fix and this is the guard.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SundayFace } from '@/components/game/sunday/SundayFace';
import { sundayFaceSpec } from '@/utils/sunday/visuals';
import type { PlayerAppearance } from '@/types/game';

/**
 * The rendered SVG with the per-instance `<defs>` ids normalised away.
 * Those ids are SUPPOSED to differ between mounts — that is rule 3 — so
 * comparing raw markup would test the opposite of what it means to.
 */
const face = (a: PlayerAppearance, size = 64, label?: string) =>
  render(<SundayFace {...a} size={size} label={label} />)
    .container.innerHTML.replace(/sf-[\w-]+/g, 'sf-x');

describe('SundayFace', () => {
  it('draws the same face for the same player every time', () => {
    const a = sundayFaceSpec({ id: 'sun-p-club-4' });
    expect(face(a)).toBe(face(a));
    // …and a different one for a different player.
    expect(face(a)).not.toBe(face(sundayFaceSpec({ id: 'sun-p-club-5' })));
  });

  it('renders a face for a player with no persisted appearance', () => {
    const html = face(sundayFaceSpec({ id: 'sun-ringer-x' }));
    expect(html).toContain('<svg');
    expect(html.length).toBeGreaterThan(200);
  });

  it('survives indices a corrupt save could hold', () => {
    for (const bad of [-1, 99, Number.NaN]) {
      const html = face({
        skinTone: bad, hairStyle: bad, hairColor: bad, height: bad, build: bad,
        facialHair: bad, accessory: bad, bootColor: bad,
      });
      expect(html).toContain('<svg');
    }
    // Every optional field absent, which is what an older save shape looks like.
    expect(render(<SundayFace skinTone={2} hairStyle={3} hairColor={1} />).container.innerHTML)
      .toContain('<svg');
  });

  it('gives every instance its own gradient id', () => {
    const { container } = render(
      <>
        {Array.from({ length: 12 }, (_, i) => (
          <SundayFace key={i} {...sundayFaceSpec({ id: `p${i}` })} size={64} />
        ))}
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map(n => n.id);
    expect(ids.length).toBe(12);
    expect(new Set(ids).size).toBe(12);
  });

  it('draws fewer nodes in a list row than on a hero card', () => {
    const a = sundayFaceSpec({ id: 'sun-p-club-7' });
    const nodes = (size: number) =>
      render(<SundayFace {...a} size={size} />).container.querySelectorAll('svg *').length;
    expect(nodes(24)).toBeLessThan(nodes(64));
    // The smallest tier still draws something.
    expect(nodes(18)).toBeGreaterThan(0);
  });

  it('is decorative unless it is given a label', () => {
    const plain = render(<SundayFace {...sundayFaceSpec({ id: 'p' })} />).container.querySelector('svg')!;
    expect(plain.getAttribute('aria-hidden')).toBe('true');
    expect(plain.getAttribute('role')).toBeNull();

    const named = render(
      <SundayFace {...sundayFaceSpec({ id: 'p' })} label="Kev Yates" />,
    ).container.querySelector('svg')!;
    expect(named.getAttribute('role')).toBe('img');
    expect(named.getAttribute('aria-label')).toBe('Kev Yates');
    expect(named.getAttribute('aria-hidden')).toBeNull();
  });
});
