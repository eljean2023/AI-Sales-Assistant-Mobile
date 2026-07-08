export const SECURE_STORE_KEYS = {
  accessToken: "auth.accessToken",
  refreshToken: "auth.refreshToken",
  user: "auth.user",
  deviceId: "device.id",
  readNotificationIds: "notifications.readIds",
} as const;

export const SETTINGS_STORE_KEYS = {
  notificationsEnabled: "settings.notificationsEnabled",
} as const;
