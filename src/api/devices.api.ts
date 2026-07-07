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
