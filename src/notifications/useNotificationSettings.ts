import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

import { registerDevice, unregisterDevice } from "../api/devices.api";
import { SETTINGS_STORE_KEYS } from "../config/constants";
import { getFcmToken, requestNotificationPermission } from "./fcm";

export function useNotificationSettings() {
  // `null` means the user has never made a choice yet (fresh install/login),
  // as opposed to `false` which means they explicitly disabled notifications.
  const [preference, setPreference] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(SETTINGS_STORE_KEYS.notificationsEnabled)
      .then((value) => setPreference(value === null ? null : value === "true"))
      .finally(() => setIsLoading(false));
  }, []);

  const setEnabled = useCallback(async (next: boolean) => {
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) return;

      const fcmToken = await getFcmToken();
      if (fcmToken) {
        await registerDevice({
          fcmToken,
          platform: Platform.OS === "ios" ? "ios" : "android",
          appVersion: Constants.expoConfig?.version ?? "1.0.0",
        });
      }
    } else {
      const fcmToken = await getFcmToken();
      if (fcmToken) {
        await unregisterDevice(fcmToken);
      }
    }

    await SecureStore.setItemAsync(SETTINGS_STORE_KEYS.notificationsEnabled, String(next));
    setPreference(next);
  }, []);

  return { enabled: preference ?? false, hasPreference: preference !== null, isLoading, setEnabled };
}
