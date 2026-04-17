// Module-level singleton — only queries WebGL once per page load
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

export function useThreeAvailable(): boolean {
  if (_cached === null) {
    _cached = detectWebGL();
  }
  return _cached;
}
