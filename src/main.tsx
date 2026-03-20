import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
      await SplashScreen.hide();
    }
  } catch {
    // Not running in Capacitor (browser dev mode)
  }
}

initNative();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
