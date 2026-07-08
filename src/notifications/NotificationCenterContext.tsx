import messaging from "@react-native-firebase/messaging";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";

import { listNotifications, markNotificationRead } from "../api/notifications.api";
import type { MobileNotification } from "../api/types";
import { useAuth } from "../auth/useAuth";
import { hasNotificationCenterAccess } from "./access";
import { markAllRead, markRead, pruneReadIds } from "./readState";

export interface NotificationItem extends MobileNotification {
  read: boolean;
}

export interface NotificationCenterContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markOneRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationCenterContext = createContext<NotificationCenterContextValue | null>(null);

export function useNotificationCenter(): NotificationCenterContextValue {
  const context = useContext(NotificationCenterContext);
  if (!context) {
    throw new Error("useNotificationCenter must be used within a NotificationCenterProvider");
  }
  return context;
}

function isRead(notification: MobileNotification, readIds: Set<string>): boolean {
  return notification.source === "tenant" ? notification.readAt !== null : readIds.has(notification.id);
}

export function NotificationCenterProvider({ children }: PropsWithChildren) {
  const { user, isAuthenticated } = useAuth();
  const enabled = isAuthenticated && hasNotificationCenterAccess(user?.role);

  const [raw, setRaw] = useState<MobileNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const list = await listNotifications();
      const pruned = await pruneReadIds(list.map((n) => n.id));
      setRaw(list);
      setReadIds(pruned);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  // Catches notifications that arrived while the app was backgrounded.
  useEffect(() => {
    if (!enabled) return undefined;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [enabled, refresh]);

  // Catches notifications that arrive while the app is already open — FCM foreground messages
  // don't touch AppState, so the listener above alone would miss them. A second onMessage
  // subscription alongside NotificationContext's own is safe; Firebase supports multiple.
  useEffect(() => {
    if (!enabled) return undefined;
    return messaging().onMessage(() => refresh());
  }, [enabled, refresh]);

  const markOneRead = useCallback(async (id: string) => {
    const target = raw.find((n) => n.id === id);
    if (!target || isRead(target, readIds)) return;

    if (target.source === "tenant") {
      await markNotificationRead(id).catch(() => undefined);
      setRaw((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      return;
    }

    const updated = await markRead(id);
    setReadIds(updated);
  }, [raw, readIds]);

  const markAllAsRead = useCallback(async () => {
    const unreadTenantIds = raw.filter((n) => n.source === "tenant" && n.readAt === null).map((n) => n.id);
    const platformIds = raw.filter((n) => n.source === "platform").map((n) => n.id);

    await Promise.all([
      Promise.all(unreadTenantIds.map((id) => markNotificationRead(id).catch(() => undefined))),
      markAllRead(platformIds).then(setReadIds),
    ]);

    if (unreadTenantIds.length > 0) {
      const readAt = new Date().toISOString();
      setRaw((prev) => prev.map((n) => (unreadTenantIds.includes(n.id) ? { ...n, readAt } : n)));
    }
  }, [raw]);

  const notifications = useMemo<NotificationItem[]>(
    () => raw.map((n) => ({ ...n, read: isRead(n, readIds) })),
    [raw, readIds],
  );
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<NotificationCenterContextValue>(
    () => ({ notifications, unreadCount, isLoading, refresh, markOneRead, markAllAsRead }),
    [notifications, unreadCount, isLoading, refresh, markOneRead, markAllAsRead],
  );

  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}
