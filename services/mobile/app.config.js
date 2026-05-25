module.exports = {
  expo: {
    name: 'Noetia',
    slug: 'noetia',
    version: '1.0.0',
    runtimeVersion: { policy: 'sdkVersion' },
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['**/*'],

    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0D1B2A',
    },

    // OTA updates via EAS Update
    updates: {
      fallbackToCacheTimeout: 0,
      url: 'https://u.expo.dev/99e71dcb-bfa3-4c8d-bb74-2d20edbb1826',
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.noetia.app',
      deploymentTarget: '13.4',
      usesAppleSignIn: true,
      buildNumber: '1',
      // Background audio for Modo Escucha Activa
      infoPlist: {
        UIBackgroundModes: ['audio'],
        NSCameraUsageDescription:
          'Noetia uses your camera to capture background images for your quote cards.',
        NSPhotoLibraryUsageDescription:
          'Noetia accesses your photo library to let you choose background images for your quote cards.',
        NSMicrophoneUsageDescription:
          'Noetia may use the microphone when recording via camera.',
        NSUserNotificationsUsageDescription:
          'Noetia sends you notifications when someone accepts your plan invitation or claims a gift you sent.',
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0D1B2A',
      },
      package: 'com.noetia.app',
      versionCode: 1,
      // Google Play requires targetSdkVersion 34+ as of Nov 2024
      targetSdkVersion: 34,
      compileSdkVersion: 34,
      minSdkVersion: 23,
      permissions: [
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
        'POST_NOTIFICATIONS',
      ],
      // google-services.json is NOT committed — uploaded as EAS secret GOOGLE_SERVICES_JSON
      // (a file secret whose value is the path to the file on the EAS build machine)
      ...(process.env.GOOGLE_SERVICES_JSON
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
        : {}),
    },

    scheme: 'noetia',

    plugins: [
      // Apple Sign-In — iOS only; no-op on Android
      'expo-apple-authentication',
      // Push notifications — configures native FCM/APNs setup
      [
        'expo-notifications',
        {
          icon: './assets/adaptive-icon.png',
          color: '#0D1B2A',
          sounds: [],
          iosDisplayInForeground: true,
        },
      ],
      // Audio player background mode
      [
        'expo-av',
        {
          microphonePermission:
            'Allow Noetia to access the microphone when recording.',
        },
      ],
    ],

    extra: {
      eas: { projectId: '99e71dcb-bfa3-4c8d-bb74-2d20edbb1826' },
    },
    owner: 'carloskfe',
  },
};
