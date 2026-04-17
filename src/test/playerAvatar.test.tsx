import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';

function svg(container: HTMLElement): SVGSVGElement {
  const el = container.querySelector('svg');
  if (!el) throw new Error('expected svg root');
  return el;
}

describe('PlayerAvatar', () => {
  it('renders with a role="img" and descriptive aria-label', () => {
    const { container } = render(
      <PlayerAvatar jerseyColor="#004d9d" jerseyNumber={9} position="ST" size={80} />,
    );
    const root = svg(container);
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe('Jersey 9, ST');
    expect(root.querySelector('title')?.textContent).toBe('Jersey 9, ST');
  });

  it('keeps the position pill fully inside the viewBox (no negative y)', () => {
    const { container } = render(
      <PlayerAvatar jerseyColor="#004d9d" jerseyNumber={9} position="CAM" size={80} />,
    );
    const pill = container.querySelector('rect');
    expect(pill).not.toBeNull();
    expect(Number(pill!.getAttribute('y'))).toBeGreaterThanOrEqual(0);
  });

  it('scales pill width so 3-char positions fit', () => {
    const { container } = render(
      <PlayerAvatar jerseyColor="#004d9d" jerseyNumber={8} position="CAM" size={80} />,
    );
    const pill = container.querySelector('rect');
    const width = Number(pill!.getAttribute('width'));
    // 3 chars * 2.4 + 5 = 12.2 — must exceed the old hardcoded 12
    expect(width).toBeGreaterThan(12);
  });

  it('uses dark text on light kits for legibility', () => {
    const { container } = render(
      <PlayerAvatar jerseyColor="#ffffff" jerseyNumber={10} size={80} />,
    );
    const numberText = container.querySelector('text');
    expect(numberText?.getAttribute('fill')).toBe('#111827');
  });

  it('uses white text on dark kits', () => {
    const { container } = render(
      <PlayerAvatar jerseyColor="#0a0a0a" jerseyNumber={10} size={80} />,
    );
    const numberText = container.querySelector('text');
    expect(numberText?.getAttribute('fill')).toBe('#ffffff');
  });

  it('swaps primary and secondary color for the away kit', () => {
    const home = render(
      <PlayerAvatar
        jerseyColor="#ff0000"
        secondaryColor="#00ff00"
        jerseyNumber={7}
        size={80}
      />,
    );
    const away = render(
      <PlayerAvatar
        jerseyColor="#ff0000"
        secondaryColor="#00ff00"
        jerseyNumber={7}
        size={80}
        isAway
      />,
    );
    // Home gradient is red-based; away gradient is green-based.
    // The serialized markup of the two variants must differ.
    expect(home.container.innerHTML).not.toBe(away.container.innerHTML);
  });

  it('omits the position pill at small sizes (pitch markers)', () => {
    const { container } = render(
      <PlayerAvatar jerseyColor="#004d9d" jerseyNumber={1} position="GK" size={6} />,
    );
    expect(container.querySelector('rect')).toBeNull();
  });

  it('still renders at size=6 without crashing', () => {
    const { container } = render(
      <PlayerAvatar jerseyColor="#004d9d" jerseyNumber={11} size={6} />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('applies a drop-shadow filter at large sizes', () => {
    const { container } = render(
      <PlayerAvatar jerseyColor="#004d9d" jerseyNumber={10} size={80} />,
    );
    const filter = (container.querySelector('svg') as SVGSVGElement).style.filter;
    expect(filter).toContain('drop-shadow');
  });

  it('does not apply a drop-shadow at small sizes', () => {
    const { container } = render(
      <PlayerAvatar jerseyColor="#004d9d" jerseyNumber={10} size={6} />,
    );
    const filter = (container.querySelector('svg') as SVGSVGElement).style.filter;
    expect(filter).not.toContain('drop-shadow');
  });
});
