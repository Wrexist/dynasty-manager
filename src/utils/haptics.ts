// Haptic feedback wrapper — uses Capacitor Haptics when available, no-op in browser
// Import dynamically to avoid build errors before Capacitor is installed
// Respects the hapticsEnabled game setting (defaults to true)

import { useGameStore } from '@/store/gameStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Haptics: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ImpactStyle: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NotificationType: any = null;

async function loadHaptics() {
  if (Haptics !== null) return;
  try {
    const mod = await import('@capacitor/haptics');
    Haptics = mod.Haptics;
    ImpactStyle = mod.ImpactStyle;
    NotificationType = mod.NotificationType;
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

// ── Notification haptics ──
// Use these for outcomes, not interactions. iOS distinguishes them as a
// distinct success ding / error buzz / warning tick pattern that's
// noticeably different from a plain impact tap.

export async function hapticSuccess() {
  if (!isHapticsEnabled()) return;
  await loadHaptics();
  if (Haptics && NotificationType) {
    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  }
}

export async function hapticError() {
  if (!isHapticsEnabled()) return;
  await loadHaptics();
  if (Haptics && NotificationType) {
    Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  }
}

export async function hapticWarning() {
  if (!isHapticsEnabled()) return;
  await loadHaptics();
  if (Haptics && NotificationType) {
    Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
  }
}
