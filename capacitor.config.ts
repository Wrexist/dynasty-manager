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
