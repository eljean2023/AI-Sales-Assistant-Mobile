import * as SecureStore from "expo-secure-store";

import { SECURE_STORE_KEYS } from "../config/constants";

// PlatformEvent (the SUPER_ADMIN notification source) has no readAt column by design — see
// lib/mobile-notifications.ts in the backend. Read state for those notifications is tracked
// on-device instead. Pruned against the current list on every read so it can never grow past
// the backend's own list cap.

async function readIds(): Promise<Set<string>> {
  const raw = await SecureStore.getItemAsync(SECURE_STORE_KEYS.readNotificationIds);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function writeIds(ids: Set<string>): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.readNotificationIds, JSON.stringify([...ids]));
}

export async function getReadIds(): Promise<Set<string>> {
  return readIds();
}

export async function markRead(id: string): Promise<Set<string>> {
  const ids = await readIds();
  ids.add(id);
  await writeIds(ids);
  return ids;
}

export async function markAllRead(currentIds: string[]): Promise<Set<string>> {
  const ids = await readIds();
  for (const id of currentIds) ids.add(id);
  await writeIds(ids);
  return ids;
}

// Drops stored ids that have scrolled off the backend's list (capped at 50, newest-first) so
// the stored set stays bounded instead of growing forever.
export async function pruneReadIds(currentIds: string[]): Promise<Set<string>> {
  const current = new Set(currentIds);
  const ids = await readIds();
  const pruned = new Set([...ids].filter((id) => current.has(id)));
  await writeIds(pruned);
  return pruned;
}
