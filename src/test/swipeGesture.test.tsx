import { describe, it, expect, vi, afterEach } from 'vitest';
import { createPortal } from 'react-dom';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useSwipeGesture, isSwipeExemptTarget } from '@/hooks/useSwipeGesture';

// A swipe that starts on a control which owns its own horizontal gesture must
// never switch screens: dragging the bid slider in a negotiation used to jump
// to Scouting and throw the negotiation away (audit 2026-09-25 #7).

afterEach(cleanup);

function mount(html: string): { root: HTMLElement; find: (sel: string) => HTMLElement } {
  const root = document.createElement('main');
  root.innerHTML = html;
  document.body.appendChild(root);
  return { root, find: (sel: string) => root.querySelector(sel) as HTMLElement };
}

describe('isSwipeExemptTarget', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('lets an ordinary target swipe', () => {
    const { root, find } = mount('<section><p id="t">text</p></section>');
    expect(isSwipeExemptTarget(find('#t'), root)).toBe(false);
  });

  it.each([
    ['a range input', '<input id="t" type="range" />'],
    ['a child of a role=slider thumb', '<div role="slider"><span id="t"></span></div>'],
    ['content inside a role=dialog', '<div role="dialog"><button id="t">Bid</button></div>'],
    ['content inside an aria-modal layer', '<div aria-modal="true"><span id="t"></span></div>'],
    ['a Radix popper wrapper', '<div data-radix-popper-content-wrapper><span id="t"></span></div>'],
    ['anything marked data-no-swipe', '<div data-no-swipe><span id="t"></span></div>'],
  ])('exempts %s', (_label, html) => {
    const { root, find } = mount(html);
    expect(isSwipeExemptTarget(find('#t'), root)).toBe(true);
  });

  it('exempts a target inside a position:fixed overlay (in-page negotiation modals)', () => {
    const { root, find } = mount('<div style="position: fixed"><span id="t"></span></div>');
    expect(isSwipeExemptTarget(find('#t'), root)).toBe(true);
  });

  it('exempts a row that actually scrolls sideways, but not one that fits', () => {
    const { root, find } = mount('<div id="row" style="overflow-x: auto"><span id="t"></span></div>');
    const row = find('#row');
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(row, 'scrollWidth', { configurable: true, value: 300 });
    expect(isSwipeExemptTarget(find('#t'), root)).toBe(false);
    Object.defineProperty(row, 'scrollWidth', { configurable: true, value: 900 });
    expect(isSwipeExemptTarget(find('#t'), root)).toBe(true);
  });

  it('does not exempt overflowing content whose overflow-x is not scrollable', () => {
    const { root, find } = mount('<div id="row" style="overflow-x: hidden"><span id="t"></span></div>');
    const row = find('#row');
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(row, 'scrollWidth', { configurable: true, value: 900 });
    expect(isSwipeExemptTarget(find('#t'), root)).toBe(false);
  });

  it('exempts a target outside the boundary (a React portal bubbling into <main>)', () => {
    const { root } = mount('<p>page</p>');
    const portalNode = document.createElement('div');
    document.body.appendChild(portalNode);
    expect(isSwipeExemptTarget(portalNode, root)).toBe(true);
  });
});

function Harness({ onLeft, onRight }: { onLeft: () => void; onRight: () => void }) {
  const handlers = useSwipeGesture({ onSwipeLeft: onLeft, onSwipeRight: onRight });
  return (
    <main data-testid="main" {...handlers}>
      <p data-testid="plain">page body</p>
      <input data-testid="slider" type="range" />
      {createPortal(<div data-testid="sheet">sheet</div>, document.body)}
    </main>
  );
}

function swipeLeft(el: Element) {
  fireEvent.touchStart(el, { touches: [{ clientX: 300, clientY: 200 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 150, clientY: 205 }] });
}

describe('useSwipeGesture target filter', () => {
  it('switches screens for a swipe on the page body', () => {
    const onLeft = vi.fn();
    const { getByTestId } = render(<Harness onLeft={onLeft} onRight={vi.fn()} />);
    swipeLeft(getByTestId('plain'));
    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  it('ignores a swipe that starts on a range slider', () => {
    const onLeft = vi.fn();
    const { getByTestId } = render(<Harness onLeft={onLeft} onRight={vi.fn()} />);
    swipeLeft(getByTestId('slider'));
    expect(onLeft).not.toHaveBeenCalled();
  });

  it('ignores a swipe inside a portalled sheet even though React bubbles it to <main>', () => {
    const onLeft = vi.fn();
    const { getByTestId } = render(<Harness onLeft={onLeft} onRight={vi.fn()} />);
    swipeLeft(getByTestId('sheet'));
    expect(onLeft).not.toHaveBeenCalled();
  });
});
