import { apiClient } from "./client";
import type { RegisterDeviceRequest } from "./types";

export async function registerDevice(payload: RegisterDeviceRequest): Promise<void> {
  await apiClient.post("/devices/register", payload);
}

export async function unregisterDevice(fcmToken: string): Promise<void> {
  await apiClient.post("/devices/unregister", { fcmToken });
}
