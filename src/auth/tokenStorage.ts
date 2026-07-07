import * as SecureStore from "expo-secure-store";

import { SECURE_STORE_KEYS } from "../config/constants";
import type { AuthTokens, UserProfile } from "../api/types";

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.accessToken);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.refreshToken);
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SECURE_STORE_KEYS.accessToken, tokens.accessToken),
    SecureStore.setItemAsync(SECURE_STORE_KEYS.refreshToken, tokens.refreshToken),
  ]);
}

export async function getUser(): Promise<UserProfile | null> {
  const raw = await SecureStore.getItemAsync(SECURE_STORE_KEYS.user);
  return raw ? (JSON.parse(raw) as UserProfile) : null;
}

export async function saveUser(user: UserProfile): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.user, JSON.stringify(user));
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.accessToken),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.refreshToken),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.user),
  ]);
}
