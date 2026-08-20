/**
 * The strip.
 *
 * WHAT THIS FILE IS FOR. `sundayKitSpec` decides three things about a club —
 * two colours and one of five patterns — and a renderer that quietly ignored
 * the third would look perfectly fine in a screenshot and would make every
 * club in the mode identical. So the cases below assert on the MARKS: a
 * hooped club has hoops in its SVG and a plain one does not, and the colours
 * in the drawing are the colours in the save rather than a palette the
 * component picked for itself.
 *
 * The other two things pinned here are the ones that break silently:
 * `useId`-scoped clip paths (two kits on one screen cross-wire otherwise, and
 * the second one loses its pattern), and the ink rule that keeps a number
 * readable on a white shirt.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SundayKit } from '@/components/game/sunday/SundayKit';
import { sundayInkOn, sundayKitSpec, type SundayKitPattern } from '@/utils/sunday/visuals';

const RED = '#C81E1E';
const WHITE = '#F8FAFC';

const svg = (ui: React.ReactElement) =>
  render(ui).container.querySelector('svg')!.outerHTML;

/** Every pattern draws something the others do not. */
const MARKS: Record<Exclude<SundayKitPattern, 'solid'>, RegExp> = {
  stripes: /<rect[^>]*x="17\.5"/,
  hoops: /<rect[^>]*y="13"/,
  halves: /<rect[^>]*x="32"[^>]*width="28"/,
  sash: /<path[^>]*d="M 8 50 L 30 4/,
};

describe('SundayKit draws the kit the club actually has', () => {
  it('paints the club\'s own two colours and nothing else', () => {
    const html = svg(<SundayKit body={RED} trim={WHITE} pattern="solid" size={78} />);
    expect(html).toContain(RED);
    expect(html).toContain(WHITE);
  });

  it.each(Object.entries(MARKS))('draws %s and only %s', (pattern, mark) => {
    const html = svg(<SundayKit body={RED} trim={WHITE} pattern={pattern as SundayKitPattern} size={78} />);
    expect(mark.test(html), `${pattern} is not drawn`).toBe(true);
    for (const [other, otherMark] of Object.entries(MARKS)) {
      if (other === pattern) continue;
      expect(otherMark.test(html), `${pattern} also drew ${other}`).toBe(false);
    }
  });

  it('draws no pattern at all on a solid kit', () => {
    const html = svg(<SundayKit body={RED} trim={WHITE} pattern="solid" size={78} />);
    for (const mark of Object.values(MARKS)) expect(mark.test(html)).toBe(false);
  });

  /**
   * The bug this pins: two kits on one screen sharing a `<clipPath>` id. The
   * browser resolves the LAST definition for both, so the second kit's pattern
   * is clipped to the first kit's shirt — which is the same shape here, so it
   * would look fine right up until the shapes differ.
   */
  it('gives every instance its own clip path', () => {
    const { container } = render(
      <>
        <SundayKit body={RED} trim={WHITE} pattern="hoops" size={78} />
        <SundayKit body={WHITE} trim={RED} pattern="stripes" size={78} />
      </>,
    );
    const ids = [...container.querySelectorAll('clipPath')].map(c => c.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('puts dark ink on a white shirt and light ink on a dark one', () => {
    expect(sundayInkOn(WHITE)).not.toBe(sundayInkOn(RED));
    const light = svg(<SundayKit body={WHITE} trim={RED} pattern="solid" number={9} size={78} />);
    expect(light).toContain(`fill="${sundayInkOn(WHITE)}"`);
    const dark = svg(<SundayKit body={RED} trim={WHITE} pattern="solid" number={9} size={78} />);
    expect(dark).toContain(`fill="${sundayInkOn(RED)}"`);
  });

  /** A 24px kit in a list row is a silhouette; the badge and the number would
   *  be two smudges, so they are not drawn at all. */
  it('drops the number and the badge below the size they are legible at', () => {
    const small = svg(<SundayKit body={RED} trim={WHITE} pattern="solid" number={9} crestShape="shield" size={28} />);
    expect(small).not.toContain('>9<');
    const large = svg(<SundayKit body={RED} trim={WHITE} pattern="solid" number={9} crestShape="shield" size={78} />);
    expect(large).toContain('>9<');
  });

  it('is announced when it is given a label and hidden when it is not', () => {
    const { container } = render(<SundayKit body={RED} trim={WHITE} pattern="solid" label="Pub FC kit" />);
    const el = container.querySelector('svg')!;
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Pub FC kit');

    const bare = render(<SundayKit body={RED} trim={WHITE} pattern="solid" />).container.querySelector('svg')!;
    expect(bare.getAttribute('aria-hidden')).toBe('true');
  });

  /** The spec is the source of truth for what gets drawn — a renderer that
   *  hard-coded a pattern would pass every case above. */
  it('draws whatever the spec says for a real club', () => {
    const spec = sundayKitSpec(RED, WHITE, 'Hillside AFC');
    const html = svg(<SundayKit body={spec.body} trim={spec.trim} pattern={spec.pattern} size={78} />);
    if (spec.pattern === 'solid') {
      for (const mark of Object.values(MARKS)) expect(mark.test(html)).toBe(false);
    } else {
      expect(MARKS[spec.pattern].test(html)).toBe(true);
    }
  });
});
