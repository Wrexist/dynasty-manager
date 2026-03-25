// Haptic feedback wrapper — uses Capacitor Haptics when available, no-op in browser
// Import dynamically to avoid build errors before Capacitor is installed
// Respects the hapticsEnabled game setting (defaults to true)

import { useGameStore } from '@/store/gameStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Haptics: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ImpactStyle: any = null;

async function loadHaptics() {
  if (Haptics !== null) return;
  try {
    const mod = await import('@capacitor/haptics');
    Haptics = mod.Haptics;
    ImpactStyle = mod.ImpactStyle;
  } catch {
    // Capacitor not available (browser dev mode)
    Haptics = false;
  }
}

function isHapticsEnabled(): boolean {
  try {
    return useGameStore.getState().settings?.hapticsEnabled !== false;
  } catch {
    return true;
  }
}

export async function hapticLight() {
  if (!isHapticsEnabled()) return;
  await loadHaptics();
  if (Haptics && ImpactStyle) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  }
}

export async function hapticMedium() {
  if (!isHapticsEnabled()) return;
  await loadHaptics();
  if (Haptics && ImpactStyle) {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  }
}

export async function hapticHeavy() {
  if (!isHapticsEnabled()) return;
  await loadHaptics();
  if (Haptics && ImpactStyle) {
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  }
}
