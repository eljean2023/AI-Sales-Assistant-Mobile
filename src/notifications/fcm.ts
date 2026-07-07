import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";

/** Requests OS notification permission (covers both the iOS prompt and the
 * Android 13+ POST_NOTIFICATIONS runtime permission). */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getNotificationPermissionStatus(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

export async function getFcmToken(): Promise<string | null> {
  try {
    return await messaging().getToken();
  } catch {
    return null;
  }
}

export function onFcmTokenRefresh(callback: (token: string) => void): () => void {
  return messaging().onTokenRefresh(callback);
}
