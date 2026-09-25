import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ClubCrest } from '@/components/game/ClubCrest';
import { getTeamCrest } from '@/utils/teamCrest';

const arsenal = { id: 'arsenal', name: 'Arsenal', shortName: 'ARS', color: '#EF0107', secondaryColor: '#FFFFFF' };
describe('club crest identity and rendering', () => {
  it('uses stable IDs regardless of division, name or save instance', () => {
    expect(getTeamCrest('arsenal')).toContain('/team-crests/');
    for (const id of [undefined, null, '', '__proto__', 'constructor', 'Arsenal', 'England', 'custom-club']) {
      expect(getTeamCrest(id)).toBeNull();
    }
  });
  it('recovers from a failed image when the selected club changes', () => {
    const { container, rerender } = render(<ClubCrest club={arsenal} />);
    expect(container.querySelector('img')?.alt).toBe('Arsenal');
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('ARS');
    rerender(<ClubCrest club={{ ...arsenal, id: 'chelsea', name: 'Chelsea' }} />);
    expect(container.querySelector('img')?.src).toContain('chelsea');
    rerender(<ClubCrest club={arsenal} />);
    expect(container.querySelector('img')?.src).toContain('arsenal');
  });
  it('supports fixture IDs and explicit non-club/child overrides', () => {
    const { container, rerender } = render(<ClubCrest club={{ color: '#EF0107' }} clubId="arsenal" />);
    expect(container.querySelector('img')?.src).toContain('arsenal');
    rerender(<ClubCrest club={arsenal} useAsset={false} />);
    expect(container.querySelector('img')).toBeNull();
    rerender(<ClubCrest club={arsenal}><span>Custom identity</span></ClubCrest>);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('Custom identity');
  });
  it('keeps unknown and null clubs renderable without broken requests', () => {
    const { container, rerender } = render(<ClubCrest club={{ ...arsenal, id: 'unknown' }} />);
    expect(container.textContent).toBe('ARS');
    expect(container.querySelector('img')).toBeNull();
    rerender(<ClubCrest club={null} size="xs" />);
    expect(container.firstElementChild).not.toBeNull();
  });
});
