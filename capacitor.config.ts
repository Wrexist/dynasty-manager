import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dynastymanager',
  appName: 'Dynasty Manager',
  webDir: 'dist',
  ios: {
    // Set to false: enabling this flag without a matching WKAppBoundDomains
    // plist array silently throttles WebView storage APIs and can throw
    // SecurityError on localStorage access on iOS 15.0-15.3.
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: 'mobile',
    webContentsDebuggingEnabled: false,
  },
  android: {
    // Match the iOS posture: never ship a debuggable WebView in release.
    webContentsDebuggingEnabled: false,
    // The app is fully offline/local — never allow http content to load over
    // an https context, which would be a downgrade attack surface.
    allowMixedContent: false,
    // Hardware keyboards (tablets / Chromebooks) type into focused inputs
    // rather than triggering app-level key handlers.
    captureInput: true,
    // Paint the dark theme background behind the splash while the WebView
    // boots, avoiding a white flash on first frame (parity with iOS splash).
    backgroundColor: '#0f1524',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 300,
      backgroundColor: '#0f1524',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f1524',
    },
    Keyboard: {
      // 'native' is iOS-recommended when the app handles visual viewport
      // itself (useKeyboardInset does). 'body' resizes the document which
      // can cause layout thrash → OOM in WKWebView on iPhone SE / 8.
      resize: 'native',
      style: 'DARK',
    },
  },
};

export default config;
