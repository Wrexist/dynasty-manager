import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPurchases } from '@/utils/purchases';
import { initAds } from '@/utils/ads';

// Promise that resolves once the first screen has mounted
let signalReady: () => void;
const appReady = new Promise<void>((resolve) => { signalReady = resolve; });
export { signalReady };

createRoot(document.getElementById("root")!).render(<App />);

// Initialize Capacitor plugins when running as native app
async function initNative() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      const { StatusBar, Style } = await import('@capacitor/status-bar');

      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0f1524' });

      // Initialize monetization SDKs (idempotent, no-op on web)
      await initPurchases();
      await initAds();

      // Wait for React to paint before hiding splash (3s safety timeout)
      await Promise.race([
        appReady,
        new Promise<void>(resolve => setTimeout(resolve, 3000)),
      ]);
      await SplashScreen.hide();
      return; // Native — skip service worker
    }
  } catch {
    // Not running in Capacitor (browser dev mode)
  }

  // Only register service worker on web (not native)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

initNative();
