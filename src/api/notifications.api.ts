import { apiClient } from "./client";
import type { MobileNotification } from "./types";

export async function listNotifications(): Promise<MobileNotification[]> {
  const response = await apiClient.get<{ notifications: MobileNotification[] }>("/api/mobile/notifications");
  return response.data.notifications;
}

export async function getNotification(id: string): Promise<MobileNotification> {
  const response = await apiClient.get<{ notification: MobileNotification }>(`/api/mobile/notifications/${id}`);
  return response.data.notification;
}

// Only meaningful for tenant-sourced notifications — PlatformEvent has no server-side read
// state (by design, see lib/mobile-notifications.ts), so SUPER_ADMIN read tracking is handled
// entirely client-side via ../notifications/readState instead of calling this.
export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/api/mobile/notifications/${id}/read`);
}
