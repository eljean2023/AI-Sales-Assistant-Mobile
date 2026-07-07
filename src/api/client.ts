import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { API_BASE_URL } from "../config/env";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "../auth/tokenStorage";

let onSessionExpired: (() => void) | null = null;

// AuthContext registers itself here so the client can force a logout when a
// refresh attempt fails, without importing AuthContext (would be circular).
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const accessToken = await getAccessToken();
  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  // Plain axios call (not `apiClient`) so this request skips the auth
  // interceptors above and can't trigger itself recursively on a 401.
  const response = await axios.post<{ accessToken: string; refreshToken: string }>(
    `${API_BASE_URL}/api/mobile/auth/refresh`,
    { refreshToken },
  );
  await saveTokens(response.data);
  return response.data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retried) {
      throw error;
    }
    originalRequest._retried = true;

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newAccessToken = await refreshPromise;
      if (!newAccessToken) throw error;

      originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
      return apiClient(originalRequest);
    } catch {
      await clearTokens();
      onSessionExpired?.();
      throw error;
    }
  },
);
