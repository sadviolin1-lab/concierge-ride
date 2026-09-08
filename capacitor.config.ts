import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.concierge.ride',
  appName: 'ConciergeRide',
  webDir: 'public',
  server: {
    url: 'http://10.0.2.2:3000/login',
    cleartext: true
  }
};

export default config;
