import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPurchases } from '@/utils/purchases';
import { initAds } from '@/utils/ads';
import { useGameStore } from '@/store/gameStore';

// Initialize Sentry for crash reporting (only if DSN is configured)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.DEV ? 'development' : 'production',
    // Only send errors in production, reduce noise in dev
    enabled: !import.meta.env.DEV,
    // Sample 100% of errors, 10% of transactions
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
  });
}

// Promise that resolves once the first frame has painted
let resolveAppReady: (() => void) | null = null;
const appReady = new Promise<void>((resolve) => {
  resolveAppReady = resolve;
});
export const signalReady = () => {
  resolveAppReady?.();
  resolveAppReady = null;
};

createRoot(document.getElementById("root")!).render(<App />);

// Mark app as ready after render + first paint (avoids fixed splash delay on native)
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    signalReady();
  });
});

// Catch unhandled promise rejections (async errors outside React tree)
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason, { tags: { context: 'unhandledRejection' } });
});

// Save any pending state before the page goes away. We use flushForLifecycle()
// which (1) runs any already-scheduled idle save, (2) creates a sync save when
// autoSave is enabled — so memory-only mutations like updateSettings survive
// a tab close — and (3) is a no-op when the user has autoSave disabled.
//
// pagehide/visibilitychange are the reliable signals on mobile Safari and
// Chrome. beforeunload is kept for desktop browsers that don't always fire
// pagehide (e.g. Firefox on some flows).
function flushOnLifecycle() {
  const state = useGameStore.getState();
  if (state.gameStarted) state.flushForLifecycle();
}

window.addEventListener('pagehide', flushOnLifecycle);
window.addEventListener('beforeunload', flushOnLifecycle);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushOnLifecycle();
});

// Initialize Capacitor plugins when running as native app
async function initNative() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      // Web only — register service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
      return;
    }

    // Status bar — isolated so failure doesn't block splash hide
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0f1524' });
    } catch (err) {
      console.warn('[initNative] StatusBar init failed:', err);
      Sentry.captureException(err, { tags: { context: 'initNative.StatusBar' } });
    }

    // RevenueCat — isolated from AdMob
    try { await initPurchases(); }
    catch (err) {
      console.warn('[initNative] Purchases init failed:', err);
      Sentry.captureException(err, { tags: { context: 'initNative.Purchases' } });
    }

    // AdMob — isolated from other SDKs
    try { await initAds(); }
    catch (err) {
      console.warn('[initNative] Ads init failed:', err);
      Sentry.captureException(err, { tags: { context: 'initNative.Ads' } });
    }

    // Auto-save game state when app is backgrounded (iOS may reclaim WebView)
    try {
      const { App: CapApp } = await import('@capacitor/app');
      CapApp.addListener('pause', () => {
        const state = useGameStore.getState();
        if (state.gameStarted) {
          state.flushForLifecycle();
        }
      });
    } catch (err) {
      console.warn('[initNative] App lifecycle init failed:', err);
      Sentry.captureException(err, { tags: { context: 'initNative.AppLifecycle' } });
    }

    // Wait for React to paint before hiding splash (3s safety timeout)
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await Promise.race([
      appReady,
      new Promise<void>(resolve => setTimeout(resolve, 3000)),
    ]);
    await SplashScreen.hide();
  } catch (err) {
    console.error('[initNative] Native initialization failed:', err);
    Sentry.captureException(err, { tags: { context: 'initNative' } });
  }
}

initNative();
