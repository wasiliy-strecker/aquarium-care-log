import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'AquariumLog Dev',
  slug: 'aquariumlog',
  version: '1.0.0',
  scheme: 'aquariumlog',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#176B75',
  platforms: ['android'],
  icon: './assets/icon.png',
  android: {
    package: 'com.appfactory.aquarium_log',
    versionCode: 1,
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/icon-foreground.png',
      backgroundColor: '#176B75',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.VIBRATE',
    ],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_VIDEO',
    ],
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-dev-client',
    // Android mods unwind in reverse order. Our final theme overrides must
    // run after expo-splash-screen has generated Theme.App.SplashScreen.
    './plugins/with-aquarium-android',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#176B75',
        image: './assets/icon-foreground.png',
        imageWidth: 256,
        resizeMode: 'contain',
        dark: { backgroundColor: '#176B75' },
      },
    ],
    'expo-font',
    'expo-asset',
    'expo-sharing',
    ['expo-image-picker', { microphonePermission: false }],
  ],
};
export default config;
