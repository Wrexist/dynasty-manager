// Must be the first import. Initializes Sentry synchronously so any throw
// during the heavier import chain below (App, gameStore, slices) still
// reaches Sentry rather than being lost to the iOS native uncaught handler.
import './bootstrap-sentry';
import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPurchases } from '@/utils/purchases';
import { initAds } from '@/utils/ads';
import { useGameStore } from '@/store/gameStore';
import { initSentry, addGameBreadcrumb } from '@/utils/sentry';
import { track } from '@/utils/analytics';
import { hydrateSaveStorage } from '@/store/helpers/persistence';

// Configures the SDK iff VITE_SENTRY_DSN is set — release tag, PII scrubbing,
// and breadcrumb scrubbing live in src/utils/sentry.ts.
initSentry();

// Kick off save-storage hydration before React renders. The promise is
// exported for UI code (TitleScreen) to await before showing the slot
// picker — otherwise the picker could render "No Save" on an install
// whose data lives only in IndexedDB, not localStorage.
export const saveStorageReady = hydrateSaveStorage();

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

// Catch unhandled promise rejections (async errors outside React tree).
// event.reason can be undefined on iOS WKWebView when a fetch is aborted
// during background; coerce to a real Error so Sentry actually captures it.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason ?? new Error('Unhandled rejection with no reason');
  addGameBreadcrumb('crash', 'Unhandled promise rejection');
  track('crash', { category: 'unhandled_rejection' });
  Sentry.captureException(reason, { tags: { context: 'unhandledRejection' } });
});

// Catch uncaught synchronous errors outside the React tree. The Sentry SDK's
// own GlobalHandlers integration normally covers this, but we belt-and-braces
// capture here too — when VITE_SENTRY_DSN is missing in a TestFlight build,
// the SDK no-ops and we'd otherwise lose the error entirely.
window.addEventListener('error', (event) => {
  addGameBreadcrumb('crash', 'Uncaught error', { message: event.message?.slice(0, 120) ?? null });
  track('crash', { category: 'uncaught_error' });
  if (event.error) {
    Sentry.captureException(event.error, { tags: { context: 'window.error' } });
  }
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
  // Lifecycle handlers fire during page hide / app background. A throw here
  // can hang the iOS WKWebView during backgrounding or corrupt the save.
  try {
    const state = useGameStore.getState();
    if (state.gameStarted) state.flushForLifecycle();
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'flushOnLifecycle' } });
  }
}

window.addEventListener('pagehide', flushOnLifecycle);
window.addEventListener('beforeunload', flushOnLifecycle);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushOnLifecycle();
});

// Splash screen hide is idempotent — calling SplashScreen.hide() twice in
// the same launch can throw on iOS 15.x (the view's CALayer may already be
// dealloc'd). This guard ensures both the happy path AND the 5s failsafe
// reach a single hide call.
let splashHidden = false;
async function hideSplashOnce() {
  if (splashHidden) return;
  splashHidden = true;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'splash.hide' } });
  }
}

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

    // Status bar — isolated so failure doesn't block splash hide.
    // setBackgroundColor is Android-only; calling it on iOS is a no-op
    // in current plugin versions but logged warnings on earlier 8.x.
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: Style.Dark });
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: '#0f1524' });
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[initNative] StatusBar init failed:', err);
      Sentry.captureException(err, { tags: { context: 'initNative.StatusBar' } });
    }

    // RevenueCat — isolated from AdMob
    try { await initPurchases(); }
    catch (err) {
      if (import.meta.env.DEV) console.warn('[initNative] Purchases init failed:', err);
      Sentry.captureException(err, { tags: { context: 'initNative.Purchases' } });
    }

    // AdMob — isolated from other SDKs
    try { await initAds(); }
    catch (err) {
      if (import.meta.env.DEV) console.warn('[initNative] Ads init failed:', err);
      Sentry.captureException(err, { tags: { context: 'initNative.Ads' } });
    }

    // Auto-save game state when app is backgrounded (iOS may reclaim WebView)
    try {
      const { App: CapApp } = await import('@capacitor/app');
      CapApp.addListener('pause', () => {
        try {
          const state = useGameStore.getState();
          if (state.gameStarted) {
            state.flushForLifecycle();
          }
        } catch (err) {
          Sentry.captureException(err, { tags: { context: 'capApp.pause' } });
        }
      });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[initNative] App lifecycle init failed:', err);
      Sentry.captureException(err, { tags: { context: 'initNative.AppLifecycle' } });
    }

    // Wait for React to paint before hiding splash (3s safety timeout)
    await Promise.race([
      appReady,
      new Promise<void>(resolve => setTimeout(resolve, 3000)),
    ]);
    await hideSplashOnce();
  } catch (err) {
    if (import.meta.env.DEV) console.error('[initNative] Native initialization failed:', err);
    Sentry.captureException(err, { tags: { context: 'initNative' } });
  }
}

initNative();

// Splash failsafe — if initNative throws before splash hide is reached
// (or that call itself rejects), TestFlight users would see a stuck splash.
// Force-hide after 5s. hideSplashOnce guards against double-hide crashes.
setTimeout(() => { void hideSplashOnce(); }, 5000);
