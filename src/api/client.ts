import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { API_BASE_URL } from "../config/env";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "../auth/tokenStorage";
import { logger } from "../utils/logger";

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
  logger.info("->", config.method?.toUpperCase(), `${config.baseURL ?? ""}${config.url ?? ""}`, redactBody(config.data));
  return config;
});

// Strips fields a request/response log should never echo (passwords, tokens) while keeping
// the rest of the payload useful for diagnosing connectivity/shape issues.
const SECRET_FIELDS = ["password", "accessToken", "refreshToken"];
function redactBody(data: unknown): unknown {
  if (typeof data === "string") {
    try {
      return redactBody(JSON.parse(data));
    } catch {
      return data;
    }
  }
  if (!data || typeof data !== "object") return data;
  const clone: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const field of SECRET_FIELDS) {
    if (field in clone) clone[field] = "[redacted]";
  }
  return clone;
}

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
  (response) => {
    logger.info("<-", response.status, response.config.url, redactBody(response.data));
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response) {
      logger.error("<-", error.response.status, originalRequest?.url, redactBody(error.response.data));
    } else {
      // No response at all means the request never reached the server: wrong host/port,
      // device unreachable on the network, or a timeout — as opposed to a 4xx/5xx the
      // server actually answered with. Distinguishing this here is what let this exact bug
      // (API_BASE_URL pointing at an unreachable host) get misreported as "wrong password".
      logger.error("<- no response for", originalRequest?.url, error.code, error.message);
    }

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
