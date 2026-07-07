import type { ExpoConfig, ConfigContext } from "expo/config";
import { AndroidConfig, withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";

// Values come from `.env` (see .env.example). `expo start`/`expo prebuild`
// load `.env` automatically, no extra tooling required.
const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.example.com";

// @react-native-firebase/messaging's AndroidManifest.xml declares its own
// `com.google.firebase.messaging.default_notification_color` meta-data
// (backed by a firebase.json placeholder), which collides with the one
// expo-notifications generates for our app icon color. Without this,
// `expo prebuild` output fails Gradle's manifest merge with:
// "Attribute meta-data#...default_notification_color ... requires tools:replace".
const withFcmNotificationColorMergeFix: ConfigPlugin = (config) =>
  withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const metaDataItems = mainApplication["meta-data"] ?? [];
    const index = AndroidConfig.Manifest.findMetaDataItem(
      mainApplication,
      "com.google.firebase.messaging.default_notification_color"
    );
    if (index > -1) {
      (metaDataItems[index].$ as Record<string, string>)["tools:replace"] = "android:resource";
    }
    config.modResults = AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);
    return config;
  });

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "AI Sales Assistant",
  slug: "ai-sales-assistant-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "aisalesassistant",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.aisalesassistant.mobile",
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? "./GoogleService-Info.plist",
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    package: "com.aisalesassistant.mobile",
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    adaptiveIcon: {
      backgroundColor: "#0B1220",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    // Registered first so its AndroidManifest mod runs *last* — Expo's mod
    // pipeline executes manifest mods in reverse of plugin-array order,
    // wrapping each newly-registered mod around the previous ones.
    // Expo's `ExpoConfig.plugins` type only lists string/tuple forms, but the
    // resolver also accepts a plugin function directly at runtime.
    withFcmNotificationColorMergeFix as unknown as [string, unknown],
    "expo-router",
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        ios: { useFrameworks: "static" },
      },
    ],
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#0B1220",
      },
    ],
  ],
 extra: {
  apiBaseUrl: API_BASE_URL,
  eas: {
    projectId: "d9228e3a-8dbd-4cab-8265-10f02f40f784",
  },
},
});
