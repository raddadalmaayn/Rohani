import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.0bc77eebcf3742b7b767acb59493be96',
  appName: 'rohani-inner-spark',
  webDir: 'dist',
  server: {
    url: 'https://0bc77eeb-cf37-42b7-b767-acb59493be96.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;