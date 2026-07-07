import { apiClient } from "./client";
import { getRefreshToken } from "../auth/tokenStorage";
import type { LoginRequest, LoginResponse } from "./types";

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>("/api/mobile/auth/login", credentials);
  return response.data;
}

export async function logout(): Promise<void> {
  // Sends the current refresh token so the backend revokes only this session, not every
  // session this account has across other devices.
  const refreshToken = await getRefreshToken();
  await apiClient.post("/api/mobile/auth/logout", refreshToken ? { refreshToken } : undefined);
}
