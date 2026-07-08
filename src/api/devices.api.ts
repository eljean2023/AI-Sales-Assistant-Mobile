import { apiClient } from "./client";
import { getOrCreateDeviceId } from "../config/deviceId";
import type { RegisterDeviceRequest } from "./types";

export async function registerDevice(payload: Omit<RegisterDeviceRequest, "deviceId">): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const body: RegisterDeviceRequest = { ...payload, deviceId };
  await apiClient.post("/api/mobile/devices/register", body);
}

// Keyed on deviceId (not fcmToken) so this still works even if the token rotated since the
// device was registered — no need to fetch a fresh FCM token just to unregister.
export async function unregisterDevice(): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  await apiClient.post("/api/mobile/devices/unregister", { deviceId });
}

// TEMPORARY — debug helper for the FIREBASE_PRIVATE_KEY rotation investigation. Remove along
// with the Settings screen button and the backend route once push is confirmed working.
export async function sendTestPush(): Promise<unknown> {
  const response = await apiClient.post("/api/mobile/devices/test-push");
  return response.data;
}
