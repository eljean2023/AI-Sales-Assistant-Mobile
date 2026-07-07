export const SECURE_STORE_KEYS = {
  accessToken: "auth.accessToken",
  refreshToken: "auth.refreshToken",
  user: "auth.user",
} as const;

export const SETTINGS_STORE_KEYS = {
  notificationsEnabled: "settings.notificationsEnabled",
} as const;
