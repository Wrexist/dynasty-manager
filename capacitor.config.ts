import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dynastymanager',
  appName: 'Dynasty Manager',
  webDir: 'dist',
  ios: {
    limitsNavigationsToAppBoundDomains: true,
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
      resize: 'body',
      style: 'DARK',
    },
  },
};

export default config;
