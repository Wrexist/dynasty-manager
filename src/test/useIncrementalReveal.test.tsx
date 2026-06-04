import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { useIncrementalReveal } from '@/hooks/useIncrementalReveal';

// Capture the most recent IntersectionObserver instance so tests can fire it.
let lastObserver: { trigger: () => void } | null = null;

class MockIO {
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    lastObserver = { trigger: () => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver) };
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
}

let captured: { visible: number; hasMore: boolean } = { visible: 0, hasMore: false };

function Harness({ items, initial, step }: { items: number[]; initial?: number; step?: number }) {
  const { visible, sentinelRef, hasMore } = useIncrementalReveal(items, initial, step);
  captured = { visible: visible.length, hasMore };
  // attach the ref so the observer has a target
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={hasMore ? sentinelRef : ref} />;
}

describe('useIncrementalReveal', () => {
  beforeEach(() => {
    lastObserver = null;
    (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
      MockIO as unknown as typeof IntersectionObserver;
  });
  afterEach(() => {
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
  });

  const make = (n: number) => Array.from({ length: n }, (_, i) => i);

  it('renders only the initial slice for a long list', () => {
    render(<Harness items={make(100)} initial={24} step={18} />);
    expect(captured.visible).toBe(24);
    expect(captured.hasMore).toBe(true);
  });

  it('reveals more when the sentinel intersects', () => {
    render(<Harness items={make(100)} initial={24} step={18} />);
    expect(captured.visible).toBe(24);
    act(() => { lastObserver?.trigger(); });
    expect(captured.visible).toBe(42);
  });

  it('never reveals more than the list length', () => {
    render(<Harness items={make(30)} initial={24} step={18} />);
    act(() => { lastObserver?.trigger(); });
    expect(captured.visible).toBe(30);
    expect(captured.hasMore).toBe(false);
  });

  it('does not paginate when the list already fits', () => {
    render(<Harness items={make(10)} initial={24} step={18} />);
    expect(captured.visible).toBe(10);
    expect(captured.hasMore).toBe(false);
  });
});
