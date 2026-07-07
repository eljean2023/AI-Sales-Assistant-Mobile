import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import { SECURE_STORE_KEYS } from "./constants";

let cachedDeviceId: string | null = null;

/** Stable per-installation identifier, independent of the FCM token (which rotates while the
 * installation doesn't) — the backend's MobileDevice.deviceId is keyed on this, not fcmToken.
 * Generated once per install and persisted in SecureStore; every register/unregister call reuses
 * the same value afterward. */
export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const existing = await SecureStore.getItemAsync(SECURE_STORE_KEYS.deviceId);
  if (existing) {
    cachedDeviceId = existing;
    return existing;
  }

  const generated = Crypto.randomUUID();
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.deviceId, generated);
  cachedDeviceId = generated;
  return generated;
}
