import * as THREE from 'three';

// Parse an HSL CSS var string like "43 96% 46%" → Three.Color
function hslStringToColor(hsl: string): THREE.Color {
  const parts = hsl.trim().split(/\s+/);
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const color = new THREE.Color();
  color.setHSL(h, s, l);
  return color;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}

export function primaryColor(): THREE.Color {
  return hslStringToColor(getCssVar('--primary') || '43 96% 46%');
}

export function accentColor(): THREE.Color {
  return hslStringToColor(getCssVar('--accent') || '215 60% 50%');
}

export function hexToThree(hex: string): THREE.Color {
  const color = new THREE.Color();
  try {
    color.set(hex);
  } catch {
    color.set('#ffffff');
  }
  return color;
}

export function clubColors(color: string, secondaryColor?: string) {
  return {
    primary: hexToThree(color),
    secondary: hexToThree(secondaryColor || '#ffffff'),
  };
}
