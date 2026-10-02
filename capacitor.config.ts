import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arypos.app',
  appName: 'ARY POS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
