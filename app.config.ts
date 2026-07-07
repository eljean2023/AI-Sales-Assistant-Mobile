import type { ExpoConfig, ConfigContext } from "expo/config";

// Values come from `.env` (see .env.example). `expo start`/`expo prebuild`
// load `.env` automatically, no extra tooling required.
const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.example.com";

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
  },
});
