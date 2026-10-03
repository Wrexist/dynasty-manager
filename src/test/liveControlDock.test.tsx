/**
 * The live touchline: three team choices (Cautious / All-Out light the nearer
 * one and show their own name), four actions, and a shout menu that explains
 * each shout and respects cooldowns and the late-only time-waste.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LiveControlDock, type LiveShoutState } from '@/components/game/match/LiveControlDock';
import type { Mentality } from '@/types/game';

function setup(over: { mentality?: Mentality; shouts?: Partial<LiveShoutState>; subsLeft?: number } = {}) {
  const props = {
    mentality: over.mentality ?? 'balanced' as Mentality,
    onMentality: vi.fn(), onPause: vi.fn(), onSubs: vi.fn(), onShout: vi.fn(), onSpeed: vi.fn(),
    subsLeft: over.subsLeft ?? 5,
    shouts: { remaining: 4, cooldownLeft: 0, canTimeWaste: false, ...over.shouts } as LiveShoutState,
    speedLabel: 'Normal', speedShortLabel: '1x', speedBoosted: false, reducedMotion: true,
  };
  render(<LiveControlDock {...props} />);
  return props;
}

describe('LiveControlDock', () => {
  it('offers three team choices and maps them to mentalities', () => {
    const p = setup();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.click(screen.getByRole('radio', { name: /attack/i }));
    expect(p.onMentality).toHaveBeenCalledWith('attacking');
    fireEvent.click(screen.getByRole('radio', { name: /defend/i }));
    expect(p.onMentality).toHaveBeenCalledWith('defensive');
  });

  it('an advanced mentality lights the nearer choice under its own name', () => {
    setup({ mentality: 'all-out-attack' });
    const attack = screen.getAllByRole('radio').find(r => r.getAttribute('aria-checked') === 'true')!;
    expect(attack.textContent).toContain('All-Out');
  });

  it('Pause, Subs and Speed call straight through; Subs shows what is left', () => {
    const p = setup({ subsLeft: 3 });
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    fireEvent.click(screen.getByRole('button', { name: /3 substitutions left/i }));
    fireEvent.click(screen.getByRole('button', { name: /match speed/i }));
    expect(p.onPause).toHaveBeenCalled();
    expect(p.onSubs).toHaveBeenCalled();
    expect(p.onSpeed).toHaveBeenCalled();
  });

  it('no subs left disables Subs', () => {
    setup({ subsLeft: 0 });
    expect((screen.getByRole('button', { name: /0 substitutions left/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the shout menu explains each shout and fires the chosen one', async () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: /^shout$/i }));
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3); // no time-waste before the late game
    expect(items[0].textContent).toMatch(/Attack harder/);
    fireEvent.click(items[1]);
    expect(p.onShout).toHaveBeenCalledWith('hold_the_line');
    await waitFor(() => expect(screen.queryAllByRole('menuitem')).toHaveLength(0)); // closes (after its exit fade)
  });

  it('on cooldown the shouts are disabled and say when they are ready', () => {
    const p = setup({ shouts: { cooldownLeft: 6, canTimeWaste: true } });
    fireEvent.click(screen.getByRole('button', { name: /^shout$/i }));
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(4);
    expect(items.every(i => (i as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByText(/Ready in 6'/)).toBeTruthy();
    fireEvent.click(items[0]);
    expect(p.onShout).not.toHaveBeenCalled();
  });

  it('an active shout takes over the button with its name and time left', () => {
    setup({ shouts: { remaining: 3, active: { type: 'push_forward', minutesLeft: 4 } } });
    expect(screen.getByRole('button', { name: /Push · 4' left/ })).toBeTruthy();
  });
});
