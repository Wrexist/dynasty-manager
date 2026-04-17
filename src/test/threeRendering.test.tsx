/**
 * Three.js integration tests.
 *
 * R3F's Canvas cannot render in jsdom (no WebGL). Instead of trying to render
 * the 3D tree, we verify the React wiring around it: capability gating, error
 * boundary recovery, prop threading, and cleanup of lazy-loaded imports.
 *
 * `@react-three/fiber`'s `Canvas` is stubbed as a pass-through `<div>` so we
 * can assert on what would have been rendered inside it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Component, useState } from 'react';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-canvas">{children}</div>
  ),
  useFrame: () => {},
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Line: () => null,
}));

// isThreeAvailable is module-cached; reset between tests that poke it.
import { isThreeAvailable, __resetThreeAvailableCache } from '@/components/game/three/shared/isThreeAvailable';
import { ThreeErrorBoundary } from '@/components/game/three/shared/ThreeErrorBoundary';

beforeEach(() => {
  __resetThreeAvailableCache();
});

describe('isThreeAvailable', () => {
  it('returns false when canvas.getContext returns null (no WebGL)', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
    try {
      expect(isThreeAvailable()).toBe(false);
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  it('returns true when WebGL is present', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = ((type: string) => {
      if (type === 'webgl2' || type === 'webgl') {
        return { getExtension: () => null, getParameter: () => '' } as unknown as WebGLRenderingContext;
      }
      return null;
    }) as typeof HTMLCanvasElement.prototype.getContext;
    try {
      expect(isThreeAvailable()).toBe(true);
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  it('releases the probe WebGL context via WEBGL_lose_context', () => {
    const loseContext = vi.fn();
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = ((type: string) => {
      if (type === 'webgl2' || type === 'webgl') {
        return {
          getExtension: (name: string) => name === 'WEBGL_lose_context' ? { loseContext } : null,
          getParameter: () => '',
        } as unknown as WebGLRenderingContext;
      }
      return null;
    }) as typeof HTMLCanvasElement.prototype.getContext;
    try {
      isThreeAvailable();
      // The probe must free its context immediately so it doesn't sit against
      // iOS's ~16-WebGL-context budget until GC.
      expect(loseContext).toHaveBeenCalledTimes(1);
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  it('caches its result — subsequent calls reuse the first detection', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    spy.mockImplementation(() => null);
    try {
      isThreeAvailable();
      const callsAfterFirst = spy.mock.calls.length;
      isThreeAvailable();
      isThreeAvailable();
      // Further calls must not add any getContext invocations — all three
      // webgl2/webgl/experimental fallbacks only tried on the first call.
      expect(spy.mock.calls.length).toBe(callsAfterFirst);
    } finally {
      spy.mockRestore();
    }
  });
});

// ── ThreeErrorBoundary ────────────────────────────────────────────────────────

class Thrower extends Component<{ shouldThrow: boolean }> {
  render() {
    if (this.props.shouldThrow) throw new Error('boom');
    return <span>ok</span>;
  }
}

describe('ThreeErrorBoundary', () => {
  it('renders fallback when a child throws', () => {
    // Silence the expected error noise in componentDidCatch during this test
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ThreeErrorBoundary fallback={<span data-testid="fb">fallback</span>}>
        <Thrower shouldThrow={true} />
      </ThreeErrorBoundary>,
    );
    expect(screen.getByTestId('fb')).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it('recovers when resetKey changes', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Harness() {
      const [key, setKey] = useState(0);
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <div>
          <button data-testid="reset" onClick={() => { setShouldThrow(false); setKey(k => k + 1); }}>reset</button>
          <ThreeErrorBoundary resetKey={key} fallback={<span data-testid="fb">fallback</span>}>
            <Thrower shouldThrow={shouldThrow} />
          </ThreeErrorBoundary>
        </div>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId('fb')).toBeInTheDocument();

    await act(async () => {
      screen.getByTestId('reset').click();
    });
    // After resetKey changes AND the child stops throwing, boundary re-renders children
    expect(screen.queryByTestId('fb')).toBeNull();
    expect(screen.getByText('ok')).toBeInTheDocument();

    errSpy.mockRestore();
  });

  it('stays errored if resetKey does not change', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ThreeErrorBoundary resetKey="a" fallback={<span data-testid="fb">fallback</span>}>
        <Thrower shouldThrow={true} />
      </ThreeErrorBoundary>,
    );
    expect(screen.getByTestId('fb')).toBeInTheDocument();
    // Re-render with the SAME resetKey and a non-throwing child — boundary must
    // still show the fallback because it has no recovery signal.
    rerender(
      <ThreeErrorBoundary resetKey="a" fallback={<span data-testid="fb">fallback</span>}>
        <Thrower shouldThrow={false} />
      </ThreeErrorBoundary>,
    );
    expect(screen.getByTestId('fb')).toBeInTheDocument();
    errSpy.mockRestore();
  });
});
