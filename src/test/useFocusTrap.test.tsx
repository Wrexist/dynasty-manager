import { describe, it, expect, beforeEach } from 'vitest';
import { useRef } from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

function Harness({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocusTrap(ref, active);
  return (
    <>
      <button data-testid="outside-before">before</button>
      <div ref={ref} data-testid="trap">
        <button data-testid="first">first</button>
        <button data-testid="middle">middle</button>
        <button data-testid="last">last</button>
      </div>
      <button data-testid="outside-after">after</button>
    </>
  );
}

// requestAnimationFrame fires in jsdom but only on the next tick. Wrap in
// act() and wait two animation frames so the focus side-effect lands.
function flushRaf() {
  return act(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  });
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    // Reset focus to body for each test
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  it('moves focus to the first focusable element on activation', async () => {
    const { getByTestId } = render(<Harness />);
    await flushRaf();
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('wraps focus to first when Tab is pressed on last', async () => {
    const { getByTestId } = render(<Harness />);
    await flushRaf();
    getByTestId('last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('wraps focus to last when Shift+Tab is pressed on first', async () => {
    const { getByTestId } = render(<Harness />);
    await flushRaf();
    getByTestId('first').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByTestId('last'));
  });

  it('pulls focus back inside when Tab is pressed outside the container', async () => {
    const { getByTestId } = render(<Harness />);
    await flushRaf();
    getByTestId('outside-before').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('is a no-op when active=false', async () => {
    const { getByTestId } = render(<Harness active={false} />);
    await flushRaf();
    // Focus should remain on body since the trap never activated
    expect(document.activeElement).not.toBe(getByTestId('first'));
  });

  it('restores focus to the previously focused element on deactivation', async () => {
    // Render with the trap inactive so the harness mounts without
    // claiming focus. Park focus on outside-before, THEN flip the trap
    // active — that's the real-world flow (button click opens a modal).
    const { getByTestId, rerender } = render(<Harness active={false} />);
    getByTestId('outside-before').focus();
    expect(document.activeElement).toBe(getByTestId('outside-before'));
    rerender(<Harness active={true} />);
    await flushRaf();
    expect(document.activeElement).toBe(getByTestId('first'));
    rerender(<Harness active={false} />);
    await flushRaf();
    expect(document.activeElement).toBe(getByTestId('outside-before'));
  });
});
