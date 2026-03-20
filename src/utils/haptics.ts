// Haptic feedback wrapper — uses Capacitor Haptics when available, no-op in browser
// Import dynamically to avoid build errors before Capacitor is installed

let Haptics: any = null;
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

export async function hapticLight() {
  await loadHaptics();
  if (Haptics && ImpactStyle) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  }
}

export async function hapticMedium() {
  await loadHaptics();
  if (Haptics && ImpactStyle) {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  }
}

export async function hapticHeavy() {
  await loadHaptics();
  if (Haptics && ImpactStyle) {
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  }
}
