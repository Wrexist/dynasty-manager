// Module-level singleton — only queries WebGL once per page load.
// Not a React hook (no hooks called internally), so callers can invoke it
// unconditionally without the `use*` convention linter tripping.
let _cached: boolean | null = null;

function detectWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return false;
    // Check it's not a blacklisted renderer
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
      if (renderer && /SwiftShader|llvmpipe|Software/i.test(renderer)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Returns true if the current browser has a usable WebGL context. Cached per page load. */
export function isThreeAvailable(): boolean {
  if (_cached === null) {
    _cached = detectWebGL();
  }
  return _cached;
}

/** Test-only: reset the cache between test runs. Not exported from barrel. */
export function __resetThreeAvailableCache(): void {
  _cached = null;
}
