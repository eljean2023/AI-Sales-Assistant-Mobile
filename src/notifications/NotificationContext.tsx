import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";

import { useAuth } from "../auth/useAuth";
import { onFcmTokenRefresh } from "./fcm";
import { showFromRemoteMessage } from "./localDisplay";
import { buildNotificationRoute, type NotificationContent } from "./notificationRouter";
import { useNotificationSettings } from "./useNotificationSettings";

export interface NotificationContextValue {
  lastNotification: NotificationContent | null;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

function navigateToNotification(content: NotificationContent) {
  const route = buildNotificationRoute(content);
  router.push(route);
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const { enabled, hasPreference, isLoading, setEnabled } = useNotificationSettings();
  const [lastNotification, setLastNotification] = useState<NotificationContent | null>(null);
  const handledColdStart = useRef(false);

  // First login on a fresh install: opt the user in by default. Afterward,
  // their explicit choice in Settings is respected.
  useEffect(() => {
    if (isAuthenticated && !isLoading && !hasPreference) {
      setEnabled(true).catch(() => undefined);
    }
  }, [isAuthenticated, isLoading, hasPreference, setEnabled]);

  // Re-register the device if the FCM token rotates while the app is running.
  useEffect(() => {
    if (!isAuthenticated || !enabled) return undefined;
    return onFcmTokenRefresh(() => {
      setEnabled(true).catch(() => undefined);
    });
  }, [isAuthenticated, enabled, setEnabled]);

  // Foreground messages: FCM does not auto-display these, so show them
  // ourselves and keep the latest one around for the Home screen status.
  useEffect(() => {
    return messaging().onMessage(async (remoteMessage) => {
      await showFromRemoteMessage(remoteMessage);
      setLastNotification({
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        data: remoteMessage.data,
      });
    });
  }, []);

  // Tap handling: user tapped a notification while the app was foregrounded
  // or backgrounded (not killed).
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const content: NotificationContent = {
        title: response.notification.request.content.title,
        body: response.notification.request.content.body,
        data: response.notification.request.content.data,
      };
      setLastNotification(content);
      navigateToNotification(content);
    });
    return () => subscription.remove();
  }, []);

  // Tap handling: app was launched from a killed state by tapping a
  // notification.
  useEffect(() => {
    if (handledColdStart.current) return;
    handledColdStart.current = true;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const content: NotificationContent = {
        title: response.notification.request.content.title,
        body: response.notification.request.content.body,
        data: response.notification.request.content.data,
      };
      setLastNotification(content);
      navigateToNotification(content);
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{ lastNotification, notificationsEnabled: enabled, setNotificationsEnabled: setEnabled }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
