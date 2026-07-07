import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";

// Controls how a notification is presented while the app is in the
// foreground. Without this, a locally-scheduled notification (see
// `showFromRemoteMessage` below) would not surface a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Displays a local notification from an FCM message received while the app
 * is in the foreground (foreground FCM messages are not auto-displayed by
 * the OS the way background/killed-state ones are). */
export async function showFromRemoteMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const title = remoteMessage.notification?.title ?? "AI Sales Assistant";
  const body = remoteMessage.notification?.body ?? "";

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: remoteMessage.data ?? {},
    },
    trigger: null,
  });
}
