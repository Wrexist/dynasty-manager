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

// Promise that resolves once the first screen has mounted
let signalReady: () => void;
const appReady = new Promise<void>((resolve) => { signalReady = resolve; });
export { signalReady };

createRoot(document.getElementById("root")!).render(<App />);

// Auto-save when the browser tab / window is closed
window.addEventListener('beforeunload', () => {
  const state = useGameStore.getState();
  if (state.gameStarted) {
    state.saveGame();
  }
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
    }

    // RevenueCat — isolated from AdMob
    try { await initPurchases(); }
    catch (err) { console.warn('[initNative] Purchases init failed:', err); }

    // AdMob — isolated from other SDKs
    try { await initAds(); }
    catch (err) { console.warn('[initNative] Ads init failed:', err); }

    // Auto-save game state when app is backgrounded (iOS may reclaim WebView)
    try {
      const { App: CapApp } = await import('@capacitor/app');
      CapApp.addListener('pause', () => {
        const state = useGameStore.getState();
        if (state.gameStarted) {
          state.saveGame();
        }
      });
    } catch (err) {
      console.warn('[initNative] App lifecycle init failed:', err);
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
  }
}

initNative();
